import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@tests/utils";
import { GROCERY_CATEGORIES } from "@/lib/groceryList";
import { CATEGORY_ORDER } from "@/lib/groceryList";

// Mock the Radix Select to be testable in jsdom
vi.mock("@/components/ui/select", () => ({
  Select: ({ value, onValueChange, children }: { value: string; onValueChange: (val: string) => void; children: React.ReactNode }) => (
    <div data-testid="select-wrapper" data-value={value}>
      {children}
      <select
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        data-testid="hidden-select"
      >
        {CATEGORY_ORDER.map((cat: string) => (
          <option key={cat} value={cat}>{GROCERY_CATEGORIES[cat as keyof typeof GROCERY_CATEGORIES]}</option>
        ))}
      </select>
    </div>
  ),
  SelectTrigger: ({ children, ...props }: { children: React.ReactNode; "aria-label"?: string }) => (
    <div {...props}>{children}</div>
  ),
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <div data-value={value}>{children}</div>
  ),
}));

// Mock supabase client (imported transitively by groceryList)
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

import IngredientFormRows from "@/components/recipes/IngredientFormRows";
import { createBlankRow, type IngredientRow } from "@/components/recipes/ingredientRowTypes";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const mockInvoke = supabase.functions.invoke as ReturnType<typeof vi.fn>;

const makeRow = (overrides: Partial<IngredientRow> = {}): IngredientRow => ({
  id: "row-1",
  quantity: "",
  unit: "",
  name: "",
  category: "other",
  ...overrides,
});

describe("IngredientFormRows", () => {
  let onRowsChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    onRowsChange = vi.fn();
  });

  it("renders header labels", () => {
    render(<IngredientFormRows rows={[]} onRowsChange={onRowsChange} />);

    expect(screen.getByText("Qty")).toBeInTheDocument();
    expect(screen.getByText("Unit")).toBeInTheDocument();
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Category")).toBeInTheDocument();
  });

  it("renders Add Ingredient button", () => {
    render(<IngredientFormRows rows={[]} onRowsChange={onRowsChange} />);

    expect(screen.getByRole("button", { name: "Add Ingredient" })).toBeInTheDocument();
  });

  it("renders rows with inputs", () => {
    const rows = [
      makeRow({ id: "r1", quantity: "2", unit: "cup", name: "flour", category: "pantry" }),
    ];

    render(<IngredientFormRows rows={rows} onRowsChange={onRowsChange} />);

    expect(screen.getByLabelText("Quantity for row 1")).toHaveValue("2");
    expect(screen.getByLabelText("Unit for row 1")).toHaveValue("cup");
    expect(screen.getByLabelText("Name for row 1")).toHaveValue("flour");
  });

  it("renders multiple rows", () => {
    const rows = [
      makeRow({ id: "r1", name: "flour" }),
      makeRow({ id: "r2", name: "sugar" }),
    ];

    render(<IngredientFormRows rows={rows} onRowsChange={onRowsChange} />);

    expect(screen.getByLabelText("Name for row 1")).toHaveValue("flour");
    expect(screen.getByLabelText("Name for row 2")).toHaveValue("sugar");
  });

  it("calls onRowsChange when quantity changes", () => {
    const rows = [makeRow({ id: "r1" })];

    render(<IngredientFormRows rows={rows} onRowsChange={onRowsChange} />);

    fireEvent.change(screen.getByLabelText("Quantity for row 1"), {
      target: { value: "3" },
    });

    expect(onRowsChange).toHaveBeenCalledWith([
      expect.objectContaining({ id: "r1", quantity: "3" }),
    ]);
  });

  it("calls onRowsChange when unit changes", () => {
    const rows = [makeRow({ id: "r1" })];

    render(<IngredientFormRows rows={rows} onRowsChange={onRowsChange} />);

    fireEvent.change(screen.getByLabelText("Unit for row 1"), {
      target: { value: "tbsp" },
    });

    expect(onRowsChange).toHaveBeenCalledWith([
      expect.objectContaining({ id: "r1", unit: "tbsp" }),
    ]);
  });

  it("calls onRowsChange when name changes and auto-detects category", () => {
    const rows = [makeRow({ id: "r1" })];

    render(<IngredientFormRows rows={rows} onRowsChange={onRowsChange} />);

    fireEvent.change(screen.getByLabelText("Name for row 1"), {
      target: { value: "olive oil" },
    });

    expect(onRowsChange).toHaveBeenCalledWith([
      expect.objectContaining({ id: "r1", name: "olive oil", category: "pantry" }),
    ]);
  });

  it("keeps category as other for unknown ingredients", () => {
    const rows = [makeRow({ id: "r1" })];

    render(<IngredientFormRows rows={rows} onRowsChange={onRowsChange} />);

    fireEvent.change(screen.getByLabelText("Name for row 1"), {
      target: { value: "dragon fruit" },
    });

    expect(onRowsChange).toHaveBeenCalledWith([
      expect.objectContaining({ id: "r1", name: "dragon fruit", category: "other" }),
    ]);
  });

  it("does not auto-detect category when name is cleared", () => {
    const rows = [makeRow({ id: "r1", name: "olive oil", category: "pantry" })];

    render(<IngredientFormRows rows={rows} onRowsChange={onRowsChange} />);

    fireEvent.change(screen.getByLabelText("Name for row 1"), {
      target: { value: "" },
    });

    // Empty name: don't auto-detect, keep the existing category untouched
    expect(onRowsChange).toHaveBeenCalledWith([
      expect.objectContaining({ id: "r1", name: "", category: "pantry" }),
    ]);
  });

  it("removes a row when remove button is clicked", () => {
    const rows = [
      makeRow({ id: "r1", name: "flour" }),
      makeRow({ id: "r2", name: "sugar" }),
    ];

    render(<IngredientFormRows rows={rows} onRowsChange={onRowsChange} />);

    fireEvent.click(screen.getByLabelText("Remove row 1"));

    expect(onRowsChange).toHaveBeenCalledWith([
      expect.objectContaining({ id: "r2", name: "sugar" }),
    ]);
  });

  it("adds a blank row when Add Ingredient is clicked", () => {
    const rows = [makeRow({ id: "r1" })];

    render(<IngredientFormRows rows={rows} onRowsChange={onRowsChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Add Ingredient" }));

    expect(onRowsChange).toHaveBeenCalledWith([
      expect.objectContaining({ id: "r1" }),
      expect.objectContaining({ quantity: "", unit: "", name: "", category: "other" }),
    ]);
  });

  it("adds a row on Enter in last row name input", () => {
    const rows = [makeRow({ id: "r1" })];

    render(<IngredientFormRows rows={rows} onRowsChange={onRowsChange} />);

    fireEvent.keyDown(screen.getByLabelText("Name for row 1"), { key: "Enter" });

    expect(onRowsChange).toHaveBeenCalledWith([
      expect.objectContaining({ id: "r1" }),
      expect.objectContaining({ quantity: "", unit: "", name: "" }),
    ]);
  });

  it("does not add a row on Enter in non-last row", () => {
    const rows = [
      makeRow({ id: "r1" }),
      makeRow({ id: "r2" }),
    ];

    render(<IngredientFormRows rows={rows} onRowsChange={onRowsChange} />);

    fireEvent.keyDown(screen.getByLabelText("Name for row 1"), { key: "Enter" });

    expect(onRowsChange).not.toHaveBeenCalled();
  });

  it("does not add a row on non-Enter key in last row", () => {
    const rows = [makeRow({ id: "r1" })];

    render(<IngredientFormRows rows={rows} onRowsChange={onRowsChange} />);

    fireEvent.keyDown(screen.getByLabelText("Name for row 1"), { key: "Tab" });

    expect(onRowsChange).not.toHaveBeenCalled();
  });

  it("renders remove button for each row", () => {
    const rows = [
      makeRow({ id: "r1" }),
      makeRow({ id: "r2" }),
      makeRow({ id: "r3" }),
    ];

    render(<IngredientFormRows rows={rows} onRowsChange={onRowsChange} />);

    expect(screen.getByLabelText("Remove row 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Remove row 2")).toBeInTheDocument();
    expect(screen.getByLabelText("Remove row 3")).toBeInTheDocument();
  });

  it("renders empty state with just header and add button", () => {
    render(<IngredientFormRows rows={[]} onRowsChange={onRowsChange} />);

    expect(screen.getByText("Qty")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add Ingredient" })).toBeInTheDocument();
    expect(screen.queryByLabelText(/Quantity for row/)).not.toBeInTheDocument();
  });

  it("preserves other rows when updating one row", () => {
    const rows = [
      makeRow({ id: "r1", name: "flour" }),
      makeRow({ id: "r2", name: "sugar" }),
    ];

    render(<IngredientFormRows rows={rows} onRowsChange={onRowsChange} />);

    fireEvent.change(screen.getByLabelText("Quantity for row 1"), {
      target: { value: "3" },
    });

    expect(onRowsChange).toHaveBeenCalledWith([
      expect.objectContaining({ id: "r1", quantity: "3", name: "flour" }),
      expect.objectContaining({ id: "r2", name: "sugar" }),
    ]);
  });

  it("calls onRowsChange when category is changed via select", () => {
    const rows = [makeRow({ id: "r1", name: "chicken", category: "other" })];

    render(<IngredientFormRows rows={rows} onRowsChange={onRowsChange} />);

    // Change category via the mocked select
    const selects = screen.getAllByTestId("hidden-select");
    fireEvent.change(selects[0], { target: { value: "meat_seafood" } });

    expect(onRowsChange).toHaveBeenCalledWith([
      expect.objectContaining({ id: "r1", category: "meat_seafood" }),
    ]);
  });
});

describe("Paste ingredients", () => {
  let onRowsChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    onRowsChange = vi.fn();
  });

  it("renders Add ingredients button", () => {
    render(<IngredientFormRows rows={[]} onRowsChange={onRowsChange} />);
    expect(screen.getByRole("button", { name: "Add ingredients" })).toBeInTheDocument();
  });

  it("shows textarea when Add ingredients is clicked", () => {
    render(<IngredientFormRows rows={[]} onRowsChange={onRowsChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Add ingredients" }));
    expect(screen.getByLabelText("Paste ingredients text")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });

  it("disables Add ingredients button when textarea is open", () => {
    render(<IngredientFormRows rows={[]} onRowsChange={onRowsChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Add ingredients" }));
    expect(screen.getByRole("button", { name: "Add ingredients" })).toBeDisabled();
  });

  it("disables Add button when textarea is empty", () => {
    render(<IngredientFormRows rows={[]} onRowsChange={onRowsChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Add ingredients" }));
    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
  });

  it("enables Add button when textarea has text", () => {
    render(<IngredientFormRows rows={[]} onRowsChange={onRowsChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Add ingredients" }));
    fireEvent.change(screen.getByLabelText("Paste ingredients text"), {
      target: { value: "2 cups flour, 1 lb chicken" },
    });
    expect(screen.getByRole("button", { name: "Add" })).not.toBeDisabled();
  });

  it("appends parsed items as new rows on successful parse", async () => {
    mockInvoke.mockResolvedValueOnce({
      data: {
        success: true,
        ingredientCount: 2,
        parsed: {
          ingredients: [
            { name: "flour", quantity: 2, unit: "cups", category: "pantry" },
            { name: "chicken", quantity: 1, unit: "lb", category: "meat_seafood" },
          ],
        },
      },
      error: null,
    });

    const existingRows = [makeRow({ id: "r1", name: "sugar" })];
    render(<IngredientFormRows rows={existingRows} onRowsChange={onRowsChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Add ingredients" }));
    fireEvent.change(screen.getByLabelText("Paste ingredients text"), {
      target: { value: "2 cups flour, 1 lb chicken" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    await vi.waitFor(() => {
      expect(onRowsChange).toHaveBeenCalledWith([
        expect.objectContaining({ id: "r1", name: "sugar" }),
        expect.objectContaining({ name: "flour", quantity: "2", unit: "cups", category: "pantry" }),
        expect.objectContaining({ name: "chicken", quantity: "1", unit: "lb", category: "meat_seafood" }),
      ]);
    });
  });

  it("handles items with null quantity and unit", async () => {
    mockInvoke.mockResolvedValueOnce({
      data: {
        success: true,
        ingredientCount: 1,
        parsed: {
          ingredients: [
            { name: "olive oil", quantity: null, unit: null, category: "pantry" },
          ],
        },
      },
      error: null,
    });

    render(<IngredientFormRows rows={[]} onRowsChange={onRowsChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Add ingredients" }));
    fireEvent.change(screen.getByLabelText("Paste ingredients text"), {
      target: { value: "olive oil" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    await vi.waitFor(() => {
      expect(onRowsChange).toHaveBeenCalledWith([
        expect.objectContaining({ name: "olive oil", quantity: "", unit: "", category: "pantry" }),
      ]);
    });
  });

  it("shows toast error on parse failure", async () => {
    mockInvoke.mockResolvedValueOnce({
      data: null,
      error: new Error("Network error"),
    });

    render(<IngredientFormRows rows={[]} onRowsChange={onRowsChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Add ingredients" }));
    fireEvent.change(screen.getByLabelText("Paste ingredients text"), {
      target: { value: "flour, sugar" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    await vi.waitFor(() => {
      expect(onRowsChange).not.toHaveBeenCalled();
    });
  });

  it("shows toast error when success is false", async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { success: false, error: "Parse failed" },
      error: null,
    });

    render(<IngredientFormRows rows={[]} onRowsChange={onRowsChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Add ingredients" }));
    fireEvent.change(screen.getByLabelText("Paste ingredients text"), {
      target: { value: "flour" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    await vi.waitFor(() => {
      expect(onRowsChange).not.toHaveBeenCalled();
    });
  });

  it("closes textarea when Cancel is clicked", () => {
    render(<IngredientFormRows rows={[]} onRowsChange={onRowsChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Add ingredients" }));
    expect(screen.getByLabelText("Paste ingredients text")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByLabelText("Paste ingredients text")).not.toBeInTheDocument();
  });

  it("closes textarea after successful parse", async () => {
    mockInvoke.mockResolvedValueOnce({
      data: {
        success: true,
        ingredientCount: 1,
        parsed: {
          ingredients: [{ name: "flour", quantity: 2, unit: "cups", category: "pantry" }],
        },
      },
      error: null,
    });

    render(<IngredientFormRows rows={[]} onRowsChange={onRowsChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Add ingredients" }));
    fireEvent.change(screen.getByLabelText("Paste ingredients text"), {
      target: { value: "flour" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    await vi.waitFor(() => {
      expect(screen.queryByLabelText("Paste ingredients text")).not.toBeInTheDocument();
    });
  });

  it("defaults invalid category to other", async () => {
    mockInvoke.mockResolvedValueOnce({
      data: {
        success: true,
        ingredientCount: 1,
        parsed: {
          ingredients: [{ name: "mystery item", quantity: 1, unit: null, category: "invalid_category" }],
        },
      },
      error: null,
    });

    render(<IngredientFormRows rows={[]} onRowsChange={onRowsChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Add ingredients" }));
    fireEvent.change(screen.getByLabelText("Paste ingredients text"), {
      target: { value: "mystery item" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    await vi.waitFor(() => {
      expect(onRowsChange).toHaveBeenCalledWith([
        expect.objectContaining({ name: "mystery item", category: "other" }),
      ]);
    });
  });

  it("shows dev mode error toast when data.skipped is true", async () => {
    mockInvoke.mockResolvedValue({ data: { success: true, skipped: true }, error: null });

    render(<IngredientFormRows rows={[]} onRowsChange={onRowsChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Add ingredients" }));
    fireEvent.change(screen.getByLabelText("Paste ingredients text"), {
      target: { value: "some ingredient" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    await vi.waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
        "Ingredient parsing is not available in dev mode."
      );
    });
    expect(onRowsChange).not.toHaveBeenCalled();
  });
});

describe("createBlankRow", () => {
  it("returns a row with empty values and 'other' category", () => {
    const row = createBlankRow();
    expect(row.quantity).toBe("");
    expect(row.unit).toBe("");
    expect(row.name).toBe("");
    expect(row.category).toBe("other");
  });

  it("returns unique ids", () => {
    const row1 = createBlankRow();
    const row2 = createBlankRow();
    expect(row1.id).not.toBe(row2.id);
  });
});
