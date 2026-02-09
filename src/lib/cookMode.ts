import type { Recipe, RecipeContent, RecipeIngredient, CombinedCookPlan } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { isDevMode } from "@/lib/devMode";
import { formatGroceryItem } from "@/lib/groceryList";

export interface RecipeWithContent {
  recipe: Recipe;
  content: RecipeContent;
}

export function getRecipesWithContent(
  recipes: Recipe[],
  contentMap: Record<string, RecipeContent>
): RecipeWithContent[] {
  const result: RecipeWithContent[] = [];
  for (const recipe of recipes) {
    const content = contentMap[recipe.id];
    if (content && content.status === "completed") {
      result.push({ recipe, content });
    }
  }
  return result;
}

export function formatCookTime(time: string | undefined): string {
  if (!time) return "N/A";
  return time;
}

export function getRecipeIngredientsList(
  recipeId: string,
  ingredients: RecipeIngredient[]
): string[] {
  return ingredients
    .filter((ing) => ing.recipeId === recipeId)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((ing) =>
      formatGroceryItem({
        name: ing.name,
        totalQuantity: ing.quantity,
        unit: ing.unit,
        category: ing.category,
        sourceRecipes: [],
      })
    );
}

export async function generateCookPlan(
  recipesWithContent: RecipeWithContent[],
  ingredients: RecipeIngredient[]
): Promise<CombinedCookPlan | null> {
  if (isDevMode()) {
    return null;
  }

  try {
    const recipes = recipesWithContent.map((rwc) => ({
      name: rwc.recipe.name,
      instructions: rwc.content.instructions || [],
      prepTime: rwc.content.prepTime,
      cookTime: rwc.content.cookTime,
      servings: rwc.content.servings,
      ingredients: getRecipeIngredientsList(rwc.recipe.id, ingredients),
    }));

    const { data, error } = await supabase.functions.invoke("generate-cook-plan", {
      body: { recipes },
    });

    if (error) throw error;

    if (data?.skipped) {
      return null;
    }

    if (data?.plan) {
      return data.plan as CombinedCookPlan;
    }

    return null;
  } catch (error) {
    console.error("Failed to generate cook plan:", error);
    return null;
  }
}
