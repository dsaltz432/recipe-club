import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@tests/utils";

const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockUpdate = vi.fn();
const mockUpdateEq = vi.fn();
const mockDelete = vi.fn();
const mockDeleteEq = vi.fn();
const mockInsert = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: mockSelect,
      update: mockUpdate,
      delete: mockDelete,
      insert: mockInsert,
    })),
  },
}));

vi.mock("@/lib/parseIngredientText", () => ({
  parseIngredientText: vi.fn(),
}));

vi.mock("@/lib/groceryCache", () => ({
  deleteGroceryCache: vi.fn().mockResolvedValue(undefined),
}));

import RecipeIngredientList from "@/components/recipes/RecipeIngredientList";
import { parseServingsNumber } from "@/lib/recipeScaler";
import { parseIngredientText } from "@/lib/parseIngredientText";
import { deleteGroceryCache } from "@/lib/groceryCache";

const mockParseIngredientText = parseIngredientText as ReturnType<typeof vi.fn>;
const mockDeleteGroceryCache = deleteGroceryCache as ReturnType<typeof vi.fn>;

const mockIngredients = [
  { id: "i1", recipe_id: "recipe-1", name: "flour", quantity: 2, unit: "cups", category: "pantry", sort_order: 0 },
  { id: "i2", recipe_id: "recipe-1", name: "eggs", quantity: 3, unit: null, category: "dairy", sort_order: 1 },
];

function setupLoadIngredients(data = mockIngredients) {
  mockOrder.mockResolvedValue({ data, error: null });
  mockEq.mockReturnValue({ order: mockOrder });
  mockSelect.mockReturnValue({ eq: mockEq });
}

describe("RecipeIngredientList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupLoadIngredients();
  });

  it("shows loading spinner on initial load", () => {
    // Keep order pending briefly
    mockOrder.mockReturnValue(new Promise(() => {}));

    render(<RecipeIngredientList recipeId="recipe-1" userId="user-1" />);

    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("renders grouped ingredients after loading", async () => {
    render(<RecipeIngredientList recipeId="recipe-1" userId="user-1" />);

    await waitFor(() => {
      expect(screen.getByText("Pantry")).toBeInTheDocument();
    });
    expect(screen.getByText("Dairy")).toBeInTheDocument();
  });

  it("shows empty state when no ingredients", async () => {
    setupLoadIngredients([]);

    render(<RecipeIngredientList recipeId="recipe-1" userId="user-1" />);

    await waitFor(() => {
      expect(screen.getByText("No ingredients yet")).toBeInTheDocument();
    });
  });

  it("does not show AddIngredientInput when editable is false", async () => {
    render(<RecipeIngredientList recipeId="recipe-1" userId="user-1" editable={false} />);

    await waitFor(() => {
      expect(screen.getByText("Pantry")).toBeInTheDocument();
    });

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("shows AddIngredientInput when editable is true", async () => {
    render(<RecipeIngredientList recipeId="recipe-1" userId="user-1" editable />);

    await waitFor(() => {
      expect(screen.getByText("Pantry")).toBeInTheDocument();
    });

    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("calls supabase delete when Remove item is clicked (editable)", async () => {
    const onIngredientsChange = vi.fn();

    mockDeleteEq.mockResolvedValue({ error: null });
    mockDelete.mockReturnValue({ eq: mockDeleteEq });

    render(
      <RecipeIngredientList
        recipeId="recipe-1"
        userId="user-1"
        editable
        onIngredientsChange={onIngredientsChange}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Pantry")).toBeInTheDocument();
    });

    const removeButtons = screen.getAllByLabelText("Remove item");
    fireEvent.click(removeButtons[0]);

    await waitFor(() => {
      // dairy ("eggs", i2) comes before pantry ("flour", i1) in category order
      expect(mockDeleteEq).toHaveBeenCalledWith("id", "i2");
    });
    expect(onIngredientsChange).toHaveBeenCalled();
  });

  it("calls parseIngredientText and inserts when Add is clicked", async () => {
    mockParseIngredientText.mockResolvedValue([
      { name: "butter", quantity: 1, unit: "cup", category: "dairy" },
    ]);
    mockInsert.mockResolvedValue({ error: null });

    render(<RecipeIngredientList recipeId="recipe-1" userId="user-1" editable />);

    await waitFor(() => {
      expect(screen.getByText("Pantry")).toBeInTheDocument();
    });

    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "1 cup butter" } });
    fireEvent.click(screen.getByRole("button", { name: /Add/ }));

    await waitFor(() => {
      expect(mockParseIngredientText).toHaveBeenCalledWith("1 cup butter", "user-1");
      expect(mockInsert).toHaveBeenCalled();
    });
  });

  it("calls supabase update when Edit item text is saved (editable)", async () => {
    const onIngredientsChange = vi.fn();

    mockUpdateEq.mockResolvedValue({ error: null });
    mockUpdate.mockReturnValue({ eq: mockUpdateEq });

    render(
      <RecipeIngredientList
        recipeId="recipe-1"
        userId="user-1"
        editable
        onIngredientsChange={onIngredientsChange}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Pantry")).toBeInTheDocument();
    });

    // Click "Edit item" for first ingredient (dairy comes before pantry)
    const editButtons = screen.getAllByLabelText("Edit item");
    fireEvent.click(editButtons[0]);

    // Edit text input appears
    const editInput = screen.getByLabelText("Edit item text");
    fireEvent.change(editInput, { target: { value: "updated eggs" } });

    fireEvent.click(screen.getByLabelText("Save edit"));

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith({ name: "updated eggs", quantity: null, unit: null });
      expect(mockUpdateEq).toHaveBeenCalledWith("id", "i2");
    });
    expect(onIngredientsChange).toHaveBeenCalled();
  });

  it("handles load error gracefully (shows empty state)", async () => {
    mockOrder.mockResolvedValue({ data: null, error: { message: "DB error" } });
    mockEq.mockReturnValue({ order: mockOrder });
    mockSelect.mockReturnValue({ eq: mockEq });

    render(<RecipeIngredientList recipeId="recipe-1" userId="user-1" />);

    await waitFor(() => {
      expect(screen.getByText("No ingredients yet")).toBeInTheDocument();
    });
  });

  it("maps ingredient with null quantity, category, and sort_order", async () => {
    const nullFieldsIngredients = [
      { id: "i3", recipe_id: "recipe-1", name: "chicken", quantity: null, unit: null, category: null, sort_order: null },
    ];
    mockOrder.mockResolvedValue({ data: nullFieldsIngredients, error: null });
    mockEq.mockReturnValue({ order: mockOrder });
    mockSelect.mockReturnValue({ eq: mockEq });

    render(<RecipeIngredientList recipeId="recipe-1" userId="user-1" />);

    await waitFor(() => {
      // category null → falls back to "other"
      expect(screen.getByText("Other")).toBeInTheDocument();
    });
    expect(screen.getByText("chicken")).toBeInTheDocument();
  });

  it("does not call update when Cancel edit is clicked", async () => {
    const onIngredientsChange = vi.fn();

    mockUpdateEq.mockResolvedValue({ error: null });
    mockUpdate.mockReturnValue({ eq: mockUpdateEq });

    render(
      <RecipeIngredientList
        recipeId="recipe-1"
        userId="user-1"
        editable
        onIngredientsChange={onIngredientsChange}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Pantry")).toBeInTheDocument();
    });

    const editButtons = screen.getAllByLabelText("Edit item");
    fireEvent.click(editButtons[0]);

    const editInput = screen.getByLabelText("Edit item text");
    fireEvent.change(editInput, { target: { value: "changed eggs" } });

    // Cancel instead of saving
    fireEvent.click(screen.getByLabelText("Cancel edit"));

    // Update should NOT have been called since we cancelled
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(onIngredientsChange).not.toHaveBeenCalled();
  });

  it("does not insert when parseIngredientText returns empty array", async () => {
    mockParseIngredientText.mockResolvedValue([]);
    mockInsert.mockResolvedValue({ error: null });

    render(<RecipeIngredientList recipeId="recipe-1" userId="user-1" editable />);

    await waitFor(() => {
      expect(screen.getByText("Pantry")).toBeInTheDocument();
    });

    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "unknown ingredient" } });
    fireEvent.click(screen.getByRole("button", { name: /Add/ }));

    await waitFor(() => {
      expect(mockParseIngredientText).toHaveBeenCalledWith("unknown ingredient", "user-1");
    });
    // insert should NOT be called when parsed is empty
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("inserts with null quantity and unit when parsed item has no quantity or unit", async () => {
    mockParseIngredientText.mockResolvedValue([
      { name: "salt", quantity: null, unit: null, category: "pantry" },
    ]);
    mockInsert.mockResolvedValue({ error: null });

    render(<RecipeIngredientList recipeId="recipe-1" userId="user-1" editable />);

    await waitFor(() => {
      expect(screen.getByText("Pantry")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "salt" } });
    fireEvent.click(screen.getByRole("button", { name: /Add/ }));

    await waitFor(() => {
      expect(mockInsert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ name: "salt", quantity: null, unit: null }),
        ])
      );
    });
  });

  it("calls deleteGroceryCache when cacheContext is provided and Add is clicked", async () => {
    mockParseIngredientText.mockResolvedValue([
      { name: "sugar", quantity: 1, unit: "cup", category: "pantry" },
    ]);
    mockInsert.mockResolvedValue({ error: null });
    mockDeleteGroceryCache.mockClear();

    render(
      <RecipeIngredientList
        recipeId="recipe-1"
        userId="user-1"
        editable
        cacheContext={{ type: "event", id: "event-1", userId: "user-1" }}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Pantry")).toBeInTheDocument();
    });

    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "1 cup sugar" } });
    fireEvent.click(screen.getByRole("button", { name: /Add/ }));

    await waitFor(() => {
      expect(mockDeleteGroceryCache).toHaveBeenCalledWith("event", "event-1", "user-1");
    });
  });
});

describe("parseServingsNumber", () => {
  it("parses a plain integer", () => {
    expect(parseServingsNumber("4")).toBe(4);
  });

  it("parses a range like '4-6'", () => {
    expect(parseServingsNumber("4-6")).toBe(4);
  });

  it("parses 'Serves 6 people'", () => {
    expect(parseServingsNumber("Serves 6 people")).toBe(6);
  });

  it("parses a decimal like '2.5 servings'", () => {
    expect(parseServingsNumber("2.5 servings")).toBe(2.5);
  });

  it("returns null for non-numeric string", () => {
    expect(parseServingsNumber("a few")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseServingsNumber("")).toBeNull();
  });
});

describe("RecipeIngredientList serving scaler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupLoadIngredients();
  });

  it("shows scale buttons when not editable and ingredients exist", async () => {
    render(<RecipeIngredientList recipeId="recipe-1" userId="user-1" editable={false} />);

    await waitFor(() => expect(screen.getByText("Pantry")).toBeInTheDocument());

    expect(screen.getByRole("group", { name: /serving scale/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1×" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "2×" })).toBeInTheDocument();
  });

  it("does not show scale buttons in editable mode", async () => {
    render(<RecipeIngredientList recipeId="recipe-1" userId="user-1" editable />);

    await waitFor(() => expect(screen.getByText("Pantry")).toBeInTheDocument());

    expect(screen.queryByRole("group", { name: /serving scale/i })).not.toBeInTheDocument();
  });

  it("1× button is selected by default", async () => {
    render(<RecipeIngredientList recipeId="recipe-1" userId="user-1" editable={false} />);

    await waitFor(() => expect(screen.getByText("Pantry")).toBeInTheDocument());

    const btn1x = screen.getByRole("button", { name: "1×" });
    expect(btn1x).toHaveAttribute("aria-pressed", "true");
  });

  it("scales ingredient quantities when 2× is clicked", async () => {
    render(<RecipeIngredientList recipeId="recipe-1" userId="user-1" editable={false} />);

    await waitFor(() => expect(screen.getByText("Pantry")).toBeInTheDocument());

    // flour starts at quantity=2, so 2× should show 4
    fireEvent.click(screen.getByRole("button", { name: "2×" }));

    await waitFor(() => expect(screen.getByText("4 cups flour")).toBeInTheDocument());
  });

  it("shows scaled servings count when servings prop is provided and scale != 1×", async () => {
    render(
      <RecipeIngredientList
        recipeId="recipe-1"
        userId="user-1"
        editable={false}
        servings="4 servings"
      />
    );

    await waitFor(() => expect(screen.getByText("Pantry")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "2×" }));

    await waitFor(() => expect(screen.getByText(/→ 8 serving/)).toBeInTheDocument());
  });

  it("does not show scaled servings when scale is 1×", async () => {
    render(
      <RecipeIngredientList
        recipeId="recipe-1"
        userId="user-1"
        editable={false}
        servings="4 servings"
      />
    );

    await waitFor(() => expect(screen.getByText("Pantry")).toBeInTheDocument());

    // Default is 1× — no "→ X servings" label
    expect(screen.queryByText(/→/)).not.toBeInTheDocument();
  });

  it("halves quantities when ½× is clicked", async () => {
    render(<RecipeIngredientList recipeId="recipe-1" userId="user-1" editable={false} />);

    await waitFor(() => expect(screen.getByText("Pantry")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "½×" }));

    // flour quantity=2, ½× → 1 (unit stays "cups" since pluralizeUnit only pluralizes, not singularizes)
    await waitFor(() => expect(screen.getByText("1 cups flour")).toBeInTheDocument());
  });
});
