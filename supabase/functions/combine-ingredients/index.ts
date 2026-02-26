import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RawIngredientInput {
  name: string;
  quantity: string | null;
  unit: string | null;
  category: string;
  recipeName: string;
}

interface SmartGroceryItem {
  name: string;
  displayName: string;
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

    const { rawIngredients }: { rawIngredients: RawIngredientInput[] } = await req.json();

    if (!rawIngredients || rawIngredients.length === 0) {
      return new Response(
        JSON.stringify({ success: true, items: [], perRecipeItems: {} }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = `You are a grocery list optimizer for a cooking club. You receive raw ingredients from multiple recipes. Each ingredient includes a recipeName field indicating which recipe it belongs to.

You must produce TWO outputs:
1. "items": All ingredients combined ACROSS all recipes into a single grocery list.
2. "perRecipeItems": Ingredients combined WITHIN each recipe, keyed by recipe name. A single recipe may have duplicate ingredients (e.g., "1 cup flour" for cake + "2 tbsp flour" for dusting) — combine these within the recipe.

## SEMANTIC MERGING:
Combine items that are the same real ingredient but appear separately.
- "broccoli floret" + "broccoli" → one "broccoli" entry
- "garlic clove" + "garlic" → one "garlic" entry
- "cold water" + "water" → one "water" entry

## KEEP SEPARATE: Items that are genuinely different products.
- "sesame oil" ≠ "vegetable oil" (different products)
- "rice vinegar" ≠ "white vinegar" (different products)
- "crushed tomatoes" ≠ "tomato" ≠ "tomato sauce" (different forms/products)
- "chicken breast" ≠ "chicken broth" (different products)
- "fresh ginger" ≠ "ground ginger" (different forms — keep separate)
- "dried oregano" ≠ "fresh oregano" (different products — keep "dried" prefix)
- "canola oil" ≠ "vegetable oil" (different products)
- "black peppercorn" ≠ "black pepper" (whole peppercorns ≠ ground pepper - keep separate)
- "cinnamon stick" ≠ "cinnamon" / "ground cinnamon" (different forms - keep separate)

## MUST-MERGE ingredient variants (same grocery item):
- ALL salt types → "salt": "kosher salt", "sea salt", "table salt", "flaky salt", "coarse salt"
- ALL onion colors → "onion": "yellow onion", "white onion", "sweet onion" (but NOT "red onion", "green onion", "shallot")
- ALL plain oil → "vegetable oil": "oil", "vegetable oil", "neutral oil" (but NOT "canola oil" — different product)
- ALL olive oil → "olive oil": "olive oil", "extra virgin olive oil", "extra-virgin olive oil", "EVOO"
- ALL butter → "butter": "butter", "unsalted butter", "salted butter"
- Cheese + "cheese" suffix → base name: "parmesan cheese" → "parmesan", "mozzarella cheese" → "mozzarella"
- Ground spice + spice → spice name: "ground turmeric" → "turmeric", "ground cumin" → "cumin", "ground cinnamon" → "cinnamon"
- ALL sugar types → "sugar": "sugar", "white sugar", "granulated sugar", "caster sugar" (but NOT "brown sugar", "powdered sugar", "confectioner's sugar")
- "green cardamom" + "cardamom" → "cardamom"
- "flat-leaf parsley" + "parsley" → "parsley"
- "cilantro" + "fresh cilantro" → "cilantro"
- "black pepper" + "ground black pepper" → "black pepper"
- "bay leaf" + "dried bay leaf" → "bay leaf"
- KEEP "dried" prefix for herbs: "dried oregano" stays "dried oregano", "dried basil" stays "dried basil", "dried dill" stays "dried dill" — dried herbs are DIFFERENT products from fresh herbs
- "green onion" + "scallion" + "spring onion" → "green onion"

## Unit conversion rules (MUST convert before summing):
- 1 tbsp = 3 tsp — CRITICAL: convert to same unit FIRST, then sum. Example: 0.5 tsp + 1 tbsp → convert 1 tbsp to 3 tsp → 0.5 + 3 = 3.5 tsp. Do NOT add 0.5 + 1 = 1.5!
- 1 cup = 16 tbsp = 48 tsp
- 1 lb = 16 oz
- When BOTH items have convertible units (tsp/tbsp, cup/tbsp, oz/lb), convert to the smaller unit, sum, then express in the larger unit if the result is clean (e.g. 6 tsp → 2 tbsp)
- When units are INCOMPATIBLE and cannot be converted (e.g. "clove" vs "tsp", "bunch" vs "cup", "piece" vs "tbsp"), keep BOTH entries as separate line items. NEVER drop an ingredient — it is better to have two entries for the same ingredient than to lose data.
- When one item has a unit and another has null unit, keep the unit and add the quantities.
- Contextual unit handling: keep "19oz" for cans (don't convert can sizes), but DO convert tsp/tbsp.

## Rules:
- NEVER drop ingredients. Every input ingredient MUST appear in your output, either merged with a duplicate or returned unchanged. It is better to have duplicate entries than to lose an ingredient.
- Preserve the most specific category assignment
- Combine sourceRecipes arrays (deduplicated) — derive sourceRecipes from the recipeName field on each input ingredient
- Return raw numeric quantities — do NOT format as fractions or strings
- Items where ALL inputs have null quantity: use null for totalQuantity
- Use clean base ingredient names (e.g. "broccoli" not "broccoli floret")
- Never use metric units (g, kg, ml) — convert to imperial (oz, lb, tsp, tbsp, cup)

## displayName generation:
For EVERY item in BOTH "items" and "perRecipeItems", generate a "displayName" — the human-friendly name to show on the grocery list. The displayName should be quantity-aware (pluralized correctly for that item's quantity context). Rules:
- Mass/uncountable nouns stay SINGULAR regardless of quantity: "flour", "sugar", "salt", "rice", "chicken", "broccoli", "celery", "garlic", "pasta", "cheese", "butter", "milk", "cream", "honey", "bacon", "spinach", "kale", etc.
- Countable nouns get pluralized when quantity > 1 or when there's a unit (e.g. "2 eggs" → "eggs", "1 cup blueberries" → "blueberries")
- Countable nouns stay singular when quantity is exactly 1 with no unit (e.g. "1 lemon" → "lemon")
- Items with NAME_FIRST units (stalk, clove, head, bunch, etc.) always use singular displayName (e.g. "celery" not "celeries")
- Naturally plural items stay plural: "tortilla chips", "breadcrumbs", "red pepper flakes", "oats"
- Use standard English pluralization: "tomato" → "tomatoes", "potato" → "potatoes", "leaf" → "leaves", "peach" → "peaches"

Return ONLY a valid JSON object (not an array!) with no markdown formatting:
{
  "items": [
    {
      "name": "clean ingredient name",
      "displayName": "correctly pluralized display name",
      "totalQuantity": 2.5,
      "unit": "cup",
      "category": "one of: produce, meat_seafood, dairy, pantry, spices, frozen, bakery, beverages, condiments, other",
      "sourceRecipes": ["Recipe Name 1", "Recipe Name 2"]
    }
  ],
  "perRecipeItems": {
    "Recipe Name 1": [
      {
        "name": "clean ingredient name",
        "displayName": "correctly pluralized display name",
        "totalQuantity": 1.5,
        "unit": "cup",
        "category": "produce",
        "sourceRecipes": ["Recipe Name 1"]
      }
    ],
    "Recipe Name 2": [...]
  }
}

totalQuantity must be a number or null. unit must be a string or null.`;

    const userContent = `Combine these raw ingredients from multiple recipes. Each ingredient has a recipeName field.\n\nProduce TWO outputs:\n1. "items" — all ingredients combined across all recipes into one grocery list\n2. "perRecipeItems" — ingredients combined within each recipe, keyed by recipe name\n\nRaw ingredients:\n${JSON.stringify(rawIngredients, null, 2)}`;

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
            content: userContent,
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

    let parsed: { items: SmartGroceryItem[]; perRecipeItems?: Record<string, SmartGroceryItem[]> };
    try {
      const jsonMatch = aiText.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, aiText];
      parsed = JSON.parse(jsonMatch[1].trim());
    } catch {
      throw new Error(`Failed to parse AI response as JSON: ${aiText.slice(0, 200)}`);
    }

    const items = parsed.items;
    const perRecipeItems = parsed.perRecipeItems || {};

    if (!Array.isArray(items)) {
      throw new Error(`AI response items is not an array: ${JSON.stringify(parsed).slice(0, 200)}`);
    }

    // Validate: AI must not drop ingredients. Compare unique ingredient names in vs out.
    // Use unique names (lowercased) since multiple recipes may have the same ingredient.
    // Allow semantic merges where one name contains the other (e.g. "broccoli floret" → "broccoli").
    const inputNames = new Set(rawIngredients.map((i) => i.name.toLowerCase()));
    const outputNames = new Set(items.map((i) => i.name.toLowerCase()));
    const droppedNames = [...inputNames].filter((inputName) => {
      if (outputNames.has(inputName)) return false;
      for (const outputName of outputNames) {
        if (outputName.includes(inputName) || inputName.includes(outputName)) return false;
      }
      return true;
    });
    if (droppedNames.length > 0) {
      console.warn(`AI dropped ingredients: ${droppedNames.join(", ")}. Falling back to skipped.`);
      return new Response(
        JSON.stringify({ success: true, skipped: true, message: `AI dropped ingredients: ${droppedNames.join(", ")}` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Ensure every item has a displayName (fallback to name if AI omitted it)
    for (const item of items) {
      if (!item.displayName) {
        item.displayName = item.name;
      }
    }
    for (const recipeItems of Object.values(perRecipeItems)) {
      for (const item of recipeItems) {
        if (!item.displayName) {
          item.displayName = item.name;
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, items, perRecipeItems }),
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
