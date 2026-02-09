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
  normalizeUnit,
  normalizeIngredientName,
  combineIngredients,
  groupByCategory,
  formatGroceryItem,
  generateCSV,
  downloadCSV,
  filterPantryItems,
  filterSmartPantryItems,
  smartCombineIngredients,
  decimalToFraction,
} from "@/lib/groceryList";
import type { RecipeIngredient, CombinedGroceryItem, SmartGroceryItem, GroceryCategory } from "@/types";
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

    it("singularizes -es endings (not -ses, -ches, -shes, -kes, -ves)", () => {
      expect(normalizeIngredientName("tomatoes")).toBe("tomato");
      expect(normalizeIngredientName("potatoes")).toBe("potato");
    });

    it("singularizes -kes words via -s rule (not -es)", () => {
      expect(normalizeIngredientName("flakes")).toBe("flake");
    });

    it("singularizes -ves words via -s rule (not -es)", () => {
      expect(normalizeIngredientName("cloves")).toBe("clove");
      expect(normalizeIngredientName("olives")).toBe("olive");
    });

    it("applies -s removal after -es rule is skipped for -ches/-shes endings", () => {
      expect(normalizeIngredientName("peaches")).toBe("peache");
      expect(normalizeIngredientName("radishes")).toBe("radishe");
    });

    it("applies -s removal after -ses endings skip -es rule", () => {
      expect(normalizeIngredientName("molasses")).toBe("molasse");
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
      // tsp item with quantity goes through conversion family, undefined-qty tsp goes to plain
      // The first has quantity and goes through volume conversion; the second has no quantity and stays plain
      expect(result).toHaveLength(2);
      const withQty = result.find((r) => r.totalQuantity != null);
      expect(withQty?.totalQuantity).toBe(2);
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
      // 15 cloves / 10 per head = 1.5 → rounds to 2 heads
      expect(result).toHaveLength(1);
      expect(result[0].unit).toBe("head");
      expect(result[0].totalQuantity).toBe(2);
    });

    it("rounds garlic heads to nearest whole number", () => {
      const ingredients: RecipeIngredient[] = [
        createMockRecipeIngredient({ id: "1", recipeId: "recipe-1", name: "garlic", quantity: 7, unit: "clove" }),
        createMockRecipeIngredient({ id: "2", recipeId: "recipe-2", name: "garlic", quantity: 5, unit: "clove" }),
      ];

      const result = combineIngredients(ingredients, recipeNameMap);
      // 12 cloves / 10 per head = 1.2 → rounds to 1 head
      expect(result).toHaveLength(1);
      expect(result[0].unit).toBe("head");
      expect(result[0].totalQuantity).toBe(1);
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
  });

  describe("groupByCategory", () => {
    it("groups items by category in correct order", () => {
      const items: CombinedGroceryItem[] = [
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
      const items: CombinedGroceryItem[] = [
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
      const item: CombinedGroceryItem = {
        name: "flour",
        totalQuantity: 2,
        unit: "cup",
        category: "pantry",
        sourceRecipes: ["Recipe A"],
      };
      expect(formatGroceryItem(item)).toBe("2 cups flour");
    });

    it("formats item with fractional quantity as fraction", () => {
      const item: CombinedGroceryItem = {
        name: "butter",
        totalQuantity: 1.5,
        unit: "tbsp",
        category: "dairy",
        sourceRecipes: ["Recipe A"],
      };
      expect(formatGroceryItem(item)).toBe("1 1/2 tbsp butter");
    });

    it("formats item without quantity", () => {
      const item: CombinedGroceryItem = {
        name: "salt",
        category: "spices",
        sourceRecipes: ["Recipe A"],
      };
      expect(formatGroceryItem(item)).toBe("salt");
    });

    it("pluralizes name when no unit and quantity > 1", () => {
      expect(formatGroceryItem({
        name: "egg",
        totalQuantity: 3,
        category: "dairy",
        sourceRecipes: ["Recipe A"],
      })).toBe("3 eggs");

      expect(formatGroceryItem({
        name: "onion",
        totalQuantity: 4,
        category: "produce",
        sourceRecipes: ["Recipe A"],
      })).toBe("4 onions");

      expect(formatGroceryItem({
        name: "tomato",
        totalQuantity: 2,
        category: "produce",
        sourceRecipes: ["Recipe A"],
      })).toBe("2 tomatoes");

      expect(formatGroceryItem({
        name: "avocado",
        totalQuantity: 3,
        category: "produce",
        sourceRecipes: ["Recipe A"],
      })).toBe("3 avocados");

      expect(formatGroceryItem({
        name: "bay leaf",
        totalQuantity: 3,
        category: "spices",
        sourceRecipes: ["Recipe A"],
      })).toBe("3 bay leaves");

      expect(formatGroceryItem({
        name: "cherry",
        totalQuantity: 5,
        category: "produce",
        sourceRecipes: ["Recipe A"],
      })).toBe("5 cherries");

      expect(formatGroceryItem({
        name: "radish",
        totalQuantity: 3,
        category: "produce",
        sourceRecipes: ["Recipe A"],
      })).toBe("3 radishes");

      expect(formatGroceryItem({
        name: "peach",
        totalQuantity: 4,
        category: "produce",
        sourceRecipes: ["Recipe A"],
      })).toBe("4 peaches");
    });

    it("keeps singular when no unit and quantity is 1", () => {
      expect(formatGroceryItem({
        name: "egg",
        totalQuantity: 1,
        category: "dairy",
        sourceRecipes: ["Recipe A"],
      })).toBe("1 egg");
    });

    it("pluralizes countable nouns even with unit", () => {
      expect(formatGroceryItem({
        name: "egg",
        totalQuantity: 3,
        unit: "cup",
        category: "dairy",
        sourceRecipes: ["Recipe A"],
      })).toBe("3 cups eggs");

      expect(formatGroceryItem({
        name: "black bean",
        totalQuantity: 2,
        unit: "cup",
        category: "pantry",
        sourceRecipes: ["Recipe A"],
      })).toBe("2 cups black beans");
    });

    it("pluralizes countable nouns with unit even when quantity is 1 or less", () => {
      expect(formatGroceryItem({
        name: "blueberry",
        totalQuantity: 1,
        unit: "cup",
        category: "produce",
        sourceRecipes: ["Recipe A"],
      })).toBe("1 cup blueberries");

      expect(formatGroceryItem({
        name: "mushroom",
        totalQuantity: 0.5,
        unit: "cup",
        category: "produce",
        sourceRecipes: ["Recipe A"],
      })).toBe("1/2 cup mushrooms");
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

      // bell pepper should still pluralize
      expect(formatGroceryItem({
        name: "bell pepper",
        totalQuantity: 3,
        category: "produce",
        sourceRecipes: ["Recipe A"],
      })).toBe("3 bell peppers");
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
      const item: CombinedGroceryItem = {
        name: "olive oil",
        unit: "tbsp",
        category: "condiments",
        sourceRecipes: ["Recipe A"],
      };
      expect(formatGroceryItem(item)).toBe("tbsp olive oil");
    });

    it("formats integer quantities without fraction", () => {
      const item: CombinedGroceryItem = {
        name: "flour",
        totalQuantity: 3.0,
        unit: "cup",
        category: "pantry",
        sourceRecipes: ["Recipe A"],
      };
      expect(formatGroceryItem(item)).toBe("3 cups flour");
    });

    it("formats 0.25 as 1/4", () => {
      const item: CombinedGroceryItem = {
        name: "vanilla",
        totalQuantity: 0.25,
        unit: "tsp",
        category: "spices",
        sourceRecipes: ["Recipe A"],
      };
      expect(formatGroceryItem(item)).toBe("1/4 tsp vanilla");
    });

    it("formats 0.333 as 1/3", () => {
      const item: CombinedGroceryItem = {
        name: "sugar",
        totalQuantity: 0.333,
        unit: "cup",
        category: "pantry",
        sourceRecipes: ["Recipe A"],
      };
      expect(formatGroceryItem(item)).toBe("1/3 cup sugar");
    });
  });

  describe("generateCSV", () => {
    it("generates CSV with header and rows", () => {
      const grouped = new Map<GroceryCategory, CombinedGroceryItem[]>();
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
      const grouped = new Map<GroceryCategory, CombinedGroceryItem[]>();
      grouped.set("spices", [
        { name: "salt", category: "spices", sourceRecipes: ["Recipe A"] },
      ]);

      const csv = generateCSV(grouped);
      const lines = csv.split("\n");
      expect(lines[1]).toBe("Spices,salt,,,Recipe A");
    });

    it("escapes item names with commas", () => {
      const grouped = new Map<GroceryCategory, CombinedGroceryItem[]>();
      grouped.set("other", [
        { name: "salt, pepper", category: "other", sourceRecipes: ["Recipe A"] },
      ]);

      const csv = generateCSV(grouped);
      const lines = csv.split("\n");
      expect(lines[1]).toBe('Other,"salt, pepper",,,Recipe A');
    });

    it("escapes recipe names with commas", () => {
      const grouped = new Map<GroceryCategory, CombinedGroceryItem[]>();
      grouped.set("other", [
        { name: "flour", totalQuantity: 1, unit: "cup", category: "other", sourceRecipes: ["Recipe A, The Best"] },
      ]);

      const csv = generateCSV(grouped);
      const lines = csv.split("\n");
      expect(lines[1]).toBe('Other,flour,1,cup,"Recipe A, The Best"');
    });

    it("returns header only for empty map", () => {
      const csv = generateCSV(new Map());
      expect(csv).toBe("Category,Item,Quantity,Unit,Recipes");
    });

    it("uses fractions in quantity column", () => {
      const grouped = new Map<GroceryCategory, CombinedGroceryItem[]>();
      grouped.set("spices", [
        { name: "vanilla", totalQuantity: 0.25, unit: "tsp", category: "spices", sourceRecipes: ["Recipe A"] },
      ]);

      const csv = generateCSV(grouped);
      const lines = csv.split("\n");
      expect(lines[1]).toBe("Spices,vanilla,1/4,tsp,Recipe A");
    });

    it("uses mixed numbers in quantity column", () => {
      const grouped = new Map<GroceryCategory, CombinedGroceryItem[]>();
      grouped.set("dairy", [
        { name: "butter", totalQuantity: 1.5, unit: "tbsp", category: "dairy", sourceRecipes: ["Recipe A"] },
      ]);

      const csv = generateCSV(grouped);
      const lines = csv.split("\n");
      expect(lines[1]).toBe("Dairy,butter,1 1/2,tbsp,Recipe A");
    });
  });

  describe("filterPantryItems", () => {
    it("removes items matching pantry list", () => {
      const items: CombinedGroceryItem[] = [
        { name: "salt", category: "spices", sourceRecipes: ["Recipe A"] },
        { name: "pepper", category: "spices", sourceRecipes: ["Recipe A"] },
        { name: "flour", totalQuantity: 2, unit: "cup", category: "pantry", sourceRecipes: ["Recipe A"] },
      ];

      const result = filterPantryItems(items, ["salt", "pepper"]);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("flour");
    });

    it("matches case-insensitively", () => {
      const items: CombinedGroceryItem[] = [
        { name: "Salt", category: "spices", sourceRecipes: ["Recipe A"] },
        { name: "flour", totalQuantity: 1, unit: "cup", category: "pantry", sourceRecipes: ["Recipe A"] },
      ];

      const result = filterPantryItems(items, ["salt"]);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("flour");
    });

    it("normalizes plurals when matching", () => {
      const items: CombinedGroceryItem[] = [
        { name: "onion", totalQuantity: 2, category: "produce", sourceRecipes: ["Recipe A"] },
        { name: "tomato", totalQuantity: 3, category: "produce", sourceRecipes: ["Recipe B"] },
      ];

      const result = filterPantryItems(items, ["onions"]);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("tomato");
    });

    it("returns all items when pantry is empty", () => {
      const items: CombinedGroceryItem[] = [
        { name: "flour", totalQuantity: 2, unit: "cup", category: "pantry", sourceRecipes: ["Recipe A"] },
      ];

      const result = filterPantryItems(items, []);
      expect(result).toHaveLength(1);
    });

    it("returns empty array when all items are in pantry", () => {
      const items: CombinedGroceryItem[] = [
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
        { name: "broccoli", totalQuantity: 4, unit: "cup", category: "produce", sourceRecipes: ["Pasta", "Salad"] },
      ];
      mockInvoke.mockResolvedValue({ data: { items: mockItems }, error: null });

      const result = await smartCombineIngredients(ingredients, recipeNameMap);

      // Should send preCombined (naive-combined results), not raw ingredients
      expect(mockInvoke).toHaveBeenCalledWith("combine-ingredients", {
        body: {
          preCombined: expect.arrayContaining([
            expect.objectContaining({ name: "broccoli", category: "produce" }),
          ]),
        },
      });
      // Verify preCombined format has quantity as string (from decimalToFraction)
      const callBody = mockInvoke.mock.calls[0][1].body;
      expect(callBody).toHaveProperty("preCombined");
      expect(callBody.preCombined[0]).toHaveProperty("sourceRecipes");
      expect(result).toEqual(mockItems);
    });

    it("returns null when edge function returns skipped", async () => {
      mockInvoke.mockResolvedValue({ data: { skipped: true }, error: null });

      const result = await smartCombineIngredients(ingredients, recipeNameMap);
      expect(result).toBeNull();
    });

    it("returns null when edge function returns error", async () => {
      mockInvoke.mockResolvedValue({ data: null, error: new Error("Network error") });

      const result = await smartCombineIngredients(ingredients, recipeNameMap);
      expect(result).toBeNull();
    });

    it("returns null when data has no items", async () => {
      mockInvoke.mockResolvedValue({ data: { success: true }, error: null });

      const result = await smartCombineIngredients(ingredients, recipeNameMap);
      expect(result).toBeNull();
    });

    it("handles unknown recipe IDs gracefully", async () => {
      const unknownIngredients: RecipeIngredient[] = [
        createMockRecipeIngredient({ id: "1", recipeId: "unknown", name: "flour", quantity: 1, unit: "cup" }),
      ];
      mockInvoke.mockResolvedValue({ data: { items: [] }, error: null });

      await smartCombineIngredients(unknownIngredients, recipeNameMap);

      expect(mockInvoke).toHaveBeenCalledWith("combine-ingredients", {
        body: {
          preCombined: [
            { name: "flour", quantity: "1", unit: "cup", category: "pantry", sourceRecipes: ["Unknown Recipe"] },
          ],
        },
      });
    });

    it("handles ingredients with undefined quantity and unit", async () => {
      const nullIngredients: RecipeIngredient[] = [
        createMockRecipeIngredient({ id: "1", recipeId: "recipe-1", name: "salt", quantity: undefined, unit: undefined, category: "spices" }),
      ];
      mockInvoke.mockResolvedValue({ data: { items: [] }, error: null });

      await smartCombineIngredients(nullIngredients, recipeNameMap);

      expect(mockInvoke).toHaveBeenCalledWith("combine-ingredients", {
        body: {
          preCombined: [
            { name: "salt", quantity: null, unit: null, category: "spices", sourceRecipes: ["Pasta"] },
          ],
        },
      });
    });
  });
});
