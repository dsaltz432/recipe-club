import { describe, it, expect, vi, beforeEach } from "vitest";

const mockInvoke = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
  },
}));

import { transformForInstacart, sendToInstacart } from "@/lib/instacart";
import type { SmartGroceryItem } from "@/types";

describe("instacart", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("transformForInstacart", () => {
    it("strips category and sourceRecipes, keeps name, displayName, totalQuantity, unit", () => {
      const items: SmartGroceryItem[] = [
        {
          name: "onion",
          displayName: "onions",
          totalQuantity: 2,
          unit: undefined,
          category: "produce",
          sourceRecipes: ["Recipe A", "Recipe B"],
        },
        {
          name: "flour",
          displayName: "flour",
          totalQuantity: 3,
          unit: "cup",
          category: "pantry",
          sourceRecipes: ["Recipe A"],
        },
      ];

      const result = transformForInstacart(items);

      expect(result).toEqual([
        { name: "onion", displayName: "onions", totalQuantity: 2 },
        { name: "flour", displayName: "flour", totalQuantity: 3, unit: "cup" },
      ]);
      // Verify category and sourceRecipes are not present
      expect(result[0]).not.toHaveProperty("category");
      expect(result[0]).not.toHaveProperty("sourceRecipes");
    });

    it("omits totalQuantity and unit when not present", () => {
      const items: SmartGroceryItem[] = [
        {
          name: "salt",
          displayName: "salt",
          category: "spices",
          sourceRecipes: ["Recipe A"],
        },
      ];

      const result = transformForInstacart(items);

      expect(result).toEqual([{ name: "salt", displayName: "salt" }]);
      expect(result[0]).not.toHaveProperty("totalQuantity");
      expect(result[0]).not.toHaveProperty("unit");
    });

    it("returns empty array for empty input", () => {
      expect(transformForInstacart([])).toEqual([]);
    });
  });

  describe("sendToInstacart", () => {
    const items: SmartGroceryItem[] = [
      {
        name: "onion",
        displayName: "onions",
        totalQuantity: 2,
        category: "produce",
        sourceRecipes: ["Recipe A"],
      },
      {
        name: "flour",
        displayName: "flour",
        totalQuantity: 3,
        unit: "cup",
        category: "pantry",
        sourceRecipes: ["Recipe A"],
      },
    ];

    it("calls instacart-recipe edge function and returns URL", async () => {
      mockInvoke.mockResolvedValue({
        data: { success: true, products_link_url: "https://instacart.com/store/recipes/123" },
        error: null,
      });

      const url = await sendToInstacart(items, "Weekly Groceries");

      expect(mockInvoke).toHaveBeenCalledWith("instacart-recipe", {
        body: {
          title: "Weekly Groceries",
          items: [
            { name: "onion", displayName: "onions", totalQuantity: 2 },
            { name: "flour", displayName: "flour", totalQuantity: 3, unit: "cup" },
          ],
        },
      });
      expect(url).toBe("https://instacart.com/store/recipes/123");
    });

    it("throws on edge function error", async () => {
      mockInvoke.mockResolvedValue({
        data: null,
        error: new Error("Network error"),
      });

      await expect(sendToInstacart(items, "Test")).rejects.toThrow("Network error");
    });

    it("throws on data.success === false with data.error message", async () => {
      mockInvoke.mockResolvedValue({
        data: { success: false, error: "Items array is empty or missing" },
        error: null,
      });

      await expect(sendToInstacart(items, "Test")).rejects.toThrow(
        "Items array is empty or missing"
      );
    });

    it("returns URL when data.skipped is true (dev mode fallback)", async () => {
      mockInvoke.mockResolvedValue({
        data: {
          success: true,
          skipped: true,
          message: "INSTACART_API_KEY not configured",
          products_link_url: "https://www.instacart.com",
        },
        error: null,
      });

      const url = await sendToInstacart(items, "Test");

      expect(url).toBe("https://www.instacart.com");
    });
  });
});
