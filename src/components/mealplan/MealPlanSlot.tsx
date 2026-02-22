import { Button } from "@/components/ui/button";
import { Plus, Check, RotateCcw } from "lucide-react";
import type { MealPlanItem } from "@/types";

interface MealPlanSlotProps {
  items: MealPlanItem[];
  dayOfWeek: number;
  mealType: "breakfast" | "lunch" | "dinner" | "snack";
  onAddMeal: (dayOfWeek: number, mealType: string) => void;
  onEditMeal: (item: MealPlanItem) => void;
  onViewMealEvent?: (dayOfWeek: number, mealType: string) => void;
  onMarkCooked?: (dayOfWeek: number, mealType: string) => void;
  onUncook?: (dayOfWeek: number, mealType: string) => void;
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
  onEditMeal,
  onViewMealEvent,
  onMarkCooked,
  onUncook,
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
              <button
                className="flex-1 min-w-0 text-left cursor-pointer hover:text-purple transition-colors"
                onClick={(e) => { e.stopPropagation(); onEditMeal(item); }}
                title="Edit meal"
                aria-label={`Edit ${name}`}
              >
                <p className="text-xs font-medium truncate flex items-center gap-1">
                  {isCooked && <Check className="h-3 w-3 text-green-600 flex-shrink-0" data-testid="cooked-check" />}
                  {name}
                </p>
              </button>
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-end mt-1">
        <div className="flex items-center gap-1">
          {isCooked && onUncook && (
            <button
              onClick={(e) => { e.stopPropagation(); onUncook(dayOfWeek, mealType); }}
              className="text-green-600 hover:text-orange-500 transition-colors p-1 flex items-center gap-0.5"
              title="Undo cook"
              aria-label="Undo cook"
            >
              <RotateCcw className="h-3 w-3" />
              <span className="text-[10px]">Undo</span>
            </button>
          )}
          {!isCooked && onMarkCooked && (
            <button
              onClick={(e) => { e.stopPropagation(); onMarkCooked(dayOfWeek, mealType); }}
              className="text-muted-foreground hover:text-green-600 transition-colors p-1 flex items-center gap-0.5"
              title="Mark as cooked"
              aria-label="Mark as cooked"
            >
              <Check className="h-3 w-3" />
              <span className="text-[10px]">Done</span>
            </button>
          )}
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
