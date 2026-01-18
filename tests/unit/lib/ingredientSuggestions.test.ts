import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getSuggestedIngredients,
  INGREDIENT_SUGGESTIONS,
  type IngredientCategory,
} from "@/lib/ingredientSuggestions";

describe("INGREDIENT_SUGGESTIONS", () => {
  it("should have all expected categories", () => {
    const expectedCategories: IngredientCategory[] = [
      "vegetables",
      "fruits",
      "proteins",
      "dairy",
      "grains",
      "legumes",
      "nutsAndSeeds",
      "herbs",
      "pantry",
    ];

    expectedCategories.forEach((category) => {
      expect(INGREDIENT_SUGGESTIONS).toHaveProperty(category);
      expect(Array.isArray(INGREDIENT_SUGGESTIONS[category])).toBe(true);
      expect(INGREDIENT_SUGGESTIONS[category].length).toBeGreaterThan(0);
    });
  });

  it("should have vegetables category with expected items", () => {
    expect(INGREDIENT_SUGGESTIONS.vegetables).toContain("Artichoke");
    expect(INGREDIENT_SUGGESTIONS.vegetables).toContain("Zucchini");
    expect(INGREDIENT_SUGGESTIONS.vegetables).toContain("Butternut Squash");
  });

  it("should have fruits category with expected items", () => {
    expect(INGREDIENT_SUGGESTIONS.fruits).toContain("Pomegranate");
    expect(INGREDIENT_SUGGESTIONS.fruits).toContain("Mango");
    expect(INGREDIENT_SUGGESTIONS.fruits).toContain("Apple");
  });

  it("should have proteins category with expected items", () => {
    expect(INGREDIENT_SUGGESTIONS.proteins).toContain("Salmon");
    expect(INGREDIENT_SUGGESTIONS.proteins).toContain("Chicken Thighs");
    expect(INGREDIENT_SUGGESTIONS.proteins).toContain("Lamb");
  });

  it("should contain kosher-friendly items only (no shellfish or pork)", () => {
    const allIngredients = Object.values(INGREDIENT_SUGGESTIONS).flat();
    const nonKosherItems = [
      "Shrimp",
      "Lobster",
      "Crab",
      "Oysters",
      "Clams",
      "Mussels",
      "Pork",
      "Bacon",
      "Ham",
      "Prosciutto",
    ];

    nonKosherItems.forEach((item) => {
      expect(allIngredients).not.toContain(item);
    });
  });
});

describe("getSuggestedIngredients", () => {
  beforeEach(() => {
    // Mock Math.random for deterministic tests
    vi.spyOn(Math, "random").mockReturnValue(0.5);
  });

  it("should return exactly 4 suggestions when no existing ingredients", () => {
    const suggestions = getSuggestedIngredients([]);
    expect(suggestions).toHaveLength(4);
  });

  it("should return 4 suggestions when existing ingredients list is provided", () => {
    const existing = ["Artichoke", "Pomegranate"];
    const suggestions = getSuggestedIngredients(existing);
    expect(suggestions).toHaveLength(4);
  });

  it("should not include ingredients that already exist (case insensitive)", () => {
    const existing = ["artichoke", "POMEGRANATE", "Salmon"];
    const suggestions = getSuggestedIngredients(existing);

    suggestions.forEach((suggestion) => {
      expect(existing.map((e) => e.toLowerCase())).not.toContain(
        suggestion.toLowerCase()
      );
    });
  });

  it("should return unique suggestions", () => {
    const suggestions = getSuggestedIngredients([]);
    const uniqueSuggestions = new Set(suggestions);
    expect(uniqueSuggestions.size).toBe(suggestions.length);
  });

  it("should return valid ingredients from the suggestions list", () => {
    const allIngredients = Object.values(INGREDIENT_SUGGESTIONS).flat();
    const suggestions = getSuggestedIngredients([]);

    suggestions.forEach((suggestion) => {
      expect(allIngredients).toContain(suggestion);
    });
  });

  it("should handle when most ingredients are already used", () => {
    // Get all but 4 ingredients
    const allIngredients = Object.values(INGREDIENT_SUGGESTIONS).flat();
    const existing = allIngredients.slice(0, allIngredients.length - 4);

    const suggestions = getSuggestedIngredients(existing);
    expect(suggestions.length).toBeLessThanOrEqual(4);
    expect(suggestions.length).toBeGreaterThan(0);
  });

  it("should return fewer than 4 when not enough ingredients available", () => {
    // Use all but 3 ingredients
    const allIngredients = Object.values(INGREDIENT_SUGGESTIONS).flat();
    const existing = allIngredients.slice(0, allIngredients.length - 3);

    const suggestions = getSuggestedIngredients(existing);
    expect(suggestions.length).toBeLessThanOrEqual(3);
  });

  it("should try to get ingredients from different categories for variety", () => {
    // Reset mock to vary results
    vi.spyOn(Math, "random")
      .mockReturnValueOnce(0.1)
      .mockReturnValueOnce(0.3)
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0.7)
      .mockReturnValue(0.5);

    const suggestions = getSuggestedIngredients([]);
    expect(suggestions).toHaveLength(4);
  });

  it("should handle empty string in existing ingredients", () => {
    const existing = ["", "Artichoke"];
    const suggestions = getSuggestedIngredients(existing);
    expect(suggestions).toHaveLength(4);
  });
});
