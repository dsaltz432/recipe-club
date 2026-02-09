import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RecipeInput {
  name: string;
  instructions: string[];
  prepTime?: string;
  cookTime?: string;
  servings?: string;
  ingredients: string[];
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

    const { recipes }: { recipes: RecipeInput[] } = await req.json();

    if (!recipes || recipes.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "No recipes provided" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const systemPrompt = `You are a kitchen planning assistant. Given multiple recipes, create a combined cooking timeline that maximizes parallelism using 4 stove burners and 1 oven. Return ONLY valid JSON with no markdown formatting.

Rules:
- Identify steps that can be done in parallel across recipes
- Assign equipment: "burner 1", "burner 2", "burner 3", "burner 4", "oven", or "prep" (no equipment needed)
- Create a chronological timeline with timestamps starting from 0:00
- Group prep work at the beginning when possible
- Account for passive time (e.g. things baking in oven while you prep other items)

Return JSON:
{
  "totalTime": "estimated total time (e.g. '1 hour 30 minutes')",
  "steps": [
    {
      "time": "0:00",
      "action": "What to do",
      "recipe": "Which recipe this is for",
      "equipment": "burner 1, burner 2, oven, or prep",
      "duration": "15 minutes"
    }
  ],
  "tips": ["General tip 1", "General tip 2"]
}`;

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
            content: `Create a combined cooking plan for these recipes:\n${JSON.stringify(recipes, null, 2)}`,
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

    let plan;
    try {
      const jsonMatch = aiText.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, aiText];
      plan = JSON.parse(jsonMatch[1].trim());
    } catch {
      throw new Error(`Failed to parse AI response as JSON: ${aiText.slice(0, 200)}`);
    }

    return new Response(
      JSON.stringify({ success: true, plan }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in generate-cook-plan:", error);
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
