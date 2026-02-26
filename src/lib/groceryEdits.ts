import type { SmartGroceryItem, GroceryCategory } from "@/types";
import type { Json } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";

export interface GroceryEditItem extends SmartGroceryItem {
  custom?: boolean;
}

export interface CombinedGroceryResult {
  items: GroceryEditItem[];
  recipeIds: string[];
}

export async function loadCombinedGroceryItems(
  contextType: string,
  contextId: string,
  userId: string
): Promise<CombinedGroceryResult | null> {
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
      items: data.items as unknown as GroceryEditItem[],
      recipeIds: data.recipe_ids,
    };
  } catch (error) {
    console.error("Error loading combined grocery items:", error);
    return null;
  }
}

export async function saveCombinedGroceryItems(
  contextType: string,
  contextId: string,
  userId: string,
  items: GroceryEditItem[],
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
    console.error("Error saving combined grocery items:", error);
  }
}

export async function updateGroceryItem(
  contextType: string,
  contextId: string,
  userId: string,
  originalName: string,
  edits: { name?: string; totalQuantity?: number; unit?: string }
): Promise<GroceryEditItem[] | null> {
  try {
    const result = await loadCombinedGroceryItems(contextType, contextId, userId);
    if (!result) return null;

    const items = result.items.map((item) => {
      if (item.name === originalName) {
        return {
          ...item,
          ...(edits.name !== undefined && { name: edits.name }),
          ...(edits.totalQuantity !== undefined && { totalQuantity: edits.totalQuantity }),
          ...(edits.unit !== undefined && { unit: edits.unit }),
        };
      }
      return item;
    });

    await saveCombinedGroceryItems(contextType, contextId, userId, items, result.recipeIds);
    return items;
  } catch (error) {
    console.error("Error updating grocery item:", error);
    return null;
  }
}

export async function addCustomGroceryItem(
  contextType: string,
  contextId: string,
  userId: string,
  item: { name: string; totalQuantity?: number; unit?: string; category?: GroceryCategory }
): Promise<GroceryEditItem[] | null> {
  try {
    const result = await loadCombinedGroceryItems(contextType, contextId, userId);
    const currentItems = result?.items ?? [];
    const recipeIds = result?.recipeIds ?? [];

    const newItem: GroceryEditItem = {
      name: item.name,
      displayName: item.name,
      totalQuantity: item.totalQuantity,
      unit: item.unit,
      category: item.category ?? "other",
      sourceRecipes: ["Custom"],
      custom: true,
    };

    const items = [...currentItems, newItem];
    await saveCombinedGroceryItems(contextType, contextId, userId, items, recipeIds);
    return items;
  } catch (error) {
    console.error("Error adding custom grocery item:", error);
    return null;
  }
}

export async function removeGroceryItem(
  contextType: string,
  contextId: string,
  userId: string,
  itemName: string
): Promise<GroceryEditItem[] | null> {
  try {
    const result = await loadCombinedGroceryItems(contextType, contextId, userId);
    if (!result) return null;

    const items = result.items.filter((item) => item.name !== itemName);
    await saveCombinedGroceryItems(contextType, contextId, userId, items, result.recipeIds);
    return items;
  } catch (error) {
    console.error("Error removing grocery item:", error);
    return null;
  }
}
