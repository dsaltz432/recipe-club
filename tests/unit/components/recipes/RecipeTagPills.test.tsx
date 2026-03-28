import { describe, it, expect } from "vitest";
import { render, screen } from "@tests/utils";
import RecipeTagPills from "@/components/recipes/RecipeTagPills";

describe("RecipeTagPills", () => {
  it("renders nothing when tags is empty", () => {
    const { container } = render(<RecipeTagPills tags={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders a pill for each tag", () => {
    render(<RecipeTagPills tags={["Family Recipe", "Comfort Food"]} />);
    expect(screen.getByText("Family Recipe")).toBeInTheDocument();
    expect(screen.getByText("Comfort Food")).toBeInTheDocument();
  });

  it("applies tag-specific color classes", () => {
    render(<RecipeTagPills tags={["Family Recipe"]} />);
    const pill = screen.getByText("Family Recipe");
    expect(pill.className).toContain("rose");
  });
});
