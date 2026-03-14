import type { RecipeIngredient } from "@/types";
import { getRecipeColor } from "@/lib/cookModeColors";

interface CookModeIngredientPanelProps {
  ingredientsByRecipe: Map<string, RecipeIngredient[]>;
  recipeColorMap: Map<string, number>;
  recipeNames: Map<string, string>;
}

const CookModeIngredientPanel = ({
  ingredientsByRecipe,
  recipeColorMap,
  recipeNames,
}: CookModeIngredientPanelProps) => {
  const hasIngredients = Array.from(ingredientsByRecipe.values()).some((ings) => ings.length > 0);

  if (!hasIngredients) {
    return (
      <div className="px-3 py-2">
        <p className="text-xs text-slate-500">No ingredients available.</p>
      </div>
    );
  }

  return (
    <div className="px-3 py-2 space-y-3">
      {Array.from(ingredientsByRecipe.entries()).map(([recipeId, ingredients]) => {
        if (ingredients.length === 0) return null;
        const colorIndex = recipeColorMap.get(recipeId) ?? 0;
        const color = getRecipeColor(colorIndex);
        const recipeName = recipeNames.get(recipeId) ?? "Recipe";

        return (
          <div key={recipeId}>
            {recipeNames.size > 1 && (
              <p className="text-xs font-medium mb-1.5" style={{ color: color.accent }}>
                {recipeName}
              </p>
            )}
            <ul className="space-y-0.5">
              {ingredients.map((ing) => (
                <li key={ing.id} className="flex items-baseline gap-1.5 text-xs text-slate-300">
                  <span className="w-1 h-1 rounded-full flex-shrink-0 mt-1.5" style={{ backgroundColor: color.accent }} />
                  <span>
                    {ing.quantity ? `${ing.quantity}` : ""}
                    {ing.unit ? ` ${ing.unit}` : ""}
                    {" "}
                    {ing.name}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
};

export default CookModeIngredientPanel;
