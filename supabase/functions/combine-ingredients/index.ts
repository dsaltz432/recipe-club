import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PreCombinedInput {
  name: string;
  quantity: string | null;
  unit: string | null;
  category: string;
  sourceRecipes: string[];
}

interface SmartGroceryItem {
  name: string;
  totalQuantity: number | null;
  unit: string | null;
  category: string;
  sourceRecipes: string[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const aiApiKey = Deno.env.get("ANTHROPIC_API_KEY");

    if (!aiApiKey) {
      return new Response(
        JSON.stringify({ success: true, skipped: true, message: "ANTHROPIC_API_KEY not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { preCombined }: { preCombined: PreCombinedInput[] } = await req.json();

    if (!preCombined || preCombined.length === 0) {
      return new Response(
        JSON.stringify({ success: true, items: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = `You are a grocery list optimizer for a cooking club. You receive pre-combined ingredients (quantities already summed by unit). Your ONLY job is semantic merging — combining items that are the same real ingredient but appear as separate entries.

Your tasks:
1. SEMANTIC MERGING: Combine items that are the same real ingredient but appear separately.
   - "broccoli floret" + "broccoli" → one "broccoli" entry (sum quantities if compatible units)
   - "garlic clove" + "garlic" → one "garlic" entry
   - "cold water" + "water" → one "water" entry
2. KEEP SEPARATE: Items that are genuinely different products.
   - "sesame oil" ≠ "vegetable oil" (different products)
   - "rice vinegar" ≠ "white vinegar" (different products)
   - "crushed tomatoes" ≠ "tomato" ≠ "tomato sauce" (different products)
3. If no merges are needed, return items unchanged.

Rules:
- Preserve the most specific category assignment
- Combine sourceRecipes arrays (deduplicated)
- Return raw numeric quantities — do NOT format as fractions or strings
- When merging items with the same unit, sum the quantities
- When merging items with incompatible units, keep the larger quantity's unit and set the other to null
- Items without any quantity: use null for totalQuantity
- Use clean base ingredient names (e.g. "broccoli" not "broccoli floret")
- Never use metric units (g, kg, ml) — convert to imperial (oz, lb, tsp, tbsp, cup)

Return ONLY a valid JSON array with no markdown formatting:
[
  {
    "name": "clean ingredient name",
    "totalQuantity": 2.5,
    "unit": "cup",
    "category": "one of: produce, meat_seafood, dairy, pantry, spices, frozen, bakery, beverages, condiments, other",
    "sourceRecipes": ["Recipe Name 1", "Recipe Name 2"]
  }
]

totalQuantity must be a number or null. unit must be a string or null.`;

    const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": aiApiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 8192,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: `Review these pre-combined ingredients and merge any semantic duplicates. Do NOT change quantities unless merging:\n${JSON.stringify(preCombined, null, 2)}`,
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

    let items: SmartGroceryItem[];
    try {
      const jsonMatch = aiText.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, aiText];
      items = JSON.parse(jsonMatch[1].trim());
    } catch {
      throw new Error(`Failed to parse AI response as JSON: ${aiText.slice(0, 200)}`);
    }

    return new Response(
      JSON.stringify({ success: true, items }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in combine-ingredients:", error);
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
