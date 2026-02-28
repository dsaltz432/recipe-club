import MealPlanSlot from "./MealPlanSlot";
import type { MealPlanItem } from "@/types";

interface MealPlanGridProps {
  items: MealPlanItem[];
  weekStart: Date;
  onAddMeal: (dayOfWeek: number, mealType: string) => void;
  onViewMealEvent?: (dayOfWeek: number, mealType: string) => void;
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MEAL_TYPES = ["breakfast", "lunch", "dinner"] as const;

const MealPlanGrid = ({ items, weekStart, onAddMeal, onViewMealEvent }: MealPlanGridProps) => {
  const getItemsForSlot = (dayOfWeek: number, mealType: string): MealPlanItem[] => {
    return items.filter((item) => item.dayOfWeek === dayOfWeek && item.mealType === mealType);
  };

  const getDateLabel = (dayIndex: number): string => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + dayIndex);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  const renderSlot = (dayIndex: number, mealType: typeof MEAL_TYPES[number]) => (
    <MealPlanSlot
      items={getItemsForSlot(dayIndex, mealType)}
      dayOfWeek={dayIndex}
      mealType={mealType}
      onAddMeal={onAddMeal}
      onViewMealEvent={onViewMealEvent}
    />
  );

  return (
    <>
      {/* Mobile: compact rows with B/L/D columns */}
      <div className="md:hidden">
        {/* Header */}
        <div className="grid grid-cols-[56px_1fr_1fr_1fr] gap-1 mb-1">
          <div />
          {MEAL_TYPES.map((mt) => (
            <div key={mt} className="text-center text-xs font-medium text-muted-foreground capitalize py-1">
              {mt.charAt(0).toUpperCase()}
            </div>
          ))}
        </div>
        {/* Day rows */}
        <div className="space-y-1">
          {DAY_LABELS.map((day, dayIndex) => (
            <div key={day} className="grid grid-cols-[56px_1fr_1fr_1fr] gap-1 items-stretch">
              <div className="flex flex-col justify-center py-1">
                <span className="text-xs font-semibold">{day}</span>
                <span className="text-[10px] text-muted-foreground">{getDateLabel(dayIndex)}</span>
              </div>
              {MEAL_TYPES.map((mealType) => (
                <div key={mealType} className="min-h-[48px]">
                  {renderSlot(dayIndex, mealType)}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Desktop: 8-column grid */}
      <div className="hidden md:block overflow-x-auto">
        <div>
          {/* Header row */}
          <div className="grid grid-cols-8 gap-1 mb-1">
            <div className="p-2 text-xs font-medium text-muted-foreground"></div>
            {DAY_LABELS.map((day, i) => (
              <div key={day} className="p-2 text-center">
                <div className="text-xs font-semibold">{day}</div>
                <div className="text-sm text-muted-foreground">{getDateLabel(i)}</div>
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
                  {renderSlot(dayIndex, mealType)}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

export default MealPlanGrid;
