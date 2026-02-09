import type { SmartGroceryItem } from "@/types/index.ts";

const FUNCTIONS_URL = "http://127.0.0.1:54321/functions/v1";
import { combineIngredients, decimalToFraction } from "@/lib/groceryList.ts";
import type { TestRecipe } from "@test-combine/data/recipes.ts";

// Build RecipeIngredient[] from TestRecipe[] for combineIngredients
function recipesToIngredients(recipes: TestRecipe[]) {
  return recipes.flatMap((recipe) =>
    recipe.ingredients.map((ing, i) => ({
      id: `${recipe.id}-${i}`,
      recipeId: recipe.id,
      name: ing.name,
      quantity: ing.quantity ?? undefined,
      unit: ing.unit ?? undefined,
      category: ing.category,
      rawText: ing.rawText,
    }))
  );
}

function buildRecipeNameMap(recipes: TestRecipe[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const r of recipes) {
    map[r.id] = r.name;
  }
  return map;
}

// Smart combine via the combine-ingredients edge function
export async function smartCombine(
  recipes: TestRecipe[]
): Promise<SmartGroceryItem[] | null> {
  try {
    const ingredients = recipesToIngredients(recipes);
    const nameMap = buildRecipeNameMap(recipes);
    const naiveResult = combineIngredients(ingredients, nameMap);

    const preCombined = naiveResult.map((item) => ({
      name: item.name,
      quantity:
        item.totalQuantity != null
          ? decimalToFraction(item.totalQuantity)
          : null,
      unit: item.unit ?? null,
      category: item.category,
      sourceRecipes: item.sourceRecipes,
    }));

    const res = await fetch(`${FUNCTIONS_URL}/combine-ingredients`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ preCombined }),
    });

    if (!res.ok) {
      throw new Error(`Edge function error: ${res.status}`);
    }

    const data = await res.json();

    if (data?.skipped) return null;
    if (data?.items) return data.items as SmartGroceryItem[];
    return null;
  } catch (error) {
    console.error("Smart combine failed:", error);
    return null;
  }
}

