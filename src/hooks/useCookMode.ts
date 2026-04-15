import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { CookModeStep, RecipeIngredient } from "@/types";
import { getCachedAiModel } from "@/lib/userPreferences";

export type CookViewMode = "interleaved" | "side-by-side";

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

  const generateTimeline = useCallback(async (mode: CookViewMode = "interleaved") => {
    if (recipes.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch ingredients for all recipes
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

      // All recipes go through the AI edge function — mode controls interleaved vs side-by-side
      const recipeIds = recipes.map((r) => r.id);
      const hash = [...recipeIds].sort().join(",") + `:v1:${mode}`;

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
        { body: { eventId, recipeIds, mode, model } }
      );

      if (fnError) throw fnError;
      if (!data?.success) throw new Error(data?.error ?? "Failed to generate timeline");

      setTimeline(data.steps as CookModeStep[]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to generate cooking timeline"
      );
    } finally {
      setLoading(false);
    }
  }, [eventId, recipes, allRecipeIngredients]);

  // Silent cache warmer — calls the edge function without touching UI state.
  // Used for background pre-generation so both modes are ready when Cook Mode opens.
  const prewarmTimeline = useCallback(async (mode: CookViewMode) => {
    if (recipes.length === 0) return;

    const recipeIds = recipes.map((r) => r.id);
    const hash = [...recipeIds].sort().join(",") + `:v1:${mode}`;

    if (eventId) {
      const { data: cached } = await supabase
        .from("cook_mode_timelines")
        .select("steps")
        .eq("event_id", eventId)
        .eq("recipe_ids_hash", hash)
        .maybeSingle();
      if (cached?.steps) return;
    }

    const model = getCachedAiModel();
    await supabase.functions.invoke("generate-cook-timeline", {
      body: { eventId, recipeIds, mode, model },
    });
  }, [eventId, recipes]);

  // Auto-pre-warm both modes when the recipe set changes (mirrors grocery list combining
  // logic). Debounced 2s so rapid add/remove only fires once. No UI state is touched —
  // when the user opens Cook Mode, generateTimeline hits the DB cache and returns instantly.
  const recipeIdsKey = useMemo(() => recipes.map(r => r.id).sort().join(","), [recipes]);
  const isInitialMount = useRef(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prewarmRef = useRef(prewarmTimeline);
  useEffect(() => { prewarmRef.current = prewarmTimeline; });

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (recipes.length === 0 || recipes.length >= 5) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      prewarmRef.current("interleaved");
      prewarmRef.current("side-by-side");
    }, 2000);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [recipeIdsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return { timeline, loading, error, generateTimeline, ingredientsByRecipe };
}
