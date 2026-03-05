import { supabase } from "@/integrations/supabase/client";
import type { ParsedGroceryItem } from "@/components/recipes/GroceryListSection";

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

  if (error) throw error;
  if (!data?.success)
    throw new Error(data?.error ?? "Failed to parse grocery text");
  if (data.skipped) return [];
  return (data.parsed?.ingredients ?? []) as ParsedGroceryItem[];
}
