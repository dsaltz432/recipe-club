import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@tests/utils";
import userEvent from "@testing-library/user-event";
import GroceryListSection from "@/components/recipes/GroceryListSection";
import type { Recipe, RecipeIngredient, RecipeContent, SmartGroceryItem, GeneralGroceryItem } from "@/types";
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

  it("renders combined view with grouped smart ingredients", () => {
    const smartItems: SmartGroceryItem[] = [
      { name: "tomato", displayName: "tomatoes", totalQuantity: 4, category: "produce", sourceRecipes: ["Tomato Soup"] },
      { name: "chicken", displayName: "chicken", totalQuantity: 2, unit: "lb", category: "meat_seafood", sourceRecipes: ["Caesar Salad"] },
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

    // Should show category groups from smart items
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
    const user = userEvent.setup();
    const perRecipeItems: Record<string, SmartGroceryItem[]> = {
      "Tomato Soup": [
        { name: "tomato", displayName: "tomatoes", totalQuantity: 4, category: "produce", sourceRecipes: ["Tomato Soup"] },
        { name: "onion", displayName: "onion", totalQuantity: 1, category: "produce", sourceRecipes: ["Tomato Soup"] },
      ],
    };

    render(
      <GroceryListSection
        recipes={recipes}
        recipeIngredients={ingredients}
        recipeContentMap={contentMap}
        onParseRecipe={mockParseRecipe}
        eventName="Test Event"
        perRecipeItems={perRecipeItems}
      />
    );

    await user.click(screen.getByRole("tab", { name: "Tomato Soup" }));

    expect(screen.getByText("Produce")).toBeInTheDocument();
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

  it("handles items without quantity/unit in per-recipe tab", async () => {
    const user = userEvent.setup();
    const ingredientsWithNulls: RecipeIngredient[] = [
      createMockRecipeIngredient({ id: "i1", recipeId: "recipe-1", name: "salt", quantity: undefined, unit: undefined, category: "spices" }),
    ];

    const perRecipeItems: Record<string, SmartGroceryItem[]> = {
      "Tomato Soup": [
        { name: "salt", displayName: "salt", category: "spices", sourceRecipes: ["Tomato Soup"] },
      ],
    };

    render(
      <GroceryListSection
        recipes={recipes}
        recipeIngredients={ingredientsWithNulls}
        recipeContentMap={contentMap}
        onParseRecipe={mockParseRecipe}
        eventName="Test Event"
        perRecipeItems={perRecipeItems}
      />
    );

    await user.click(screen.getByRole("tab", { name: "Tomato Soup" }));

    expect(screen.getByText("Spices")).toBeInTheDocument();
  });

  it("does not show excluded message (pantry excluded UI removed)", () => {
    const smartItems: SmartGroceryItem[] = [
      { name: "tomato", displayName: "tomatoes", totalQuantity: 4, category: "produce", sourceRecipes: ["Tomato Soup"] },
      { name: "salt", displayName: "salt", category: "spices", sourceRecipes: ["Tomato Soup"] },
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

    // No excluded items message — pantry items are simply filtered out
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
      { name: "broccoli", displayName: "broccoli", totalQuantity: 2, unit: "head", category: "produce", sourceRecipes: ["Stir Fry", "Salad"] },
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
      { name: "broccoli", displayName: "broccoli", totalQuantity: 2, unit: "head", category: "produce", sourceRecipes: ["Stir Fry"] },
      { name: "salt", displayName: "salt", category: "spices", sourceRecipes: ["Stir Fry"] },
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

  it("filters pantry items from per-recipe tabs", async () => {
    const user = userEvent.setup();
    const ingredientsWithPantry: RecipeIngredient[] = [
      createMockRecipeIngredient({ id: "i1", recipeId: "recipe-1", name: "tomato", quantity: 4, category: "produce" }),
      createMockRecipeIngredient({ id: "i2", recipeId: "recipe-1", name: "salt", quantity: undefined, unit: undefined, category: "spices" }),
      createMockRecipeIngredient({ id: "i3", recipeId: "recipe-1", name: "olive oil", quantity: 2, unit: "tbsp", category: "pantry" }),
    ];

    const perRecipeItems: Record<string, SmartGroceryItem[]> = {
      "Tomato Soup": [
        { name: "tomato", displayName: "tomatoes", totalQuantity: 4, category: "produce", sourceRecipes: ["Tomato Soup"] },
        { name: "salt", displayName: "salt", category: "spices", sourceRecipes: ["Tomato Soup"] },
        { name: "olive oil", displayName: "olive oil", totalQuantity: 2, unit: "tbsp", category: "pantry", sourceRecipes: ["Tomato Soup"] },
      ],
    };

    render(
      <GroceryListSection
        recipes={recipes}
        recipeIngredients={ingredientsWithPantry}
        recipeContentMap={contentMap}
        onParseRecipe={mockParseRecipe}
        eventName="Test Event"
        pantryItems={["salt", "olive oil"]}
        perRecipeItems={perRecipeItems}
      />
    );

    await user.click(screen.getByRole("tab", { name: "Tomato Soup" }));

    // Tomato should still be visible
    expect(screen.getByText("Produce")).toBeInTheDocument();

    // Salt and olive oil (pantry items) should not appear in per-recipe tab
    expect(screen.queryByText("Spices")).not.toBeInTheDocument();
    expect(screen.queryByText("Pantry")).not.toBeInTheDocument();
  });

  it("shows all per-recipe items when no pantry items provided", async () => {
    const user = userEvent.setup();
    const ingredientsWithSpices: RecipeIngredient[] = [
      createMockRecipeIngredient({ id: "i1", recipeId: "recipe-1", name: "tomato", quantity: 4, category: "produce" }),
      createMockRecipeIngredient({ id: "i2", recipeId: "recipe-1", name: "salt", quantity: undefined, unit: undefined, category: "spices" }),
    ];

    const perRecipeItems: Record<string, SmartGroceryItem[]> = {
      "Tomato Soup": [
        { name: "tomato", displayName: "tomatoes", totalQuantity: 4, category: "produce", sourceRecipes: ["Tomato Soup"] },
        { name: "salt", displayName: "salt", category: "spices", sourceRecipes: ["Tomato Soup"] },
      ],
    };

    render(
      <GroceryListSection
        recipes={recipes}
        recipeIngredients={ingredientsWithSpices}
        recipeContentMap={contentMap}
        onParseRecipe={mockParseRecipe}
        eventName="Test Event"
        perRecipeItems={perRecipeItems}
      />
    );

    await user.click(screen.getByRole("tab", { name: "Tomato Soup" }));

    expect(screen.getByText("Produce")).toBeInTheDocument();
    expect(screen.getByText("Spices")).toBeInTheDocument();
  });

  it("shows error message when combineError is set", () => {
    render(
      <GroceryListSection
        recipes={recipes}
        recipeIngredients={ingredients}
        recipeContentMap={contentMap}
        onParseRecipe={mockParseRecipe}
        eventName="Test Event"
        combineError="AI service unavailable"
      />
    );

    expect(screen.getByText("AI service unavailable")).toBeInTheDocument();
  });

  it("renders empty per-recipe tab when perRecipeItems not provided for recipe", async () => {
    const user = userEvent.setup();

    render(
      <GroceryListSection
        recipes={recipes}
        recipeIngredients={ingredients}
        recipeContentMap={contentMap}
        onParseRecipe={mockParseRecipe}
        eventName="Test Event"
        perRecipeItems={{}}
      />
    );

    await user.click(screen.getByRole("tab", { name: "Tomato Soup" }));

    // No category groups rendered for this recipe
    expect(screen.queryByText("Produce")).not.toBeInTheDocument();
  });

  // ---- Editable mode tests ----

  it("shows Add item button when editable is true and has ingredients", () => {
    render(
      <GroceryListSection
        recipes={recipes}
        recipeIngredients={ingredients}
        recipeContentMap={contentMap}
        onParseRecipe={mockParseRecipe}
        eventName="Test Event"
        editable
      />
    );

    expect(screen.getByText("Add item")).toBeInTheDocument();
  });

  it("does not show Add item button when editable is false", () => {
    render(
      <GroceryListSection
        recipes={recipes}
        recipeIngredients={ingredients}
        recipeContentMap={contentMap}
        onParseRecipe={mockParseRecipe}
        eventName="Test Event"
      />
    );

    expect(screen.queryByText("Add item")).not.toBeInTheDocument();
  });

  it("does not show Add item button when loading", () => {
    render(
      <GroceryListSection
        recipes={recipes}
        recipeIngredients={ingredients}
        recipeContentMap={contentMap}
        onParseRecipe={mockParseRecipe}
        eventName="Test Event"
        editable
        isLoading
      />
    );

    expect(screen.queryByText("Add item")).not.toBeInTheDocument();
  });

  it("does not show Add item button when no ingredients", () => {
    render(
      <GroceryListSection
        recipes={recipes}
        recipeIngredients={[]}
        recipeContentMap={{}}
        onParseRecipe={mockParseRecipe}
        eventName="Test Event"
        editable
      />
    );

    expect(screen.queryByText("Add item")).not.toBeInTheDocument();
  });

  it("shows add item form when Add item button is clicked", () => {
    render(
      <GroceryListSection
        recipes={recipes}
        recipeIngredients={ingredients}
        recipeContentMap={contentMap}
        onParseRecipe={mockParseRecipe}
        eventName="Test Event"
        editable
      />
    );

    fireEvent.click(screen.getByText("Add item"));

    expect(screen.getByLabelText("New item name")).toBeInTheDocument();
    expect(screen.getByLabelText("New item quantity")).toBeInTheDocument();
    expect(screen.getByLabelText("New item unit")).toBeInTheDocument();
    expect(screen.getByText("Add")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  it("calls onAddItem with item data when Add button is clicked", () => {
    const onAddItem = vi.fn();

    render(
      <GroceryListSection
        recipes={recipes}
        recipeIngredients={ingredients}
        recipeContentMap={contentMap}
        onParseRecipe={mockParseRecipe}
        eventName="Test Event"
        editable
        onAddItem={onAddItem}
      />
    );

    fireEvent.click(screen.getByText("Add item"));

    fireEvent.change(screen.getByLabelText("New item name"), { target: { value: "paper towels" } });
    fireEvent.change(screen.getByLabelText("New item quantity"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("New item unit"), { target: { value: "roll" } });

    fireEvent.click(screen.getByText("Add"));

    expect(onAddItem).toHaveBeenCalledWith({
      name: "paper towels",
      totalQuantity: 2,
      unit: "roll",
    });
  });

  it("calls onAddItem on Enter key in add form", () => {
    const onAddItem = vi.fn();

    render(
      <GroceryListSection
        recipes={recipes}
        recipeIngredients={ingredients}
        recipeContentMap={contentMap}
        onParseRecipe={mockParseRecipe}
        eventName="Test Event"
        editable
        onAddItem={onAddItem}
      />
    );

    fireEvent.click(screen.getByText("Add item"));
    fireEvent.change(screen.getByLabelText("New item name"), { target: { value: "napkins" } });
    fireEvent.keyDown(screen.getByLabelText("New item name"), { key: "Enter" });

    expect(onAddItem).toHaveBeenCalledWith({
      name: "napkins",
      totalQuantity: undefined,
      unit: undefined,
    });
  });

  it("hides add form on Cancel button click", () => {
    render(
      <GroceryListSection
        recipes={recipes}
        recipeIngredients={ingredients}
        recipeContentMap={contentMap}
        onParseRecipe={mockParseRecipe}
        eventName="Test Event"
        editable
      />
    );

    fireEvent.click(screen.getByText("Add item"));
    expect(screen.getByLabelText("New item name")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Cancel"));
    expect(screen.queryByLabelText("New item name")).not.toBeInTheDocument();
    expect(screen.getByText("Add item")).toBeInTheDocument();
  });

  it("hides add form on Escape key", () => {
    render(
      <GroceryListSection
        recipes={recipes}
        recipeIngredients={ingredients}
        recipeContentMap={contentMap}
        onParseRecipe={mockParseRecipe}
        eventName="Test Event"
        editable
      />
    );

    fireEvent.click(screen.getByText("Add item"));
    fireEvent.keyDown(screen.getByLabelText("New item name"), { key: "Escape" });

    expect(screen.queryByLabelText("New item name")).not.toBeInTheDocument();
  });

  it("does not call onAddItem when name is empty", () => {
    const onAddItem = vi.fn();

    render(
      <GroceryListSection
        recipes={recipes}
        recipeIngredients={ingredients}
        recipeContentMap={contentMap}
        onParseRecipe={mockParseRecipe}
        eventName="Test Event"
        editable
        onAddItem={onAddItem}
      />
    );

    fireEvent.click(screen.getByText("Add item"));
    fireEvent.click(screen.getByText("Add"));

    expect(onAddItem).not.toHaveBeenCalled();
  });

  it("resets form fields after successful add", () => {
    const onAddItem = vi.fn();

    render(
      <GroceryListSection
        recipes={recipes}
        recipeIngredients={ingredients}
        recipeContentMap={contentMap}
        onParseRecipe={mockParseRecipe}
        eventName="Test Event"
        editable
        onAddItem={onAddItem}
      />
    );

    fireEvent.click(screen.getByText("Add item"));
    fireEvent.change(screen.getByLabelText("New item name"), { target: { value: "napkins" } });
    fireEvent.change(screen.getByLabelText("New item quantity"), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText("New item unit"), { target: { value: "pack" } });
    fireEvent.click(screen.getByText("Add"));

    // Form should disappear, showing the Add item button again
    expect(screen.queryByLabelText("New item name")).not.toBeInTheDocument();
    expect(screen.getByText("Add item")).toBeInTheDocument();
  });

  it("passes editable props to GroceryCategoryGroup for per-recipe tab items", async () => {
    const user = userEvent.setup();
    const onEditItem = vi.fn();
    const onRemoveItem = vi.fn();
    const perRecipeItems: Record<string, SmartGroceryItem[]> = {
      "Tomato Soup": [
        { name: "broccoli", displayName: "broccoli", totalQuantity: 2, unit: "head", category: "produce", sourceRecipes: ["Tomato Soup"] },
      ],
    };

    render(
      <GroceryListSection
        recipes={recipes}
        recipeIngredients={ingredients}
        recipeContentMap={contentMap}
        onParseRecipe={mockParseRecipe}
        eventName="Test Event"
        editable
        onEditItem={onEditItem}
        onRemoveItem={onRemoveItem}
        perRecipeItems={perRecipeItems}
      />
    );

    // Navigate to per-recipe tab (edit/remove buttons are on per-recipe tabs, not Combined)
    await user.click(screen.getByRole("tab", { name: "Tomato Soup" }));

    // Verify edit buttons are visible (these come from GroceryItemRow via GroceryCategoryGroup)
    expect(screen.getAllByLabelText("Edit item").length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText("Remove item").length).toBeGreaterThan(0);
  });

  it("handles non-Enter/Escape key presses in add form without action", () => {
    const onAddItem = vi.fn();

    render(
      <GroceryListSection
        recipes={recipes}
        recipeIngredients={ingredients}
        recipeContentMap={contentMap}
        onParseRecipe={mockParseRecipe}
        eventName="Test Event"
        editable
        onAddItem={onAddItem}
      />
    );

    fireEvent.click(screen.getByText("Add item"));
    fireEvent.keyDown(screen.getByLabelText("New item name"), { key: "Tab" });

    // Should still be in add mode
    expect(screen.getByLabelText("New item name")).toBeInTheDocument();
    expect(onAddItem).not.toHaveBeenCalled();
  });

  // ---- Cross-off / checked items tests ----

  it("renders checkboxes when checkedItems and onToggleChecked are provided", () => {
    const smartItems: SmartGroceryItem[] = [
      { name: "tomato", displayName: "tomatoes", totalQuantity: 4, category: "produce", sourceRecipes: ["Tomato Soup"] },
      { name: "chicken", displayName: "chicken", totalQuantity: 2, unit: "lb", category: "meat_seafood", sourceRecipes: ["Caesar Salad"] },
    ];

    render(
      <GroceryListSection
        recipes={recipes}
        recipeIngredients={ingredients}
        recipeContentMap={contentMap}
        onParseRecipe={mockParseRecipe}
        eventName="Test Event"
        smartGroceryItems={smartItems}
        checkedItems={new Set<string>()}
        onToggleChecked={vi.fn()}
      />
    );

    // Both items should have checkboxes
    expect(screen.getAllByLabelText("Check item").length).toBe(2);
  });

  it("shows checked items with line-through styling", () => {
    const smartItems: SmartGroceryItem[] = [
      { name: "tomato", displayName: "tomatoes", totalQuantity: 4, category: "produce", sourceRecipes: ["Tomato Soup"] },
    ];

    render(
      <GroceryListSection
        recipes={recipes}
        recipeIngredients={ingredients}
        recipeContentMap={contentMap}
        onParseRecipe={mockParseRecipe}
        eventName="Test Event"
        smartGroceryItems={smartItems}
        checkedItems={new Set(["tomato"])}
        onToggleChecked={vi.fn()}
      />
    );

    expect(screen.getByLabelText("Uncheck item")).toBeInTheDocument();
    const textEl = screen.getByText("4 tomatoes");
    expect(textEl.className).toContain("line-through");
  });

  it("calls onToggleChecked when item checkbox is clicked", () => {
    const onToggleChecked = vi.fn();
    const smartItems: SmartGroceryItem[] = [
      { name: "tomato", displayName: "tomatoes", totalQuantity: 4, category: "produce", sourceRecipes: ["Tomato Soup"] },
    ];

    render(
      <GroceryListSection
        recipes={recipes}
        recipeIngredients={ingredients}
        recipeContentMap={contentMap}
        onParseRecipe={mockParseRecipe}
        eventName="Test Event"
        smartGroceryItems={smartItems}
        checkedItems={new Set<string>()}
        onToggleChecked={onToggleChecked}
      />
    );

    fireEvent.click(screen.getByLabelText("Check item"));

    expect(onToggleChecked).toHaveBeenCalledWith("tomato");
  });

  it("does not render checkboxes when onToggleChecked is not provided", () => {
    const smartItems: SmartGroceryItem[] = [
      { name: "tomato", displayName: "tomatoes", totalQuantity: 4, category: "produce", sourceRecipes: ["Tomato Soup"] },
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

    expect(screen.queryByLabelText("Check item")).not.toBeInTheDocument();
  });

  // ---- General tab tests ----

  const generalItems: GeneralGroceryItem[] = [
    { id: "gen-1", userId: "user-1", contextType: "meal_plan", contextId: "2026-03-02", name: "paper towels", quantity: "2", unit: "roll" },
    { id: "gen-2", userId: "user-1", contextType: "meal_plan", contextId: "2026-03-02", name: "dish soap" },
  ];

  it("renders General tab when onBulkParseGroceryText is provided", () => {
    render(
      <GroceryListSection
        recipes={recipes}
        recipeIngredients={ingredients}
        recipeContentMap={contentMap}
        onParseRecipe={mockParseRecipe}
        eventName="Test Event"
        onBulkParseGroceryText={vi.fn().mockResolvedValue([])}
        generalItems={[]}
      />
    );

    expect(screen.getByRole("tab", { name: "General" })).toBeInTheDocument();
  });

  it("does not render General tab when onBulkParseGroceryText is not provided", () => {
    render(
      <GroceryListSection
        recipes={recipes}
        recipeIngredients={ingredients}
        recipeContentMap={contentMap}
        onParseRecipe={mockParseRecipe}
        eventName="Test Event"
      />
    );

    expect(screen.queryByRole("tab", { name: "General" })).not.toBeInTheDocument();
  });

  it("shows empty state on General tab when no items", async () => {
    const user = userEvent.setup();

    render(
      <GroceryListSection
        recipes={recipes}
        recipeIngredients={ingredients}
        recipeContentMap={contentMap}
        onParseRecipe={mockParseRecipe}
        eventName="Test Event"
        onBulkParseGroceryText={vi.fn().mockResolvedValue([])}
        generalItems={[]}
      />
    );

    await user.click(screen.getByRole("tab", { name: "General" }));

    expect(screen.getByText(/No items yet/)).toBeInTheDocument();
  });

  it("shows general items on the General tab", async () => {
    const user = userEvent.setup();

    const generalPerRecipeItems: Record<string, SmartGroceryItem[]> = {
      General: [
        { name: "paper towels", displayName: "paper towels", totalQuantity: 2, unit: "roll", category: "other", sourceRecipes: ["General"] },
        { name: "dish soap", displayName: "dish soap", category: "other", sourceRecipes: ["General"] },
      ],
    };

    render(
      <GroceryListSection
        recipes={recipes}
        recipeIngredients={ingredients}
        recipeContentMap={contentMap}
        onParseRecipe={mockParseRecipe}
        eventName="Test Event"
        onBulkParseGroceryText={vi.fn().mockResolvedValue([])}
        generalItems={generalItems}
        perRecipeItems={generalPerRecipeItems}
      />
    );

    await user.click(screen.getByRole("tab", { name: "General" }));

    expect(screen.getByText(/paper towels/)).toBeInTheDocument();
    expect(screen.getByText(/dish soap/)).toBeInTheDocument();
  });

  it("calls onBulkParseGroceryText and onAddGeneralItemDirect when Add is clicked on General tab", async () => {
    const user = userEvent.setup();
    const onBulkParseGroceryText = vi.fn().mockResolvedValue([
      { name: "toilet paper", quantity: 4, unit: "pack", category: "other" },
    ]);
    const onAddGeneralItemDirect = vi.fn().mockResolvedValue(undefined);

    render(
      <GroceryListSection
        recipes={recipes}
        recipeIngredients={ingredients}
        recipeContentMap={contentMap}
        onParseRecipe={mockParseRecipe}
        eventName="Test Event"
        onBulkParseGroceryText={onBulkParseGroceryText}
        onAddGeneralItemDirect={onAddGeneralItemDirect}
        generalItems={[]}
      />
    );

    await user.click(screen.getByRole("tab", { name: "General" }));

    const textarea = screen.getByRole("textbox");
    await user.type(textarea, "4 packs toilet paper");
    await user.click(screen.getByRole("button", { name: /Add/ }));

    await waitFor(() => {
      expect(onBulkParseGroceryText).toHaveBeenCalledWith("4 packs toilet paper");
      expect(onAddGeneralItemDirect).toHaveBeenCalledWith({
        name: "toilet paper",
        quantity: "4",
        unit: "pack",
      });
    });
  });

  it("shows cross-off checkboxes on General tab items when onToggleChecked is provided", async () => {
    const user = userEvent.setup();

    const generalPerRecipeItems: Record<string, SmartGroceryItem[]> = {
      General: [
        { name: "paper towels", displayName: "paper towels", totalQuantity: 2, unit: "roll", category: "other", sourceRecipes: ["General"] },
        { name: "dish soap", displayName: "dish soap", category: "other", sourceRecipes: ["General"] },
      ],
    };

    render(
      <GroceryListSection
        recipes={recipes}
        recipeIngredients={ingredients}
        recipeContentMap={contentMap}
        onParseRecipe={mockParseRecipe}
        eventName="Test Event"
        onBulkParseGroceryText={vi.fn().mockResolvedValue([])}
        generalItems={generalItems}
        perRecipeItems={generalPerRecipeItems}
        checkedItems={new Set<string>()}
        onToggleChecked={vi.fn()}
      />
    );

    await user.click(screen.getByRole("tab", { name: "General" }));

    expect(screen.getAllByLabelText("Check item").length).toBe(2);
  });

  it("shows General tab with add input even when no recipe ingredients exist", () => {
    render(
      <GroceryListSection
        recipes={[]}
        recipeIngredients={[]}
        recipeContentMap={{}}
        onParseRecipe={mockParseRecipe}
        eventName="Test Event"
        onBulkParseGroceryText={vi.fn().mockResolvedValue([])}
        generalItems={[]}
      />
    );

    // General tab should be the default when no ingredients
    expect(screen.getByRole("tab", { name: "General" })).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("disables Add button on General tab when textarea is empty", async () => {
    const user = userEvent.setup();

    render(
      <GroceryListSection
        recipes={recipes}
        recipeIngredients={ingredients}
        recipeContentMap={contentMap}
        onParseRecipe={mockParseRecipe}
        eventName="Test Event"
        onBulkParseGroceryText={vi.fn().mockResolvedValue([])}
        generalItems={[]}
      />
    );

    await user.click(screen.getByRole("tab", { name: "General" }));

    const addButton = screen.getByRole("button", { name: /Add/ }) as HTMLButtonElement;
    expect(addButton.disabled).toBe(true);
  });

  // ---- General tab AddIngredientInput tests ----

  it("shows AddIngredientInput on General tab when onBulkParseGroceryText is provided", async () => {
    const user = userEvent.setup();

    render(
      <GroceryListSection
        recipes={recipes}
        recipeIngredients={ingredients}
        recipeContentMap={contentMap}
        onParseRecipe={mockParseRecipe}
        eventName="Test Event"
        onBulkParseGroceryText={vi.fn().mockResolvedValue([])}
        generalItems={[]}
      />
    );

    await user.click(screen.getByRole("tab", { name: "General" }));

    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("does not render General tab when only onAddGeneralItemDirect is provided", () => {
    render(
      <GroceryListSection
        recipes={recipes}
        recipeIngredients={ingredients}
        recipeContentMap={contentMap}
        onParseRecipe={mockParseRecipe}
        eventName="Test Event"
        onAddGeneralItemDirect={vi.fn()}
        generalItems={[]}
      />
    );

    expect(screen.queryByRole("tab", { name: "General" })).not.toBeInTheDocument();
  });

  it("shows toast error when bulk add fails", async () => {
    const { toast: mockToast } = await import("sonner");
    const user = userEvent.setup();
    const mockParse = vi.fn().mockRejectedValue(new Error("Parse failed"));

    render(
      <GroceryListSection
        recipes={recipes}
        recipeIngredients={ingredients}
        recipeContentMap={contentMap}
        onParseRecipe={mockParseRecipe}
        eventName="Test Event"
        onBulkParseGroceryText={mockParse}
        onAddGeneralItemDirect={vi.fn().mockResolvedValue(undefined)}
        generalItems={[]}
      />
    );

    await user.click(screen.getByRole("tab", { name: "General" }));

    const textarea = screen.getByRole("textbox");
    await user.type(textarea, "stuff");
    await user.click(screen.getByRole("button", { name: /Add/ }));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Failed to add items. Please try again.");
    });
  });

  it("parses and adds all items in one step when Add is clicked on General tab", async () => {
    const user = userEvent.setup();
    const onAddGeneralItemDirect = vi.fn().mockResolvedValue(undefined);
    const mockParse = vi.fn().mockResolvedValue([
      { name: "milk", quantity: 1, unit: "gallon", category: "dairy" },
      { name: "bread", quantity: null, unit: null, category: "bakery" },
    ]);

    render(
      <GroceryListSection
        recipes={recipes}
        recipeIngredients={ingredients}
        recipeContentMap={contentMap}
        onParseRecipe={mockParseRecipe}
        eventName="Test Event"
        onBulkParseGroceryText={mockParse}
        onAddGeneralItemDirect={onAddGeneralItemDirect}
        generalItems={[]}
      />
    );

    await user.click(screen.getByRole("tab", { name: "General" }));
    const textarea = screen.getByRole("textbox");
    await user.type(textarea, "milk, bread");
    await user.click(screen.getByRole("button", { name: /Add/ }));

    await waitFor(() => {
      expect(onAddGeneralItemDirect).toHaveBeenCalledTimes(2);
      expect(onAddGeneralItemDirect).toHaveBeenCalledWith({
        name: "milk",
        quantity: "1",
        unit: "gallon",
      });
      expect(onAddGeneralItemDirect).toHaveBeenCalledWith({
        name: "bread",
        quantity: undefined,
        unit: undefined,
      });
    });
  });

  it("skips duplicate items when bulk adding", async () => {
    const user = userEvent.setup();
    const onAddGeneralItemDirect = vi.fn().mockResolvedValue(undefined);
    const mockParse = vi.fn().mockResolvedValue([
      { name: "paper towels", quantity: null, unit: null, category: "other" },
      { name: "bread", quantity: null, unit: null, category: "bakery" },
    ]);

    render(
      <GroceryListSection
        recipes={recipes}
        recipeIngredients={ingredients}
        recipeContentMap={contentMap}
        onParseRecipe={mockParseRecipe}
        eventName="Test Event"
        onBulkParseGroceryText={mockParse}
        onAddGeneralItemDirect={onAddGeneralItemDirect}
        generalItems={generalItems}
      />
    );

    await user.click(screen.getByRole("tab", { name: "General" }));
    const textarea = screen.getByRole("textbox");
    await user.type(textarea, "paper towels, bread");
    await user.click(screen.getByRole("button", { name: /Add/ }));

    await waitFor(() => {
      // Only bread should be added (paper towels is duplicate)
      expect(onAddGeneralItemDirect).toHaveBeenCalledTimes(1);
      expect(onAddGeneralItemDirect).toHaveBeenCalledWith({
        name: "bread",
        quantity: undefined,
        unit: undefined,
      });
    });
  });

  it("clears textarea after successful add on General tab", async () => {
    const user = userEvent.setup();
    const onAddGeneralItemDirect = vi.fn().mockResolvedValue(undefined);
    const mockParse = vi.fn().mockResolvedValue([
      { name: "milk", quantity: null, unit: null, category: "dairy" },
    ]);

    render(
      <GroceryListSection
        recipes={recipes}
        recipeIngredients={ingredients}
        recipeContentMap={contentMap}
        onParseRecipe={mockParseRecipe}
        eventName="Test Event"
        onBulkParseGroceryText={mockParse}
        onAddGeneralItemDirect={onAddGeneralItemDirect}
        generalItems={[]}
      />
    );

    await user.click(screen.getByRole("tab", { name: "General" }));
    const textarea = screen.getByRole("textbox");
    await user.type(textarea, "milk");
    await user.click(screen.getByRole("button", { name: /Add/ }));

    await waitFor(() => {
      expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("");
    });
  });

  // ---- Reprocess button tests ----

  it("shows Reprocess button when hasPendingChanges is true and not combining", () => {
    const recombineSmartItems: SmartGroceryItem[] = [
      { name: "tomato", displayName: "tomatoes", totalQuantity: 4, category: "produce", sourceRecipes: ["Tomato Soup"] },
    ];

    render(
      <GroceryListSection
        recipes={recipes}
        recipeIngredients={ingredients}
        recipeContentMap={contentMap}
        onParseRecipe={mockParseRecipe}
        eventName="Test Event"
        smartGroceryItems={recombineSmartItems}
        hasPendingChanges
        onRecombine={vi.fn()}
      />
    );

    expect(screen.getByText("Reprocess")).toBeInTheDocument();
  });

  it("does not show Reprocess button when hasPendingChanges is false", () => {
    const recombineSmartItems: SmartGroceryItem[] = [
      { name: "tomato", displayName: "tomatoes", totalQuantity: 4, category: "produce", sourceRecipes: ["Tomato Soup"] },
    ];

    render(
      <GroceryListSection
        recipes={recipes}
        recipeIngredients={ingredients}
        recipeContentMap={contentMap}
        onParseRecipe={mockParseRecipe}
        eventName="Test Event"
        smartGroceryItems={recombineSmartItems}
        hasPendingChanges={false}
        onRecombine={vi.fn()}
      />
    );

    expect(screen.queryByText("Reprocess")).not.toBeInTheDocument();
  });

  it("does not show Reprocess button when isCombining is true", () => {
    const recombineSmartItems: SmartGroceryItem[] = [
      { name: "tomato", displayName: "tomatoes", totalQuantity: 4, category: "produce", sourceRecipes: ["Tomato Soup"] },
    ];

    render(
      <GroceryListSection
        recipes={recipes}
        recipeIngredients={ingredients}
        recipeContentMap={contentMap}
        onParseRecipe={mockParseRecipe}
        eventName="Test Event"
        smartGroceryItems={recombineSmartItems}
        isCombining
        hasPendingChanges
        onRecombine={vi.fn()}
      />
    );

    expect(screen.queryByText("Reprocess")).not.toBeInTheDocument();
  });

  it("calls onRecombine when Reprocess button is clicked", () => {
    const onRecombine = vi.fn();
    const recombineSmartItems: SmartGroceryItem[] = [
      { name: "tomato", displayName: "tomatoes", totalQuantity: 4, category: "produce", sourceRecipes: ["Tomato Soup"] },
    ];

    render(
      <GroceryListSection
        recipes={recipes}
        recipeIngredients={ingredients}
        recipeContentMap={contentMap}
        onParseRecipe={mockParseRecipe}
        eventName="Test Event"
        smartGroceryItems={recombineSmartItems}
        hasPendingChanges
        onRecombine={onRecombine}
      />
    );

    fireEvent.click(screen.getByText("Reprocess"));

    expect(onRecombine).toHaveBeenCalledTimes(1);
  });

  it("passes onEditItemText to category groups on per-recipe tab", async () => {
    const user = userEvent.setup();
    const onEditItemText = vi.fn();
    const editPerRecipeItems: Record<string, SmartGroceryItem[]> = {
      "Tomato Soup": [
        { name: "tomato", displayName: "tomatoes", totalQuantity: 4, category: "produce", sourceRecipes: ["Tomato Soup"] },
      ],
    };

    render(
      <GroceryListSection
        recipes={recipes}
        recipeIngredients={ingredients}
        recipeContentMap={contentMap}
        onParseRecipe={mockParseRecipe}
        eventName="Test Event"
        perRecipeItems={editPerRecipeItems}
        onEditItemText={onEditItemText}
        onRemoveItem={vi.fn()}
      />
    );

    await user.click(screen.getByRole("tab", { name: "Tomato Soup" }));

    // Edit buttons should be visible on items (powered by onEditText)
    const editButtons = screen.getAllByLabelText("Edit item");
    expect(editButtons.length).toBeGreaterThan(0);

    // Click edit on first item, should get single-field mode
    fireEvent.click(editButtons[0]);
    expect(screen.getByLabelText("Edit item text")).toBeInTheDocument();
  });

  it("passes onRemoveItem to category groups and calls handler on delete", async () => {
    const user = userEvent.setup();
    const onRemoveItem = vi.fn();
    const removePerRecipeItems: Record<string, SmartGroceryItem[]> = {
      "Tomato Soup": [
        { name: "tomato", displayName: "tomatoes", totalQuantity: 4, category: "produce", sourceRecipes: ["Tomato Soup"] },
      ],
    };

    render(
      <GroceryListSection
        recipes={recipes}
        recipeIngredients={ingredients}
        recipeContentMap={contentMap}
        onParseRecipe={mockParseRecipe}
        eventName="Test Event"
        perRecipeItems={removePerRecipeItems}
        onRemoveItem={onRemoveItem}
      />
    );

    await user.click(screen.getByRole("tab", { name: "Tomato Soup" }));

    const removeButtons = screen.getAllByLabelText("Remove item");
    expect(removeButtons.length).toBeGreaterThan(0);

    fireEvent.click(removeButtons[0]);
    expect(onRemoveItem).toHaveBeenCalled();
  });

  it("shows AddIngredientInput on per-recipe tab when onAddItemsToRecipe is provided", async () => {
    const user = userEvent.setup();
    const onAddItemsToRecipe = vi.fn().mockResolvedValue(undefined);
    const perRecipeItems: Record<string, SmartGroceryItem[]> = {
      "Tomato Soup": [
        { name: "tomato", displayName: "tomatoes", totalQuantity: 4, category: "produce", sourceRecipes: ["Tomato Soup"] },
      ],
    };

    render(
      <GroceryListSection
        recipes={recipes}
        recipeIngredients={ingredients}
        recipeContentMap={contentMap}
        onParseRecipe={mockParseRecipe}
        eventName="Test Event"
        perRecipeItems={perRecipeItems}
        onAddItemsToRecipe={onAddItemsToRecipe}
      />
    );

    await user.click(screen.getByRole("tab", { name: "Tomato Soup" }));

    expect(screen.getByPlaceholderText(/Add ingredient,/)).toBeInTheDocument();
  });

  it("calls onAddItemsToRecipe with recipeId and text when Add is clicked on per-recipe tab", async () => {
    const user = userEvent.setup();
    const onAddItemsToRecipe = vi.fn().mockResolvedValue(undefined);
    const perRecipeItems: Record<string, SmartGroceryItem[]> = {
      "Tomato Soup": [
        { name: "tomato", displayName: "tomatoes", totalQuantity: 4, category: "produce", sourceRecipes: ["Tomato Soup"] },
      ],
    };

    render(
      <GroceryListSection
        recipes={recipes}
        recipeIngredients={ingredients}
        recipeContentMap={contentMap}
        onParseRecipe={mockParseRecipe}
        eventName="Test Event"
        perRecipeItems={perRecipeItems}
        onAddItemsToRecipe={onAddItemsToRecipe}
      />
    );

    await user.click(screen.getByRole("tab", { name: "Tomato Soup" }));

    const textarea = screen.getByPlaceholderText(/Add ingredient,/);
    await user.type(textarea, "2 cups flour");
    await user.click(screen.getByRole("button", { name: /Add/ }));

    expect(onAddItemsToRecipe).toHaveBeenCalledWith("recipe-1", "2 cups flour");
  });

  it("does not show AddIngredientInput on per-recipe tab when onAddItemsToRecipe is not provided", async () => {
    const user = userEvent.setup();
    const perRecipeItems: Record<string, SmartGroceryItem[]> = {
      "Tomato Soup": [
        { name: "tomato", displayName: "tomatoes", totalQuantity: 4, category: "produce", sourceRecipes: ["Tomato Soup"] },
      ],
    };

    render(
      <GroceryListSection
        recipes={recipes}
        recipeIngredients={ingredients}
        recipeContentMap={contentMap}
        onParseRecipe={mockParseRecipe}
        eventName="Test Event"
        perRecipeItems={perRecipeItems}
      />
    );

    await user.click(screen.getByRole("tab", { name: "Tomato Soup" }));

    expect(screen.queryByPlaceholderText(/Add ingredient,/)).not.toBeInTheDocument();
  });
});
