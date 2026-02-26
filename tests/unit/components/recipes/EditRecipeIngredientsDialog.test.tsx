import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@tests/utils";
import { toast } from "sonner";
import type { RecipeIngredient } from "@/types";

// Mock supabase
const mockRpc = vi.fn();
const mockDelete = vi.fn();
const mockDeleteEq = vi.fn().mockReturnThis();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    functions: {
      invoke: vi.fn().mockResolvedValue({ error: null }),
    },
    from: () => ({
      delete: () => {
        mockDelete();
        return {
          eq: (...args: unknown[]) => {
            mockDeleteEq(...args);
            return { eq: (...args2: unknown[]) => mockDeleteEq(...args2) };
          },
        };
      },
    }),
  },
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

import EditRecipeIngredientsDialog from "@/components/recipes/EditRecipeIngredientsDialog";

const createIngredient = (overrides: Partial<RecipeIngredient> = {}): RecipeIngredient => ({
  id: "ing-1",
  recipeId: "recipe-1",
  name: "Chicken breast",
  quantity: 2,
  unit: "lb",
  category: "meat_seafood",
  sortOrder: 0,
  ...overrides,
});

describe("EditRecipeIngredientsDialog", () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    recipeId: "recipe-1",
    recipeName: "Test Recipe",
    ingredients: [
      createIngredient({ id: "ing-1", name: "Chicken breast", quantity: 2, unit: "lb" }),
      createIngredient({ id: "ing-2", name: "Olive oil", quantity: 1, unit: "tbsp", category: "pantry" }),
    ],
    onSaved: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc.mockResolvedValue({ error: null });
  });

  it("renders dialog with title and description", () => {
    render(<EditRecipeIngredientsDialog {...defaultProps} />);

    expect(screen.getByText("Edit Ingredients")).toBeInTheDocument();
    expect(screen.getByText(/Edit ingredients for "Test Recipe"/)).toBeInTheDocument();
  });

  it("renders existing ingredients as form rows", () => {
    render(<EditRecipeIngredientsDialog {...defaultProps} />);

    expect(screen.getByLabelText("Name for row 1")).toHaveValue("Chicken breast");
    expect(screen.getByLabelText("Quantity for row 1")).toHaveValue("2");
    expect(screen.getByLabelText("Unit for row 1")).toHaveValue("lb");
    expect(screen.getByLabelText("Name for row 2")).toHaveValue("Olive oil");
  });

  it("renders a blank row when ingredients are empty", () => {
    render(<EditRecipeIngredientsDialog {...defaultProps} ingredients={[]} />);

    expect(screen.getByLabelText("Name for row 1")).toHaveValue("");
  });

  it("renders Save and Cancel buttons", () => {
    render(<EditRecipeIngredientsDialog {...defaultProps} />);

    expect(screen.getByRole("button", { name: /save ingredients/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });

  it("calls onOpenChange(false) when Cancel is clicked", () => {
    render(<EditRecipeIngredientsDialog {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("saves ingredients via rpc on save click", async () => {
    render(<EditRecipeIngredientsDialog {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: /save ingredients/i }));

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith("replace_recipe_ingredients", {
        p_recipe_id: "recipe-1",
        p_ingredients: expect.arrayContaining([
          expect.objectContaining({ name: "Chicken breast", quantity: 2, unit: "lb" }),
          expect.objectContaining({ name: "Olive oil", quantity: 1, unit: "tbsp" }),
        ]),
      });
    });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Ingredients updated!");
      expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
      expect(defaultProps.onSaved).toHaveBeenCalled();
    });
  });

  it("shows error toast when all rows are empty", async () => {
    render(<EditRecipeIngredientsDialog {...defaultProps} ingredients={[]} />);

    // The blank row has empty name, so save should show error
    fireEvent.click(screen.getByRole("button", { name: /save ingredients/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Add at least one ingredient");
    });
  });

  it("shows error toast on rpc failure", async () => {
    mockRpc.mockResolvedValue({ error: { message: "DB error" } });

    render(<EditRecipeIngredientsDialog {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: /save ingredients/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to save ingredients");
    });
  });

  it("invalidates cache when cacheContext is provided", async () => {
    const propsWithCache = {
      ...defaultProps,
      cacheContext: { type: "event" as const, id: "event-1", userId: "user-1" },
    };

    render(<EditRecipeIngredientsDialog {...propsWithCache} />);

    fireEvent.click(screen.getByRole("button", { name: /save ingredients/i }));

    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalled();
    });
  });

  it("does not render when closed", () => {
    render(<EditRecipeIngredientsDialog {...defaultProps} open={false} />);

    expect(screen.queryByText("Edit Ingredients")).not.toBeInTheDocument();
  });

  it("parses fractions in quantity field", async () => {
    const ingredients = [
      createIngredient({ id: "ing-1", name: "Butter", quantity: undefined, unit: "cup" }),
    ];

    render(<EditRecipeIngredientsDialog {...defaultProps} ingredients={ingredients} />);

    // Type a fraction
    fireEvent.change(screen.getByLabelText("Quantity for row 1"), {
      target: { value: "1/2" },
    });

    fireEvent.click(screen.getByRole("button", { name: /save ingredients/i }));

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith("replace_recipe_ingredients", {
        p_recipe_id: "recipe-1",
        p_ingredients: expect.arrayContaining([
          expect.objectContaining({ name: "Butter", quantity: 0.5, unit: "cup" }),
        ]),
      });
    });
  });

  it("handles quantity with no value as null", async () => {
    const ingredients = [
      createIngredient({ id: "ing-1", name: "Salt", quantity: undefined, unit: "" }),
    ];

    render(<EditRecipeIngredientsDialog {...defaultProps} ingredients={ingredients} />);

    fireEvent.click(screen.getByRole("button", { name: /save ingredients/i }));

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith("replace_recipe_ingredients", {
        p_recipe_id: "recipe-1",
        p_ingredients: expect.arrayContaining([
          expect.objectContaining({ name: "Salt", quantity: null, unit: null }),
        ]),
      });
    });
  });

  it("filters out rows with empty names", async () => {
    const ingredients = [
      createIngredient({ id: "ing-1", name: "Chicken breast" }),
    ];

    render(<EditRecipeIngredientsDialog {...defaultProps} ingredients={ingredients} />);

    // Add a blank row
    fireEvent.click(screen.getByRole("button", { name: /add ingredient/i }));

    fireEvent.click(screen.getByRole("button", { name: /save ingredients/i }));

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith("replace_recipe_ingredients", {
        p_recipe_id: "recipe-1",
        p_ingredients: [
          expect.objectContaining({ name: "Chicken breast" }),
        ],
      });
    });
  });

  it("disables buttons while saving", async () => {
    // Make rpc hang
    mockRpc.mockReturnValue(new Promise(() => {}));

    render(<EditRecipeIngredientsDialog {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: /save ingredients/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /cancel/i })).toBeDisabled();
    });
  });

  it("handles null unit in ingredients", () => {
    const ingredients = [
      createIngredient({ id: "ing-1", name: "Salt", unit: null as unknown as string }),
    ];

    render(<EditRecipeIngredientsDialog {...defaultProps} ingredients={ingredients} />);

    expect(screen.getByLabelText("Unit for row 1")).toHaveValue("");
  });
});
