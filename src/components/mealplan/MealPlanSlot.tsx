import { Plus, Check, Loader2 } from "lucide-react";
import type { MealPlanItem } from "@/types";

interface MealPlanSlotProps {
  items: MealPlanItem[];
  dayOfWeek: number;
  mealType: string;
  onAddMeal: (dayOfWeek: number, mealType: string) => void;
  onViewMealEvent?: (dayOfWeek: number, mealType: string) => void;
  onToggleCooked?: (dayOfWeek: number, mealType: string) => void;
  isToggling?: boolean;
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
  onToggleCooked,
  isToggling = false,
  slotMinH,
}: MealPlanSlotProps) => {
  const isCooked = items.length > 0 && items.every((i) => i.cookedAt);
  const minH = slotMinH || "min-h-[48px] md:min-h-[60px]";

  if (items.length === 0) {
    return (
      <button
        className={`w-full ${minH} border border-dashed border-gray-300 text-gray-300 hover:border-purple/50 hover:text-purple rounded-md flex items-center justify-center gap-1 bg-transparent transition-colors`}
        onClick={() => onAddMeal(dayOfWeek, mealType)}
      >
        <Plus className="h-3.5 w-3.5 md:h-4 md:w-4" />
        <span className="text-xs hidden md:inline">{mealTypeLabels[mealType]}</span>
      </button>
    );
  }

  return (
    <div
      className={`relative w-full ${minH} p-1.5 md:p-2 rounded-lg border transition-colors cursor-pointer hover:shadow-sm flex flex-col justify-center ${
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
      {/* Meal names — leave right-side padding for the cooked toggle */}
      <div className="space-y-1 pr-6">
        {items.map((item) => {
          const name = item.recipeName || item.customName || "Unnamed meal";

          return (
            <div key={item.id} className="flex items-start gap-1">
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

      {/* Cooked toggle button — top-right corner, always visible on filled slots */}
      {onToggleCooked && (
        <button
          data-testid="cooked-toggle"
          onClick={(e) => {
            e.stopPropagation();
            onToggleCooked(dayOfWeek, mealType);
          }}
          disabled={isToggling}
          aria-label={isCooked ? "Unmark as cooked" : "Mark as cooked"}
          title={isCooked ? "Unmark as cooked" : "Mark as cooked"}
          className={`absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center transition-all shrink-0 ${
            isCooked
              ? "bg-green-500 text-white border border-green-500 hover:bg-green-600 hover:border-green-600"
              : "bg-white text-gray-300 border border-gray-200 hover:border-green-400 hover:text-green-500 shadow-sm"
          } ${isToggling ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          {isToggling ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Check className="h-3 w-3" />
          )}
        </button>
      )}

      {/* Add another meal — desktop only, bottom-right */}
      <button
        onClick={(e) => { e.stopPropagation(); onAddMeal(dayOfWeek, mealType); }}
        className="hidden md:flex absolute bottom-1 right-1 text-muted-foreground hover:text-purple transition-colors p-1"
        title="Add another meal"
        aria-label="Add another meal"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};

export default MealPlanSlot;
