import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@tests/utils";
import CookModeSidebar from "@/components/cookmode/CookModeSidebar";
import type { RecipeIngredient } from "@/types";

vi.mock("@/hooks/useRecipeTips", () => ({
  useRecipeTips: () => ({
    tips: [],
    loading: false,
    error: null,
    fetchTips: vi.fn(),
    addTip: vi.fn(),
    deleteTip: vi.fn(),
  }),
}));

const recipeColorMap = new Map([
  ["r1", 0],
  ["r2", 1],
]);

const recipeNames = new Map([
  ["r1", "Pasta"],
  ["r2", "Salad"],
]);

const ingredients: RecipeIngredient[] = [
  { id: "ing-1", recipeId: "r1", name: "spaghetti", quantity: 200, unit: "g", category: "pantry" },
  { id: "ing-2", recipeId: "r1", name: "eggs", quantity: 3, unit: undefined, category: "dairy" },
];

const ingredientsByRecipe = new Map([
  ["r1", ingredients],
  ["r2", []],
]);

const defaultProps = {
  ingredientsByRecipe,
  recipeColorMap,
  recipeNames,
  primaryRecipeId: "r1",
  userId: "user-1",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CookModeSidebar", () => {
  it("renders the Ingredients section heading", () => {
    render(<CookModeSidebar {...defaultProps} />);
    expect(screen.getByText("Ingredients")).toBeInTheDocument();
  });

  it("renders ingredient items", () => {
    render(<CookModeSidebar {...defaultProps} />);
    expect(screen.getByText(/spaghetti/)).toBeInTheDocument();
    expect(screen.getByText(/eggs/)).toBeInTheDocument();
  });

  it("renders quantity and unit for ingredients", () => {
    render(<CookModeSidebar {...defaultProps} />);
    expect(screen.getByText(/200 g spaghetti/)).toBeInTheDocument();
  });

  it("renders the Tips section when primaryRecipeId is provided", () => {
    render(<CookModeSidebar {...defaultProps} />);
    expect(screen.getByText("Tips")).toBeInTheDocument();
  });

  it("collapses the tips section when the toggle button is clicked", () => {
    render(<CookModeSidebar {...defaultProps} />);
    // Tips content visible initially (empty state shows "Add the first tip")
    expect(screen.getByText("+ Add the first tip")).toBeInTheDocument();
    // Click to collapse
    fireEvent.click(screen.getByLabelText("Collapse tips"));
    expect(screen.queryByText("+ Add the first tip")).not.toBeInTheDocument();
  });

  it("expands the tips section again after collapsing", () => {
    render(<CookModeSidebar {...defaultProps} />);
    fireEvent.click(screen.getByLabelText("Collapse tips"));
    fireEvent.click(screen.getByLabelText("Expand tips"));
    expect(screen.getByText("+ Add the first tip")).toBeInTheDocument();
  });

  it("does not render the Tips section when primaryRecipeId is not provided", () => {
    render(<CookModeSidebar {...defaultProps} primaryRecipeId={undefined} />);
    expect(screen.queryByText("Tips")).not.toBeInTheDocument();
  });

  it("shows no-ingredients message when ingredientsByRecipe is empty", () => {
    render(
      <CookModeSidebar
        {...defaultProps}
        ingredientsByRecipe={new Map([["r1", []]])}
      />
    );
    expect(screen.getByText("No ingredients available.")).toBeInTheDocument();
  });
});
