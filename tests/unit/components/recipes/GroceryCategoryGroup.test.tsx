import { describe, it, expect } from "vitest";
import { render, screen } from "@tests/utils";
import GroceryCategoryGroup from "@/components/recipes/GroceryCategoryGroup";
import type { CombinedGroceryItem, SmartGroceryItem } from "@/types";

describe("GroceryCategoryGroup", () => {
  const items: CombinedGroceryItem[] = [
    { name: "tomato", totalQuantity: 3, category: "produce", sourceRecipes: ["Salad"] },
    { name: "lettuce", totalQuantity: 1, unit: "head", category: "produce", sourceRecipes: ["Salad"] },
  ];

  it("renders category display name", () => {
    render(<GroceryCategoryGroup category="produce" items={items} />);

    expect(screen.getByText("Produce")).toBeInTheDocument();
  });

  it("renders item count", () => {
    render(<GroceryCategoryGroup category="produce" items={items} />);

    expect(screen.getByText("(2)")).toBeInTheDocument();
  });

  it("renders all items in the category", () => {
    render(<GroceryCategoryGroup category="produce" items={items} />);

    expect(screen.getByText("3 tomatoes")).toBeInTheDocument();
    expect(screen.getByText("1 lettuce head")).toBeInTheDocument();
  });

  it("renders meat_seafood display name as Protein", () => {
    const meatItems: CombinedGroceryItem[] = [
      { name: "chicken", totalQuantity: 1, unit: "lb", category: "meat_seafood", sourceRecipes: ["Curry"] },
    ];

    render(<GroceryCategoryGroup category="meat_seafood" items={meatItems} />);

    expect(screen.getByText("Protein")).toBeInTheDocument();
  });

  it("renders SmartGroceryItem items", () => {
    const smartItems: SmartGroceryItem[] = [
      { name: "broccoli", totalQuantity: 2, unit: "head", category: "produce", sourceRecipes: ["Stir Fry"] },
    ];

    render(<GroceryCategoryGroup category="produce" items={smartItems} />);

    expect(screen.getByText("2 broccoli heads")).toBeInTheDocument();
    expect(screen.getByText("(1)")).toBeInTheDocument();
  });
});
