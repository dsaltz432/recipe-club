import { Plus, Check } from "lucide-react";
import type { MealPlanItem } from "@/types";

interface MealPlanSlotProps {
  items: MealPlanItem[];
  dayOfWeek: number;
  mealType: string;
  onAddMeal: (dayOfWeek: number, mealType: string) => void;
  onViewMealEvent?: (dayOfWeek: number, mealType: string) => void;
  slotMinH?: string;
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
  slotMinH,
}: MealPlanSlotProps) => {
  const isCooked = items.length > 0 && items.every((i) => i.cookedAt);
  const minH = slotMinH || "min-h-[48px] md:min-h-[60px]";

  if (items.length === 0) {
    return (
      <button
        className={`w-full h-full ${minH} border border-dashed border-gray-200 text-muted-foreground hover:border-purple/50 hover:text-purple rounded-md flex items-center justify-center gap-1 bg-transparent`}
        onClick={() => onAddMeal(dayOfWeek, mealType)}
      >
        <Plus className="h-3.5 w-3.5 md:h-4 md:w-4" />
        <span className="text-xs hidden md:inline">{mealTypeLabels[mealType]}</span>
      </button>
    );
  }

  return (
    <div
      className={`relative w-full ${minH} p-1.5 md:p-2 rounded-lg border transition-colors cursor-pointer hover:shadow-sm ${
        isCooked
          ? "bg-green-50 border-green-200"
          : "bg-purple/5 border-purple/20"
      }`}
      onClick={() => onViewMealEvent?.(dayOfWeek, mealType)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onViewMealEvent?.(dayOfWeek, mealType); }}
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
      <div className="hidden md:flex items-center justify-end mt-1">
        <button
          onClick={(e) => { e.stopPropagation(); onAddMeal(dayOfWeek, mealType); }}
          className="text-muted-foreground hover:text-purple transition-colors p-2"
          title="Add another meal"
          aria-label="Add another meal"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default MealPlanSlot;
