import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Supabase mock ---
const mockFrom = vi.fn();
const mockFunctionsInvoke = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    functions: {
      invoke: (...args: unknown[]) => mockFunctionsInvoke(...args),
    },
  },
}));

import { saveRecipeEdit } from "@/lib/recipeActions";

describe("recipeActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("saveRecipeEdit", () => {
    const recipeId = "recipe-123";
    const name = "My Recipe";
    const url = "https://example.com/recipe";
    const previousUrl = "https://example.com/old-recipe";

    function setupMocks(overrides?: {
      updateError?: object | null;
    }) {
      const opts = {
        updateError: null,
        ...overrides,
      };

      // from("recipes").update().eq()
      const mockUpdateEq = vi.fn().mockResolvedValue({ error: opts.updateError });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockUpdateEq });

      mockFrom.mockReturnValue({ update: mockUpdate });
      mockFunctionsInvoke.mockResolvedValue({ data: { success: true }, error: null });

      return { mockUpdate, mockUpdateEq };
    }

    it("saves recipe edit successfully with URL change", async () => {
      const mocks = setupMocks();

      const result = await saveRecipeEdit(recipeId, name, url, previousUrl);

      expect(result).toEqual({ success: true, urlChanged: true });

      // Verify DB update
      expect(mockFrom).toHaveBeenCalledWith("recipes");
      expect(mocks.mockUpdate).toHaveBeenCalledWith({
        name: "My Recipe",
        url: "https://example.com/recipe",
      });
      expect(mocks.mockUpdateEq).toHaveBeenCalledWith("id", recipeId);

      // Verify re-parse triggered
      expect(mockFunctionsInvoke).toHaveBeenCalledWith("parse-recipe", expect.objectContaining({
        body: expect.objectContaining({
          recipeId,
          recipeUrl: "https://example.com/recipe",
          recipeName: "My Recipe",
        }),
      }));
    });

    it("saves recipe edit successfully without URL change", async () => {
      setupMocks();

      const result = await saveRecipeEdit(recipeId, name, url, url);

      expect(result).toEqual({ success: true, urlChanged: false });

      // No re-parse when URL unchanged
      expect(mockFunctionsInvoke).not.toHaveBeenCalled();
    });

    it("rejects invalid URL format", async () => {
      const result = await saveRecipeEdit(recipeId, name, "ftp://invalid.com", previousUrl);

      expect(result).toEqual({
        success: false,
        error: "Please enter a valid URL starting with http:// or https://",
      });

      // No DB call made
      expect(mockFrom).not.toHaveBeenCalled();
    });

    it("accepts empty URL (clears URL)", async () => {
      setupMocks();

      const result = await saveRecipeEdit(recipeId, name, "", previousUrl);

      expect(result).toEqual({ success: true, urlChanged: true });

      // DB update sets url to null when empty
      expect(mockFrom).toHaveBeenCalledWith("recipes");

      // No re-parse when URL is empty
      expect(mockFunctionsInvoke).not.toHaveBeenCalled();
    });

    it("returns failure when DB update fails", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      setupMocks({ updateError: { message: "Permission denied" } });

      const result = await saveRecipeEdit(recipeId, name, url, previousUrl);

      expect(result).toEqual({
        success: false,
        error: "Failed to update recipe",
      });
      vi.restoreAllMocks();
    });

    it("trims whitespace from URL and name", async () => {
      const mocks = setupMocks();

      await saveRecipeEdit(recipeId, "  Trimmed Name  ", "  https://trimmed.com  ", previousUrl);

      expect(mocks.mockUpdate).toHaveBeenCalledWith({
        name: "Trimmed Name",
        url: "https://trimmed.com",
      });
    });

    it("does not re-parse when both URLs are empty", async () => {
      setupMocks();

      const result = await saveRecipeEdit(recipeId, name, "", "");

      expect(result).toEqual({ success: true, urlChanged: false });
      expect(mockFunctionsInvoke).not.toHaveBeenCalled();
    });

    it("handles parse-recipe error gracefully (fire-and-forget)", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      setupMocks();
      mockFunctionsInvoke.mockResolvedValue({ data: null, error: { message: "Parse failed" } });

      const result = await saveRecipeEdit(recipeId, name, url, previousUrl);

      // The function returns success even if parse fails (fire-and-forget)
      expect(result).toEqual({ success: true, urlChanged: true });

      // Wait for the fire-and-forget .then() to execute
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(consoleSpy).toHaveBeenCalledWith(
        "Error re-parsing recipe:",
        { message: "Parse failed" }
      );
      consoleSpy.mockRestore();
    });

    it("handles parse-recipe returning unsuccessful data", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      setupMocks();
      mockFunctionsInvoke.mockResolvedValue({ data: { success: false, error: "Bad HTML" }, error: null });

      await saveRecipeEdit(recipeId, name, url, previousUrl);

      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(consoleSpy).toHaveBeenCalledWith("Error re-parsing recipe:", "Bad HTML");
      consoleSpy.mockRestore();
    });
  });
});
