import { format, addDays, startOfDay } from "date-fns";

export interface UpcomingDay {
  date: Date;
  dayOfWeek: number;
  weekStartStr: string;
  label: string;
}

/** Get the most recent Sunday on-or-before a given date (as a YYYY-MM-DD string). */
export function getWeekStartStr(date: Date): string {
  const d = startOfDay(new Date(date));
  d.setDate(d.getDate() - d.getDay());
  return d.toISOString().split("T")[0];
}

/** Build the next 7 days starting from today. */
export function buildUpcomingDays(): UpcomingDay[] {
  const today = startOfDay(new Date());
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(today, i);
    const isToday = i === 0;
    const isTomorrow = i === 1;
    const label = isToday
      ? `Today (${format(date, "EEE, MMM d")})`
      : isTomorrow
        ? `Tomorrow (${format(date, "EEE, MMM d")})`
        : format(date, "EEE, MMM d");
    return {
      date,
      dayOfWeek: date.getDay(),
      weekStartStr: getWeekStartStr(date),
      label,
    };
  });
}
