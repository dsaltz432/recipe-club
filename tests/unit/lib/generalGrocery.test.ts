import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: mockSelect,
      insert: mockInsert,
      update: mockUpdate,
      delete: mockDelete,
    })),
  },
}));

import {
  loadGeneralItems,
  addGeneralItem,
  removeGeneralItem,
  updateGeneralItem,
  toRawIngredients,
} from "@/lib/generalGrocery";
import type { GeneralGroceryItem } from "@/types";

describe("generalGrocery", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default chain: select -> eq -> eq -> eq -> order
    const eq3 = vi.fn().mockReturnValue({ order: mockOrder });
    const eq2 = vi.fn().mockReturnValue({ eq: eq3 });
    mockEq.mockReturnValue({ eq: eq2 });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockOrder.mockResolvedValue({ data: [], error: null });

    // Default: insert resolves
    mockInsert.mockResolvedValue({ error: null });

    // Default chain: update -> eq
    const updEq = vi.fn().mockResolvedValue({ error: null });
    mockUpdate.mockReturnValue({ eq: updEq });

    // Default chain: delete -> eq
    const delEq = vi.fn().mockResolvedValue({ error: null });
    mockDelete.mockReturnValue({ eq: delEq });
  });

  describe("loadGeneralItems", () => {
    it("returns items ordered by created_at", async () => {
      const dbRows = [
        {
          id: "item-1",
          user_id: "user-1",
          context_type: "meal_plan",
          context_id: "2026-03-02",
          name: "paper towels",
          quantity: "2",
          unit: "rolls",
          created_at: "2026-03-01T10:00:00Z",
        },
        {
          id: "item-2",
          user_id: "user-1",
          context_type: "meal_plan",
          context_id: "2026-03-02",
          name: "dish soap",
          quantity: null,
          unit: null,
          created_at: "2026-03-01T11:00:00Z",
        },
      ];
      mockOrder.mockResolvedValue({ data: dbRows, error: null });

      const result = await loadGeneralItems("meal_plan", "2026-03-02", "user-1");

      expect(result).toEqual([
        {
          id: "item-1",
          userId: "user-1",
          contextType: "meal_plan",
          contextId: "2026-03-02",
          name: "paper towels",
          quantity: "2",
          unit: "rolls",
          createdAt: "2026-03-01T10:00:00Z",
        },
        {
          id: "item-2",
          userId: "user-1",
          contextType: "meal_plan",
          contextId: "2026-03-02",
          name: "dish soap",
          quantity: undefined,
          unit: undefined,
          createdAt: "2026-03-01T11:00:00Z",
        },
      ]);
      expect(mockSelect).toHaveBeenCalledWith("*");
      expect(mockEq).toHaveBeenCalledWith("user_id", "user-1");
    });

    it("returns empty array when no items found", async () => {
      mockOrder.mockResolvedValue({ data: [], error: null });

      const result = await loadGeneralItems("meal_plan", "2026-03-02", "user-1");

      expect(result).toEqual([]);
    });

    it("returns empty array when data is null", async () => {
      mockOrder.mockResolvedValue({ data: null, error: null });

      const result = await loadGeneralItems("meal_plan", "2026-03-02", "user-1");

      expect(result).toEqual([]);
    });

    it("returns empty array on error", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      mockOrder.mockResolvedValue({ data: null, error: new Error("DB error") });

      const result = await loadGeneralItems("meal_plan", "2026-03-02", "user-1");

      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith(
        "Error loading general grocery items:",
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });
  });

  describe("addGeneralItem", () => {
    it("inserts item with correct params", async () => {
      await addGeneralItem("meal_plan", "2026-03-02", "user-1", {
        name: "paper towels",
        quantity: "2",
        unit: "rolls",
      });

      expect(mockInsert).toHaveBeenCalledWith({
        user_id: "user-1",
        context_type: "meal_plan",
        context_id: "2026-03-02",
        name: "paper towels",
        quantity: "2",
        unit: "rolls",
      });
    });

    it("inserts item with null quantity and unit when not provided", async () => {
      await addGeneralItem("meal_plan", "2026-03-02", "user-1", {
        name: "dish soap",
      });

      expect(mockInsert).toHaveBeenCalledWith({
        user_id: "user-1",
        context_type: "meal_plan",
        context_id: "2026-03-02",
        name: "dish soap",
        quantity: null,
        unit: null,
      });
    });

    it("handles errors gracefully", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      mockInsert.mockResolvedValue({ error: new Error("Insert failed") });

      await addGeneralItem("meal_plan", "2026-03-02", "user-1", {
        name: "test",
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        "Error adding general grocery item:",
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });
  });

  describe("removeGeneralItem", () => {
    it("deletes by id", async () => {
      const delEq = vi.fn().mockResolvedValue({ error: null });
      mockDelete.mockReturnValue({ eq: delEq });

      await removeGeneralItem("item-1");

      expect(delEq).toHaveBeenCalledWith("id", "item-1");
    });

    it("handles errors gracefully", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const delEq = vi.fn().mockResolvedValue({ error: new Error("Delete failed") });
      mockDelete.mockReturnValue({ eq: delEq });

      await removeGeneralItem("item-1");

      expect(consoleSpy).toHaveBeenCalledWith(
        "Error removing general grocery item:",
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });
  });

  describe("updateGeneralItem", () => {
    it("updates name field", async () => {
      const updEq = vi.fn().mockResolvedValue({ error: null });
      mockUpdate.mockReturnValue({ eq: updEq });

      await updateGeneralItem("item-1", { name: "updated name" });

      expect(mockUpdate).toHaveBeenCalledWith({ name: "updated name" });
      expect(updEq).toHaveBeenCalledWith("id", "item-1");
    });

    it("updates multiple fields", async () => {
      const updEq = vi.fn().mockResolvedValue({ error: null });
      mockUpdate.mockReturnValue({ eq: updEq });

      await updateGeneralItem("item-1", {
        name: "olive oil",
        quantity: "1",
        unit: "bottle",
      });

      expect(mockUpdate).toHaveBeenCalledWith({
        name: "olive oil",
        quantity: "1",
        unit: "bottle",
      });
    });

    it("handles errors gracefully", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const updEq = vi.fn().mockResolvedValue({ error: new Error("Update failed") });
      mockUpdate.mockReturnValue({ eq: updEq });

      await updateGeneralItem("item-1", { name: "test" });

      expect(consoleSpy).toHaveBeenCalledWith(
        "Error updating general grocery item:",
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });
  });

  describe("toRawIngredients", () => {
    it("converts general items to RawIngredientInput format", () => {
      const items: GeneralGroceryItem[] = [
        {
          id: "item-1",
          userId: "user-1",
          contextType: "meal_plan",
          contextId: "2026-03-02",
          name: "olive oil",
          quantity: "1",
          unit: "bottle",
        },
        {
          id: "item-2",
          userId: "user-1",
          contextType: "meal_plan",
          contextId: "2026-03-02",
          name: "paper towels",
        },
      ];

      const result = toRawIngredients(items);

      expect(result).toEqual([
        {
          name: "olive oil",
          quantity: "1",
          unit: "bottle",
          category: "other",
          recipeName: "General",
        },
        {
          name: "paper towels",
          quantity: null,
          unit: null,
          category: "other",
          recipeName: "General",
        },
      ]);
    });

    it("returns empty array for empty input", () => {
      const result = toRawIngredients([]);

      expect(result).toEqual([]);
    });

    it("sets category to 'other' and recipeName to 'General' for all items", () => {
      const items: GeneralGroceryItem[] = [
        {
          id: "item-1",
          userId: "user-1",
          contextType: "meal_plan",
          contextId: "2026-03-02",
          name: "milk",
          quantity: "1",
          unit: "gallon",
        },
      ];

      const result = toRawIngredients(items);

      expect(result[0].category).toBe("other");
      expect(result[0].recipeName).toBe("General");
    });
  });
});
