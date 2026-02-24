import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@tests/utils";
import type { CombinedGroceryItem, SmartGroceryItem } from "@/types";

// Mock supabase client (imported transitively by groceryList)
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}));

import GroceryItemRow from "@/components/recipes/GroceryItemRow";

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

  it("does not show edit/remove buttons when editable is false", () => {
    const item: CombinedGroceryItem = {
      name: "flour",
      totalQuantity: 2,
      unit: "cup",
      category: "pantry",
      sourceRecipes: ["Pasta"],
    };

    render(<GroceryItemRow item={item} />);

    expect(screen.queryByLabelText("Edit item")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Remove item")).not.toBeInTheDocument();
  });

  it("shows edit/remove buttons when editable is true", () => {
    const item: CombinedGroceryItem = {
      name: "flour",
      totalQuantity: 2,
      unit: "cup",
      category: "pantry",
      sourceRecipes: ["Pasta"],
    };

    render(<GroceryItemRow item={item} editable onEdit={vi.fn()} onRemove={vi.fn()} />);

    expect(screen.getByLabelText("Edit item")).toBeInTheDocument();
    expect(screen.getByLabelText("Remove item")).toBeInTheDocument();
  });

  it("switches to edit mode when edit button is clicked", () => {
    const item: CombinedGroceryItem = {
      name: "flour",
      totalQuantity: 2,
      unit: "cup",
      category: "pantry",
      sourceRecipes: ["Pasta"],
    };

    render(<GroceryItemRow item={item} editable onEdit={vi.fn()} />);

    fireEvent.click(screen.getByLabelText("Edit item"));

    expect(screen.getByLabelText("Item name")).toBeInTheDocument();
    expect(screen.getByLabelText("Quantity")).toBeInTheDocument();
    expect(screen.getByLabelText("Unit")).toBeInTheDocument();
    expect(screen.getByLabelText("Save edit")).toBeInTheDocument();
    expect(screen.getByLabelText("Cancel edit")).toBeInTheDocument();
  });

  it("populates edit fields with current values", () => {
    const item: CombinedGroceryItem = {
      name: "flour",
      totalQuantity: 2,
      unit: "cup",
      category: "pantry",
      sourceRecipes: ["Pasta"],
    };

    render(<GroceryItemRow item={item} editable onEdit={vi.fn()} />);

    fireEvent.click(screen.getByLabelText("Edit item"));

    expect(screen.getByLabelText("Item name")).toHaveValue("flour");
    expect(screen.getByLabelText("Quantity")).toHaveValue("2");
    expect(screen.getByLabelText("Unit")).toHaveValue("cup");
  });

  it("populates edit fields with empty values when item has no quantity/unit", () => {
    const item: CombinedGroceryItem = {
      name: "salt",
      category: "spices",
      sourceRecipes: ["Soup"],
    };

    render(<GroceryItemRow item={item} editable onEdit={vi.fn()} />);

    fireEvent.click(screen.getByLabelText("Edit item"));

    expect(screen.getByLabelText("Item name")).toHaveValue("salt");
    expect(screen.getByLabelText("Quantity")).toHaveValue("");
    expect(screen.getByLabelText("Unit")).toHaveValue("");
  });

  it("calls onEdit with updated values when save is clicked", () => {
    const onEdit = vi.fn();
    const item: CombinedGroceryItem = {
      name: "flour",
      totalQuantity: 2,
      unit: "cup",
      category: "pantry",
      sourceRecipes: ["Pasta"],
    };

    render(<GroceryItemRow item={item} editable onEdit={onEdit} />);

    fireEvent.click(screen.getByLabelText("Edit item"));

    fireEvent.change(screen.getByLabelText("Item name"), { target: { value: "whole wheat flour" } });
    fireEvent.change(screen.getByLabelText("Quantity"), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText("Unit"), { target: { value: "lb" } });

    fireEvent.click(screen.getByLabelText("Save edit"));

    expect(onEdit).toHaveBeenCalledWith("flour", {
      name: "whole wheat flour",
      totalQuantity: 3,
      unit: "lb",
    });
  });

  it("saves edit on Enter key", () => {
    const onEdit = vi.fn();
    const item: CombinedGroceryItem = {
      name: "flour",
      totalQuantity: 2,
      unit: "cup",
      category: "pantry",
      sourceRecipes: ["Pasta"],
    };

    render(<GroceryItemRow item={item} editable onEdit={onEdit} />);

    fireEvent.click(screen.getByLabelText("Edit item"));
    fireEvent.change(screen.getByLabelText("Item name"), { target: { value: "rice flour" } });
    fireEvent.keyDown(screen.getByLabelText("Item name"), { key: "Enter" });

    expect(onEdit).toHaveBeenCalledWith("flour", {
      name: "rice flour",
      totalQuantity: 2,
      unit: "cup",
    });
  });

  it("cancels edit on Cancel button click", () => {
    const onEdit = vi.fn();
    const item: CombinedGroceryItem = {
      name: "flour",
      totalQuantity: 2,
      unit: "cup",
      category: "pantry",
      sourceRecipes: ["Pasta"],
    };

    render(<GroceryItemRow item={item} editable onEdit={onEdit} />);

    fireEvent.click(screen.getByLabelText("Edit item"));
    fireEvent.change(screen.getByLabelText("Item name"), { target: { value: "changed" } });
    fireEvent.click(screen.getByLabelText("Cancel edit"));

    // Should be back to display mode, no onEdit call
    expect(onEdit).not.toHaveBeenCalled();
    expect(screen.getByText("2 cups flour")).toBeInTheDocument();
  });

  it("cancels edit on Escape key", () => {
    const onEdit = vi.fn();
    const item: CombinedGroceryItem = {
      name: "flour",
      totalQuantity: 2,
      unit: "cup",
      category: "pantry",
      sourceRecipes: ["Pasta"],
    };

    render(<GroceryItemRow item={item} editable onEdit={onEdit} />);

    fireEvent.click(screen.getByLabelText("Edit item"));
    fireEvent.keyDown(screen.getByLabelText("Item name"), { key: "Escape" });

    expect(onEdit).not.toHaveBeenCalled();
    expect(screen.getByText("2 cups flour")).toBeInTheDocument();
  });

  it("does not call onEdit when name is empty", () => {
    const onEdit = vi.fn();
    const item: CombinedGroceryItem = {
      name: "flour",
      totalQuantity: 2,
      unit: "cup",
      category: "pantry",
      sourceRecipes: ["Pasta"],
    };

    render(<GroceryItemRow item={item} editable onEdit={onEdit} />);

    fireEvent.click(screen.getByLabelText("Edit item"));
    fireEvent.change(screen.getByLabelText("Item name"), { target: { value: "   " } });
    fireEvent.click(screen.getByLabelText("Save edit"));

    expect(onEdit).not.toHaveBeenCalled();
  });

  it("calls onRemove when remove button is clicked", () => {
    const onRemove = vi.fn();
    const item: CombinedGroceryItem = {
      name: "flour",
      totalQuantity: 2,
      unit: "cup",
      category: "pantry",
      sourceRecipes: ["Pasta"],
    };

    render(<GroceryItemRow item={item} editable onRemove={onRemove} />);

    fireEvent.click(screen.getByLabelText("Remove item"));

    expect(onRemove).toHaveBeenCalledWith("flour");
  });

  it("handles save with empty quantity and unit", () => {
    const onEdit = vi.fn();
    const item: CombinedGroceryItem = {
      name: "salt",
      category: "spices",
      sourceRecipes: ["Soup"],
    };

    render(<GroceryItemRow item={item} editable onEdit={onEdit} />);

    fireEvent.click(screen.getByLabelText("Edit item"));
    fireEvent.click(screen.getByLabelText("Save edit"));

    expect(onEdit).toHaveBeenCalledWith("salt", {
      name: "salt",
      totalQuantity: undefined,
      unit: undefined,
    });
  });

  it("handles non-Enter/Escape key presses without action", () => {
    const onEdit = vi.fn();
    const item: CombinedGroceryItem = {
      name: "flour",
      totalQuantity: 2,
      unit: "cup",
      category: "pantry",
      sourceRecipes: ["Pasta"],
    };

    render(<GroceryItemRow item={item} editable onEdit={onEdit} />);

    fireEvent.click(screen.getByLabelText("Edit item"));
    fireEvent.keyDown(screen.getByLabelText("Item name"), { key: "Tab" });

    // Should still be in edit mode
    expect(screen.getByLabelText("Item name")).toBeInTheDocument();
    expect(onEdit).not.toHaveBeenCalled();
  });
});
