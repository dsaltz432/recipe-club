import { parseISO, startOfDay, subDays } from "date-fns";

/**
 * Calculate the current cooking streak: the number of consecutive days ending today or
 * yesterday where at least one meal was marked as cooked. Returns 0 if the streak is
 * broken (no cooked meal in the last two days).
 *
 * @param cookedTimestamps - ISO timestamp strings from meal_plan_items.cooked_at
 */
export function calculateStreak(cookedTimestamps: string[]): number {
  if (cookedTimestamps.length === 0) return 0;

  // Build a Set of unique day ISO strings (midnight local time for consistent comparison)
  const cookedDaySet = new Set(
    cookedTimestamps.map((ts) => startOfDay(parseISO(ts)).toISOString())
  );

  const today = startOfDay(new Date());
  const yesterday = startOfDay(subDays(today, 1));

  // Streak must be active (include today or yesterday)
  const hasTodayCook = cookedDaySet.has(today.toISOString());
  const hasYesterdayCook = cookedDaySet.has(yesterday.toISOString());
  if (!hasTodayCook && !hasYesterdayCook) return 0;

  // Walk backwards from the most recent cooked day counting consecutive days
  let streak = 0;
  let cursor = hasTodayCook ? today : yesterday;

  while (cookedDaySet.has(cursor.toISOString())) {
    streak++;
    cursor = startOfDay(subDays(cursor, 1));
  }

  return streak;
}
