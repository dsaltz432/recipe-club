import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock supabase
const mockInvoke = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
  },
}));

// Mock devMode
const { devMode } = vi.hoisted(() => ({ devMode: { value: false } }));
vi.mock("@/lib/devMode", () => ({
  isDevMode: () => devMode.value,
}));

import {
  getRecipesWithContent,
  formatCookTime,
  getRecipeIngredientsList,
  generateCookPlan,
} from "@/lib/cookMode";
import type { Recipe, RecipeContent, RecipeIngredient } from "@/types";
import { createMockRecipe, createMockRecipeContent, createMockRecipeIngredient } from "@tests/utils";

describe("cookMode", () => {
  beforeEach(() => {
    devMode.value = false;
    vi.clearAllMocks();
  });

  describe("getRecipesWithContent", () => {
    it("returns recipes that have completed content", () => {
      const recipes: Recipe[] = [
        createMockRecipe({ id: "r1", name: "Pasta" }),
        createMockRecipe({ id: "r2", name: "Salad" }),
        createMockRecipe({ id: "r3", name: "Bread" }),
      ];
      const contentMap: Record<string, RecipeContent> = {
        "r1": createMockRecipeContent({ recipeId: "r1", status: "completed" }),
        "r2": createMockRecipeContent({ recipeId: "r2", status: "failed" }),
      };

      const result = getRecipesWithContent(recipes, contentMap);

      expect(result).toHaveLength(1);
      expect(result[0].recipe.id).toBe("r1");
      expect(result[0].content.status).toBe("completed");
    });

    it("returns empty array when no recipes have completed content", () => {
      const recipes: Recipe[] = [
        createMockRecipe({ id: "r1", name: "Pasta" }),
      ];
      const contentMap: Record<string, RecipeContent> = {};

      const result = getRecipesWithContent(recipes, contentMap);
      expect(result).toHaveLength(0);
    });

    it("returns empty array for empty recipes", () => {
      const result = getRecipesWithContent([], {});
      expect(result).toHaveLength(0);
    });
  });

  describe("formatCookTime", () => {
    it("returns the time string as-is", () => {
      expect(formatCookTime("30 minutes")).toBe("30 minutes");
    });

    it("returns N/A for undefined", () => {
      expect(formatCookTime(undefined)).toBe("N/A");
    });
  });

  describe("getRecipeIngredientsList", () => {
    it("returns formatted ingredients for a recipe sorted by sort order", () => {
      const ingredients: RecipeIngredient[] = [
        createMockRecipeIngredient({ id: "i2", recipeId: "r1", name: "garlic", quantity: 3, unit: "clove", sortOrder: 1 }),
        createMockRecipeIngredient({ id: "i1", recipeId: "r1", name: "pasta", quantity: 1, unit: "lb", sortOrder: 0 }),
        createMockRecipeIngredient({ id: "i3", recipeId: "r2", name: "lettuce", quantity: 1, unit: "head", sortOrder: 0 }),
      ];

      const result = getRecipeIngredientsList("r1", ingredients);

      expect(result).toEqual(["1 lb pasta", "3 garlic cloves"]);
    });

    it("returns empty array for recipe with no ingredients", () => {
      const result = getRecipeIngredientsList("r1", []);
      expect(result).toEqual([]);
    });

    it("handles ingredients without sort order", () => {
      const ingredients: RecipeIngredient[] = [
        createMockRecipeIngredient({ id: "i1", recipeId: "r1", name: "salt", quantity: undefined, unit: undefined, sortOrder: undefined }),
      ];

      const result = getRecipeIngredientsList("r1", ingredients);
      expect(result).toEqual(["salt"]);
    });

    it("sorts by sortOrder with mixed undefined and defined values", () => {
      const ingredients: RecipeIngredient[] = [
        createMockRecipeIngredient({ id: "i1", recipeId: "r1", name: "flour", quantity: 1, unit: "cup", sortOrder: undefined }),
        createMockRecipeIngredient({ id: "i2", recipeId: "r1", name: "sugar", quantity: 2, unit: "tbsp", sortOrder: 1 }),
      ];

      const result = getRecipeIngredientsList("r1", ingredients);
      // undefined sortOrder defaults to 0, so flour (0) comes before sugar (1)
      expect(result).toEqual(["1 cup flour", "2 tbsp sugar"]);
    });

    it("sorts by sortOrder when both items have defined values", () => {
      const ingredients: RecipeIngredient[] = [
        createMockRecipeIngredient({ id: "i1", recipeId: "r1", name: "sugar", quantity: 2, unit: "tbsp", sortOrder: 2 }),
        createMockRecipeIngredient({ id: "i2", recipeId: "r1", name: "flour", quantity: 1, unit: "cup", sortOrder: 1 }),
        createMockRecipeIngredient({ id: "i3", recipeId: "r1", name: "butter", quantity: 0.5, unit: "cup", sortOrder: undefined }),
      ];

      const result = getRecipeIngredientsList("r1", ingredients);
      // butter (undefined → 0), flour (1), sugar (2)
      expect(result).toEqual(["1/2 cup butter", "1 cup flour", "2 tbsp sugar"]);
    });
  });

  describe("generateCookPlan", () => {
    const recipesWithContent = [
      {
        recipe: createMockRecipe({ id: "r1", name: "Pasta" }),
        content: createMockRecipeContent({
          recipeId: "r1",
          status: "completed",
          instructions: ["Boil water", "Cook pasta"],
          prepTime: "5 minutes",
          cookTime: "10 minutes",
          servings: "4",
        }),
      },
    ];
    const ingredients: RecipeIngredient[] = [
      createMockRecipeIngredient({ id: "i1", recipeId: "r1", name: "pasta", quantity: 1, unit: "lb", sortOrder: 0 }),
    ];

    it("returns null in dev mode", async () => {
      devMode.value = true;

      const result = await generateCookPlan(recipesWithContent, ingredients);
      expect(result).toBeNull();
      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it("calls generate-cook-plan edge function and returns plan", async () => {
      const mockPlan = {
        totalTime: "15 minutes",
        steps: [{ time: "0:00", action: "Boil water", recipe: "Pasta", equipment: "burner 1", duration: "10 minutes" }],
        tips: ["Start water early"],
      };
      mockInvoke.mockResolvedValue({ data: { plan: mockPlan }, error: null });

      const result = await generateCookPlan(recipesWithContent, ingredients);

      expect(mockInvoke).toHaveBeenCalledWith("generate-cook-plan", {
        body: {
          recipes: [
            {
              name: "Pasta",
              instructions: ["Boil water", "Cook pasta"],
              prepTime: "5 minutes",
              cookTime: "10 minutes",
              servings: "4",
              ingredients: ["1 lb pasta"],
            },
          ],
        },
      });
      expect(result).toEqual(mockPlan);
    });

    it("returns null when edge function returns skipped", async () => {
      mockInvoke.mockResolvedValue({ data: { skipped: true }, error: null });

      const result = await generateCookPlan(recipesWithContent, ingredients);
      expect(result).toBeNull();
    });

    it("returns null when edge function returns error", async () => {
      mockInvoke.mockResolvedValue({ data: null, error: new Error("Network error") });

      const result = await generateCookPlan(recipesWithContent, ingredients);
      expect(result).toBeNull();
    });

    it("returns null when data has no plan", async () => {
      mockInvoke.mockResolvedValue({ data: { success: true }, error: null });

      const result = await generateCookPlan(recipesWithContent, ingredients);
      expect(result).toBeNull();
    });

    it("handles recipe with undefined instructions", async () => {
      const noInstructionsRecipes = [
        {
          recipe: createMockRecipe({ id: "r1", name: "Pasta" }),
          content: createMockRecipeContent({
            recipeId: "r1",
            status: "completed",
            instructions: undefined,
            prepTime: "5 minutes",
            cookTime: "10 minutes",
            servings: "4",
          }),
        },
      ];
      const mockPlan = {
        totalTime: "15 minutes",
        steps: [{ time: "0:00", action: "Cook", recipe: "Pasta" }],
        tips: [],
      };
      mockInvoke.mockResolvedValue({ data: { plan: mockPlan }, error: null });

      const result = await generateCookPlan(noInstructionsRecipes, ingredients);

      expect(mockInvoke).toHaveBeenCalledWith("generate-cook-plan", {
        body: {
          recipes: [
            {
              name: "Pasta",
              instructions: [],
              prepTime: "5 minutes",
              cookTime: "10 minutes",
              servings: "4",
              ingredients: ["1 lb pasta"],
            },
          ],
        },
      });
      expect(result).toEqual(mockPlan);
    });
  });
});
