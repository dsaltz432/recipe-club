import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ShoppingCart, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import WeekNavigation from "./WeekNavigation";
import MealPlanGrid from "./MealPlanGrid";
import AddMealDialog from "./AddMealDialog";
import GroceryListSection from "@/components/recipes/GroceryListSection";
import PantryDialog from "@/components/pantry/PantryDialog";
import EventRatingDialog from "@/components/events/EventRatingDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { getPantryItems, ensureDefaultPantryItems } from "@/lib/pantry";
import type { MealPlanItem, Recipe, RecipeIngredient, RecipeContent, EventRecipeWithNotes } from "@/types";

interface MealPlanPageProps {
  userId: string;
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const mealTypeLabels: Record<string, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

const getWeekStart = (date: Date): Date => {
  const d = new Date(date);
  const dayOfWeek = d.getDay();
  d.setDate(d.getDate() - dayOfWeek);
  d.setHours(0, 0, 0, 0);
  return d;
};

interface RatingSlotData {
  dayOfWeek: number;
  mealType: string;
  eventId: string;
  eventDate: string;
  recipes: EventRecipeWithNotes[];
}

const MealPlanPage = ({ userId }: MealPlanPageProps) => {
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [planId, setPlanId] = useState<string | null>(null);
  const [items, setItems] = useState<MealPlanItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingSlot, setPendingSlot] = useState<{ dayOfWeek: number; mealType: string } | null>(null);
  const [showAddMealDialog, setShowAddMealDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<MealPlanItem | null>(null);
  const [viewTab, setViewTab] = useState<"plan" | "groceries">("plan");
  const [groceryRecipes, setGroceryRecipes] = useState<Recipe[]>([]);
  const [recipeIngredients, setRecipeIngredients] = useState<RecipeIngredient[]>([]);
  const [recipeContentMap, setRecipeContentMap] = useState<Record<string, RecipeContent>>({});
  const [pantryItems, setPantryItems] = useState<string[]>([]);
  const [isLoadingGroceries, setIsLoadingGroceries] = useState(false);
  const [ratingDialogOpen, setRatingDialogOpen] = useState(false);
  const [selectedSlotForRating, setSelectedSlotForRating] = useState<RatingSlotData | null>(null);
  const [uncookConfirmSlot, setUncookConfirmSlot] = useState<{ dayOfWeek: number; mealType: string } | null>(null);
  const [showPantryDialog, setShowPantryDialog] = useState(false);

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

  const loadGroceryData = useCallback(async () => {
    const recipeIds = items
      .map((i) => i.recipeId)
      .filter((id): id is string => !!id);

    if (recipeIds.length === 0) {
      setGroceryRecipes([]);
      setRecipeIngredients([]);
      setRecipeContentMap({});
      return;
    }

    setIsLoadingGroceries(true);
    try {
      const [ingredientsResult, contentResult, recipesResult] = await Promise.all([
        supabase.from("recipe_ingredients").select("*").in("recipe_id", recipeIds),
        supabase.from("recipe_content").select("*").in("recipe_id", recipeIds),
        supabase.from("recipes").select("id, name, url").in("id", recipeIds),
      ]);

      if (ingredientsResult.data) {
        setRecipeIngredients(
          ingredientsResult.data.map((row) => ({
            id: row.id,
            recipeId: row.recipe_id,
            name: row.name,
            quantity: row.quantity ?? undefined,
            unit: row.unit ?? undefined,
            category: row.category as RecipeIngredient["category"],
            rawText: row.raw_text ?? undefined,
            sortOrder: row.sort_order ?? undefined,
            createdAt: row.created_at,
          }))
        );
      }

      if (contentResult.data) {
        const contentMap: Record<string, RecipeContent> = {};
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

      if (recipesResult.data) {
        setGroceryRecipes(
          recipesResult.data.map((r) => ({
            id: r.id,
            name: r.name,
            url: r.url ?? undefined,
          }))
        );
      }
    } catch (error) {
      console.error("Error loading grocery data:", error);
      toast.error("Failed to load grocery list");
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

  useEffect(() => {
    if (viewTab === "groceries") {
      loadGroceryData();
      loadPantryItems();
    }
  }, [viewTab, loadGroceryData, loadPantryItems]);

  const handleParseRecipe = async (recipeId: string) => {
    const recipe = groceryRecipes.find((r) => r.id === recipeId);
    try {
      const { error } = await supabase.functions.invoke("parse-recipe", {
        body: { recipeId, recipeUrl: recipe?.url, recipeName: recipe?.name },
      });

      if (error) throw error;
      toast.success("Recipe parsed successfully!");
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

  const handleEditMeal = (item: MealPlanItem) => {
    setEditingItem(item);
    setPendingSlot({ dayOfWeek: item.dayOfWeek, mealType: item.mealType });
    setShowAddMealDialog(true);
  };

  const handleAddCustomMeal = async (name: string, url?: string, shouldParse?: boolean) => {
    if (editingItem) {
      // Update the existing item in place instead of delete+insert to preserve cooked_at
      try {
        // If the existing item has a recipeId, update that recipe; otherwise create a new one
        let linkedRecipeId = editingItem.recipeId;
        if (linkedRecipeId) {
          // Update the existing linked recipe
          await supabase
            .from("recipes")
            .update({ name, url: url || null })
            .eq("id", linkedRecipeId);
        } else {
          // Create a new recipe record
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

        const updatePayload = {
          recipe_id: linkedRecipeId,
          custom_name: null as string | null,
          custom_url: null as string | null,
        };
        const { error } = await supabase
          .from("meal_plan_items")
          .update(updatePayload as typeof updatePayload & { plan_id?: string })
          .eq("id", editingItem.id);

        if (error) throw error;

        setItems((prev) =>
          prev.map((item) =>
            item.id === editingItem.id
              ? { ...item, recipeId: linkedRecipeId, recipeName: name, recipeUrl: url, customName: undefined, customUrl: undefined }
              : item
          )
        );
        toast.success(`Updated meal to "${name}"`);

        if (shouldParse && linkedRecipeId && url) {
          try {
            const { error: parseError } = await supabase.functions.invoke("parse-recipe", {
              body: { recipeId: linkedRecipeId, recipeUrl: url, recipeName: name },
            });
            if (parseError) throw parseError;
            toast.success("Recipe is being parsed!");
          } catch (parseErr) {
            console.error("Error parsing recipe:", parseErr);
            toast.error("Failed to parse recipe");
          }
        }
      } catch (error) {
        console.error("Error updating meal:", error);
        toast.error("Failed to update meal");
      }
      setEditingItem(null);
      setPendingSlot(null);
      return;
    }
    // pendingSlot is always set when the dialog is mounted
    const recipeId = await addItemToPlan(name, pendingSlot!.dayOfWeek, pendingSlot!.mealType, url);
    if (shouldParse && recipeId && url) {
      try {
        const { error } = await supabase.functions.invoke("parse-recipe", {
          body: { recipeId, recipeUrl: url, recipeName: name },
        });
        if (error) throw error;
        toast.success("Recipe is being parsed!");
      } catch (error) {
        console.error("Error parsing recipe:", error);
        toast.error("Failed to parse recipe");
      }
    }
    setPendingSlot(null);
  };

  const handleAddRecipeMeal = async (recipes: Array<{ id: string; name: string; url?: string }>) => {
    if (editingItem) {
      // When editing, update the existing item in place instead of delete+insert
      // AddMealDialog always validates at least one recipe is selected
      const firstRecipe = recipes[0]!;
      try {
        const updatePayload = {
          recipe_id: firstRecipe.id,
          custom_name: null as string | null,
          custom_url: null as string | null,
        };
        const { error } = await supabase
          .from("meal_plan_items")
          .update(updatePayload as typeof updatePayload & { plan_id?: string })
          .eq("id", editingItem.id);

        if (error) throw error;

        setItems((prev) =>
          prev.map((item) =>
            item.id === editingItem.id
              ? { ...item, recipeId: firstRecipe.id, recipeName: firstRecipe.name, recipeUrl: firstRecipe.url, customName: undefined, customUrl: undefined }
              : item
          )
        );
        toast.success(`Updated meal to "${firstRecipe.name}"`);
      } catch (error) {
        console.error("Error updating meal:", error);
        toast.error("Failed to update meal");
      }
      setEditingItem(null);
      setPendingSlot(null);
      return;
    }
    // pendingSlot is always set when the dialog is mounted
    for (const recipe of recipes) {
      await addItemToPlan(recipe.name, pendingSlot!.dayOfWeek, pendingSlot!.mealType, recipe.url, recipe.id);
    }
    setPendingSlot(null);
  };

  const closeAddMealDialog = () => {
    setShowAddMealDialog(false);
    setPendingSlot(null);
    setEditingItem(null);
  };

  const handleRemoveMeal = async (itemId: string) => {
    try {
      const { error } = await supabase
        .from("meal_plan_items")
        .delete()
        .eq("id", itemId);

      if (error) throw error;

      setItems((prev) => prev.filter((item) => item.id !== itemId));
      toast.success("Meal removed");
    } catch (error) {
      console.error("Error removing meal:", error);
      toast.error("Failed to remove meal");
    }
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
      toast.success(`Added "${name}" to plan`);
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

  const markSlotAsCooked = async (slotItems: MealPlanItem[]) => {
    try {
      const itemIds = slotItems.map((i) => i.id);
      const updatePayload = { cooked_at: new Date().toISOString() };
      const { error } = await supabase
        .from("meal_plan_items")
        .update(updatePayload as typeof updatePayload & { plan_id?: string })
        .in("id", itemIds);

      if (error) throw error;

      const now = new Date().toISOString();
      setItems((prev) =>
        prev.map((item) =>
          itemIds.includes(item.id) ? { ...item, cookedAt: now } : item
        )
      );
      toast.success("Marked as cooked!");
    } catch (error) {
      console.error("Error marking as cooked:", error);
      toast.error("Failed to mark as cooked");
    }
  };

  const handleMarkCooked = async (dayOfWeek: number, mealType: string) => {
    const slotItems = items.filter(
      (i) => i.dayOfWeek === dayOfWeek && i.mealType === mealType
    );
    const recipesWithUrls = slotItems.filter((i) => i.recipeId && (i.recipeUrl || i.customUrl));

    if (recipesWithUrls.length === 0) {
      // No recipes with URLs to rate, just mark as cooked directly
      await markSlotAsCooked(slotItems);
      return;
    }

    // Need an event for the rating dialog
    let eventId = slotItems.find((i) => i.eventId)?.eventId;

    if (!eventId) {
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
          .insert(insertPayload as typeof insertPayload & { event_date: string })
          .select("id")
          .single();

        if (error) throw error;

        eventId = newEvent.id;

        // Link items to event
        const itemIds = slotItems.map((i) => i.id);
        const updatePayload = { event_id: eventId };
        await supabase
          .from("meal_plan_items")
          .update(updatePayload as typeof updatePayload & { plan_id?: string })
          .in("id", itemIds);

        // Update local state
        setItems((prev) =>
          prev.map((item) =>
            itemIds.includes(item.id) ? { ...item, eventId } : item
          )
        );
      } catch (error) {
        console.error("Error creating event for ratings:", error);
        toast.error("Failed to mark as cooked");
        return;
      }
    }

    const slotDate = new Date(weekStart);
    slotDate.setDate(slotDate.getDate() + dayOfWeek);

    setSelectedSlotForRating({
      dayOfWeek,
      mealType,
      eventId,
      eventDate: slotDate.toISOString().split("T")[0],
      recipes: recipesWithUrls.map((item) => ({
        recipe: {
          id: item.recipeId!,
          name: item.recipeName || item.customName || "Unnamed",
          url: item.recipeUrl || item.customUrl,
        },
        notes: [],
      })),
    });
    setRatingDialogOpen(true);
  };

  const handleRatingComplete = async () => {
    const slotItems = items.filter(
      (i) =>
        i.dayOfWeek === selectedSlotForRating!.dayOfWeek &&
        i.mealType === selectedSlotForRating!.mealType
    );

    await markSlotAsCooked(slotItems);
    setRatingDialogOpen(false);
    setSelectedSlotForRating(null);
  };

  const handleRatingCancel = () => {
    setRatingDialogOpen(false);
    setSelectedSlotForRating(null);
  };

  const handleUncook = (dayOfWeek: number, mealType: string) => {
    setUncookConfirmSlot({ dayOfWeek, mealType });
  };

  const handleConfirmUncook = async () => {
    const slot = uncookConfirmSlot!;
    setUncookConfirmSlot(null);

    const slotItems = items.filter(
      (i) => i.dayOfWeek === slot.dayOfWeek && i.mealType === slot.mealType
    );

    try {
      const itemIds = slotItems.map((i) => i.id);
      const updatePayload = { cooked_at: null as string | null };
      const { error } = await supabase
        .from("meal_plan_items")
        .update(updatePayload as typeof updatePayload & { plan_id?: string })
        .in("id", itemIds);

      if (error) throw error;

      setItems((prev) =>
        prev.map((item) =>
          itemIds.includes(item.id) ? { ...item, cookedAt: undefined } : item
        )
      );
      toast.success("Meal unmarked as cooked");
    } catch (error) {
      console.error("Error uncooking meal:", error);
      toast.error("Failed to uncook meal");
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
            onRemoveMeal={handleRemoveMeal}
            onEditMeal={handleEditMeal}
            onViewMealEvent={handleViewMealEvent}
            onMarkCooked={handleMarkCooked}
            onUncook={handleUncook}
          />

          {pendingSlot && (
            <AddMealDialog
              open={showAddMealDialog}
              onOpenChange={() => closeAddMealDialog()}
              dayOfWeek={pendingSlot.dayOfWeek}
              mealType={pendingSlot.mealType}
              onAddCustomMeal={handleAddCustomMeal}
              onAddRecipeMeal={handleAddRecipeMeal}
              editingItemName={editingItem ? (editingItem.recipeName || editingItem.customName || "Unnamed meal") : undefined}
              editingItemUrl={editingItem ? (editingItem.recipeUrl || editingItem.customUrl || "") : undefined}
            />
          )}
        </>
      )}

      {viewTab === "groceries" && (
        <>
          <div className="flex justify-end mb-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPantryDialog(true)}
              className="text-xs"
            >
              <UtensilsCrossed className="h-3.5 w-3.5 mr-1" />
              Manage Pantry
            </Button>
          </div>
          {items.some((i) => i.recipeId && (i.recipeUrl || i.customUrl)) ? (
            <GroceryListSection
              recipes={groceryRecipes}
              recipeIngredients={recipeIngredients}
              recipeContentMap={recipeContentMap}
              onParseRecipe={handleParseRecipe}
              eventName="Weekly Meal Plan"
              isLoading={isLoadingGroceries}
              pantryItems={pantryItems}
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

          <PantryDialog
            open={showPantryDialog}
            onOpenChange={setShowPantryDialog}
            userId={userId}
            onPantryChange={loadPantryItems}
          />
        </>
      )}

      {ratingDialogOpen && selectedSlotForRating && (
        <EventRatingDialog
          event={{
            eventId: selectedSlotForRating.eventId,
            eventDate: selectedSlotForRating.eventDate,
            ingredientName: `${DAY_NAMES[selectedSlotForRating.dayOfWeek]} ${mealTypeLabels[selectedSlotForRating.mealType]}`,
          }}
          recipes={selectedSlotForRating.recipes}
          userId={userId}
          onComplete={handleRatingComplete}
          onCancel={handleRatingCancel}
          mode="rating"
        />
      )}

      <AlertDialog open={!!uncookConfirmSlot} onOpenChange={() => setUncookConfirmSlot(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Undo cook?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the meal as uncooked. Ratings will be preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmUncook}>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default MealPlanPage;
