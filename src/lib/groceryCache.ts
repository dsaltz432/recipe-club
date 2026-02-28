import type { SmartGroceryItem } from "@/types";
import type { Json } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";

export type GroceryCacheContextType = "event" | "meal_plan";

export interface GroceryCacheResult {
  items: SmartGroceryItem[];
  recipeIds: string[];
  perRecipeItems?: Record<string, SmartGroceryItem[]>;
}

export async function loadGroceryCache(
  contextType: GroceryCacheContextType,
  contextId: string,
  userId: string
): Promise<GroceryCacheResult | null> {
  try {
    const { data, error } = await supabase
      .from("combined_grocery_items")
      .select("*")
      .eq("context_type", contextType)
      .eq("context_id", contextId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    // per_recipe_items column added by migration; access via cast
    const row = data as unknown as Record<string, unknown>;
    return {
      items: row.items as SmartGroceryItem[],
      recipeIds: row.recipe_ids as string[],
      perRecipeItems: (row.per_recipe_items as Record<string, SmartGroceryItem[]>) ?? undefined,
    };
  } catch (error) {
    console.error("Error loading grocery cache:", error);
    return null;
  }
}

export async function saveGroceryCache(
  contextType: GroceryCacheContextType,
  contextId: string,
  userId: string,
  items: SmartGroceryItem[],
  recipeIds: string[],
  perRecipeItems?: Record<string, SmartGroceryItem[]>
): Promise<void> {
  try {
    const sortedIds = [...recipeIds].sort();
    // per_recipe_items column added by migration; cast to satisfy generated types
    const upsertPayload = {
      context_type: contextType,
      context_id: contextId,
      user_id: userId,
      items: items as unknown as Json,
      recipe_ids: sortedIds,
      per_recipe_items: (perRecipeItems || {}) as unknown as Json,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase
      .from("combined_grocery_items")
      .upsert(
        upsertPayload as typeof upsertPayload & { context_type: string },
        { onConflict: "context_type,context_id,user_id" }
      );

    if (error) throw error;
  } catch (error) {
    console.error("Error saving grocery cache:", error);
  }
}

export async function deleteGroceryCache(
  contextType: GroceryCacheContextType,
  contextId: string,
  userId: string
): Promise<void> {
  try {
    const { error } = await supabase
      .from("combined_grocery_items")
      .delete()
      .eq("context_type", contextType)
      .eq("context_id", contextId)
      .eq("user_id", userId);

    if (error) throw error;
  } catch (error) {
    console.error("Error deleting grocery cache:", error);
  }
}

export async function loadCheckedItems(
  contextType: GroceryCacheContextType,
  contextId: string,
  userId: string
): Promise<Set<string>> {
  try {
    const { data, error } = await supabase
      .from("combined_grocery_items")
      .select("checked_items")
      .eq("context_type", contextType)
      .eq("context_id", contextId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return new Set();

    const row = data as unknown as Record<string, unknown>;
    const checkedItems = row.checked_items as string[] | null;
    return new Set(checkedItems ?? []);
  } catch (error) {
    console.error("Error loading checked items:", error);
    return new Set();
  }
}

export async function saveCheckedItems(
  contextType: GroceryCacheContextType,
  contextId: string,
  userId: string,
  checkedItems: Set<string>
): Promise<void> {
  try {
    // checked_items column added by migration; cast to bypass generated types
    const { error } = await supabase
      .from("combined_grocery_items")
      .update({
        checked_items: Array.from(checkedItems) as unknown as Json,
      } as Record<string, Json>)
      .eq("context_type", contextType)
      .eq("context_id", contextId)
      .eq("user_id", userId);

    if (error) throw error;
  } catch (error) {
    console.error("Error saving checked items:", error);
  }
}
