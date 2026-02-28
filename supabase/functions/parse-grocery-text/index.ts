import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ParsedGroceryItem {
  name: string;
  quantity: number | null;
  unit: string | null;
  category: string;
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

    const { text }: { text: string } = await req.json();

    if (!text || text.trim().length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "Text is required and cannot be empty" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    const systemPrompt = `You are a grocery list parser. You receive freeform text containing grocery items and parse them into structured data.

The text may be in any format: comma-separated, line-separated, numbered list, natural language, messy notes, or a mix of formats.

For each item, extract:
- name: Clean product name (lowercase, no quantities or units in the name)
- quantity: Numeric quantity as a number, or null if not specified
- unit: Unit of measurement as a string, or null if not specified
- category: One of these exact values: produce, meat_seafood, dairy, pantry, spices, frozen, bakery, beverages, condiments, other

Category assignment guidelines:
- produce: fruits, vegetables, fresh herbs (lettuce, tomatoes, apples, bananas, cilantro, basil, lemons, limes, avocados, potatoes, onions, garlic, ginger)
- meat_seafood: meat, poultry, fish, shellfish, tofu, tempeh, seitan
- dairy: milk, cheese, yogurt, cream, sour cream, cream cheese, eggs
- pantry: oils, flour, sugar, rice, pasta, canned goods, beans, lentils, nuts, broth/stock, soy sauce, vinegar, honey, peanut butter, bread crumbs, cornstarch, baking powder, baking soda, vanilla extract, chicken stock, tomato paste, coconut milk
- spices: dried spices and seasonings (cumin, paprika, oregano, cinnamon, salt, pepper, garlic powder, chili flakes, bay leaves, turmeric)
- frozen: frozen foods (frozen vegetables, frozen fruit, ice cream, frozen pizza)
- bakery: bread, rolls, tortillas, bagels, muffins, croissants, pita
- beverages: drinks (juice, coffee, tea, soda, water, wine, beer)
- condiments: ketchup, mustard, mayo, hot sauce, salad dressing, BBQ sauce, sriracha, ranch
- other: non-food items, paper goods, cleaning supplies, toiletries, or anything that doesn't fit above categories (paper towels, dish soap, trash bags, aluminum foil, plastic wrap)

Return ONLY a valid JSON array (no markdown formatting):
[
  { "name": "olive oil", "quantity": 1, "unit": "bottle", "category": "pantry" },
  { "name": "chicken breast", "quantity": 2, "unit": "lb", "category": "meat_seafood" },
  { "name": "paper towels", "quantity": null, "unit": null, "category": "other" }
]

quantity must be a number or null. unit must be a string or null.`;

    const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": aiApiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4096,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: `Parse this grocery list text into individual items:\n\n${text.trim()}`,
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

    let parsed: ParsedGroceryItem[];
    try {
      const jsonMatch = aiText.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, aiText];
      parsed = JSON.parse(jsonMatch[1].trim());
    } catch {
      throw new Error(`Failed to parse AI response as JSON: ${aiText.slice(0, 200)}`);
    }

    if (!Array.isArray(parsed)) {
      throw new Error(`AI response is not an array: ${JSON.stringify(parsed).slice(0, 200)}`);
    }

    const validCategories = new Set([
      "produce", "meat_seafood", "dairy", "pantry", "spices",
      "frozen", "bakery", "beverages", "condiments", "other",
    ]);

    const items: ParsedGroceryItem[] = parsed.map((item) => ({
      name: String(item.name || "").trim(),
      quantity: typeof item.quantity === "number" ? item.quantity : null,
      unit: typeof item.unit === "string" ? item.unit : null,
      category: validCategories.has(item.category) ? item.category : "other",
    })).filter((item) => item.name.length > 0);

    return new Response(
      JSON.stringify({ success: true, items }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in parse-grocery-text:", error);
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
