import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSelect = vi.fn();
const mockUpsert = vi.fn();
const mockEq = vi.fn();
const mockMaybeSingle = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: mockSelect,
      upsert: mockUpsert,
    })),
  },
}));

vi.mock("@/lib/devMode", () => ({
  isDevMode: () => false,
}));

import {
  loadUserPreferences,
  saveUserPreferences,
} from "@/lib/userPreferences";

describe("userPreferences", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default chain: select -> eq -> maybeSingle
    mockEq.mockReturnValue({ maybeSingle: mockMaybeSingle });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    // Default chain: upsert
    mockUpsert.mockResolvedValue({ error: null });
  });

  describe("loadUserPreferences", () => {
    it("returns defaults when no row exists", async () => {
      mockMaybeSingle.mockResolvedValue({ data: null, error: null });

      const result = await loadUserPreferences("user-1");

      expect(result).toEqual({
        mealTypes: ["breakfast", "lunch", "dinner"],
        weekStartDay: 0,
        householdSize: 2,
        aiModel: "claude-sonnet-4-6",
      });
    });

    it("returns stored preferences when row exists", async () => {
      mockMaybeSingle.mockResolvedValue({
        data: {
          meal_types: ["lunch", "dinner"],
          week_start_day: 1,
          household_size: 4,
          ai_model_parse: "gpt-4o",
        },
        error: null,
      });

      const result = await loadUserPreferences("user-1");

      expect(result).toEqual({
        mealTypes: ["lunch", "dinner"],
        weekStartDay: 1,
        householdSize: 4,
        aiModel: "gpt-4o",
      });
    });

    it("returns defaults on error", async () => {
      mockMaybeSingle.mockResolvedValue({
        data: null,
        error: new Error("DB error"),
      });

      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const result = await loadUserPreferences("user-1");

      expect(result).toEqual({
        mealTypes: ["breakfast", "lunch", "dinner"],
        weekStartDay: 0,
        householdSize: 2,
        aiModel: "claude-sonnet-4-6",
      });
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("handles null meal_types with default", async () => {
      mockMaybeSingle.mockResolvedValue({
        data: {
          meal_types: null,
          week_start_day: 0,
          household_size: 2,
          ai_model_parse: "claude-sonnet-4-6",
        },
        error: null,
      });

      const result = await loadUserPreferences("user-1");

      expect(result.mealTypes).toEqual(["breakfast", "lunch", "dinner"]);
    });

    it("handles non-number week_start_day with default", async () => {
      mockMaybeSingle.mockResolvedValue({
        data: {
          meal_types: ["breakfast"],
          week_start_day: null,
          household_size: 2,
          ai_model_parse: "claude-sonnet-4-6",
        },
        error: null,
      });

      const result = await loadUserPreferences("user-1");

      expect(result.weekStartDay).toBe(0);
    });

    it("handles non-number household_size with default", async () => {
      mockMaybeSingle.mockResolvedValue({
        data: {
          meal_types: ["breakfast"],
          week_start_day: 0,
          household_size: null,
          ai_model_parse: "claude-sonnet-4-6",
        },
        error: null,
      });

      const result = await loadUserPreferences("user-1");

      expect(result.householdSize).toBe(2);
    });
  });

  describe("saveUserPreferences", () => {
    it("upserts preferences to database", async () => {
      await saveUserPreferences("user-1", {
        mealTypes: ["dinner"],
        weekStartDay: 1,
        householdSize: 3,
        aiModel: "gpt-4o",
      });

      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: "user-1",
          meal_types: ["dinner"],
          week_start_day: 1,
          household_size: 3,
          ai_model_parse: "gpt-4o",
          ai_model_combine: "gpt-4o",
        }),
        { onConflict: "user_id" }
      );
    });

    it("throws on error", async () => {
      mockUpsert.mockResolvedValue({ error: new Error("DB error") });

      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      await expect(
        saveUserPreferences("user-1", {
          mealTypes: ["breakfast"],
          weekStartDay: 0,
          householdSize: 2,
          aiModel: "claude-sonnet-4-6",
        })
      ).rejects.toThrow("DB error");

      consoleSpy.mockRestore();
    });
  });
});
