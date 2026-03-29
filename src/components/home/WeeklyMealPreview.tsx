import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { format, startOfDay, isSameDay, addDays } from "date-fns";
import { UtensilsCrossed, ArrowRight, CalendarDays } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { loadUserPreferences } from "@/lib/userPreferences";
import type { MealPlanItem } from "@/types";

interface WeeklyMealPreviewProps {
  userId: string;
}

interface DayMeals {
  date: Date;
  meals: MealPlanItem[];
}

const MEAL_TYPE_ORDER: Record<MealPlanItem["mealType"], number> = {
  breakfast: 0,
  lunch: 1,
  dinner: 2,
  snack: 3,
};

const MEAL_TYPE_LABEL: Record<MealPlanItem["mealType"], string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

function getWeekStart(date: Date, weekStartDay = 0): Date {
  const d = new Date(date);
  const dayOfWeek = d.getDay();
  const diff = weekStartDay === 1 ? (dayOfWeek + 6) % 7 : dayOfWeek;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

const WeeklyMealPreview = ({ userId }: WeeklyMealPreviewProps) => {
  const navigate = useNavigate();
  const [items, setItems] = useState<MealPlanItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [weekStartDay, setWeekStartDay] = useState(0);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const prefs = await loadUserPreferences(userId);
        const wsd = prefs.weekStartDay ?? 0;
        setWeekStartDay(wsd);

        const weekStart = getWeekStart(new Date(), wsd);
        const weekStartStr = weekStart.toISOString().split("T")[0];

        // Look up existing plan for this week (read-only, no auto-create)
        const { data: plans } = await supabase
          .from("meal_plans")
          .select("id")
          .eq("user_id", userId)
          .eq("week_start", weekStartStr)
          .order("created_at")
          .limit(1);

        const plan = plans && plans.length > 0 ? plans[0] : null;
        if (!plan) {
          setItems([]);
          return;
        }

        const { data: itemsData } = await supabase
          .from("meal_plan_items")
          .select("*, recipes (name)")
          .eq("plan_id", plan.id)
          .order("sort_order");

        const mapped: MealPlanItem[] = (itemsData ?? []).map((item) => {
          const recipe = item.recipes as { name: string } | null;
          return {
            id: item.id,
            planId: item.plan_id,
            recipeId: item.recipe_id || undefined,
            dayOfWeek: item.day_of_week,
            mealType: item.meal_type as MealPlanItem["mealType"],
            customName: item.custom_name || undefined,
            sortOrder: item.sort_order ?? 0,
            recipeName: recipe?.name,
          };
        });

        setItems(mapped);
      } catch (err) {
        console.error("Error loading weekly meal preview:", err);
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [userId]);

  if (isLoading) {
    return (
      <Card className="bg-white/80 border-purple/10">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-4 w-20" />
          </div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-10 w-12 rounded-lg" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-3 w-40" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  // Build ordered day list for this week
  const today = startOfDay(new Date());
  const weekStart = getWeekStart(today, weekStartDay);
  const weekDays: Date[] = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Group items by day, only keep days with meals
  const dayMeals: DayMeals[] = weekDays
    .map((date) => {
      const dow = date.getDay();
      const meals = items
        .filter((item) => item.dayOfWeek === dow)
        .sort((a, b) => MEAL_TYPE_ORDER[a.mealType] - MEAL_TYPE_ORDER[b.mealType]);
      return { date, meals };
    })
    .filter(({ meals }) => meals.length > 0);

  const isEmpty = dayMeals.length === 0;

  const todayMeals = dayMeals.find(({ date }) => isSameDay(date, today));
  const otherDays = dayMeals.filter(({ date }) => !isSameDay(date, today));

  return (
    <Card className="bg-white/80 border-purple/10">
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-purple-600" />
            <span className="font-semibold text-sm text-gray-800">This Week's Meals</span>
          </div>
          <button
            onClick={() => navigate("/dashboard/meals")}
            className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 font-medium transition-colors"
          >
            View full plan
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>

        {isEmpty ? (
          /* Empty state */
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-3 py-2">
            <div className="w-9 h-9 rounded-full bg-purple/10 flex items-center justify-center shrink-0">
              <UtensilsCrossed className="h-4 w-4 text-purple-600" />
            </div>
            <div className="text-center sm:text-left">
              <p className="text-sm font-medium text-gray-700">No meals planned this week</p>
              <p className="text-xs text-muted-foreground mt-0.5">Plan your meals and generate a grocery list</p>
            </div>
            <Button
              size="sm"
              className="bg-purple hover:bg-purple-dark text-white shrink-0 sm:ml-auto"
              onClick={() => navigate("/dashboard/meals")}
            >
              Plan meals
            </Button>
          </div>
        ) : (
          <div className="space-y-1.5">
            {/* Today's meals — highlighted */}
            {todayMeals && (
              <div
                className="rounded-lg bg-purple/5 border border-purple/15 px-3 py-2 cursor-pointer hover:bg-purple/10 transition-colors"
                onClick={() => navigate("/dashboard/meals")}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xs font-semibold text-purple-700 uppercase tracking-wide">
                    Today · {format(todayMeals.date, "EEE, MMM d")}
                  </span>
                </div>
                <div className="space-y-1">
                  {todayMeals.meals.map((meal) => (
                    <MealRow key={meal.id} meal={meal} />
                  ))}
                </div>
              </div>
            )}

            {/* Rest of the week — compact */}
            {otherDays.slice(0, 4).map(({ date, meals }) => (
              <div
                key={date.toISOString()}
                className="rounded-lg px-3 py-2 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => navigate("/dashboard/meals")}
              >
                <div className="flex items-start gap-3">
                  {/* Day label */}
                  <div className="w-12 shrink-0 text-center">
                    <div className="text-[11px] font-semibold text-muted-foreground uppercase">
                      {format(date, "EEE")}
                    </div>
                    <div className="text-sm font-bold text-gray-700 tabular-nums">
                      {format(date, "d")}
                    </div>
                  </div>
                  {/* Meals for that day */}
                  <div className="flex-1 space-y-0.5 pt-0.5">
                    {meals.map((meal) => (
                      <MealRow key={meal.id} meal={meal} compact />
                    ))}
                  </div>
                </div>
              </div>
            ))}

            {/* "More days" hint */}
            {otherDays.length > 4 && (
              <p className="text-xs text-center text-muted-foreground pt-1">
                +{otherDays.length - 4} more {otherDays.length - 4 === 1 ? "day" : "days"} planned
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

interface MealRowProps {
  meal: MealPlanItem;
  compact?: boolean;
}

function MealRow({ meal, compact = false }: MealRowProps) {
  const label = meal.recipeName || meal.customName || "Untitled meal";
  const typeLabel = MEAL_TYPE_LABEL[meal.mealType];

  if (compact) {
    return (
      <p className="text-xs text-gray-700 truncate">
        <span className="text-muted-foreground">{typeLabel}:</span>{" "}
        <span className="font-medium">{label}</span>
      </p>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] font-medium text-purple-600 w-16 shrink-0">{typeLabel}</span>
      <span className="text-sm font-medium text-gray-800 truncate">{label}</span>
    </div>
  );
}

export default WeeklyMealPreview;
