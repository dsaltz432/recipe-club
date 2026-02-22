import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSelect = vi.fn();
const mockUpsert = vi.fn();
const mockDelete = vi.fn();
const mockEq = vi.fn();
const mockMaybeSingle = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: mockSelect,
      upsert: mockUpsert,
      delete: mockDelete,
    })),
  },
}));

import { loadGroceryCache, saveGroceryCache, deleteGroceryCache } from "@/lib/groceryCache";

describe("groceryCache", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default chain: select -> eq -> eq -> eq -> maybeSingle
    const eq3 = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
    const eq2 = vi.fn().mockReturnValue({ eq: eq3 });
    mockEq.mockReturnValue({ eq: eq2 });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    // Default chain: upsert
    mockUpsert.mockResolvedValue({ error: null });

    // Default chain: delete -> eq -> eq -> eq
    const delEq3 = vi.fn().mockResolvedValue({ error: null });
    const delEq2 = vi.fn().mockReturnValue({ eq: delEq3 });
    const delEq1 = vi.fn().mockReturnValue({ eq: delEq2 });
    mockDelete.mockReturnValue({ eq: delEq1 });
  });

  describe("loadGroceryCache", () => {
    it("returns cached data when found", async () => {
      const cachedData = {
        items: [{ name: "onion", totalQuantity: 2, category: "produce", sourceRecipes: ["Recipe A"] }],
        recipe_ids: ["r1", "r2"],
      };
      mockMaybeSingle.mockResolvedValue({ data: cachedData, error: null });

      const result = await loadGroceryCache("event", "event-1", "user-1");

      expect(result).toEqual({
        items: cachedData.items,
        recipeIds: ["r1", "r2"],
      });
      expect(mockSelect).toHaveBeenCalledWith("items, recipe_ids");
      expect(mockEq).toHaveBeenCalledWith("context_type", "event");
    });

    it("returns null when no cache found", async () => {
      mockMaybeSingle.mockResolvedValue({ data: null, error: null });

      const result = await loadGroceryCache("event", "event-1", "user-1");

      expect(result).toBeNull();
    });

    it("returns null on error", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      mockMaybeSingle.mockResolvedValue({ data: null, error: new Error("DB error") });

      const result = await loadGroceryCache("event", "event-1", "user-1");

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith("Error loading grocery cache:", expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe("saveGroceryCache", () => {
    it("upserts with correct params and sorted recipe IDs", async () => {
      const items = [
        { name: "onion", totalQuantity: 2, category: "produce" as const, sourceRecipes: ["Recipe A"] },
      ];

      await saveGroceryCache("event", "event-1", "user-1", items, ["r2", "r1"]);

      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          context_type: "event",
          context_id: "event-1",
          user_id: "user-1",
          items: items as unknown as Record<string, unknown>[],
          recipe_ids: ["r1", "r2"],
        }),
        { onConflict: "context_type,context_id,user_id" }
      );

      // Verify updated_at is a valid ISO string
      const callArg = mockUpsert.mock.calls[0][0];
      expect(callArg.updated_at).toBeDefined();
      expect(new Date(callArg.updated_at).toISOString()).toBe(callArg.updated_at);
    });

    it("handles errors gracefully", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      mockUpsert.mockResolvedValue({ error: new Error("Upsert failed") });

      await saveGroceryCache("event", "event-1", "user-1", [], []);

      expect(consoleSpy).toHaveBeenCalledWith("Error saving grocery cache:", expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe("deleteGroceryCache", () => {
    it("deletes with correct context params", async () => {
      const delEq3 = vi.fn().mockResolvedValue({ error: null });
      const delEq2 = vi.fn().mockReturnValue({ eq: delEq3 });
      const delEq1 = vi.fn().mockReturnValue({ eq: delEq2 });
      mockDelete.mockReturnValue({ eq: delEq1 });

      await deleteGroceryCache("event", "event-1", "user-1");

      expect(delEq1).toHaveBeenCalledWith("context_type", "event");
      expect(delEq2).toHaveBeenCalledWith("context_id", "event-1");
      expect(delEq3).toHaveBeenCalledWith("user_id", "user-1");
    });

    it("handles errors gracefully", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const delEq3 = vi.fn().mockResolvedValue({ error: new Error("Delete failed") });
      const delEq2 = vi.fn().mockReturnValue({ eq: delEq3 });
      const delEq1 = vi.fn().mockReturnValue({ eq: delEq2 });
      mockDelete.mockReturnValue({ eq: delEq1 });

      await deleteGroceryCache("event", "event-1", "user-1");

      expect(consoleSpy).toHaveBeenCalledWith("Error deleting grocery cache:", expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe("meal_plan context type", () => {
    it("loadGroceryCache works with meal_plan context", async () => {
      const cachedData = {
        items: [{ name: "rice", totalQuantity: 1, category: "grains", sourceRecipes: ["Stir Fry"] }],
        recipe_ids: ["r3"],
      };
      mockMaybeSingle.mockResolvedValue({ data: cachedData, error: null });

      const result = await loadGroceryCache("meal_plan", "2026-02-15", "user-2");

      expect(result).toEqual({
        items: cachedData.items,
        recipeIds: ["r3"],
      });
      expect(mockEq).toHaveBeenCalledWith("context_type", "meal_plan");
    });

    it("saveGroceryCache works with meal_plan context", async () => {
      await saveGroceryCache("meal_plan", "2026-02-15", "user-2", [], ["r3"]);

      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          context_type: "meal_plan",
          context_id: "2026-02-15",
          user_id: "user-2",
        }),
        { onConflict: "context_type,context_id,user_id" }
      );
    });

    it("deleteGroceryCache works with meal_plan context", async () => {
      const delEq3 = vi.fn().mockResolvedValue({ error: null });
      const delEq2 = vi.fn().mockReturnValue({ eq: delEq3 });
      const delEq1 = vi.fn().mockReturnValue({ eq: delEq2 });
      mockDelete.mockReturnValue({ eq: delEq1 });

      await deleteGroceryCache("meal_plan", "2026-02-15", "user-2");

      expect(delEq1).toHaveBeenCalledWith("context_type", "meal_plan");
      expect(delEq2).toHaveBeenCalledWith("context_id", "2026-02-15");
      expect(delEq3).toHaveBeenCalledWith("user_id", "user-2");
    });
  });
});
