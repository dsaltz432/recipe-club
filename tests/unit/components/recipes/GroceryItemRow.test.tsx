import { describe, it, expect } from "vitest";
import { render, screen } from "@tests/utils";
import GroceryItemRow from "@/components/recipes/GroceryItemRow";
import type { CombinedGroceryItem, SmartGroceryItem } from "@/types";

describe("GroceryItemRow", () => {
  it("renders item with quantity, unit, and name", () => {
    const item: CombinedGroceryItem = {
      name: "flour",
      totalQuantity: 2,
      unit: "cup",
      category: "pantry",
      sourceRecipes: ["Pasta"],
    };

    render(<GroceryItemRow item={item} />);

    expect(screen.getByText("2 cups flour")).toBeInTheDocument();
    expect(screen.getByText("Pasta")).toBeInTheDocument();
  });

  it("renders item without quantity", () => {
    const item: CombinedGroceryItem = {
      name: "salt",
      category: "spices",
      sourceRecipes: ["Soup"],
    };

    render(<GroceryItemRow item={item} />);

    expect(screen.getByText("salt")).toBeInTheDocument();
    expect(screen.getByText("Soup")).toBeInTheDocument();
  });

  it("renders multiple source recipe badges", () => {
    const item: CombinedGroceryItem = {
      name: "onion",
      totalQuantity: 3,
      category: "produce",
      sourceRecipes: ["Soup", "Salad"],
    };

    render(<GroceryItemRow item={item} />);

    expect(screen.getByText("3 onions")).toBeInTheDocument();
    expect(screen.getByText("Soup")).toBeInTheDocument();
    expect(screen.getByText("Salad")).toBeInTheDocument();
  });

  it("renders SmartGroceryItem with totalQuantity and unit", () => {
    const item: SmartGroceryItem = {
      name: "broccoli",
      totalQuantity: 2,
      unit: "head",
      category: "produce",
      sourceRecipes: ["Stir Fry", "Salad"],
    };

    render(<GroceryItemRow item={item} />);

    expect(screen.getByText("2 broccoli heads")).toBeInTheDocument();
    expect(screen.getByText("Stir Fry")).toBeInTheDocument();
    expect(screen.getByText("Salad")).toBeInTheDocument();
  });
});
