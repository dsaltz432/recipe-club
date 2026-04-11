/** Extract the first number from a servings string like "Serves 4", "4-6", "4 people". */
export function parseServingsNumber(servings: string): number | null {
  const match = servings.match(/\d+(\.\d+)?/);
  if (!match) return null;
  const n = parseFloat(match[0]);
  return isNaN(n) || n <= 0 ? null : n;
}
