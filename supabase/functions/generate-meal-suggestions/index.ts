import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SuggestionRequest {
  userId: string;
  preferences: {
    dietaryRestrictions: string[];
    cuisinePreferences: string[];
    dislikedIngredients: string[];
    householdSize: number;
    cookingSkill: string;
    maxCookTimeMinutes: number;
  };
  currentPlanItems: Array<{
    dayOfWeek: number;
    mealType: string;
    name: string;
  }>;
  chatMessage?: string;
}

interface Suggestion {
  id: string;
  name: string;
  cuisine: string;
  timeEstimate: string;
  reason: string;
  url?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicApiKey) {
      throw new Error("ANTHROPIC_API_KEY not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: SuggestionRequest = await req.json();
    const { userId, preferences, currentPlanItems, chatMessage } = body;

    if (!userId) {
      throw new Error("userId is required");
    }

    // Get user's past recipes for context
    const { data: pastRecipes } = await supabase
      .from("recipes")
      .select("name, url")
      .eq("created_by", userId)
      .limit(20);

    const { data: ratings } = await supabase
      .from("recipe_ratings")
      .select("overall_rating, recipes (name)")
      .eq("user_id", userId)
      .order("overall_rating", { ascending: false })
      .limit(10);

    const topRated = (ratings || [])
      .filter((r) => r.recipes)
      .map((r) => `${(r.recipes as { name: string }).name} (${r.overall_rating}/5)`);

    const pastRecipeNames = (pastRecipes || []).map((r) => r.name);

    const currentMeals = currentPlanItems
      .map((item) => `${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][item.dayOfWeek]} ${item.mealType}: ${item.name}`)
      .join("\n");

    const systemPrompt = `You are a meal planning assistant for a home cook. Generate recipe suggestions based on their preferences and history.

User preferences:
- Dietary restrictions: ${preferences.dietaryRestrictions.length > 0 ? preferences.dietaryRestrictions.join(", ") : "None"}
- Cuisine preferences: ${preferences.cuisinePreferences.length > 0 ? preferences.cuisinePreferences.join(", ") : "Open to all"}
- Disliked ingredients: ${preferences.dislikedIngredients.length > 0 ? preferences.dislikedIngredients.join(", ") : "None"}
- Household size: ${preferences.householdSize}
- Cooking skill: ${preferences.cookingSkill}
- Max cook time: ${preferences.maxCookTimeMinutes} minutes

Past recipes they've made: ${pastRecipeNames.length > 0 ? pastRecipeNames.join(", ") : "None yet"}
Top rated recipes: ${topRated.length > 0 ? topRated.join(", ") : "None yet"}

Current meal plan:
${currentMeals || "Empty - no meals planned yet"}

Respond with a JSON object containing:
1. "suggestions": an array of 3-5 recipe suggestions, each with: name, cuisine, timeEstimate (e.g. "30 min"), reason (brief explanation why this fits)
2. "chatResponse": a friendly message to the user about your suggestions

Only respond with valid JSON, no markdown or code blocks.`;

    const userMessage = chatMessage || "Suggest some meals for my weekly plan.";

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicApiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5-20250514",
        max_tokens: 1024,
        messages: [
          { role: "user", content: `${systemPrompt}\n\nUser message: ${userMessage}` },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Anthropic API error:", errorText);
      throw new Error("Failed to generate suggestions");
    }

    const aiResponse = await response.json();
    const content = aiResponse.content?.[0]?.text || "{}";

    let parsed: { suggestions: Suggestion[]; chatResponse: string };
    try {
      parsed = JSON.parse(content);
    } catch {
      // If AI didn't return valid JSON, create a fallback
      parsed = {
        suggestions: [],
        chatResponse: "I had trouble generating suggestions. Please try again.",
      };
    }

    // Add IDs to suggestions
    const suggestions = (parsed.suggestions || []).map((s: Suggestion, i: number) => ({
      ...s,
      id: `suggestion-${Date.now()}-${i}`,
    }));

    return new Response(
      JSON.stringify({
        success: true,
        suggestions,
        chatResponse: parsed.chatResponse || "Here are some suggestions for you!",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in generate-meal-suggestions:", error);
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
