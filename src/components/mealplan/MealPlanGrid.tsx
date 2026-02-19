import MealPlanSlot from "./MealPlanSlot";
import type { MealPlanItem } from "@/types";

interface MealPlanGridProps {
  items: MealPlanItem[];
  weekStart: Date;
  onAddMeal: (dayOfWeek: number, mealType: string) => void;
  onRemoveMeal: (itemId: string) => void;
  onEditMeal: (item: MealPlanItem) => void;
  onViewMealEvent?: (dayOfWeek: number, mealType: string) => void;
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MEAL_TYPES = ["breakfast", "lunch", "dinner"] as const;

const MealPlanGrid = ({ items, weekStart, onAddMeal, onRemoveMeal, onEditMeal, onViewMealEvent }: MealPlanGridProps) => {
  const getItemsForSlot = (dayOfWeek: number, mealType: string): MealPlanItem[] => {
    return items.filter((item) => item.dayOfWeek === dayOfWeek && item.mealType === mealType);
  };

  const getDateLabel = (dayIndex: number): string => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + dayIndex);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[700px]">
        {/* Header row */}
        <div className="grid grid-cols-8 gap-1 mb-1">
          <div className="p-2 text-xs font-medium text-muted-foreground"></div>
          {DAY_LABELS.map((day, i) => (
            <div key={day} className="p-2 text-center">
              <div className="text-xs font-semibold">{day}</div>
              <div className="text-[10px] text-muted-foreground">{getDateLabel(i)}</div>
            </div>
          ))}
        </div>

        {/* Meal type rows */}
        {MEAL_TYPES.map((mealType) => (
          <div key={mealType} className="grid grid-cols-8 gap-1 mb-1">
            <div className="p-2 flex items-center">
              <span className="text-xs font-medium text-muted-foreground capitalize">{mealType}</span>
            </div>
            {DAY_LABELS.map((_, dayIndex) => (
              <div key={dayIndex} className="p-0.5">
                <MealPlanSlot
                  items={getItemsForSlot(dayIndex, mealType)}
                  dayOfWeek={dayIndex}
                  mealType={mealType}
                  onAddMeal={onAddMeal}
                  onRemoveMeal={onRemoveMeal}
                  onEditMeal={onEditMeal}
                  onViewMealEvent={onViewMealEvent}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default MealPlanGrid;
