import { supabase } from "@/integrations/supabase/client";

const DEFAULT_PANTRY_ITEMS = ["salt", "pepper", "water"];

export async function getPantryItems(userId: string): Promise<{ id: string; name: string }[]> {
  const { data, error } = await supabase
    .from("user_pantry_items")
    .select("id, name")
    .eq("user_id", userId)
    .order("name");

  if (error) throw error;
  return data || [];
}

export async function addPantryItem(userId: string, name: string): Promise<void> {
  const { error } = await supabase
    .from("user_pantry_items")
    .insert({ user_id: userId, name: name.toLowerCase().trim() });

  if (error) throw error;
}

export async function removePantryItem(userId: string, itemId: string): Promise<void> {
  const { error } = await supabase
    .from("user_pantry_items")
    .delete()
    .eq("id", itemId)
    .eq("user_id", userId);

  if (error) throw error;
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
}
