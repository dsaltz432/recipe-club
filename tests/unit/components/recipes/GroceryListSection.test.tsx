import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@tests/utils";
import GroceryListSection from "@/components/recipes/GroceryListSection";
import type { Recipe, RecipeIngredient, RecipeContent, SmartGroceryItem } from "@/types";
import { createMockRecipe, createMockRecipeIngredient, createMockRecipeContent } from "@tests/utils";

// Mock supabase client (required by GroceryExportMenu)
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}));

// Mock devMode
vi.mock("@/lib/devMode", () => ({
  isDevMode: () => false,
}));

// Mock sonner
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// Mock constants to enable parse buttons in tests
vi.mock("@/lib/constants", async () => {
  const actual = await vi.importActual("@/lib/constants");
  return { ...actual, SHOW_PARSE_BUTTONS: true };
});

describe("GroceryListSection", () => {
  const mockParseRecipe = vi.fn().mockResolvedValue(undefined);

  const recipes: Recipe[] = [
    createMockRecipe({ id: "recipe-1", name: "Tomato Soup", url: "https://example.com/soup" }),
    createMockRecipe({ id: "recipe-2", name: "Caesar Salad", url: "https://example.com/salad" }),
    createMockRecipe({ id: "recipe-3", name: "Bread", url: undefined }),
  ];

  const ingredients: RecipeIngredient[] = [
    createMockRecipeIngredient({ id: "i1", recipeId: "recipe-1", name: "tomato", quantity: 4, category: "produce" }),
    createMockRecipeIngredient({ id: "i2", recipeId: "recipe-1", name: "onion", quantity: 1, category: "produce" }),
    createMockRecipeIngredient({ id: "i3", recipeId: "recipe-2", name: "lettuce", quantity: 1, unit: "head", category: "produce" }),
    createMockRecipeIngredient({ id: "i4", recipeId: "recipe-2", name: "chicken", quantity: 2, unit: "lb", category: "meat_seafood" }),
  ];

  const contentMap: Record<string, RecipeContent> = {
    "recipe-1": createMockRecipeContent({ recipeId: "recipe-1", status: "completed" }),
    "recipe-2": createMockRecipeContent({ recipeId: "recipe-2", status: "completed" }),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders grocery list heading", () => {
    render(
      <GroceryListSection
        recipes={recipes}
        recipeIngredients={ingredients}
        recipeContentMap={contentMap}
        onParseRecipe={mockParseRecipe}
        eventName="Test Event"

      />
    );

    expect(screen.getByText("Grocery List")).toBeInTheDocument();
  });

  it("shows loading spinner when isLoading is true", () => {
    render(
      <GroceryListSection
        recipes={recipes}
        recipeIngredients={[]}
        recipeContentMap={{}}
        onParseRecipe={mockParseRecipe}
        eventName="Test Event"

        isLoading={true}
      />
    );

    // Spinner is present (Loader2 icon)
    expect(screen.queryByText("No ingredients parsed yet.")).not.toBeInTheDocument();
  });

  it("shows empty state when no ingredients parsed", () => {
    render(
      <GroceryListSection
        recipes={recipes}
        recipeIngredients={[]}
        recipeContentMap={{}}
        onParseRecipe={mockParseRecipe}
        eventName="Test Event"

      />
    );

    expect(screen.getByText(/No ingredients parsed yet/)).toBeInTheDocument();
  });

  it("shows parse buttons for recipes with URLs that are not parsed", () => {
    render(
      <GroceryListSection
        recipes={recipes}
        recipeIngredients={[]}
        recipeContentMap={{}}
        onParseRecipe={mockParseRecipe}
        eventName="Test Event"

      />
    );

    expect(screen.getByText('Parse "Tomato Soup"')).toBeInTheDocument();
    expect(screen.getByText('Parse "Caesar Salad"')).toBeInTheDocument();
    // Recipe without URL should not show parse button
    expect(screen.queryByText('Parse "Bread"')).not.toBeInTheDocument();
  });

  it("shows re-parse button for completed recipes", () => {
    render(
      <GroceryListSection
        recipes={recipes}
        recipeIngredients={ingredients}
        recipeContentMap={contentMap}
        onParseRecipe={mockParseRecipe}
        eventName="Test Event"

      />
    );

    // Completed recipes show name as re-parse button (not "Parse" button)
    expect(screen.queryByText('Parse "Tomato Soup"')).not.toBeInTheDocument();
    // Re-parse buttons have title="Re-parse recipe"
    const reparseButtons = screen.getAllByTitle("Re-parse recipe");
    expect(reparseButtons.length).toBe(2);
  });

  it("calls onParseRecipe when re-parse button is clicked", async () => {
    render(
      <GroceryListSection
        recipes={recipes}
        recipeIngredients={ingredients}
        recipeContentMap={contentMap}
        onParseRecipe={mockParseRecipe}
        eventName="Test Event"

      />
    );

    const reparseButtons = screen.getAllByTitle("Re-parse recipe");
    fireEvent.click(reparseButtons[0]);

    await waitFor(() => {
      expect(mockParseRecipe).toHaveBeenCalledWith("recipe-1");
    });
  });

  it("shows failed indicator for failed parses", () => {
    const failedContentMap: Record<string, RecipeContent> = {
      "recipe-1": createMockRecipeContent({ recipeId: "recipe-1", status: "failed" }),
    };

    render(
      <GroceryListSection
        recipes={recipes}
        recipeIngredients={[]}
        recipeContentMap={failedContentMap}
        onParseRecipe={mockParseRecipe}
        eventName="Test Event"

      />
    );

    expect(screen.getByText("Failed")).toBeInTheDocument();
  });

  it("calls onParseRecipe when parse button is clicked", async () => {
    render(
      <GroceryListSection
        recipes={recipes}
        recipeIngredients={[]}
        recipeContentMap={{}}
        onParseRecipe={mockParseRecipe}
        eventName="Test Event"

      />
    );

    fireEvent.click(screen.getByText('Parse "Tomato Soup"'));

    await waitFor(() => {
      expect(mockParseRecipe).toHaveBeenCalledWith("recipe-1");
    });
  });

  it("shows parsing state while recipe is being parsed", async () => {
    // Make onParseRecipe hang
    let resolvePromise: () => void;
    const parsePromise = new Promise<void>((resolve) => {
      resolvePromise = resolve;
    });
    const slowParseRecipe = vi.fn().mockReturnValue(parsePromise);

    render(
      <GroceryListSection
        recipes={recipes}
        recipeIngredients={[]}
        recipeContentMap={{}}
        onParseRecipe={slowParseRecipe}
        eventName="Test Event"

      />
    );

    fireEvent.click(screen.getByText('Parse "Tomato Soup"'));

    await waitFor(() => {
      expect(screen.getByText("Parsing...")).toBeInTheDocument();
    });

    // Resolve the promise to clean up
    resolvePromise!();
  });

  it("shows parsing state for recipe with parsing status in content map", () => {
    const parsingContentMap: Record<string, RecipeContent> = {
      "recipe-1": createMockRecipeContent({ recipeId: "recipe-1", status: "parsing" }),
    };

    render(
      <GroceryListSection
        recipes={recipes}
        recipeIngredients={[]}
        recipeContentMap={parsingContentMap}
        onParseRecipe={mockParseRecipe}
        eventName="Test Event"

      />
    );

    // Should show as disabled/parsing
    expect(screen.getByText("Parsing...")).toBeInTheDocument();
  });

  it("renders combined view with grouped ingredients", () => {
    render(
      <GroceryListSection
        recipes={recipes}
        recipeIngredients={ingredients}
        recipeContentMap={contentMap}
        onParseRecipe={mockParseRecipe}
        eventName="Test Event"

      />
    );

    // Should show category groups
    expect(screen.getByText("Produce")).toBeInTheDocument();
    expect(screen.getByText("Protein")).toBeInTheDocument();
  });

  it("renders per-recipe tabs with recipe names", () => {
    render(
      <GroceryListSection
        recipes={recipes}
        recipeIngredients={ingredients}
        recipeContentMap={contentMap}
        onParseRecipe={mockParseRecipe}
        eventName="Test Event"

      />
    );

    // Per-recipe tabs should show recipe names as tab triggers
    expect(screen.getByRole("tab", { name: "Combined" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Tomato Soup" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Caesar Salad" })).toBeInTheDocument();
  });

  it("shows recipe-specific ingredients when per-recipe tab is clicked", async () => {
    render(
      <GroceryListSection
        recipes={recipes}
        recipeIngredients={ingredients}
        recipeContentMap={contentMap}
        onParseRecipe={mockParseRecipe}
        eventName="Test Event"

      />
    );

    fireEvent.click(screen.getByRole("tab", { name: "Tomato Soup" }));

    await waitFor(() => {
      expect(screen.getByText("Produce")).toBeInTheDocument();
    });
  });

  it("shows export buttons when ingredients exist", () => {
    render(
      <GroceryListSection
        recipes={recipes}
        recipeIngredients={ingredients}
        recipeContentMap={contentMap}
        onParseRecipe={mockParseRecipe}
        eventName="Test Event"

      />
    );

    expect(screen.getByText("CSV")).toBeInTheDocument();
  });

  it("hides export buttons when no ingredients", () => {
    render(
      <GroceryListSection
        recipes={recipes}
        recipeIngredients={[]}
        recipeContentMap={{}}
        onParseRecipe={mockParseRecipe}
        eventName="Test Event"

      />
    );

    expect(screen.queryByText("CSV")).not.toBeInTheDocument();
  });

  it("handles ingredients without quantity/unit in per-recipe tab", async () => {
    const ingredientsWithNulls: RecipeIngredient[] = [
      createMockRecipeIngredient({ id: "i1", recipeId: "recipe-1", name: "salt", quantity: undefined, unit: undefined, category: "spices" }),
    ];

    render(
      <GroceryListSection
        recipes={recipes}
        recipeIngredients={ingredientsWithNulls}
        recipeContentMap={contentMap}
        onParseRecipe={mockParseRecipe}
        eventName="Test Event"

      />
    );

    fireEvent.click(screen.getByRole("tab", { name: "Tomato Soup" }));

    await waitFor(() => {
      expect(screen.getByText("Spices")).toBeInTheDocument();
    });
  });

  it("filters pantry items and shows excluded count", () => {
    const ingredientsWithSalt: RecipeIngredient[] = [
      createMockRecipeIngredient({ id: "i1", recipeId: "recipe-1", name: "tomato", quantity: 4, category: "produce" }),
      createMockRecipeIngredient({ id: "i2", recipeId: "recipe-1", name: "salt", quantity: undefined, unit: undefined, category: "spices" }),
      createMockRecipeIngredient({ id: "i3", recipeId: "recipe-1", name: "pepper", quantity: undefined, unit: undefined, category: "spices" }),
    ];

    render(
      <GroceryListSection
        recipes={recipes}
        recipeIngredients={ingredientsWithSalt}
        recipeContentMap={contentMap}
        onParseRecipe={mockParseRecipe}
        eventName="Test Event"

        pantryItems={["salt", "pepper"]}
      />
    );

    expect(screen.getByText("2 pantry items excluded")).toBeInTheDocument();
  });

  it("shows singular 'item' when one pantry item excluded", () => {
    const ingredientsWithSalt: RecipeIngredient[] = [
      createMockRecipeIngredient({ id: "i1", recipeId: "recipe-1", name: "tomato", quantity: 4, category: "produce" }),
      createMockRecipeIngredient({ id: "i2", recipeId: "recipe-1", name: "salt", quantity: undefined, unit: undefined, category: "spices" }),
    ];

    render(
      <GroceryListSection
        recipes={recipes}
        recipeIngredients={ingredientsWithSalt}
        recipeContentMap={contentMap}
        onParseRecipe={mockParseRecipe}
        eventName="Test Event"

        pantryItems={["salt"]}
      />
    );

    expect(screen.getByText("1 pantry item excluded")).toBeInTheDocument();
  });

  it("does not show excluded message when no pantry items match", () => {
    render(
      <GroceryListSection
        recipes={recipes}
        recipeIngredients={ingredients}
        recipeContentMap={contentMap}
        onParseRecipe={mockParseRecipe}
        eventName="Test Event"

        pantryItems={["sugar"]}
      />
    );

    expect(screen.queryByText(/pantry.*excluded/)).not.toBeInTheDocument();
  });

  it("does not show tabs for recipes without ingredients", () => {
    // Only recipe-1 has ingredients
    const partialIngredients: RecipeIngredient[] = [
      createMockRecipeIngredient({ id: "i1", recipeId: "recipe-1", name: "tomato", quantity: 4, category: "produce" }),
    ];

    render(
      <GroceryListSection
        recipes={recipes}
        recipeIngredients={partialIngredients}
        recipeContentMap={contentMap}
        onParseRecipe={mockParseRecipe}
        eventName="Test Event"

      />
    );

    // Should show Tomato Soup tab but not Caesar Salad tab (no ingredients)
    expect(screen.getByRole("tab", { name: "Tomato Soup" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Caesar Salad" })).not.toBeInTheDocument();
  });

  it("shows smart grocery items in combined view when provided", () => {
    const smartItems: SmartGroceryItem[] = [
      { name: "broccoli", totalQuantity: 2, unit: "head", category: "produce", sourceRecipes: ["Stir Fry", "Salad"] },
    ];

    render(
      <GroceryListSection
        recipes={recipes}
        recipeIngredients={ingredients}
        recipeContentMap={contentMap}
        onParseRecipe={mockParseRecipe}
        eventName="Test Event"

        smartGroceryItems={smartItems}
      />
    );

    expect(screen.getByText("2 broccoli heads")).toBeInTheDocument();
  });

  it("filters pantry items from smart grocery items", () => {
    const smartItems: SmartGroceryItem[] = [
      { name: "broccoli", totalQuantity: 2, unit: "head", category: "produce", sourceRecipes: ["Stir Fry"] },
      { name: "salt", category: "spices", sourceRecipes: ["Stir Fry"] },
    ];

    render(
      <GroceryListSection
        recipes={recipes}
        recipeIngredients={ingredients}
        recipeContentMap={contentMap}
        onParseRecipe={mockParseRecipe}
        eventName="Test Event"

        smartGroceryItems={smartItems}
        pantryItems={["salt"]}
      />
    );

    expect(screen.getByText("2 broccoli heads")).toBeInTheDocument();
    expect(screen.queryByText(/salt/)).not.toBeInTheDocument();
  });

  it("shows combining spinner when isCombining is true", () => {
    render(
      <GroceryListSection
        recipes={recipes}
        recipeIngredients={ingredients}
        recipeContentMap={contentMap}
        onParseRecipe={mockParseRecipe}
        eventName="Test Event"

        isCombining={true}
      />
    );

    expect(screen.getByText("Combining ingredients...")).toBeInTheDocument();
  });

  it("falls back to naive combine when smartGroceryItems is null", () => {
    render(
      <GroceryListSection
        recipes={recipes}
        recipeIngredients={ingredients}
        recipeContentMap={contentMap}
        onParseRecipe={mockParseRecipe}
        eventName="Test Event"

        smartGroceryItems={null}
      />
    );

    // Should show regular combined view
    expect(screen.getByText("Produce")).toBeInTheDocument();
  });
});
