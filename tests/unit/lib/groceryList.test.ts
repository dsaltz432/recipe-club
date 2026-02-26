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
  groupByCategory,
  formatGroceryItem,
  generateCSV,
  generatePlainText,
  downloadCSV,
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

    it("matches case-insensitively via toLowerCase", () => {
      const items: SmartGroceryItem[] = [
        { name: "Salt", category: "spices", sourceRecipes: ["Recipe A"] },
        { name: "flour", totalQuantity: 1, unit: "cup", category: "pantry", sourceRecipes: ["Recipe A"] },
      ];

      const result = filterSmartPantryItems(items, ["salt"]);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("flour");
    });

    it("matches with whitespace trimming", () => {
      const items: SmartGroceryItem[] = [
        { name: "  salt  ", category: "spices", sourceRecipes: ["Recipe A"] },
        { name: "flour", totalQuantity: 1, unit: "cup", category: "pantry", sourceRecipes: ["Recipe A"] },
      ];

      const result = filterSmartPantryItems(items, ["salt"]);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("flour");
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

    it("calls combine-ingredients edge function with raw ingredients", async () => {
      const mockItems = [
        { name: "broccoli", displayName: "broccoli", totalQuantity: 4, unit: "cup", category: "produce", sourceRecipes: ["Pasta", "Salad"] },
      ];
      const mockPerRecipeItems = {
        "Pasta": [{ name: "broccoli", displayName: "broccoli", totalQuantity: 2, category: "produce", sourceRecipes: ["Pasta"] }],
        "Salad": [{ name: "broccoli florets", displayName: "broccoli florets", totalQuantity: 2, unit: "cup", category: "produce", sourceRecipes: ["Salad"] }],
      };
      mockInvoke.mockResolvedValue({ data: { items: mockItems, perRecipeItems: mockPerRecipeItems }, error: null });

      const result = await smartCombineIngredients(ingredients, recipeNameMap);

      expect(mockInvoke).toHaveBeenCalledWith("combine-ingredients", {
        body: {
          rawIngredients: [
            { name: "broccoli", quantity: "2", unit: null, category: "produce", recipeName: "Pasta" },
            { name: "broccoli florets", quantity: "2", unit: "cup", category: "produce", recipeName: "Salad" },
          ],
        },
      });
      expect(result.items).toEqual(mockItems);
      expect(result.perRecipeItems).toEqual(mockPerRecipeItems);
    });

    it("throws when edge function returns skipped", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      mockInvoke.mockResolvedValue({ data: { skipped: true }, error: null });

      await expect(smartCombineIngredients(ingredients, recipeNameMap)).rejects.toThrow("AI returned skipped or no items");
      consoleSpy.mockRestore();
    });

    it("throws when edge function returns error", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      mockInvoke.mockResolvedValue({ data: null, error: new Error("Network error") });

      await expect(smartCombineIngredients(ingredients, recipeNameMap)).rejects.toThrow("Network error");
      consoleSpy.mockRestore();
    });

    it("throws when data has no items", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      mockInvoke.mockResolvedValue({ data: { success: true }, error: null });

      await expect(smartCombineIngredients(ingredients, recipeNameMap)).rejects.toThrow("AI returned skipped or no items");
      consoleSpy.mockRestore();
    });

    it("defaults perRecipeItems to empty object when not provided", async () => {
      const mockItems = [
        { name: "broccoli", displayName: "broccoli", totalQuantity: 2, unit: "cup", category: "produce", sourceRecipes: ["Pasta"] },
      ];
      mockInvoke.mockResolvedValue({ data: { items: mockItems }, error: null });

      const result = await smartCombineIngredients(ingredients, recipeNameMap);

      expect(result.perRecipeItems).toEqual({});
    });

    it("handles unknown recipe IDs gracefully", async () => {
      const unknownIngredients: RecipeIngredient[] = [
        createMockRecipeIngredient({ id: "1", recipeId: "unknown", name: "flour", quantity: 1, unit: "cup" }),
      ];
      const mockItems = [{ name: "flour", displayName: "flour", totalQuantity: 1, unit: "cup", category: "pantry", sourceRecipes: ["Unknown Recipe"] }];
      mockInvoke.mockResolvedValue({ data: { items: mockItems, perRecipeItems: {} }, error: null });

      await smartCombineIngredients(unknownIngredients, recipeNameMap);

      expect(mockInvoke).toHaveBeenCalledWith("combine-ingredients", {
        body: {
          rawIngredients: [
            { name: "flour", quantity: "1", unit: "cup", category: "pantry", recipeName: "Unknown Recipe" },
          ],
        },
      });
    });

    it("handles ingredients with undefined quantity and unit", async () => {
      const nullIngredients: RecipeIngredient[] = [
        createMockRecipeIngredient({ id: "1", recipeId: "recipe-1", name: "salt", quantity: undefined, unit: undefined, category: "spices" }),
      ];
      const mockItems = [{ name: "salt", displayName: "salt", category: "spices", sourceRecipes: ["Pasta"] }];
      mockInvoke.mockResolvedValue({ data: { items: mockItems, perRecipeItems: {} }, error: null });

      await smartCombineIngredients(nullIngredients, recipeNameMap);

      expect(mockInvoke).toHaveBeenCalledWith("combine-ingredients", {
        body: {
          rawIngredients: [
            { name: "salt", quantity: null, unit: null, category: "spices", recipeName: "Pasta" },
          ],
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

    it("handles case insensitivity and whitespace", () => {
      expect(detectCategory("Olive Oil")).toBe("pantry");
      expect(detectCategory("  egg  ")).toBe("pantry");
      expect(detectCategory("TOFU")).toBe("meat_seafood");
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
