import { useState, useEffect, useCallback, useMemo } from "react";
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
import { loadUserPreferences } from "@/lib/userPreferences";
import { useGroceryList } from "@/hooks/useGroceryList";
import type { MealPlanItem, UserPreferences } from "@/types";

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
  const [userPreferences, setUserPreferences] = useState<UserPreferences | null>(null);

  // Parse progress state
  const [parseStatus, setParseStatus] = useState<"idle" | "parsing" | "failed">("idle");
  const [pendingParseRecipeId, setPendingParseRecipeId] = useState<string | null>(null);
  const [pendingParseName, setPendingParseName] = useState<string>("");
  const [pendingParseText, setPendingParseText] = useState<string>("");
  const [parseStep, setParseStep] = useState<"saving" | "parsing" | "loading" | "done">("saving");

  const navigate = useNavigate();

  const recipeIds = useMemo(
    () => items.map((i) => i.recipeId).filter((id): id is string => !!id),
    [items]
  );

  const grocery = useGroceryList({
    contextType: "meal_plan",
    contextId: weekStart.toISOString().split("T")[0],
    userId,
    recipeIds,
    recipes: [],
    enabled: viewTab === "groceries",
    supportsGeneralItems: true,
  });

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
        grocery.refreshGroceries();
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
        grocery.refreshGroceries();
      }
    } catch (error) {
      console.error("Error loading meal plan:", error);
      toast.error("Failed to load meal plan");
    } finally {
      setIsLoading(false);
    }
  }, [userId, weekStart, grocery.refreshGroceries]);

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
        await new Promise(resolve => setTimeout(resolve, 500));

        setParseStep("done");
        await new Promise(resolve => setTimeout(resolve, 2500));

        setParseStatus("idle");
        setPendingParseRecipeId(null);
        setPendingParseName("");
        setPendingParseText("");
        setParseStep("saving");
        grocery.refreshGroceries();
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
    // recipeIds will change via items → useMemo → hook auto-detects and reloads
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
      grocery.refreshGroceries();
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
          recipes={grocery.groceryRecipes}
          recipeIngredients={grocery.recipeIngredients}
          recipeContentMap={grocery.recipeContentMap}
          onParseRecipe={grocery.handleParseRecipe}
          eventName={getWeekLabel(weekStart)}
          isLoading={grocery.isLoading}
          pantryItems={grocery.pantryItems}
          smartGroceryItems={grocery.smartGroceryItems}
          isCombining={grocery.isCombining}
          combineError={grocery.combineError}
          perRecipeItems={grocery.perRecipeItems}
          checkedItems={grocery.checkedItems}
          onToggleChecked={grocery.handleToggleChecked}
          generalItems={grocery.generalItems}
          onAddGeneralItemDirect={grocery.handleAddGeneralItemDirect}
          onBulkParseGroceryText={grocery.handleBulkParseGroceryText}
          onEditItemText={grocery.handleEditItemText}
          onRemoveItem={grocery.handleRemoveItem}
          hasPendingChanges={grocery.hasPendingChanges}
          onRecombine={grocery.triggerRecombine}
          isAddingGeneral={grocery.isAddingGeneral}
          onAddingGeneralChange={grocery.setIsAddingGeneral}
          onAddItemsToRecipe={grocery.handleAddItemsToRecipe}
        />
      )}

      {viewTab === "pantry" && (
        <PantrySection userId={userId} onPantryChange={grocery.refreshGroceries} />
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
