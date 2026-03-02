import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@tests/utils";
import type { SmartGroceryItem } from "@/types";

// Mock supabase client (imported transitively by groceryList)
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}));

import GroceryCategoryGroup from "@/components/recipes/GroceryCategoryGroup";

describe("GroceryCategoryGroup", () => {
  const items: SmartGroceryItem[] = [
    { name: "tomato", displayName: "tomatoes", totalQuantity: 3, category: "produce", sourceRecipes: ["Salad"] },
    { name: "lettuce", displayName: "lettuce", totalQuantity: 1, unit: "head", category: "produce", sourceRecipes: ["Salad"] },
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
    const meatItems: SmartGroceryItem[] = [
      { name: "chicken", displayName: "chicken", totalQuantity: 1, unit: "lb", category: "meat_seafood", sourceRecipes: ["Curry"] },
    ];

    render(<GroceryCategoryGroup category="meat_seafood" items={meatItems} />);

    expect(screen.getByText("Protein")).toBeInTheDocument();
  });

  it("renders SmartGroceryItem items", () => {
    const smartItems: SmartGroceryItem[] = [
      { name: "broccoli", displayName: "broccoli", totalQuantity: 2, unit: "head", category: "produce", sourceRecipes: ["Stir Fry"] },
    ];

    render(<GroceryCategoryGroup category="produce" items={smartItems} />);

    expect(screen.getByText("2 broccoli heads")).toBeInTheDocument();
    expect(screen.getByText("(1)")).toBeInTheDocument();
  });

  it("passes editable props through to GroceryItemRow", () => {
    const onEditItem = vi.fn();
    const onRemoveItem = vi.fn();

    render(
      <GroceryCategoryGroup
        category="produce"
        items={items}
        editable
        onEditItem={onEditItem}
        onRemoveItem={onRemoveItem}
      />
    );

    // Edit and remove buttons should be present
    const editButtons = screen.getAllByLabelText("Edit item");
    expect(editButtons.length).toBe(2);

    const removeButtons = screen.getAllByLabelText("Remove item");
    expect(removeButtons.length).toBe(2);
  });

  it("does not show edit/remove buttons when editable is not set", () => {
    render(<GroceryCategoryGroup category="produce" items={items} />);

    expect(screen.queryByLabelText("Edit item")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Remove item")).not.toBeInTheDocument();
  });

  it("calls onRemoveItem when remove button is clicked", () => {
    const onRemoveItem = vi.fn();

    render(
      <GroceryCategoryGroup
        category="produce"
        items={items}
        editable
        onRemoveItem={onRemoveItem}
      />
    );

    const removeButtons = screen.getAllByLabelText("Remove item");
    fireEvent.click(removeButtons[0]);

    expect(onRemoveItem).toHaveBeenCalledWith("tomato");
  });

  it("calls onEditItem when edit is saved", () => {
    const onEditItem = vi.fn();

    render(
      <GroceryCategoryGroup
        category="produce"
        items={items}
        editable
        onEditItem={onEditItem}
      />
    );

    const editButtons = screen.getAllByLabelText("Edit item");
    fireEvent.click(editButtons[0]);

    fireEvent.change(screen.getByLabelText("Item name"), { target: { value: "cherry tomato" } });
    fireEvent.click(screen.getByLabelText("Save edit"));

    expect(onEditItem).toHaveBeenCalledWith("tomato", expect.objectContaining({
      name: "cherry tomato",
    }));
  });

  it("shows edit/remove buttons when onEditItemText is provided", () => {
    render(
      <GroceryCategoryGroup
        category="produce"
        items={items}
        onEditItemText={vi.fn()}
        onRemoveItem={vi.fn()}
      />
    );

    expect(screen.getAllByLabelText("Edit item").length).toBe(2);
    expect(screen.getAllByLabelText("Remove item").length).toBe(2);
  });

  it("uses single-field edit when onEditItemText is provided", () => {
    const onEditItemText = vi.fn();

    render(
      <GroceryCategoryGroup
        category="produce"
        items={items}
        onEditItemText={onEditItemText}
      />
    );

    const editButtons = screen.getAllByLabelText("Edit item");
    fireEvent.click(editButtons[0]);

    expect(screen.getByLabelText("Edit item text")).toBeInTheDocument();
    expect(screen.queryByLabelText("Item name")).not.toBeInTheDocument();
  });

  it("calls onEditItemText when single-field edit is saved", () => {
    const onEditItemText = vi.fn();

    render(
      <GroceryCategoryGroup
        category="produce"
        items={items}
        onEditItemText={onEditItemText}
      />
    );

    const editButtons = screen.getAllByLabelText("Edit item");
    fireEvent.click(editButtons[0]);

    fireEvent.change(screen.getByLabelText("Edit item text"), { target: { value: "5 roma tomatoes" } });
    fireEvent.click(screen.getByLabelText("Save edit"));

    expect(onEditItemText).toHaveBeenCalledWith("tomato", "5 roma tomatoes");
  });
});
