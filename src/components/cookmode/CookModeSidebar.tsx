import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { CookModeStep, RecipeIngredient } from "@/types";
import { getRecipeColor } from "@/lib/cookModeColors";
import CookModeIngredientPanel from "./CookModeIngredientPanel";
import RecipeTips from "@/components/recipes/RecipeTips";

interface CookModeSidebarProps {
  steps: CookModeStep[];
  currentStep: number;
  onJumpToStep: (index: number) => void;
  ingredientsByRecipe: Map<string, RecipeIngredient[]>;
  recipeColorMap: Map<string, number>;
  recipeNames: Map<string, string>;
  /** Primary recipe ID for tips (first recipe in the list) */
  primaryRecipeId?: string;
  userId?: string;
}

const CookModeSidebar = ({
  steps,
  currentStep,
  onJumpToStep,
  ingredientsByRecipe,
  recipeColorMap,
  recipeNames,
  primaryRecipeId,
  userId,
}: CookModeSidebarProps) => {
  const [tipsCollapsed, setTipsCollapsed] = useState(false);

  return (
    <div className="flex flex-col h-full overflow-hidden border-l border-slate-800 bg-slate-950">
      {/* Ingredients section */}
      <div className="flex-shrink-0 border-b border-slate-800">
        <div className="px-3 py-2 border-b border-slate-800">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Ingredients</span>
        </div>
        <div className="overflow-y-auto max-h-48">
          <CookModeIngredientPanel
            ingredientsByRecipe={ingredientsByRecipe}
            recipeColorMap={recipeColorMap}
            recipeNames={recipeNames}
          />
        </div>
      </div>

      {/* Tips section (collapsible) */}
      {primaryRecipeId && (
        <div className="flex-shrink-0 border-b border-slate-800">
          <button
            className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider hover:text-slate-200 transition-colors"
            onClick={() => setTipsCollapsed(!tipsCollapsed)}
            aria-label={tipsCollapsed ? "Expand tips" : "Collapse tips"}
          >
            Tips
            {tipsCollapsed ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
          </button>
          {!tipsCollapsed && (
            <div className="px-3 pb-3">
              <RecipeTips recipeId={primaryRecipeId} userId={userId} darkMode />
            </div>
          )}
        </div>
      )}

      {/* Steps list */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        <div className="px-3 py-2 border-b border-slate-800 flex-shrink-0">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Steps</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          {steps.map((step, index) => {
            const colorIndex = recipeColorMap.get(step.recipeId) ?? 0;
            const color = getRecipeColor(colorIndex);
            const isActive = index === currentStep;

            return (
              <button
                key={index}
                onClick={() => onJumpToStep(index)}
                className={`w-full text-left px-3 py-2 flex items-start gap-2 transition-colors border-l-2 ${
                  isActive
                    ? "bg-slate-800 border-l-2"
                    : "hover:bg-slate-900 border-transparent"
                }`}
                style={isActive ? { borderLeftColor: color.accent } : {}}
                aria-label={`Jump to step ${index + 1}`}
                aria-current={isActive ? "step" : undefined}
              >
                <span
                  className="flex-shrink-0 w-5 h-5 rounded-full text-xs font-semibold flex items-center justify-center mt-0.5"
                  style={{
                    backgroundColor: isActive ? color.accent : "transparent",
                    color: isActive ? "white" : color.accent,
                    border: isActive ? "none" : `1px solid ${color.accent}`,
                  }}
                >
                  {index + 1}
                </span>
                <p className={`text-xs leading-relaxed line-clamp-2 ${isActive ? "text-white font-medium" : "text-slate-400"}`}>
                  {step.instruction}
                </p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default CookModeSidebar;
