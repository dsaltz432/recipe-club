import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSelect = vi.fn();
const mockUpsert = vi.fn();
const mockEq1 = vi.fn();
const mockEq2 = vi.fn();
const mockEq3 = vi.fn();
const mockMaybeSingle = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: mockSelect,
      upsert: mockUpsert,
    })),
  },
}));

import {
  loadCombinedGroceryItems,
  saveCombinedGroceryItems,
  updateGroceryItem,
  addCustomGroceryItem,
  removeGroceryItem,
} from "@/lib/groceryEdits";
import type { GroceryEditItem } from "@/lib/groceryEdits";

describe("groceryEdits", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default chain: select -> eq -> eq -> eq -> maybeSingle
    mockSelect.mockReturnValue({ eq: mockEq1 });
    mockEq1.mockReturnValue({ eq: mockEq2 });
    mockEq2.mockReturnValue({ eq: mockEq3 });
    mockEq3.mockReturnValue({ maybeSingle: mockMaybeSingle });
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    // Default chain: upsert
    mockUpsert.mockResolvedValue({ error: null });
  });

  describe("loadCombinedGroceryItems", () => {
    it("returns items when data is found", async () => {
      const items: GroceryEditItem[] = [
        { name: "onion", displayName: "2 onions", totalQuantity: 2, category: "produce", sourceRecipes: ["Recipe A"] },
      ];
      mockMaybeSingle.mockResolvedValue({
        data: { items, recipe_ids: ["r1", "r2"] },
        error: null,
      });

      const result = await loadCombinedGroceryItems("event", "event-1", "user-1");

      expect(result).toEqual({
        items,
        recipeIds: ["r1", "r2"],
      });
      expect(mockSelect).toHaveBeenCalledWith("items, recipe_ids");
      expect(mockEq1).toHaveBeenCalledWith("context_type", "event");
      expect(mockEq2).toHaveBeenCalledWith("context_id", "event-1");
      expect(mockEq3).toHaveBeenCalledWith("user_id", "user-1");
    });

    it("returns null when no data found", async () => {
      mockMaybeSingle.mockResolvedValue({ data: null, error: null });

      const result = await loadCombinedGroceryItems("event", "event-1", "user-1");

      expect(result).toBeNull();
    });

    it("returns null on error and logs it", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      mockMaybeSingle.mockResolvedValue({ data: null, error: new Error("DB error") });

      const result = await loadCombinedGroceryItems("event", "event-1", "user-1");

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        "Error loading combined grocery items:",
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });
  });

  describe("saveCombinedGroceryItems", () => {
    it("upserts with correct params and sorted recipe IDs", async () => {
      const items: GroceryEditItem[] = [
        { name: "tomato", displayName: "3 tomatoes", totalQuantity: 3, category: "produce", sourceRecipes: ["Soup"] },
      ];

      await saveCombinedGroceryItems("event", "event-1", "user-1", items, ["r2", "r1"]);

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

      const callArg = mockUpsert.mock.calls[0][0];
      expect(callArg.updated_at).toBeDefined();
      expect(new Date(callArg.updated_at).toISOString()).toBe(callArg.updated_at);
    });

    it("handles errors gracefully", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      mockUpsert.mockResolvedValue({ error: new Error("Upsert failed") });

      await saveCombinedGroceryItems("event", "event-1", "user-1", [], []);

      expect(consoleSpy).toHaveBeenCalledWith(
        "Error saving combined grocery items:",
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });
  });

  describe("updateGroceryItem", () => {
    it("updates item name in the list", async () => {
      const existingItems: GroceryEditItem[] = [
        { name: "onion", displayName: "2 onions", totalQuantity: 2, category: "produce", sourceRecipes: ["Soup"] },
        { name: "garlic", displayName: "3 cloves garlic", totalQuantity: 3, unit: "clove", category: "produce", sourceRecipes: ["Soup"] },
      ];
      mockMaybeSingle.mockResolvedValue({
        data: { items: existingItems, recipe_ids: ["r1"] },
        error: null,
      });

      const result = await updateGroceryItem("event", "event-1", "user-1", "onion", {
        name: "red onion",
      });

      expect(result).not.toBeNull();
      expect(result![0].name).toBe("red onion");
      expect(result![1].name).toBe("garlic");
    });

    it("updates item quantity and unit", async () => {
      const existingItems: GroceryEditItem[] = [
        { name: "flour", displayName: "2 cups flour", totalQuantity: 2, unit: "cup", category: "pantry", sourceRecipes: ["Bread"] },
      ];
      mockMaybeSingle.mockResolvedValue({
        data: { items: existingItems, recipe_ids: ["r1"] },
        error: null,
      });

      const result = await updateGroceryItem("event", "event-1", "user-1", "flour", {
        totalQuantity: 3,
        unit: "lb",
      });

      expect(result).not.toBeNull();
      expect(result![0].totalQuantity).toBe(3);
      expect(result![0].unit).toBe("lb");
    });

    it("returns null when no existing items found", async () => {
      mockMaybeSingle.mockResolvedValue({ data: null, error: null });

      const result = await updateGroceryItem("event", "event-1", "user-1", "onion", {
        name: "red onion",
      });

      expect(result).toBeNull();
    });

    it("returns null when load errors and logs loading error", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      mockMaybeSingle.mockResolvedValue({ data: null, error: new Error("Load error") });

      const result = await updateGroceryItem("event", "event-1", "user-1", "onion", {
        name: "red onion",
      });

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        "Error loading combined grocery items:",
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });

    it("returns null on unexpected error and logs it", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      // Make loadCombinedGroceryItems return data but then make map throw
      const badItems = null as unknown as GroceryEditItem[];
      mockMaybeSingle.mockResolvedValue({
        data: { items: badItems, recipe_ids: ["r1"] },
        error: null,
      });

      const result = await updateGroceryItem("event", "event-1", "user-1", "onion", {
        name: "red onion",
      });

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        "Error updating grocery item:",
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });
  });

  describe("addCustomGroceryItem", () => {
    it("appends a custom item to existing list", async () => {
      const existingItems: GroceryEditItem[] = [
        { name: "tomato", displayName: "4 tomatoes", totalQuantity: 4, category: "produce", sourceRecipes: ["Soup"] },
      ];
      mockMaybeSingle.mockResolvedValue({
        data: { items: existingItems, recipe_ids: ["r1"] },
        error: null,
      });

      const result = await addCustomGroceryItem("event", "event-1", "user-1", {
        name: "paper towels",
        totalQuantity: 2,
      });

      expect(result).not.toBeNull();
      expect(result).toHaveLength(2);
      expect(result![1]).toEqual({
        name: "paper towels",
        displayName: "paper towels",
        totalQuantity: 2,
        unit: undefined,
        category: "other",
        sourceRecipes: ["Custom"],
        custom: true,
      });
    });

    it("creates a new list when none exists", async () => {
      mockMaybeSingle.mockResolvedValue({ data: null, error: null });

      const result = await addCustomGroceryItem("event", "event-1", "user-1", {
        name: "napkins",
        category: "other",
      });

      expect(result).not.toBeNull();
      expect(result).toHaveLength(1);
      expect(result![0].custom).toBe(true);
      expect(result![0].name).toBe("napkins");
    });

    it("uses specified category", async () => {
      mockMaybeSingle.mockResolvedValue({ data: null, error: null });

      const result = await addCustomGroceryItem("event", "event-1", "user-1", {
        name: "butter",
        totalQuantity: 1,
        unit: "stick",
        category: "dairy",
      });

      expect(result).not.toBeNull();
      expect(result![0].category).toBe("dairy");
      expect(result![0].unit).toBe("stick");
    });

    it("returns null on unexpected error and logs it", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      // Return data that will cause spread to throw (items is not iterable)
      const badData = { items: 123, recipe_ids: ["r1"] };
      mockMaybeSingle.mockResolvedValue({ data: badData, error: null });

      const result = await addCustomGroceryItem("event", "event-1", "user-1", {
        name: "paper towels",
      });

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        "Error adding custom grocery item:",
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });
  });

  describe("removeGroceryItem", () => {
    it("removes item by name from the list", async () => {
      const existingItems: GroceryEditItem[] = [
        { name: "tomato", displayName: "4 tomatoes", totalQuantity: 4, category: "produce", sourceRecipes: ["Soup"] },
        { name: "onion", displayName: "2 onions", totalQuantity: 2, category: "produce", sourceRecipes: ["Soup"] },
      ];
      mockMaybeSingle.mockResolvedValue({
        data: { items: existingItems, recipe_ids: ["r1"] },
        error: null,
      });

      const result = await removeGroceryItem("event", "event-1", "user-1", "tomato");

      expect(result).not.toBeNull();
      expect(result).toHaveLength(1);
      expect(result![0].name).toBe("onion");
    });

    it("returns null when no existing items found", async () => {
      mockMaybeSingle.mockResolvedValue({ data: null, error: null });

      const result = await removeGroceryItem("event", "event-1", "user-1", "tomato");

      expect(result).toBeNull();
    });

    it("returns null when load errors and logs loading error", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      mockMaybeSingle.mockResolvedValue({ data: null, error: new Error("Load error") });

      const result = await removeGroceryItem("event", "event-1", "user-1", "tomato");

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        "Error loading combined grocery items:",
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });

    it("returns null on unexpected error and logs it", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      // Return data where items is not an array so filter throws
      const badData = { items: 123, recipe_ids: ["r1"] };
      mockMaybeSingle.mockResolvedValue({ data: badData, error: null });

      const result = await removeGroceryItem("event", "event-1", "user-1", "tomato");

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        "Error removing grocery item:",
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });
  });
});
