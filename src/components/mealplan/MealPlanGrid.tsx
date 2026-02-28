import MealPlanSlot from "./MealPlanSlot";
import type { MealPlanItem } from "@/types";

interface MealPlanGridProps {
  items: MealPlanItem[];
  weekStart: Date;
  onAddMeal: (dayOfWeek: number, mealType: string) => void;
  onViewMealEvent?: (dayOfWeek: number, mealType: string) => void;
  mealTypes?: string[];
  weekStartDay?: number;
}

const ALL_DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DEFAULT_MEAL_TYPES = ["breakfast", "lunch", "dinner"];

const MealPlanGrid = ({ items, weekStart, onAddMeal, onViewMealEvent, mealTypes, weekStartDay = 0 }: MealPlanGridProps) => {
  const activeMealTypes = mealTypes || DEFAULT_MEAL_TYPES;
  // Build reordered day labels and indices based on weekStartDay
  // dayOrder maps display position → actual dayOfWeek value (0=Sun..6=Sat)
  const dayOrder = Array.from({ length: 7 }, (_, i) => (i + weekStartDay) % 7);
  const dayLabels = dayOrder.map((dow) => ALL_DAY_LABELS[dow]);

  const getItemsForSlot = (dayOfWeek: number, mealType: string): MealPlanItem[] => {
    return items.filter((item) => item.dayOfWeek === dayOfWeek && item.mealType === mealType);
  };

  const getDateLabel = (dayIndex: number): string => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + dayIndex);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  const renderSlot = (dayIndex: number, mealType: string) => (
    <MealPlanSlot
      items={getItemsForSlot(dayIndex, mealType)}
      dayOfWeek={dayIndex}
      mealType={mealType}
      onAddMeal={onAddMeal}
      onViewMealEvent={onViewMealEvent}
      slotMinH={slotMinH}
    />
  );

  const mobileGridCols = `grid-cols-[56px_${"1fr_".repeat(activeMealTypes.length).trim()}]`;
  // Expand slot heights when fewer meal types are shown
  const mealCount = activeMealTypes.length;
  const mobileMinH = mealCount === 1 ? "min-h-[96px]" : mealCount === 2 ? "min-h-[64px]" : "min-h-[48px]";
  const desktopMinH = mealCount === 1 ? "md:min-h-[120px]" : mealCount === 2 ? "md:min-h-[80px]" : "md:min-h-[60px]";
  const slotMinH = `${mobileMinH} ${desktopMinH}`;

  return (
    <>
      {/* Mobile: compact rows with meal type columns */}
      <div className="md:hidden">
        {/* Header */}
        <div className={`grid ${mobileGridCols} gap-1 mb-1`}>
          <div />
          {activeMealTypes.map((mt) => (
            <div key={mt} className="text-center text-xs font-medium text-muted-foreground capitalize py-1">
              {mt.charAt(0).toUpperCase()}
            </div>
          ))}
        </div>
        {/* Day rows */}
        <div className="space-y-1">
          {dayLabels.map((day, displayIndex) => (
            <div key={day} className={`grid ${mobileGridCols} gap-1 items-stretch`}>
              <div className="flex flex-col justify-center py-1">
                <span className="text-xs font-semibold">{day}</span>
                <span className="text-[10px] text-muted-foreground">{getDateLabel(displayIndex)}</span>
              </div>
              {activeMealTypes.map((mealType) => (
                <div key={mealType} className={mobileMinH}>
                  {renderSlot(dayOrder[displayIndex], mealType)}
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
            {dayLabels.map((day, displayIndex) => (
              <div key={day} className="p-2 text-center">
                <div className="text-xs font-semibold">{day}</div>
                <div className="text-sm text-muted-foreground">{getDateLabel(displayIndex)}</div>
              </div>
            ))}
          </div>

          {/* Meal type rows */}
          {activeMealTypes.map((mealType) => (
            <div key={mealType} className="grid grid-cols-8 gap-1 mb-1">
              <div className="p-2 flex items-center">
                <span className="text-xs font-medium text-muted-foreground capitalize">{mealType}</span>
              </div>
              {dayLabels.map((_, displayIndex) => (
                <div key={displayIndex} className={`p-0.5 ${desktopMinH}`}>
                  {renderSlot(dayOrder[displayIndex], mealType)}
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
