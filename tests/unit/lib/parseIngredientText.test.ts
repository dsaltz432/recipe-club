import { describe, it, expect, vi, beforeEach } from "vitest";

const mockInvoke = vi.hoisted(() => vi.fn());

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: mockInvoke,
    },
  },
}));

import { parseIngredientText } from "@/lib/parseIngredientText";

describe("parseIngredientText", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it("falls back to line splitting when data.skipped is true", async () => {
    mockInvoke.mockResolvedValue({
      data: { success: true, skipped: true },
      error: null,
    });

    const result = await parseIngredientText("flour, sugar", "user-1");

    expect(result).toEqual([
      { name: "flour", quantity: null, unit: null, category: "other" },
      { name: "sugar", quantity: null, unit: null, category: "other" },
    ]);
  });

  it("falls back to line splitting on edge function error", async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: { message: "Function error" },
    });

    const result = await parseIngredientText("flour", "user-1");

    expect(result).toEqual([
      { name: "flour", quantity: null, unit: null, category: "other" },
    ]);
  });

  it("falls back to line splitting when data.success is false", async () => {
    mockInvoke.mockResolvedValue({
      data: { success: false, error: "Parse failed" },
      error: null,
    });

    const result = await parseIngredientText("flour", "user-1");

    expect(result).toEqual([
      { name: "flour", quantity: null, unit: null, category: "other" },
    ]);
  });

  it("throws when userId is empty", async () => {
    await expect(parseIngredientText("flour", "")).rejects.toThrow("Not authenticated");
  });

  it("falls back when data.parsed is missing", async () => {
    mockInvoke.mockResolvedValue({
      data: { success: true },
      error: null,
    });

    const result = await parseIngredientText("some text", "user-1");

    expect(result).toEqual([
      { name: "some text", quantity: null, unit: null, category: "other" },
    ]);
  });

  it("falls back when parsed ingredients is empty array", async () => {
    mockInvoke.mockResolvedValue({
      data: { success: true, parsed: { ingredients: [] } },
      error: null,
    });

    const result = await parseIngredientText("flour, sugar", "user-1");

    expect(result).toEqual([
      { name: "flour", quantity: null, unit: null, category: "other" },
      { name: "sugar", quantity: null, unit: null, category: "other" },
    ]);
  });

  it("invokes parse-recipe without recipeId", async () => {
    mockInvoke.mockResolvedValue({
      data: { success: true, parsed: { ingredients: [] } },
      error: null,
    });

    await parseIngredientText("2 cups flour", "user-1");

    expect(mockInvoke).toHaveBeenCalledWith("parse-recipe", expect.objectContaining({
      body: expect.objectContaining({
        recipeName: "General Items",
        text: "2 cups flour",
      }),
    }));
  });

  it("splits on newlines in fallback", async () => {
    mockInvoke.mockResolvedValue({
      data: { success: false },
      error: null,
    });

    const result = await parseIngredientText("flour\nsugar\neggs", "user-1");

    expect(result).toHaveLength(3);
    expect(result[0].name).toBe("flour");
    expect(result[1].name).toBe("sugar");
    expect(result[2].name).toBe("eggs");
  });
});
