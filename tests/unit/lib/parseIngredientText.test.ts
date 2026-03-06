import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSingle, mockInsert, mockEq, mockInvoke } = vi.hoisted(() => {
  const mockSingle = vi.fn();
  const mockInsert = vi.fn(() => ({ select: () => ({ single: mockSingle }) }));
  const mockEq = vi.fn().mockResolvedValue({ error: null });
  const mockInvoke = vi.fn();
  return { mockSingle, mockInsert, mockEq, mockInvoke };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      if (table === "recipes") {
        return {
          insert: mockInsert,
          delete: () => ({ eq: mockEq }),
        };
      }
      return {};
    },
    functions: {
      invoke: mockInvoke,
    },
  },
}));

import { parseIngredientText } from "@/lib/parseIngredientText";

describe("parseIngredientText", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSingle.mockResolvedValue({ data: { id: "temp-recipe-1" }, error: null });
    mockInsert.mockReturnValue({ select: () => ({ single: mockSingle }) });
    mockEq.mockResolvedValue({ error: null });
  });

  it("returns parsed ingredients on success", async () => {
    mockInvoke.mockResolvedValue({
      data: {
        success: true,
        parsed: {
          ingredients: [
            { name: "flour", quantity: 2, unit: "cups", category: "pantry" },
            { name: "eggs", quantity: 3, unit: null, category: "dairy" },
          ],
        },
      },
      error: null,
    });

    const result = await parseIngredientText("2 cups flour, 3 eggs", "user-1");

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("flour");
    expect(result[1].name).toBe("eggs");
  });

  it("returns empty array when data.skipped is true", async () => {
    mockInvoke.mockResolvedValue({
      data: { success: true, skipped: true },
      error: null,
    });

    const result = await parseIngredientText("some text", "user-1");

    expect(result).toEqual([]);
  });

  it("throws when supabase insert returns error", async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: "Insert failed" } });

    await expect(parseIngredientText("flour", "user-1")).rejects.toEqual({
      message: "Insert failed",
    });
  });

  it("throws when edge function returns error", async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: { message: "Function error" },
    });

    await expect(parseIngredientText("flour", "user-1")).rejects.toEqual({
      message: "Function error",
    });
  });

  it("throws when data.success is false", async () => {
    mockInvoke.mockResolvedValue({
      data: { success: false, error: "Parse failed" },
      error: null,
    });

    await expect(parseIngredientText("flour", "user-1")).rejects.toThrow("Parse failed");
  });

  it("throws when userId is empty", async () => {
    await expect(parseIngredientText("flour", "")).rejects.toThrow("Not authenticated");
  });

  it("returns empty array when data.parsed is missing", async () => {
    mockInvoke.mockResolvedValue({
      data: { success: true },
      error: null,
    });

    const result = await parseIngredientText("some text", "user-1");

    expect(result).toEqual([]);
  });

  it("invokes parse-recipe with recipeId, recipeName, and text", async () => {
    mockInvoke.mockResolvedValue({
      data: { success: true, parsed: { ingredients: [] } },
      error: null,
    });

    await parseIngredientText("2 cups flour", "user-1");

    expect(mockInvoke).toHaveBeenCalledWith("parse-recipe", {
      body: {
        recipeId: "temp-recipe-1",
        recipeName: "General Items",
        text: "2 cups flour",
      },
    });
  });
});
