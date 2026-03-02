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

import GroceryItemRow from "@/components/recipes/GroceryItemRow";

describe("GroceryItemRow", () => {
  it("renders item with quantity, unit, and name", () => {
    const item: SmartGroceryItem = {
      name: "flour",
      displayName: "flour",
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
    const item: SmartGroceryItem = {
      name: "salt",
      displayName: "salt",
      category: "spices",
      sourceRecipes: ["Soup"],
    };

    render(<GroceryItemRow item={item} />);

    expect(screen.getByText("salt")).toBeInTheDocument();
    expect(screen.getByText("Soup")).toBeInTheDocument();
  });

  it("renders multiple source recipe badges", () => {
    const item: SmartGroceryItem = {
      name: "onion",
      displayName: "onions",
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
      displayName: "broccoli",
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
    const item: SmartGroceryItem = {
      name: "flour",
      displayName: "flour",
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
    const item: SmartGroceryItem = {
      name: "flour",
      displayName: "flour",
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
    const item: SmartGroceryItem = {
      name: "flour",
      displayName: "flour",
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
    const item: SmartGroceryItem = {
      name: "flour",
      displayName: "flour",
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
    const item: SmartGroceryItem = {
      name: "salt",
      displayName: "salt",
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
    const item: SmartGroceryItem = {
      name: "flour",
      displayName: "flour",
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
    const item: SmartGroceryItem = {
      name: "flour",
      displayName: "flour",
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
    const item: SmartGroceryItem = {
      name: "flour",
      displayName: "flour",
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
    const item: SmartGroceryItem = {
      name: "flour",
      displayName: "flour",
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
    const item: SmartGroceryItem = {
      name: "flour",
      displayName: "flour",
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
    const item: SmartGroceryItem = {
      name: "flour",
      displayName: "flour",
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
    const item: SmartGroceryItem = {
      name: "salt",
      displayName: "salt",
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
    const item: SmartGroceryItem = {
      name: "flour",
      displayName: "flour",
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

  // ---- Cross-off / checked state tests ----

  it("renders checkbox when onToggleChecked is provided", () => {
    const item: SmartGroceryItem = {
      name: "flour",
      displayName: "flour",
      totalQuantity: 2,
      unit: "cup",
      category: "pantry",
      sourceRecipes: ["Pasta"],
    };

    render(<GroceryItemRow item={item} onToggleChecked={vi.fn()} />);

    expect(screen.getByLabelText("Check item")).toBeInTheDocument();
  });

  it("does not render checkbox when onToggleChecked is not provided", () => {
    const item: SmartGroceryItem = {
      name: "flour",
      displayName: "flour",
      totalQuantity: 2,
      unit: "cup",
      category: "pantry",
      sourceRecipes: ["Pasta"],
    };

    render(<GroceryItemRow item={item} />);

    expect(screen.queryByLabelText("Check item")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Uncheck item")).not.toBeInTheDocument();
  });

  it("shows line-through styling when isChecked is true", () => {
    const item: SmartGroceryItem = {
      name: "flour",
      displayName: "flour",
      totalQuantity: 2,
      unit: "cup",
      category: "pantry",
      sourceRecipes: ["Pasta"],
    };

    render(<GroceryItemRow item={item} isChecked onToggleChecked={vi.fn()} />);

    const textSpan = screen.getByText("2 cups flour");
    expect(textSpan.className).toContain("line-through");
    expect(textSpan.className).toContain("opacity-50");
  });

  it("does not show line-through styling when isChecked is false", () => {
    const item: SmartGroceryItem = {
      name: "flour",
      displayName: "flour",
      totalQuantity: 2,
      unit: "cup",
      category: "pantry",
      sourceRecipes: ["Pasta"],
    };

    render(<GroceryItemRow item={item} isChecked={false} onToggleChecked={vi.fn()} />);

    const textSpan = screen.getByText("2 cups flour");
    expect(textSpan.className).not.toContain("line-through");
  });

  it("calls onToggleChecked when checkbox is clicked", () => {
    const onToggleChecked = vi.fn();
    const item: SmartGroceryItem = {
      name: "flour",
      displayName: "flour",
      totalQuantity: 2,
      unit: "cup",
      category: "pantry",
      sourceRecipes: ["Pasta"],
    };

    render(<GroceryItemRow item={item} onToggleChecked={onToggleChecked} />);

    fireEvent.click(screen.getByLabelText("Check item"));

    expect(onToggleChecked).toHaveBeenCalledTimes(1);
  });

  it("shows Uncheck item label when item is checked", () => {
    const item: SmartGroceryItem = {
      name: "flour",
      displayName: "flour",
      totalQuantity: 2,
      unit: "cup",
      category: "pantry",
      sourceRecipes: ["Pasta"],
    };

    render(<GroceryItemRow item={item} isChecked onToggleChecked={vi.fn()} />);

    expect(screen.getByLabelText("Uncheck item")).toBeInTheDocument();
  });

  // ---- Single-field edit mode tests ----

  it("shows edit/remove buttons when onEditText is provided (without editable)", () => {
    const item: SmartGroceryItem = {
      name: "flour",
      displayName: "flour",
      totalQuantity: 2,
      unit: "cup",
      category: "pantry",
      sourceRecipes: ["Pasta"],
    };

    render(<GroceryItemRow item={item} onEditText={vi.fn()} onRemove={vi.fn()} />);

    expect(screen.getByLabelText("Edit item")).toBeInTheDocument();
    expect(screen.getByLabelText("Remove item")).toBeInTheDocument();
  });

  it("shows only remove button when only onRemove is provided", () => {
    const item: SmartGroceryItem = {
      name: "flour",
      displayName: "flour",
      totalQuantity: 2,
      unit: "cup",
      category: "pantry",
      sourceRecipes: ["Pasta"],
    };

    render(<GroceryItemRow item={item} onRemove={vi.fn()} />);

    expect(screen.queryByLabelText("Edit item")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Remove item")).toBeInTheDocument();
  });

  it("uses single text field in edit mode when onEditText is provided", () => {
    const item: SmartGroceryItem = {
      name: "flour",
      displayName: "flour",
      totalQuantity: 2,
      unit: "cup",
      category: "pantry",
      sourceRecipes: ["Pasta"],
    };

    render(<GroceryItemRow item={item} onEditText={vi.fn()} />);

    fireEvent.click(screen.getByLabelText("Edit item"));

    expect(screen.getByLabelText("Edit item text")).toBeInTheDocument();
    expect(screen.queryByLabelText("Item name")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Quantity")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Unit")).not.toBeInTheDocument();
  });

  it("pre-fills single-field edit with formatted item text", () => {
    const item: SmartGroceryItem = {
      name: "flour",
      displayName: "flour",
      totalQuantity: 2,
      unit: "cup",
      category: "pantry",
      sourceRecipes: ["Pasta"],
    };

    render(<GroceryItemRow item={item} onEditText={vi.fn()} />);

    fireEvent.click(screen.getByLabelText("Edit item"));

    expect(screen.getByLabelText("Edit item text")).toHaveValue("2 cups flour");
  });

  it("calls onEditText with original name and new text when saved", () => {
    const onEditText = vi.fn();
    const item: SmartGroceryItem = {
      name: "flour",
      displayName: "flour",
      totalQuantity: 2,
      unit: "cup",
      category: "pantry",
      sourceRecipes: ["Pasta"],
    };

    render(<GroceryItemRow item={item} onEditText={onEditText} />);

    fireEvent.click(screen.getByLabelText("Edit item"));
    fireEvent.change(screen.getByLabelText("Edit item text"), { target: { value: "3 cups whole wheat flour" } });
    fireEvent.click(screen.getByLabelText("Save edit"));

    expect(onEditText).toHaveBeenCalledWith("flour", "3 cups whole wheat flour");
  });

  it("saves single-field edit on Enter key", () => {
    const onEditText = vi.fn();
    const item: SmartGroceryItem = {
      name: "flour",
      displayName: "flour",
      totalQuantity: 2,
      unit: "cup",
      category: "pantry",
      sourceRecipes: ["Pasta"],
    };

    render(<GroceryItemRow item={item} onEditText={onEditText} />);

    fireEvent.click(screen.getByLabelText("Edit item"));
    fireEvent.change(screen.getByLabelText("Edit item text"), { target: { value: "5 tbsp olive oil" } });
    fireEvent.keyDown(screen.getByLabelText("Edit item text"), { key: "Enter" });

    expect(onEditText).toHaveBeenCalledWith("flour", "5 tbsp olive oil");
  });

  it("cancels single-field edit on Escape key", () => {
    const onEditText = vi.fn();
    const item: SmartGroceryItem = {
      name: "flour",
      displayName: "flour",
      totalQuantity: 2,
      unit: "cup",
      category: "pantry",
      sourceRecipes: ["Pasta"],
    };

    render(<GroceryItemRow item={item} onEditText={onEditText} />);

    fireEvent.click(screen.getByLabelText("Edit item"));
    fireEvent.change(screen.getByLabelText("Edit item text"), { target: { value: "changed" } });
    fireEvent.keyDown(screen.getByLabelText("Edit item text"), { key: "Escape" });

    expect(onEditText).not.toHaveBeenCalled();
    expect(screen.getByText("2 cups flour")).toBeInTheDocument();
  });

  it("does not call onEditText when text is empty", () => {
    const onEditText = vi.fn();
    const item: SmartGroceryItem = {
      name: "flour",
      displayName: "flour",
      totalQuantity: 2,
      unit: "cup",
      category: "pantry",
      sourceRecipes: ["Pasta"],
    };

    render(<GroceryItemRow item={item} onEditText={onEditText} />);

    fireEvent.click(screen.getByLabelText("Edit item"));
    fireEvent.change(screen.getByLabelText("Edit item text"), { target: { value: "   " } });
    fireEvent.click(screen.getByLabelText("Save edit"));

    expect(onEditText).not.toHaveBeenCalled();
  });
});
