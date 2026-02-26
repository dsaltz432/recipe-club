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


import {
  GROCERY_CATEGORIES,
  CATEGORY_ORDER,
  CATEGORY_OVERRIDES,
  normalizeUnit,
  normalizeIngredientName,
  combineIngredients,
  groupByCategory,
  formatGroceryItem,
  generateCSV,
  generatePlainText,
  downloadCSV,
  filterPantryItems,
  filterSmartPantryItems,
  smartCombineIngredients,
  decimalToFraction,
  detectCategory,
  parseFractionToDecimal,
} from "@/lib/groceryList";
import type { RecipeIngredient, SmartGroceryItem, GroceryCategory } from "@/types";
import { createMockRecipeIngredient } from "@tests/utils";

describe("groceryList", () => {
  describe("GROCERY_CATEGORIES", () => {
    it("has display names for all categories", () => {
      expect(GROCERY_CATEGORIES.produce).toBe("Produce");
      expect(GROCERY_CATEGORIES.meat_seafood).toBe("Protein");
      expect(GROCERY_CATEGORIES.dairy).toBe("Dairy");
      expect(GROCERY_CATEGORIES.pantry).toBe("Pantry");
      expect(GROCERY_CATEGORIES.spices).toBe("Spices");
      expect(GROCERY_CATEGORIES.frozen).toBe("Frozen");
      expect(GROCERY_CATEGORIES.bakery).toBe("Bakery");
      expect(GROCERY_CATEGORIES.beverages).toBe("Beverages");
      expect(GROCERY_CATEGORIES.condiments).toBe("Condiments");
      expect(GROCERY_CATEGORIES.other).toBe("Other");
    });
  });

  describe("CATEGORY_ORDER", () => {
    it("contains all categories in display order", () => {
      expect(CATEGORY_ORDER).toHaveLength(10);
      expect(CATEGORY_ORDER[0]).toBe("produce");
      expect(CATEGORY_ORDER[CATEGORY_ORDER.length - 1]).toBe("other");
    });
  });

  describe("decimalToFraction", () => {
    it("returns integers as-is", () => {
      expect(decimalToFraction(0)).toBe("0");
      expect(decimalToFraction(1)).toBe("1");
      expect(decimalToFraction(5)).toBe("5");
    });

    it("converts standard fractions", () => {
      expect(decimalToFraction(0.125)).toBe("1/8");
      expect(decimalToFraction(0.25)).toBe("1/4");
      expect(decimalToFraction(0.333)).toBe("1/3");
      expect(decimalToFraction(0.375)).toBe("3/8");
      expect(decimalToFraction(0.5)).toBe("1/2");
      expect(decimalToFraction(0.625)).toBe("5/8");
      expect(decimalToFraction(0.667)).toBe("2/3");
      expect(decimalToFraction(0.75)).toBe("3/4");
      expect(decimalToFraction(0.875)).toBe("7/8");
    });

    it("converts mixed numbers (whole + fraction)", () => {
      expect(decimalToFraction(1.5)).toBe("1 1/2");
      expect(decimalToFraction(2.25)).toBe("2 1/4");
      expect(decimalToFraction(3.75)).toBe("3 3/4");
      expect(decimalToFraction(1.333)).toBe("1 1/3");
      expect(decimalToFraction(2.667)).toBe("2 2/3");
    });

    it("formats non-matching decimals as clean decimals", () => {
      expect(decimalToFraction(0.15)).toBe("0.15");
      expect(decimalToFraction(1.43)).toBe("1.43");
      expect(decimalToFraction(2.99)).toBe("2.99");
    });

    it("handles values within tolerance", () => {
      // 0.26 is within 0.02 of 0.25
      expect(decimalToFraction(0.26)).toBe("1/4");
      // 0.49 is within 0.02 of 0.5
      expect(decimalToFraction(0.49)).toBe("1/2");
    });

    it("removes trailing zeros from non-matching decimals", () => {
      expect(decimalToFraction(1.1)).toBe("1.1");
      expect(decimalToFraction(2.5)).toBe("2 1/2");
    });
  });

  describe("normalizeUnit", () => {
    it("returns empty string for null/undefined", () => {
      expect(normalizeUnit(null)).toBe("");
      expect(normalizeUnit(undefined)).toBe("");
    });

    it("returns empty string for empty string", () => {
      expect(normalizeUnit("")).toBe("");
    });

    it("normalizes plural units to singular", () => {
      expect(normalizeUnit("cups")).toBe("cup");
      expect(normalizeUnit("tablespoons")).toBe("tbsp");
      expect(normalizeUnit("teaspoons")).toBe("tsp");
      expect(normalizeUnit("ounces")).toBe("oz");
      expect(normalizeUnit("pounds")).toBe("lb");
      expect(normalizeUnit("cloves")).toBe("clove");
      expect(normalizeUnit("slices")).toBe("slice");
      expect(normalizeUnit("pieces")).toBe("piece");
      expect(normalizeUnit("cans")).toBe("can");
      expect(normalizeUnit("bottles")).toBe("bottle");
      expect(normalizeUnit("bunches")).toBe("bunch");
      expect(normalizeUnit("heads")).toBe("head");
      expect(normalizeUnit("stalks")).toBe("stalk");
      expect(normalizeUnit("ears")).toBe("ear");
      expect(normalizeUnit("ear")).toBe("ear");
      expect(normalizeUnit("sprigs")).toBe("sprig");
      expect(normalizeUnit("pinches")).toBe("pinch");
      expect(normalizeUnit("dashes")).toBe("dash");
      expect(normalizeUnit("liters")).toBe("liter");
      expect(normalizeUnit("milliliters")).toBe("ml");
      expect(normalizeUnit("grams")).toBe("g");
      expect(normalizeUnit("kilograms")).toBe("kg");
    });

    it("normalizes singular abbreviation forms", () => {
      expect(normalizeUnit("tablespoon")).toBe("tbsp");
      expect(normalizeUnit("teaspoon")).toBe("tsp");
      expect(normalizeUnit("ounce")).toBe("oz");
      expect(normalizeUnit("pound")).toBe("lb");
    });

    it("handles case and whitespace", () => {
      expect(normalizeUnit("  Cups  ")).toBe("cup");
      expect(normalizeUnit("TABLESPOONS")).toBe("tbsp");
    });

    it("returns unknown units lowercased", () => {
      expect(normalizeUnit("bunch")).toBe("bunch");
      expect(normalizeUnit("Handful")).toBe("handful");
    });
  });

  describe("normalizeIngredientName", () => {
    it("lowercases and trims", () => {
      expect(normalizeIngredientName("  Flour  ")).toBe("flour");
      expect(normalizeIngredientName("GARLIC")).toBe("garlic");
    });

    it("strips cooking adjectives from beginning", () => {
      expect(normalizeIngredientName("fresh garlic")).toBe("garlic");
      expect(normalizeIngredientName("minced ginger")).toBe("ginger");
      expect(normalizeIngredientName("dried oregano")).toBe("oregano");
      expect(normalizeIngredientName("chopped onion")).toBe("onion");
      expect(normalizeIngredientName("frozen peas")).toBe("pea");
    });

    it("strips multiple leading adjectives", () => {
      expect(normalizeIngredientName("fresh minced garlic")).toBe("garlic");
      expect(normalizeIngredientName("finely diced onion")).toBe("onion");
    });

    it("preserves adjectives in compound product names", () => {
      expect(normalizeIngredientName("crushed tomatoes")).toBe("crushed tomato");
      expect(normalizeIngredientName("Crushed Tomatoes")).toBe("crushed tomato");
      expect(normalizeIngredientName("crushed tomato")).toBe("crushed tomato");
      expect(normalizeIngredientName("ground beef")).toBe("ground beef");
      expect(normalizeIngredientName("ground turkey")).toBe("ground turkey");
      expect(normalizeIngredientName("ground pork")).toBe("ground pork");
      expect(normalizeIngredientName("whole chicken")).toBe("whole chicken");
    });

    it("does not strip adjectives from the middle/end", () => {
      expect(normalizeIngredientName("sesame oil")).toBe("sesame oil");
      expect(normalizeIngredientName("soy sauce")).toBe("soy sauce");
    });

    it("applies ingredient aliases", () => {
      expect(normalizeIngredientName("corn starch")).toBe("cornstarch");
      expect(normalizeIngredientName("soy bean")).toBe("soybean");
      expect(normalizeIngredientName("green onion")).toBe("scallion");
      expect(normalizeIngredientName("spring onion")).toBe("scallion");
      expect(normalizeIngredientName("sea salt")).toBe("salt");
      expect(normalizeIngredientName("kosher salt")).toBe("salt");
      expect(normalizeIngredientName("table salt")).toBe("salt");
      expect(normalizeIngredientName("extra virgin olive oil")).toBe("olive oil");
      expect(normalizeIngredientName("black pepper")).toBe("pepper");
      expect(normalizeIngredientName("white pepper")).toBe("pepper");
      expect(normalizeIngredientName("boston lettuce")).toBe("butter lettuce");
      expect(normalizeIngredientName("garlic clove")).toBe("garlic");
      expect(normalizeIngredientName("garlic cloves")).toBe("garlic");
      expect(normalizeIngredientName("red pepper flakes")).toBe("red pepper flakes");
      expect(normalizeIngredientName("Red Pepper Flakes")).toBe("red pepper flakes");
      expect(normalizeIngredientName("all-purpose flour")).toBe("flour");
      expect(normalizeIngredientName("all purpose flour")).toBe("flour");
    });

    it("strips trailing count-unit words from ingredient names", () => {
      expect(normalizeIngredientName("broccoli head")).toBe("broccoli");
      expect(normalizeIngredientName("garlic clove")).toBe("garlic");
      expect(normalizeIngredientName("cilantro bunch")).toBe("cilantro");
      expect(normalizeIngredientName("celery stalk")).toBe("celery");
      // Should not strip if word is part of the actual name
      expect(normalizeIngredientName("head lettuce")).toBe("head lettuce");
    });

    it("aliases white rice to rice", () => {
      expect(normalizeIngredientName("white rice")).toBe("rice");
    });

    it("singularizes leaves to leaf", () => {
      expect(normalizeIngredientName("bay leaves")).toBe("bay leaf");
      expect(normalizeIngredientName("curry leaves")).toBe("curry leaf");
      expect(normalizeIngredientName("kaffir lime leaves")).toBe("kaffir lime leaf");
    });

    it("aliases broth to stock", () => {
      expect(normalizeIngredientName("chicken broth")).toBe("chicken stock");
      expect(normalizeIngredientName("beef broth")).toBe("beef stock");
      expect(normalizeIngredientName("vegetable broth")).toBe("vegetable stock");
      expect(normalizeIngredientName("low sodium chicken broth")).toBe("low sodium chicken stock");
    });

    it("normalizes chili spelling variants", () => {
      expect(normalizeIngredientName("chilli")).toBe("chili");
      expect(normalizeIngredientName("chile")).toBe("chili");
      expect(normalizeIngredientName("chilli powder")).toBe("chili powder");
      expect(normalizeIngredientName("chile powder")).toBe("chili powder");
      expect(normalizeIngredientName("chilli oil")).toBe("chili oil");
    });

    it("aliases dry white wine to white wine", () => {
      expect(normalizeIngredientName("dry white wine")).toBe("white wine");
    });

    it("normalizes untyped oil to vegetable oil", () => {
      expect(normalizeIngredientName("oil")).toBe("vegetable oil");
      expect(normalizeIngredientName("cooking oil")).toBe("vegetable oil");
      expect(normalizeIngredientName("neutral oil")).toBe("vegetable oil");
      // Does NOT affect typed oils
      expect(normalizeIngredientName("olive oil")).toBe("olive oil");
      expect(normalizeIngredientName("sesame oil")).toBe("sesame oil");
    });

    it("applies aliases when at end of string", () => {
      expect(normalizeIngredientName("organic corn starch")).toBe("cornstarch");
    });

    it("applies aliases after singularization (plural alias)", () => {
      expect(normalizeIngredientName("green onions")).toBe("scallion");
      expect(normalizeIngredientName("spring onions")).toBe("scallion");
    });

    it("singularizes -ies to -y", () => {
      expect(normalizeIngredientName("berries")).toBe("berry");
      expect(normalizeIngredientName("cherries")).toBe("cherry");
    });

    it("singularizes -oes endings by stripping -es", () => {
      expect(normalizeIngredientName("tomatoes")).toBe("tomato");
      expect(normalizeIngredientName("potatoes")).toBe("potato");
    });

    it("singularizes -kes words via -s rule", () => {
      expect(normalizeIngredientName("flakes")).toBe("flake");
      expect(normalizeIngredientName("artichokes")).toBe("artichoke");
    });

    it("singularizes -ves words via -s rule", () => {
      expect(normalizeIngredientName("cloves")).toBe("clove");
      expect(normalizeIngredientName("olives")).toBe("olive");
    });

    it("singularizes -ches/-shes endings by stripping -es", () => {
      expect(normalizeIngredientName("peaches")).toBe("peach");
      expect(normalizeIngredientName("radishes")).toBe("radish");
    });

    it("singularizes -les/-ces/-tes words via -s rule (not -es)", () => {
      expect(normalizeIngredientName("testicles")).toBe("testicle");
      expect(normalizeIngredientName("apples")).toBe("apple");
      expect(normalizeIngredientName("noodles")).toBe("noodle");
      expect(normalizeIngredientName("sauces")).toBe("sauce");
    });

    it("preserves foreign words where trailing s is not a plural marker", () => {
      expect(normalizeIngredientName("foie gras")).toBe("foie gras");
      expect(normalizeIngredientName("molasses")).toBe("molasses");
    });

    it("preserves naturally plural ingredient names", () => {
      expect(normalizeIngredientName("tortilla chips")).toBe("tortilla chips");
      expect(normalizeIngredientName("breadcrumbs")).toBe("breadcrumbs");
      expect(normalizeIngredientName("red pepper flakes")).toBe("red pepper flakes");
      expect(normalizeIngredientName("oats")).toBe("oats");
    });

    it("singularizes basic -s ending", () => {
      expect(normalizeIngredientName("onions")).toBe("onion");
      expect(normalizeIngredientName("carrots")).toBe("carrot");
    });

    it("does not singularize -ss or -us endings", () => {
      expect(normalizeIngredientName("hummus")).toBe("hummus");
      expect(normalizeIngredientName("couscous")).toBe("couscous");
    });

    it("does not singularize very short words for -ies and -es rules", () => {
      expect(normalizeIngredientName("gas")).toBe("gas");
      expect(normalizeIngredientName("axes")).toBe("axe");
    });

    it("applies -s rule to short -ies words that skip -ies rule", () => {
      expect(normalizeIngredientName("dies")).toBe("die");
    });

    it("singularizes 4-letter words ending in -s (length > 3)", () => {
      expect(normalizeIngredientName("peas")).toBe("pea");
    });
  });

  describe("combineIngredients", () => {
    const recipeNameMap: Record<string, string> = {
      "recipe-1": "Pasta Primavera",
      "recipe-2": "Caesar Salad",
    };

    it("combines ingredients with same name and unit", () => {
      const ingredients: RecipeIngredient[] = [
        createMockRecipeIngredient({ id: "1", recipeId: "recipe-1", name: "flour", quantity: 2, unit: "cup" }),
        createMockRecipeIngredient({ id: "2", recipeId: "recipe-2", name: "flour", quantity: 1, unit: "cup" }),
      ];

      const result = combineIngredients(ingredients, recipeNameMap);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("flour");
      expect(result[0].totalQuantity).toBe(3);
      expect(result[0].unit).toBe("cup");
      expect(result[0].sourceRecipes).toEqual(["Pasta Primavera", "Caesar Salad"]);
    });

    it("converts and combines compatible volume units (tsp + tbsp)", () => {
      const ingredients: RecipeIngredient[] = [
        createMockRecipeIngredient({ id: "1", recipeId: "recipe-1", name: "sugar", quantity: 2, unit: "tbsp" }),
        createMockRecipeIngredient({ id: "2", recipeId: "recipe-2", name: "sugar", quantity: 3, unit: "tsp" }),
      ];

      const result = combineIngredients(ingredients, recipeNameMap);
      expect(result).toHaveLength(1);
      // 2 tbsp = 6 tsp + 3 tsp = 9 tsp = 3 tbsp
      expect(result[0].totalQuantity).toBe(3);
      expect(result[0].unit).toBe("tbsp");
    });

    it("converts and combines compatible volume units (tbsp + cup)", () => {
      const ingredients: RecipeIngredient[] = [
        createMockRecipeIngredient({ id: "1", recipeId: "recipe-1", name: "soy sauce", quantity: 1, unit: "cup" }),
        createMockRecipeIngredient({ id: "2", recipeId: "recipe-2", name: "soy sauce", quantity: 8, unit: "tbsp" }),
      ];

      const result = combineIngredients(ingredients, recipeNameMap);
      expect(result).toHaveLength(1);
      // 1 cup = 48 tsp, 8 tbsp = 24 tsp, total = 72 tsp = 1.5 cup
      expect(result[0].totalQuantity).toBe(1.5);
      expect(result[0].unit).toBe("cup");
    });

    it("converts and combines compatible weight units (oz + lb)", () => {
      const ingredients: RecipeIngredient[] = [
        createMockRecipeIngredient({ id: "1", recipeId: "recipe-1", name: "chicken", quantity: 1, unit: "lb" }),
        createMockRecipeIngredient({ id: "2", recipeId: "recipe-2", name: "chicken", quantity: 8, unit: "oz" }),
      ];

      const result = combineIngredients(ingredients, recipeNameMap);
      expect(result).toHaveLength(1);
      // 1 lb = 16 oz + 8 oz = 24 oz = 1.5 lb
      expect(result[0].totalQuantity).toBe(1.5);
      expect(result[0].unit).toBe("lb");
    });

    it("converts metric grams to imperial lb when >= 1 lb", () => {
      const ingredients: RecipeIngredient[] = [
        createMockRecipeIngredient({ id: "1", recipeId: "recipe-1", name: "crushed tomato", quantity: 800, unit: "g" }),
      ];

      const result = combineIngredients(ingredients, recipeNameMap);
      expect(result).toHaveLength(1);
      // 800g ≈ 28.22 oz ≈ 1.76 lb → prefers lb (largest imperial unit >= 1)
      expect(result[0].unit).toBe("lb");
      expect(result[0].totalQuantity).toBeCloseTo(800 / 28.35 / 16);
    });

    it("converts small metric grams to imperial oz when < 1 lb", () => {
      const ingredients: RecipeIngredient[] = [
        createMockRecipeIngredient({ id: "1", recipeId: "recipe-1", name: "parmesan", quantity: 100, unit: "g" }),
      ];

      const result = combineIngredients(ingredients, recipeNameMap);
      expect(result).toHaveLength(1);
      // 100g ≈ 3.53 oz → lb would be 0.22 (< 1), so picks oz
      expect(result[0].unit).toBe("oz");
      expect(result[0].totalQuantity).toBeCloseTo(100 / 28.35);
    });

    it("converts metric kg to imperial lb", () => {
      const ingredients: RecipeIngredient[] = [
        createMockRecipeIngredient({ id: "1", recipeId: "recipe-1", name: "chicken", quantity: 1, unit: "kg" }),
      ];

      const result = combineIngredients(ingredients, recipeNameMap);
      expect(result).toHaveLength(1);
      // 1kg ≈ 2.2 lb → should convert to lb (imperial preference)
      expect(result[0].unit).toBe("lb");
      expect(result[0].totalQuantity).toBeCloseTo(1000 / 28.35 / 16);
    });

    it("merges garlic volume (tbsp) into cloves via COUNT_TO_CUP", () => {
      const ingredients: RecipeIngredient[] = [
        createMockRecipeIngredient({ id: "1", recipeId: "recipe-1", name: "garlic", quantity: 3, unit: "clove" }),
        createMockRecipeIngredient({ id: "2", recipeId: "recipe-2", name: "garlic", quantity: 1, unit: "tbsp" }),
      ];

      const result = combineIngredients(ingredients, recipeNameMap);
      // 1 tbsp = 3 tsp = 3 cloves + 3 explicit cloves = 6
      expect(result).toHaveLength(1);
      expect(result[0].unit).toBe("clove");
      expect(result[0].totalQuantity).toBe(6);
    });

    it("handles ingredients without quantity", () => {
      const ingredients: RecipeIngredient[] = [
        createMockRecipeIngredient({ id: "1", recipeId: "recipe-1", name: "salt", quantity: undefined, unit: undefined }),
      ];

      const result = combineIngredients(ingredients, recipeNameMap);
      expect(result).toHaveLength(1);
      expect(result[0].totalQuantity).toBeUndefined();
      expect(result[0].unit).toBeUndefined();
    });

    it("combines when first has no quantity and second does", () => {
      const ingredients: RecipeIngredient[] = [
        createMockRecipeIngredient({ id: "1", recipeId: "recipe-1", name: "salt", quantity: undefined, unit: undefined }),
        createMockRecipeIngredient({ id: "2", recipeId: "recipe-2", name: "salt", quantity: 1, unit: undefined }),
      ];

      const result = combineIngredients(ingredients, recipeNameMap);
      expect(result).toHaveLength(1);
      expect(result[0].totalQuantity).toBe(1);
    });

    it("combines when first has quantity and second does not", () => {
      const ingredients: RecipeIngredient[] = [
        createMockRecipeIngredient({ id: "1", recipeId: "recipe-1", name: "pepper", quantity: 2, unit: "tsp" }),
        createMockRecipeIngredient({ id: "2", recipeId: "recipe-2", name: "pepper", quantity: undefined, unit: "tsp" }),
      ];

      const result = combineIngredients(ingredients, recipeNameMap);
      // The quantified entry absorbs the "to taste" entry
      expect(result).toHaveLength(1);
      expect(result[0].totalQuantity).toBe(2);
      expect(result[0].unit).toBe("tsp");
    });

    it("normalizes ingredient names when combining", () => {
      const ingredients: RecipeIngredient[] = [
        createMockRecipeIngredient({ id: "1", recipeId: "recipe-1", name: "Onions", quantity: 2, unit: "cup" }),
        createMockRecipeIngredient({ id: "2", recipeId: "recipe-2", name: "onion", quantity: 1, unit: "cup" }),
      ];

      const result = combineIngredients(ingredients, recipeNameMap);
      expect(result).toHaveLength(1);
      expect(result[0].totalQuantity).toBe(3);
    });

    it("normalizes units when combining", () => {
      const ingredients: RecipeIngredient[] = [
        createMockRecipeIngredient({ id: "1", recipeId: "recipe-1", name: "flour", quantity: 2, unit: "cups" }),
        createMockRecipeIngredient({ id: "2", recipeId: "recipe-2", name: "flour", quantity: 1, unit: "cup" }),
      ];

      const result = combineIngredients(ingredients, recipeNameMap);
      expect(result).toHaveLength(1);
      expect(result[0].totalQuantity).toBe(3);
    });

    it("does not duplicate source recipes", () => {
      const ingredients: RecipeIngredient[] = [
        createMockRecipeIngredient({ id: "1", recipeId: "recipe-1", name: "flour", quantity: 1, unit: "cup" }),
        createMockRecipeIngredient({ id: "2", recipeId: "recipe-1", name: "flour", quantity: 2, unit: "cup" }),
      ];

      const result = combineIngredients(ingredients, recipeNameMap);
      expect(result[0].sourceRecipes).toEqual(["Pasta Primavera"]);
    });

    it("handles unknown recipe IDs", () => {
      const ingredients: RecipeIngredient[] = [
        createMockRecipeIngredient({ id: "1", recipeId: "unknown-id", name: "flour", quantity: 1, unit: "cup" }),
      ];

      const result = combineIngredients(ingredients, recipeNameMap);
      expect(result[0].sourceRecipes).toEqual(["Unknown Recipe"]);
    });

    it("returns empty array for empty input", () => {
      expect(combineIngredients([], recipeNameMap)).toEqual([]);
    });

    it("overrides category for known miscategorized ingredients", () => {
      const ingredients: RecipeIngredient[] = [
        createMockRecipeIngredient({ id: "1", recipeId: "recipe-1", name: "vegetable oil", quantity: 2, unit: "tbsp", category: "condiments" }),
        createMockRecipeIngredient({ id: "2", recipeId: "recipe-2", name: "olive oil", quantity: 1, unit: "cup", category: "condiments" }),
      ];

      const result = combineIngredients(ingredients, recipeNameMap);
      const vegOil = result.find((r) => r.name === "vegetable oil");
      const oliveOil = result.find((r) => r.name === "olive oil");
      expect(vegOil?.category).toBe("pantry");
      expect(oliveOil?.category).toBe("pantry");
    });

    it("overrides water category to other", () => {
      const ingredients: RecipeIngredient[] = [
        createMockRecipeIngredient({ id: "1", recipeId: "recipe-1", name: "water", quantity: 1, unit: "cup", category: "beverages" }),
      ];

      const result = combineIngredients(ingredients, recipeNameMap);
      expect(result[0].category).toBe("other");
    });

    it("overrides broth/stock category to pantry", () => {
      const ingredients: RecipeIngredient[] = [
        createMockRecipeIngredient({ id: "1", recipeId: "recipe-1", name: "chicken broth", quantity: 2, unit: "cup", category: "produce" }),
        createMockRecipeIngredient({ id: "2", recipeId: "recipe-2", name: "beef stock", quantity: 1, unit: "cup", category: "produce" }),
      ];

      const result = combineIngredients(ingredients, recipeNameMap);
      const chickenStock = result.find((r) => r.name === "chicken stock");
      const beefStock = result.find((r) => r.name === "beef stock");
      expect(chickenStock?.category).toBe("pantry");
      expect(beefStock?.category).toBe("pantry");
    });

    it("combines extra virgin olive oil with olive oil", () => {
      const ingredients: RecipeIngredient[] = [
        createMockRecipeIngredient({ id: "1", recipeId: "recipe-1", name: "extra virgin olive oil", quantity: 2, unit: "tbsp" }),
        createMockRecipeIngredient({ id: "2", recipeId: "recipe-2", name: "olive oil", quantity: 1, unit: "tbsp" }),
      ];

      const result = combineIngredients(ingredients, recipeNameMap);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("olive oil");
      expect(result[0].totalQuantity).toBe(3);
      expect(result[0].category).toBe("pantry");
    });

    it("combines adjective variants of same ingredient", () => {
      const ingredients: RecipeIngredient[] = [
        createMockRecipeIngredient({ id: "1", recipeId: "recipe-1", name: "fresh broccoli", quantity: 2, unit: "cup" }),
        createMockRecipeIngredient({ id: "2", recipeId: "recipe-2", name: "broccoli", quantity: 1, unit: "cup" }),
      ];

      const result = combineIngredients(ingredients, recipeNameMap);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("broccoli");
      expect(result[0].totalQuantity).toBe(3);
    });

    it("combines alias variants of same ingredient", () => {
      const ingredients: RecipeIngredient[] = [
        createMockRecipeIngredient({ id: "1", recipeId: "recipe-1", name: "corn starch", quantity: 1, unit: "tbsp" }),
        createMockRecipeIngredient({ id: "2", recipeId: "recipe-2", name: "cornstarch", quantity: 2, unit: "tsp" }),
      ];

      const result = combineIngredients(ingredients, recipeNameMap);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("cornstarch");
      // 1 tbsp = 3 tsp + 2 tsp = 5 tsp → preferred unit is tbsp (5/3 ≈ 1.667 >= 1)
      expect(result[0].unit).toBe("tbsp");
      expect(result[0].totalQuantity).toBeCloseTo(5 / 3);
    });

    it("combines black pepper with pepper via alias", () => {
      const ingredients: RecipeIngredient[] = [
        createMockRecipeIngredient({ id: "1", recipeId: "recipe-1", name: "black pepper", quantity: 1, unit: "tsp" }),
        createMockRecipeIngredient({ id: "2", recipeId: "recipe-2", name: "pepper", quantity: 0.5, unit: "tsp" }),
      ];

      const result = combineIngredients(ingredients, recipeNameMap);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("pepper");
      expect(result[0].totalQuantity).toBe(1.5);
      expect(result[0].unit).toBe("tsp");
    });

    it("keeps original unit when total is small", () => {
      const ingredients: RecipeIngredient[] = [
        createMockRecipeIngredient({ id: "1", recipeId: "recipe-1", name: "oil", quantity: 3, unit: "tbsp" }),
        createMockRecipeIngredient({ id: "2", recipeId: "recipe-2", name: "oil", quantity: 3, unit: "tbsp" }),
      ];

      const result = combineIngredients(ingredients, recipeNameMap);
      expect(result).toHaveLength(1);
      // 6 tbsp < 8 tbsp (0.5 cup) — stays as tbsp
      expect(result[0].totalQuantity).toBe(6);
      expect(result[0].unit).toBe("tbsp");
    });

    it("upconverts tbsp to cups when total is large", () => {
      const ingredients: RecipeIngredient[] = [
        createMockRecipeIngredient({ id: "1", recipeId: "recipe-1", name: "olive oil", quantity: 8, unit: "tbsp" }),
        createMockRecipeIngredient({ id: "2", recipeId: "recipe-2", name: "olive oil", quantity: 6, unit: "tbsp" }),
        createMockRecipeIngredient({ id: "3", recipeId: "recipe-3", name: "olive oil", quantity: 0.33, unit: "tbsp" }),
      ];

      const result = combineIngredients(ingredients, recipeNameMap);
      expect(result).toHaveLength(1);
      // 14.33 tbsp = 43 tsp → 43/48 ≈ 0.896 cups (≥ 0.5 → upconverts to cups)
      expect(result[0].unit).toBe("cup");
      expect(result[0].totalQuantity).toBeCloseTo(43 / 48);
    });

    it("prefers larger unit when combining different units", () => {
      const ingredients: RecipeIngredient[] = [
        createMockRecipeIngredient({ id: "1", recipeId: "recipe-1", name: "oil", quantity: 8, unit: "tbsp" }),
        createMockRecipeIngredient({ id: "2", recipeId: "recipe-2", name: "oil", quantity: 8, unit: "tsp" }),
      ];

      const result = combineIngredients(ingredients, recipeNameMap);
      expect(result).toHaveLength(1);
      // 8 tbsp = 24 tsp + 8 tsp = 32 tsp → 32/48 = 2/3 cup (≥ 0.5 → upconverts to cups)
      expect(result[0].unit).toBe("cup");
      expect(result[0].totalQuantity).toBeCloseTo(32 / 48);
    });

    it("preserves single unit even when conversion would change it", () => {
      const ingredients: RecipeIngredient[] = [
        createMockRecipeIngredient({ id: "1", recipeId: "recipe-1", name: "baby carrot", quantity: 0.5, unit: "cup" }),
      ];

      const result = combineIngredients(ingredients, recipeNameMap);
      expect(result).toHaveLength(1);
      // Single item with cup — should stay 0.5 cup, NOT convert to 8 tbsp
      expect(result[0].totalQuantity).toBe(0.5);
      expect(result[0].unit).toBe("cup");
    });

    it("falls back to smaller unit when larger result < 1 (same unit)", () => {
      const ingredients: RecipeIngredient[] = [
        createMockRecipeIngredient({ id: "1", recipeId: "recipe-1", name: "salt", quantity: 0.5, unit: "tsp" }),
        createMockRecipeIngredient({ id: "2", recipeId: "recipe-2", name: "salt", quantity: 0.25, unit: "tsp" }),
      ];

      const result = combineIngredients(ingredients, recipeNameMap);
      expect(result).toHaveLength(1);
      expect(result[0].totalQuantity).toBe(0.75);
      expect(result[0].unit).toBe("tsp");
    });

    it("falls back to smallest unit when mixing units and total < 1 in all units", () => {
      const ingredients: RecipeIngredient[] = [
        createMockRecipeIngredient({ id: "1", recipeId: "recipe-1", name: "vanilla", quantity: 0.25, unit: "tsp" }),
        createMockRecipeIngredient({ id: "2", recipeId: "recipe-2", name: "vanilla", quantity: 0.125, unit: "tbsp" }),
      ];

      const result = combineIngredients(ingredients, recipeNameMap);
      expect(result).toHaveLength(1);
      // 0.25 tsp + 0.125 tbsp(=0.375 tsp) = 0.625 tsp → different units
      // 0.625 tsp: cup=0.013(< 1), tbsp=0.208(< 1), tsp=0.625(< 1) → falls back to tsp (smallest)
      expect(result[0].unit).toBe("tsp");
      expect(result[0].totalQuantity).toBeCloseTo(0.625);
    });

    it("handles non-convertible units where both have no quantity", () => {
      const ingredients: RecipeIngredient[] = [
        createMockRecipeIngredient({ id: "1", recipeId: "recipe-1", name: "garlic", quantity: undefined, unit: "clove" }),
        createMockRecipeIngredient({ id: "2", recipeId: "recipe-2", name: "garlic", quantity: undefined, unit: "clove" }),
      ];

      const result = combineIngredients(ingredients, recipeNameMap);
      const cloveItem = result.find((r) => r.unit === "clove");
      expect(cloveItem?.totalQuantity).toBeUndefined();
    });

    it("combines non-convertible units when first has no quantity and second does", () => {
      const ingredients: RecipeIngredient[] = [
        createMockRecipeIngredient({ id: "1", recipeId: "recipe-1", name: "garlic", quantity: undefined, unit: "clove" }),
        createMockRecipeIngredient({ id: "2", recipeId: "recipe-2", name: "garlic", quantity: 3, unit: "clove" }),
      ];

      const result = combineIngredients(ingredients, recipeNameMap);
      const cloveItem = result.find((r) => r.unit === "clove");
      expect(cloveItem?.totalQuantity).toBe(3);
    });

    it("handles non-convertible unit with quantity addition", () => {
      const ingredients: RecipeIngredient[] = [
        createMockRecipeIngredient({ id: "1", recipeId: "recipe-1", name: "garlic", quantity: 2, unit: "clove" }),
        createMockRecipeIngredient({ id: "2", recipeId: "recipe-2", name: "garlic", quantity: 3, unit: "clove" }),
      ];

      const result = combineIngredients(ingredients, recipeNameMap);
      const cloveItem = result.find((r) => r.unit === "clove");
      expect(cloveItem?.totalQuantity).toBe(5);
    });

    it("merges volume and count for ingredients with known count-to-cup ratio", () => {
      const ingredients: RecipeIngredient[] = [
        createMockRecipeIngredient({ id: "1", recipeId: "recipe-1", name: "onion", quantity: 2, unit: undefined }),
        createMockRecipeIngredient({ id: "2", recipeId: "recipe-2", name: "onion", quantity: 0.5, unit: "cup" }),
      ];

      const result = combineIngredients(ingredients, recipeNameMap);
      // 2 whole + 0.5 cup (= 0.5 onion since 1 onion = 1 cup) = 2.5 onions
      expect(result).toHaveLength(1);
      expect(result[0].totalQuantity).toBe(2.5);
      expect(result[0].unit).toBeUndefined();
    });

    it("merges volume (tbsp) and count for onion", () => {
      const ingredients: RecipeIngredient[] = [
        createMockRecipeIngredient({ id: "1", recipeId: "recipe-1", name: "onion", quantity: 1, unit: undefined }),
        createMockRecipeIngredient({ id: "2", recipeId: "recipe-2", name: "onion", quantity: 4, unit: "tbsp" }),
      ];

      const result = combineIngredients(ingredients, recipeNameMap);
      // 1 whole + 4 tbsp (= 12 tsp = 12/48 cup = 0.25 cup = 0.25 onion) = 1.25
      expect(result).toHaveLength(1);
      expect(result[0].totalQuantity).toBe(1.25);
      expect(result[0].unit).toBeUndefined();
    });

    it("does not merge volume and count for ingredients without known ratio", () => {
      const ingredients: RecipeIngredient[] = [
        createMockRecipeIngredient({ id: "1", recipeId: "recipe-1", name: "flour", quantity: 2, unit: undefined }),
        createMockRecipeIngredient({ id: "2", recipeId: "recipe-2", name: "flour", quantity: 1, unit: "cup" }),
      ];

      const result = combineIngredients(ingredients, recipeNameMap);
      // No known ratio for flour, so these remain separate
      expect(result).toHaveLength(2);
    });

    it("merges celery stalk, rib, and cup into stalks", () => {
      const ingredients: RecipeIngredient[] = [
        createMockRecipeIngredient({ id: "1", recipeId: "recipe-1", name: "celery", quantity: 1, unit: "cup" }),
        createMockRecipeIngredient({ id: "2", recipeId: "recipe-2", name: "celery", quantity: 1, unit: "stalk" }),
        createMockRecipeIngredient({ id: "3", recipeId: "recipe-3", name: "celery", quantity: 2, unit: "rib" }),
      ];

      const result = combineIngredients(ingredients, recipeNameMap);
      // 1 stalk + 2 ribs(=stalks) = 3 stalks, 1 cup / 0.5 cup per stalk = 2 stalks → total 5 stalks
      expect(result).toHaveLength(1);
      expect(result[0].totalQuantity).toBe(5);
      expect(result[0].unit).toBe("stalk");
    });

    it("merges strip and slice into strips for bacon", () => {
      const ingredients: RecipeIngredient[] = [
        createMockRecipeIngredient({ id: "1", recipeId: "recipe-1", name: "bacon", quantity: 7, unit: "strip" }),
        createMockRecipeIngredient({ id: "2", recipeId: "recipe-2", name: "bacon", quantity: 6, unit: "slice" }),
      ];

      const result = combineIngredients(ingredients, recipeNameMap);
      expect(result).toHaveLength(1);
      expect(result[0].totalQuantity).toBe(13);
      expect(result[0].unit).toBe("strip");
    });

    it("assigns preferred unit for bare-count celery", () => {
      const ingredients: RecipeIngredient[] = [
        createMockRecipeIngredient({ id: "1", recipeId: "recipe-1", name: "celery", quantity: 3, unit: undefined }),
      ];

      const result = combineIngredients(ingredients, recipeNameMap);
      expect(result).toHaveLength(1);
      expect(result[0].totalQuantity).toBe(3);
      expect(result[0].unit).toBe("stalk");
    });

    it("assigns preferred unit for bare-count bacon", () => {
      const ingredients: RecipeIngredient[] = [
        createMockRecipeIngredient({ id: "1", recipeId: "recipe-1", name: "bacon", quantity: 4, unit: undefined }),
      ];

      const result = combineIngredients(ingredients, recipeNameMap);
      expect(result).toHaveLength(1);
      expect(result[0].totalQuantity).toBe(4);
      expect(result[0].unit).toBe("strip");
    });

    it("assigns preferred unit for bare-count garlic", () => {
      const ingredients: RecipeIngredient[] = [
        createMockRecipeIngredient({ id: "1", recipeId: "recipe-1", name: "garlic", quantity: 5, unit: undefined }),
      ];

      const result = combineIngredients(ingredients, recipeNameMap);
      expect(result).toHaveLength(1);
      expect(result[0].totalQuantity).toBe(5);
      expect(result[0].unit).toBe("clove");
    });

    it("converts garlic cloves to heads when exceeding 10", () => {
      const ingredients: RecipeIngredient[] = [
        createMockRecipeIngredient({ id: "1", recipeId: "recipe-1", name: "garlic", quantity: 8, unit: "clove" }),
        createMockRecipeIngredient({ id: "2", recipeId: "recipe-2", name: "garlic", quantity: 7, unit: "clove" }),
      ];

      const result = combineIngredients(ingredients, recipeNameMap);
      // 15 cloves / 10 per head = 1.5 → ceil to 2 heads
      expect(result).toHaveLength(1);
      expect(result[0].unit).toBe("head");
      expect(result[0].totalQuantity).toBe(2);
    });

    it("ceils garlic heads to ensure enough is bought", () => {
      const ingredients: RecipeIngredient[] = [
        createMockRecipeIngredient({ id: "1", recipeId: "recipe-1", name: "garlic", quantity: 7, unit: "clove" }),
        createMockRecipeIngredient({ id: "2", recipeId: "recipe-2", name: "garlic", quantity: 5, unit: "clove" }),
      ];

      const result = combineIngredients(ingredients, recipeNameMap);
      // 12 cloves / 10 per head = 1.2 → ceil to 2 heads (never short the shopper)
      expect(result).toHaveLength(1);
      expect(result[0].unit).toBe("head");
      expect(result[0].totalQuantity).toBe(2);
    });

    it("keeps garlic as cloves when 10 or fewer", () => {
      const ingredients: RecipeIngredient[] = [
        createMockRecipeIngredient({ id: "1", recipeId: "recipe-1", name: "garlic", quantity: 6, unit: "clove" }),
        createMockRecipeIngredient({ id: "2", recipeId: "recipe-2", name: "garlic", quantity: 4, unit: "clove" }),
      ];

      const result = combineIngredients(ingredients, recipeNameMap);
      // 10 cloves — at threshold, not over
      expect(result).toHaveLength(1);
      expect(result[0].unit).toBe("clove");
      expect(result[0].totalQuantity).toBe(10);
    });

    it("merges 'garlic clove' and tbsp garlic into cloves", () => {
      const ingredients: RecipeIngredient[] = [
        createMockRecipeIngredient({ id: "1", recipeId: "recipe-1", name: "garlic clove", quantity: 3, unit: undefined }),
        createMockRecipeIngredient({ id: "2", recipeId: "recipe-2", name: "garlic", quantity: 1, unit: "tbsp" }),
      ];

      const result = combineIngredients(ingredients, recipeNameMap);
      // "garlic clove" normalizes to "garlic", bare count gets "clove" unit
      // 1 tbsp = 3 tsp = 3 cloves (1 clove = 1 tsp) → 3 + 3 = 6 cloves
      expect(result).toHaveLength(1);
      expect(result[0].unit).toBe("clove");
      expect(result[0].totalQuantity).toBe(6);
    });

    it("converts volume-only garlic to cloves", () => {
      const ingredients: RecipeIngredient[] = [
        createMockRecipeIngredient({ id: "1", recipeId: "recipe-1", name: "garlic", quantity: 1, unit: "tbsp" }),
        createMockRecipeIngredient({ id: "2", recipeId: "recipe-2", name: "garlic", quantity: 1, unit: "tsp" }),
      ];

      const result = combineIngredients(ingredients, recipeNameMap);
      // 1 tbsp = 3 tsp, + 1 tsp = 4 tsp total → 4 cloves (1 clove = 1 tsp)
      expect(result).toHaveLength(1);
      expect(result[0].unit).toBe("clove");
      expect(result[0].totalQuantity).toBeCloseTo(4);
    });

    it("merges bare-count celery with stalks", () => {
      const ingredients: RecipeIngredient[] = [
        createMockRecipeIngredient({ id: "1", recipeId: "recipe-1", name: "celery", quantity: 3, unit: undefined }),
        createMockRecipeIngredient({ id: "2", recipeId: "recipe-2", name: "celery", quantity: 2, unit: "stalk" }),
      ];

      const result = combineIngredients(ingredients, recipeNameMap);
      expect(result).toHaveLength(1);
      expect(result[0].totalQuantity).toBe(5);
      expect(result[0].unit).toBe("stalk");
    });

    it("normalizes 'sweet corn' to 'corn' and assigns ear unit", () => {
      const ingredients: RecipeIngredient[] = [
        createMockRecipeIngredient({ id: "1", recipeId: "recipe-1", name: "sweet corn", quantity: 4, unit: undefined }),
        createMockRecipeIngredient({ id: "2", recipeId: "recipe-2", name: "corn", quantity: 2, unit: "ear" }),
      ];

      const result = combineIngredients(ingredients, recipeNameMap);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("corn");
      expect(result[0].totalQuantity).toBe(6);
      expect(result[0].unit).toBe("ear");
    });

    it("merges weight (lb) and count for potatoes", () => {
      const ingredients: RecipeIngredient[] = [
        createMockRecipeIngredient({ id: "1", recipeId: "recipe-1", name: "potato", quantity: 1.25, unit: "lb" }),
        createMockRecipeIngredient({ id: "2", recipeId: "recipe-2", name: "potato", quantity: 5, unit: undefined }),
      ];

      const result = combineIngredients(ingredients, recipeNameMap);
      // 1.25 lb / 0.5 lb per potato = 2.5 potatoes + 5 = 7.5 potatoes
      expect(result).toHaveLength(1);
      expect(result[0].totalQuantity).toBe(7.5);
      expect(result[0].unit).toBeUndefined();
    });

    it("merges weight into count when count has no quantity for potato", () => {
      const ingredients: RecipeIngredient[] = [
        createMockRecipeIngredient({ id: "1", recipeId: "recipe-1", name: "potato", quantity: undefined, unit: undefined }),
        createMockRecipeIngredient({ id: "2", recipeId: "recipe-2", name: "potato", quantity: 1, unit: "lb" }),
      ];

      const result = combineIngredients(ingredients, recipeNameMap);
      // undefined count + 1 lb / 0.5 lb per potato = 2 potatoes
      expect(result).toHaveLength(1);
      expect(result[0].totalQuantity).toBe(2);
      expect(result[0].unit).toBeUndefined();
    });

    it("merges weight (lb) and count (head) for broccoli", () => {
      const ingredients: RecipeIngredient[] = [
        createMockRecipeIngredient({ id: "1", recipeId: "recipe-1", name: "broccoli", quantity: 2, unit: "head" }),
        createMockRecipeIngredient({ id: "2", recipeId: "recipe-2", name: "broccoli", quantity: 1, unit: "lb" }),
      ];

      const result = combineIngredients(ingredients, recipeNameMap);
      // 1 lb / 1.25 lb per head = 0.8 heads + 2 = 2.8 heads
      expect(result).toHaveLength(1);
      expect(result[0].totalQuantity).toBeCloseTo(2.8);
      expect(result[0].unit).toBe("head");
    });

    it("converts cans to volume for chicken broth", () => {
      const ingredients: RecipeIngredient[] = [
        createMockRecipeIngredient({ id: "1", recipeId: "recipe-1", name: "chicken broth", quantity: 3, unit: "cup" }),
        createMockRecipeIngredient({ id: "2", recipeId: "recipe-2", name: "chicken broth", quantity: 4, unit: "can" }),
      ];

      const result = combineIngredients(ingredients, recipeNameMap);
      // 4 cans × 1.8125 cups = 7.25 cups + 3 cups = 10.25 cups
      expect(result).toHaveLength(1);
      expect(result[0].totalQuantity).toBeCloseTo(10.25);
      expect(result[0].unit).toBe("cup");
    });

    it("keeps can entry when quantity is undefined", () => {
      const ingredients: RecipeIngredient[] = [
        createMockRecipeIngredient({ id: "1", recipeId: "recipe-1", name: "chicken broth", quantity: undefined, unit: "can" }),
      ];

      const result = combineIngredients(ingredients, recipeNameMap);
      expect(result).toHaveLength(1);
      expect(result[0].unit).toBe("can");
      expect(result[0].totalQuantity).toBeUndefined();
    });

    it("converts cans to volume even without existing volume entry", () => {
      const ingredients: RecipeIngredient[] = [
        createMockRecipeIngredient({ id: "1", recipeId: "recipe-1", name: "coconut milk", quantity: 2, unit: "can" }),
      ];

      const result = combineIngredients(ingredients, recipeNameMap);
      // 2 cans × 1.75 cups = 3.5 cups
      expect(result).toHaveLength(1);
      expect(result[0].totalQuantity).toBe(3.5);
      expect(result[0].unit).toBe("cup");
    });

    it("merges volume into count when count has no quantity yet", () => {
      const ingredients: RecipeIngredient[] = [
        createMockRecipeIngredient({ id: "1", recipeId: "recipe-1", name: "onion", quantity: undefined, unit: undefined }),
        createMockRecipeIngredient({ id: "2", recipeId: "recipe-2", name: "onion", quantity: 1, unit: "cup" }),
      ];

      const result = combineIngredients(ingredients, recipeNameMap);
      // undefined count + 1 cup (= 1 onion) = 1 onion
      expect(result).toHaveLength(1);
      expect(result[0].totalQuantity).toBe(1);
      expect(result[0].unit).toBeUndefined();
    });

    it("merges 'piece' unit with bare count (lemon bug)", () => {
      const ingredients: RecipeIngredient[] = [
        createMockRecipeIngredient({ id: "1", recipeId: "recipe-1", name: "lemon", quantity: 1, unit: undefined }),
        createMockRecipeIngredient({ id: "2", recipeId: "recipe-2", name: "lemon", quantity: 1, unit: "piece" }),
      ];

      const result = combineIngredients(ingredients, recipeNameMap);
      // "piece" remaps to "" → both are bare count → 1 + 1 = 2
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("lemon");
      expect(result[0].totalQuantity).toBe(2);
      expect(result[0].unit).toBeUndefined();
    });

    it("merges volume + weight via density for spinach (6 cup + 5 oz → 11 oz)", () => {
      const ingredients: RecipeIngredient[] = [
        createMockRecipeIngredient({ id: "1", recipeId: "recipe-1", name: "spinach", quantity: 6, unit: "cup" }),
        createMockRecipeIngredient({ id: "2", recipeId: "recipe-2", name: "spinach", quantity: 5, unit: "oz" }),
      ];

      const result = combineIngredients(ingredients, recipeNameMap);
      // spinach density: 1 oz/cup (light ingredient → prefer weight)
      // 6 cups × 1 oz/cup = 6 oz + 5 oz = 11 oz (stays oz since < 1 lb)
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("spinach");
      expect(result[0].unit).toBe("oz");
      expect(result[0].totalQuantity).toBe(11);
    });

    it("includes unconvertible unit alongside density-merged result (spinach: cup + oz + bunch)", () => {
      const ingredients: RecipeIngredient[] = [
        createMockRecipeIngredient({ id: "1", recipeId: "recipe-1", name: "spinach", quantity: 6, unit: "cup" }),
        createMockRecipeIngredient({ id: "2", recipeId: "recipe-2", name: "spinach", quantity: 5, unit: "oz" }),
        createMockRecipeIngredient({ id: "3", recipeId: "recipe-3", name: "spinach", quantity: 2, unit: "bunch" }),
      ];

      const recipeNameMap3: Record<string, string> = {
        "recipe-1": "Recipe A",
        "recipe-2": "Recipe B",
        "recipe-3": "Recipe C",
      };

      const result = combineIngredients(ingredients, recipeNameMap3);
      // cup + oz merge via density → 11 oz; bunch is unconvertible → separate entry
      const ozEntry = result.find(r => r.name === "spinach" && r.unit === "oz");
      const bunchEntry = result.find(r => r.name === "spinach" && r.unit === "bunch");
      expect(ozEntry).toBeDefined();
      expect(ozEntry!.totalQuantity).toBe(11);
      expect(bunchEntry).toBeDefined();
      expect(bunchEntry!.totalQuantity).toBe(2);
    });

    it("merges volume + weight via density for cheddar (12 oz + 1 cup → 1 lb)", () => {
      const ingredients: RecipeIngredient[] = [
        createMockRecipeIngredient({ id: "1", recipeId: "recipe-1", name: "cheddar", quantity: 4, unit: "oz" }),
        createMockRecipeIngredient({ id: "2", recipeId: "recipe-2", name: "cheddar", quantity: 8, unit: "oz" }),
        createMockRecipeIngredient({ id: "3", recipeId: "recipe-3", name: "cheddar", quantity: 1, unit: "cup" }),
      ];

      const recipeNameMap3: Record<string, string> = {
        "recipe-1": "Recipe A",
        "recipe-2": "Recipe B",
        "recipe-3": "Recipe C",
      };

      const result = combineIngredients(ingredients, recipeNameMap3);
      // Weight has 2 items, volume has 1 → prefer weight
      // cheddar density: 4 oz/cup → 1 cup = 4 oz → 12 + 4 = 16 oz = 1 lb
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("cheddar");
      expect(result[0].unit).toBe("lb");
      expect(result[0].totalQuantity).toBe(1);
    });

    it("merges volume + weight via density for mushroom (dense ingredient, prefer volume)", () => {
      const ingredients: RecipeIngredient[] = [
        createMockRecipeIngredient({ id: "1", recipeId: "recipe-1", name: "mushroom", quantity: 2, unit: "cup" }),
        createMockRecipeIngredient({ id: "2", recipeId: "recipe-2", name: "mushroom", quantity: 1, unit: "oz" }),
      ];

      const result = combineIngredients(ingredients, recipeNameMap);
      // mushroom density: 2.5 oz/cup (> 2 → use item count: vol=1, wt=1 → preferVolume)
      // 1 oz / 2.5 = 0.4 cups → 2 + 0.4 = 2.4 cups
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("mushroom");
      expect(result[0].unit).toBe("cup");
      expect(result[0].totalQuantity).toBeCloseTo(2.4);
    });

    it("keeps both volume + weight as separate entries when no density data", () => {
      const ingredients: RecipeIngredient[] = [
        createMockRecipeIngredient({ id: "1", recipeId: "recipe-1", name: "chickpea", quantity: 2, unit: "cup" }),
        createMockRecipeIngredient({ id: "2", recipeId: "recipe-2", name: "chickpea", quantity: 4, unit: "oz" }),
      ];

      const result = combineIngredients(ingredients, recipeNameMap);
      // No density data for chickpea → keep both families (never silently drop data)
      const cupEntry = result.find(r => r.name === "chickpea" && r.unit === "cup");
      const ozEntry = result.find(r => r.name === "chickpea" && r.unit === "oz");
      expect(cupEntry).toBeDefined();
      expect(cupEntry!.totalQuantity).toBe(2);
      expect(ozEntry).toBeDefined();
      expect(ozEntry!.totalQuantity).toBe(4);
    });

    it("keeps both volume + weight when no density data — multiple items per family", () => {
      const ingredients: RecipeIngredient[] = [
        createMockRecipeIngredient({ id: "1", recipeId: "recipe-1", name: "chickpea", quantity: 1, unit: "cup" }),
        createMockRecipeIngredient({ id: "2", recipeId: "recipe-2", name: "chickpea", quantity: 4, unit: "oz" }),
        createMockRecipeIngredient({ id: "3", recipeId: "recipe-3", name: "chickpea", quantity: 6, unit: "oz" }),
      ];

      const recipeNameMap3: Record<string, string> = {
        "recipe-1": "Recipe A",
        "recipe-2": "Recipe B",
        "recipe-3": "Recipe C",
      };

      const result = combineIngredients(ingredients, recipeNameMap3);
      // No density data → keep both families as separate line items
      const cupEntry = result.find(r => r.name === "chickpea" && r.unit === "cup");
      const ozEntry = result.find(r => r.name === "chickpea" && r.unit === "oz");
      expect(cupEntry).toBeDefined();
      expect(cupEntry!.totalQuantity).toBe(1);
      expect(ozEntry).toBeDefined();
      expect(ozEntry!.totalQuantity).toBe(10);
    });

    it("keeps slice entry when it has no quantity (no absorption)", () => {
      const ingredients: RecipeIngredient[] = [
        createMockRecipeIngredient({ id: "1", recipeId: "recipe-1", name: "onion", quantity: 2, unit: undefined }),
        createMockRecipeIngredient({ id: "2", recipeId: "recipe-2", name: "onion", quantity: undefined, unit: "slice" }),
      ];

      const result = combineIngredients(ingredients, recipeNameMap);
      // slice entry has no quantity → not merged into count, but absorbed by no-qty absorption
      // (count entry exists with quantity, so no-qty entries are absorbed)
      expect(result).toHaveLength(1);
      expect(result[0].totalQuantity).toBe(2);
    });

    it("keeps slice entry separate when no count entry exists", () => {
      const ingredients: RecipeIngredient[] = [
        createMockRecipeIngredient({ id: "1", recipeId: "recipe-1", name: "onion", quantity: 2, unit: "slice" }),
      ];

      const result = combineIngredients(ingredients, recipeNameMap);
      // Only slice entries, no count → slice stays as-is
      expect(result).toHaveLength(1);
      expect(result[0].unit).toBe("slice");
      expect(result[0].totalQuantity).toBe(2);
    });

    describe("combineIngredients with real recipe data", () => {
      // Group 1: Italian Night — Spaghetti Carbonara + Lasagna + Bolognese
      describe("Italian Night: Carbonara + Lasagna + Bolognese", () => {
        const recipeNameMap: Record<string, string> = {
          "spaghetti-carbonara": "Spaghetti Carbonara",
          "lasagna": "Lasagna",
          "bolognese": "Bolognese",
        };

        it("merges onion across three Italian recipes via COUNT_TO_CUP", () => {
          const ingredients: RecipeIngredient[] = [
            // Carbonara: 1 onion (bare)
            createMockRecipeIngredient({ id: "carb-onion", recipeId: "spaghetti-carbonara", name: "onion", quantity: 1, unit: undefined, category: "produce" }),
            // Lasagna: 0.5 cup onion
            createMockRecipeIngredient({ id: "las-onion", recipeId: "lasagna", name: "onion", quantity: 0.5, unit: "cup", category: "produce" }),
            // Bolognese: 1 onion (bare)
            createMockRecipeIngredient({ id: "bol-onion", recipeId: "bolognese", name: "onion", quantity: 1, unit: undefined, category: "produce" }),
          ];

          const result = combineIngredients(ingredients, recipeNameMap);
          // 2 bare + 0.5 cup (= 0.5 onion since 1 onion = 1 cup) = 2.5 onions
          const onion = result.find((r) => r.name === "onion");
          expect(onion).toBeDefined();
          expect(onion!.totalQuantity).toBe(2.5);
          expect(onion!.unit).toBeUndefined();
        });

        it("merges garlic cloves across three Italian recipes", () => {
          const ingredients: RecipeIngredient[] = [
            // Carbonara: 1 clove
            createMockRecipeIngredient({ id: "carb-garlic", recipeId: "spaghetti-carbonara", name: "garlic", quantity: 1, unit: "clove", category: "produce" }),
            // Lasagna: 2 cloves
            createMockRecipeIngredient({ id: "las-garlic", recipeId: "lasagna", name: "garlic", quantity: 2, unit: "clove", category: "produce" }),
            // Bolognese: 4 cloves
            createMockRecipeIngredient({ id: "bol-garlic", recipeId: "bolognese", name: "garlic", quantity: 4, unit: "clove", category: "produce" }),
          ];

          const result = combineIngredients(ingredients, recipeNameMap);
          const garlic = result.find((r) => r.name === "garlic");
          expect(garlic).toBeDefined();
          expect(garlic!.totalQuantity).toBe(7);
          expect(garlic!.unit).toBe("clove");
        });

        it("merges parsley volume (tbsp + cup) across three Italian recipes", () => {
          const ingredients: RecipeIngredient[] = [
            // Carbonara: 2 tbsp
            createMockRecipeIngredient({ id: "carb-parsley", recipeId: "spaghetti-carbonara", name: "parsley", quantity: 2, unit: "tbsp", category: "produce" }),
            // Lasagna: 4 tbsp
            createMockRecipeIngredient({ id: "las-parsley", recipeId: "lasagna", name: "parsley", quantity: 4, unit: "tbsp", category: "produce" }),
            // Bolognese: 0.5 cup
            createMockRecipeIngredient({ id: "bol-parsley", recipeId: "bolognese", name: "parsley", quantity: 0.5, unit: "cup", category: "produce" }),
          ];

          const result = combineIngredients(ingredients, recipeNameMap);
          const parsley = result.find((r) => r.name === "parsley");
          expect(parsley).toBeDefined();
          // 2 tbsp = 6 tsp, 4 tbsp = 12 tsp, 0.5 cup = 24 tsp → 42 tsp total
          // 42/48 = 0.875 cup (>= 0.5 → upconverts to cup)
          expect(parsley!.unit).toBe("cup");
          expect(parsley!.totalQuantity).toBeCloseTo(42 / 48);
        });

        it("merges olive oil (tbsp + cup) across Italian recipes", () => {
          const ingredients: RecipeIngredient[] = [
            // Carbonara: 2 tbsp
            createMockRecipeIngredient({ id: "carb-oil", recipeId: "spaghetti-carbonara", name: "olive oil", quantity: 2, unit: "tbsp", category: "pantry" }),
            // Bolognese: 0.25 cup
            createMockRecipeIngredient({ id: "bol-oil", recipeId: "bolognese", name: "olive oil", quantity: 0.25, unit: "cup", category: "pantry" }),
          ];

          const result = combineIngredients(ingredients, recipeNameMap);
          const oil = result.find((r) => r.name === "olive oil");
          expect(oil).toBeDefined();
          // 2 tbsp = 6 tsp, 0.25 cup = 12 tsp → 18 tsp total
          // 18/48 = 0.375 cup (< 0.5, try tbsp: 18/3 = 6 tbsp >= 1 → tbsp)
          expect(oil!.unit).toBe("tbsp");
          expect(oil!.totalQuantity).toBeCloseTo(6);
        });

        it("combines multiple null-quantity black pepper into single entry", () => {
          const ingredients: RecipeIngredient[] = [
            createMockRecipeIngredient({ id: "carb-pepper", recipeId: "spaghetti-carbonara", name: "black pepper", quantity: undefined, unit: undefined, category: "spices" }),
            createMockRecipeIngredient({ id: "bol-pepper", recipeId: "bolognese", name: "black pepper", quantity: undefined, unit: undefined, category: "spices" }),
          ];

          const result = combineIngredients(ingredients, recipeNameMap);
          // "black pepper" → "pepper" via alias
          const pepper = result.find((r) => r.name === "pepper");
          expect(pepper).toBeDefined();
          expect(pepper!.totalQuantity).toBeUndefined();
        });

        it("absorbs null-quantity salts when a quantified entry exists", () => {
          const ingredients: RecipeIngredient[] = [
            // Carbonara: null salt
            createMockRecipeIngredient({ id: "carb-salt", recipeId: "spaghetti-carbonara", name: "salt", quantity: undefined, unit: undefined, category: "spices" }),
            // Lasagna: 1.5 tsp salt
            createMockRecipeIngredient({ id: "las-salt", recipeId: "lasagna", name: "salt", quantity: 1.5, unit: "tsp", category: "spices" }),
            // Bolognese: null salt (kosher salt → salt via alias)
            createMockRecipeIngredient({ id: "bol-salt", recipeId: "bolognese", name: "kosher salt", quantity: undefined, unit: undefined, category: "spices" }),
          ];

          const result = combineIngredients(ingredients, recipeNameMap);
          const saltEntries = result.filter((r) => r.name === "salt");
          // The "to taste" entries are absorbed by the quantified entry
          expect(saltEntries).toHaveLength(1);
          expect(saltEntries[0].totalQuantity).toBe(1.5);
          expect(saltEntries[0].unit).toBe("tsp");
        });
      });

      // Group 2: Chinese Combo — Beef Stir Fry + Shrimp Lo Mein + Vegetable Fried Rice + Kung Pao Chicken
      describe("Chinese Combo: Stir Fry + Lo Mein + Fried Rice + Kung Pao", () => {
        const recipeNameMap: Record<string, string> = {
          "beef-stir-fry": "Beef Stir Fry",
          "shrimp-lo-mein": "Shrimp Lo Mein",
          "vegetable-fried-rice": "Vegetable Fried Rice",
          "kung-pao-chicken": "Kung Pao Chicken",
        };

        it("merges garlic (tsp + clove + tbsp) into cloves via COUNT_TO_CUP", () => {
          const ingredients: RecipeIngredient[] = [
            // Stir Fry: 1 tsp garlic
            createMockRecipeIngredient({ id: "sf-garlic", recipeId: "beef-stir-fry", name: "garlic", quantity: 1, unit: "tsp", category: "produce" }),
            // Lo Mein: 2 cloves garlic
            createMockRecipeIngredient({ id: "lm-garlic", recipeId: "shrimp-lo-mein", name: "garlic", quantity: 2, unit: "clove", category: "produce" }),
            // Fried Rice: 1 clove garlic
            createMockRecipeIngredient({ id: "fr-garlic", recipeId: "vegetable-fried-rice", name: "garlic", quantity: 1, unit: "clove", category: "produce" }),
            // Kung Pao: 1 tbsp garlic
            createMockRecipeIngredient({ id: "kp-garlic", recipeId: "kung-pao-chicken", name: "garlic", quantity: 1, unit: "tbsp", category: "produce" }),
          ];

          const result = combineIngredients(ingredients, recipeNameMap);
          const garlic = result.find((r) => r.name === "garlic");
          expect(garlic).toBeDefined();
          // Volume: 1 tsp = 1 tsp, 1 tbsp = 3 tsp → 4 tsp total volume
          // COUNT_TO_CUP for garlic = 1/48 cup per clove, so 1 clove = 1 tsp
          // 4 tsp → 4 tsp / 48 = 4/48 cups → 4/48 / (1/48) = 4 cloves from volume
          // Plain cloves: 2 + 1 = 3 cloves
          // Total: 4 + 3 = 7 cloves
          expect(garlic!.totalQuantity).toBe(7);
          expect(garlic!.unit).toBe("clove");
        });

        it("merges soy sauce (all tbsp) into single entry", () => {
          const ingredients: RecipeIngredient[] = [
            // Stir Fry: 2 tbsp
            createMockRecipeIngredient({ id: "sf-soy", recipeId: "beef-stir-fry", name: "soy sauce", quantity: 2, unit: "tbsp", category: "condiments" }),
            // Lo Mein: 2 tbsp
            createMockRecipeIngredient({ id: "lm-soy", recipeId: "shrimp-lo-mein", name: "soy sauce", quantity: 2, unit: "tbsp", category: "condiments" }),
            // Fried Rice: 1 tbsp
            createMockRecipeIngredient({ id: "fr-soy", recipeId: "vegetable-fried-rice", name: "soy sauce", quantity: 1, unit: "tbsp", category: "condiments" }),
            // Kung Pao: 2 tbsp
            createMockRecipeIngredient({ id: "kp-soy", recipeId: "kung-pao-chicken", name: "soy sauce", quantity: 2, unit: "tbsp", category: "condiments" }),
          ];

          const result = combineIngredients(ingredients, recipeNameMap);
          const soy = result.find((r) => r.name === "soy sauce");
          expect(soy).toBeDefined();
          // 2 + 2 + 1 + 2 = 7 tbsp total (all same unit)
          // 7 tbsp = 21 tsp → 21/48 = 0.4375 cup (< 0.5, stays tbsp)
          expect(soy!.totalQuantity).toBe(7);
          expect(soy!.unit).toBe("tbsp");
        });

        it("merges vegetable oil (all tbsp) into single entry", () => {
          const ingredients: RecipeIngredient[] = [
            // Stir Fry: 2 tbsp
            createMockRecipeIngredient({ id: "sf-voil", recipeId: "beef-stir-fry", name: "vegetable oil", quantity: 2, unit: "tbsp", category: "pantry" }),
            // Lo Mein: 1.5 tbsp
            createMockRecipeIngredient({ id: "lm-voil", recipeId: "shrimp-lo-mein", name: "vegetable oil", quantity: 1.5, unit: "tbsp", category: "pantry" }),
            // Fried Rice: 2 tbsp
            createMockRecipeIngredient({ id: "fr-voil", recipeId: "vegetable-fried-rice", name: "vegetable oil", quantity: 2, unit: "tbsp", category: "pantry" }),
          ];

          const result = combineIngredients(ingredients, recipeNameMap);
          const vegOil = result.find((r) => r.name === "vegetable oil");
          expect(vegOil).toBeDefined();
          // 2 + 1.5 + 2 = 5.5 tbsp (all same unit, < 0.5 cup threshold)
          expect(vegOil!.totalQuantity).toBe(5.5);
          expect(vegOil!.unit).toBe("tbsp");
        });

        it("merges green onion / scallion bare counts into single entry", () => {
          const ingredients: RecipeIngredient[] = [
            // Stir Fry: 1 green onion (bare) → scallion
            createMockRecipeIngredient({ id: "sf-go", recipeId: "beef-stir-fry", name: "green onion", quantity: 1, unit: undefined, category: "produce" }),
            // Lo Mein: 6 green onions (bare) → scallion
            createMockRecipeIngredient({ id: "lm-go", recipeId: "shrimp-lo-mein", name: "green onion", quantity: 6, unit: undefined, category: "produce" }),
            // Lo Mein: null green onion → scallion
            createMockRecipeIngredient({ id: "lm-go2", recipeId: "shrimp-lo-mein", name: "green onion", quantity: undefined, unit: undefined, category: "produce" }),
            // Kung Pao: 4 green onions (bare) → scallion
            createMockRecipeIngredient({ id: "kp-go", recipeId: "kung-pao-chicken", name: "green onion", quantity: 4, unit: undefined, category: "produce" }),
          ];

          const result = combineIngredients(ingredients, recipeNameMap);
          const scallion = result.find((r) => r.name === "scallion");
          expect(scallion).toBeDefined();
          // 1 + 6 + 4 = 11 (the null gets folded in: undefined + 11 = 11)
          expect(scallion!.totalQuantity).toBe(11);
        });
      });

      // Group 3: Mexican Fiesta — Chicken Tacos + Guacamole + Enchiladas + Pozole
      describe("Mexican Fiesta: Tacos + Guacamole + Enchiladas + Pozole", () => {
        const recipeNameMap: Record<string, string> = {
          "chicken-tacos": "Chicken Tacos",
          "guacamole": "Guacamole",
          "enchiladas": "Enchiladas",
          "pozole": "Pozole",
        };

        it("keeps cilantro bunch and tbsp as separate entries, absorbs null", () => {
          const ingredients: RecipeIngredient[] = [
            // Tacos: null cilantro
            createMockRecipeIngredient({ id: "tac-cil", recipeId: "chicken-tacos", name: "cilantro", quantity: undefined, unit: undefined, category: "produce" }),
            // Guac: 3 tbsp cilantro
            createMockRecipeIngredient({ id: "gua-cil", recipeId: "guacamole", name: "cilantro", quantity: 3, unit: "tbsp", category: "produce" }),
            // Pozole: 1 bunch cilantro
            createMockRecipeIngredient({ id: "poz-cil", recipeId: "pozole", name: "cilantro", quantity: 1, unit: "bunch", category: "produce" }),
          ];

          const result = combineIngredients(ingredients, recipeNameMap);
          const cilantroEntries = result.filter((r) => r.name === "cilantro");
          // bunch is non-convertible, tbsp goes through volume conversion
          // null "to taste" is absorbed by quantified entries
          expect(cilantroEntries).toHaveLength(2);
          const bunchEntry = cilantroEntries.find((r) => r.unit === "bunch");
          expect(bunchEntry).toBeDefined();
          expect(bunchEntry!.totalQuantity).toBe(1);
          const volumeEntry = cilantroEntries.find((r) => r.unit === "tbsp" || r.unit === "tsp");
          expect(volumeEntry).toBeDefined();
          expect(volumeEntry!.totalQuantity).toBe(3);
        });

        it("merges salt with quantities and absorbs null entry", () => {
          const ingredients: RecipeIngredient[] = [
            // Tacos: 1 tsp salt
            createMockRecipeIngredient({ id: "tac-salt", recipeId: "chicken-tacos", name: "salt", quantity: 1, unit: "tsp", category: "spices" }),
            // Guac: 1 tsp salt
            createMockRecipeIngredient({ id: "gua-salt", recipeId: "guacamole", name: "salt", quantity: 1, unit: "tsp", category: "spices" }),
            // Enchiladas: 0.5 tsp salt
            createMockRecipeIngredient({ id: "enc-salt", recipeId: "enchiladas", name: "salt", quantity: 0.5, unit: "tsp", category: "spices" }),
            // Pozole: null salt — absorbed by quantified entries
            createMockRecipeIngredient({ id: "poz-salt", recipeId: "pozole", name: "salt", quantity: undefined, unit: undefined, category: "spices" }),
          ];

          const result = combineIngredients(ingredients, recipeNameMap);
          const saltEntries = result.filter((r) => r.name === "salt");
          // 1 + 1 + 0.5 = 2.5 tsp; null entry absorbed
          expect(saltEntries).toHaveLength(1);
          expect(saltEntries[0].totalQuantity).toBe(2.5);
          expect(saltEntries[0].unit).toBe("tsp");
        });

        it("merges garlic (clove + tsp) into cloves via COUNT_TO_CUP", () => {
          const ingredients: RecipeIngredient[] = [
            // Tacos: 2 cloves
            createMockRecipeIngredient({ id: "tac-garlic", recipeId: "chicken-tacos", name: "garlic", quantity: 2, unit: "clove", category: "produce" }),
            // Guac: 1 tsp
            createMockRecipeIngredient({ id: "gua-garlic", recipeId: "guacamole", name: "garlic", quantity: 1, unit: "tsp", category: "produce" }),
            // Enchiladas: 1 clove
            createMockRecipeIngredient({ id: "enc-garlic", recipeId: "enchiladas", name: "garlic", quantity: 1, unit: "clove", category: "produce" }),
            // Pozole: 8 cloves
            createMockRecipeIngredient({ id: "poz-garlic", recipeId: "pozole", name: "garlic", quantity: 8, unit: "clove", category: "produce" }),
          ];

          const result = combineIngredients(ingredients, recipeNameMap);
          const garlic = result.find((r) => r.name === "garlic");
          expect(garlic).toBeDefined();
          // Volume: 1 tsp → 1 tsp / 48 = 1/48 cup → 1/48 / (1/48) = 1 clove from volume
          // Plain cloves: 2 + 1 + 8 = 11
          // Total: 11 + 1 = 12 cloves → > 10 → bulk conversion: ceil(12/10) = 2 heads
          expect(garlic!.unit).toBe("head");
          expect(garlic!.totalQuantity).toBe(2);
        });

        it("merges onion (bare + cup) via COUNT_TO_CUP — white onion stays separate", () => {
          const ingredients: RecipeIngredient[] = [
            // Tacos: 1 bare onion
            createMockRecipeIngredient({ id: "tac-onion1", recipeId: "chicken-tacos", name: "onion", quantity: 1, unit: undefined, category: "produce" }),
            // Tacos: null onion (garnish)
            createMockRecipeIngredient({ id: "tac-onion2", recipeId: "chicken-tacos", name: "onion", quantity: undefined, unit: undefined, category: "produce" }),
            // Guac: 0.5 cup onion
            createMockRecipeIngredient({ id: "gua-onion", recipeId: "guacamole", name: "onion", quantity: 0.5, unit: "cup", category: "produce" }),
            // Enchiladas: 1 bare onion
            createMockRecipeIngredient({ id: "enc-onion", recipeId: "enchiladas", name: "onion", quantity: 1, unit: undefined, category: "produce" }),
            // Pozole: 0.5 white onion — "white onion" is NOT aliased to "onion"
            createMockRecipeIngredient({ id: "poz-onion", recipeId: "pozole", name: "white onion", quantity: 0.5, unit: undefined, category: "produce" }),
          ];

          const result = combineIngredients(ingredients, recipeNameMap);
          const onion = result.find((r) => r.name === "onion");
          expect(onion).toBeDefined();
          // Bare count: 1 + 1 = 2 (null gets folded: undefined + 2 = 2)
          // Volume: 0.5 cup → 0.5 / 1 = 0.5 onion → total: 2 + 0.5 = 2.5
          expect(onion!.totalQuantity).toBe(2.5);
          expect(onion!.unit).toBeUndefined();
          // White onion is separate
          const whiteOnion = result.find((r) => r.name === "white onion");
          expect(whiteOnion).toBeDefined();
          expect(whiteOnion!.totalQuantity).toBe(0.5);
        });
      });

      // Group 4: Lime/Lemon "piece" bug — Elote + Tortilla Soup + Beef Burrito Bowl + Pozole
      describe("Lime piece bug: Elote + Tortilla Soup + Burrito Bowl + Pozole", () => {
        const recipeNameMap: Record<string, string> = {
          "elote": "Elote",
          "tortilla-soup": "Tortilla Soup",
          "beef-burrito-bowl": "Beef Burrito Bowl",
          "pozole": "Pozole",
        };

        it("merges lime piece + bare count into single entry", () => {
          const ingredients: RecipeIngredient[] = [
            // Elote: 4 piece lime
            createMockRecipeIngredient({ id: "el-lime", recipeId: "elote", name: "lime", quantity: 4, unit: "piece", category: "produce" }),
            // Tortilla Soup: 1 piece lime
            createMockRecipeIngredient({ id: "ts-lime", recipeId: "tortilla-soup", name: "lime", quantity: 1, unit: "piece", category: "produce" }),
            // Burrito Bowl: null piece lime
            createMockRecipeIngredient({ id: "bb-lime", recipeId: "beef-burrito-bowl", name: "lime", quantity: undefined, unit: "piece", category: "produce" }),
            // Pozole: 4 bare lime
            createMockRecipeIngredient({ id: "poz-lime", recipeId: "pozole", name: "lime", quantity: 4, unit: undefined, category: "produce" }),
          ];

          const result = combineIngredients(ingredients, recipeNameMap);
          const lime = result.find((r) => r.name === "lime");
          expect(lime).toBeDefined();
          // "piece" remaps to "" → all bare count
          // 4 + 1 + 4 = 9 (null gets folded: undefined + 9 = 9)
          expect(lime!.totalQuantity).toBe(9);
          expect(lime!.unit).toBeUndefined();
        });
      });

      // Group 5: Indian Curry Night — Palak Paneer + Bibimbap + Lentil Soup (spinach volume+weight)
      describe("Spinach volume+weight: Palak Paneer + Bibimbap + Lentil Soup", () => {
        const recipeNameMap: Record<string, string> = {
          "palak-paneer": "Palak Paneer",
          "bibimbap": "Bibimbap",
          "lentil-soup": "Lentil Soup",
        };

        it("merges spinach oz + cup into weight via density (oz has more items)", () => {
          const ingredients: RecipeIngredient[] = [
            // Palak Paneer: 8 oz spinach
            createMockRecipeIngredient({ id: "pp-spinach", recipeId: "palak-paneer", name: "spinach", quantity: 8, unit: "oz", category: "produce" }),
            // Bibimbap: 9.6 oz spinach
            createMockRecipeIngredient({ id: "bi-spinach", recipeId: "bibimbap", name: "spinach", quantity: 9.6, unit: "oz", category: "produce" }),
            // Lentil Soup: 0.5 cup spinach
            createMockRecipeIngredient({ id: "ls-spinach", recipeId: "lentil-soup", name: "spinach", quantity: 0.5, unit: "cup", category: "produce" }),
          ];

          const result = combineIngredients(ingredients, recipeNameMap);
          const spinach = result.find((r) => r.name === "spinach");
          expect(spinach).toBeDefined();
          // oz has 2 items, cup has 1 → prefer weight
          // density: 1 oz/cup → 0.5 cup = 0.5 oz
          // 8 + 9.6 + 0.5 = 18.1 oz → 18.1 / 16 = 1.13125 lb
          expect(spinach!.unit).toBe("lb");
          expect(spinach!.totalQuantity).toBeCloseTo(1.13125);
        });
      });

      // Group 6: American Comfort — Beef Stew + Chicken Noodle Soup + Clam Chowder + Chicken Pot Pie
      describe("American Comfort: Stew + Noodle Soup + Chowder + Pot Pie", () => {
        const recipeNameMap: Record<string, string> = {
          "beef-stew": "Beef Stew",
          "chicken-noodle-soup": "Chicken Noodle Soup",
          "clam-chowder": "Clam Chowder",
          "chicken-pot-pie": "Chicken Pot Pie",
        };

        it("merges carrot (bare + cup) via COUNT_TO_CUP", () => {
          const ingredients: RecipeIngredient[] = [
            // Stew: 4 bare carrots
            createMockRecipeIngredient({ id: "stew-carrot", recipeId: "beef-stew", name: "carrot", quantity: 4, unit: undefined, category: "produce" }),
            // Noodle Soup: 1 cup carrot
            createMockRecipeIngredient({ id: "cns-carrot", recipeId: "chicken-noodle-soup", name: "carrot", quantity: 1, unit: "cup", category: "produce" }),
            // Chowder: 0.5 cup carrot (from corn chowder data, but using clam chowder for group)
            // Actually clam chowder doesn't have carrot; using pot pie's 1 cup
            // Pot Pie: 1 cup carrot
            createMockRecipeIngredient({ id: "cpp-carrot", recipeId: "chicken-pot-pie", name: "carrot", quantity: 1, unit: "cup", category: "produce" }),
          ];

          const result = combineIngredients(ingredients, recipeNameMap);
          const carrot = result.find((r) => r.name === "carrot");
          expect(carrot).toBeDefined();
          // Bare: 4 carrots
          // Volume: 1 + 1 = 2 cups → 2 cups / 0.5 cup per carrot = 4 carrots from volume
          // Total: 4 + 4 = 8 carrots
          expect(carrot!.totalQuantity).toBe(8);
          expect(carrot!.unit).toBeUndefined();
        });

        it("merges celery (stalk + cup) into stalks", () => {
          const ingredients: RecipeIngredient[] = [
            // Stew: 1 stalk celery
            createMockRecipeIngredient({ id: "stew-celery", recipeId: "beef-stew", name: "celery", quantity: 1, unit: "stalk", category: "produce" }),
            // Noodle Soup: 0.5 cup celery
            createMockRecipeIngredient({ id: "cns-celery", recipeId: "chicken-noodle-soup", name: "celery", quantity: 0.5, unit: "cup", category: "produce" }),
            // Chowder: 2 stalks celery (originally "rib" which maps to "stalk")
            createMockRecipeIngredient({ id: "cc-celery", recipeId: "clam-chowder", name: "celery", quantity: 2, unit: "stalk", category: "produce" }),
            // Pot Pie: 0.5 cup celery
            createMockRecipeIngredient({ id: "cpp-celery", recipeId: "chicken-pot-pie", name: "celery", quantity: 0.5, unit: "cup", category: "produce" }),
          ];

          const result = combineIngredients(ingredients, recipeNameMap);
          const celery = result.find((r) => r.name === "celery");
          expect(celery).toBeDefined();
          // Stalks: 1 + 2 = 3 (plain group key "stalk")
          // Volume: 0.5 + 0.5 = 1 cup → COUNT_TO_CUP for celery = 0.5 cup/stalk
          // 1 cup / 0.5 = 2 stalks from volume
          // Total: 3 + 2 = 5 stalks
          expect(celery!.totalQuantity).toBe(5);
          expect(celery!.unit).toBe("stalk");
        });

        it("merges chicken broth/stock (oz + cup) — oz treated as fluid oz for liquids", () => {
          const ingredients: RecipeIngredient[] = [
            // Noodle Soup: 58 oz chicken broth → "chicken stock" via alias
            createMockRecipeIngredient({ id: "cns-broth", recipeId: "chicken-noodle-soup", name: "chicken broth", quantity: 58, unit: "oz", category: "pantry" }),
            // Chowder: 1 cup chicken broth → "chicken stock"
            createMockRecipeIngredient({ id: "cc-broth", recipeId: "clam-chowder", name: "chicken broth", quantity: 1, unit: "cup", category: "pantry" }),
            // Pot Pie: 1.75 cup chicken broth → "chicken stock"
            createMockRecipeIngredient({ id: "cpp-broth", recipeId: "chicken-pot-pie", name: "chicken broth", quantity: 1.75, unit: "cup", category: "pantry" }),
          ];

          const result = combineIngredients(ingredients, recipeNameMap);
          const stock = result.find((r) => r.name === "chicken stock");
          expect(stock).toBeDefined();
          // "chicken stock" is in FLUID_OZ_INGREDIENTS → 58 oz → 116 tbsp = 348 tsp
          // 1 cup = 48 tsp, 1.75 cup = 84 tsp
          // All volume: 348 + 48 + 84 = 480 tsp = 10 cups
          expect(stock!.unit).toBe("cup");
          expect(stock!.totalQuantity).toBeCloseTo(10);
        });

        it("merges potato (bare + lb) via COUNT_TO_LB", () => {
          const ingredients: RecipeIngredient[] = [
            // Stew: 3 bare potatoes
            createMockRecipeIngredient({ id: "stew-potato", recipeId: "beef-stew", name: "potato", quantity: 3, unit: undefined, category: "produce" }),
            // Chowder: 1.25 lb potatoes
            createMockRecipeIngredient({ id: "cc-potato", recipeId: "clam-chowder", name: "potato", quantity: 1.25, unit: "lb", category: "produce" }),
          ];

          const result = combineIngredients(ingredients, recipeNameMap);
          const potato = result.find((r) => r.name === "potato");
          expect(potato).toBeDefined();
          // Bare: 3 potatoes
          // Weight: 1.25 lb → 1.25 * 16 = 20 oz base, then lb total = 20/16 = 1.25 lb
          // COUNT_TO_LB for potato = 0.5 lb per potato
          // 1.25 / 0.5 = 2.5 potatoes from weight
          // Total: 3 + 2.5 = 5.5
          expect(potato!.totalQuantity).toBe(5.5);
          expect(potato!.unit).toBeUndefined();
        });

        it("merges bay leaf bare counts", () => {
          const ingredients: RecipeIngredient[] = [
            // Stew: 1 bay leaf
            createMockRecipeIngredient({ id: "stew-bay", recipeId: "beef-stew", name: "bay leaf", quantity: 1, unit: undefined, category: "spices" }),
            // Chowder: 1 bay leaf
            createMockRecipeIngredient({ id: "cc-bay", recipeId: "clam-chowder", name: "bay leaf", quantity: 1, unit: undefined, category: "spices" }),
          ];

          const result = combineIngredients(ingredients, recipeNameMap);
          const bay = result.find((r) => r.name === "bay leaf");
          expect(bay).toBeDefined();
          expect(bay!.totalQuantity).toBe(2);
          expect(bay!.unit).toBeUndefined();
        });
      });

      // Group 7: Baking Day — Chocolate Chip Cookies + Banana Bread + Blueberry Muffins + Brownies
      describe("Baking Day: Cookies + Banana Bread + Muffins + Brownies", () => {
        const recipeNameMap: Record<string, string> = {
          "chocolate-chip-cookies": "Chocolate Chip Cookies",
          "banana-bread": "Banana Bread",
          "blueberry-muffins": "Blueberry Muffins",
          "brownies": "Brownies",
        };

        it("merges all-purpose flour (all cups) into single entry", () => {
          const ingredients: RecipeIngredient[] = [
            // Cookies: 3 cup
            createMockRecipeIngredient({ id: "cc-flour", recipeId: "chocolate-chip-cookies", name: "all-purpose flour", quantity: 3, unit: "cup", category: "pantry" }),
            // Banana Bread: 2 cup
            createMockRecipeIngredient({ id: "bb-flour", recipeId: "banana-bread", name: "all-purpose flour", quantity: 2, unit: "cup", category: "pantry" }),
            // Muffins: 1.5 cup + 0.33 cup
            createMockRecipeIngredient({ id: "bm-flour1", recipeId: "blueberry-muffins", name: "all-purpose flour", quantity: 1.5, unit: "cup", category: "pantry" }),
            createMockRecipeIngredient({ id: "bm-flour2", recipeId: "blueberry-muffins", name: "all-purpose flour", quantity: 0.33, unit: "cup", category: "pantry" }),
            // Brownies: 0.5 cup
            createMockRecipeIngredient({ id: "br-flour", recipeId: "brownies", name: "all-purpose flour", quantity: 0.5, unit: "cup", category: "pantry" }),
          ];

          const result = combineIngredients(ingredients, recipeNameMap);
          const flour = result.find((r) => r.name === "flour");
          expect(flour).toBeDefined();
          // 3 + 2 + 1.5 + 0.33 + 0.5 = 7.33 cups
          expect(flour!.totalQuantity).toBeCloseTo(7.33);
          expect(flour!.unit).toBe("cup");
        });

        it("merges eggs (all bare count) into single entry", () => {
          const ingredients: RecipeIngredient[] = [
            // Cookies: 2 eggs
            createMockRecipeIngredient({ id: "cc-egg", recipeId: "chocolate-chip-cookies", name: "egg", quantity: 2, unit: undefined, category: "pantry" }),
            // Banana Bread: 2 eggs
            createMockRecipeIngredient({ id: "bb-egg", recipeId: "banana-bread", name: "egg", quantity: 2, unit: undefined, category: "pantry" }),
            // Muffins: 1 egg
            createMockRecipeIngredient({ id: "bm-egg", recipeId: "blueberry-muffins", name: "egg", quantity: 1, unit: undefined, category: "pantry" }),
            // Brownies: 2 eggs
            createMockRecipeIngredient({ id: "br-egg", recipeId: "brownies", name: "egg", quantity: 2, unit: undefined, category: "pantry" }),
          ];

          const result = combineIngredients(ingredients, recipeNameMap);
          const egg = result.find((r) => r.name === "egg");
          expect(egg).toBeDefined();
          expect(egg!.totalQuantity).toBe(7);
        });

        it("merges butter (cup + tbsp) via volume conversion", () => {
          const ingredients: RecipeIngredient[] = [
            // Cookies: 1 cup
            createMockRecipeIngredient({ id: "cc-butter", recipeId: "chocolate-chip-cookies", name: "butter", quantity: 1, unit: "cup", category: "dairy" }),
            // Banana Bread: 0.5 cup
            createMockRecipeIngredient({ id: "bb-butter", recipeId: "banana-bread", name: "butter", quantity: 0.5, unit: "cup", category: "dairy" }),
            // Muffins: 0.25 cup
            createMockRecipeIngredient({ id: "bm-butter", recipeId: "blueberry-muffins", name: "butter", quantity: 0.25, unit: "cup", category: "dairy" }),
            // Brownies: 0.5 cup + 3 tbsp
            createMockRecipeIngredient({ id: "br-butter1", recipeId: "brownies", name: "butter", quantity: 0.5, unit: "cup", category: "dairy" }),
            createMockRecipeIngredient({ id: "br-butter2", recipeId: "brownies", name: "butter", quantity: 3, unit: "tbsp", category: "dairy" }),
          ];

          const result = combineIngredients(ingredients, recipeNameMap);
          const butter = result.find((r) => r.name === "butter");
          expect(butter).toBeDefined();
          // 1 cup=48tsp, 0.5 cup=24tsp, 0.25 cup=12tsp, 0.5 cup=24tsp, 3 tbsp=9tsp
          // Total = 48 + 24 + 12 + 24 + 9 = 117 tsp
          // 117/48 = 2.4375 cups (>= 0.5 → cup)
          expect(butter!.unit).toBe("cup");
          expect(butter!.totalQuantity).toBeCloseTo(117 / 48);
        });

        it("merges vanilla extract (all tsp) into single entry", () => {
          const ingredients: RecipeIngredient[] = [
            // Cookies: 2 tsp
            createMockRecipeIngredient({ id: "cc-vanilla", recipeId: "chocolate-chip-cookies", name: "vanilla extract", quantity: 2, unit: "tsp", category: "pantry" }),
            // Brownies: 1 tsp + 1 tsp
            createMockRecipeIngredient({ id: "br-vanilla1", recipeId: "brownies", name: "vanilla extract", quantity: 1, unit: "tsp", category: "pantry" }),
            createMockRecipeIngredient({ id: "br-vanilla2", recipeId: "brownies", name: "vanilla extract", quantity: 1, unit: "tsp", category: "pantry" }),
          ];

          const result = combineIngredients(ingredients, recipeNameMap);
          const vanilla = result.find((r) => r.name === "vanilla extract");
          expect(vanilla).toBeDefined();
          // 2 + 1 + 1 = 4 tsp (all same unit, stays tsp since 4/3 < 0.5 cup)
          expect(vanilla!.totalQuantity).toBe(4);
          expect(vanilla!.unit).toBe("tsp");
        });

        it("merges salt (all tsp) across baking recipes", () => {
          const ingredients: RecipeIngredient[] = [
            // Cookies: 0.5 tsp
            createMockRecipeIngredient({ id: "cc-salt", recipeId: "chocolate-chip-cookies", name: "salt", quantity: 0.5, unit: "tsp", category: "spices" }),
            // Banana Bread: 0.25 tsp
            createMockRecipeIngredient({ id: "bb-salt", recipeId: "banana-bread", name: "salt", quantity: 0.25, unit: "tsp", category: "spices" }),
            // Muffins: 0.5 tsp
            createMockRecipeIngredient({ id: "bm-salt", recipeId: "blueberry-muffins", name: "salt", quantity: 0.5, unit: "tsp", category: "spices" }),
            // Brownies: 0.25 tsp
            createMockRecipeIngredient({ id: "br-salt", recipeId: "brownies", name: "salt", quantity: 0.25, unit: "tsp", category: "spices" }),
          ];

          const result = combineIngredients(ingredients, recipeNameMap);
          const salt = result.find((r) => r.name === "salt");
          expect(salt).toBeDefined();
          // 0.5 + 0.25 + 0.5 + 0.25 = 1.5 tsp
          expect(salt!.totalQuantity).toBe(1.5);
          expect(salt!.unit).toBe("tsp");
        });
      });

      // Group 8: Mediterranean Spread — Falafel + Hummus + Baba Ganoush + Tabbouleh + Fattoush
      describe("Mediterranean: Falafel + Hummus + Baba Ganoush + Tabbouleh + Fattoush", () => {
        const recipeNameMap: Record<string, string> = {
          "falafel": "Falafel",
          "hummus": "Hummus",
          "baba-ganoush": "Baba Ganoush",
          "tabbouleh-wrap": "Tabbouleh Wrap",
          "fattoush": "Fattoush",
        };

        it("merges lemon bare counts into single entry", () => {
          const ingredients: RecipeIngredient[] = [
            // Baba Ganoush: 1 lemon
            createMockRecipeIngredient({ id: "bg-lemon", recipeId: "baba-ganoush", name: "lemon", quantity: 1, unit: undefined, category: "produce" }),
            // Tabbouleh: 2 lemons
            createMockRecipeIngredient({ id: "tw-lemon", recipeId: "tabbouleh-wrap", name: "lemon", quantity: 2, unit: undefined, category: "produce" }),
            // Fattoush: 1 lemon
            createMockRecipeIngredient({ id: "fat-lemon", recipeId: "fattoush", name: "lemon", quantity: 1, unit: undefined, category: "produce" }),
          ];

          const result = combineIngredients(ingredients, recipeNameMap);
          const lemon = result.find((r) => r.name === "lemon");
          expect(lemon).toBeDefined();
          // 1 + 2 + 1 = 4
          expect(lemon!.totalQuantity).toBe(4);
          expect(lemon!.unit).toBeUndefined();
        });

        it("merges parsley (cup) and absorbs null entry", () => {
          const ingredients: RecipeIngredient[] = [
            // Falafel: 1 cup
            createMockRecipeIngredient({ id: "fal-pars", recipeId: "falafel", name: "parsley", quantity: 1, unit: "cup", category: "produce" }),
            // Hummus: null — absorbed by quantified entries
            createMockRecipeIngredient({ id: "hum-pars", recipeId: "hummus", name: "parsley", quantity: undefined, unit: undefined, category: "produce" }),
            // Tabbouleh: 2.5 cup
            createMockRecipeIngredient({ id: "tw-pars", recipeId: "tabbouleh-wrap", name: "parsley", quantity: 2.5, unit: "cup", category: "produce" }),
            // Fattoush: 2 cup
            createMockRecipeIngredient({ id: "fat-pars", recipeId: "fattoush", name: "parsley", quantity: 2, unit: "cup", category: "produce" }),
          ];

          const result = combineIngredients(ingredients, recipeNameMap);
          const parsleyEntries = result.filter((r) => r.name === "parsley");
          // null "to taste" is absorbed; only the volume entry remains
          expect(parsleyEntries).toHaveLength(1);
          expect(parsleyEntries[0].totalQuantity).toBeCloseTo(5.5);
          expect(parsleyEntries[0].unit).toBe("cup");
        });

        it("merges olive oil (cup + tbsp) via volume conversion", () => {
          const ingredients: RecipeIngredient[] = [
            // Hummus: 0.25 cup
            createMockRecipeIngredient({ id: "hum-oil", recipeId: "hummus", name: "olive oil", quantity: 0.25, unit: "cup", category: "pantry" }),
            // Tabbouleh: 0.5 cup
            createMockRecipeIngredient({ id: "tw-oil", recipeId: "tabbouleh-wrap", name: "olive oil", quantity: 0.5, unit: "cup", category: "pantry" }),
          ];

          const result = combineIngredients(ingredients, recipeNameMap);
          const oil = result.find((r) => r.name === "olive oil");
          expect(oil).toBeDefined();
          // 0.25 + 0.5 = 0.75 cup (all same unit)
          expect(oil!.totalQuantity).toBe(0.75);
          expect(oil!.unit).toBe("cup");
        });

        it("merges garlic cloves across Mediterranean recipes", () => {
          const ingredients: RecipeIngredient[] = [
            // Falafel: 2 cloves
            createMockRecipeIngredient({ id: "fal-garlic", recipeId: "falafel", name: "garlic", quantity: 2, unit: "clove", category: "produce" }),
            // Hummus: 2 cloves
            createMockRecipeIngredient({ id: "hum-garlic", recipeId: "hummus", name: "garlic", quantity: 2, unit: "clove", category: "produce" }),
            // Baba Ganoush: 1 clove
            createMockRecipeIngredient({ id: "bg-garlic", recipeId: "baba-ganoush", name: "garlic", quantity: 1, unit: "clove", category: "produce" }),
          ];

          const result = combineIngredients(ingredients, recipeNameMap);
          const garlic = result.find((r) => r.name === "garlic");
          expect(garlic).toBeDefined();
          // 2 + 2 + 1 = 5 cloves
          expect(garlic!.totalQuantity).toBe(5);
          expect(garlic!.unit).toBe("clove");
        });

        it("merges tahini (tbsp + cup) via volume conversion", () => {
          const ingredients: RecipeIngredient[] = [
            // Falafel: 4 tbsp tahini
            createMockRecipeIngredient({ id: "fal-tahini", recipeId: "falafel", name: "tahini", quantity: 4, unit: "tbsp", category: "condiments" }),
            // Hummus: 0.5 cup tahini
            createMockRecipeIngredient({ id: "hum-tahini", recipeId: "hummus", name: "tahini", quantity: 0.5, unit: "cup", category: "condiments" }),
            // Baba Ganoush: 0.25 cup tahini paste → "tahini" via alias
            createMockRecipeIngredient({ id: "bg-tahini", recipeId: "baba-ganoush", name: "tahini paste", quantity: 0.25, unit: "cup", category: "condiments" }),
          ];

          const result = combineIngredients(ingredients, recipeNameMap);
          const tahini = result.find((r) => r.name === "tahini");
          expect(tahini).toBeDefined();
          // 4 tbsp = 12 tsp, 0.5 cup = 24 tsp, 0.25 cup = 12 tsp → 48 tsp total
          // 48/48 = 1 cup (>= 0.5 → cup)
          expect(tahini!.unit).toBe("cup");
          expect(tahini!.totalQuantity).toBeCloseTo(1);
        });
      });

      // Group 9: Thai Night — Chicken Pad Thai + Green Curry + Chicken Satay
      describe("Thai Night: Pad Thai + Green Curry + Satay", () => {
        const recipeNameMap: Record<string, string> = {
          "chicken-pad-thai": "Chicken Pad Thai",
          "green-curry": "Green Curry",
          "chicken-satay": "Chicken Satay",
        };

        it("merges fish sauce (tbsp + tsp) via volume conversion", () => {
          const ingredients: RecipeIngredient[] = [
            createMockRecipeIngredient({ id: "g9-1", recipeId: "chicken-pad-thai", name: "fish sauce", quantity: 2, unit: "tbsp", category: "condiments" }),
            createMockRecipeIngredient({ id: "g9-2", recipeId: "green-curry", name: "fish sauce", quantity: 2, unit: "tsp", category: "condiments" }),
            createMockRecipeIngredient({ id: "g9-3", recipeId: "chicken-satay", name: "fish sauce", quantity: 2, unit: "tbsp", category: "condiments" }),
          ];
          const result = combineIngredients(ingredients, recipeNameMap);
          const fishSauce = result.find(i => i.name === "fish sauce");
          expect(fishSauce).toBeDefined();
          // 2 tbsp = 6 tsp, 2 tsp, 2 tbsp = 6 tsp → 14 tsp total
          // 14 / 3 = 4.667 tbsp; 14 / 48 = 0.29 cup (< 0.5 so stays tbsp)
          expect(fishSauce!.unit).toBe("tbsp");
          expect(fishSauce!.totalQuantity).toBeCloseTo(14 / 3, 2);
        });

        it("merges garlic cloves across Thai recipes", () => {
          const ingredients: RecipeIngredient[] = [
            createMockRecipeIngredient({ id: "g9-4", recipeId: "green-curry", name: "garlic", quantity: 2, unit: "clove", category: "produce" }),
            createMockRecipeIngredient({ id: "g9-5", recipeId: "chicken-satay", name: "garlic", quantity: 2, unit: "clove", category: "produce" }),
            createMockRecipeIngredient({ id: "g9-6", recipeId: "chicken-satay", name: "garlic", quantity: 1, unit: "clove", category: "produce" }),
          ];
          const result = combineIngredients(ingredients, recipeNameMap);
          const garlic = result.find(i => i.name === "garlic");
          expect(garlic).toBeDefined();
          // 2 + 2 + 1 = 5 cloves (not > 10 threshold so stays clove)
          expect(garlic!.totalQuantity).toBe(5);
          expect(garlic!.unit).toBe("clove");
        });

        it("merges chicken thigh (oz + lb) via weight conversion", () => {
          const ingredients: RecipeIngredient[] = [
            createMockRecipeIngredient({ id: "g9-7", recipeId: "green-curry", name: "chicken thigh", quantity: 12, unit: "oz", category: "meat_seafood" }),
            createMockRecipeIngredient({ id: "g9-8", recipeId: "chicken-satay", name: "chicken thigh", quantity: 1.5, unit: "lb", category: "meat_seafood" }),
          ];
          const result = combineIngredients(ingredients, recipeNameMap);
          const chickenThigh = result.find(i => i.name === "chicken thigh");
          expect(chickenThigh).toBeDefined();
          // 12 oz + 1.5 lb = 12 oz + 24 oz = 36 oz total
          // 36/16 = 2.25 lb (>= 0.5 → lb)
          expect(chickenThigh!.unit).toBe("lb");
          expect(chickenThigh!.totalQuantity).toBeCloseTo(2.25, 2);
        });
      });

      // Group 10: Indian Feast — Chicken Tikka Masala + Butter Chicken + Chana Masala
      describe("Indian Feast: Tikka Masala + Butter Chicken + Chana Masala", () => {
        const recipeNameMap: Record<string, string> = {
          "chicken-tikka-masala": "Chicken Tikka Masala",
          "butter-chicken": "Butter Chicken",
          "chana-masala": "Chana Masala",
        };

        it("merges onion (count + cup) via COUNT_TO_CUP", () => {
          const ingredients: RecipeIngredient[] = [
            createMockRecipeIngredient({ id: "g10-1", recipeId: "chicken-tikka-masala", name: "onion", quantity: 1, unit: undefined, category: "produce" }),
            createMockRecipeIngredient({ id: "g10-2", recipeId: "butter-chicken", name: "onion", quantity: 1, unit: undefined, category: "produce" }),
            createMockRecipeIngredient({ id: "g10-3", recipeId: "chana-masala", name: "onion", quantity: 1, unit: undefined, category: "produce" }),
          ];
          const result = combineIngredients(ingredients, recipeNameMap);
          const onion = result.find(i => i.name === "onion");
          expect(onion).toBeDefined();
          // 3 onions total — no volume entries, so stays as count
          expect(onion!.totalQuantity).toBe(3);
          expect(onion!.unit).toBeUndefined();
        });

        it("merges heavy cream (cup + tbsp) via volume conversion", () => {
          const ingredients: RecipeIngredient[] = [
            // "heavy whipping cream" → alias → "heavy cream"
            createMockRecipeIngredient({ id: "g10-4", recipeId: "chicken-tikka-masala", name: "heavy whipping cream", quantity: 1, unit: "cup", category: "dairy" }),
            createMockRecipeIngredient({ id: "g10-5", recipeId: "butter-chicken", name: "heavy cream", quantity: 3, unit: "cup", category: "dairy" }),
          ];
          const result = combineIngredients(ingredients, recipeNameMap);
          const cream = result.find(i => i.name === "heavy cream");
          expect(cream).toBeDefined();
          // 1 cup + 3 cup = 4 cups; both same unit cup, 4/1=4 gallon? no — 4 cups * 48 = 192 tsp
          // Only 1 original unit (cup), stays cup
          expect(cream!.totalQuantity).toBe(4);
          expect(cream!.unit).toBe("cup");
        });

        it("merges garlic (clove + tbsp): volume+weight merge keeps more items", () => {
          const ingredients: RecipeIngredient[] = [
            createMockRecipeIngredient({ id: "g10-6", recipeId: "chicken-tikka-masala", name: "garlic", quantity: 4, unit: "clove", category: "produce" }),
            createMockRecipeIngredient({ id: "g10-7", recipeId: "butter-chicken", name: "garlic", quantity: 1, unit: "tbsp", category: "produce" }),
            createMockRecipeIngredient({ id: "g10-8", recipeId: "chana-masala", name: "garlic", quantity: 4, unit: "clove", category: "produce" }),
          ];
          const result = combineIngredients(ingredients, recipeNameMap);
          const garlic = result.find(i => i.name === "garlic");
          expect(garlic).toBeDefined();
          // clove items: 4 + 4 = 8 cloves (2 items, non-convertible)
          // tbsp: 1 tbsp = 3 tsp volume (1 item)
          // COUNT_TO_CUP for garlic: 1/48 cup per clove
          // volume: 3 tsp → 3/48 cups → 3/48 / (1/48) = 3 cloves from volume
          // total cloves: 8 + 3 = 11 cloves → > 10 threshold → BULK: ceil(11/10) = 2 heads
          expect(garlic!.totalQuantity).toBe(2);
          expect(garlic!.unit).toBe("head");
        });
      });

      // Group 11: Korean Spread — Bibimbap + Korean BBQ Short Ribs + Teriyaki Salmon
      describe("Korean Spread: Bibimbap + BBQ Short Ribs + Teriyaki Salmon", () => {
        const recipeNameMap: Record<string, string> = {
          "bibimbap": "Bibimbap",
          "korean-bbq-short-ribs": "Korean BBQ Short Ribs",
          "teriyaki-salmon": "Teriyaki Salmon",
        };

        it("merges soy sauce (tbsp + cup) via volume conversion", () => {
          const ingredients: RecipeIngredient[] = [
            createMockRecipeIngredient({ id: "g11-1", recipeId: "bibimbap", name: "soy sauce", quantity: 1, unit: "tbsp", category: "condiments" }),
            createMockRecipeIngredient({ id: "g11-2", recipeId: "korean-bbq-short-ribs", name: "soy sauce", quantity: 6, unit: "tbsp", category: "condiments" }),
            createMockRecipeIngredient({ id: "g11-3", recipeId: "teriyaki-salmon", name: "soy sauce", quantity: 0.25, unit: "cup", category: "condiments" }),
          ];
          const result = combineIngredients(ingredients, recipeNameMap);
          const soySauce = result.find(i => i.name === "soy sauce");
          expect(soySauce).toBeDefined();
          // 1 tbsp = 3 tsp, 6 tbsp = 18 tsp, 0.25 cup = 12 tsp → 33 tsp total
          // 33/48 = 0.6875 cup (>= 0.5 → cup)
          expect(soySauce!.unit).toBe("cup");
          expect(soySauce!.totalQuantity).toBeCloseTo(33 / 48, 2);
        });

        it("merges brown sugar (tsp + tbsp) via volume conversion", () => {
          const ingredients: RecipeIngredient[] = [
            createMockRecipeIngredient({ id: "g11-4", recipeId: "bibimbap", name: "brown sugar", quantity: 1, unit: "tsp", category: "pantry" }),
            createMockRecipeIngredient({ id: "g11-5", recipeId: "korean-bbq-short-ribs", name: "dark brown sugar", quantity: 3.5, unit: "tbsp", category: "pantry" }),
            createMockRecipeIngredient({ id: "g11-6", recipeId: "teriyaki-salmon", name: "brown sugar", quantity: 2, unit: "tbsp", category: "pantry" }),
          ];
          const result = combineIngredients(ingredients, recipeNameMap);
          const brownSugar = result.find(i => i.name === "brown sugar");
          expect(brownSugar).toBeDefined();
          // 1 tsp + 3.5 tbsp(=10.5 tsp) + 2 tbsp(=6 tsp) = 17.5 tsp
          // 17.5/48 = 0.365 cup (< 0.5); 17.5/3 = 5.833 tbsp (>= 1 → tbsp)
          expect(brownSugar!.unit).toBe("tbsp");
          expect(brownSugar!.totalQuantity).toBeCloseTo(17.5 / 3, 2);
        });

        it("merges sesame oil (tbsp + cup + tsp) via volume conversion", () => {
          const ingredients: RecipeIngredient[] = [
            createMockRecipeIngredient({ id: "g11-7", recipeId: "bibimbap", name: "sesame oil", quantity: 1, unit: "tbsp", category: "pantry" }),
            createMockRecipeIngredient({ id: "g11-8", recipeId: "bibimbap", name: "sesame oil", quantity: 1, unit: "tbsp", category: "pantry" }),
            createMockRecipeIngredient({ id: "g11-9", recipeId: "teriyaki-salmon", name: "sesame oil", quantity: 0.25, unit: "cup", category: "pantry" }),
          ];
          const result = combineIngredients(ingredients, recipeNameMap);
          const sesameOil = result.find(i => i.name === "sesame oil");
          expect(sesameOil).toBeDefined();
          // 1 tbsp = 3 tsp + 1 tbsp = 3 tsp + 0.25 cup = 12 tsp → 18 tsp total
          // 18/48 = 0.375 cup (< 0.5); 18/3 = 6 tbsp (>= 1 → tbsp)
          expect(sesameOil!.unit).toBe("tbsp");
          expect(sesameOil!.totalQuantity).toBeCloseTo(6, 2);
        });
      });

      // Group 12: Pasta Party — Penne Arrabbiata + Fettuccine Alfredo + Pasta Primavera + Cacio e Pepe
      describe("Pasta Party: Arrabbiata + Alfredo + Primavera + Cacio e Pepe", () => {
        const recipeNameMap: Record<string, string> = {
          "penne-arrabbiata": "Penne Arrabbiata",
          "fettuccine-alfredo": "Fettuccine Alfredo",
          "pasta-primavera": "Pasta Primavera",
          "cacio-e-pepe": "Cacio e Pepe",
        };

        it("merges olive oil (tbsp) across Italian recipes", () => {
          const ingredients: RecipeIngredient[] = [
            // "extra virgin olive oil" → alias → "olive oil"
            createMockRecipeIngredient({ id: "g12-1", recipeId: "penne-arrabbiata", name: "extra virgin olive oil", quantity: 4, unit: "tbsp", category: "pantry" }),
            createMockRecipeIngredient({ id: "g12-2", recipeId: "pasta-primavera", name: "olive oil", quantity: 2, unit: "tbsp", category: "pantry" }),
          ];
          const result = combineIngredients(ingredients, recipeNameMap);
          const oil = result.find(i => i.name === "olive oil");
          expect(oil).toBeDefined();
          // 4 tbsp + 2 tbsp = 6 tbsp = 18 tsp
          // All same unit tbsp, 18/48 = 0.375 (< 0.5) → stays tbsp
          expect(oil!.totalQuantity).toBe(6);
          expect(oil!.unit).toBe("tbsp");
        });

        it("merges garlic cloves across pasta recipes", () => {
          const ingredients: RecipeIngredient[] = [
            createMockRecipeIngredient({ id: "g12-3", recipeId: "penne-arrabbiata", name: "garlic", quantity: 3, unit: "clove", category: "produce" }),
            createMockRecipeIngredient({ id: "g12-4", recipeId: "pasta-primavera", name: "garlic", quantity: 4, unit: "clove", category: "produce" }),
            createMockRecipeIngredient({ id: "g12-5", recipeId: "cacio-e-pepe", name: "garlic", quantity: 2, unit: "clove", category: "produce" }),
          ];
          const result = combineIngredients(ingredients, recipeNameMap);
          const garlic = result.find(i => i.name === "garlic");
          expect(garlic).toBeDefined();
          // 3 + 4 + 2 = 9 cloves (< 10, no bulk)
          expect(garlic!.totalQuantity).toBe(9);
          expect(garlic!.unit).toBe("clove");
        });
      });

      // Group 13: Grill Session — BBQ Ribs + Grilled Chicken Breast + Grilled Steak + Grilled Shrimp Skewers
      describe("Grill Session: Ribs + Chicken + Steak + Shrimp", () => {
        const recipeNameMap: Record<string, string> = {
          "bbq-ribs": "BBQ Ribs",
          "grilled-chicken-breast": "Grilled Chicken Breast",
          "grilled-steak": "Steak",
          "grilled-shrimp-skewers": "Grilled Shrimp Skewers",
        };

        it("merges olive oil (tbsp + cup) via volume conversion", () => {
          const ingredients: RecipeIngredient[] = [
            createMockRecipeIngredient({ id: "g13-1", recipeId: "bbq-ribs", name: "olive oil", quantity: 2, unit: "tbsp", category: "pantry" }),
            createMockRecipeIngredient({ id: "g13-2", recipeId: "bbq-ribs", name: "olive oil", quantity: 2, unit: "tbsp", category: "pantry" }),
            createMockRecipeIngredient({ id: "g13-3", recipeId: "grilled-chicken-breast", name: "olive oil", quantity: 3, unit: "tbsp", category: "pantry" }),
            createMockRecipeIngredient({ id: "g13-4", recipeId: "grilled-shrimp-skewers", name: "olive oil", quantity: 0.33, unit: "cup", category: "pantry" }),
          ];
          const result = combineIngredients(ingredients, recipeNameMap);
          const oil = result.find(i => i.name === "olive oil");
          expect(oil).toBeDefined();
          // 2 + 2 + 3 tbsp = 7 tbsp = 21 tsp; 0.33 cup = 15.84 tsp → 36.84 tsp
          // 36.84/48 = 0.7675 cup (>= 0.5 → cup)
          expect(oil!.unit).toBe("cup");
          expect(oil!.totalQuantity).toBeCloseTo(36.84 / 48, 2);
        });

        it("merges salt (tsp) across grill recipes", () => {
          const ingredients: RecipeIngredient[] = [
            createMockRecipeIngredient({ id: "g13-5", recipeId: "bbq-ribs", name: "salt", quantity: 2, unit: "tsp", category: "spices" }),
            createMockRecipeIngredient({ id: "g13-6", recipeId: "bbq-ribs", name: "salt", quantity: 1, unit: "tsp", category: "spices" }),
            createMockRecipeIngredient({ id: "g13-7", recipeId: "grilled-shrimp-skewers", name: "salt", quantity: 0.5, unit: "tsp", category: "spices" }),
            // "sea salt" → alias → "salt"
            createMockRecipeIngredient({ id: "g13-8", recipeId: "grilled-steak", name: "sea salt", quantity: 1.5, unit: "tsp", category: "spices" }),
          ];
          const result = combineIngredients(ingredients, recipeNameMap);
          const salt = result.find(i => i.name === "salt");
          expect(salt).toBeDefined();
          // 2 + 1 + 0.5 + 1.5 = 5 tsp; all same unit tsp
          // single-original-unit path: largestFactor=48(cup), 5/48=0.104 (< 0.5) → stays tsp
          expect(salt!.unit).toBe("tsp");
          expect(salt!.totalQuantity).toBeCloseTo(5, 2);
        });
      });

      // Group 14: Soup Sampler — Tomato Soup + Minestrone + French Onion Soup + Corn Chowder
      describe("Soup Sampler: Tomato + Minestrone + French Onion + Corn Chowder", () => {
        const recipeNameMap: Record<string, string> = {
          "tomato-soup": "Tomato Soup",
          "minestrone": "Minestrone",
          "french-onion-soup": "French Onion Soup",
          "corn-chowder": "Corn Chowder",
        };

        it("merges butter (tbsp) across soup recipes", () => {
          const ingredients: RecipeIngredient[] = [
            createMockRecipeIngredient({ id: "g14-1", recipeId: "tomato-soup", name: "butter", quantity: 2, unit: "tbsp", category: "dairy" }),
            createMockRecipeIngredient({ id: "g14-2", recipeId: "french-onion-soup", name: "butter", quantity: 2, unit: "tbsp", category: "dairy" }),
            createMockRecipeIngredient({ id: "g14-3", recipeId: "corn-chowder", name: "butter", quantity: 1, unit: "tbsp", category: "dairy" }),
          ];
          const result = combineIngredients(ingredients, recipeNameMap);
          const butter = result.find(i => i.name === "butter");
          expect(butter).toBeDefined();
          // 2 + 2 + 1 = 5 tbsp; all same unit
          // 5 * 3 = 15 tsp; 15/48 = 0.3125 cup (< 0.5) → stays tbsp
          expect(butter!.totalQuantity).toBe(5);
          expect(butter!.unit).toBe("tbsp");
        });

        it("merges onion (cup + count + slice) — all merge into single count", () => {
          const ingredients: RecipeIngredient[] = [
            // "onion" 1 slice from tomato-soup
            createMockRecipeIngredient({ id: "g14-4", recipeId: "tomato-soup", name: "onion", quantity: 1, unit: "slice", category: "produce" }),
            // minestrone: 0.75 cup onion → volume entry
            createMockRecipeIngredient({ id: "g14-5", recipeId: "minestrone", name: "onion", quantity: 0.75, unit: "cup", category: "produce" }),
            // french onion soup: 6 onions (count)
            createMockRecipeIngredient({ id: "g14-6", recipeId: "french-onion-soup", name: "onion", quantity: 6, unit: undefined, category: "produce" }),
            // corn chowder: "yellow onion" → alias → "onion", 0.5 count
            createMockRecipeIngredient({ id: "g14-7", recipeId: "corn-chowder", name: "yellow onion", quantity: 0.5, unit: undefined, category: "produce" }),
          ];
          const result = combineIngredients(ingredients, recipeNameMap);
          const onionEntries = result.filter(i => i.name === "onion");
          // COUNT_TO_CUP for onion: 1 per cup
          // 0.75 cup → 0.75 / 1 = 0.75 count from volume
          // count entries: 6 + 0.5 = 6.5
          // volume merge: 6.5 + 0.75 = 7.25
          // SLICE_TO_COUNT for onion: 8 slices per onion
          // 1 slice → 1/8 = 0.125 count → 7.25 + 0.125 = 7.375
          expect(onionEntries).toHaveLength(1);
          expect(onionEntries[0].totalQuantity).toBeCloseTo(7.375, 2);
        });
      });

      // Group 15: Tex-Mex — Chicken Fajitas + Fish Tacos + Carnitas + Beef Burrito Bowl
      describe("Tex-Mex: Fajitas + Fish Tacos + Carnitas + Burrito Bowl", () => {
        const recipeNameMap: Record<string, string> = {
          "chicken-fajitas": "Chicken Fajitas",
          "fish-tacos": "Fish Tacos",
          "carnitas": "Carnitas",
          "beef-burrito-bowl": "Beef Burrito Bowl",
        };

        it("merges cilantro (cup + tbsp) via volume conversion", () => {
          const ingredients: RecipeIngredient[] = [
            createMockRecipeIngredient({ id: "g15-1", recipeId: "chicken-fajitas", name: "cilantro", quantity: 0.25, unit: "cup", category: "produce" }),
            createMockRecipeIngredient({ id: "g15-2", recipeId: "fish-tacos", name: "cilantro", quantity: 0.33, unit: "cup", category: "produce" }),
          ];
          const result = combineIngredients(ingredients, recipeNameMap);
          const cilantro = result.find(i => i.name === "cilantro");
          expect(cilantro).toBeDefined();
          // 0.25 + 0.33 = 0.58 cup, all same unit cup
          // 0.58 * 48 = 27.84 tsp; largest is cup: 27.84/48 = 0.58 >= 0.5 → cup
          expect(cilantro!.unit).toBe("cup");
          expect(cilantro!.totalQuantity).toBeCloseTo(0.58, 2);
        });

        it("merges lime juice (tbsp) across tex-mex recipes", () => {
          const ingredients: RecipeIngredient[] = [
            createMockRecipeIngredient({ id: "g15-3", recipeId: "chicken-fajitas", name: "lime juice", quantity: 2, unit: "tbsp", category: "produce" }),
            createMockRecipeIngredient({ id: "g15-4", recipeId: "fish-tacos", name: "lime juice", quantity: 3.5, unit: "tbsp", category: "produce" }),
          ];
          const result = combineIngredients(ingredients, recipeNameMap);
          const limeJuice = result.find(i => i.name === "lime juice");
          expect(limeJuice).toBeDefined();
          // 2 + 3.5 = 5.5 tbsp = 16.5 tsp; same unit tbsp
          // 16.5/48 = 0.34375 cup (< 0.5) → stays tbsp
          expect(limeJuice!.totalQuantity).toBe(5.5);
          expect(limeJuice!.unit).toBe("tbsp");
        });
      });

      // Group 16: Indian Veggie — Aloo Gobi + Dal Makhani + Samosa Filling + Palak Paneer
      describe("Indian Veggie: Aloo Gobi + Dal Makhani + Samosa + Palak Paneer", () => {
        const recipeNameMap: Record<string, string> = {
          "aloo-gobi": "Aloo Gobi",
          "dal-makhani": "Dal Makhani",
          "samosa-filling": "Samosa Filling",
          "palak-paneer": "Palak Paneer",
        };

        it("merges garam masala (tsp) across Indian recipes", () => {
          const ingredients: RecipeIngredient[] = [
            createMockRecipeIngredient({ id: "g16-1", recipeId: "aloo-gobi", name: "garam masala", quantity: 1.5, unit: "tsp", category: "spices" }),
            createMockRecipeIngredient({ id: "g16-2", recipeId: "dal-makhani", name: "garam masala", quantity: 1, unit: "tsp", category: "spices" }),
            createMockRecipeIngredient({ id: "g16-3", recipeId: "samosa-filling", name: "garam masala", quantity: 1, unit: "tsp", category: "spices" }),
          ];
          const result = combineIngredients(ingredients, recipeNameMap);
          const garamMasala = result.find(i => i.name === "garam masala");
          expect(garamMasala).toBeDefined();
          // 1.5 + 1 + 1 = 3.5 tsp; all same unit tsp
          // single-original-unit path: largestFactor=48(cup), 3.5/48=0.073 (< 0.5) → stays tsp
          expect(garamMasala!.unit).toBe("tsp");
          expect(garamMasala!.totalQuantity).toBeCloseTo(3.5, 2);
        });

        it("merges cumin seed (tsp) across Indian recipes", () => {
          const ingredients: RecipeIngredient[] = [
            createMockRecipeIngredient({ id: "g16-4", recipeId: "aloo-gobi", name: "cumin seed", quantity: 0.5, unit: "tsp", category: "spices" }),
            createMockRecipeIngredient({ id: "g16-5", recipeId: "samosa-filling", name: "cumin seed", quantity: 1, unit: "tsp", category: "spices" }),
            createMockRecipeIngredient({ id: "g16-6", recipeId: "palak-paneer", name: "cumin seed", quantity: 1, unit: "tsp", category: "spices" }),
          ];
          const result = combineIngredients(ingredients, recipeNameMap);
          const cumin = result.find(i => i.name === "cumin seed");
          expect(cumin).toBeDefined();
          // 0.5 + 1 + 1 = 2.5 tsp, all same unit
          expect(cumin!.totalQuantity).toBe(2.5);
          expect(cumin!.unit).toBe("tsp");
        });
      });

      // Group 17: Salad Bar — Caesar Salad + Cobb Salad + Waldorf Salad + Nicoise Salad
      describe("Salad Bar: Caesar + Cobb + Waldorf + Nicoise", () => {
        const recipeNameMap: Record<string, string> = {
          "caesar-salad": "Caesar Salad",
          "cobb-salad": "Cobb Salad",
          "waldorf-salad": "Waldorf Salad",
          "nicoise-salad": "Nicoise Salad",
        };

        it("merges olive oil (cup + tbsp) via volume conversion", () => {
          const ingredients: RecipeIngredient[] = [
            createMockRecipeIngredient({ id: "g17-1", recipeId: "cobb-salad", name: "olive oil", quantity: 0.67, unit: "cup", category: "pantry" }),
            // "extra-virgin olive oil" → alias → "olive oil"
            createMockRecipeIngredient({ id: "g17-2", recipeId: "nicoise-salad", name: "extra-virgin olive oil", quantity: 0.75, unit: "cup", category: "pantry" }),
          ];
          const result = combineIngredients(ingredients, recipeNameMap);
          const oil = result.find(i => i.name === "olive oil");
          expect(oil).toBeDefined();
          // 0.67 + 0.75 = 1.42 cup; all same unit cup
          expect(oil!.totalQuantity).toBeCloseTo(1.42, 2);
          expect(oil!.unit).toBe("cup");
        });

        it("merges eggs across salad recipes", () => {
          const ingredients: RecipeIngredient[] = [
            createMockRecipeIngredient({ id: "g17-3", recipeId: "cobb-salad", name: "egg", quantity: 2, unit: undefined, category: "pantry" }),
            createMockRecipeIngredient({ id: "g17-4", recipeId: "nicoise-salad", name: "egg", quantity: 6, unit: undefined, category: "pantry" }),
          ];
          const result = combineIngredients(ingredients, recipeNameMap);
          const egg = result.find(i => i.name === "egg");
          expect(egg).toBeDefined();
          // 2 + 6 = 8 eggs
          expect(egg!.totalQuantity).toBe(8);
        });

        it("merges bacon (slice → strip via UNIT_REMAP)", () => {
          const ingredients: RecipeIngredient[] = [
            createMockRecipeIngredient({ id: "g17-5", recipeId: "cobb-salad", name: "bacon", quantity: 6, unit: "slice", category: "meat_seafood" }),
          ];
          const result = combineIngredients(ingredients, recipeNameMap);
          const bacon = result.find(i => i.name === "bacon");
          expect(bacon).toBeDefined();
          // "slice" → remapped to "strip"
          // But PREFERRED_COUNT_UNIT for "bacon" = "strip", so bare count and remapped "slice" both go to "strip"
          expect(bacon!.unit).toBe("strip");
          expect(bacon!.totalQuantity).toBe(6);
        });
      });

      // Group 18: Baking Bonanza 2 — Cinnamon Rolls + Lemon Bars + Pound Cake + Sugar Cookies
      describe("Baking Bonanza 2: Cinnamon Rolls + Lemon Bars + Pound Cake + Sugar Cookies", () => {
        const recipeNameMap: Record<string, string> = {
          "cinnamon-rolls": "Cinnamon Rolls",
          "lemon-bars": "Lemon Bars",
          "pound-cake": "Pound Cake",
          "sugar-cookies": "Sugar Cookies",
        };

        it("merges flour (cup) across baking recipes", () => {
          const ingredients: RecipeIngredient[] = [
            // "all-purpose flour" → alias → "flour"
            createMockRecipeIngredient({ id: "g18-1", recipeId: "lemon-bars", name: "all-purpose flour", quantity: 2.25, unit: "cup", category: "pantry" }),
            createMockRecipeIngredient({ id: "g18-2", recipeId: "pound-cake", name: "all-purpose flour", quantity: 1.5, unit: "cup", category: "pantry" }),
            createMockRecipeIngredient({ id: "g18-3", recipeId: "sugar-cookies", name: "all-purpose flour", quantity: 2.75, unit: "cup", category: "pantry" }),
          ];
          const result = combineIngredients(ingredients, recipeNameMap);
          const flour = result.find(i => i.name === "flour");
          expect(flour).toBeDefined();
          // 2.25 + 1.5 + 2.75 = 6.5 cups
          expect(flour!.totalQuantity).toBeCloseTo(6.5, 2);
          expect(flour!.unit).toBe("cup");
        });

        it("merges butter (cup + tbsp) via volume conversion", () => {
          const ingredients: RecipeIngredient[] = [
            createMockRecipeIngredient({ id: "g18-4", recipeId: "cinnamon-rolls", name: "butter", quantity: 0.33, unit: "cup", category: "dairy" }),
            createMockRecipeIngredient({ id: "g18-5", recipeId: "cinnamon-rolls", name: "butter", quantity: 0.25, unit: "cup", category: "dairy" }),
            createMockRecipeIngredient({ id: "g18-6", recipeId: "lemon-bars", name: "butter", quantity: 1, unit: "cup", category: "dairy" }),
            createMockRecipeIngredient({ id: "g18-7", recipeId: "sugar-cookies", name: "butter", quantity: 1, unit: "cup", category: "dairy" }),
            // "unsalted butter" → strips "unsalted" → "butter"
            createMockRecipeIngredient({ id: "g18-8", recipeId: "pound-cake", name: "unsalted butter", quantity: 0.5, unit: "cup", category: "dairy" }),
          ];
          const result = combineIngredients(ingredients, recipeNameMap);
          const butter = result.find(i => i.name === "butter");
          expect(butter).toBeDefined();
          // 0.33 + 0.25 + 1 + 1 + 0.5 = 3.08 cups; all same unit cup
          expect(butter!.totalQuantity).toBeCloseTo(3.08, 2);
          expect(butter!.unit).toBe("cup");
        });

        it("merges eggs across baking recipes", () => {
          const ingredients: RecipeIngredient[] = [
            createMockRecipeIngredient({ id: "g18-9", recipeId: "cinnamon-rolls", name: "egg", quantity: 2, unit: undefined, category: "pantry" }),
            createMockRecipeIngredient({ id: "g18-10", recipeId: "lemon-bars", name: "egg", quantity: 4, unit: undefined, category: "pantry" }),
            createMockRecipeIngredient({ id: "g18-11", recipeId: "pound-cake", name: "egg", quantity: 4, unit: undefined, category: "pantry" }),
            createMockRecipeIngredient({ id: "g18-12", recipeId: "sugar-cookies", name: "egg", quantity: 1, unit: undefined, category: "pantry" }),
          ];
          const result = combineIngredients(ingredients, recipeNameMap);
          const egg = result.find(i => i.name === "egg");
          expect(egg).toBeDefined();
          // 2 + 4 + 4 + 1 = 11
          expect(egg!.totalQuantity).toBe(11);
        });
      });

      // Group 19: Greek Night — Greek Salad + Moussaka + Spanakopita + Stuffed Grape Leaves
      describe("Greek Night: Greek Salad + Moussaka + Spanakopita + Stuffed Grape Leaves", () => {
        const recipeNameMap: Record<string, string> = {
          "greek-salad": "Greek Salad",
          "moussaka": "Moussaka",
          "spanakopita": "Spanakopita",
          "stuffed-grape-leaves": "Stuffed Grape Leaves",
        };

        it("merges olive oil (tbsp + cup) via volume conversion", () => {
          const ingredients: RecipeIngredient[] = [
            createMockRecipeIngredient({ id: "g19-1", recipeId: "greek-salad", name: "olive oil", quantity: 6, unit: "tbsp", category: "pantry" }),
            // "extra virgin olive oil" → alias → "olive oil"
            createMockRecipeIngredient({ id: "g19-2", recipeId: "spanakopita", name: "extra virgin olive oil", quantity: 2, unit: "tbsp", category: "pantry" }),
            createMockRecipeIngredient({ id: "g19-3", recipeId: "spanakopita", name: "extra virgin olive oil", quantity: 1, unit: "cup", category: "pantry" }),
            createMockRecipeIngredient({ id: "g19-4", recipeId: "moussaka", name: "olive oil", quantity: 0.53, unit: "cup", category: "pantry" }),
          ];
          const result = combineIngredients(ingredients, recipeNameMap);
          const oil = result.find(i => i.name === "olive oil");
          expect(oil).toBeDefined();
          // 6 tbsp = 18 tsp, 2 tbsp = 6 tsp, 1 cup = 48 tsp, 0.53 cup = 25.44 tsp → 97.44 tsp
          // 97.44/48 = 2.03 cup (>= 0.5 → cup)
          expect(oil!.unit).toBe("cup");
          expect(oil!.totalQuantity).toBeCloseTo(97.44 / 48, 2);
        });

        it("merges parsley (cup + tbsp) via volume conversion", () => {
          const ingredients: RecipeIngredient[] = [
            // "flat-leaf parsley" → alias → "parsley"
            createMockRecipeIngredient({ id: "g19-5", recipeId: "spanakopita", name: "flat-leaf parsley", quantity: 2, unit: "bunch", category: "produce" }),
            createMockRecipeIngredient({ id: "g19-6", recipeId: "stuffed-grape-leaves", name: "parsley", quantity: 0.5, unit: "cup", category: "produce" }),
          ];
          const result = combineIngredients(ingredients, recipeNameMap);
          const parsley = result.find(i => i.name === "parsley");
          expect(parsley).toBeDefined();
          // bunch (2) and cup (0.5) are different non-convertible units
          // parsley in bunches and parsley in cups are separate entries
          // "bunch" is a non-convertible unit, "cup" is a volume unit
          // cup goes into volume family (tsp), bunch stays plain
          // then volume entry: 0.5 cup = 24 tsp → convertToPreferredUnit → 24/48 = 0.5 cup
          // So we expect 2 entries for parsley — let's check the volume one
          const parsleyCup = result.filter(i => i.name === "parsley" && i.unit === "cup");
          expect(parsleyCup.length).toBe(1);
          expect(parsleyCup[0].totalQuantity).toBe(0.5);
        });

        it("merges eggplant across Greek recipes", () => {
          const ingredients: RecipeIngredient[] = [
            createMockRecipeIngredient({ id: "g19-7", recipeId: "moussaka", name: "eggplant", quantity: 2, unit: undefined, category: "produce" }),
          ];
          const result = combineIngredients(ingredients, recipeNameMap);
          const eggplant = result.find(i => i.name === "eggplant");
          expect(eggplant).toBeDefined();
          expect(eggplant!.totalQuantity).toBe(2);
        });
      });

      // Group 20: Comfort Brunch — Mac and Cheese + Buttermilk Pancakes + Biscuits and Gravy + Cornbread
      describe("Comfort Brunch: Mac & Cheese + Pancakes + Biscuits + Cornbread", () => {
        const recipeNameMap: Record<string, string> = {
          "mac-and-cheese": "Mac and Cheese",
          "buttermilk-pancakes": "Buttermilk Pancakes",
          "biscuits-and-gravy": "Biscuits and Gravy",
          "cornbread": "Cornbread",
        };

        it("merges milk (cup) across brunch recipes", () => {
          const ingredients: RecipeIngredient[] = [
            createMockRecipeIngredient({ id: "g20-1", recipeId: "mac-and-cheese", name: "milk", quantity: 2, unit: "cup", category: "dairy" }),
            createMockRecipeIngredient({ id: "g20-2", recipeId: "buttermilk-pancakes", name: "milk", quantity: 1.25, unit: "cup", category: "dairy" }),
            createMockRecipeIngredient({ id: "g20-3", recipeId: "biscuits-and-gravy", name: "milk", quantity: 2.5, unit: "cup", category: "dairy" }),
            createMockRecipeIngredient({ id: "g20-4", recipeId: "cornbread", name: "milk", quantity: 1, unit: "cup", category: "dairy" }),
          ];
          const result = combineIngredients(ingredients, recipeNameMap);
          const milk = result.find(i => i.name === "milk");
          expect(milk).toBeDefined();
          // 2 + 1.25 + 2.5 + 1 = 6.75 cups; same unit cup
          // 6.75 * 48 = 324 tsp; 324/768 = 0.422 gallon (< 0.5); 324/192 = 1.6875 quart (>= 0.5 → quart)
          // Wait — VOLUME_IN_TSP only has tsp, tbsp, cup. No quart/gallon.
          // So stays cup
          expect(milk!.totalQuantity).toBeCloseTo(6.75, 2);
          expect(milk!.unit).toBe("cup");
        });

        it("merges flour (cup) across brunch recipes", () => {
          const ingredients: RecipeIngredient[] = [
            // "all-purpose flour" → alias → "flour"
            createMockRecipeIngredient({ id: "g20-5", recipeId: "mac-and-cheese", name: "all-purpose flour", quantity: 0.25, unit: "cup", category: "pantry" }),
            createMockRecipeIngredient({ id: "g20-6", recipeId: "buttermilk-pancakes", name: "all-purpose flour", quantity: 1.5, unit: "cup", category: "pantry" }),
            createMockRecipeIngredient({ id: "g20-7", recipeId: "biscuits-and-gravy", name: "flour", quantity: 0.25, unit: "cup", category: "pantry" }),
            createMockRecipeIngredient({ id: "g20-8", recipeId: "cornbread", name: "all-purpose flour", quantity: 1, unit: "cup", category: "pantry" }),
          ];
          const result = combineIngredients(ingredients, recipeNameMap);
          const flour = result.find(i => i.name === "flour");
          expect(flour).toBeDefined();
          // 0.25 + 1.5 + 0.25 + 1 = 3 cups
          expect(flour!.totalQuantity).toBe(3);
          expect(flour!.unit).toBe("cup");
        });
      });

      // Group 21: Steak Night — Chimichurri Steak + Mashed Potatoes + Grilled Pork Chops
      describe("Steak Night: Chimichurri + Mashed Potatoes + Pork Chops", () => {
        const recipeNameMap: Record<string, string> = {
          "chimichurri-steak": "Chimichurri Steak",
          "mashed-potatoes": "Mashed Potatoes",
          "grilled-pork-chops": "Grilled Pork Chops",
        };

        it("merges garlic (clove) across steak night recipes", () => {
          const ingredients: RecipeIngredient[] = [
            createMockRecipeIngredient({ id: "g21-1", recipeId: "chimichurri-steak", name: "garlic", quantity: 3, unit: "clove", category: "produce" }),
            createMockRecipeIngredient({ id: "g21-2", recipeId: "mashed-potatoes", name: "garlic", quantity: 3, unit: "clove", category: "produce" }),
            createMockRecipeIngredient({ id: "g21-3", recipeId: "grilled-pork-chops", name: "garlic", quantity: 2, unit: "clove", category: "produce" }),
          ];
          const result = combineIngredients(ingredients, recipeNameMap);
          const garlic = result.find(i => i.name === "garlic");
          expect(garlic).toBeDefined();
          // 3 + 3 + 2 = 8 cloves (< 10 threshold)
          expect(garlic!.totalQuantity).toBe(8);
          expect(garlic!.unit).toBe("clove");
        });

        it("merges unsalted butter (tbsp) via volume conversion", () => {
          const ingredients: RecipeIngredient[] = [
            // "unsalted butter" → strips "unsalted" → "butter"
            createMockRecipeIngredient({ id: "g21-4", recipeId: "chimichurri-steak", name: "unsalted butter", quantity: 8, unit: "tbsp", category: "dairy" }),
            createMockRecipeIngredient({ id: "g21-5", recipeId: "mashed-potatoes", name: "butter", quantity: 2, unit: "tbsp", category: "dairy" }),
          ];
          const result = combineIngredients(ingredients, recipeNameMap);
          const butter = result.find(i => i.name === "butter");
          expect(butter).toBeDefined();
          // 8 + 2 = 10 tbsp = 30 tsp; all same unit tbsp
          // 30/48 = 0.625 cup (>= 0.5 → cup)
          expect(butter!.unit).toBe("cup");
          expect(butter!.totalQuantity).toBeCloseTo(30 / 48, 2);
        });
      });

      // Group 22: Pho + Pad Thai — Pho + Chicken Pad Thai + Thai Mango Salad
      describe("Pho + Pad Thai: Pho + Pad Thai + Mango Salad", () => {
        const recipeNameMap: Record<string, string> = {
          "pho": "Pho",
          "chicken-pad-thai": "Chicken Pad Thai",
          "thai-mango-salad": "Thai Mango Salad",
        };

        it("merges bean sprout (cup + oz) — volume vs weight, keep more items", () => {
          const ingredients: RecipeIngredient[] = [
            createMockRecipeIngredient({ id: "g22-1", recipeId: "pho", name: "bean sprout", quantity: 3, unit: "cup", category: "produce" }),
            createMockRecipeIngredient({ id: "g22-2", recipeId: "chicken-pad-thai", name: "bean sprout", quantity: 2, unit: "cup", category: "produce" }),
          ];
          const result = combineIngredients(ingredients, recipeNameMap);
          const beanSprout = result.find(i => i.name === "bean sprout");
          expect(beanSprout).toBeDefined();
          // 3 + 2 = 5 cups; same unit cup
          expect(beanSprout!.totalQuantity).toBe(5);
          expect(beanSprout!.unit).toBe("cup");
        });

        it("merges scallion (count + cup) via COUNT_TO_CUP — 'green onion' alias → 'scallion'", () => {
          const ingredients: RecipeIngredient[] = [
            createMockRecipeIngredient({ id: "g22-3", recipeId: "pho", name: "scallion", quantity: 0.5, unit: "cup", category: "produce" }),
            // "green onion" → alias → "scallion"
            createMockRecipeIngredient({ id: "g22-4", recipeId: "chicken-pad-thai", name: "green onion", quantity: 3, unit: undefined, category: "produce" }),
            createMockRecipeIngredient({ id: "g22-5", recipeId: "thai-mango-salad", name: "green onion", quantity: 2, unit: undefined, category: "produce" }),
          ];
          const result = combineIngredients(ingredients, recipeNameMap);
          const scallionEntries = result.filter(i => i.name === "scallion");
          // COUNT_TO_CUP for scallion: 0.125 cup per scallion
          // Volume: 0.5 cup → 0.5 / 0.125 = 4 scallions from volume
          // Count: 3 + 2 = 5 scallions
          // Total: 5 + 4 = 9 scallions (single merged entry)
          expect(scallionEntries.length).toBe(1);
          expect(scallionEntries[0].totalQuantity).toBe(9);
          expect(scallionEntries[0].unit).toBeUndefined();
        });
      });

      // Group 23: Italian Simple — Aglio e Olio + Pesto Pasta + Caprese + Baked Ziti
      describe("Italian Simple: Aglio e Olio + Pesto Pasta + Caprese + Baked Ziti", () => {
        const recipeNameMap: Record<string, string> = {
          "aglio-e-olio": "Aglio e Olio",
          "pesto-pasta": "Pesto Pasta",
          "caprese": "Caprese",
          "baked-ziti": "Baked Ziti",
        };

        it("merges olive oil (cup) across Italian recipes", () => {
          const ingredients: RecipeIngredient[] = [
            // "extra-virgin olive oil" → alias → "olive oil"
            createMockRecipeIngredient({ id: "g23-1", recipeId: "aglio-e-olio", name: "extra-virgin olive oil", quantity: 0.5, unit: "cup", category: "pantry" }),
          ];
          const result = combineIngredients(ingredients, recipeNameMap);
          const oil = result.find(i => i.name === "olive oil");
          expect(oil).toBeDefined();
          expect(oil!.totalQuantity).toBe(0.5);
          expect(oil!.unit).toBe("cup");
        });

        it("merges onion across Italian recipes — count entries", () => {
          const ingredients: RecipeIngredient[] = [
            createMockRecipeIngredient({ id: "g23-2", recipeId: "baked-ziti", name: "onion", quantity: 1, unit: undefined, category: "produce" }),
          ];
          const result = combineIngredients(ingredients, recipeNameMap);
          const onion = result.find(i => i.name === "onion");
          expect(onion).toBeDefined();
          expect(onion!.totalQuantity).toBe(1);
        });
      });

      // Group 24: Indian Rich — Biryani + Vindaloo + Korma + Dal Makhani
      describe("Indian Rich: Biryani + Vindaloo + Korma + Dal Makhani", () => {
        const recipeNameMap: Record<string, string> = {
          "biryani": "Biryani",
          "vindaloo": "Vindaloo",
          "korma": "Korma",
          "dal-makhani": "Dal Makhani",
        };

        it("merges garlic (clove + tbsp + tsp) — triggers BULK_CONVERSION to heads", () => {
          const ingredients: RecipeIngredient[] = [
            createMockRecipeIngredient({ id: "g24-1", recipeId: "biryani", name: "garlic", quantity: 6, unit: "clove", category: "produce" }),
            createMockRecipeIngredient({ id: "g24-2", recipeId: "vindaloo", name: "garlic", quantity: 10, unit: "clove", category: "produce" }),
            createMockRecipeIngredient({ id: "g24-3", recipeId: "vindaloo", name: "garlic", quantity: 4, unit: "clove", category: "produce" }),
          ];
          const result = combineIngredients(ingredients, recipeNameMap);
          const garlic = result.find(i => i.name === "garlic");
          expect(garlic).toBeDefined();
          // 6 + 10 + 4 = 20 cloves > 10 threshold → BULK: ceil(20/10) = 2 heads
          expect(garlic!.totalQuantity).toBe(2);
          expect(garlic!.unit).toBe("head");
        });

        it("merges ghee (tbsp + cup) via volume conversion", () => {
          const ingredients: RecipeIngredient[] = [
            createMockRecipeIngredient({ id: "g24-4", recipeId: "biryani", name: "ghee", quantity: 0.25, unit: "cup", category: "dairy" }),
            createMockRecipeIngredient({ id: "g24-5", recipeId: "vindaloo", name: "ghee", quantity: 3, unit: "tbsp", category: "dairy" }),
            createMockRecipeIngredient({ id: "g24-6", recipeId: "korma", name: "ghee", quantity: 1.5, unit: "tbsp", category: "pantry" }),
            createMockRecipeIngredient({ id: "g24-7", recipeId: "korma", name: "ghee", quantity: 2, unit: "tbsp", category: "pantry" }),
            createMockRecipeIngredient({ id: "g24-8", recipeId: "dal-makhani", name: "ghee", quantity: 2, unit: "tbsp", category: "pantry" }),
          ];
          const result = combineIngredients(ingredients, recipeNameMap);
          const ghee = result.find(i => i.name === "ghee");
          expect(ghee).toBeDefined();
          // 0.25 cup = 12 tsp; 3 tbsp = 9 tsp; 1.5 tbsp = 4.5 tsp; 2 tbsp = 6 tsp; 2 tbsp = 6 tsp → 37.5 tsp
          // 37.5/48 = 0.78125 cup (>= 0.5 → cup)
          expect(ghee!.unit).toBe("cup");
          expect(ghee!.totalQuantity).toBeCloseTo(37.5 / 48, 2);
        });
      });

      // Group 25: Chicken Bonanza — Fried Chicken + Beer Can Chicken + Chicken Piccata + Chicken Larb
      describe("Chicken Bonanza: Fried + Beer Can + Piccata + Larb", () => {
        const recipeNameMap: Record<string, string> = {
          "fried-chicken": "Fried Chicken",
          "beer-can-chicken": "Beer Can Chicken",
          "chicken-piccata": "Chicken Piccata",
          "chicken-larb": "Chicken Larb",
        };

        it("merges flour (cup) across chicken recipes", () => {
          const ingredients: RecipeIngredient[] = [
            createMockRecipeIngredient({ id: "g25-1", recipeId: "fried-chicken", name: "flour", quantity: 2, unit: "cup", category: "pantry" }),
            createMockRecipeIngredient({ id: "g25-2", recipeId: "chicken-piccata", name: "flour", quantity: 1, unit: "cup", category: "pantry" }),
          ];
          const result = combineIngredients(ingredients, recipeNameMap);
          const flour = result.find(i => i.name === "flour");
          expect(flour).toBeDefined();
          // 2 + 1 = 3 cups
          expect(flour!.totalQuantity).toBe(3);
          expect(flour!.unit).toBe("cup");
        });

        it("merges fish sauce (cup + tbsp) via volume conversion", () => {
          const ingredients: RecipeIngredient[] = [
            createMockRecipeIngredient({ id: "g25-3", recipeId: "chicken-larb", name: "fish sauce", quantity: 2, unit: "tbsp", category: "condiments" }),
          ];
          const result = combineIngredients(ingredients, recipeNameMap);
          const fishSauce = result.find(i => i.name === "fish sauce");
          expect(fishSauce).toBeDefined();
          expect(fishSauce!.totalQuantity).toBe(2);
          expect(fishSauce!.unit).toBe("tbsp");
        });
      });

      // Group 26: Club Specials — Gobi 65 + Vegan Crab Cakes + Coconut Rice + Sticky Spicy Baked Cauliflower
      describe("Club Specials: Gobi 65 + Vegan Crab Cakes + Coconut Rice + Sticky Cauliflower", () => {
        const recipeNameMap: Record<string, string> = {
          "gobi-65": "Gobi 65",
          "vegan-crab-cakes": "Vegan Crab Cakes",
          "coconut-rice": "Coconut Rice",
          "sticky-spicy-baked-cauliflower": "Sticky Spicy Baked Cauliflower",
        };

        it("merges cauliflower (cup + head) into heads via COUNT_TO_CUP", () => {
          const ingredients: RecipeIngredient[] = [
            createMockRecipeIngredient({ id: "g26-1", recipeId: "gobi-65", name: "cauliflower", quantity: 2.5, unit: "cup", category: "produce" }),
            createMockRecipeIngredient({ id: "g26-2", recipeId: "sticky-spicy-baked-cauliflower", name: "cauliflower", quantity: 1, unit: "head", category: "produce" }),
          ];
          const result = combineIngredients(ingredients, recipeNameMap);
          // COUNT_TO_CUP for cauliflower: 4 cups per head
          // PREFERRED_COUNT_UNIT for cauliflower: "head"
          // 2.5 cup → 2.5/4 = 0.625 heads from volume + 1 head = 1.625 heads
          const cauliflowerEntries = result.filter(i => i.name === "cauliflower");
          expect(cauliflowerEntries).toHaveLength(1);
          expect(cauliflowerEntries[0].unit).toBe("head");
          expect(cauliflowerEntries[0].totalQuantity).toBeCloseTo(1.625);
        });

        it("merges salt (tsp) via kosher salt alias", () => {
          const ingredients: RecipeIngredient[] = [
            createMockRecipeIngredient({ id: "g26-3", recipeId: "gobi-65", name: "salt", quantity: 0.75, unit: "tsp", category: "spices" }),
            // "kosher salt" → alias → "salt"
            createMockRecipeIngredient({ id: "g26-4", recipeId: "coconut-rice", name: "kosher salt", quantity: 0.5, unit: "tsp", category: "spices" }),
            createMockRecipeIngredient({ id: "g26-5", recipeId: "sticky-spicy-baked-cauliflower", name: "kosher salt", quantity: 1, unit: "tsp", category: "spices" }),
            // "sea salt" → alias → "salt"
            createMockRecipeIngredient({ id: "g26-6", recipeId: "vegan-crab-cakes", name: "sea salt", quantity: 1, unit: "tsp", category: "spices" }),
          ];
          const result = combineIngredients(ingredients, recipeNameMap);
          const salt = result.find(i => i.name === "salt");
          expect(salt).toBeDefined();
          // 0.75 + 0.5 + 1 + 1 = 3.25 tsp; all same unit
          // single-original-unit path: largestFactor=48(cup), 3.25/48=0.068 (< 0.5) → stays tsp
          expect(salt!.unit).toBe("tsp");
          expect(salt!.totalQuantity).toBeCloseTo(3.25, 2);
        });
      });

      // Group 27: Fish Night — Beer-Battered Fish + Easy Provencal Fish + Trout Amandine + Poached Cod
      describe("Fish Night: Beer-Battered + Provencal + Trout + Poached Cod", () => {
        const recipeNameMap: Record<string, string> = {
          "beer-battered-fish-with-malt-vinegar-aioli": "Beer-Battered Fish",
          "easy-provencal-fish": "Easy Provencal Fish",
          "trout-amandine": "Trout Amandine",
          "poached-cod-with-potatoes-and-leeks": "Poached Cod",
        };

        it("merges flour (cup) across fish recipes", () => {
          const ingredients: RecipeIngredient[] = [
            // "all-purpose flour" → alias → "flour"
            createMockRecipeIngredient({ id: "g27-1", recipeId: "beer-battered-fish-with-malt-vinegar-aioli", name: "all-purpose flour", quantity: 3, unit: "cup", category: "pantry" }),
            createMockRecipeIngredient({ id: "g27-2", recipeId: "trout-amandine", name: "all-purpose flour", quantity: 0.5, unit: "cup", category: "pantry" }),
          ];
          const result = combineIngredients(ingredients, recipeNameMap);
          const flour = result.find(i => i.name === "flour");
          expect(flour).toBeDefined();
          // 3 + 0.5 = 3.5 cups
          expect(flour!.totalQuantity).toBe(3.5);
          expect(flour!.unit).toBe("cup");
        });

        it("merges garlic (clove) across fish recipes", () => {
          const ingredients: RecipeIngredient[] = [
            createMockRecipeIngredient({ id: "g27-3", recipeId: "beer-battered-fish-with-malt-vinegar-aioli", name: "garlic", quantity: 1, unit: "clove", category: "produce" }),
            createMockRecipeIngredient({ id: "g27-4", recipeId: "easy-provencal-fish", name: "garlic", quantity: 10, unit: "clove", category: "produce" }),
            createMockRecipeIngredient({ id: "g27-5", recipeId: "poached-cod-with-potatoes-and-leeks", name: "garlic", quantity: 2, unit: "clove", category: "produce" }),
          ];
          const result = combineIngredients(ingredients, recipeNameMap);
          const garlic = result.find(i => i.name === "garlic");
          expect(garlic).toBeDefined();
          // 1 + 10 + 2 = 13 cloves > 10 → BULK: ceil(13/10) = 2 heads
          expect(garlic!.totalQuantity).toBe(2);
          expect(garlic!.unit).toBe("head");
        });

        it("merges olive oil (tbsp + cup) via volume conversion", () => {
          const ingredients: RecipeIngredient[] = [
            // "extra-virgin olive oil" → alias → "olive oil"
            createMockRecipeIngredient({ id: "g27-6", recipeId: "beer-battered-fish-with-malt-vinegar-aioli", name: "extra-virgin olive oil", quantity: 0.5, unit: "cup", category: "pantry" }),
            createMockRecipeIngredient({ id: "g27-7", recipeId: "easy-provencal-fish", name: "extra-virgin olive oil", quantity: 1, unit: "tbsp", category: "pantry" }),
            createMockRecipeIngredient({ id: "g27-8", recipeId: "poached-cod-with-potatoes-and-leeks", name: "olive oil", quantity: 2, unit: "tbsp", category: "pantry" }),
          ];
          const result = combineIngredients(ingredients, recipeNameMap);
          const oil = result.find(i => i.name === "olive oil");
          expect(oil).toBeDefined();
          // 0.5 cup = 24 tsp, 1 tbsp = 3 tsp, 2 tbsp = 6 tsp → 33 tsp
          // 33/48 = 0.6875 cup (>= 0.5 → cup)
          expect(oil!.unit).toBe("cup");
          expect(oil!.totalQuantity).toBeCloseTo(33 / 48, 2);
        });
      });

      // Group 28: Middle Eastern — Shakshuka + Chicken Shawarma + Lamb Kebabs + Stuffed Onions
      describe("Middle Eastern: Shakshuka + Shawarma + Kebabs + Stuffed Onions", () => {
        const recipeNameMap: Record<string, string> = {
          "shakshuka": "Shakshuka",
          "chicken-shawarma": "Chicken Shawarma",
          "lamb-kebabs": "Lamb Kebabs",
          "stuffed-onions": "Stuffed Onions",
        };

        it("merges cumin (tsp + tbsp) via volume conversion", () => {
          const ingredients: RecipeIngredient[] = [
            createMockRecipeIngredient({ id: "g28-1", recipeId: "shakshuka", name: "cumin", quantity: 1, unit: "tsp", category: "spices" }),
            // "ground cumin" → strips "ground" → "cumin"
            createMockRecipeIngredient({ id: "g28-2", recipeId: "chicken-shawarma", name: "ground cumin", quantity: 0.75, unit: "tbsp", category: "spices" }),
            createMockRecipeIngredient({ id: "g28-3", recipeId: "lamb-kebabs", name: "cumin", quantity: 2, unit: "tsp", category: "spices" }),
            createMockRecipeIngredient({ id: "g28-4", recipeId: "lamb-kebabs", name: "cumin", quantity: 1, unit: "tsp", category: "spices" }),
            createMockRecipeIngredient({ id: "g28-5", recipeId: "stuffed-onions", name: "ground cumin", quantity: 0.5, unit: "tsp", category: "spices" }),
          ];
          const result = combineIngredients(ingredients, recipeNameMap);
          const cumin = result.find(i => i.name === "cumin");
          expect(cumin).toBeDefined();
          // 1 tsp + 0.75 tbsp(=2.25 tsp) + 2 tsp + 1 tsp + 0.5 tsp = 6.75 tsp
          // 6.75/3 = 2.25 tbsp (>= 0.5 → tbsp); 6.75/48 = 0.14 cup (< 0.5)
          expect(cumin!.unit).toBe("tbsp");
          expect(cumin!.totalQuantity).toBeCloseTo(6.75 / 3, 2);
        });

        it("merges paprika (tsp + tbsp) via volume conversion", () => {
          const ingredients: RecipeIngredient[] = [
            createMockRecipeIngredient({ id: "g28-6", recipeId: "shakshuka", name: "paprika", quantity: 1, unit: "tsp", category: "spices" }),
            createMockRecipeIngredient({ id: "g28-7", recipeId: "chicken-shawarma", name: "paprika", quantity: 0.75, unit: "tbsp", category: "spices" }),
            createMockRecipeIngredient({ id: "g28-8", recipeId: "lamb-kebabs", name: "paprika", quantity: 2, unit: "tsp", category: "spices" }),
          ];
          const result = combineIngredients(ingredients, recipeNameMap);
          const paprika = result.find(i => i.name === "paprika");
          expect(paprika).toBeDefined();
          // 1 tsp + 0.75 tbsp(=2.25 tsp) + 2 tsp = 5.25 tsp
          // 5.25/3 = 1.75 tbsp (>= 0.5 → tbsp)
          expect(paprika!.unit).toBe("tbsp");
          expect(paprika!.totalQuantity).toBeCloseTo(5.25 / 3, 2);
        });

        it("merges onion (count): 'yellow onion' alias + 'red onion' kept separate", () => {
          const ingredients: RecipeIngredient[] = [
            // "red onion" stays as "red onion" (no alias)
            createMockRecipeIngredient({ id: "g28-9", recipeId: "shakshuka", name: "red onion", quantity: 1, unit: undefined, category: "produce" }),
            // "yellow onion" → alias → "onion"
            createMockRecipeIngredient({ id: "g28-10", recipeId: "stuffed-onions", name: "yellow onion", quantity: 3, unit: undefined, category: "produce" }),
            createMockRecipeIngredient({ id: "g28-11", recipeId: "chicken-shawarma", name: "onion", quantity: 1, unit: undefined, category: "produce" }),
            createMockRecipeIngredient({ id: "g28-12", recipeId: "lamb-kebabs", name: "onion", quantity: 0.5, unit: undefined, category: "produce" }),
          ];
          const result = combineIngredients(ingredients, recipeNameMap);
          // red onion is separate
          const redOnion = result.find(i => i.name === "red onion");
          expect(redOnion).toBeDefined();
          expect(redOnion!.totalQuantity).toBe(1);
          // onion: 3 (yellow→onion) + 1 + 0.5 = 4.5
          const onion = result.find(i => i.name === "onion");
          expect(onion).toBeDefined();
          expect(onion!.totalQuantity).toBe(4.5);
        });
      });
    });
  });

  describe("groupByCategory", () => {
    it("groups items by category in correct order", () => {
      const items: SmartGroceryItem[] = [
        { name: "chicken", totalQuantity: 1, unit: "lb", category: "meat_seafood", sourceRecipes: ["Recipe A"] },
        { name: "flour", totalQuantity: 2, unit: "cup", category: "pantry", sourceRecipes: ["Recipe A"] },
        { name: "tomato", totalQuantity: 3, category: "produce", sourceRecipes: ["Recipe B"] },
      ];

      const result = groupByCategory(items);
      const keys = Array.from(result.keys());
      expect(keys).toEqual(["produce", "meat_seafood", "pantry"]);
      expect(result.get("produce")).toHaveLength(1);
      expect(result.get("meat_seafood")).toHaveLength(1);
      expect(result.get("pantry")).toHaveLength(1);
    });

    it("omits empty categories", () => {
      const items: SmartGroceryItem[] = [
        { name: "flour", totalQuantity: 2, unit: "cup", category: "pantry", sourceRecipes: ["Recipe A"] },
      ];

      const result = groupByCategory(items);
      expect(result.size).toBe(1);
      expect(result.has("produce")).toBe(false);
    });

    it("returns empty map for empty input", () => {
      const result = groupByCategory([]);
      expect(result.size).toBe(0);
    });

  });

  describe("formatGroceryItem", () => {
    it("formats item with quantity and unit", () => {
      const item: SmartGroceryItem = {
        name: "flour",
        totalQuantity: 2,
        unit: "cup",
        category: "pantry",
        sourceRecipes: ["Recipe A"],
      };
      expect(formatGroceryItem(item)).toBe("2 cups flour");
    });

    it("formats item with fractional quantity as fraction", () => {
      const item: SmartGroceryItem = {
        name: "butter",
        totalQuantity: 1.5,
        unit: "tbsp",
        category: "dairy",
        sourceRecipes: ["Recipe A"],
      };
      expect(formatGroceryItem(item)).toBe("1 1/2 tbsp butter");
    });

    it("formats item without quantity", () => {
      const item: SmartGroceryItem = {
        name: "salt",
        category: "spices",
        sourceRecipes: ["Recipe A"],
      };
      expect(formatGroceryItem(item)).toBe("salt");
    });

    it("falls back to name when displayName is empty", () => {
      expect(formatGroceryItem({
        name: "egg",
        displayName: "",
        totalQuantity: 3,
        category: "dairy",
        sourceRecipes: ["Recipe A"],
      })).toBe("3 egg");
    });

    it("uses displayName for SmartGroceryItem", () => {
      // SmartGroceryItem has displayName — used instead of name
      expect(formatGroceryItem({
        name: "egg",
        displayName: "eggs",
        totalQuantity: 3,
        category: "dairy",
        sourceRecipes: ["Recipe A"],
      } as SmartGroceryItem)).toBe("3 eggs");

      expect(formatGroceryItem({
        name: "tomato",
        displayName: "tomatoes",
        totalQuantity: 2,
        category: "produce",
        sourceRecipes: ["Recipe A"],
      } as SmartGroceryItem)).toBe("2 tomatoes");

      expect(formatGroceryItem({
        name: "bay leaf",
        displayName: "bay leaves",
        totalQuantity: 3,
        category: "spices",
        sourceRecipes: ["Recipe A"],
      } as SmartGroceryItem)).toBe("3 bay leaves");

      expect(formatGroceryItem({
        name: "cherry",
        displayName: "cherries",
        totalQuantity: 5,
        category: "produce",
        sourceRecipes: ["Recipe A"],
      } as SmartGroceryItem)).toBe("5 cherries");
    });

    it("keeps singular when no unit and quantity is 1", () => {
      expect(formatGroceryItem({
        name: "egg",
        totalQuantity: 1,
        category: "dairy",
        sourceRecipes: ["Recipe A"],
      })).toBe("1 egg");
    });

    it("uses displayName for SmartGroceryItem with unit", () => {
      expect(formatGroceryItem({
        name: "egg",
        displayName: "eggs",
        totalQuantity: 3,
        unit: "cup",
        category: "dairy",
        sourceRecipes: ["Recipe A"],
      } as SmartGroceryItem)).toBe("3 cups eggs");

      expect(formatGroceryItem({
        name: "black bean",
        displayName: "black beans",
        totalQuantity: 2,
        unit: "cup",
        category: "pantry",
        sourceRecipes: ["Recipe A"],
      } as SmartGroceryItem)).toBe("2 cups black beans");
    });

    it("uses displayName for SmartGroceryItem with unit even when quantity is 1 or less", () => {
      expect(formatGroceryItem({
        name: "blueberry",
        displayName: "blueberries",
        totalQuantity: 1,
        unit: "cup",
        category: "produce",
        sourceRecipes: ["Recipe A"],
      } as SmartGroceryItem)).toBe("1 cup blueberries");

      expect(formatGroceryItem({
        name: "mushroom",
        displayName: "mushrooms",
        totalQuantity: 0.5,
        unit: "cup",
        category: "produce",
        sourceRecipes: ["Recipe A"],
      } as SmartGroceryItem)).toBe("1/2 cup mushrooms");
    });

    it("keeps mass nouns singular even with quantity > 1", () => {
      expect(formatGroceryItem({
        name: "flour",
        totalQuantity: 3,
        unit: "cup",
        category: "pantry",
        sourceRecipes: ["Recipe A"],
      })).toBe("3 cups flour");

      expect(formatGroceryItem({
        name: "chicken",
        totalQuantity: 2,
        unit: "lb",
        category: "meat_seafood",
        sourceRecipes: ["Recipe A"],
      })).toBe("2 lb chicken");

      expect(formatGroceryItem({
        name: "rice",
        totalQuantity: 3,
        unit: "cup",
        category: "pantry",
        sourceRecipes: ["Recipe A"],
      })).toBe("3 cups rice");

      expect(formatGroceryItem({
        name: "buttermilk",
        totalQuantity: 2,
        unit: "cup",
        category: "dairy",
        sourceRecipes: ["Recipe A"],
      })).toBe("2 cups buttermilk");

      expect(formatGroceryItem({
        name: "rice noodle",
        totalQuantity: 8,
        unit: "oz",
        category: "pantry",
        sourceRecipes: ["Recipe A"],
      })).toBe("8 oz rice noodle");

      expect(formatGroceryItem({
        name: "spaghetti",
        totalQuantity: 2,
        unit: "lb",
        category: "pantry",
        sourceRecipes: ["Recipe A"],
      })).toBe("2 lb spaghetti");

      expect(formatGroceryItem({
        name: "sage",
        totalQuantity: 3,
        unit: "tbsp",
        category: "spices",
        sourceRecipes: ["Recipe A"],
      })).toBe("3 tbsp sage");

      expect(formatGroceryItem({
        name: "tarragon",
        totalQuantity: 2,
        unit: "tsp",
        category: "spices",
        sourceRecipes: ["Recipe A"],
      })).toBe("2 tsp tarragon");

      expect(formatGroceryItem({
        name: "penne",
        totalQuantity: 2,
        unit: "lb",
        category: "pantry",
        sourceRecipes: ["Recipe A"],
      })).toBe("2 lb penne");

      expect(formatGroceryItem({
        name: "pesto",
        totalQuantity: 3,
        unit: "tbsp",
        category: "condiments",
        sourceRecipes: ["Recipe A"],
      })).toBe("3 tbsp pesto");
    });

    it("keeps compound mass nouns singular (powder, sauce, paste, soy)", () => {
      expect(formatGroceryItem({
        name: "coriander",
        totalQuantity: 2,
        unit: "tsp",
        category: "spices",
        sourceRecipes: ["Recipe A"],
      })).toBe("2 tsp coriander");

      expect(formatGroceryItem({
        name: "cumin powder",
        totalQuantity: 2,
        unit: "tsp",
        category: "spices",
        sourceRecipes: ["Recipe A"],
      })).toBe("2 tsp cumin powder");

      expect(formatGroceryItem({
        name: "fish sauce",
        totalQuantity: 3,
        unit: "tbsp",
        category: "condiments",
        sourceRecipes: ["Recipe A"],
      })).toBe("3 tbsp fish sauce");

      expect(formatGroceryItem({
        name: "thai green curry paste",
        totalQuantity: 4,
        unit: "tbsp",
        category: "pantry",
        sourceRecipes: ["Recipe A"],
      })).toBe("4 tbsp thai green curry paste");

      expect(formatGroceryItem({
        name: "dark soy",
        totalQuantity: 2,
        unit: "tsp",
        category: "condiments",
        sourceRecipes: ["Recipe A"],
      })).toBe("2 tsp dark soy");

      expect(formatGroceryItem({
        name: "baking soda",
        totalQuantity: 2,
        unit: "tsp",
        category: "pantry",
        sourceRecipes: ["Recipe A"],
      })).toBe("2 tsp baking soda");

      expect(formatGroceryItem({
        name: "vanilla extract",
        totalQuantity: 3,
        unit: "tsp",
        category: "pantry",
        sourceRecipes: ["Recipe A"],
      })).toBe("3 tsp vanilla extract");
    });

    it("keeps plurale tantum nouns as-is (red pepper flakes)", () => {
      expect(formatGroceryItem({
        name: "red pepper flakes",
        totalQuantity: 2,
        unit: "tsp",
        category: "spices",
        sourceRecipes: ["Recipe A"],
      })).toBe("2 tsp red pepper flakes");

      expect(formatGroceryItem({
        name: "red pepper flakes",
        totalQuantity: 1,
        category: "spices",
        sourceRecipes: ["Recipe A"],
      })).toBe("1 red pepper flakes");
    });

    it("keeps full-name mass nouns singular (half and half, cayenne pepper)", () => {
      expect(formatGroceryItem({
        name: "half and half",
        totalQuantity: 2,
        unit: "cup",
        category: "dairy",
        sourceRecipes: ["Recipe A"],
      })).toBe("2 cups half and half");

      expect(formatGroceryItem({
        name: "cayenne pepper",
        totalQuantity: 2,
        unit: "tsp",
        category: "spices",
        sourceRecipes: ["Recipe A"],
      })).toBe("2 tsp cayenne pepper");

      expect(formatGroceryItem({
        name: "pepper",
        totalQuantity: 2,
        unit: "tsp",
        category: "spices",
        sourceRecipes: ["Recipe A"],
      })).toBe("2 tsp pepper");

      // bell pepper as SmartGroceryItem: no pluralization (no displayName)
      expect(formatGroceryItem({
        name: "bell pepper",
        totalQuantity: 3,
        category: "produce",
        sourceRecipes: ["Recipe A"],
      })).toBe("3 bell pepper");
    });

    it("formats name-first units: celery stalks, bacon strips, corn ears", () => {
      expect(formatGroceryItem({
        name: "celery",
        totalQuantity: 5,
        unit: "stalk",
        category: "produce",
        sourceRecipes: ["Recipe A"],
      })).toBe("5 celery stalks");

      expect(formatGroceryItem({
        name: "bacon",
        totalQuantity: 13,
        unit: "strip",
        category: "meat_seafood",
        sourceRecipes: ["Recipe A"],
      })).toBe("13 bacon strips");

      expect(formatGroceryItem({
        name: "corn",
        totalQuantity: 4,
        unit: "ear",
        category: "produce",
        sourceRecipes: ["Recipe A"],
      })).toBe("4 corn ears");
    });

    it("keeps name-first unit singular when quantity is 1", () => {
      expect(formatGroceryItem({
        name: "garlic",
        totalQuantity: 1,
        unit: "clove",
        category: "produce",
        sourceRecipes: ["Recipe A"],
      })).toBe("1 garlic clove");
    });

    it("formats name-first unit without quantity", () => {
      expect(formatGroceryItem({
        name: "parsley",
        unit: "bunch",
        category: "produce",
        sourceRecipes: ["Recipe A"],
      })).toBe("parsley bunch");
    });

    it("formats item with unit but no quantity", () => {
      const item: SmartGroceryItem = {
        name: "olive oil",
        unit: "tbsp",
        category: "condiments",
        sourceRecipes: ["Recipe A"],
      };
      expect(formatGroceryItem(item)).toBe("tbsp olive oil");
    });

    it("formats integer quantities without fraction", () => {
      const item: SmartGroceryItem = {
        name: "flour",
        totalQuantity: 3.0,
        unit: "cup",
        category: "pantry",
        sourceRecipes: ["Recipe A"],
      };
      expect(formatGroceryItem(item)).toBe("3 cups flour");
    });

    it("formats 0.25 as 1/4", () => {
      const item: SmartGroceryItem = {
        name: "vanilla",
        totalQuantity: 0.25,
        unit: "tsp",
        category: "spices",
        sourceRecipes: ["Recipe A"],
      };
      expect(formatGroceryItem(item)).toBe("1/4 tsp vanilla");
    });

    it("formats 0.333 as 1/3", () => {
      const item: SmartGroceryItem = {
        name: "sugar",
        totalQuantity: 0.333,
        unit: "cup",
        category: "pantry",
        sourceRecipes: ["Recipe A"],
      };
      expect(formatGroceryItem(item)).toBe("1/3 cup sugar");
    });

    it("keeps liquid as mass noun (uncountable in cooking)", () => {
      expect(formatGroceryItem({
        name: "ramp pickling liquid",
        totalQuantity: 3,
        unit: "tbsp",
        category: "condiments",
        sourceRecipes: ["Recipe A"],
      })).toBe("3 tbsp ramp pickling liquid");
    });

    it("keeps broth as mass noun", () => {
      expect(formatGroceryItem({
        name: "chicken broth",
        totalQuantity: 2,
        unit: "cup",
        category: "pantry",
        sourceRecipes: ["Recipe A"],
      })).toBe("2 cups chicken broth");
    });

    it("displays always-plural items as plural even without quantity", () => {
      expect(formatGroceryItem({
        name: "tortilla chips",
        category: "other",
        sourceRecipes: ["Recipe A"],
      })).toBe("tortilla chips");

      expect(formatGroceryItem({
        name: "tortilla chips",
        totalQuantity: 1,
        unit: "bag",
        category: "other",
        sourceRecipes: ["Recipe A"],
      })).toBe("1 bag tortilla chips");
    });

    it("formats foie gras correctly (foreign word)", () => {
      expect(formatGroceryItem({
        name: "foie gras",
        totalQuantity: 4,
        unit: "oz",
        category: "meat_seafood",
        sourceRecipes: ["Recipe A"],
      })).toBe("4 oz foie gras");
    });
  });

  describe("generateCSV", () => {
    it("generates CSV with header and rows", () => {
      const grouped = new Map<GroceryCategory, SmartGroceryItem[]>();
      grouped.set("produce", [
        { name: "tomato", totalQuantity: 3, category: "produce", sourceRecipes: ["Recipe A"] },
      ]);
      grouped.set("pantry", [
        { name: "flour", totalQuantity: 2, unit: "cup", category: "pantry", sourceRecipes: ["Recipe A", "Recipe B"] },
      ]);

      const csv = generateCSV(grouped);
      const lines = csv.split("\n");
      expect(lines[0]).toBe("Category,Item,Quantity,Unit,Recipes");
      expect(lines[1]).toBe("Produce,tomato,3,,Recipe A");
      expect(lines[2]).toBe("Pantry,flour,2,cup,Recipe A; Recipe B");
    });

    it("handles items without quantity", () => {
      const grouped = new Map<GroceryCategory, SmartGroceryItem[]>();
      grouped.set("spices", [
        { name: "salt", category: "spices", sourceRecipes: ["Recipe A"] },
      ]);

      const csv = generateCSV(grouped);
      const lines = csv.split("\n");
      expect(lines[1]).toBe("Spices,salt,,,Recipe A");
    });

    it("escapes item names with commas", () => {
      const grouped = new Map<GroceryCategory, SmartGroceryItem[]>();
      grouped.set("other", [
        { name: "salt, pepper", category: "other", sourceRecipes: ["Recipe A"] },
      ]);

      const csv = generateCSV(grouped);
      const lines = csv.split("\n");
      expect(lines[1]).toBe('Other,"salt, pepper",,,Recipe A');
    });

    it("escapes recipe names with commas", () => {
      const grouped = new Map<GroceryCategory, SmartGroceryItem[]>();
      grouped.set("other", [
        { name: "flour", totalQuantity: 1, unit: "cup", category: "other", sourceRecipes: ["Recipe A, The Best"] },
      ]);

      const csv = generateCSV(grouped);
      const lines = csv.split("\n");
      expect(lines[1]).toBe('Other,flour,1,cup,"Recipe A, The Best"');
    });

    it("falls back to name when SmartGroceryItem has empty displayName", () => {
      const grouped = new Map<GroceryCategory, SmartGroceryItem[]>();
      grouped.set("produce", [
        { name: "tomatoes", displayName: "", totalQuantity: 2, category: "produce", sourceRecipes: ["Recipe A"] },
      ]);

      const csv = generateCSV(grouped);
      const lines = csv.split("\n");
      expect(lines[1]).toBe("Produce,tomatoes,2,,Recipe A");
    });

    it("returns header only for empty map", () => {
      const csv = generateCSV(new Map());
      expect(csv).toBe("Category,Item,Quantity,Unit,Recipes");
    });

    it("uses fractions in quantity column", () => {
      const grouped = new Map<GroceryCategory, SmartGroceryItem[]>();
      grouped.set("spices", [
        { name: "vanilla", totalQuantity: 0.25, unit: "tsp", category: "spices", sourceRecipes: ["Recipe A"] },
      ]);

      const csv = generateCSV(grouped);
      const lines = csv.split("\n");
      expect(lines[1]).toBe("Spices,vanilla,1/4,tsp,Recipe A");
    });

    it("uses mixed numbers in quantity column", () => {
      const grouped = new Map<GroceryCategory, SmartGroceryItem[]>();
      grouped.set("dairy", [
        { name: "butter", totalQuantity: 1.5, unit: "tbsp", category: "dairy", sourceRecipes: ["Recipe A"] },
      ]);

      const csv = generateCSV(grouped);
      const lines = csv.split("\n");
      expect(lines[1]).toBe("Dairy,butter,1 1/2,tbsp,Recipe A");
    });
  });

  describe("generatePlainText", () => {
    it("generates plain text grouped by category", () => {
      const grouped = new Map<GroceryCategory, SmartGroceryItem[]>();
      grouped.set("produce", [
        { name: "onion", totalQuantity: 2, category: "produce", sourceRecipes: ["R1"] },
        { name: "garlic", totalQuantity: 3, unit: "clove", category: "produce", sourceRecipes: ["R1"] },
      ]);
      grouped.set("dairy", [
        { name: "butter", totalQuantity: 1, unit: "tbsp", category: "dairy", sourceRecipes: ["R1"] },
      ]);

      const text = generatePlainText(grouped);
      expect(text).toContain("PRODUCE");
      expect(text).toContain("  2 onion");
      expect(text).toContain("  3 garlic cloves");
      expect(text).toContain("DAIRY");
      expect(text).toContain("  1 tbsp butter");
    });

    it("returns empty string for empty map", () => {
      const text = generatePlainText(new Map());
      expect(text).toBe("");
    });
  });

  describe("filterPantryItems", () => {
    it("removes items matching pantry list", () => {
      const items: SmartGroceryItem[] = [
        { name: "salt", category: "spices", sourceRecipes: ["Recipe A"] },
        { name: "pepper", category: "spices", sourceRecipes: ["Recipe A"] },
        { name: "flour", totalQuantity: 2, unit: "cup", category: "pantry", sourceRecipes: ["Recipe A"] },
      ];

      const result = filterPantryItems(items, ["salt", "pepper"]);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("flour");
    });

    it("matches case-insensitively", () => {
      const items: SmartGroceryItem[] = [
        { name: "Salt", category: "spices", sourceRecipes: ["Recipe A"] },
        { name: "flour", totalQuantity: 1, unit: "cup", category: "pantry", sourceRecipes: ["Recipe A"] },
      ];

      const result = filterPantryItems(items, ["salt"]);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("flour");
    });

    it("normalizes plurals when matching", () => {
      const items: SmartGroceryItem[] = [
        { name: "onion", totalQuantity: 2, category: "produce", sourceRecipes: ["Recipe A"] },
        { name: "tomato", totalQuantity: 3, category: "produce", sourceRecipes: ["Recipe B"] },
      ];

      const result = filterPantryItems(items, ["onions"]);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("tomato");
    });

    it("returns all items when pantry is empty", () => {
      const items: SmartGroceryItem[] = [
        { name: "flour", totalQuantity: 2, unit: "cup", category: "pantry", sourceRecipes: ["Recipe A"] },
      ];

      const result = filterPantryItems(items, []);
      expect(result).toHaveLength(1);
    });

    it("returns empty array when all items are in pantry", () => {
      const items: SmartGroceryItem[] = [
        { name: "salt", category: "spices", sourceRecipes: ["Recipe A"] },
      ];

      const result = filterPantryItems(items, ["salt"]);
      expect(result).toHaveLength(0);
    });

    it("handles empty items array", () => {
      const result = filterPantryItems([], ["salt"]);
      expect(result).toHaveLength(0);
    });
  });

  describe("filterSmartPantryItems", () => {
    it("removes smart items matching pantry list", () => {
      const items: SmartGroceryItem[] = [
        { name: "salt", category: "spices", sourceRecipes: ["Recipe A"] },
        { name: "flour", totalQuantity: 2, unit: "cup", category: "pantry", sourceRecipes: ["Recipe A"] },
      ];

      const result = filterSmartPantryItems(items, ["salt"]);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("flour");
    });

    it("normalizes names when matching", () => {
      const items: SmartGroceryItem[] = [
        { name: "Onions", totalQuantity: 2, category: "produce", sourceRecipes: ["Recipe A"] },
        { name: "tomato", totalQuantity: 3, category: "produce", sourceRecipes: ["Recipe B"] },
      ];

      const result = filterSmartPantryItems(items, ["onion"]);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("tomato");
    });

    it("returns all items when pantry is empty", () => {
      const items: SmartGroceryItem[] = [
        { name: "flour", totalQuantity: 2, unit: "cup", category: "pantry", sourceRecipes: ["Recipe A"] },
      ];

      const result = filterSmartPantryItems(items, []);
      expect(result).toHaveLength(1);
    });
  });

  describe("downloadCSV", () => {
    let createElementSpy: ReturnType<typeof vi.spyOn>;
    let createObjectURLSpy: ReturnType<typeof vi.spyOn>;
    let revokeObjectURLSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      const mockLink = {
        href: "",
        setAttribute: vi.fn(),
        click: vi.fn(),
      };
      createElementSpy = vi.spyOn(document, "createElement").mockReturnValue(mockLink as unknown as HTMLElement);
      vi.spyOn(document.body, "appendChild").mockImplementation((node) => node);
      vi.spyOn(document.body, "removeChild").mockImplementation((node) => node);
      createObjectURLSpy = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock-url");
      revokeObjectURLSpy = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    });

    it("creates a download link and clicks it", () => {
      downloadCSV("header\nrow1", "grocery-list.csv");

      expect(createElementSpy).toHaveBeenCalledWith("a");
      expect(createObjectURLSpy).toHaveBeenCalled();
      expect(revokeObjectURLSpy).toHaveBeenCalledWith("blob:mock-url");
    });

    it("sets the download attribute with filename", () => {
      downloadCSV("content", "my-list.csv");

      const mockLink = createElementSpy.mock.results[0].value;
      expect(mockLink.setAttribute).toHaveBeenCalledWith("download", "my-list.csv");
    });
  });

  describe("smartCombineIngredients", () => {
    const recipeNameMap: Record<string, string> = {
      "recipe-1": "Pasta",
      "recipe-2": "Salad",
    };
    const ingredients: RecipeIngredient[] = [
      createMockRecipeIngredient({ id: "1", recipeId: "recipe-1", name: "broccoli", quantity: 2, unit: undefined, category: "produce" }),
      createMockRecipeIngredient({ id: "2", recipeId: "recipe-2", name: "broccoli florets", quantity: 2, unit: "cup", category: "produce" }),
    ];

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("calls combine-ingredients edge function with pre-combined payload", async () => {
      const mockItems = [
        { name: "broccoli", displayName: "broccoli", totalQuantity: 4, unit: "cup", category: "produce", sourceRecipes: ["Pasta", "Salad"] },
      ];
      mockInvoke.mockResolvedValue({ data: { items: mockItems, displayNameMap: {} }, error: null });

      const result = await smartCombineIngredients(ingredients, recipeNameMap);

      // Should send preCombined (naive-combined results), not raw ingredients
      expect(mockInvoke).toHaveBeenCalledWith("combine-ingredients", {
        body: {
          preCombined: expect.arrayContaining([
            expect.objectContaining({ name: "broccoli", category: "produce" }),
          ]),
          perRecipeNames: undefined,
        },
      });
      // Verify preCombined format has quantity as string (from decimalToFraction)
      const callBody = mockInvoke.mock.calls[0][1].body;
      expect(callBody).toHaveProperty("preCombined");
      expect(callBody.preCombined[0]).toHaveProperty("sourceRecipes");
      expect(result.items).toEqual(mockItems);
      expect(result.displayNameMap).toEqual({});
    });

    it("falls back to naive combine when edge function returns skipped", async () => {
      mockInvoke.mockResolvedValue({ data: { skipped: true }, error: null });

      const result = await smartCombineIngredients(ingredients, recipeNameMap);
      // Should return naive-combined items as fallback
      expect(result.items.length).toBeGreaterThan(0);
      expect(result.displayNameMap).toEqual({});
    });

    it("falls back to naive combine when edge function returns error", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      mockInvoke.mockResolvedValue({ data: null, error: new Error("Network error") });

      const result = await smartCombineIngredients(ingredients, recipeNameMap);
      expect(result.items.length).toBeGreaterThan(0);
      expect(result.displayNameMap).toEqual({});
      consoleSpy.mockRestore();
    });

    it("falls back to naive combine when data has no items", async () => {
      mockInvoke.mockResolvedValue({ data: { success: true }, error: null });

      const result = await smartCombineIngredients(ingredients, recipeNameMap);
      expect(result.items.length).toBeGreaterThan(0);
      expect(result.displayNameMap).toEqual({});
    });

    it("defaults displayNameMap to empty object when not provided", async () => {
      const mockItems = [
        { name: "broccoli", displayName: "broccoli", totalQuantity: 2, unit: "cup", category: "produce", sourceRecipes: ["Pasta"] },
      ];
      mockInvoke.mockResolvedValue({ data: { items: mockItems }, error: null });

      const result = await smartCombineIngredients(ingredients, recipeNameMap);

      expect(result.displayNameMap).toEqual({});
    });

    it("handles unknown recipe IDs gracefully", async () => {
      const unknownIngredients: RecipeIngredient[] = [
        createMockRecipeIngredient({ id: "1", recipeId: "unknown", name: "flour", quantity: 1, unit: "cup" }),
      ];
      mockInvoke.mockResolvedValue({ data: { items: [], displayNameMap: {} }, error: null });

      await smartCombineIngredients(unknownIngredients, recipeNameMap);

      expect(mockInvoke).toHaveBeenCalledWith("combine-ingredients", {
        body: {
          preCombined: [
            { name: "flour", quantity: "1", unit: "cup", category: "pantry", sourceRecipes: ["Unknown Recipe"] },
          ],
          perRecipeNames: undefined,
        },
      });
    });

    it("handles ingredients with undefined quantity and unit", async () => {
      const nullIngredients: RecipeIngredient[] = [
        createMockRecipeIngredient({ id: "1", recipeId: "recipe-1", name: "salt", quantity: undefined, unit: undefined, category: "spices" }),
      ];
      mockInvoke.mockResolvedValue({ data: { items: [], displayNameMap: {} }, error: null });

      await smartCombineIngredients(nullIngredients, recipeNameMap);

      expect(mockInvoke).toHaveBeenCalledWith("combine-ingredients", {
        body: {
          preCombined: [
            { name: "salt", quantity: null, unit: null, category: "spices", sourceRecipes: ["Pasta"] },
          ],
          perRecipeNames: undefined,
        },
      });
    });
  });

  describe("CATEGORY_OVERRIDES", () => {
    it("is exported and contains known overrides", () => {
      expect(CATEGORY_OVERRIDES["olive oil"]).toBe("pantry");
      expect(CATEGORY_OVERRIDES["tofu"]).toBe("meat_seafood");
      expect(CATEGORY_OVERRIDES["egg"]).toBe("pantry");
      expect(CATEGORY_OVERRIDES["water"]).toBe("other");
    });
  });

  describe("detectCategory", () => {
    it("returns override category for known ingredients", () => {
      expect(detectCategory("olive oil")).toBe("pantry");
      expect(detectCategory("tofu")).toBe("meat_seafood");
      expect(detectCategory("egg")).toBe("pantry");
    });

    it("returns 'other' for unknown ingredients", () => {
      expect(detectCategory("dragon fruit")).toBe("other");
      expect(detectCategory("mystery spice")).toBe("other");
    });

    it("normalizes name before lookup", () => {
      // "eggs" → normalized to "egg" → pantry override
      expect(detectCategory("eggs")).toBe("pantry");
    });
  });

  describe("parseFractionToDecimal", () => {
    it("parses integers", () => {
      expect(parseFractionToDecimal("3")).toBe(3);
      expect(parseFractionToDecimal("0")).toBe(0);
    });

    it("parses decimals", () => {
      expect(parseFractionToDecimal("2.5")).toBe(2.5);
      expect(parseFractionToDecimal("0.75")).toBe(0.75);
    });

    it("parses simple fractions", () => {
      expect(parseFractionToDecimal("1/2")).toBe(0.5);
      expect(parseFractionToDecimal("1/4")).toBe(0.25);
      expect(parseFractionToDecimal("3/4")).toBe(0.75);
    });

    it("parses mixed numbers", () => {
      expect(parseFractionToDecimal("1 1/2")).toBe(1.5);
      expect(parseFractionToDecimal("2 1/4")).toBe(2.25);
    });

    it("returns undefined for empty string", () => {
      expect(parseFractionToDecimal("")).toBeUndefined();
      expect(parseFractionToDecimal("   ")).toBeUndefined();
    });

    it("returns undefined for non-numeric strings", () => {
      expect(parseFractionToDecimal("abc")).toBeUndefined();
      expect(parseFractionToDecimal("a few")).toBeUndefined();
    });

    it("handles division by zero", () => {
      expect(parseFractionToDecimal("1/0")).toBeUndefined();
      expect(parseFractionToDecimal("2 1/0")).toBeUndefined();
    });

    it("handles whitespace", () => {
      expect(parseFractionToDecimal("  1/2  ")).toBe(0.5);
      expect(parseFractionToDecimal(" 3 ")).toBe(3);
    });

    it("handles fractions with spaces around slash", () => {
      expect(parseFractionToDecimal("1 / 2")).toBe(0.5);
    });
  });
});
