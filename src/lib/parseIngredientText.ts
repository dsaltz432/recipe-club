import { supabase } from "@/integrations/supabase/client";
import type { ParsedGroceryItem } from "@/components/recipes/GroceryListSection";

function fallbackParse(text: string): ParsedGroceryItem[] {
  return text
    .split(/\n|,/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((name) => ({ name, quantity: null, unit: null, category: "other" }));
}

export async function parseIngredientText(
  text: string,
  userId: string
): Promise<ParsedGroceryItem[]> {
  if (!userId) throw new Error("Not authenticated");

  // Create a temporary recipe entry for parsing
  const { data: tempRecipe, error: recipeError } = await supabase
    .from("recipes")
    .insert({
      name: "General Items",
      created_by: userId,
      event_id: null,
      ingredient_id: null,
    })
    .select("id")
    .single();
  if (recipeError) throw recipeError;

  const { data, error } = await supabase.functions.invoke("parse-recipe", {
    body: { recipeId: tempRecipe.id, recipeName: "General Items", text },
  });

  // Clean up temp recipe
  supabase
    .from("recipes")
    .delete()
    .eq("id", tempRecipe.id)
    .then(() => {});

  // If AI parsing fails or returns nothing, fall back to treating each line as a
  // raw ingredient name so the user's input is never silently dropped.
  if (error || !data?.success || data.skipped) return fallbackParse(text);
  const parsed = (data.parsed?.ingredients ?? []) as ParsedGroceryItem[];
  return parsed.length > 0 ? parsed : fallbackParse(text);
}
