import { supabase } from "@/integrations/supabase/client";
import { getCachedAiModel } from "@/lib/userPreferences";
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

  const { data, error } = await supabase.functions.invoke("parse-recipe", {
    body: { recipeName: "General Items", text, model: getCachedAiModel() },
  });

  // If AI parsing fails or returns nothing, fall back to treating each line as a
  // raw ingredient name so the user's input is never silently dropped.
  if (error || !data?.success || data.skipped) return fallbackParse(text);
  const parsed = (data.parsed?.ingredients ?? []) as ParsedGroceryItem[];
  return parsed.length > 0 ? parsed : fallbackParse(text);
}
