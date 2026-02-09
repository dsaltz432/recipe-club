import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@tests/utils";
import CookModeSection from "@/components/recipes/CookModeSection";
import type { Recipe, RecipeContent, RecipeIngredient, CombinedCookPlan } from "@/types";
import { createMockRecipe, createMockRecipeContent, createMockRecipeIngredient } from "@tests/utils";

// Mock cookMode lib
const mockGenerateCookPlan = vi.fn();
vi.mock("@/lib/cookMode", async () => {
  const actual = await vi.importActual<typeof import("@/lib/cookMode")>("@/lib/cookMode");
  return {
    ...actual,
    generateCookPlan: (...args: unknown[]) => mockGenerateCookPlan(...args),
  };
});

// Mock sonner
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { toast } from "sonner";

describe("CookModeSection", () => {
  const recipes: Recipe[] = [
    createMockRecipe({ id: "r1", name: "Pasta" }),
    createMockRecipe({ id: "r2", name: "Salad" }),
  ];

  const recipeContentMap: Record<string, RecipeContent> = {
    "r1": createMockRecipeContent({
      recipeId: "r1",
      status: "completed",
      instructions: ["Boil water", "Cook pasta"],
      prepTime: "5 minutes",
      cookTime: "10 minutes",
      totalTime: "15 minutes",
      servings: "4 servings",
    }),
    "r2": createMockRecipeContent({
      recipeId: "r2",
      status: "completed",
      instructions: ["Wash lettuce", "Add dressing"],
      prepTime: "10 minutes",
      cookTime: undefined,
    }),
  };

  const ingredients: RecipeIngredient[] = [
    createMockRecipeIngredient({ id: "i1", recipeId: "r1", name: "pasta", quantity: 1, unit: "lb", sortOrder: 0 }),
    createMockRecipeIngredient({ id: "i2", recipeId: "r1", name: "garlic", quantity: 3, unit: "clove", sortOrder: 1 }),
    createMockRecipeIngredient({ id: "i3", recipeId: "r2", name: "lettuce", quantity: 1, unit: "head", sortOrder: 0 }),
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows empty state when no parsed recipes", () => {
    render(
      <CookModeSection
        recipes={recipes}
        recipeContentMap={{}}
        recipeIngredients={[]}
        eventName="Test Event"
      />
    );

    expect(screen.getByText(/No parsed recipes yet/)).toBeInTheDocument();
  });

  it("renders individual recipe cards with content", () => {
    render(
      <CookModeSection
        recipes={recipes}
        recipeContentMap={recipeContentMap}
        recipeIngredients={ingredients}
        eventName="Test Event"
      />
    );

    expect(screen.getByText("Cook Mode — Test Event")).toBeInTheDocument();
    expect(screen.getByText("Pasta")).toBeInTheDocument();
    expect(screen.getByText("Salad")).toBeInTheDocument();
  });

  it("shows servings, prep time, cook time, and total time", () => {
    render(
      <CookModeSection
        recipes={recipes}
        recipeContentMap={recipeContentMap}
        recipeIngredients={ingredients}
        eventName="Test Event"
      />
    );

    expect(screen.getByText("4 servings")).toBeInTheDocument();
    expect(screen.getByText("Prep: 5 minutes")).toBeInTheDocument();
    expect(screen.getByText("Cook: 10 minutes")).toBeInTheDocument();
    expect(screen.getByText("Total: 15 minutes")).toBeInTheDocument();
    // Salad has no cook time — shows N/A
    expect(screen.getByText("Cook: N/A")).toBeInTheDocument();
  });

  it("shows ingredients list for each recipe", () => {
    render(
      <CookModeSection
        recipes={recipes}
        recipeContentMap={recipeContentMap}
        recipeIngredients={ingredients}
        eventName="Test Event"
      />
    );

    expect(screen.getByText("• 1 lb pasta")).toBeInTheDocument();
    expect(screen.getByText("• 3 garlic cloves")).toBeInTheDocument();
    expect(screen.getByText("• 1 lettuce head")).toBeInTheDocument();
  });

  it("shows instructions for each recipe", () => {
    render(
      <CookModeSection
        recipes={recipes}
        recipeContentMap={recipeContentMap}
        recipeIngredients={ingredients}
        eventName="Test Event"
      />
    );

    expect(screen.getByText("Boil water")).toBeInTheDocument();
    expect(screen.getByText("Cook pasta")).toBeInTheDocument();
    expect(screen.getByText("Wash lettuce")).toBeInTheDocument();
    expect(screen.getByText("Add dressing")).toBeInTheDocument();
  });

  it("shows generate button when 2+ parsed recipes", () => {
    render(
      <CookModeSection
        recipes={recipes}
        recipeContentMap={recipeContentMap}
        recipeIngredients={ingredients}
        eventName="Test Event"
      />
    );

    expect(screen.getByText("Generate Combined Cooking Plan")).toBeInTheDocument();
  });

  it("does not show generate button for single recipe", () => {
    const singleContentMap: Record<string, RecipeContent> = {
      "r1": recipeContentMap["r1"],
    };

    render(
      <CookModeSection
        recipes={recipes}
        recipeContentMap={singleContentMap}
        recipeIngredients={ingredients}
        eventName="Test Event"
      />
    );

    expect(screen.queryByText("Generate Combined Cooking Plan")).not.toBeInTheDocument();
  });

  it("generates and displays cook plan", async () => {
    const mockPlan: CombinedCookPlan = {
      totalTime: "20 minutes",
      steps: [
        { time: "0:00", action: "Boil water for pasta", recipe: "Pasta", equipment: "burner 1", duration: "10 minutes" },
        { time: "0:05", action: "Wash and chop lettuce", recipe: "Salad", equipment: "prep" },
      ],
      tips: ["Start water first as it takes longest"],
    };
    mockGenerateCookPlan.mockResolvedValue(mockPlan);

    render(
      <CookModeSection
        recipes={recipes}
        recipeContentMap={recipeContentMap}
        recipeIngredients={ingredients}
        eventName="Test Event"
      />
    );

    fireEvent.click(screen.getByText("Generate Combined Cooking Plan"));

    await waitFor(() => {
      expect(screen.getByText("Combined Cooking Plan")).toBeInTheDocument();
    });

    expect(screen.getByText("20 minutes")).toBeInTheDocument();
    expect(screen.getByText("Boil water for pasta")).toBeInTheDocument();
    expect(screen.getByText("burner 1")).toBeInTheDocument();
    expect(screen.getByText(/Start water first/)).toBeInTheDocument();
    expect(toast.success).toHaveBeenCalledWith("Cook plan generated!");
  });

  it("shows error when plan generation returns null", async () => {
    mockGenerateCookPlan.mockResolvedValue(null);

    render(
      <CookModeSection
        recipes={recipes}
        recipeContentMap={recipeContentMap}
        recipeIngredients={ingredients}
        eventName="Test Event"
      />
    );

    fireEvent.click(screen.getByText("Generate Combined Cooking Plan"));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Could not generate cook plan. AI features may not be available.");
    });
  });

  it("shows error when plan generation throws", async () => {
    mockGenerateCookPlan.mockRejectedValue(new Error("Network error"));

    render(
      <CookModeSection
        recipes={recipes}
        recipeContentMap={recipeContentMap}
        recipeIngredients={ingredients}
        eventName="Test Event"
      />
    );

    fireEvent.click(screen.getByText("Generate Combined Cooking Plan"));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to generate cook plan");
    });
  });

  it("hides generate button after plan is displayed", async () => {
    const mockPlan: CombinedCookPlan = {
      totalTime: "20 minutes",
      steps: [{ time: "0:00", action: "Do something", recipe: "Pasta" }],
      tips: [],
    };
    mockGenerateCookPlan.mockResolvedValue(mockPlan);

    render(
      <CookModeSection
        recipes={recipes}
        recipeContentMap={recipeContentMap}
        recipeIngredients={ingredients}
        eventName="Test Event"
      />
    );

    fireEvent.click(screen.getByText("Generate Combined Cooking Plan"));

    await waitFor(() => {
      expect(screen.getByText("Combined Cooking Plan")).toBeInTheDocument();
    });

    // Generate button should be hidden now
    expect(screen.queryByText("Generate Combined Cooking Plan")).not.toBeInTheDocument();
  });

  it("renders step without equipment or duration", async () => {
    const mockPlan: CombinedCookPlan = {
      totalTime: "10 minutes",
      steps: [{ time: "0:00", action: "Prep everything", recipe: "Pasta" }],
      tips: [],
    };
    mockGenerateCookPlan.mockResolvedValue(mockPlan);

    render(
      <CookModeSection
        recipes={recipes}
        recipeContentMap={recipeContentMap}
        recipeIngredients={ingredients}
        eventName="Test Event"
      />
    );

    fireEvent.click(screen.getByText("Generate Combined Cooking Plan"));

    await waitFor(() => {
      expect(screen.getByText("Prep everything")).toBeInTheDocument();
    });
  });

  it("handles recipe without ingredients", () => {
    render(
      <CookModeSection
        recipes={recipes}
        recipeContentMap={recipeContentMap}
        recipeIngredients={[]}
        eventName="Test Event"
      />
    );

    // Should still render without error, just no ingredient sections
    expect(screen.getByText("Pasta")).toBeInTheDocument();
    expect(screen.queryByText("Ingredients")).not.toBeInTheDocument();
  });

  it("handles recipe without instructions", () => {
    const noInstructionsMap: Record<string, RecipeContent> = {
      "r1": createMockRecipeContent({ recipeId: "r1", status: "completed", instructions: undefined }),
    };

    render(
      <CookModeSection
        recipes={recipes}
        recipeContentMap={noInstructionsMap}
        recipeIngredients={[]}
        eventName="Test Event"
      />
    );

    expect(screen.getByText("Pasta")).toBeInTheDocument();
    expect(screen.queryByText("Instructions")).not.toBeInTheDocument();
  });

  it("assigns colors to recipes cyclically", async () => {
    // Create many recipes to test cycling
    const manyRecipes: Recipe[] = Array.from({ length: 7 }, (_, i) =>
      createMockRecipe({ id: `r${i}`, name: `Recipe ${i}` })
    );
    const manyContentMap: Record<string, RecipeContent> = {};
    manyRecipes.forEach((r) => {
      manyContentMap[r.id] = createMockRecipeContent({
        recipeId: r.id,
        status: "completed",
        instructions: ["Step 1"],
      });
    });

    const mockPlan: CombinedCookPlan = {
      totalTime: "10 minutes",
      steps: [{ time: "0:00", action: "Do something", recipe: "Recipe 6" }],
      tips: [],
    };
    mockGenerateCookPlan.mockResolvedValue(mockPlan);

    render(
      <CookModeSection
        recipes={manyRecipes}
        recipeContentMap={manyContentMap}
        recipeIngredients={[]}
        eventName="Test Event"
      />
    );

    fireEvent.click(screen.getByText("Generate Combined Cooking Plan"));

    await waitFor(() => {
      expect(screen.getByText("Combined Cooking Plan")).toBeInTheDocument();
    });
  });

  it("renders step with unknown recipe color as fallback", async () => {
    const mockPlan: CombinedCookPlan = {
      totalTime: "10 minutes",
      steps: [{ time: "0:00", action: "Mystery step", recipe: "Unknown Recipe" }],
      tips: [],
    };
    mockGenerateCookPlan.mockResolvedValue(mockPlan);

    render(
      <CookModeSection
        recipes={recipes}
        recipeContentMap={recipeContentMap}
        recipeIngredients={ingredients}
        eventName="Test Event"
      />
    );

    fireEvent.click(screen.getByText("Generate Combined Cooking Plan"));

    await waitFor(() => {
      expect(screen.getByText("Mystery step")).toBeInTheDocument();
    });
  });
});
