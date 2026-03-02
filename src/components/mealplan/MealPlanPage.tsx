import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ShoppingCart, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import RecipeParseProgress from "@/components/recipes/RecipeParseProgress";
import WeekNavigation from "./WeekNavigation";
import MealPlanGrid from "./MealPlanGrid";
import AddMealDialog from "./AddMealDialog";
import GroceryListSection from "@/components/recipes/GroceryListSection";
import PantrySection from "@/components/pantry/PantrySection";
import { getPantryItems, ensureDefaultPantryItems } from "@/lib/pantry";
import { RECOMBINE_DELAY_MS } from "@/lib/constants";
import { smartCombineIngredients } from "@/lib/groceryList";
import { loadGroceryCache, saveGroceryCache, deleteGroceryCache, loadCheckedItems, saveCheckedItems } from "@/lib/groceryCache";
import { loadGeneralItems, addGeneralItem, removeGeneralItem, updateGeneralItem, toRawIngredients } from "@/lib/generalGrocery";
import { loadUserPreferences } from "@/lib/userPreferences";
import type { ParsedGroceryItem } from "@/components/recipes/GroceryListSection";
import type { MealPlanItem, Recipe, RecipeIngredient, RecipeContent, SmartGroceryItem, GeneralGroceryItem, UserPreferences } from "@/types";

interface MealPlanPageProps {
  userId: string;
}

const getWeekStart = (date: Date, weekStartDay: number = 0): Date => {
  const d = new Date(date);
  const dayOfWeek = d.getDay();
  const diff = weekStartDay === 1
    ? (dayOfWeek + 6) % 7  // Monday-start: Mon=0, Tue=1, ..., Sun=6
    : dayOfWeek;            // Sunday-start: Sun=0, Mon=1, ..., Sat=6
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

const getWeekLabel = (weekStart: Date): string => {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `Meal Plan ${fmt(weekStart)}-${fmt(weekEnd)}`;
};

const MealPlanPage = ({ userId }: MealPlanPageProps) => {
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [planId, setPlanId] = useState<string | null>(null);
  const [items, setItems] = useState<MealPlanItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingSlot, setPendingSlot] = useState<{ dayOfWeek: number; mealType: string } | null>(null);
  const [showAddMealDialog, setShowAddMealDialog] = useState(false);
  const [viewTab, setViewTab] = useState<"plan" | "groceries" | "pantry">("plan");
  const [groceryRecipes, setGroceryRecipes] = useState<Recipe[]>([]);
  const [recipeIngredients, setRecipeIngredients] = useState<RecipeIngredient[]>([]);
  const [recipeContentMap, setRecipeContentMap] = useState<Record<string, RecipeContent>>({});
  const [pantryItems, setPantryItems] = useState<string[]>([]);
  const [isLoadingGroceries, setIsLoadingGroceries] = useState(false);
  // Parse progress state
  const [parseStatus, setParseStatus] = useState<"idle" | "parsing" | "failed">("idle");
  const [pendingParseRecipeId, setPendingParseRecipeId] = useState<string | null>(null);
  const [pendingParseName, setPendingParseName] = useState<string>("");
  const [pendingParseText, setPendingParseText] = useState<string>("");
  const [parseStep, setParseStep] = useState<"saving" | "parsing" | "loading" | "done">("saving");

  // Smart grocery combine state
  const [smartGroceryItems, setSmartGroceryItems] = useState<SmartGroceryItem[] | null>(null);
  const [perRecipeItems, setPerRecipeItems] = useState<Record<string, SmartGroceryItem[]> | undefined>(undefined);
  const [isCombining, setIsCombining] = useState(false);
  const [combineError, setCombineError] = useState<string | null>(null);
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [generalItems, setGeneralItems] = useState<GeneralGroceryItem[]>([]);
  const [userPreferences, setUserPreferences] = useState<UserPreferences | null>(null);
  const [hasPendingGroceryChanges, setHasPendingGroceryChanges] = useState(false);
  const [isAddingGeneral, setIsAddingGeneral] = useState(false);
  const lastCombinedRecipeIds = useRef<string[]>([]);
  const lastCombinedGeneralCount = useRef<number>(0);
  const viewTabRef = useRef(viewTab);
  viewTabRef.current = viewTab;
  const groceryDirtyRef = useRef(true);
  const recombineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingBackgroundCombineRef = useRef(false);
  const triggerRecombineRef = useRef<() => void>(() => {});

  const navigate = useNavigate();

  // On unmount: if a recombine timer is pending, fire the combine immediately
  // so the cache is saved in the background (setState calls are no-ops but
  // saveGroceryCache still writes to the DB).
  useEffect(() => {
    return () => {
      if (recombineTimerRef.current) {
        clearTimeout(recombineTimerRef.current);
        triggerRecombineRef.current();
      }
    };
  }, []);

  const loadPlan = useCallback(async () => {
    setIsLoading(true);
    try {
      const weekStartStr = weekStart.toISOString().split("T")[0];

      // Find existing plan — use order+limit instead of maybeSingle to be
      // resilient to any duplicate rows (avoids PGRST116 error)
      const { data: plans } = await supabase
        .from("meal_plans")
        .select("id")
        .eq("user_id", userId)
        .eq("week_start", weekStartStr)
        .order("created_at")
        .limit(1);

      const existingPlan = plans && plans.length > 0 ? plans[0] : null;

      if (existingPlan) {
        setPlanId(existingPlan.id);

        // Load items
        const { data: itemsData } = await supabase
          .from("meal_plan_items")
          .select("*, recipes (name, url)")
          .eq("plan_id", existingPlan.id)
          .order("sort_order");

        const mapped: MealPlanItem[] = (itemsData || []).map((item) => {
          const recipe = item.recipes as unknown as { name: string; url: string | null } | null;
          return {
            id: item.id,
            planId: item.plan_id,
            recipeId: item.recipe_id || undefined,
            dayOfWeek: item.day_of_week,
            mealType: item.meal_type as MealPlanItem["mealType"],
            customName: item.custom_name || undefined,
            customUrl: item.custom_url || undefined,
            sortOrder: item.sort_order,
            recipeName: recipe?.name,
            recipeUrl: recipe?.url || undefined,
            eventId: (item as Record<string, unknown>).event_id as string | undefined,
            cookedAt: (item as Record<string, unknown>).cooked_at as string | undefined,
          };
        });
        setItems(mapped);
        groceryDirtyRef.current = true;
      } else {
        // Create plan — use upsert to be idempotent under StrictMode double-execution
        const { data: newPlan, error } = await supabase
          .from("meal_plans")
          .upsert(
            {
              user_id: userId,
              week_start: weekStartStr,
              name: "Weekly Plan",
            },
            { onConflict: "user_id,week_start" }
          )
          .select("id")
          .single();

        if (error) throw error;
        setPlanId(newPlan.id);
        setItems([]);
        groceryDirtyRef.current = true;
      }
    } catch (error) {
      console.error("Error loading meal plan:", error);
      toast.error("Failed to load meal plan");
    } finally {
      setIsLoading(false);
    }
  }, [userId, weekStart]);

  useEffect(() => {
    loadPlan();
  }, [loadPlan]);

  // Load user preferences once, and recalculate weekStart if weekStartDay differs from default
  useEffect(() => {
    loadUserPreferences(userId).then((prefs) => {
      setUserPreferences(prefs);
      if (prefs.weekStartDay !== 0) {
        setWeekStart(getWeekStart(new Date(), prefs.weekStartDay));
      }
    });
  }, [userId]);

  const handlePreviousWeek = () => {
    setWeekStart((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 7);
      return d;
    });
  };

  const handleNextWeek = () => {
    setWeekStart((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 7);
      return d;
    });
  };

  const handleCurrentWeek = () => {
    setWeekStart(getWeekStart(new Date(), userPreferences?.weekStartDay ?? 0));
  };

  const loadGroceryData = useCallback(async (): Promise<{
    ingredients: RecipeIngredient[];
    contentMap: Record<string, RecipeContent>;
    recipes: Recipe[];
  } | null> => {
    const recipeIds = items
      .map((i) => i.recipeId)
      .filter((id): id is string => !!id);

    if (recipeIds.length === 0) {
      setGroceryRecipes([]);
      setRecipeIngredients([]);
      setRecipeContentMap({});
      return null;
    }

    setIsLoadingGroceries(true);
    try {
      const [ingredientsResult, contentResult, recipesResult] = await Promise.all([
        supabase.from("recipe_ingredients").select("*").in("recipe_id", recipeIds),
        supabase.from("recipe_content").select("*").in("recipe_id", recipeIds),
        supabase.from("recipes").select("id, name, url").in("id", recipeIds),
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
            instructions: Array.isArray(row.instructions) ? row.instructions as string[] : undefined,
            sourceTitle: row.source_title ?? undefined,
            parsedAt: row.parsed_at ?? undefined,
            status: row.status as RecipeContent["status"],
            errorMessage: row.error_message ?? undefined,
            createdAt: row.created_at,
          };
        }
        setRecipeContentMap(contentMap);
      }

      let recipes: Recipe[] = [];
      if (recipesResult.data) {
        recipes = recipesResult.data.map((r) => ({
          id: r.id,
          name: r.name,
          url: r.url ?? undefined,
        }));
        setGroceryRecipes(recipes);
      }

      return { ingredients, contentMap, recipes };
    } catch (error) {
      console.error("Error loading grocery data:", error);
      toast.error("Failed to load grocery list");
      return null;
    } finally {
      setIsLoadingGroceries(false);
    }
  }, [items]);

  const loadPantryItems = useCallback(async () => {
    try {
      await ensureDefaultPantryItems(userId);
      const pantry = await getPantryItems(userId);
      setPantryItems(pantry.map((i) => i.name));
    } catch (error) {
      console.error("Error loading pantry items:", error);
    }
  }, [userId]);

  const runSmartCombine = useCallback(async (
    currentIngredients: RecipeIngredient[],
    currentContentMap: Record<string, RecipeContent>,
    currentRecipes: Recipe[],
    currentGeneralItems?: GeneralGroceryItem[]
  ) => {
    const parsedRecipes = currentRecipes.filter((r) => currentContentMap[r.id]?.status === "completed");
    const genItems = currentGeneralItems ?? [];
    if (parsedRecipes.length < 1 && genItems.length === 0) {
      setSmartGroceryItems(null);
      setCombineError(null);
      return;
    }

    const sortedRecipeIds = parsedRecipes.map((r) => r.id).sort();
    const sameRecipes = sortedRecipeIds.length === lastCombinedRecipeIds.current.length &&
      sortedRecipeIds.every((id, i) => id === lastCombinedRecipeIds.current[i]);
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
      const extraRaw = genItems.length > 0 ? toRawIngredients(genItems) : undefined;
      const result = await smartCombineIngredients(currentIngredients, recipeNameMap, extraRaw);
      setSmartGroceryItems(result.items);
      setPerRecipeItems(result.perRecipeItems);
      lastCombinedRecipeIds.current = sortedRecipeIds;
      lastCombinedGeneralCount.current = genItems.length;

      // Preserve checked items that still exist in the new combined list
      const newItemNames = new Set(result.items.map((i) => i.name));
      setCheckedItems((prev) => {
        const kept = new Set([...prev].filter((name) => newItemNames.has(name)));
        const weekStartStr = weekStart.toISOString().split("T")[0];
        saveCheckedItems("meal_plan", weekStartStr, userId, kept);
        return kept;
      });

      // Persist to cache
      const weekStartStr = weekStart.toISOString().split("T")[0];
      saveGroceryCache("meal_plan", weekStartStr, userId, result.items, sortedRecipeIds, result.perRecipeItems);
    } catch (err) {
      console.error("Smart combine error:", err);
      // Preserve existing display items on error so the user doesn't lose their list
      const msg = err instanceof Error ? err.message : "Unknown error";
      setCombineError(msg.includes("skipped") ? "AI grocery service is not configured. Please set the ANTHROPIC_API_KEY in your Supabase edge function secrets." : msg);
    } finally {
      setIsCombining(false);
    }
  }, [weekStart, userId]);

  const handleToggleChecked = useCallback((itemName: string) => {
    setCheckedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemName)) {
        next.delete(itemName);
      } else {
        next.add(itemName);
      }
      const weekStartStr = weekStart.toISOString().split("T")[0];
      saveCheckedItems("meal_plan", weekStartStr, userId, next);
      return next;
    });
  }, [weekStart, userId]);

  const triggerRecombine = useCallback(async () => {
    if (recombineTimerRef.current) {
      clearTimeout(recombineTimerRef.current);
      recombineTimerRef.current = null;
    }
    setHasPendingGroceryChanges(false);
    const weekStartStr = weekStart.toISOString().split("T")[0];
    await deleteGroceryCache("meal_plan", weekStartStr, userId);
    lastCombinedRecipeIds.current = [];
    lastCombinedGeneralCount.current = 0;
    const genItems = await loadGeneralItems("meal_plan", weekStartStr, userId);
    setGeneralItems(genItems);
    const groceryData = await loadGroceryData();
    await runSmartCombine(
      groceryData?.ingredients ?? [],
      groceryData?.contentMap ?? {},
      groceryData?.recipes ?? [],
      genItems
    );
  }, [weekStart, userId, loadGroceryData, runSmartCombine]);
  triggerRecombineRef.current = triggerRecombine;

  // Background combine after adding existing recipes (items closure is now up-to-date)
  useEffect(() => {
    if (!pendingBackgroundCombineRef.current) return;
    pendingBackgroundCombineRef.current = false;
    triggerRecombine();
  }, [items, triggerRecombine]);

  const startRecombineTimer = useCallback(() => {
    if (recombineTimerRef.current) {
      clearTimeout(recombineTimerRef.current);
    }
    recombineTimerRef.current = setTimeout(() => {
      triggerRecombine();
    }, RECOMBINE_DELAY_MS);
  }, [triggerRecombine]);

  const handleEditGroceryItem = useCallback((originalName: string, newText: string, sourceRecipeId?: string) => {
    // Update combined list display
    setSmartGroceryItems((prev) => {
      if (!prev) return prev;
      return prev.map((item) =>
        item.name === originalName
          ? { ...item, displayName: newText, totalQuantity: undefined, unit: undefined }
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
            ? { ...item, displayName: newText, totalQuantity: undefined, unit: undefined }
            : item
        );
      }
      return updated;
    });
    // Persist edit to DB
    if (sourceRecipeId) {
      // Edit from a recipe tab — update the recipe_ingredients row
      const match = recipeIngredients.find(
        (ri) => ri.recipeId === sourceRecipeId && ri.name.toLowerCase() === originalName.toLowerCase()
      );
      if (match) {
        supabase.from("recipe_ingredients").update({ name: newText }).eq("id", match.id).then(() => {});
      }
    } else {
      // Edit from combined/general tab — persist General items only
      const matchedItem = smartGroceryItems?.find((i) => i.name === originalName);
      if (matchedItem?.sourceRecipes.includes("General")) {
        const generalItem = generalItems.find((gi) =>
          gi.name.toLowerCase() === originalName.toLowerCase()
        );
        if (generalItem) {
          updateGeneralItem(generalItem.id, { name: newText, quantity: undefined, unit: undefined });
        }
      }
    }
    // Invalidate cache so a stale list isn't shown if user closes the browser
    const weekStartStr = weekStart.toISOString().split("T")[0];
    deleteGroceryCache("meal_plan", weekStartStr, userId);
    lastCombinedRecipeIds.current = [];
    lastCombinedGeneralCount.current = 0;
    setHasPendingGroceryChanges(true);
    startRecombineTimer();
  }, [smartGroceryItems, generalItems, recipeIngredients, startRecombineTimer, weekStart, userId]);

  const handleRemoveGroceryItem = useCallback((itemName: string, sourceRecipeId?: string) => {
    // Remove from combined list
    setSmartGroceryItems((prev) => prev ? prev.filter((item) => item.name !== itemName) : prev);
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
      // Delete from a recipe tab — delete the recipe_ingredients row
      const match = recipeIngredients.find(
        (ri) => ri.recipeId === sourceRecipeId && ri.name.toLowerCase() === itemName.toLowerCase()
      );
      if (match) {
        supabase.from("recipe_ingredients").delete().eq("id", match.id).then(() => {});
        setRecipeIngredients((prev) => prev.filter((ri) => ri.id !== match.id));
      }
    } else {
      // Delete from combined/general tab — persist General items only
      const matchedItem = smartGroceryItems?.find((i) => i.name === itemName);
      if (matchedItem?.sourceRecipes.includes("General")) {
        const generalItem = generalItems.find((gi) =>
          gi.name.toLowerCase() === itemName.toLowerCase()
        );
        if (generalItem) {
          removeGeneralItem(generalItem.id);
        }
      }
    }
    // Invalidate cache so a stale list isn't shown if user closes the browser
    const weekStartStr = weekStart.toISOString().split("T")[0];
    deleteGroceryCache("meal_plan", weekStartStr, userId);
    lastCombinedRecipeIds.current = [];
    lastCombinedGeneralCount.current = 0;
    setHasPendingGroceryChanges(true);
    startRecombineTimer();
  }, [smartGroceryItems, generalItems, recipeIngredients, startRecombineTimer, weekStart, userId]);

  // Saves already-parsed items directly without additional AI processing
  const handleAddGeneralItemDirect = useCallback(async (item: { name: string; quantity?: string; unit?: string }) => {
    const weekStartStr = weekStart.toISOString().split("T")[0];
    await addGeneralItem("meal_plan", weekStartStr, userId, item);
    const updated = await loadGeneralItems("meal_plan", weekStartStr, userId);
    setGeneralItems(updated);
    await deleteGroceryCache("meal_plan", weekStartStr, userId);
    lastCombinedRecipeIds.current = [];
    lastCombinedGeneralCount.current = 0;
    groceryDirtyRef.current = true;
    setHasPendingGroceryChanges(true);
    startRecombineTimer();
  }, [weekStart, userId, startRecombineTimer]);

  const handleRemoveGeneralItem = useCallback(async (itemId: string) => {
    const weekStartStr = weekStart.toISOString().split("T")[0];
    await removeGeneralItem(itemId);
    const updated = await loadGeneralItems("meal_plan", weekStartStr, userId);
    setGeneralItems(updated);
    await deleteGroceryCache("meal_plan", weekStartStr, userId);
    lastCombinedRecipeIds.current = [];
    lastCombinedGeneralCount.current = 0;
    groceryDirtyRef.current = true;
    setHasPendingGroceryChanges(true);
    startRecombineTimer();
  }, [weekStart, userId, startRecombineTimer]);

  const handleUpdateGeneralItem = useCallback(async (itemId: string, updates: { name?: string; quantity?: string; unit?: string }) => {
    const weekStartStr = weekStart.toISOString().split("T")[0];
    await updateGeneralItem(itemId, updates);
    const updated = await loadGeneralItems("meal_plan", weekStartStr, userId);
    setGeneralItems(updated);
    await deleteGroceryCache("meal_plan", weekStartStr, userId);
    lastCombinedRecipeIds.current = [];
    lastCombinedGeneralCount.current = 0;
    groceryDirtyRef.current = true;
    setHasPendingGroceryChanges(true);
    startRecombineTimer();
  }, [weekStart, userId, startRecombineTimer]);

  const handleBulkParseGroceryText = useCallback(async (text: string): Promise<ParsedGroceryItem[]> => {
    // Create a temporary recipe entry for parsing
    const { data: tempRecipe, error: recipeError } = await supabase
      .from("recipes")
      .insert({ name: "General Items", created_by: userId, event_id: null, ingredient_id: null })
      .select("id")
      .single();
    if (recipeError) throw recipeError;

    const { data, error } = await supabase.functions.invoke("parse-recipe", {
      body: { recipeId: tempRecipe.id, recipeName: "General Items", text },
    });

    // Clean up temp recipe — results are saved to general_grocery_items, not here
    supabase.from("recipes").delete().eq("id", tempRecipe.id).then(() => {});

    if (error) throw error;
    if (!data?.success) throw new Error(data?.error ?? "Failed to parse grocery text");
    if (data.skipped) return [];
    return (data.parsed?.ingredients ?? []) as ParsedGroceryItem[];
  }, [userId]);

  useEffect(() => {
    if (viewTab !== "groceries") return;
    if (isAddingGeneral) return; // Don't reload while bulk-add is in progress
    if (!groceryDirtyRef.current) return;
    groceryDirtyRef.current = false;

    const weekStartStr = weekStart.toISOString().split("T")[0];
    // Load general items alongside grocery data
    loadGeneralItems("meal_plan", weekStartStr, userId).then(setGeneralItems);

    loadGroceryData().then(async (groceryData) => {
      // Load checked items
      loadCheckedItems("meal_plan", weekStartStr, userId).then(setCheckedItems);

      // Load general items for combine pipeline
      const genItems = await loadGeneralItems("meal_plan", weekStartStr, userId);
      setGeneralItems(genItems);

      if (!groceryData && genItems.length === 0) return;

      // Check cache before running AI combine
      const cached = await loadGroceryCache("meal_plan", weekStartStr, userId);
      if (cached) {
        const currentParsedIds = groceryData
          ? groceryData.recipes
              .filter((r) => groceryData.contentMap[r.id]?.status === "completed")
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
      const recipes = groceryData?.recipes ?? [];
      runSmartCombine(ingredients, contentMap, recipes, genItems);
    });
    loadPantryItems();
  }, [viewTab, loadGroceryData, loadPantryItems, weekStart, userId, runSmartCombine, isAddingGeneral]);

  // Execute parse when parseStatus transitions to "parsing"
  useEffect(() => {
    if (parseStatus !== "parsing" || !pendingParseRecipeId) return;

    const doParse = async () => {
      try {
        setParseStep("saving");
        await new Promise(resolve => setTimeout(resolve, 200));

        setParseStep("parsing");
        const recipe = items.find((i) => i.recipeId === pendingParseRecipeId);
        const parseBody: Record<string, string> = {
          recipeId: pendingParseRecipeId,
          recipeName: pendingParseName,
        };
        if (pendingParseText) {
          parseBody.text = pendingParseText;
        } else {
          parseBody.recipeUrl = recipe?.recipeUrl || recipe?.customUrl || "";
        }
        const { data: parseData, error } = await supabase.functions.invoke("parse-recipe", {
          body: parseBody,
        });
        if (error) throw error;
        if (!parseData?.success) throw new Error(parseData?.error ?? "Failed to parse recipe");

        setParseStep("loading");
        // Load grocery data after parse, then fire off combining in background
        const groceryData = await loadGroceryData();

        // Fire off combining in background (don't await — Groceries tab shows spinner)
        if (groceryData) {
          runSmartCombine(groceryData.ingredients, groceryData.contentMap, groceryData.recipes, generalItems);
        }

        setParseStep("done");
        await new Promise(resolve => setTimeout(resolve, 2500));

        setParseStatus("idle");
        setPendingParseRecipeId(null);
        setPendingParseName("");
        setPendingParseText("");
        setParseStep("saving");
        groceryDirtyRef.current = true;
        toast.success("Recipe parsed successfully!");
      } catch (error) {
        console.error("Error parsing recipe:", error);
        setParseStatus("failed");
      }
    };

    doParse();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parseStatus, pendingParseRecipeId]);

  const handleParseRetry = () => {
    setParseStep("saving");
    setParseStatus("parsing");
  };

  const handleParseKeep = () => {
    setParseStatus("idle");
    setPendingParseRecipeId(null);
    setPendingParseName("");
    setParseStep("saving");
    toast.success("Recipe saved without parsing");
  };

  const handleParseRecipe = async (recipeId: string) => {
    const recipe = groceryRecipes.find((r) => r.id === recipeId);
    try {
      const { data, error } = await supabase.functions.invoke("parse-recipe", {
        body: { recipeId, recipeUrl: recipe?.url, recipeName: recipe?.name },
      });

      if (error) throw error;
      if (!data?.success) {
        toast.error(data?.error ?? "Failed to parse recipe");
        return;
      }
      toast.success("Recipe parsed successfully!");
      groceryDirtyRef.current = true;
      await loadGroceryData();
    } catch (error) {
      console.error("Error parsing recipe:", error);
      toast.error("Failed to parse recipe");
    }
  };

  const handleAddMeal = (dayOfWeek: number, mealType: string) => {
    setPendingSlot({ dayOfWeek, mealType });
    setShowAddMealDialog(true);
  };

  const handleAddCustomMeal = async (name: string, url?: string, shouldParse?: boolean) => {
    // pendingSlot is always set when the dialog is mounted
    const recipeId = await addItemToPlan(name, pendingSlot!.dayOfWeek, pendingSlot!.mealType, url);
    if (shouldParse && recipeId && url) {
      setPendingParseRecipeId(recipeId);
      setPendingParseName(name);
      setParseStatus("parsing");
    }
    setPendingSlot(null);
  };

  const handleAddRecipeMeal = async (recipes: Array<{ id: string; name: string; url?: string }>) => {
    // pendingSlot is always set when the dialog is mounted
    for (const recipe of recipes) {
      await addItemToPlan(recipe.name, pendingSlot!.dayOfWeek, pendingSlot!.mealType, recipe.url, recipe.id);
    }
    setPendingSlot(null);
    // Trigger background combine so Groceries tab is ready when the user switches to it
    pendingBackgroundCombineRef.current = true;
  };

  const handleAddManualMeal = async (name: string, text: string) => {
    const recipeId = await addItemToPlan(name, pendingSlot!.dayOfWeek, pendingSlot!.mealType);
    if (recipeId && text.trim()) {
      setPendingParseRecipeId(recipeId);
      setPendingParseName(name);
      setPendingParseText(text);
      setParseStatus("parsing");
    }
    setPendingSlot(null);
  };

  const closeAddMealDialog = () => {
    setShowAddMealDialog(false);
    setPendingSlot(null);
  };

  const addItemToPlan = async (name: string, dayOfWeek: number, mealType: string, url?: string, recipeId?: string): Promise<string | undefined> => {
    if (!planId) return undefined;

    try {
      let linkedRecipeId = recipeId;

      // For custom meals, create a recipe record so it appears in "My Recipes"
      if (!linkedRecipeId) {
        const { data: newRecipe, error: recipeError } = await supabase
          .from("recipes")
          .insert({
            name,
            url: url || null,
            created_by: userId,
            event_id: null,
            ingredient_id: null,
          })
          .select("id")
          .single();

        if (recipeError) throw recipeError;
        linkedRecipeId = newRecipe.id;
      }

      // Calculate sort_order: max existing sort_order for this slot + 1
      const existingInSlot = items.filter(
        (i) => i.dayOfWeek === dayOfWeek && i.mealType === mealType
      );
      const maxSortOrder = existingInSlot.reduce(
        (max, i) => Math.max(max, i.sortOrder ?? 0),
        -1
      );
      const nextSortOrder = maxSortOrder + 1;

      const { data, error } = await supabase
        .from("meal_plan_items")
        .insert({
          plan_id: planId,
          day_of_week: dayOfWeek,
          meal_type: mealType,
          recipe_id: linkedRecipeId,
          sort_order: nextSortOrder,
        })
        .select("*, recipes (name, url)")
        .single();

      if (error) throw error;

      const recipe = data.recipes as unknown as { name: string; url: string | null } | null;
      const newItem: MealPlanItem = {
        id: data.id,
        planId: data.plan_id,
        recipeId: data.recipe_id || undefined,
        dayOfWeek: data.day_of_week,
        mealType: data.meal_type as MealPlanItem["mealType"],
        customName: data.custom_name || undefined,
        customUrl: data.custom_url || undefined,
        sortOrder: data.sort_order,
        recipeName: recipe?.name,
        recipeUrl: recipe?.url || undefined,
      };

      setItems((prev) => [...prev, newItem]);
      groceryDirtyRef.current = true;
      return linkedRecipeId;
    } catch (error) {
      console.error("Error adding meal:", error);
      toast.error("Failed to add meal");
      return undefined;
    }
  };

  const handleViewMealEvent = async (dayOfWeek: number, mealType: string) => {
    const slotItems = items.filter(
      (i) => i.dayOfWeek === dayOfWeek && i.mealType === mealType
    );

    // Check if any item already has an event linked
    const existingEventId = slotItems.find((i) => i.eventId)?.eventId;
    if (existingEventId) {
      navigate(`/meals/${existingEventId}`);
      return;
    }

    // Create a personal event for this meal slot
    try {
      const wsd = userPreferences?.weekStartDay ?? 0;
      const dayOffset = (dayOfWeek - wsd + 7) % 7;
      const slotDate = new Date(weekStart);
      slotDate.setDate(slotDate.getDate() + dayOffset);
      const dateStr = slotDate.toISOString().split("T")[0];

      const insertPayload = {
        event_date: dateStr,
        status: "scheduled",
        type: "personal",
        created_by: userId,
      };
      const { data: newEvent, error } = await supabase
        .from("scheduled_events")
        // type column added by migration; cast to satisfy generated types
        .insert(insertPayload as typeof insertPayload & { event_date: string })
        .select("id")
        .single();

      if (error) throw error;

      // Link meal_plan_items to this event
      const itemIds = slotItems.map((i) => i.id);
      const updatePayload = { event_id: newEvent.id };
      await supabase
        .from("meal_plan_items")
        // event_id column added by migration; cast to satisfy generated types
        .update(updatePayload as typeof updatePayload & { plan_id?: string })
        .in("id", itemIds);

      // Update local state
      setItems((prev) =>
        prev.map((item) =>
          itemIds.includes(item.id) ? { ...item, eventId: newEvent.id } : item
        )
      );

      navigate(`/meals/${newEvent.id}`);
    } catch (error) {
      console.error("Error creating meal event:", error);
      toast.error("Failed to open meal details");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          <button
            onClick={() => setViewTab("plan")}
            className={`px-3 py-2.5 sm:py-1.5 text-sm rounded-md transition-colors ${
              viewTab === "plan"
                ? "bg-white shadow-sm font-medium"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Meal Plan
          </button>
          <button
            onClick={() => setViewTab("groceries")}
            className={`px-3 py-2.5 sm:py-1.5 text-sm rounded-md transition-colors flex items-center gap-1.5 ${
              viewTab === "groceries"
                ? "bg-white shadow-sm font-medium"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ShoppingCart className="h-3.5 w-3.5" />
            Groceries
          </button>
          <button
            onClick={() => setViewTab("pantry")}
            className={`px-3 py-2.5 sm:py-1.5 text-sm rounded-md transition-colors flex items-center gap-1.5 ${
              viewTab === "pantry"
                ? "bg-white shadow-sm font-medium"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <UtensilsCrossed className="h-3.5 w-3.5" />
            Pantry
          </button>
        </div>
      </div>

      <WeekNavigation
        weekStart={weekStart}
        onPreviousWeek={handlePreviousWeek}
        onNextWeek={handleNextWeek}
        onCurrentWeek={handleCurrentWeek}
        weekStartDay={userPreferences?.weekStartDay}
      />

      {viewTab === "plan" && (
        <>
          <MealPlanGrid
            items={items}
            weekStart={weekStart}
            onAddMeal={handleAddMeal}
            onViewMealEvent={handleViewMealEvent}
            mealTypes={userPreferences?.mealTypes}
            weekStartDay={userPreferences?.weekStartDay}
          />

          {pendingSlot && (
            <AddMealDialog
              open={showAddMealDialog}
              onOpenChange={() => closeAddMealDialog()}
              dayOfWeek={pendingSlot.dayOfWeek}
              mealType={pendingSlot.mealType}
              onAddCustomMeal={handleAddCustomMeal}
              onAddRecipeMeal={handleAddRecipeMeal}
              onAddManualMeal={handleAddManualMeal}
            />
          )}
        </>
      )}

      {viewTab === "groceries" && (
        <GroceryListSection
          recipes={groceryRecipes}
          recipeIngredients={recipeIngredients}
          recipeContentMap={recipeContentMap}
          onParseRecipe={handleParseRecipe}
          eventName={getWeekLabel(weekStart)}
          isLoading={isLoadingGroceries}
          pantryItems={pantryItems}
          smartGroceryItems={smartGroceryItems}
          isCombining={isCombining}
          combineError={combineError}
          perRecipeItems={perRecipeItems}
          checkedItems={checkedItems}
          onToggleChecked={handleToggleChecked}
          generalItems={generalItems}
          onAddGeneralItemDirect={handleAddGeneralItemDirect}
          onRemoveGeneralItem={handleRemoveGeneralItem}
          onUpdateGeneralItem={handleUpdateGeneralItem}
          onBulkParseGroceryText={handleBulkParseGroceryText}
          onEditItemText={handleEditGroceryItem}
          onRemoveItem={handleRemoveGroceryItem}
          hasPendingChanges={hasPendingGroceryChanges}
          onRecombine={triggerRecombine}
          isAddingGeneral={isAddingGeneral}
          onAddingGeneralChange={setIsAddingGeneral}
        />
      )}

      {viewTab === "pantry" && (
        <PantrySection userId={userId} onPantryChange={loadPantryItems} />
      )}

      {/* Parse progress dialog */}
      <Dialog open={parseStatus === "parsing" || parseStatus === "failed"} onOpenChange={() => {
        if (parseStatus === "failed") {
          handleParseKeep();
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {parseStatus === "failed" ? "Parsing Failed" : "Adding Recipe"}
            </DialogTitle>
            <DialogDescription>
              {parseStatus === "failed"
                ? `Failed to parse ingredients for "${pendingParseName}".`
                : `Extracting ingredients from "${pendingParseName}"...`}
            </DialogDescription>
          </DialogHeader>
          {parseStatus === "parsing" && (
            <RecipeParseProgress
              steps={[
                { key: "saving", label: "Adding recipe" },
                { key: "parsing", label: "Parsing ingredients & instructions" },
                { key: "loading", label: "Loading recipe data" },
              ]}
              currentStep={parseStep}
            />
          )}
          {parseStatus === "failed" && (
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={handleParseKeep}>
                Keep Recipe Anyway
              </Button>
              <Button onClick={handleParseRetry}>
                Try Again
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MealPlanPage;
