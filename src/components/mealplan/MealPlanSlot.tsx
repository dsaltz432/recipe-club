import { Button } from "@/components/ui/button";
import { Plus, X, ExternalLink, ChefHat, Check, RotateCcw } from "lucide-react";
import type { MealPlanItem } from "@/types";

interface MealPlanSlotProps {
  items: MealPlanItem[];
  dayOfWeek: number;
  mealType: "breakfast" | "lunch" | "dinner" | "snack";
  onAddMeal: (dayOfWeek: number, mealType: string) => void;
  onRemoveMeal: (itemId: string) => void;
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
  onRemoveMeal,
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
    <div className={`relative w-full min-h-[60px] p-2 rounded-lg border ${
      isCooked
        ? "bg-green-50 border-green-200"
        : "bg-purple/5 border-purple/20"
    }`}>
      <div className="space-y-1">
        {items.map((item) => {
          const name = item.recipeName || item.customName || "Unnamed meal";
          const url = item.recipeUrl || item.customUrl;

          return (
            <div key={item.id} className="group flex items-start justify-between gap-1">
              <button
                className="flex-1 min-w-0 text-left cursor-pointer hover:text-purple transition-colors"
                onClick={() => onEditMeal(item)}
                title="Edit meal"
              >
                <p className="text-xs font-medium truncate flex items-center gap-1">
                  {isCooked && <Check className="h-3 w-3 text-green-600 flex-shrink-0" data-testid="cooked-check" />}
                  {name}
                </p>
              </button>
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                {url && (
                  <a href={url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-purple">
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                <button
                  onClick={() => onRemoveMeal(item.id)}
                  className="text-muted-foreground hover:text-red-500"
                  title="Remove meal"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between mt-1">
        <span className="text-[10px] text-muted-foreground">{mealTypeLabels[mealType]}</span>
        <div className="flex items-center gap-1">
          {onViewMealEvent && (
            <button
              onClick={() => onViewMealEvent(dayOfWeek, mealType)}
              className="text-muted-foreground hover:text-purple transition-colors"
              title="View meal details"
            >
              <ChefHat className="h-3 w-3" />
            </button>
          )}
          {isCooked && onUncook && (
            <button
              onClick={() => onUncook(dayOfWeek, mealType)}
              className="text-green-600 hover:text-orange-500 transition-colors"
              title="Undo cook"
            >
              <RotateCcw className="h-3 w-3" />
            </button>
          )}
          {!isCooked && onMarkCooked && (
            <button
              onClick={() => onMarkCooked(dayOfWeek, mealType)}
              className="text-muted-foreground hover:text-green-600 transition-colors"
              title="Mark as cooked"
            >
              <Check className="h-3 w-3" />
            </button>
          )}
          <button
            onClick={() => onAddMeal(dayOfWeek, mealType)}
            className="text-muted-foreground hover:text-purple transition-colors"
            title="Add another meal"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default MealPlanSlot;
