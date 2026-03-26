import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@tests/utils";
import CookModeDialog from "@/components/cookmode/CookModeDialog";
import type { CookModeStep } from "@/types";

// Mock canvas-confetti (used by CookModeComplete which renders on completion)
vi.mock("canvas-confetti", () => ({ default: vi.fn() }));

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

const mockSteps: CookModeStep[] = [
  {
    recipeId: "recipe-1",
    recipeName: "Pasta Carbonara",
    instruction: "Boil a large pot of salted water.",
    category: "active",
    timing: "10 minutes",
  },
  {
    recipeId: "recipe-1",
    recipeName: "Pasta Carbonara",
    instruction: "Cook the pancetta until crispy.",
    category: "active",
  },
  {
    recipeId: "recipe-2",
    recipeName: "Caesar Salad",
    instruction: "Chop the romaine lettuce.",
    category: "prep",
  },
];

const multiRecipeSteps: CookModeStep[] = [
  { recipeId: "recipe-1", recipeName: "Pasta", instruction: "Step 1 pasta" },
  { recipeId: "recipe-2", recipeName: "Salad", instruction: "Step 1 salad" },
];

const recipeNames = new Map([
  ["recipe-1", "Pasta Carbonara"],
  ["recipe-2", "Caesar Salad"],
]);

const defaultProps = {
  open: true,
  onClose: vi.fn(),
  steps: mockSteps,
  recipeNames,
};

beforeEach(() => {
  vi.clearAllMocks();
  // Mock Wake Lock API
  Object.defineProperty(navigator, "wakeLock", {
    value: {
      request: vi.fn().mockResolvedValue({
        release: vi.fn().mockResolvedValue(undefined),
      }),
    },
    configurable: true,
  });
});

describe("CookModeDialog", () => {
  it("renders in step-by-step view by default showing first step", () => {
    render(<CookModeDialog {...defaultProps} />);
    // Step instruction appears in both main view and sidebar steps list
    expect(screen.getAllByText("Boil a large pot of salted water.").length).toBeGreaterThanOrEqual(1);
  });

  it("shows progress indicator with step count", () => {
    render(<CookModeDialog {...defaultProps} />);
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
  });

  it("shows progress bar", () => {
    render(<CookModeDialog {...defaultProps} />);
    const progressbar = screen.getByRole("progressbar");
    expect(progressbar).toBeInTheDocument();
  });

  it("shows close button", () => {
    render(<CookModeDialog {...defaultProps} />);
    expect(screen.getByLabelText("Close cook mode")).toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", () => {
    const onClose = vi.fn();
    render(<CookModeDialog {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText("Close cook mode"));
    expect(onClose).toHaveBeenCalled();
  });

  it("navigates to next step when Next is clicked", () => {
    render(<CookModeDialog {...defaultProps} />);
    fireEvent.click(screen.getByLabelText("Next step"));
    // Instruction appears in both main view and sidebar
    expect(screen.getAllByText("Cook the pancetta until crispy.").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
  });

  it("navigates to previous step when Prev is clicked", () => {
    render(<CookModeDialog {...defaultProps} />);
    // Go to step 2 first
    fireEvent.click(screen.getByLabelText("Next step"));
    // Then go back
    fireEvent.click(screen.getByLabelText("Previous step"));
    // Instruction appears in both main view and sidebar
    expect(screen.getAllByText("Boil a large pot of salted water.").length).toBeGreaterThanOrEqual(1);
  });

  it("disables Prev button on first step", () => {
    render(<CookModeDialog {...defaultProps} />);
    expect(screen.getByLabelText("Previous step")).toBeDisabled();
  });

  it("shows Done! button on last step", () => {
    render(<CookModeDialog {...defaultProps} />);
    // Navigate to last step
    fireEvent.click(screen.getByLabelText("Next step"));
    fireEvent.click(screen.getByLabelText("Next step"));
    expect(screen.getByLabelText("Finish cooking")).toBeInTheDocument();
    expect(screen.queryByLabelText("Next step")).not.toBeInTheDocument();
  });

  it("clicking Done! shows completion screen", () => {
    render(<CookModeDialog {...defaultProps} />);
    // Navigate to last step
    fireEvent.click(screen.getByLabelText("Next step"));
    fireEvent.click(screen.getByLabelText("Next step"));
    // Click Done!
    fireEvent.click(screen.getByLabelText("Finish cooking"));
    expect(screen.getByText("You did it!")).toBeInTheDocument();
    // Navigation footer should be hidden
    expect(screen.queryByLabelText("Finish cooking")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Previous step")).not.toBeInTheDocument();
  });

  it("jumping to a step via sidebar updates the current step display", () => {
    render(<CookModeDialog {...defaultProps} />);
    // Click on step 3 in the sidebar steps list
    fireEvent.click(screen.getByLabelText("Go to step 3"));
    expect(screen.getByText("3 / 3")).toBeInTheDocument();
    // Instruction appears in both main view and sidebar
    expect(screen.getAllByText("Chop the romaine lettuce.").length).toBeGreaterThanOrEqual(1);
  });

  it("shows loading spinner when loading prop is true", () => {
    render(<CookModeDialog {...defaultProps} loading={true} steps={[]} />);
    expect(screen.getByText("Generating cooking timeline...")).toBeInTheDocument();
  });

  it("shows error message when error prop is provided", () => {
    render(
      <CookModeDialog {...defaultProps} error="Failed to generate timeline" loading={false} steps={[]} />
    );
    expect(screen.getByText("Failed to generate timeline")).toBeInTheDocument();
  });

  it("shows empty state when no steps and no loading/error", () => {
    render(<CookModeDialog {...defaultProps} steps={[]} />);
    expect(screen.getByText("No steps available.")).toBeInTheDocument();
  });

  it("works for single recipe steps", () => {
    const singleRecipeSteps: CookModeStep[] = [
      { recipeId: "recipe-1", recipeName: "Pasta", instruction: "Boil water" },
      { recipeId: "recipe-1", recipeName: "Pasta", instruction: "Add pasta" },
    ];
    render(<CookModeDialog {...defaultProps} steps={singleRecipeSteps} />);
    // Instruction appears in both main view and sidebar
    expect(screen.getAllByText("Boil water").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
  });

  it("works for multi-recipe interleaved steps", () => {
    render(<CookModeDialog {...defaultProps} steps={multiRecipeSteps} />);
    // Instruction appears in both main view and sidebar
    expect(screen.getAllByText("Step 1 pasta").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
  });

  it("does not render content when open is false", () => {
    render(<CookModeDialog {...defaultProps} open={false} />);
    expect(screen.queryByText("Cook Mode")).not.toBeInTheDocument();
  });

  it("shows the Cook Mode label in the header", () => {
    render(<CookModeDialog {...defaultProps} />);
    const labels = screen.getAllByText("Cook Mode");
    expect(labels.length).toBeGreaterThanOrEqual(1);
  });

  it("renders sidebar with ingredient panel on desktop", () => {
    const ingredientsByRecipe = new Map([
      ["r1", [{ id: "ing-1", recipeId: "r1", name: "flour", quantity: 2, unit: "cup", category: "pantry" as const }]],
    ]);
    render(
      <CookModeDialog
        open
        onClose={() => {}}
        steps={[{ recipeId: "r1", recipeName: "Pasta", instruction: "Boil water" }]}
        recipeNames={new Map([["r1", "Pasta"]])}
        ingredientsByRecipe={ingredientsByRecipe}
      />
    );
    // The sidebar is hidden on mobile but in the DOM
    expect(screen.getByText("Ingredients")).toBeInTheDocument();
    expect(screen.getByText("2 cup flour")).toBeInTheDocument();
  });

  it("shows mobile drawer toggle button when steps are present", () => {
    render(<CookModeDialog {...defaultProps} />);
    expect(screen.getByLabelText("Show ingredients")).toBeInTheDocument();
  });

  it("clicking mobile drawer toggle changes aria-label and shows sidebar content", () => {
    render(<CookModeDialog {...defaultProps} />);
    const toggle = screen.getByLabelText("Show ingredients");
    fireEvent.click(toggle);
    expect(screen.getByLabelText("Hide ingredients")).toBeInTheDocument();
  });
});
