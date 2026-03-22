import { useState } from "react";
import type { RecipeContent } from "@/types";
import { getRecipeColor } from "@/lib/cookModeColors";
import RecipeInstructions from "@/components/cookmode/RecipeInstructions";
import RecipeIngredientList from "@/components/recipes/RecipeIngredientList";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { ChevronDown, ChevronUp, ShoppingBasket } from "lucide-react";
import { cn } from "@/lib/utils";

interface RecipeEntry {
  id: string;
  name: string;
  content: RecipeContent;
}

interface MultiRecipeViewProps {
  recipes: RecipeEntry[];
}

const getGridCols = (count: number) => {
  if (count === 1) return "grid-cols-1";
  if (count === 2) return "grid-cols-1 md:grid-cols-2";
  return "grid-cols-1 md:grid-cols-2 lg:grid-cols-3";
};

const MultiRecipeView = ({ recipes }: MultiRecipeViewProps) => {
  const [expandedIngredients, setExpandedIngredients] = useState<Set<string>>(new Set());

  const toggleIngredients = (recipeId: string) => {
    setExpandedIngredients((prev) => {
      const next = new Set(prev);
      if (next.has(recipeId)) next.delete(recipeId);
      else next.add(recipeId);
      return next;
    });
  };

  if (recipes.length === 0) return null;

  return (
    <>
      {/* Mobile: tabbed view (hidden md+) */}
      <div className="md:hidden">
        <Tabs defaultValue={recipes[0].id}>
          <TabsList className="w-full h-auto flex-wrap gap-1 bg-muted/50 p-1 mb-4">
            {recipes.map((recipe, index) => {
              const color = getRecipeColor(index);
              return (
                <TabsTrigger
                  key={recipe.id}
                  value={recipe.id}
                  className={cn(
                    "flex-1 min-w-0 text-xs font-medium truncate",
                    "data-[state=active]:" + color.bg,
                    "data-[state=active]:" + color.text
                  )}
                >
                  {recipe.name}
                </TabsTrigger>
              );
            })}
          </TabsList>
          {recipes.map((recipe, index) => {
            const color = getRecipeColor(index);
            return (
              <TabsContent key={recipe.id} value={recipe.id}>
                <button
                  onClick={() => toggleIngredients(recipe.id)}
                  className={cn("rounded-t-lg w-full flex items-center gap-2 px-4 py-3 border-b transition-colors hover:brightness-95", color.bg, color.border)}
                >
                  <h3 className={cn("font-semibold text-sm flex-1 text-left", color.text)}>
                    {recipe.name}
                  </h3>
                  <ShoppingBasket className={cn("h-3.5 w-3.5 opacity-60", color.text)} />
                  {expandedIngredients.has(recipe.id) ? <ChevronUp className={cn("h-3.5 w-3.5", color.text)} /> : <ChevronDown className={cn("h-3.5 w-3.5", color.text)} />}
                </button>
                {expandedIngredients.has(recipe.id) && (
                  <div className="px-4 py-3 border-b" style={{ borderColor: "inherit" }}>
                    <RecipeIngredientList recipeId={recipe.id} userId="" editable={false} />
                  </div>
                )}
                <RecipeInstructions
                  instructions={recipe.content.instructions}
                  servings={recipe.content.servings}
                  prepTime={recipe.content.prepTime}
                  cookTime={recipe.content.cookTime}
                  totalTime={recipe.content.totalTime}
                />
              </TabsContent>
            );
          })}
        </Tabs>
      </div>

      {/* Desktop: side-by-side grid (hidden below md) */}
      <div className={cn("hidden md:grid gap-4", getGridCols(recipes.length))}>
        {recipes.map((recipe, index) => {
          const color = getRecipeColor(index);
          return (
            <div key={recipe.id} className={cn("rounded-lg border overflow-hidden", color.border)}>
              <button
                onClick={() => toggleIngredients(recipe.id)}
                className={cn("w-full flex items-center gap-2 px-4 py-3 border-b transition-colors hover:brightness-95", color.bg, color.border)}
              >
                <h3 className={cn("font-semibold text-sm flex-1 text-left", color.text)}>
                  {recipe.name}
                </h3>
                <ShoppingBasket className={cn("h-3.5 w-3.5 opacity-60", color.text)} />
                {expandedIngredients.has(recipe.id) ? <ChevronUp className={cn("h-3.5 w-3.5", color.text)} /> : <ChevronDown className={cn("h-3.5 w-3.5", color.text)} />}
              </button>
              {expandedIngredients.has(recipe.id) && (
                <div className="px-4 py-3 border-b border-inherit">
                  <RecipeIngredientList recipeId={recipe.id} userId="" editable={false} />
                </div>
              )}
              <RecipeInstructions
                instructions={recipe.content.instructions}
                servings={recipe.content.servings}
                prepTime={recipe.content.prepTime}
                cookTime={recipe.content.cookTime}
                totalTime={recipe.content.totalTime}
              />
            </div>
          );
        })}
      </div>
    </>
  );
};

export default MultiRecipeView;
