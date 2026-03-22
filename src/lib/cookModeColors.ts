export interface RecipeColor {
  bg: string;
  text: string;
  border: string;
  /** CSS color value for use in inline styles (dark-mode sidebar accents) */
  accent: string;
}

const RECIPE_COLORS: RecipeColor[] = [
  { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200", accent: "#a855f7" },
  { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", accent: "#3b82f6" },
  { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", accent: "#10b981" },
  { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200", accent: "#f97316" },
  { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200", accent: "#f43f5e" },
  { bg: "bg-teal-50", text: "text-teal-700", border: "border-teal-200", accent: "#14b8a6" },
  { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", accent: "#f59e0b" },
  { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200", accent: "#6366f1" },
];

export function getRecipeColor(index: number): RecipeColor {
  return RECIPE_COLORS[index % RECIPE_COLORS.length];
}
