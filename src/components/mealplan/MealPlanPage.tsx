import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Settings, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { isDevMode } from "@/lib/devMode";
import WeekNavigation from "./WeekNavigation";
import MealPlanGrid from "./MealPlanGrid";
import AISuggestionPanel from "./AISuggestionPanel";
import AIChatPanel from "./AIChatPanel";
import PreferencesDialog from "./PreferencesDialog";
import AddMealDialog from "./AddMealDialog";
import type { MealPlanItem, MealSuggestion, UserPreferences } from "@/types";

interface MealPlanPageProps {
  userId: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const getWeekStart = (date: Date): Date => {
  const d = new Date(date);
  const dayOfWeek = d.getDay();
  d.setDate(d.getDate() - dayOfWeek);
  d.setHours(0, 0, 0, 0);
  return d;
};

const MealPlanPage = ({ userId }: MealPlanPageProps) => {
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [planId, setPlanId] = useState<string | null>(null);
  const [items, setItems] = useState<MealPlanItem[]>([]);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [suggestions, setSuggestions] = useState<MealSuggestion[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingSlot, setPendingSlot] = useState<{ dayOfWeek: number; mealType: string } | null>(null);
  const [showAddMealDialog, setShowAddMealDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<MealPlanItem | null>(null);

  const loadPreferences = useCallback(async () => {
    const { data } = await supabase
      .from("user_preferences")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (data) {
      setPreferences({
        id: data.id,
        userId: data.user_id,
        dietaryRestrictions: data.dietary_restrictions,
        cuisinePreferences: data.cuisine_preferences,
        dislikedIngredients: data.disliked_ingredients,
        householdSize: data.household_size,
        cookingSkill: data.cooking_skill as "beginner" | "intermediate" | "advanced",
        maxCookTimeMinutes: data.max_cook_time_minutes,
        updatedAt: data.updated_at,
      });
    }
  }, [userId]);

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
    loadPreferences();
  }, [loadPreferences]);

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

  const handleAddMeal = (dayOfWeek: number, mealType: string) => {
    setPendingSlot({ dayOfWeek, mealType });
    setShowAddMealDialog(true);
  };

  const handleEditMeal = (item: MealPlanItem) => {
    setEditingItem(item);
    setPendingSlot({ dayOfWeek: item.dayOfWeek, mealType: item.mealType });
    setShowAddMealDialog(true);
  };

  const handleAddCustomMeal = async (name: string, url?: string) => {
    if (editingItem) {
      await handleRemoveMeal(editingItem.id);
      setEditingItem(null);
    }
    // pendingSlot is always set when the dialog is mounted
    addItemToPlan(name, pendingSlot!.dayOfWeek, pendingSlot!.mealType, url);
    setPendingSlot(null);
  };

  const handleAddRecipeMeal = async (recipes: Array<{ id: string; name: string; url?: string }>) => {
    if (editingItem) {
      await handleRemoveMeal(editingItem.id);
      setEditingItem(null);
    }
    // pendingSlot is always set when the dialog is mounted
    for (const recipe of recipes) {
      addItemToPlan(recipe.name, pendingSlot!.dayOfWeek, pendingSlot!.mealType, recipe.url, recipe.id);
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

  const addItemToPlan = async (name: string, dayOfWeek: number, mealType: string, url?: string, recipeId?: string) => {
    if (!planId) return;

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

      const { data, error } = await supabase
        .from("meal_plan_items")
        .insert({
          plan_id: planId,
          day_of_week: dayOfWeek,
          meal_type: mealType,
          recipe_id: linkedRecipeId,
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
    } catch (error) {
      console.error("Error adding meal:", error);
      toast.error("Failed to add meal");
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

  const handleAddSuggestionToPlan = (suggestion: MealSuggestion) => {
    // Add to next available dinner slot
    const usedSlots = new Set(
      items
        .filter((i) => i.mealType === "dinner")
        .map((i) => i.dayOfWeek)
    );
    const nextDay = Array.from({ length: 7 }, (_, i) => i).find(
      (d) => !usedSlots.has(d)
    );
    if (nextDay !== undefined) {
      addItemToPlan(suggestion.name, nextDay, "dinner", suggestion.url, suggestion.recipeId);
    } else {
      toast.error("All dinner slots are filled. Click an empty slot first.");
    }
  };

  const handleGetSuggestions = async (chatMessage?: string) => {
    setIsLoadingSuggestions(true);
    try {
      const prefs = preferences || {
        dietaryRestrictions: [],
        cuisinePreferences: [],
        dislikedIngredients: [],
        householdSize: 2,
        cookingSkill: "intermediate",
        maxCookTimeMinutes: 60,
      };

      const currentPlanItems = items.map((item) => ({
        dayOfWeek: item.dayOfWeek,
        mealType: item.mealType,
        name: item.recipeName || item.customName || "Unknown",
      }));

      if (isDevMode()) {
        // Mock suggestions in dev mode
        const mockSuggestions: MealSuggestion[] = [
          {
            id: `mock-${Date.now()}-1`,
            name: "Mediterranean Quinoa Bowl",
            cuisine: "Mediterranean",
            timeEstimate: "25 min",
            reason: "Quick, healthy, and fits your preferences.",
          },
          {
            id: `mock-${Date.now()}-2`,
            name: "Honey Garlic Salmon",
            cuisine: "Asian Fusion",
            timeEstimate: "30 min",
            reason: "A crowd favorite that's easy to prepare.",
          },
          {
            id: `mock-${Date.now()}-3`,
            name: "One-Pot Pasta Primavera",
            cuisine: "Italian",
            timeEstimate: "20 min",
            reason: "Minimal cleanup with fresh vegetables.",
          },
        ];
        setSuggestions(mockSuggestions);

        if (chatMessage) {
          setChatMessages((prev) => [
            ...prev,
            { role: "assistant", content: "Here are some suggestions based on your request! (Dev mode - using mock data)" },
          ]);
        }
      } else {
        const { data, error } = await supabase.functions.invoke("generate-meal-suggestions", {
          body: {
            userId,
            preferences: prefs,
            currentPlanItems,
            chatMessage,
          },
        });

        if (error) throw error;
        if (!data?.success) throw new Error(data?.error || "Failed to generate suggestions");

        setSuggestions(data.suggestions || []);

        if (chatMessage && data.chatResponse) {
          setChatMessages((prev) => [
            ...prev,
            { role: "assistant", content: data.chatResponse },
          ]);
        }
      }
    } catch (error) {
      console.error("Error getting suggestions:", error);
      toast.error("Failed to get suggestions");
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  const handleChatMessage = (message: string) => {
    setChatMessages((prev) => [...prev, { role: "user", content: message }]);
    handleGetSuggestions(message);
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
        <h2 className="font-display text-xl font-bold">Meal Plan</h2>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPreferences(true)}
          >
            <Settings className="h-4 w-4 mr-1" />
            Preferences
          </Button>
          <Button
            size="sm"
            onClick={() => handleGetSuggestions()}
            disabled={isLoadingSuggestions}
            className="bg-purple hover:bg-purple-dark"
          >
            <Sparkles className="h-4 w-4 mr-1" />
            Get Suggestions
          </Button>
        </div>
      </div>

      <WeekNavigation
        weekStart={weekStart}
        onPreviousWeek={handlePreviousWeek}
        onNextWeek={handleNextWeek}
        onCurrentWeek={handleCurrentWeek}
      />

      <MealPlanGrid
        items={items}
        weekStart={weekStart}
        onAddMeal={handleAddMeal}
        onRemoveMeal={handleRemoveMeal}
        onEditMeal={handleEditMeal}
        onViewMealEvent={handleViewMealEvent}
      />

      <div className="grid md:grid-cols-2 gap-4">
        <AISuggestionPanel
          suggestions={suggestions}
          onAddToPlan={handleAddSuggestionToPlan}
          isLoading={isLoadingSuggestions}
        />
        <AIChatPanel
          messages={chatMessages}
          onSendMessage={handleChatMessage}
          isLoading={isLoadingSuggestions}
        />
      </div>

      <PreferencesDialog
        open={showPreferences}
        onOpenChange={setShowPreferences}
        userId={userId}
        preferences={preferences}
        onSaved={setPreferences}
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
        />
      )}
    </div>
  );
};

export default MealPlanPage;
