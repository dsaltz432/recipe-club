import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock supabase
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockDelete = vi.fn();
const mockUpsert = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: mockSelect,
      insert: mockInsert,
      delete: mockDelete,
      upsert: mockUpsert,
    })),
  },
}));

import { getPantryItems, addPantryItem, removePantryItem, ensureDefaultPantryItems } from "@/lib/pantry";

describe("pantry", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default chain: select -> eq -> order
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ order: mockOrder });
    mockOrder.mockResolvedValue({ data: [], error: null });

    // Default chain: insert
    mockInsert.mockResolvedValue({ error: null });

    // Default chain: delete -> eq -> eq
    const deleteEq2 = vi.fn().mockResolvedValue({ error: null });
    const deleteEq1 = vi.fn().mockReturnValue({ eq: deleteEq2 });
    mockDelete.mockReturnValue({ eq: deleteEq1 });

    // Default chain: upsert
    mockUpsert.mockResolvedValue({ error: null });
  });

  describe("getPantryItems", () => {
    it("returns pantry items for a user", async () => {
      const items = [
        { id: "1", name: "salt" },
        { id: "2", name: "pepper" },
      ];
      mockOrder.mockResolvedValue({ data: items, error: null });

      const result = await getPantryItems("user-1");

      expect(result).toEqual(items);
      expect(mockSelect).toHaveBeenCalledWith("id, name");
      expect(mockEq).toHaveBeenCalledWith("user_id", "user-1");
      expect(mockOrder).toHaveBeenCalledWith("name");
    });

    it("returns empty array when no items", async () => {
      mockOrder.mockResolvedValue({ data: null, error: null });

      const result = await getPantryItems("user-1");
      expect(result).toEqual([]);
    });

    it("throws on error", async () => {
      mockOrder.mockResolvedValue({ data: null, error: new Error("DB error") });

      await expect(getPantryItems("user-1")).rejects.toThrow("DB error");
    });
  });

  describe("addPantryItem", () => {
    it("inserts a lowercased trimmed item", async () => {
      await addPantryItem("user-1", "  Olive Oil  ");

      expect(mockInsert).toHaveBeenCalledWith({
        user_id: "user-1",
        name: "olive oil",
      });
    });

    it("throws on error", async () => {
      mockInsert.mockResolvedValue({ error: new Error("Duplicate") });

      await expect(addPantryItem("user-1", "salt")).rejects.toThrow("Duplicate");
    });
  });

  describe("removePantryItem", () => {
    it("deletes the item by id and user", async () => {
      const deleteEq2 = vi.fn().mockResolvedValue({ error: null });
      const deleteEq1 = vi.fn().mockReturnValue({ eq: deleteEq2 });
      mockDelete.mockReturnValue({ eq: deleteEq1 });

      await removePantryItem("user-1", "item-1");

      expect(deleteEq1).toHaveBeenCalledWith("id", "item-1");
      expect(deleteEq2).toHaveBeenCalledWith("user_id", "user-1");
    });

    it("throws on error", async () => {
      const deleteEq2 = vi.fn().mockResolvedValue({ error: new Error("Not found") });
      const deleteEq1 = vi.fn().mockReturnValue({ eq: deleteEq2 });
      mockDelete.mockReturnValue({ eq: deleteEq1 });

      await expect(removePantryItem("user-1", "item-1")).rejects.toThrow("Not found");
    });
  });

  describe("ensureDefaultPantryItems", () => {
    it("upserts salt, pepper, and water for the user", async () => {
      await ensureDefaultPantryItems("user-1");

      expect(mockUpsert).toHaveBeenCalledWith(
        [
          { user_id: "user-1", name: "salt" },
          { user_id: "user-1", name: "pepper" },
          { user_id: "user-1", name: "water" },
        ],
        { onConflict: "user_id,name", ignoreDuplicates: true }
      );
    });

    it("throws on error", async () => {
      mockUpsert.mockResolvedValue({ error: new Error("Upsert failed") });

      await expect(ensureDefaultPantryItems("user-1")).rejects.toThrow("Upsert failed");
    });
  });
});
