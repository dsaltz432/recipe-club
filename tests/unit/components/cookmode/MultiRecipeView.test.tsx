import { describe, it, expect } from "vitest";
import { render, screen } from "@tests/utils";
import MultiRecipeView from "@/components/cookmode/MultiRecipeView";
import { getRecipeColor } from "@/lib/cookModeColors";
import type { RecipeContent } from "@/types";

const makeContent = (overrides: Partial<RecipeContent> = {}): RecipeContent => ({
  id: "content-1",
  recipeId: "recipe-1",
  status: "completed",
  instructions: ["Step 1", "Step 2"],
  servings: "4",
  prepTime: "10 min",
  cookTime: "30 min",
  totalTime: "40 min",
  ...overrides,
});

const pastaContent = makeContent({
  id: "content-pasta",
  recipeId: "recipe-pasta",
  instructions: ["Boil water", "Cook pasta", "Add sauce"],
});

const saladContent = makeContent({
  id: "content-salad",
  recipeId: "recipe-salad",
  instructions: ["Chop lettuce", "Add dressing"],
});

const recipes = [
  { id: "recipe-pasta", name: "Pasta Bolognese", content: pastaContent },
  { id: "recipe-salad", name: "Caesar Salad", content: saladContent },
];

describe("MultiRecipeView", () => {
  it("renders nothing when recipes array is empty", () => {
    const { container } = render(<MultiRecipeView recipes={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders recipe names as headings", () => {
    render(<MultiRecipeView recipes={recipes} />);
    const pastaHeadings = screen.getAllByText("Pasta Bolognese");
    const saladHeadings = screen.getAllByText("Caesar Salad");
    expect(pastaHeadings.length).toBeGreaterThanOrEqual(1);
    expect(saladHeadings.length).toBeGreaterThanOrEqual(1);
  });

  it("renders instructions for each recipe", () => {
    render(<MultiRecipeView recipes={recipes} />);
    expect(screen.getAllByText("Boil water").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Chop lettuce").length).toBeGreaterThanOrEqual(1);
  });

  it("renders tab triggers for each recipe on mobile view", () => {
    render(<MultiRecipeView recipes={recipes} />);
    // shadcn Tabs renders tab triggers regardless of visibility class
    const pastaTabs = screen.getAllByRole("tab", { name: "Pasta Bolognese" });
    const saladTabs = screen.getAllByRole("tab", { name: "Caesar Salad" });
    expect(pastaTabs.length).toBeGreaterThanOrEqual(1);
    expect(saladTabs.length).toBeGreaterThanOrEqual(1);
  });

  it("renders a single recipe without errors", () => {
    render(
      <MultiRecipeView
        recipes={[{ id: "recipe-pasta", name: "Pasta", content: pastaContent }]}
      />
    );
    expect(screen.getAllByText("Pasta").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Boil water").length).toBeGreaterThanOrEqual(1);
  });

  it("shows 'No instructions available' when a recipe has no instructions", () => {
    const noInstructionsContent = makeContent({ instructions: undefined });
    render(
      <MultiRecipeView
        recipes={[{ id: "recipe-empty", name: "Empty Recipe", content: noInstructionsContent }]}
      />
    );
    const noInstructionsMsgs = screen.getAllByText("No instructions available");
    expect(noInstructionsMsgs.length).toBeGreaterThanOrEqual(1);
  });
});

describe("getRecipeColor", () => {
  it("returns an object with bg, text, and border properties", () => {
    const color = getRecipeColor(0);
    expect(color).toHaveProperty("bg");
    expect(color).toHaveProperty("text");
    expect(color).toHaveProperty("border");
  });

  it("returns different colors for different indices", () => {
    const color0 = getRecipeColor(0);
    const color1 = getRecipeColor(1);
    expect(color0.bg).not.toBe(color1.bg);
  });

  it("wraps around after 8 colors", () => {
    const color0 = getRecipeColor(0);
    const color8 = getRecipeColor(8);
    expect(color0.bg).toBe(color8.bg);
    expect(color0.text).toBe(color8.text);
    expect(color0.border).toBe(color8.border);
  });

  it("returns Tailwind class strings for bg, text, border", () => {
    const color = getRecipeColor(0);
    expect(color.bg).toMatch(/^bg-/);
    expect(color.text).toMatch(/^text-/);
    expect(color.border).toMatch(/^border-/);
  });
});
