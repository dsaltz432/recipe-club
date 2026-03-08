import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@tests/utils";
import CookModeDialog from "@/components/cookmode/CookModeDialog";
import type { CookModeStep } from "@/types";

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
    expect(screen.getByText("Boil a large pot of salted water.")).toBeInTheDocument();
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
    expect(screen.getByText("Cook the pancetta until crispy.")).toBeInTheDocument();
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
  });

  it("navigates to previous step when Prev is clicked", () => {
    render(<CookModeDialog {...defaultProps} />);
    // Go to step 2 first
    fireEvent.click(screen.getByLabelText("Next step"));
    // Then go back
    fireEvent.click(screen.getByLabelText("Previous step"));
    expect(screen.getByText("Boil a large pot of salted water.")).toBeInTheDocument();
  });

  it("disables Prev button on first step", () => {
    render(<CookModeDialog {...defaultProps} />);
    expect(screen.getByLabelText("Previous step")).toBeDisabled();
  });

  it("disables Next button on last step", () => {
    render(<CookModeDialog {...defaultProps} />);
    // Navigate to last step
    fireEvent.click(screen.getByLabelText("Next step"));
    fireEvent.click(screen.getByLabelText("Next step"));
    expect(screen.getByLabelText("Next step")).toBeDisabled();
  });

  it("toggles to list view when List button is clicked", () => {
    render(<CookModeDialog {...defaultProps} />);
    fireEvent.click(screen.getByLabelText("Switch to list view"));
    // All steps should be visible in list view
    expect(screen.getByText("Boil a large pot of salted water.")).toBeInTheDocument();
    expect(screen.getByText("Cook the pancetta until crispy.")).toBeInTheDocument();
    expect(screen.getByText("Chop the romaine lettuce.")).toBeInTheDocument();
  });

  it("tapping a step in list view jumps to it in step-by-step view", () => {
    render(<CookModeDialog {...defaultProps} />);
    // Switch to list view
    fireEvent.click(screen.getByLabelText("Switch to list view"));
    // Click on step 3
    fireEvent.click(screen.getByLabelText("Go to step 3"));
    // Should now be in step view showing step 3
    expect(screen.getByText("Chop the romaine lettuce.")).toBeInTheDocument();
    expect(screen.getByText("3 / 3")).toBeInTheDocument();
    // Nav buttons should be visible (step view mode)
    expect(screen.getByLabelText("Next step")).toBeInTheDocument();
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
    expect(screen.getByText("Boil water")).toBeInTheDocument();
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
  });

  it("works for multi-recipe interleaved steps", () => {
    render(<CookModeDialog {...defaultProps} steps={multiRecipeSteps} />);
    expect(screen.getByText("Step 1 pasta")).toBeInTheDocument();
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
});
