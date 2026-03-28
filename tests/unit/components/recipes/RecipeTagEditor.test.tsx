import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@tests/utils";
import RecipeTagEditor from "@/components/recipes/RecipeTagEditor";
import { RECIPE_TAGS } from "@/lib/recipeTags";

describe("RecipeTagEditor", () => {
  it("renders all predefined tags", () => {
    render(<RecipeTagEditor tags={[]} onChange={vi.fn()} />);
    for (const { value } of RECIPE_TAGS) {
      expect(screen.getByRole("button", { name: value })).toBeInTheDocument();
    }
  });

  it("marks active tags as pressed", () => {
    render(<RecipeTagEditor tags={["Family Recipe"]} onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Family Recipe" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Comfort Food" })).toHaveAttribute("aria-pressed", "false");
  });

  it("calls onChange with new tag added when inactive tag is clicked", () => {
    const onChange = vi.fn();
    render(<RecipeTagEditor tags={["Comfort Food"]} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Family Recipe" }));
    expect(onChange).toHaveBeenCalledWith(expect.arrayContaining(["Comfort Food", "Family Recipe"]));
  });

  it("calls onChange with tag removed when active tag is clicked", () => {
    const onChange = vi.fn();
    render(<RecipeTagEditor tags={["Family Recipe", "Comfort Food"]} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Family Recipe" }));
    expect(onChange).toHaveBeenCalledWith(["Comfort Food"]);
  });

  it("calls onChange with empty array when last tag is removed", () => {
    const onChange = vi.fn();
    render(<RecipeTagEditor tags={["Weeknight Dinner"]} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Weeknight Dinner" }));
    expect(onChange).toHaveBeenCalledWith([]);
  });
});
