import { useState, useEffect, useCallback } from "react";
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

  const loadPlan = useCallback(async () => {
    setIsLoading(true);
    try {
      const weekStartStr = weekStart.toISOString().split("T")[0];

      // Find or create plan for this week
      const { data: existingPlan } = await supabase
        .from("meal_plans")
        .select("id")
        .eq("user_id", userId)
        .eq("week_start", weekStartStr)
        .maybeSingle();

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
          };
        });
        setItems(mapped);
      } else {
        // Create new plan
        const { data: newPlan, error } = await supabase
          .from("meal_plans")
          .insert({
            user_id: userId,
            week_start: weekStartStr,
            name: "Weekly Plan",
          })
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
      const insertData: {
        plan_id: string;
        day_of_week: number;
        meal_type: string;
        custom_name?: string;
        custom_url?: string;
        recipe_id?: string;
      } = {
        plan_id: planId,
        day_of_week: dayOfWeek,
        meal_type: mealType,
      };

      if (recipeId) {
        insertData.recipe_id = recipeId;
      } else {
        insertData.custom_name = name;
        if (url) insertData.custom_url = url;
      }

      const { data, error } = await supabase
        .from("meal_plan_items")
        .insert(insertData)
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

  const handleAddSuggestionToPlan = (suggestion: MealSuggestion) => {
    if (pendingSlot) {
      addItemToPlan(
        suggestion.name,
        pendingSlot.dayOfWeek,
        pendingSlot.mealType,
        suggestion.url,
        suggestion.recipeId
      );
      setPendingSlot(null);
    } else {
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

      {pendingSlot && (
        <div className="bg-purple/10 border border-purple/30 rounded-lg p-3 text-sm">
          Adding meal for{" "}
          <strong>
            {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][pendingSlot.dayOfWeek]}
          </strong>
          {" "}{pendingSlot.mealType}.
          Click a suggestion below or{" "}
          <button
            className="text-purple underline"
            onClick={() => setPendingSlot(null)}
          >
            cancel
          </button>.
        </div>
      )}

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
    </div>
  );
};

export default MealPlanPage;
