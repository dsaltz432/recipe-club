import { Button } from "@/components/ui/button";
import { Plus, Check } from "lucide-react";
import type { MealPlanItem } from "@/types";

interface MealPlanSlotProps {
  items: MealPlanItem[];
  dayOfWeek: number;
  mealType: "breakfast" | "lunch" | "dinner" | "snack";
  onAddMeal: (dayOfWeek: number, mealType: string) => void;
  onViewMealEvent?: (dayOfWeek: number, mealType: string) => void;
}

const mealTypeLabels: Record<string, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

const MealPlanSlot = ({
  items,
  dayOfWeek,
  mealType,
  onAddMeal,
  onViewMealEvent,
}: MealPlanSlotProps) => {
  const isCooked = items.length > 0 && items.every((i) => i.cookedAt);

  if (items.length === 0) {
    return (
      <Button
        variant="ghost"
        className="w-full h-full min-h-[60px] border border-dashed border-gray-200 text-muted-foreground hover:border-purple/50 hover:text-purple"
        onClick={() => onAddMeal(dayOfWeek, mealType)}
      >
        <Plus className="h-3 w-3 mr-1" />
        <span className="text-xs">{mealTypeLabels[mealType]}</span>
      </Button>
    );
  }

  return (
    <div
      className={`relative w-full min-h-[60px] p-2 rounded-lg border transition-colors ${
        isCooked
          ? "bg-green-50 border-green-200 hover:bg-green-100 hover:border-green-300"
          : "bg-purple/5 border-purple/20 hover:bg-purple/10 hover:border-purple/40"
      }${onViewMealEvent ? " cursor-pointer" : ""}`}
      onClick={onViewMealEvent ? () => onViewMealEvent(dayOfWeek, mealType) : undefined}
      role={onViewMealEvent ? "button" : undefined}
      aria-label={onViewMealEvent ? "View meal details" : undefined}
    >
      {isCooked && <span className="sr-only">Cooked</span>}
      <div className="space-y-1">
        {items.map((item) => {
          const name = item.recipeName || item.customName || "Unnamed meal";

          return (
            <div key={item.id} className="flex items-start justify-between gap-1">
              <div className="flex-1 min-w-0 text-left">
                <p className="text-xs font-medium truncate flex items-center gap-1">
                  {isCooked && <Check className="h-3 w-3 text-green-600 flex-shrink-0" data-testid="cooked-check" />}
                  {name}
                </p>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-end mt-1">
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); onAddMeal(dayOfWeek, mealType); }}
            className="text-muted-foreground hover:text-purple transition-colors p-1"
            title="Add another meal"
            aria-label="Add another meal"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default MealPlanSlot;
