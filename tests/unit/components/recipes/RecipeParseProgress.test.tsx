import { describe, it, expect } from "vitest";
import { render, screen } from "@tests/utils";
import RecipeParseProgress from "@/components/recipes/RecipeParseProgress";

const steps = [
  { key: "saving", label: "Adding recipe" },
  { key: "parsing", label: "Parsing ingredients & instructions" },
  { key: "loading", label: "Loading recipe data" },
];

describe("RecipeParseProgress", () => {
  it("renders all step labels", () => {
    render(<RecipeParseProgress steps={steps} currentStep="saving" />);

    expect(screen.getByText("Adding recipe")).toBeInTheDocument();
    expect(screen.getByText("Parsing ingredients & instructions")).toBeInTheDocument();
    expect(screen.getByText("Loading recipe data")).toBeInTheDocument();
  });

  it("shows spinner on the active step", () => {
    const { container } = render(<RecipeParseProgress steps={steps} currentStep="parsing" />);

    // First step (saving) should be complete (check icon)
    // Second step (parsing) should be active (spinner)
    // Third step (loading) should be pending (circle)
    const savingLabel = screen.getByText("Adding recipe");
    expect(savingLabel.className).toContain("text-green-700");

    const parsingLabel = screen.getByText("Parsing ingredients & instructions");
    expect(parsingLabel.className).toContain("font-medium");

    // Verify spinner exists (animate-spin class)
    const spinners = container.querySelectorAll(".animate-spin");
    expect(spinners.length).toBe(1);
  });

  it("marks completed steps with green styling", () => {
    render(<RecipeParseProgress steps={steps} currentStep="loading" />);

    const savingLabel = screen.getByText("Adding recipe");
    expect(savingLabel.className).toContain("text-green-700");

    const parsingLabel = screen.getByText("Parsing ingredients & instructions");
    expect(parsingLabel.className).toContain("text-green-700");

    const loadingLabel = screen.getByText("Loading recipe data");
    expect(loadingLabel.className).toContain("font-medium");
  });

  it("shows all steps as complete and 'Recipe Added!' when done", () => {
    render(<RecipeParseProgress steps={steps} currentStep="done" />);

    // All labels should be green
    expect(screen.getByText("Adding recipe").className).toContain("text-green-700");
    expect(screen.getByText("Parsing ingredients & instructions").className).toContain("text-green-700");
    expect(screen.getByText("Loading recipe data").className).toContain("text-green-700");

    // "Recipe Added!" banner
    expect(screen.getByText("Recipe Added!")).toBeInTheDocument();
  });

  it("does not show 'Recipe Added!' when not done", () => {
    render(<RecipeParseProgress steps={steps} currentStep="saving" />);

    expect(screen.queryByText("Recipe Added!")).not.toBeInTheDocument();
  });

  it("renders progress bar", () => {
    const { container } = render(<RecipeParseProgress steps={steps} currentStep="saving" />);

    const progressBar = container.querySelector('[role="progressbar"]');
    expect(progressBar).toBeInTheDocument();
  });

  it("shows 100% progress when done", () => {
    const { container } = render(<RecipeParseProgress steps={steps} currentStep="done" />);

    const indicator = container.querySelector('[role="progressbar"] > div');
    expect(indicator).toHaveStyle({ transform: "translateX(-0%)" });
  });

  it("shows pending steps with muted styling", () => {
    render(<RecipeParseProgress steps={steps} currentStep="saving" />);

    const loadingLabel = screen.getByText("Loading recipe data");
    expect(loadingLabel.className).toContain("text-muted-foreground");
  });

  it("handles conditional steps array", () => {
    const conditionalSteps = [
      { key: "saving", label: "Adding recipe" },
      { key: "parsing", label: "Parsing ingredients & instructions" },
      { key: "combining", label: "Combining with other recipes" },
    ];

    render(<RecipeParseProgress steps={conditionalSteps} currentStep="combining" />);

    expect(screen.getByText("Combining with other recipes")).toBeInTheDocument();
    const combiningLabel = screen.getByText("Combining with other recipes");
    expect(combiningLabel.className).toContain("font-medium");
  });
});
