import { describe, it, expect } from "vitest";
import { render, screen } from "@tests/utils";
import RecipeInstructions from "@/components/cookmode/RecipeInstructions";

describe("RecipeInstructions", () => {
  it("renders numbered steps from instructions array", () => {
    const instructions = ["Preheat oven to 350°F", "Mix ingredients", "Bake for 30 minutes"];
    render(<RecipeInstructions instructions={instructions} />);

    expect(screen.getByText("Preheat oven to 350°F")).toBeInTheDocument();
    expect(screen.getByText("Mix ingredients")).toBeInTheDocument();
    expect(screen.getByText("Bake for 30 minutes")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("shows 'No instructions available' when instructions is empty", () => {
    render(<RecipeInstructions instructions={[]} />);
    expect(screen.getByText("No instructions available")).toBeInTheDocument();
  });

  it("shows 'No instructions available' when instructions is undefined", () => {
    render(<RecipeInstructions />);
    expect(screen.getByText("No instructions available")).toBeInTheDocument();
  });

  it("renders metadata header when servings and times are provided", () => {
    render(
      <RecipeInstructions
        instructions={["Step 1"]}
        servings="4"
        prepTime="10 min"
        cookTime="30 min"
        totalTime="40 min"
      />
    );

    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("10 min")).toBeInTheDocument();
    expect(screen.getByText("30 min")).toBeInTheDocument();
    expect(screen.getByText("40 min")).toBeInTheDocument();
  });

  it("does not render metadata section when no metadata is provided", () => {
    render(<RecipeInstructions instructions={["Step 1"]} />);

    expect(screen.queryByText("Servings:")).not.toBeInTheDocument();
    expect(screen.queryByText("Prep:")).not.toBeInTheDocument();
  });

  it("renders description when provided", () => {
    render(
      <RecipeInstructions
        instructions={["Step 1"]}
        description="A delicious recipe"
      />
    );
    expect(screen.getByText("A delicious recipe")).toBeInTheDocument();
  });

  it("renders only provided metadata fields", () => {
    render(
      <RecipeInstructions
        instructions={["Step 1"]}
        servings="2"
        totalTime="20 min"
      />
    );

    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("20 min")).toBeInTheDocument();
    expect(screen.queryByText("Prep:")).not.toBeInTheDocument();
    expect(screen.queryByText("Cook:")).not.toBeInTheDocument();
  });
});
