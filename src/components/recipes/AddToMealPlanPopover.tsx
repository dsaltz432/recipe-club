import { useState } from "react";
import { CalendarPlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { buildUpcomingDays } from "@/lib/mealPlanUtils";

interface AddToMealPlanPopoverProps {
  recipeId: string;
  recipeName: string;
  userId: string;
}

type MealType = "breakfast" | "lunch" | "dinner" | "snack";

const MEAL_TYPES: { value: MealType; label: string }[] = [
  { value: "breakfast", label: "Breakfast" },
  { value: "lunch", label: "Lunch" },
  { value: "dinner", label: "Dinner" },
  { value: "snack", label: "Snack" },
];

const AddToMealPlanPopover = ({ recipeId, recipeName, userId }: AddToMealPlanPopoverProps) => {
  const [open, setOpen] = useState(false);
  // selectedIndex: index into upcomingDays (0 = today)
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedMealType, setSelectedMealType] = useState<MealType>("dinner");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const upcomingDays = buildUpcomingDays();
  const selectedDay = upcomingDays[selectedIndex];

  const handleAdd = async () => {
    setIsSubmitting(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;

      // Find or create the meal plan for the selected day's week
      const { data: plan, error: planError } = await db
        .from("meal_plans")
        .upsert(
          { user_id: userId, week_start: selectedDay.weekStartStr, name: "Weekly Plan" },
          { onConflict: "user_id,week_start" }
        )
        .select("id")
        .single();

      if (planError) throw planError;

      // Get max sort_order for this slot so we append cleanly
      const { data: existingItems } = await db
        .from("meal_plan_items")
        .select("sort_order")
        .eq("plan_id", plan.id)
        .eq("day_of_week", selectedDay.dayOfWeek)
        .eq("meal_type", selectedMealType);

      const maxSortOrder = ((existingItems ?? []) as Array<{ sort_order: number }>).reduce(
        (max: number, item: { sort_order: number }) => Math.max(max, item.sort_order ?? 0),
        -1
      );

      const { error: itemError } = await db.from("meal_plan_items").insert({
        plan_id: plan.id,
        recipe_id: recipeId,
        day_of_week: selectedDay.dayOfWeek,
        meal_type: selectedMealType,
        sort_order: maxSortOrder + 1,
      });

      if (itemError) throw itemError;

      const mealLabel = MEAL_TYPES.find((m) => m.value === selectedMealType)?.label ?? "";
      const dayShort = selectedDay.label.split(" (")[0];
      toast.success(`Added to ${mealLabel} · ${dayShort}`);
      setOpen(false);
    } catch (err) {
      console.error("Failed to add to meal plan:", err);
      toast.error("Failed to add to meal plan. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          aria-label={`Add ${recipeName} to meal plan`}
        >
          <CalendarPlus className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="w-72 p-3 space-y-3"
        align="start"
        side="bottom"
        sideOffset={4}
      >
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Day
          </p>
          <div className="grid grid-cols-1 gap-1">
            {upcomingDays.map((day, idx) => (
              <button
                key={day.date.toISOString()}
                onClick={() => setSelectedIndex(idx)}
                className={cn(
                  "w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors",
                  selectedIndex === idx
                    ? "bg-purple-100 text-purple-800 font-medium"
                    : "hover:bg-gray-100 text-gray-700"
                )}
              >
                {day.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Meal
          </p>
          <div className="grid grid-cols-2 gap-1">
            {MEAL_TYPES.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setSelectedMealType(value)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-sm transition-colors",
                  selectedMealType === value
                    ? "bg-purple-100 text-purple-800 font-medium"
                    : "hover:bg-gray-100 text-gray-700"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <Button
          className="w-full bg-purple hover:bg-purple-dark text-white h-8 text-sm"
          onClick={handleAdd}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              Adding…
            </>
          ) : (
            "Add to Meal Plan"
          )}
        </Button>
      </PopoverContent>
    </Popover>
  );
};

export default AddToMealPlanPopover;
