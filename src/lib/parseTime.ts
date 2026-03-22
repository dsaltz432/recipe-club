/**
 * Parse a time string like "15 minutes", "1 hour 30 min", "1h30m", "90 mins" into minutes.
 * Returns null if the string cannot be parsed.
 */
export function parseTimeToMinutes(timeStr: string | undefined | null): number | null {
  if (!timeStr || typeof timeStr !== "string") return null;
  const s = timeStr.toLowerCase().trim();
  if (!s) return null;

  // Match patterns like "1h30m", "1h 30m", "1 hour 30 min", "1 hour", "30 minutes", "45 mins", "30 min", "2 hours"
  const fullPattern = /(?:(\d+)\s*h(?:our(?:s)?)?)?[\s,]*(?:(\d+)\s*(?:min(?:utes?|s)?|m(?!h)))?/i;
  const match = s.match(fullPattern);
  if (match && (match[1] || match[2])) {
    const hours = parseInt(match[1] ?? "0", 10);
    const mins = parseInt(match[2] ?? "0", 10);
    if (hours === 0 && mins === 0) return null;
    return hours * 60 + mins;
  }

  // Fallback: just a number (assume minutes)
  const numMatch = s.match(/^(\d+)$/);
  if (numMatch) return parseInt(numMatch[1], 10);

  return null;
}
