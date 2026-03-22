import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { RecipeIngredient } from "@/types";
import CookModeIngredientPanel from "./CookModeIngredientPanel";
import RecipeTips from "@/components/recipes/RecipeTips";

interface CookModeSidebarProps {
  ingredientsByRecipe: Map<string, RecipeIngredient[]>;
  recipeColorMap: Map<string, number>;
  recipeNames: Map<string, string>;
  /** Primary recipe ID for tips (first recipe in the list) */
  primaryRecipeId?: string;
  userId?: string;
}

const CookModeSidebar = ({
  ingredientsByRecipe,
  recipeColorMap,
  recipeNames,
  primaryRecipeId,
  userId,
}: CookModeSidebarProps) => {
  const [tipsCollapsed, setTipsCollapsed] = useState(false);

  return (
    <div className="flex flex-col h-full overflow-y-auto border-l border-slate-800 bg-slate-950">
      {/* Ingredients section */}
      <div className="flex-shrink-0 border-b border-slate-800">
        <div className="px-3 py-2 border-b border-slate-800">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Ingredients</span>
        </div>
        <CookModeIngredientPanel
          ingredientsByRecipe={ingredientsByRecipe}
          recipeColorMap={recipeColorMap}
          recipeNames={recipeNames}
        />
      </div>

      {/* Tips section (collapsible) */}
      {primaryRecipeId && (
        <div className="flex-shrink-0">
          <button
            className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider hover:text-slate-200 transition-colors border-b border-slate-800"
            onClick={() => setTipsCollapsed(!tipsCollapsed)}
            aria-label={tipsCollapsed ? "Expand tips" : "Collapse tips"}
          >
            Tips
            {tipsCollapsed ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
          </button>
          {!tipsCollapsed && (
            <div className="px-3 pb-3 pt-2">
              <RecipeTips recipeId={primaryRecipeId} userId={userId} darkMode />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CookModeSidebar;
