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

  // Expand slot heights when fewer meal types are shown
  const mealCount = activeMealTypes.length;
  const mobileGridCols =
    mealCount === 1 ? "grid-cols-[56px_1fr]" :
    mealCount === 2 ? "grid-cols-[56px_1fr_1fr]" :
    "grid-cols-[56px_1fr_1fr_1fr]";
  const mobileMinH = mealCount === 1 ? "h-14" : mealCount === 2 ? "h-11" : "h-10";
  const desktopMinH = mealCount === 1 ? "md:min-h-[72px]" : mealCount === 2 ? "md:min-h-[60px]" : "md:min-h-[52px]";

  const today = new Date();
  const isToday = (displayIndex: number) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + displayIndex);
    return d.toDateString() === today.toDateString();
  };
  const slotMinH = `${mobileMinH} md:min-h-0 ${desktopMinH}`;

  return (
    <>
      {/* Mobile: compact rows with meal type columns */}
      <div className="md:hidden">
        {/* Header */}
        <div className={`grid ${mobileGridCols} gap-1 mb-1`}>
          <div />
          {activeMealTypes.map((mt) => (
            <div key={mt} className="text-center text-xs font-medium text-muted-foreground py-1 capitalize">
              {mt}
            </div>
          ))}
        </div>
        {/* Day rows */}
        <div className="space-y-1">
          {dayLabels.map((day, displayIndex) => (
            <div key={day} className={`grid ${mobileGridCols} gap-1 items-stretch`}>
              <div className="flex flex-col justify-center py-1">
                <span className={`text-xs font-semibold ${isToday(displayIndex) ? "text-purple" : ""}`}>{day}</span>
                <span className={`text-[10px] ${isToday(displayIndex) ? "text-purple/70" : "text-muted-foreground"}`}>{getDateLabel(displayIndex)}</span>
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
              <div key={day} className={`p-2 text-center rounded-md ${isToday(displayIndex) ? "bg-purple/5" : ""}`}>
                <div className={`text-xs font-semibold ${isToday(displayIndex) ? "text-purple" : ""}`}>{day}</div>
                <div className={`text-sm ${isToday(displayIndex) ? "text-purple/70" : "text-muted-foreground"}`}>{getDateLabel(displayIndex)}</div>
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
