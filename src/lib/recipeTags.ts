export const RECIPE_TAGS = [
  { value: "Family Recipe", color: "bg-rose-100 text-rose-700 border-rose-200" },
  { value: "Comfort Food", color: "bg-amber-100 text-amber-700 border-amber-200" },
  { value: "Special Occasion", color: "bg-purple-100 text-purple-700 border-purple-200" },
  { value: "Weeknight Dinner", color: "bg-green-100 text-green-700 border-green-200" },
] as const;

export type RecipeTagValue = (typeof RECIPE_TAGS)[number]["value"];

export function getTagStyle(tag: string) {
  return RECIPE_TAGS.find((t) => t.value === tag)?.color ?? "bg-gray-100 text-gray-600 border-gray-200";
}
