/**
 * Parses a human-readable timing string and returns the total number of seconds.
 * Returns null if no time can be extracted.
 *
 * Handles formats like:
 *   "30 minutes", "15 min", "1 hour", "2 hrs", "45 seconds",
 *   "1 hour 30 minutes", "2 hours 15 min", "1h 30m",
 *   "90 minutes", "3:30" (min:sec)
 */
export function parseTimingSeconds(text: string): number | null {
  if (!text) return null;
  const lower = text.toLowerCase();

  let totalSeconds = 0;
  let matched = false;

  // MM:SS format  e.g. "3:30"
  const colonMatch = lower.match(/\b(\d{1,2}):(\d{2})\b/);
  if (colonMatch) {
    return parseInt(colonMatch[1], 10) * 60 + parseInt(colonMatch[2], 10);
  }

  // Hours  e.g. "2 hours", "1 hr", "2h", "1.5 hours"
  const hourMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b/);
  if (hourMatch) {
    totalSeconds += parseFloat(hourMatch[1]) * 3600;
    matched = true;
  }

  // Minutes  e.g. "30 minutes", "15 min", "30m"
  const minMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:minutes?|mins?|m)\b/);
  if (minMatch) {
    totalSeconds += parseFloat(minMatch[1]) * 60;
    matched = true;
  }

  // Seconds  e.g. "45 seconds", "30 sec"
  const secMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:seconds?|secs?|s)\b/);
  if (secMatch) {
    totalSeconds += parseFloat(secMatch[1]);
    matched = true;
  }

  if (!matched || totalSeconds <= 0) return null;
  return Math.round(totalSeconds);
}

/** Formats a number of seconds as M:SS (e.g. 90 → "1:30", 65 → "1:05") */
export function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
