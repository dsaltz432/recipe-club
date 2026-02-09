import type { SmartGroceryItem } from "@/types";
import type { Json } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";

export interface GroceryCacheResult {
  items: SmartGroceryItem[];
  recipeIds: string[];
}

export async function loadGroceryCache(
  eventId: string
): Promise<GroceryCacheResult | null> {
  try {
    const { data, error } = await supabase
      .from("event_grocery_cache")
      .select("items, recipe_ids")
      .eq("event_id", eventId)
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
  eventId: string,
  items: SmartGroceryItem[],
  recipeIds: string[]
): Promise<void> {
  try {
    const sortedIds = [...recipeIds].sort();
    const { error } = await supabase
      .from("event_grocery_cache")
      .upsert(
        {
          event_id: eventId,
          items: items as unknown as Json,
          recipe_ids: sortedIds,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "event_id" }
      );

    if (error) throw error;
  } catch (error) {
    console.error("Error saving grocery cache:", error);
  }
}

export async function deleteGroceryCache(eventId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from("event_grocery_cache")
      .delete()
      .eq("event_id", eventId);

    if (error) throw error;
  } catch (error) {
    console.error("Error deleting grocery cache:", error);
  }
}
