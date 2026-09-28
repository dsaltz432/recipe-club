import { endOfWeek, isSameDay, isWithinInterval, startOfWeek } from "date-fns";

/** The day Recipe Club was founded: September 29, 2020 */
export const CLUB_FOUNDED_DATE = new Date(2020, 8, 29);

export interface AnniversaryInfo {
  /** Which anniversary this is (1st, 2nd, ...) */
  years: number;
  /** This year's anniversary date */
  date: Date;
  /** Whether `today` is the anniversary itself */
  isToday: boolean;
}

/**
 * Returns anniversary info if `today` falls in the same calendar week (Sun–Sat)
 * as this year's club anniversary, otherwise null.
 */
export function getAnniversaryInfo(today: Date = new Date()): AnniversaryInfo | null {
  const date = new Date(
    today.getFullYear(),
    CLUB_FOUNDED_DATE.getMonth(),
    CLUB_FOUNDED_DATE.getDate()
  );
  const years = date.getFullYear() - CLUB_FOUNDED_DATE.getFullYear();
  if (years < 1) return null;

  const inWeek = isWithinInterval(today, { start: startOfWeek(date), end: endOfWeek(date) });
  if (!inWeek) return null;

  return { years, date, isToday: isSameDay(today, date) };
}

/** 1 → "1st", 2 → "2nd", 11 → "11th", 23 → "23rd" */
export function toOrdinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}
