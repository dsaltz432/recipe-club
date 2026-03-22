import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { CookModeStep, RecipeIngredient } from "@/types";
import { getCachedAiModel } from "@/lib/userPreferences";


interface CookModeRecipe {
  id: string;
  name: string;
  instructions?: string[];
}

interface UseCookModeOptions {
  eventId?: string;
  recipes: CookModeRecipe[];
  /** Extra ingredients (e.g. from useGroceryList) merged into ingredientsByRecipe. */
  allRecipeIngredients?: RecipeIngredient[];
}

export function useCookMode({ eventId, recipes, allRecipeIngredients }: UseCookModeOptions) {
  const [timeline, setTimeline] = useState<CookModeStep[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ingredientsByRecipe, setIngredientsByRecipe] = useState<Map<string, RecipeIngredient[]>>(new Map());

  const generateTimeline = useCallback(async () => {
    if (recipes.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch ingredients for recipes-with-instructions
      const { data: ingredientsData } = await supabase
        .from("recipe_ingredients")
        .select("*")
        .in("recipe_id", recipes.map(r => r.id));

      const newIngredientsByRecipe = new Map<string, RecipeIngredient[]>();
      (ingredientsData ?? []).forEach((row) => {
        const ing: RecipeIngredient = {
          id: row.id,
          recipeId: row.recipe_id,
          name: row.name,
          quantity: row.quantity ?? undefined,
          unit: row.unit ?? undefined,
          category: row.category as RecipeIngredient["category"],
          rawText: row.raw_text ?? undefined,
          sortOrder: row.sort_order ?? undefined,
          createdAt: row.created_at ?? undefined,
        };
        if (!newIngredientsByRecipe.has(row.recipe_id)) newIngredientsByRecipe.set(row.recipe_id, []);
        newIngredientsByRecipe.get(row.recipe_id)!.push(ing);
      });

      // Merge in any extra ingredients (e.g. from grocery list for all event recipes)
      (allRecipeIngredients ?? []).forEach((ing) => {
        if (!newIngredientsByRecipe.has(ing.recipeId)) newIngredientsByRecipe.set(ing.recipeId, []);
        if (!newIngredientsByRecipe.get(ing.recipeId)!.some((e) => e.id === ing.id)) {
          newIngredientsByRecipe.get(ing.recipeId)!.push(ing);
        }
      });

      setIngredientsByRecipe(newIngredientsByRecipe);

      if (recipes.length === 1) {
        // Single recipe: map instructions directly without calling edge function
        const recipe = recipes[0];
        const steps: CookModeStep[] = (recipe.instructions ?? []).map((instruction) => ({
          recipeId: recipe.id,
          recipeName: recipe.name,
          instruction,
        }));
        setTimeline(steps);
      } else {
        // Multiple recipes: check DB cache first
        const recipeIds = recipes.map((r) => r.id);
        const hash = [...recipeIds].sort().join(",");

        if (eventId) {
          const { data: cached } = await supabase
            .from("cook_mode_timelines")
            .select("steps")
            .eq("event_id", eventId)
            .eq("recipe_ids_hash", hash)
            .maybeSingle();

          if (cached?.steps) {
            setTimeline(cached.steps as unknown as CookModeStep[]);
            setLoading(false);
            return;
          }
        }

        // Cache miss — call edge function
        const model = getCachedAiModel();
        const { data, error: fnError } = await supabase.functions.invoke(
          "generate-cook-timeline",
          { body: { eventId, recipeIds, model } }
        );

        if (fnError) throw fnError;
        if (!data?.success) throw new Error(data?.error ?? "Failed to generate timeline");

        setTimeline(data.steps as CookModeStep[]);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to generate cooking timeline"
      );
    } finally {
      setLoading(false);
    }
  }, [eventId, recipes, allRecipeIngredients]);

  return { timeline, loading, error, generateTimeline, ingredientsByRecipe };
}
