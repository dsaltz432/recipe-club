import { useState, useEffect, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { RecipeIngredient, SmartGroceryItem, GroceryCategory } from "@/types";
import { CATEGORY_ORDER } from "@/lib/groceryList";
import { deleteGroceryCache } from "@/lib/groceryCache";
import { parseIngredientText } from "@/lib/parseIngredientText";
import GroceryCategoryGroup from "@/components/recipes/GroceryCategoryGroup";
import AddIngredientInput from "@/components/recipes/AddIngredientInput";

interface RecipeIngredientListProps {
  recipeId: string;
  userId: string;
  editable?: boolean;
  onIngredientsChange?: () => void;
  cacheContext?: { type: "event" | "meal_plan"; id: string; userId: string };
}

function toSmartItem(ing: RecipeIngredient): SmartGroceryItem {
  return {
    name: ing.name,
    displayName: ing.name,
    totalQuantity: ing.quantity ?? undefined,
    unit: ing.unit ?? undefined,
    category: ing.category,
    sourceRecipes: [],
  };
}

function groupByCategory(
  ingredients: RecipeIngredient[]
): Map<GroceryCategory, RecipeIngredient[]> {
  const map = new Map<GroceryCategory, RecipeIngredient[]>();
  for (const category of CATEGORY_ORDER) {
    const items = ingredients.filter((ing) => ing.category === category);
    if (items.length > 0) {
      map.set(category, items);
    }
  }
  return map;
}

const RecipeIngredientList = ({
  recipeId,
  userId,
  editable,
  onIngredientsChange,
  cacheContext,
}: RecipeIngredientListProps) => {
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([]);
  const [loading, setLoading] = useState(true);

  const loadIngredients = useCallback(async () => {
    const { data, error } = await supabase
      .from("recipe_ingredients")
      .select("*")
      .eq("recipe_id", recipeId)
      .order("sort_order");
    if (!error && data) {
      setIngredients(
        data.map((row) => ({
          id: row.id,
          recipeId: row.recipe_id,
          name: row.name,
          quantity: row.quantity ?? undefined,
          unit: row.unit ?? undefined,
          category: (row.category as GroceryCategory) ?? "other",
          sortOrder: row.sort_order ?? undefined,
        }))
      );
    }
  }, [recipeId]);

  useEffect(() => {
    setLoading(true);
    loadIngredients().finally(() => setLoading(false));
  }, [loadIngredients]);

  const handleEditItemText = useCallback(
    async (originalName: string, newText: string) => {
      const matched = ingredients.find(
        (ing) => ing.name.toLowerCase() === originalName.toLowerCase()
      );
      if (!matched) return;
      await supabase
        .from("recipe_ingredients")
        .update({ name: newText })
        .eq("id", matched.id);
      await loadIngredients();
      onIngredientsChange?.();
    },
    [ingredients, loadIngredients, onIngredientsChange]
  );

  const handleRemoveItem = useCallback(
    async (itemName: string) => {
      const matched = ingredients.find(
        (ing) => ing.name.toLowerCase() === itemName.toLowerCase()
      );
      if (!matched) return;
      await supabase
        .from("recipe_ingredients")
        .delete()
        .eq("id", matched.id);
      await loadIngredients();
      onIngredientsChange?.();
    },
    [ingredients, loadIngredients, onIngredientsChange]
  );

  const handleAdd = useCallback(
    async (text: string) => {
      const parsed = await parseIngredientText(text, userId);
      if (parsed.length > 0) {
        await supabase.from("recipe_ingredients").insert(
          parsed.map((item, index) => ({
            recipe_id: recipeId,
            name: item.name,
            quantity: item.quantity ?? null,
            unit: item.unit ?? null,
            category: item.category,
            sort_order: ingredients.length + index,
          }))
        );
      }
      await loadIngredients();
      if (cacheContext) {
        await deleteGroceryCache(cacheContext.type, cacheContext.id, cacheContext.userId);
      }
      onIngredientsChange?.();
    },
    [recipeId, userId, ingredients.length, loadIngredients, cacheContext, onIngredientsChange]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const grouped = groupByCategory(ingredients);

  return (
    <div>
      {ingredients.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">No ingredients yet</p>
      ) : (
        Array.from(grouped.entries()).map(([category, items]) => (
          <GroceryCategoryGroup
            key={category}
            category={category}
            items={items.map(toSmartItem)}
            editable={editable}
            onEditItemText={editable ? handleEditItemText : undefined}
            onRemoveItem={editable ? handleRemoveItem : undefined}
          />
        ))
      )}
      {editable && (
        <AddIngredientInput
          onSubmit={handleAdd}
          className="mt-3 border-t pt-3"
        />
      )}
    </div>
  );
};

export default RecipeIngredientList;
