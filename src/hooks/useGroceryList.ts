import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { smartCombineIngredients } from "@/lib/groceryList";
import {
  loadGroceryCache,
  saveGroceryCache,
  deleteGroceryCache,
  loadCheckedItems,
  saveCheckedItems,
} from "@/lib/groceryCache";
import {
  loadGeneralItems,
  addGeneralItem,
  removeGeneralItem,
  updateGeneralItem,
  toRawIngredients,
} from "@/lib/generalGrocery";
import { getPantryItems, ensureDefaultPantryItems } from "@/lib/pantry";
import { RECOMBINE_DELAY_MS } from "@/lib/constants";
import { parseIngredientText } from "@/lib/parseIngredientText";
import type {
  Recipe,
  RecipeIngredient,
  RecipeContent,
  SmartGroceryItem,
  GeneralGroceryItem,
} from "@/types";
import type { ParsedGroceryItem } from "@/components/recipes/GroceryListSection";

export interface UseGroceryListOptions {
  contextType: "event" | "meal_plan";
  contextId: string | undefined;
  userId: string | undefined;
  recipeIds: string[];
  recipes: Recipe[];
  enabled?: boolean;
  supportsGeneralItems?: boolean;
}

export interface UseGroceryListReturn {
  // State
  recipeIngredients: RecipeIngredient[];
  recipeContentMap: Record<string, RecipeContent>;
  groceryRecipes: Recipe[];
  pantryItems: string[];
  isLoading: boolean;
  smartGroceryItems: SmartGroceryItem[] | null;
  perRecipeItems: Record<string, SmartGroceryItem[]> | undefined;
  isCombining: boolean;
  combineError: string | null;
  checkedItems: Set<string>;
  generalItems: GeneralGroceryItem[];
  hasPendingChanges: boolean;
  isAddingGeneral: boolean;
  setIsAddingGeneral: (v: boolean) => void;

  // Handlers
  handleToggleChecked: (itemName: string) => void;
  handleEditItemText: (
    originalName: string,
    newText: string,
    sourceRecipeId?: string
  ) => void;
  handleRemoveItem: (itemName: string, sourceRecipeId?: string) => void;
  handleAddGeneralItemDirect: (item: {
    name: string;
    quantity?: string;
    unit?: string;
  }) => Promise<void>;
  handleRemoveGeneralItem: (itemId: string) => Promise<void>;
  handleUpdateGeneralItem: (
    itemId: string,
    updates: { name?: string; quantity?: string; unit?: string }
  ) => Promise<void>;
  handleBulkParseGroceryText: (text: string) => Promise<ParsedGroceryItem[]>;
  handleParseRecipe: (recipeId: string) => Promise<void>;
  triggerRecombine: () => Promise<void>;

  // Control
  refreshGroceries: () => void;
  invalidateCache: () => void;
}

export function useGroceryList(
  options: UseGroceryListOptions
): UseGroceryListReturn {
  const {
    contextType,
    contextId,
    userId,
    recipeIds,
    recipes,
    enabled = true,
    supportsGeneralItems = false,
  } = options;

  // --- State ---
  const [groceryRecipes, setGroceryRecipes] = useState<Recipe[]>([]);
  const [recipeIngredients, setRecipeIngredients] = useState<
    RecipeIngredient[]
  >([]);
  const [recipeContentMap, setRecipeContentMap] = useState<
    Record<string, RecipeContent>
  >({});
  const [pantryItems, setPantryItems] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [smartGroceryItems, setSmartGroceryItems] =
    useState<SmartGroceryItem[] | null>(null);
  const [perRecipeItems, setPerRecipeItems] = useState<
    Record<string, SmartGroceryItem[]> | undefined
  >(undefined);
  const [isCombining, setIsCombining] = useState(false);
  const [combineError, setCombineError] = useState<string | null>(null);
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [generalItems, setGeneralItems] = useState<GeneralGroceryItem[]>([]);
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const [isAddingGeneral, setIsAddingGeneral] = useState(false);
  const [refreshCounter, setRefreshCounter] = useState(0);

  // --- Refs ---
  const lastCombinedRecipeIds = useRef<string[]>([]);
  const lastCombinedGeneralCount = useRef<number>(0);
  const recombineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerRecombineRef = useRef<() => void>(() => {});
  const dirtyRef = useRef(true);
  const prevRecipeIdsRef = useRef<string | null>(null);

  // Serialized recipe IDs for change detection
  const serializedRecipeIds = useMemo(
    () => [...recipeIds].sort().join(","),
    [recipeIds]
  );

  // --- Core functions ---

  const loadGroceryData = useCallback(
    async (
      ids: string[]
    ): Promise<{
      ingredients: RecipeIngredient[];
      contentMap: Record<string, RecipeContent>;
      recipes: Recipe[];
    } | null> => {
      if (ids.length === 0) {
        setGroceryRecipes([]);
        setRecipeIngredients([]);
        setRecipeContentMap({});
        return null;
      }

      setIsLoading(true);
      try {
        const [ingredientsResult, contentResult, recipesResult] =
          await Promise.all([
            supabase
              .from("recipe_ingredients")
              .select("*")
              .in("recipe_id", ids),
            supabase.from("recipe_content").select("*").in("recipe_id", ids),
            supabase.from("recipes").select("id, name, url").in("id", ids),
          ]);

        let ingredients: RecipeIngredient[] = [];
        if (ingredientsResult.data) {
          ingredients = ingredientsResult.data.map((row) => ({
            id: row.id,
            recipeId: row.recipe_id,
            name: row.name,
            quantity: row.quantity ?? undefined,
            unit: row.unit ?? undefined,
            category: row.category as RecipeIngredient["category"],
            rawText: row.raw_text ?? undefined,
            sortOrder: row.sort_order ?? undefined,
            createdAt: row.created_at,
          }));
          setRecipeIngredients(ingredients);
        }

        const contentMap: Record<string, RecipeContent> = {};
        if (contentResult.data) {
          for (const row of contentResult.data) {
            contentMap[row.recipe_id] = {
              id: row.id,
              recipeId: row.recipe_id,
              description: row.description ?? undefined,
              servings: row.servings ?? undefined,
              prepTime: row.prep_time ?? undefined,
              cookTime: row.cook_time ?? undefined,
              totalTime: row.total_time ?? undefined,
              instructions: Array.isArray(row.instructions)
                ? (row.instructions as string[])
                : undefined,
              sourceTitle: row.source_title ?? undefined,
              parsedAt: row.parsed_at ?? undefined,
              status: row.status as RecipeContent["status"],
              errorMessage: row.error_message ?? undefined,
              createdAt: row.created_at,
            };
          }
          setRecipeContentMap(contentMap);
        }

        let loadedRecipes: Recipe[] = [];
        if (recipesResult.data) {
          loadedRecipes = recipesResult.data.map((r) => ({
            id: r.id,
            name: r.name,
            url: r.url ?? undefined,
          }));
          setGroceryRecipes(loadedRecipes);
        }

        return { ingredients, contentMap, recipes: loadedRecipes };
      } catch (error) {
        console.error("Error loading grocery data:", error);
        toast.error("Failed to load grocery list");
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const loadPantryItems = useCallback(async () => {
    if (!userId) return;
    try {
      await ensureDefaultPantryItems(userId);
      const pantry = await getPantryItems(userId);
      setPantryItems(pantry.map((i) => i.name));
    } catch (error) {
      console.error("Error loading pantry items:", error);
    }
  }, [userId]);

  const runSmartCombine = useCallback(
    async (
      currentIngredients: RecipeIngredient[],
      currentContentMap: Record<string, RecipeContent>,
      currentRecipes: Recipe[],
      currentGeneralItems?: GeneralGroceryItem[]
    ) => {
      if (!contextId || !userId) return;

      const parsedRecipes = currentRecipes.filter(
        (r) => currentContentMap[r.id]?.status === "completed"
      );
      const genItems = currentGeneralItems ?? [];
      if (parsedRecipes.length < 1 && genItems.length === 0) {
        setSmartGroceryItems(null);
        setCombineError(null);
        return;
      }

      const sortedRecipeIds = parsedRecipes.map((r) => r.id).sort();
      const sameRecipes =
        sortedRecipeIds.length === lastCombinedRecipeIds.current.length &&
        sortedRecipeIds.every(
          (id, i) => id === lastCombinedRecipeIds.current[i]
        );
      const sameGeneral = genItems.length === lastCombinedGeneralCount.current;
      if (sameRecipes && sameGeneral) {
        return; // Same recipes + same general count, skip re-combine
      }

      setIsCombining(true);
      setCombineError(null);
      try {
        const recipeNameMap: Record<string, string> = {};
        for (const r of currentRecipes) {
          recipeNameMap[r.id] = r.name;
        }
        const extraRaw =
          genItems.length > 0 ? toRawIngredients(genItems) : undefined;
        const result = await smartCombineIngredients(
          currentIngredients,
          recipeNameMap,
          extraRaw
        );
        setSmartGroceryItems(result.items);
        setPerRecipeItems(result.perRecipeItems);
        lastCombinedRecipeIds.current = sortedRecipeIds;
        lastCombinedGeneralCount.current = genItems.length;

        // Preserve checked items that still exist in the new combined list
        const newItemNames = new Set(result.items.map((i) => i.name));
        setCheckedItems((prev) => {
          const kept = new Set(
            [...prev].filter((name) => newItemNames.has(name))
          );
          saveCheckedItems(contextType, contextId, userId, kept);
          return kept;
        });

        // Persist to cache
        saveGroceryCache(
          contextType,
          contextId,
          userId,
          result.items,
          sortedRecipeIds,
          result.perRecipeItems
        );
      } catch (err) {
        console.error("Smart combine error:", err);
        // Preserve existing display items on error so the user doesn't lose their list
        const msg = err instanceof Error ? err.message : "Unknown error";
        setCombineError(
          msg.includes("skipped")
            ? "AI grocery service is not configured. Please set the ANTHROPIC_API_KEY in your Supabase edge function secrets."
            : msg
        );
      } finally {
        setIsCombining(false);
      }
    },
    [contextType, contextId, userId]
  );

  // --- Handlers ---

  const handleToggleChecked = useCallback(
    (itemName: string) => {
      setCheckedItems((prev) => {
        const next = new Set(prev);
        if (next.has(itemName)) {
          next.delete(itemName);
        } else {
          next.add(itemName);
        }
        if (contextId && userId) {
          saveCheckedItems(contextType, contextId, userId, next);
        }
        return next;
      });
    },
    [contextType, contextId, userId]
  );

  const invalidateCacheAndResetRefs = useCallback(() => {
    if (contextId && userId) {
      deleteGroceryCache(contextType, contextId, userId);
    }
    lastCombinedRecipeIds.current = [];
    lastCombinedGeneralCount.current = 0;
  }, [contextType, contextId, userId]);

  const triggerRecombine = useCallback(async () => {
    if (!contextId || !userId) return;
    if (recombineTimerRef.current) {
      clearTimeout(recombineTimerRef.current);
      recombineTimerRef.current = null;
    }
    setHasPendingChanges(false);
    await deleteGroceryCache(contextType, contextId, userId);
    lastCombinedRecipeIds.current = [];
    lastCombinedGeneralCount.current = 0;

    let genItems: GeneralGroceryItem[] = [];
    if (supportsGeneralItems) {
      genItems = await loadGeneralItems(contextType, contextId, userId);
      setGeneralItems(genItems);
    }

    const groceryData = await loadGroceryData(recipeIds);
    await runSmartCombine(
      groceryData?.ingredients ?? [],
      groceryData?.contentMap ?? {},
      groceryData?.recipes ?? [],
      genItems
    );
  }, [
    contextType,
    contextId,
    userId,
    supportsGeneralItems,
    recipeIds,
    loadGroceryData,
    runSmartCombine,
  ]);
  triggerRecombineRef.current = triggerRecombine;

  const startRecombineTimer = useCallback(() => {
    if (recombineTimerRef.current) {
      clearTimeout(recombineTimerRef.current);
    }
    recombineTimerRef.current = setTimeout(() => {
      triggerRecombine();
    }, RECOMBINE_DELAY_MS);
  }, [triggerRecombine]);

  const handleEditItemText = useCallback(
    (originalName: string, newText: string, sourceRecipeId?: string) => {
      // Update combined list display
      setSmartGroceryItems((prev) => {
        if (!prev) return prev;
        return prev.map((item) =>
          item.name === originalName
            ? {
                ...item,
                displayName: newText,
                totalQuantity: undefined,
                unit: undefined,
              }
            : item
        );
      });
      // Update per-recipe list display
      setPerRecipeItems((prev) => {
        if (!prev) return prev;
        const updated: Record<string, SmartGroceryItem[]> = {};
        for (const [key, items] of Object.entries(prev)) {
          updated[key] = items.map((item) =>
            item.name === originalName
              ? {
                  ...item,
                  displayName: newText,
                  totalQuantity: undefined,
                  unit: undefined,
                }
              : item
          );
        }
        return updated;
      });
      // Persist edit to DB
      if (sourceRecipeId) {
        const match = recipeIngredients.find(
          (ri) =>
            ri.recipeId === sourceRecipeId &&
            ri.name.toLowerCase() === originalName.toLowerCase()
        );
        if (match) {
          supabase
            .from("recipe_ingredients")
            .update({ name: newText })
            .eq("id", match.id)
            .then(() => {});
        }
      } else if (supportsGeneralItems) {
        // Edit from combined/general tab — persist General items only
        const matchedItem = smartGroceryItems?.find(
          (i) => i.name === originalName
        );
        if (matchedItem?.sourceRecipes.includes("General")) {
          const generalItem = generalItems.find(
            (gi) => gi.name.toLowerCase() === originalName.toLowerCase()
          );
          if (generalItem) {
            updateGeneralItem(generalItem.id, {
              name: newText,
              quantity: undefined,
              unit: undefined,
            });
          }
        }
      }
      invalidateCacheAndResetRefs();
      setHasPendingChanges(true);
      startRecombineTimer();
    },
    [
      smartGroceryItems,
      generalItems,
      recipeIngredients,
      supportsGeneralItems,
      startRecombineTimer,
      invalidateCacheAndResetRefs,
    ]
  );

  const handleRemoveItem = useCallback(
    (itemName: string, sourceRecipeId?: string) => {
      // Remove from combined list
      setSmartGroceryItems((prev) =>
        prev ? prev.filter((item) => item.name !== itemName) : prev
      );
      // Remove from per-recipe lists
      setPerRecipeItems((prev) => {
        if (!prev) return prev;
        const updated: Record<string, SmartGroceryItem[]> = {};
        for (const [key, items] of Object.entries(prev)) {
          updated[key] = items.filter((item) => item.name !== itemName);
        }
        return updated;
      });
      // Persist delete to DB
      if (sourceRecipeId) {
        const match = recipeIngredients.find(
          (ri) =>
            ri.recipeId === sourceRecipeId &&
            ri.name.toLowerCase() === itemName.toLowerCase()
        );
        if (match) {
          supabase
            .from("recipe_ingredients")
            .delete()
            .eq("id", match.id)
            .then(() => {});
          setRecipeIngredients((prev) =>
            prev.filter((ri) => ri.id !== match.id)
          );
        }
      } else if (supportsGeneralItems) {
        // Delete from combined/general tab — persist General items only
        const matchedItem = smartGroceryItems?.find(
          (i) => i.name === itemName
        );
        if (matchedItem?.sourceRecipes.includes("General")) {
          const generalItem = generalItems.find(
            (gi) => gi.name.toLowerCase() === itemName.toLowerCase()
          );
          if (generalItem) {
            removeGeneralItem(generalItem.id);
          }
        }
      }
      invalidateCacheAndResetRefs();
      setHasPendingChanges(true);
      startRecombineTimer();
    },
    [
      smartGroceryItems,
      generalItems,
      recipeIngredients,
      supportsGeneralItems,
      startRecombineTimer,
      invalidateCacheAndResetRefs,
    ]
  );

  const handleAddGeneralItemDirect = useCallback(
    async (item: { name: string; quantity?: string; unit?: string }) => {
      if (!supportsGeneralItems || !contextId || !userId) return;
      await addGeneralItem(contextType, contextId, userId, item);
      const updated = await loadGeneralItems(contextType, contextId, userId);
      setGeneralItems(updated);
      invalidateCacheAndResetRefs();
      dirtyRef.current = true;
      setHasPendingChanges(true);
      startRecombineTimer();
    },
    [
      contextType,
      contextId,
      userId,
      supportsGeneralItems,
      startRecombineTimer,
      invalidateCacheAndResetRefs,
    ]
  );

  const handleRemoveGeneralItem = useCallback(
    async (itemId: string) => {
      if (!supportsGeneralItems || !contextId || !userId) return;
      await removeGeneralItem(itemId);
      const updated = await loadGeneralItems(contextType, contextId, userId);
      setGeneralItems(updated);
      invalidateCacheAndResetRefs();
      dirtyRef.current = true;
      setHasPendingChanges(true);
      startRecombineTimer();
    },
    [
      contextType,
      contextId,
      userId,
      supportsGeneralItems,
      startRecombineTimer,
      invalidateCacheAndResetRefs,
    ]
  );

  const handleUpdateGeneralItem = useCallback(
    async (
      itemId: string,
      updates: { name?: string; quantity?: string; unit?: string }
    ) => {
      if (!supportsGeneralItems || !contextId || !userId) return;
      await updateGeneralItem(itemId, updates);
      const updated = await loadGeneralItems(contextType, contextId, userId);
      setGeneralItems(updated);
      invalidateCacheAndResetRefs();
      dirtyRef.current = true;
      setHasPendingChanges(true);
      startRecombineTimer();
    },
    [
      contextType,
      contextId,
      userId,
      supportsGeneralItems,
      startRecombineTimer,
      invalidateCacheAndResetRefs,
    ]
  );

  const handleBulkParseGroceryText = useCallback(
    async (text: string): Promise<ParsedGroceryItem[]> => {
      if (!userId) throw new Error("Not authenticated");
      return parseIngredientText(text, userId);
    },
    [userId]
  );

  const handleParseRecipe = useCallback(
    async (recipeId: string) => {
      // Look up recipe from either the groceryRecipes state or the recipes prop
      const recipe =
        groceryRecipes.find((r) => r.id === recipeId) ||
        recipes.find((r) => r.id === recipeId);
      try {
        const { data, error } = await supabase.functions.invoke(
          "parse-recipe",
          {
            body: {
              recipeId,
              recipeUrl: recipe?.url,
              recipeName: recipe?.name,
            },
          }
        );

        if (error) throw error;
        if (!data?.success) {
          toast.error(data?.error ?? "Failed to parse recipe");
          return;
        }
        toast.success("Recipe parsed successfully!");
        refreshGroceries();
      } catch (error) {
        console.error("Error parsing recipe:", error);
        toast.error("Failed to parse recipe");
      }
    },
    [groceryRecipes, recipes]
  );

  const refreshGroceries = useCallback(() => {
    dirtyRef.current = true;
    setRefreshCounter((c) => c + 1);
  }, []);

  const invalidateCache = useCallback(() => {
    if (contextId && userId) {
      deleteGroceryCache(contextType, contextId, userId);
    }
  }, [contextType, contextId, userId]);

  // --- Effects ---

  // Unmount cleanup: clear pending recombine timer.
  // Don't fire triggerRecombine() here — it makes async Supabase calls that
  // can hold navigator.locks and block getSession() on the next page.
  useEffect(() => {
    return () => {
      if (recombineTimerRef.current) {
        clearTimeout(recombineTimerRef.current);
        recombineTimerRef.current = null;
      }
    };
  }, []);

  // Detect recipeIds changes and mark dirty
  useEffect(() => {
    if (prevRecipeIdsRef.current === null) {
      // First render — just record, don't mark dirty (the initial dirty=true handles it)
      prevRecipeIdsRef.current = serializedRecipeIds;
      return;
    }
    if (prevRecipeIdsRef.current !== serializedRecipeIds) {
      prevRecipeIdsRef.current = serializedRecipeIds;
      dirtyRef.current = true;
      setRefreshCounter((c) => c + 1);
    }
  }, [serializedRecipeIds]);

  // Main loading effect
  useEffect(() => {
    if (!enabled) return;
    if (!contextId || !userId) return;
    if (isAddingGeneral) return;
    if (!dirtyRef.current) return;
    dirtyRef.current = false;

    const currentRecipeIds = recipeIds;

    // Load general items alongside grocery data
    if (supportsGeneralItems) {
      loadGeneralItems(contextType, contextId, userId).then(setGeneralItems);
    }

    loadGroceryData(currentRecipeIds).then(async (groceryData) => {
      // Load checked items
      loadCheckedItems(contextType, contextId, userId).then(setCheckedItems);

      // Load general items for combine pipeline
      let genItems: GeneralGroceryItem[] = [];
      if (supportsGeneralItems) {
        genItems = await loadGeneralItems(contextType, contextId, userId);
        setGeneralItems(genItems);
      }

      if (!groceryData && genItems.length === 0) return;

      // Check cache before running AI combine
      const cached = await loadGroceryCache(contextType, contextId, userId);
      if (cached) {
        const currentParsedIds = groceryData
          ? groceryData.recipes
              .filter(
                (r) => groceryData.contentMap[r.id]?.status === "completed"
              )
              .map((r) => r.id)
              .sort()
          : [];
        const cachedIds = [...cached.recipeIds].sort();
        if (
          currentParsedIds.length === cachedIds.length &&
          currentParsedIds.every((id, i) => id === cachedIds[i])
        ) {
          setSmartGroceryItems(cached.items);
          setPerRecipeItems(cached.perRecipeItems);
          lastCombinedRecipeIds.current = cachedIds;
          lastCombinedGeneralCount.current = genItems.length;
          return;
        }
      }
      // Cache miss or stale — run smart combine
      const ingredients = groceryData?.ingredients ?? [];
      const contentMap = groceryData?.contentMap ?? {};
      const loadedRecipes = groceryData?.recipes ?? [];
      runSmartCombine(ingredients, contentMap, loadedRecipes, genItems);
    });
    loadPantryItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    enabled,
    contextId,
    userId,
    refreshCounter,
    isAddingGeneral,
  ]);

  return {
    recipeIngredients,
    recipeContentMap,
    groceryRecipes,
    pantryItems,
    isLoading,
    smartGroceryItems,
    perRecipeItems,
    isCombining,
    combineError,
    checkedItems,
    generalItems,
    hasPendingChanges,
    isAddingGeneral,
    setIsAddingGeneral,

    handleToggleChecked,
    handleEditItemText,
    handleRemoveItem,
    handleAddGeneralItemDirect,
    handleRemoveGeneralItem,
    handleUpdateGeneralItem,
    handleBulkParseGroceryText,
    handleParseRecipe,
    triggerRecombine,

    refreshGroceries,
    invalidateCache,
  };
}
