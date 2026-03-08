export interface RecipeColor {
  bg: string;
  text: string;
  border: string;
}

const RECIPE_COLORS: RecipeColor[] = [
  { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
  { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200" },
  { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" },
  { bg: "bg-teal-50", text: "text-teal-700", border: "border-teal-200" },
  { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200" },
];

export function getRecipeColor(index: number): RecipeColor {
  return RECIPE_COLORS[index % RECIPE_COLORS.length];
}
