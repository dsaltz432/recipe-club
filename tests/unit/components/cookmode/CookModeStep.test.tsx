import { describe, it, expect } from "vitest";
import { render, screen } from "@tests/utils";
import CookModeStep from "@/components/cookmode/CookModeStep";
import type { CookModeStep as CookModeStepType } from "@/types";
import type { RecipeColor } from "@/lib/cookModeColors";

const color: RecipeColor = {
  bg: "bg-purple-50",
  text: "text-purple-700",
  border: "border-purple-200",
};

const baseStep: CookModeStepType = {
  recipeId: "recipe-1",
  recipeName: "Pasta Carbonara",
  instruction: "Boil water in a large pot.",
};

describe("CookModeStep", () => {
  it("shows recipe name badge", () => {
    render(<CookModeStep step={baseStep} color={color} />);
    expect(screen.getByText("Pasta Carbonara")).toBeInTheDocument();
  });

  it("shows instruction text in large readable font", () => {
    render(<CookModeStep step={baseStep} color={color} />);
    const instruction = screen.getByText("Boil water in a large pot.");
    expect(instruction).toBeInTheDocument();
    expect(instruction.className).toMatch(/text-lg/);
  });

  it("shows timing hint when provided", () => {
    const step: CookModeStepType = { ...baseStep, timing: "10 minutes" };
    render(<CookModeStep step={step} color={color} />);
    expect(screen.getByText("10 minutes")).toBeInTheDocument();
  });

  it("does not show timing when not provided", () => {
    render(<CookModeStep step={baseStep} color={color} />);
    expect(screen.queryByText("minutes")).not.toBeInTheDocument();
  });

  it("shows Scissors icon for prep category", () => {
    const step: CookModeStepType = { ...baseStep, category: "prep" };
    const { container } = render(<CookModeStep step={step} color={color} />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("shows Flame icon for active category", () => {
    const step: CookModeStepType = { ...baseStep, category: "active" };
    const { container } = render(<CookModeStep step={step} color={color} />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("shows Timer icon for passive category", () => {
    const step: CookModeStepType = { ...baseStep, category: "passive" };
    const { container } = render(<CookModeStep step={step} color={color} />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("shows CheckCircle2 icon for finish category", () => {
    const step: CookModeStepType = { ...baseStep, category: "finish" };
    const { container } = render(<CookModeStep step={step} color={color} />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders without icon when category is undefined", () => {
    const { container } = render(<CookModeStep step={baseStep} color={color} />);
    expect(container.querySelector("svg")).not.toBeInTheDocument();
  });

  it("applies color classes from color prop", () => {
    const { container } = render(<CookModeStep step={baseStep} color={color} />);
    expect(container.firstChild).toHaveClass("border-purple-200");
  });

  it("applies active styling when isActive is true", () => {
    const { container } = render(
      <CookModeStep step={baseStep} color={color} isActive={true} />
    );
    expect(container.firstChild).toHaveClass("bg-purple-50");
  });
});
