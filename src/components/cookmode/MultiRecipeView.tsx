import type { RecipeContent } from "@/types";
import { getRecipeColor } from "@/lib/cookModeColors";
import RecipeInstructions from "@/components/cookmode/RecipeInstructions";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface RecipeEntry {
  id: string;
  name: string;
  content: RecipeContent;
}

interface MultiRecipeViewProps {
  recipes: RecipeEntry[];
}

const MultiRecipeView = ({ recipes }: MultiRecipeViewProps) => {
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
                <div className={cn("rounded-t-lg px-4 py-3 border-b", color.bg, color.border)}>
                  <h3 className={cn("font-semibold text-sm", color.text)}>
                    {recipe.name}
                  </h3>
                </div>
                <RecipeInstructions
                  instructions={recipe.content.instructions}
                  servings={recipe.content.servings}
                  prepTime={recipe.content.prepTime}
                  cookTime={recipe.content.cookTime}
                  totalTime={recipe.content.totalTime}
                  description={recipe.content.description}
                />
              </TabsContent>
            );
          })}
        </Tabs>
      </div>

      {/* Desktop: side-by-side grid (hidden below md) */}
      <div className="hidden md:grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {recipes.map((recipe, index) => {
          const color = getRecipeColor(index);
          return (
            <div key={recipe.id} className={cn("rounded-lg border overflow-hidden", color.border)}>
              <div className={cn("px-4 py-3 border-b", color.bg, color.border)}>
                <h3 className={cn("font-semibold text-sm", color.text)}>
                  {recipe.name}
                </h3>
              </div>
              <RecipeInstructions
                instructions={recipe.content.instructions}
                servings={recipe.content.servings}
                prepTime={recipe.content.prepTime}
                cookTime={recipe.content.cookTime}
                totalTime={recipe.content.totalTime}
                description={recipe.content.description}
              />
            </div>
          );
        })}
      </div>
    </>
  );
};

export default MultiRecipeView;
