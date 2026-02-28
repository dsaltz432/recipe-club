import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface WeekNavigationProps {
  weekStart: Date;
  onPreviousWeek: () => void;
  onNextWeek: () => void;
  onCurrentWeek: () => void;
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

const isCurrentWeek = (weekStart: Date): boolean => {
  const now = new Date();
  const currentWeekStart = new Date(now);
  const dayOfWeek = currentWeekStart.getDay();
  currentWeekStart.setDate(currentWeekStart.getDate() - dayOfWeek);
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
}: WeekNavigationProps) => {
  return (
    <div className="flex items-center justify-between mb-4">
      <Button variant="outline" size="sm" className="min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0" onClick={onPreviousWeek} aria-label="Previous week">
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <div className="flex items-center gap-2">
        <span className="font-display text-lg font-semibold">
          {formatWeekRange(weekStart)}
        </span>
        {!isCurrentWeek(weekStart) && (
          <Button variant="ghost" size="sm" className="min-h-[44px] sm:min-h-0" onClick={onCurrentWeek}>
            Today
          </Button>
        )}
      </div>
      <Button variant="outline" size="sm" className="min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0" onClick={onNextWeek} aria-label="Next week">
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
};

export default WeekNavigation;
