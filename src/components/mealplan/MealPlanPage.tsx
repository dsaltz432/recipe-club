import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ShoppingCart, UtensilsCrossed, LayoutGrid } from "lucide-react";
import ParseProgressDialog from "./ParseProgressDialog";
import WeekNavigation from "./WeekNavigation";
import MealPlanGrid from "./MealPlanGrid";
import AddMealDialog from "./AddMealDialog";
import GroceryListSection from "@/components/recipes/GroceryListSection";
import PantrySection from "@/components/pantry/PantrySection";
import { loadUserPreferences } from "@/lib/userPreferences";
import { useGroceryList } from "@/hooks/useGroceryList";
import { useRecipeParse } from "@/hooks/useRecipeParse";
import type { MealPlanItem, UserPreferences } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";

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
  const { refreshGroceries } = grocery;

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
        refreshGroceries();
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
        refreshGroceries();
      }
    } catch (error) {
      console.error("Error loading meal plan:", error);
      toast.error("Failed to load meal plan");
    } finally {
      setIsLoading(false);
    }
  }, [userId, weekStart, refreshGroceries]);

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

  const {
    parseStatus,
    parseStep,
    pendingParseName,
    startParse,
    handleRetry: handleParseRetry,
    handleKeep: handleParseKeep,
    handleDiscard: handleParseDiscard,
  } = useRecipeParse({
    onSuccess: refreshGroceries,
    onBeforeDiscard: async (recipeId) => {
      await supabase.from("meal_plan_items").delete().eq("recipe_id", recipeId);
    },
    onDiscard: loadPlan,
  });

  const handleAddMeal = (dayOfWeek: number, mealType: string) => {
    setPendingSlot({ dayOfWeek, mealType });
    setShowAddMealDialog(true);
  };

  const handleAddCustomMeal = async (name: string, url?: string, shouldParse?: boolean) => {
    // pendingSlot is always set when the dialog is mounted
    const recipeId = await addItemToPlan(name, pendingSlot!.dayOfWeek, pendingSlot!.mealType, url);
    if (shouldParse && recipeId && url) {
      startParse(recipeId, name, { url });
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
      startParse(recipeId, name, { text });
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
      refreshGroceries();
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
      <div className="space-y-4">
        <div className="grid grid-cols-7 gap-2">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <Skeleton key={day} className="h-6 w-full" />
          ))}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 14 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 mb-1">
        <WeekNavigation
          weekStart={weekStart}
          onPreviousWeek={handlePreviousWeek}
          onNextWeek={handleNextWeek}
          onCurrentWeek={handleCurrentWeek}
          weekStartDay={userPreferences?.weekStartDay}
        />
        <div className="flex gap-1 bg-muted rounded-lg p-1 shrink-0">
          <button
            onClick={() => setViewTab("plan")}
            className={`px-2 sm:px-3 py-1 text-sm rounded-md transition-colors flex items-center gap-1.5 ${
              viewTab === "plan"
                ? "bg-white shadow-sm font-medium"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Plan</span>
          </button>
          <button
            onClick={() => setViewTab("groceries")}
            className={`px-2 sm:px-3 py-1 text-sm rounded-md transition-colors flex items-center gap-1.5 ${
              viewTab === "groceries"
                ? "bg-white shadow-sm font-medium"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ShoppingCart className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Groceries</span>
          </button>
          <button
            onClick={() => setViewTab("pantry")}
            className={`px-2 sm:px-3 py-1 text-sm rounded-md transition-colors flex items-center gap-1.5 ${
              viewTab === "pantry"
                ? "bg-white shadow-sm font-medium"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <UtensilsCrossed className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Pantry</span>
          </button>
        </div>
      </div>

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
        <PantrySection userId={userId} onPantryChange={refreshGroceries} />
      )}

      {/* Parse progress dialog */}
      <ParseProgressDialog
        parseStatus={parseStatus}
        parseStep={parseStep}
        recipeName={pendingParseName}
        onDiscard={handleParseDiscard}
        onKeep={handleParseKeep}
        onRetry={handleParseRetry}
      />
    </div>
  );
};

export default MealPlanPage;
