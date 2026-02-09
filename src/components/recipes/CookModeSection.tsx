import { useState } from "react";
import { Flame, Loader2, Clock, ChefHat } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { Recipe, RecipeContent, RecipeIngredient, CombinedCookPlan } from "@/types";
import { getRecipesWithContent, formatCookTime, getRecipeIngredientsList, generateCookPlan } from "@/lib/cookMode";

interface CookModeSectionProps {
  recipes: Recipe[];
  recipeContentMap: Record<string, RecipeContent>;
  recipeIngredients: RecipeIngredient[];
  eventName: string;
}

const RECIPE_COLORS = [
  "bg-blue-100 text-blue-800",
  "bg-green-100 text-green-800",
  "bg-yellow-100 text-yellow-800",
  "bg-pink-100 text-pink-800",
  "bg-indigo-100 text-indigo-800",
  "bg-orange-100 text-orange-800",
];

const CookModeSection = ({
  recipes,
  recipeContentMap,
  recipeIngredients,
  eventName,
}: CookModeSectionProps) => {
  const [cookPlan, setCookPlan] = useState<CombinedCookPlan | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const recipesWithContent = getRecipesWithContent(recipes, recipeContentMap);

  const recipeColorMap: Record<string, string> = {};
  recipesWithContent.forEach((rwc, index) => {
    recipeColorMap[rwc.recipe.name] = RECIPE_COLORS[index % RECIPE_COLORS.length];
  });

  const handleGeneratePlan = async () => {
    setIsGenerating(true);
    try {
      const plan = await generateCookPlan(recipesWithContent, recipeIngredients);
      if (plan) {
        setCookPlan(plan);
        toast.success("Cook plan generated!");
      } else {
        toast.error("Could not generate cook plan. AI features may not be available.");
      }
    } catch {
      toast.error("Failed to generate cook plan");
    } finally {
      setIsGenerating(false);
    }
  };

  if (recipesWithContent.length === 0) {
    return (
      <Card className="bg-white/90 backdrop-blur-sm border-2 border-dashed border-purple/20">
        <CardContent className="flex flex-col items-center justify-center py-8 sm:py-12">
          <Flame className="h-8 w-8 text-muted-foreground mb-4" />
          <p className="text-muted-foreground text-center text-sm sm:text-base">
            No parsed recipes yet — add recipes and they'll be parsed automatically.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white/90 backdrop-blur-sm border border-purple/10">
      <CardContent className="pt-4 sm:pt-6 pb-4">
        <div className="flex items-center gap-2 mb-4">
          <Flame className="h-5 w-5 text-orange" />
          <h2 className="font-display text-lg sm:text-xl font-semibold">
            Cook Mode — {eventName}
          </h2>
        </div>

        {/* Individual Recipes */}
        <div className="space-y-4 mb-6">
          {recipesWithContent.map((rwc) => {
            const ingredientsList = getRecipeIngredientsList(rwc.recipe.id, recipeIngredients);

            return (
              <Card key={rwc.recipe.id} className="border border-gray-200">
                <CardContent className="pt-4 pb-4">
                  <h3 className="font-semibold text-base mb-2">{rwc.recipe.name}</h3>

                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground mb-3">
                    {rwc.content.servings && (
                      <span className="flex items-center gap-1">
                        <ChefHat className="h-3 w-3" />
                        {rwc.content.servings}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Prep: {formatCookTime(rwc.content.prepTime)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Cook: {formatCookTime(rwc.content.cookTime)}
                    </span>
                    {rwc.content.totalTime && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Total: {rwc.content.totalTime}
                      </span>
                    )}
                  </div>

                  {ingredientsList.length > 0 && (
                    <div className="mb-3">
                      <h4 className="text-xs font-semibold uppercase text-gray-500 mb-1">Ingredients</h4>
                      <ul className="text-sm space-y-0.5">
                        {ingredientsList.map((ing, i) => (
                          <li key={i} className="text-gray-700">• {ing}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {rwc.content.instructions && rwc.content.instructions.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold uppercase text-gray-500 mb-1">Instructions</h4>
                      <ol className="text-sm space-y-1 list-decimal list-inside">
                        {rwc.content.instructions.map((step, i) => (
                          <li key={i} className="text-gray-700">{step}</li>
                        ))}
                      </ol>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Generate Combined Plan */}
        {recipesWithContent.length >= 2 && !cookPlan && (
          <Button
            onClick={handleGeneratePlan}
            disabled={isGenerating}
            className="w-full mb-4 bg-orange hover:bg-orange/90"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating combined plan...
              </>
            ) : (
              <>
                <Flame className="h-4 w-4 mr-2" />
                Generate Combined Cooking Plan
              </>
            )}
          </Button>
        )}

        {/* Combined Cook Plan Display */}
        {cookPlan && (
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-base">Combined Cooking Plan</h3>
              <Badge variant="outline" className="text-xs">
                <Clock className="h-3 w-3 mr-1" />
                {cookPlan.totalTime}
              </Badge>
            </div>

            <div className="space-y-2 mb-4">
              {cookPlan.steps.map((step, i) => (
                <div key={i} className="flex gap-3 items-start py-1.5">
                  <span className="text-xs font-mono text-gray-500 w-10 shrink-0 pt-0.5">
                    {step.time}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm">{step.action}</p>
                    <div className="flex gap-1.5 mt-0.5">
                      <Badge className={`text-xs px-1.5 py-0 ${recipeColorMap[step.recipe] || "bg-gray-100 text-gray-800"}`}>
                        {step.recipe}
                      </Badge>
                      {step.equipment && (
                        <Badge variant="outline" className="text-xs px-1.5 py-0">
                          {step.equipment}
                        </Badge>
                      )}
                      {step.duration && (
                        <span className="text-xs text-gray-400">{step.duration}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {cookPlan.tips.length > 0 && (
              <div className="bg-amber-50 rounded-lg p-3">
                <h4 className="text-xs font-semibold uppercase text-amber-700 mb-1">Tips</h4>
                <ul className="text-sm space-y-0.5">
                  {cookPlan.tips.map((tip, i) => (
                    <li key={i} className="text-amber-800">• {tip}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CookModeSection;
