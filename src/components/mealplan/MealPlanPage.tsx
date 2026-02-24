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
import { smartCombineIngredients } from "@/lib/groceryList";
import { loadGroceryCache, saveGroceryCache } from "@/lib/groceryCache";
import type { MealPlanItem, Recipe, RecipeIngredient, RecipeContent, SmartGroceryItem } from "@/types";

interface MealPlanPageProps {
  userId: string;
}

const getWeekStart = (date: Date): Date => {
  const d = new Date(date);
  const dayOfWeek = d.getDay();
  d.setDate(d.getDate() - dayOfWeek);
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
  const [parseStep, setParseStep] = useState<"saving" | "parsing" | "loading" | "combining" | "done">("saving");
  const [showCombineStep, setShowCombineStep] = useState(false);

  // Smart grocery combine state
  const [smartGroceryItems, setSmartGroceryItems] = useState<SmartGroceryItem[] | null>(null);
  const [isCombining, setIsCombining] = useState(false);
  const lastCombinedRecipeIds = useRef<string[]>([]);
  const viewTabRef = useRef(viewTab);
  viewTabRef.current = viewTab;
  const groceryDirtyRef = useRef(true);

  const navigate = useNavigate();

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
    setWeekStart(getWeekStart(new Date()));
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
    currentRecipes: Recipe[]
  ) => {
    const parsedRecipes = currentRecipes.filter((r) => currentContentMap[r.id]?.status === "completed");
    if (parsedRecipes.length < 2) {
      setSmartGroceryItems(null);
      return;
    }

    const sortedRecipeIds = parsedRecipes.map((r) => r.id).sort();
    if (
      sortedRecipeIds.length === lastCombinedRecipeIds.current.length &&
      sortedRecipeIds.every((id, i) => id === lastCombinedRecipeIds.current[i])
    ) {
      return; // Same recipes, skip re-combine
    }

    setIsCombining(true);
    try {
      const recipeNameMap: Record<string, string> = {};
      for (const r of currentRecipes) {
        recipeNameMap[r.id] = r.name;
      }
      const result = await smartCombineIngredients(currentIngredients, recipeNameMap);
      setSmartGroceryItems(result);
      lastCombinedRecipeIds.current = sortedRecipeIds;

      // Persist to cache
      if (result) {
        const weekStartStr = weekStart.toISOString().split("T")[0];
        saveGroceryCache("meal_plan", weekStartStr, userId, result, sortedRecipeIds);
      }
    } catch {
      setSmartGroceryItems(null);
    } finally {
      setIsCombining(false);
    }
  }, [weekStart, userId]);

  useEffect(() => {
    if (viewTab !== "groceries") return;
    if (!groceryDirtyRef.current) return;
    groceryDirtyRef.current = false;
    loadGroceryData().then(async (groceryData) => {
      if (!groceryData) return;
      // Check cache before running AI combine
      const weekStartStr = weekStart.toISOString().split("T")[0];
      const cached = await loadGroceryCache("meal_plan", weekStartStr, userId);
      if (cached) {
        const currentParsedIds = groceryData.recipes
          .filter((r) => groceryData.contentMap[r.id]?.status === "completed")
          .map((r) => r.id)
          .sort();
        const cachedIds = [...cached.recipeIds].sort();
        if (
          currentParsedIds.length === cachedIds.length &&
          currentParsedIds.every((id, i) => id === cachedIds[i])
        ) {
          setSmartGroceryItems(cached.items);
          lastCombinedRecipeIds.current = cachedIds;
          return;
        }
      }
      // Cache miss or stale — run smart combine
      runSmartCombine(groceryData.ingredients, groceryData.contentMap, groceryData.recipes);
    });
    loadPantryItems();
  }, [viewTab, loadGroceryData, loadPantryItems, weekStart, userId, runSmartCombine]);

  // Execute parse when parseStatus transitions to "parsing"
  useEffect(() => {
    if (parseStatus !== "parsing" || !pendingParseRecipeId) return;

    const doParse = async () => {
      try {
        // Calculate whether to show combine step using current items state
        const recipesWithUrls = items.filter(i => i.recipeId && (i.recipeUrl || i.customUrl));
        const shouldCombine = recipesWithUrls.length >= 2;
        setShowCombineStep(shouldCombine);

        setParseStep("saving");
        await new Promise(resolve => setTimeout(resolve, 200));

        setParseStep("parsing");
        const recipe = items.find((i) => i.recipeId === pendingParseRecipeId);
        const { data: parseData, error } = await supabase.functions.invoke("parse-recipe", {
          body: {
            recipeId: pendingParseRecipeId,
            recipeUrl: recipe?.recipeUrl || recipe?.customUrl,
            recipeName: pendingParseName,
          },
        });
        if (error) throw error;
        if (!parseData?.success) throw new Error(parseData?.error ?? "Failed to parse recipe");

        setParseStep("loading");
        // Always load grocery data after parse so we can combine
        const groceryData = await loadGroceryData();

        if (shouldCombine && groceryData) {
          setParseStep("combining");
          await runSmartCombine(groceryData.ingredients, groceryData.contentMap, groceryData.recipes);
          await new Promise(resolve => setTimeout(resolve, 200));
        }

        setParseStep("done");
        await new Promise(resolve => setTimeout(resolve, 2500));

        setParseStatus("idle");
        setPendingParseRecipeId(null);
        setPendingParseName("");
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
      const slotDate = new Date(weekStart);
      slotDate.setDate(slotDate.getDate() + dayOfWeek);
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
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-bold">Meals</h2>
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          <button
            onClick={() => setViewTab("plan")}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              viewTab === "plan"
                ? "bg-white shadow-sm font-medium"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Meal Plan
          </button>
          <button
            onClick={() => setViewTab("groceries")}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors flex items-center gap-1.5 ${
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
            className={`px-3 py-1.5 text-sm rounded-md transition-colors flex items-center gap-1.5 ${
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
      />

      {viewTab === "plan" && (
        <>
          <MealPlanGrid
            items={items}
            weekStart={weekStart}
            onAddMeal={handleAddMeal}
            onViewMealEvent={handleViewMealEvent}
          />

          {pendingSlot && (
            <AddMealDialog
              open={showAddMealDialog}
              onOpenChange={() => closeAddMealDialog()}
              dayOfWeek={pendingSlot.dayOfWeek}
              mealType={pendingSlot.mealType}
              onAddCustomMeal={handleAddCustomMeal}
              onAddRecipeMeal={handleAddRecipeMeal}
            />
          )}
        </>
      )}

      {viewTab === "groceries" && (
        <>
          {items.some((i) => i.recipeId && (i.recipeUrl || i.customUrl)) ? (
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
            />
          ) : items.length > 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <UtensilsCrossed className="h-8 w-8 text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-sm">
                Your planned meals don&apos;t have linked recipes. Add a recipe URL to see ingredients here.
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ShoppingCart className="h-8 w-8 text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-sm">
                No meals planned this week. Add meals to see a grocery list.
              </p>
            </div>
          )}
        </>
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
                ...(showCombineStep ? [{ key: "combining", label: "Combining with other recipes" }] : []),
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
