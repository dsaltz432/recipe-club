import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ParseRequest {
  recipeId: string;
  recipeUrl: string;
  recipeName: string;
}

interface ParsedIngredient {
  name: string;
  quantity: number | null;
  unit: string | null;
  category: string;
  raw_text: string;
}

interface ParsedRecipe {
  description: string | null;
  servings: string | null;
  prep_time: string | null;
  cook_time: string | null;
  total_time: string | null;
  instructions: string[];
  source_title: string | null;
  ingredients: ParsedIngredient[];
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// BUG-001: Detect media type from URL extension or Content-Type header
function detectMediaType(url: string, contentType?: string | null): string {
  const extMap: Record<string, string> = {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".webp": "image/webp",
    ".heic": "image/heic",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
  };

  try {
    const urlPath = new URL(url).pathname.toLowerCase();
    for (const [ext, type] of Object.entries(extMap)) {
      if (urlPath.endsWith(ext)) return type;
    }
  } catch {
    // Invalid URL, fall through to Content-Type check
  }

  if (contentType) {
    const ct = contentType.split(";")[0].trim().toLowerCase();
    if (ct.startsWith("image/") || ct === "application/pdf") return ct;
  }

  return "image/jpeg";
}

// Extract Schema.org/Recipe from JSON-LD script tags
// deno-lint-ignore no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractJsonLdRecipe(html: string): Record<string, any> | null {
  const scriptRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = scriptRegex.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1]);
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        // Direct Recipe type
        if (item["@type"] === "Recipe" || (Array.isArray(item["@type"]) && item["@type"].includes("Recipe"))) {
          return item;
        }
        // Check @graph array (common in WordPress sites)
        if (item["@graph"]) {
          for (const node of item["@graph"]) {
            if (node["@type"] === "Recipe" || (Array.isArray(node["@type"]) && node["@type"].includes("Recipe"))) {
              return node;
            }
          }
        }
      }
    } catch {
      // Invalid JSON in this script tag, try the next one
    }
  }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // BUG-015: Extract recipeId before main try block so error status can always be updated
  let recipeId: string | undefined;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const aiApiKey = Deno.env.get("ANTHROPIC_API_KEY");

    if (!aiApiKey) {
      console.log("ANTHROPIC_API_KEY not configured — skipping recipe parsing");
      return new Response(
        JSON.stringify({ success: true, skipped: true, message: "AI_API_KEY not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // BUG-015: Catch malformed JSON request body early with separate try-catch
    let body: ParseRequest;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid request body" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    recipeId = body.recipeId;
    const { recipeUrl, recipeName } = body;

    if (!recipeId || !recipeUrl) {
      return new Response(
        JSON.stringify({ success: false, error: "recipeId and recipeUrl are required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Upsert recipe_content with status 'parsing'
    await supabase
      .from("recipe_content")
      .upsert({
        recipe_id: recipeId,
        status: "parsing",
        error_message: null,
      }, { onConflict: "recipe_id" });

    // Fetch recipe content
    let recipeText = "";
    let isImage = false;
    let base64Content = "";
    let detectedMediaType = "image/jpeg";

    const isStorageUrl = recipeUrl.includes("supabase") && recipeUrl.includes("storage");
    const isPdfOrImage = /\.(pdf|jpg|jpeg|png|webp|heic)(\?|$)/i.test(recipeUrl);

    if (isStorageUrl || isPdfOrImage) {
      // Download file and send as base64
      let arrayBuffer: ArrayBuffer;
      let responseContentType: string | null = null;

      if (isStorageUrl) {
        // BUG-009: Use Supabase storage client instead of raw fetch for storage URLs.
        // The public URL points to localhost which is unreachable from inside Docker.
        // The Supabase client uses SUPABASE_URL which resolves correctly via kong gateway.
        const url = new URL(recipeUrl);
        const pathMatch = url.pathname.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)/);
        if (!pathMatch) {
          throw new Error(`Invalid storage URL format: ${recipeUrl}`);
        }
        const bucket = pathMatch[1];
        const filePath = decodeURIComponent(pathMatch[2]);

        const { data, error: downloadError } = await supabase.storage.from(bucket).download(filePath);
        if (downloadError || !data) {
          throw new Error(`Failed to download from storage: ${downloadError?.message ?? "No data returned"}`);
        }

        arrayBuffer = await data.arrayBuffer();
        responseContentType = data.type || null;
      } else {
        // Non-storage file URL (e.g. direct link to a .jpg on the web)
        const response = await fetch(recipeUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch recipe file: ${response.status}`);
        }

        // BUG-010: File size validation via Content-Length header
        const contentLength = response.headers.get("content-length");
        if (contentLength && parseInt(contentLength, 10) > MAX_FILE_SIZE) {
          await supabase.from("recipe_content").upsert({
            recipe_id: recipeId,
            status: "failed",
            error_message: "File exceeds 10MB size limit",
          }, { onConflict: "recipe_id" });
          return new Response(
            JSON.stringify({ success: false, error: "File exceeds 10MB size limit" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 413 }
          );
        }

        arrayBuffer = await response.arrayBuffer();
        responseContentType = response.headers.get("content-type");
      }

      // BUG-010: Also check actual buffer size (Content-Length may be absent)
      if (arrayBuffer.byteLength > MAX_FILE_SIZE) {
        await supabase.from("recipe_content").upsert({
          recipe_id: recipeId,
          status: "failed",
          error_message: "File exceeds 10MB size limit",
        }, { onConflict: "recipe_id" });
        return new Response(
          JSON.stringify({ success: false, error: "File exceeds 10MB size limit" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 413 }
        );
      }

      // BUG-001: Detect media type from URL extension or Content-Type header
      detectedMediaType = detectMediaType(recipeUrl, responseContentType);

      // More memory-efficient base64 encoding using chunking
      const uint8Array = new Uint8Array(arrayBuffer);
      const CHUNK_SIZE = 0x8000;
      let binary = "";
      for (let i = 0; i < uint8Array.length; i += CHUNK_SIZE) {
        binary += String.fromCharCode(...uint8Array.subarray(i, i + CHUNK_SIZE));
      }
      base64Content = btoa(binary);
      isImage = true;
    } else {
      // Fetch web page HTML
      const response = await fetch(recipeUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
        },
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch recipe page: ${response.status}`);
      }
      const html = await response.text();

      // Try to extract JSON-LD Recipe schema first — this is the most reliable
      // source since it's the structured data sites provide to Google/search engines
      const jsonLdRecipe = extractJsonLdRecipe(html);
      if (jsonLdRecipe) {
        console.log(`Found JSON-LD Recipe data for ${recipeName}`);
        recipeText = `STRUCTURED RECIPE DATA (from JSON-LD Schema.org/Recipe):\n`;
        recipeText += `Name: ${jsonLdRecipe.name ?? recipeName}\n`;
        if (jsonLdRecipe.recipeYield) recipeText += `Yield: ${jsonLdRecipe.recipeYield}\n`;
        if (jsonLdRecipe.prepTime) recipeText += `Prep time: ${jsonLdRecipe.prepTime}\n`;
        if (jsonLdRecipe.cookTime) recipeText += `Cook time: ${jsonLdRecipe.cookTime}\n`;
        if (jsonLdRecipe.totalTime) recipeText += `Total time: ${jsonLdRecipe.totalTime}\n`;
        if (jsonLdRecipe.description) recipeText += `Description: ${jsonLdRecipe.description}\n`;
        recipeText += `\nIngredients:\n`;
        for (const ing of jsonLdRecipe.recipeIngredient ?? []) {
          recipeText += `- ${ing}\n`;
        }
        if (jsonLdRecipe.recipeInstructions) {
          recipeText += `\nInstructions:\n`;
          for (const step of jsonLdRecipe.recipeInstructions) {
            if (typeof step === "string") {
              recipeText += `- ${step}\n`;
            } else if (step?.text) {
              recipeText += `- ${step.text}\n`;
            }
          }
        }
      } else {
        // Fallback: strip HTML tags to get text content
        console.log(`No JSON-LD found for ${recipeName}, falling back to text extraction`);
        recipeText = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 15000);
      }
    }

    // Build AI prompt
    const systemPrompt = `You are a recipe parser. Extract structured data from recipe content. Return ONLY valid JSON with no markdown formatting.

The JSON should have this structure:
{
  "description": "Brief recipe description or null",
  "servings": "e.g. '4 servings' or null",
  "prep_time": "e.g. '15 minutes' or null",
  "cook_time": "e.g. '45 minutes' or null",
  "total_time": "e.g. '1 hour' or null",
  "instructions": ["Step 1...", "Step 2..."],
  "source_title": "Name of the website/source or null",
  "ingredients": [
    {
      "name": "ingredient name (e.g. 'onion')",
      "quantity": 2,
      "unit": "cup",
      "category": "produce",
      "raw_text": "2 cups diced onion"
    }
  ]
}

Categories must be one of: produce, meat_seafood, dairy, pantry, spices, frozen, bakery, beverages, condiments, other.
Category guidance:
- All cooking oils (olive oil, vegetable oil, canola oil, sesame oil, coconut oil) → "pantry"
- Eggs → "pantry"
- Vinegars and sauces (soy sauce, fish sauce, hot sauce, worcestershire sauce) → "condiments"
- Proteins including tofu, tempeh, and seitan → "meat_seafood" (this category covers all proteins)
- Water → "other" (NEVER "beverages")
- Seeds (sesame seed, poppy seed, etc.) → "spices"
- Lemon/lime juice → "produce" (it comes from produce)
- Canned/jarred tomato products (crushed tomato, tomato paste, diced tomato, tomato sauce) → "pantry" (they are shelf-stable pantry items)
- Fresh tomatoes → "produce"
- Dried fruits (dried apricot, dried cranberry, dried cherry, etc.) → "pantry" (they are shelf-stable)
- Taco shells, tortilla chips, pita chips → "bakery"
For quantity, use null if the amount is "to taste" or unspecified. Unit should be null only for truly unitless countable items (e.g. "3 eggs", "1 onion", "2 carrots").
- COUNT UNITS are real units — put them in the "unit" field, NOT in the name: "head", "bunch", "stalk", "clove", "sprig", "ear", "strip", "slice", "piece".
  Example: "2 medium heads of broccoli" → { "name": "broccoli", "quantity": 2, "unit": "head" }
  Example: "3 garlic cloves" → { "name": "garlic", "quantity": 3, "unit": "clove" }
  Example: "1 bunch cilantro" → { "name": "cilantro", "quantity": 1, "unit": "bunch" }
- When both metric and imperial are listed (e.g. "800g / 28 oz"), prefer the imperial measurement (use 28, "oz").
- Non-standard units like "dash", "pinch", "splash" should be converted: use "tsp" with a small quantity (e.g. 0.125) or null if truly negligible.

For ingredient names:
- Use the BASE ingredient name only, without preparation adjectives or count units.
  YES: "broccoli", "garlic", "ginger", "sesame oil", "soy sauce", "cilantro", "celery"
  NO: "fresh garlic", "broccoli florets", "minced ginger", "toasted sesame oil", "garlic clove", "broccoli head"
- The name should NEVER contain a count unit word (head, clove, bunch, stalk, sprig, ear, strip, slice, piece) — those go in the "unit" field.
- ALWAYS use SINGULAR forms. Common examples:
  "onion" not "onions", "tomato" not "tomatoes", "egg" not "eggs",
  "peanut" not "peanuts", "chestnut" not "chestnuts", "shallot" not "shallots",
  "short rib" not "short ribs", "peppercorn" not "peppercorns",
  "sesame seed" not "sesame seeds", "cherry tomato" not "cherry tomatoes"
  Exception: compound product names where the plural is the standard product name:
  "red pepper flakes" (not "red pepper flake"), "rice noodles" (not "rice noodle"),
  "rolled oats" (not "rolled oat"), "lo mein noodles", "breadcrumbs"
- Keep qualifiers that identify a DIFFERENT product or form:
  YES (different products): "sesame oil", "rice vinegar", "low sodium soy sauce", "romaine lettuce heart"
  YES (distinct product forms): "crushed tomato" (a canned product), "red pepper flakes" (a spice product), "dried apricot" (different from fresh apricot), "dry white wine" (wine classification), "chili oil" (a product), "pickled jalapeño" (a distinct jarred product), "pickled red onion" (a distinct prepared product)
  NO (just preparation state): "fresh broccoli" (same as "broccoli"), "cold water" (same as "water"), "minced garlic" (same as "garlic"), "diced onion" (same as "onion"), "toasted sesame seed" (same as "sesame seed"), "fried shallot" (same as "shallot")
- Use standard abbreviated units: "tsp", "tbsp", "cup", "oz", "lb". NEVER use metric units (g, kg, ml, L) — always convert to the nearest imperial equivalent (e.g. 200g → 7 oz, 500ml → 2 cups)
- Use decimal numbers for quantities, not fractions: 0.25 not 1/4, 0.5 not 1/2, 0.33 not 1/3, 0.67 not 2/3. Round to 2 decimal places maximum (0.33 not 0.333, 0.67 not 0.667)
- For compound ingredients, use the most common single-word form when one exists:
  "cornstarch" not "corn starch"
- Use proper diacritical marks for ingredient names: "jalapeño" not "jalapeno", "crème fraîche" not "creme fraiche", "añejo" not "anejo"
- "wedge" is not a standard unit — convert to "piece": e.g. "1 lime wedge" → { "name": "lime", "quantity": 1, "unit": "piece" }
- "inch" is not a standard unit — convert to "piece": e.g. "1 inch ginger" → { "name": "ginger", "quantity": 1, "unit": "piece" }
- Sub-recipe components (e.g. "1 recipe fajita veggies") — use null for unit and 1 for quantity: { "name": "fajita veggies", "quantity": 1, "unit": null }
- "fresh mozzarella" is a DISTINCT product from regular mozzarella — keep the qualifier "fresh mozzarella"
- "dry oregano" / "dried oregano" are distinct from fresh oregano — keep as "dried oregano"`;

    // Call Anthropic API
    // BUG-001: Use detected media type and correct content block type for PDFs
    const contentBlockType = detectedMediaType === "application/pdf" ? "document" : "image";

    const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": aiApiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 4096,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: isImage
              ? [
                  {
                    type: "text",
                    text: `Parse this recipe "${recipeName}" and extract all structured data including ingredients, instructions, times, and servings.`,
                  },
                  {
                    type: contentBlockType,
                    source: {
                      type: "base64",
                      media_type: detectedMediaType,
                      data: base64Content,
                    },
                  },
                ]
              : `Parse this recipe "${recipeName}" from the following text and extract all structured data:\n\n${recipeText}`,
          },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      throw new Error(`AI API error: ${aiResponse.status} - ${errorText}`);
    }

    const aiResult = await aiResponse.json();
    const aiText = aiResult.content?.[0]?.text || "";

    // BUG-020: Parse JSON with validation — try regex extraction first, validate, fallback to full text
    let parsed: ParsedRecipe;
    try {
      const jsonMatch = aiText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[1].trim());
        } catch {
          // Regex extracted invalid JSON, fall back to full response text
          parsed = JSON.parse(aiText.trim());
        }
      } else {
        parsed = JSON.parse(aiText.trim());
      }
    } catch {
      throw new Error(`Failed to parse AI response as JSON: ${aiText.slice(0, 200)}`);
    }

    // Save to DB — errors here don't prevent returning the parsed result
    const dbWarnings: string[] = [];

    // BUG-014: Use RPC for transactional ingredient replacement
    if (parsed.ingredients && parsed.ingredients.length > 0) {
      const ingredientRows = parsed.ingredients.map((ing, index) => ({
        name: ing.name,
        quantity: ing.quantity,
        unit: ing.unit,
        category: ing.category || "other",
        raw_text: ing.raw_text,
        sort_order: index,
      }));

      const { error: rpcError } = await supabase.rpc("replace_recipe_ingredients", {
        p_recipe_id: recipeId,
        p_ingredients: ingredientRows,
      });
      if (rpcError) dbWarnings.push(`Replace ingredients: ${rpcError.message}`);
    } else {
      // No ingredients to insert — just delete any existing ones
      const { error: deleteError } = await supabase
        .from("recipe_ingredients")
        .delete()
        .eq("recipe_id", recipeId);
      if (deleteError) dbWarnings.push(`Delete ingredients: ${deleteError.message}`);
    }

    // Upsert recipe_content with parsed data
    const { error: contentError } = await supabase
      .from("recipe_content")
      .upsert({
        recipe_id: recipeId,
        description: parsed.description,
        servings: parsed.servings,
        prep_time: parsed.prep_time,
        cook_time: parsed.cook_time,
        total_time: parsed.total_time,
        instructions: parsed.instructions ? JSON.stringify(parsed.instructions) : null,
        source_title: parsed.source_title,
        parsed_at: new Date().toISOString(),
        status: "completed",
        error_message: null,
      }, { onConflict: "recipe_id" });

    if (contentError) dbWarnings.push(`Upsert content: ${contentError.message}`);

    console.log(`Parsed recipe ${recipeId}: ${parsed.ingredients?.length || 0} ingredients, ${dbWarnings.length} db warnings`);

    return new Response(
      JSON.stringify({
        success: dbWarnings.length === 0,
        ingredientCount: parsed.ingredients?.length || 0,
        parsed,
        ...(dbWarnings.length > 0 ? { dbWarnings } : {}),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in parse-recipe:", error);

    // BUG-015: Use early-extracted recipeId directly instead of re-parsing the body
    try {
      if (recipeId) {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        await supabase
          .from("recipe_content")
          .upsert({
            recipe_id: recipeId,
            status: "failed",
            error_message: error instanceof Error ? error.message : "Unknown error",
          }, { onConflict: "recipe_id" });
      }
    } catch {
      // Ignore cleanup errors
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
