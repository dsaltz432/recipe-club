import type { GeneralGroceryItem } from "@/types";
import { supabase } from "@/integrations/supabase/client";

export interface RawIngredientInput {
  name: string;
  quantity: string | null;
  unit: string | null;
  category: string;
  recipeName: string;
}

// general_grocery_items table added by migration; not yet in generated Supabase types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export async function loadGeneralItems(
  contextType: string,
  contextId: string,
  userId: string
): Promise<GeneralGroceryItem[]> {
  try {
    const { data, error } = await db
      .from("general_grocery_items")
      .select("*")
      .eq("user_id", userId)
      .eq("context_type", contextType)
      .eq("context_id", contextId)
      .order("created_at", { ascending: true });

    if (error) throw error;
    if (!data) return [];

    return (data as Record<string, unknown>[]).map((row) => ({
      id: row.id as string,
      userId: row.user_id as string,
      contextType: row.context_type as string,
      contextId: row.context_id as string,
      name: row.name as string,
      quantity: (row.quantity as string) ?? undefined,
      unit: (row.unit as string) ?? undefined,
      createdAt: (row.created_at as string) ?? undefined,
    }));
  } catch (error) {
    console.error("Error loading general grocery items:", error);
    return [];
  }
}

export async function addGeneralItem(
  contextType: string,
  contextId: string,
  userId: string,
  item: { name: string; quantity?: string; unit?: string }
): Promise<void> {
  try {
    const { error } = await db
      .from("general_grocery_items")
      .insert({
        user_id: userId,
        context_type: contextType,
        context_id: contextId,
        name: item.name,
        quantity: item.quantity ?? null,
        unit: item.unit ?? null,
      });

    if (error) throw error;
  } catch (error) {
    console.error("Error adding general grocery item:", error);
  }
}

export async function removeGeneralItem(itemId: string): Promise<void> {
  try {
    const { error } = await db
      .from("general_grocery_items")
      .delete()
      .eq("id", itemId);

    if (error) throw error;
  } catch (error) {
    console.error("Error removing general grocery item:", error);
  }
}

export async function updateGeneralItem(
  itemId: string,
  updates: { name?: string; quantity?: string; unit?: string }
): Promise<void> {
  try {
    const payload: Record<string, string | null> = {};
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.quantity !== undefined) payload.quantity = updates.quantity;
    if (updates.unit !== undefined) payload.unit = updates.unit;

    const { error } = await db
      .from("general_grocery_items")
      .update(payload)
      .eq("id", itemId);

    if (error) throw error;
  } catch (error) {
    console.error("Error updating general grocery item:", error);
  }
}

export function toRawIngredients(
  items: GeneralGroceryItem[]
): RawIngredientInput[] {
  return items.map((item) => ({
    name: item.name,
    quantity: item.quantity ?? null,
    unit: item.unit ?? null,
    category: "other",
    recipeName: "General",
  }));
}
