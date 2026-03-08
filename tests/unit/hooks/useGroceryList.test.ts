import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// Mock supabase
const mockInsertSelect = vi.fn();
const mockInsert = vi.fn(() => ({ select: mockInsertSelect }));
const mockInQuery = vi.fn().mockResolvedValue({ data: [], error: null });
const mockSelect = vi.fn(() => ({ in: mockInQuery }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === "recipe_ingredients") {
        return { select: mockSelect, insert: mockInsert };
      }
      if (table === "recipe_content") {
        return { select: vi.fn(() => ({ in: vi.fn().mockResolvedValue({ data: [], error: null }) })) };
      }
      if (table === "recipes") {
        return { select: vi.fn(() => ({ in: vi.fn().mockResolvedValue({ data: [], error: null }) })) };
      }
      return { select: vi.fn(() => ({ in: vi.fn().mockResolvedValue({ data: [], error: null }), eq: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) })) })) })) };
    }),
  },
}));

vi.mock("@/lib/parseIngredientText", () => ({
  parseIngredientText: vi.fn(),
}));

vi.mock("@/lib/groceryCache", () => ({
  loadGroceryCache: vi.fn().mockResolvedValue(null),
  saveGroceryCache: vi.fn().mockResolvedValue(undefined),
  deleteGroceryCache: vi.fn().mockResolvedValue(undefined),
  loadCheckedItems: vi.fn().mockResolvedValue(new Set()),
  saveCheckedItems: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/generalGrocery", () => ({
  loadGeneralItems: vi.fn().mockResolvedValue([]),
  addGeneralItem: vi.fn().mockResolvedValue(undefined),
  removeGeneralItem: vi.fn().mockResolvedValue(undefined),
  updateGeneralItem: vi.fn().mockResolvedValue(undefined),
  toRawIngredients: vi.fn().mockReturnValue([]),
}));

vi.mock("@/lib/pantry", () => ({
  getPantryItems: vi.fn().mockResolvedValue([]),
  ensureDefaultPantryItems: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/groceryList", () => ({
  smartCombineIngredients: vi.fn().mockResolvedValue({ items: [], perRecipeItems: {} }),
  groupSmartByCategory: vi.fn().mockReturnValue(new Map()),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/constants", () => ({
  RECOMBINE_DELAY_MS: 60000,
}));

import { useGroceryList } from "@/hooks/useGroceryList";
import { parseIngredientText } from "@/lib/parseIngredientText";
import { deleteGroceryCache } from "@/lib/groceryCache";

const mockParseIngredientText = parseIngredientText as ReturnType<typeof vi.fn>;
const mockDeleteGroceryCache = deleteGroceryCache as ReturnType<typeof vi.fn>;

describe("useGroceryList - handleAddItemsToRecipe", () => {
  const defaultOptions = {
    contextType: "event" as const,
    contextId: "event-1",
    userId: "user-1",
    recipeIds: [],
    enabled: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockInsert.mockReturnValue({ select: mockInsertSelect });
    mockInsertSelect.mockResolvedValue({
      data: [
        {
          id: "new-ing-1",
          recipe_id: "recipe-1",
          name: "butter",
          quantity: 1,
          unit: "cup",
          category: "dairy",
          raw_text: null,
          sort_order: 0,
          created_at: "2026-01-01",
        },
      ],
      error: null,
    });
  });

  it("calls parseIngredientText with the text and userId", async () => {
    mockParseIngredientText.mockResolvedValue([
      { name: "butter", quantity: 1, unit: "cup", category: "dairy" },
    ]);

    const { result } = renderHook(() => useGroceryList(defaultOptions));

    await act(async () => {
      await result.current.handleAddItemsToRecipe("recipe-1", "1 cup butter");
    });

    expect(mockParseIngredientText).toHaveBeenCalledWith("1 cup butter", "user-1");
  });

  it("inserts parsed items into recipe_ingredients", async () => {
    mockParseIngredientText.mockResolvedValue([
      { name: "butter", quantity: 1, unit: "cup", category: "dairy" },
    ]);

    const { result } = renderHook(() => useGroceryList(defaultOptions));

    await act(async () => {
      await result.current.handleAddItemsToRecipe("recipe-1", "1 cup butter");
    });

    expect(mockInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        recipe_id: "recipe-1",
        name: "butter",
        quantity: 1,
        unit: "cup",
        category: "dairy",
        sort_order: 0,
      }),
    ]);
  });

  it("calls deleteGroceryCache (via invalidateCacheAndResetRefs)", async () => {
    mockParseIngredientText.mockResolvedValue([
      { name: "eggs", quantity: 2, unit: null, category: "dairy" },
    ]);

    const { result } = renderHook(() => useGroceryList(defaultOptions));

    await act(async () => {
      await result.current.handleAddItemsToRecipe("recipe-1", "2 eggs");
    });

    expect(mockDeleteGroceryCache).toHaveBeenCalledWith("event", "event-1", "user-1");
  });

  it("does nothing when parseIngredientText returns empty array", async () => {
    mockParseIngredientText.mockResolvedValue([]);

    const { result } = renderHook(() => useGroceryList(defaultOptions));

    await act(async () => {
      await result.current.handleAddItemsToRecipe("recipe-1", "");
    });

    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("throws when userId is not set", async () => {
    mockParseIngredientText.mockRejectedValue(new Error("Not authenticated"));

    const { result } = renderHook(() =>
      useGroceryList({ ...defaultOptions, userId: undefined })
    );

    await expect(
      act(async () => {
        await result.current.handleAddItemsToRecipe("recipe-1", "flour");
      })
    ).rejects.toThrow();
  });
});
