import type { SmartGroceryItem } from "@/types";
import type { Json } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";

export type GroceryCacheContextType = "event" | "meal_plan";

export interface GroceryCacheResult {
  items: SmartGroceryItem[];
  recipeIds: string[];
}

export async function loadGroceryCache(
  contextType: GroceryCacheContextType,
  contextId: string,
  userId: string
): Promise<GroceryCacheResult | null> {
  try {
    const { data, error } = await supabase
      .from("combined_grocery_items")
      .select("items, recipe_ids")
      .eq("context_type", contextType)
      .eq("context_id", contextId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return {
      items: data.items as unknown as SmartGroceryItem[],
      recipeIds: data.recipe_ids,
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
  recipeIds: string[]
): Promise<void> {
  try {
    const sortedIds = [...recipeIds].sort();
    const { error } = await supabase
      .from("combined_grocery_items")
      .upsert(
        {
          context_type: contextType,
          context_id: contextId,
          user_id: userId,
          items: items as unknown as Json,
          recipe_ids: sortedIds,
          updated_at: new Date().toISOString(),
        },
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
