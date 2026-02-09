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

    // Default chain: select -> eq -> maybeSingle
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ maybeSingle: mockMaybeSingle });
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    // Default chain: upsert
    mockUpsert.mockResolvedValue({ error: null });

    // Default chain: delete -> eq
    const deleteEq = vi.fn().mockResolvedValue({ error: null });
    mockDelete.mockReturnValue({ eq: deleteEq });
  });

  describe("loadGroceryCache", () => {
    it("returns cached data when found", async () => {
      const cachedData = {
        items: [{ name: "onion", totalQuantity: 2, category: "produce", sourceRecipes: ["Recipe A"] }],
        recipe_ids: ["r1", "r2"],
      };
      mockMaybeSingle.mockResolvedValue({ data: cachedData, error: null });

      const result = await loadGroceryCache("event-1");

      expect(result).toEqual({
        items: cachedData.items,
        recipeIds: ["r1", "r2"],
      });
      expect(mockSelect).toHaveBeenCalledWith("items, recipe_ids");
      expect(mockEq).toHaveBeenCalledWith("event_id", "event-1");
    });

    it("returns null when no cache found", async () => {
      mockMaybeSingle.mockResolvedValue({ data: null, error: null });

      const result = await loadGroceryCache("event-1");

      expect(result).toBeNull();
    });

    it("returns null on error", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      mockMaybeSingle.mockResolvedValue({ data: null, error: new Error("DB error") });

      const result = await loadGroceryCache("event-1");

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

      await saveGroceryCache("event-1", items, ["r2", "r1"]);

      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_id: "event-1",
          items: items as unknown as Record<string, unknown>[],
          recipe_ids: ["r1", "r2"],
        }),
        { onConflict: "event_id" }
      );

      // Verify updated_at is a valid ISO string
      const callArg = mockUpsert.mock.calls[0][0];
      expect(callArg.updated_at).toBeDefined();
      expect(new Date(callArg.updated_at).toISOString()).toBe(callArg.updated_at);
    });

    it("handles errors gracefully", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      mockUpsert.mockResolvedValue({ error: new Error("Upsert failed") });

      await saveGroceryCache("event-1", [], []);

      expect(consoleSpy).toHaveBeenCalledWith("Error saving grocery cache:", expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe("deleteGroceryCache", () => {
    it("deletes with correct event_id", async () => {
      const deleteEq = vi.fn().mockResolvedValue({ error: null });
      mockDelete.mockReturnValue({ eq: deleteEq });

      await deleteGroceryCache("event-1");

      expect(deleteEq).toHaveBeenCalledWith("event_id", "event-1");
    });

    it("handles errors gracefully", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const deleteEq = vi.fn().mockResolvedValue({ error: new Error("Delete failed") });
      mockDelete.mockReturnValue({ eq: deleteEq });

      await deleteGroceryCache("event-1");

      expect(consoleSpy).toHaveBeenCalledWith("Error deleting grocery cache:", expect.any(Error));
      consoleSpy.mockRestore();
    });
  });
});
