import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CookTimelineRequest {
  eventId: string;
  recipeIds: string[];
  mode?: "interleaved" | "side-by-side";
  model?: string;
}

interface CookModeStep {
  recipeId: string;
  recipeName: string;
  sharedRecipeIds?: string[];
  sharedRecipeNames?: string[];
  instruction: string;
  timing?: string;
  category?: "prep" | "active" | "passive" | "finish";
}

const AMOUNTS_RULE = `MANDATORY RULE — QUANTITIES ON FIRST MENTION: The first time an ingredient appears, include its exact quantity and unit inline. Subsequent mentions do not need the amount. Examples: "brown 1 lb ground beef", "add 1/2 onion", "mince 3 cloves garlic", "add 2 cups flour and 1/2 tsp salt". Later steps can say "stir the beef" without repeating the amount. Use the exact quantities from the ingredient list. Always use human-readable fractional notation — never decimals: write "1/2 tsp" not "0.5 tsp", "1/4 cup" not "0.25 cup", "3/4 cup" not "0.75 cup".`;

const INTERLEAVED_SYSTEM_PROMPT = `You are a cooking coordinator. Given multiple recipes prepared simultaneously, create an interleaved cooking timeline optimizing parallel tasks. Start with longest tasks (preheating, boiling). Group prep during passive cooking. Tag each step with recipeId and recipeName. Add timing hints. Categorize: prep/active/passive/finish.

${AMOUNTS_RULE}

When two recipes share an identical or combinable task (e.g. both need diced onions, both need salted boiling water), merge them into a single step and populate sharedRecipeIds and sharedRecipeNames with the other recipes involved. The primary recipeId/recipeName should be the recipe that benefits most or is listed first.

Return ONLY valid JSON array with no markdown formatting. Each element must have:
{
  "recipeId": "the primary recipe UUID",
  "recipeName": "the primary recipe name",
  "sharedRecipeIds": ["optional array of other recipe UUIDs this step also applies to"],
  "sharedRecipeNames": ["optional array of other recipe names matching sharedRecipeIds"],
  "instruction": "the step text",
  "timing": "optional timing hint like '10 minutes' or 'while pasta boils'",
  "category": "prep" | "active" | "passive" | "finish"
}`;

const SIDE_BY_SIDE_SYSTEM_PROMPT = `You are a recipe editor. Given one or more recipes, rewrite each recipe's instructions to include ingredient amounts on first mention. Do not interleave or combine steps across recipes — keep each recipe's steps in their original order, grouped by recipe.

${AMOUNTS_RULE}

Return ONLY valid JSON array with no markdown formatting. Each element must have:
{
  "recipeId": "the recipe UUID",
  "recipeName": "the recipe name",
  "instruction": "the rewritten step text with amounts on first mention",
  "timing": "optional timing hint like '10 minutes'",
  "category": "prep" | "active" | "passive" | "finish"
}`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const aiApiKey = Deno.env.get("ANTHROPIC_API_KEY");

    if (!aiApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "ANTHROPIC_API_KEY not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let body: CookTimelineRequest;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid request body" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const { eventId, recipeIds, mode = "interleaved", model = "claude-sonnet-4-6" } = body;

    if (!recipeIds || recipeIds.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "recipeIds is required and must not be empty" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Cache key includes mode so both views cache independently
    const recipeIdsHash = [...recipeIds].sort().join(",") + `:v1:${mode}`;

    // Check cache first
    const { data: cached } = await supabase
      .from("cook_mode_timelines")
      .select("steps")
      .eq("event_id", eventId)
      .eq("recipe_ids_hash", recipeIdsHash)
      .maybeSingle();

    if (cached?.steps) {
      return new Response(
        JSON.stringify({ success: true, steps: cached.steps }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch recipe names, content, and ingredients
    const { data: recipes, error: recipesError } = await supabase
      .from("recipes")
      .select("id, name")
      .in("id", recipeIds);

    if (recipesError) {
      throw new Error(`Failed to fetch recipes: ${recipesError.message}`);
    }

    const { data: contents, error: contentsError } = await supabase
      .from("recipe_content")
      .select("recipe_id, instructions, prep_time, cook_time, total_time")
      .in("recipe_id", recipeIds);

    if (contentsError) {
      throw new Error(`Failed to fetch recipe content: ${contentsError.message}`);
    }

    const { data: recipeIngredients, error: ingredientsError } = await supabase
      .from("recipe_ingredients")
      .select("recipe_id, name, quantity, unit, raw_text")
      .in("recipe_id", recipeIds);

    if (ingredientsError) {
      throw new Error(`Failed to fetch recipe ingredients: ${ingredientsError.message}`);
    }

    const ingredientsMap = new Map<string, Array<{ name: string; quantity: number | null; unit: string | null; raw_text: string | null }>>();
    (recipeIngredients ?? []).forEach((ing: { recipe_id: string; name: string; quantity: number | null; unit: string | null; raw_text: string | null }) => {
      if (!ingredientsMap.has(ing.recipe_id)) ingredientsMap.set(ing.recipe_id, []);
      ingredientsMap.get(ing.recipe_id)!.push(ing);
    });

    const recipeMap = new Map((recipes ?? []).map((r: { id: string; name: string }) => [r.id, r.name]));
    const contentMap = new Map((contents ?? []).map((c: { recipe_id: string; instructions: unknown; prep_time: string | null; cook_time: string | null; total_time: string | null }) => [c.recipe_id, c]));

    const recipeSummaries = recipeIds.map((id) => {
      const name = recipeMap.get(id) ?? "Unknown Recipe";
      const content = contentMap.get(id);
      const instructionsRaw = content?.instructions;
      let instructions: string[] = [];
      if (Array.isArray(instructionsRaw)) {
        instructions = instructionsRaw as string[];
      } else if (typeof instructionsRaw === "string" && instructionsRaw.trim()) {
        try { instructions = JSON.parse(instructionsRaw); } catch { /* ignore */ }
      }
      const times = [
        content?.prep_time ? `Prep: ${content.prep_time}` : null,
        content?.cook_time ? `Cook: ${content.cook_time}` : null,
        content?.total_time ? `Total: ${content.total_time}` : null,
      ].filter(Boolean).join(", ");
      const ingredients = ingredientsMap.get(id) ?? [];

      return `Recipe: ${name} (ID: ${id})${times ? ` [${times}]` : ""}
Ingredients:
${ingredients.map(ing => ing.raw_text || `${ing.quantity ? ing.quantity + ' ' : ''}${ing.unit ? ing.unit + ' ' : ''}${ing.name}`).join('\n') || 'No ingredients listed'}
Instructions:
${instructions.map((step: string, i: number) => `${i + 1}. ${step}`).join("\n") || "No instructions available"}`;
    }).join("\n\n---\n\n");

    const systemPrompt = mode === "side-by-side" ? SIDE_BY_SIDE_SYSTEM_PROMPT : INTERLEAVED_SYSTEM_PROMPT;
    const userMessage = mode === "side-by-side"
      ? `Rewrite the instructions for each recipe below to include ingredient amounts on first mention. Keep each recipe's steps in order — do not interleave.\n\n${recipeSummaries}`
      : `Create an interleaved cooking timeline for these recipes being prepared simultaneously:\n\n${recipeSummaries}\n\nInterleave the steps optimally so a cook can prepare all recipes at once. Start with anything that needs the longest time (preheating oven, boiling water). Group prep tasks during passive cooking time.`;

    const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": aiApiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      throw new Error(`AI API error: ${aiResponse.status} - ${errorText}`);
    }

    const aiResult = await aiResponse.json();
    const aiText = aiResult.content?.[0]?.text || "";

    let steps: CookModeStep[];
    try {
      const jsonMatch = aiText.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonText = jsonMatch ? jsonMatch[1].trim() : aiText.trim();
      steps = JSON.parse(jsonText);
      if (!Array.isArray(steps)) {
        throw new Error("Expected an array");
      }
    } catch {
      throw new Error(`Failed to parse AI response as JSON array: ${aiText.slice(0, 200)}`);
    }

    // Store in cache (non-fatal if it fails — caller still gets the steps)
    const { error: cacheError } = await supabase
      .from("cook_mode_timelines")
      .insert({
        event_id: eventId,
        recipe_ids_hash: recipeIdsHash,
        steps,
        model,
      });
    if (cacheError) {
      console.error("Failed to cache cook timeline:", cacheError.message);
    }

    return new Response(
      JSON.stringify({ success: true, steps }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("generate-cook-timeline error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
