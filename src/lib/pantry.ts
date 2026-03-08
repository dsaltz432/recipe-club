import { supabase } from "@/integrations/supabase/client";

export const DEFAULT_PANTRY_ITEMS = ["salt", "pepper", "water"];

// Module-level cache keyed by userId. Multiple components (useGroceryList,
// PantryContent, RecipeHub) call getPantryItems on the same page load — this
// prevents redundant DB round-trips. Invalidated on any mutation.
let pantryCache: { userId: string; items: { id: string; name: string }[] } | null = null;

export function invalidatePantryCache(): void {
  pantryCache = null;
}

export async function getPantryItems(userId: string): Promise<{ id: string; name: string }[]> {
  if (pantryCache?.userId === userId) return pantryCache.items;

  const { data, error } = await supabase
    .from("user_pantry_items")
    .select("id, name")
    .eq("user_id", userId)
    .order("name");

  if (error) throw error;
  const items = data || [];
  pantryCache = { userId, items };
  return items;
}

export async function addPantryItem(userId: string, name: string): Promise<void> {
  const { error } = await supabase
    .from("user_pantry_items")
    .insert({ user_id: userId, name: name.toLowerCase().trim() });

  if (error) throw error;
  invalidatePantryCache();
}

export async function removePantryItem(userId: string, itemId: string): Promise<void> {
  const { error } = await supabase
    .from("user_pantry_items")
    .delete()
    .eq("id", itemId)
    .eq("user_id", userId);

  if (error) throw error;
  invalidatePantryCache();
}

export async function ensureDefaultPantryItems(userId: string): Promise<void> {
  // Upsert default items — no-op if they already exist
  const { error } = await supabase
    .from("user_pantry_items")
    .upsert(
      DEFAULT_PANTRY_ITEMS.map((name) => ({
        user_id: userId,
        name,
      })),
      { onConflict: "user_id,name", ignoreDuplicates: true }
    );

  if (error) throw error;
  invalidatePantryCache();
}
