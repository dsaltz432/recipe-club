import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface WeekNavigationProps {
  weekStart: Date;
  onPreviousWeek: () => void;
  onNextWeek: () => void;
  onCurrentWeek: () => void;
  weekStartDay?: number;
}

const formatWeekRange = (weekStart: Date): string => {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const startMonth = weekStart.toLocaleDateString("en-US", { month: "short" });
  const endMonth = weekEnd.toLocaleDateString("en-US", { month: "short" });

  if (startMonth === endMonth) {
    return `${startMonth} ${weekStart.getDate()} - ${weekEnd.getDate()}`;
  }
  return `${startMonth} ${weekStart.getDate()} - ${endMonth} ${weekEnd.getDate()}`;
};

const isCurrentWeek = (weekStart: Date, weekStartDay: number = 0): boolean => {
  const now = new Date();
  const currentWeekStart = new Date(now);
  const dayOfWeek = currentWeekStart.getDay();
  const diff = weekStartDay === 1
    ? (dayOfWeek + 6) % 7
    : dayOfWeek;
  currentWeekStart.setDate(currentWeekStart.getDate() - diff);
  currentWeekStart.setHours(0, 0, 0, 0);

  const compareDate = new Date(weekStart);
  compareDate.setHours(0, 0, 0, 0);

  return compareDate.getTime() === currentWeekStart.getTime();
};

const WeekNavigation = ({
  weekStart,
  onPreviousWeek,
  onNextWeek,
  onCurrentWeek,
  weekStartDay = 0,
}: WeekNavigationProps) => {
  return (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="sm" className="min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 text-muted-foreground hover:text-foreground" onClick={onPreviousWeek} aria-label="Previous week">
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <div className="flex items-center gap-1">
        <span className="font-display text-sm sm:text-base font-semibold whitespace-nowrap">
          {formatWeekRange(weekStart)}
        </span>
        {!isCurrentWeek(weekStart, weekStartDay) && (
          <Button variant="ghost" size="sm" className="min-h-[44px] sm:min-h-0 text-xs px-1.5" onClick={onCurrentWeek}>
            Today
          </Button>
        )}
      </div>
      <Button variant="ghost" size="sm" className="min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 text-muted-foreground hover:text-foreground" onClick={onNextWeek} aria-label="Next week">
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
};

export default WeekNavigation;
