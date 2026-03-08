import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const mockInQuery = vi.fn();
const mockSelect = vi.fn(() => ({ in: mockInQuery }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({ select: mockSelect })),
  },
}));

import { useRecipeContent } from "@/hooks/useRecipeContent";

describe("useRecipeContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInQuery.mockResolvedValue({ data: [], error: null });
  });

  it("returns empty map and no loading when recipeIds is empty", () => {
    const { result } = renderHook(() => useRecipeContent([]));
    expect(result.current.contentMap.size).toBe(0);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("fetches content and returns a Map keyed by recipeId", async () => {
    const mockRow = {
      id: "content-1",
      recipe_id: "recipe-1",
      description: "A tasty dish",
      servings: "4",
      prep_time: "10 min",
      cook_time: "30 min",
      total_time: "40 min",
      instructions: ["Step 1", "Step 2"],
      source_title: "Some Blog",
      parsed_at: "2026-01-01T00:00:00Z",
      status: "completed",
      error_message: null,
      created_at: "2026-01-01T00:00:00Z",
    };
    mockInQuery.mockResolvedValue({ data: [mockRow], error: null });

    const { result } = renderHook(() => useRecipeContent(["recipe-1"]));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.contentMap.size).toBe(1);
    const content = result.current.contentMap.get("recipe-1");
    expect(content).toMatchObject({
      id: "content-1",
      recipeId: "recipe-1",
      description: "A tasty dish",
      servings: "4",
      prepTime: "10 min",
      cookTime: "30 min",
      totalTime: "40 min",
      instructions: ["Step 1", "Step 2"],
      sourceTitle: "Some Blog",
      status: "completed",
    });
  });

  it("handles JSONB instructions that are not arrays (returns undefined)", async () => {
    const mockRow = {
      id: "content-2",
      recipe_id: "recipe-2",
      description: null,
      servings: null,
      prep_time: null,
      cook_time: null,
      total_time: null,
      instructions: "not an array",
      source_title: null,
      parsed_at: null,
      status: "completed",
      error_message: null,
      created_at: "2026-01-01T00:00:00Z",
    };
    mockInQuery.mockResolvedValue({ data: [mockRow], error: null });

    const { result } = renderHook(() => useRecipeContent(["recipe-2"]));

    await waitFor(() => expect(result.current.loading).toBe(false));

    const content = result.current.contentMap.get("recipe-2");
    expect(content?.instructions).toBeUndefined();
  });

  it("sets error state when fetch fails", async () => {
    mockInQuery.mockResolvedValue({ data: null, error: { message: "DB error" } });

    const { result } = renderHook(() => useRecipeContent(["recipe-3"]));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe("DB error");
    expect(result.current.contentMap.size).toBe(0);
  });

  it("fetches multiple recipes and maps them correctly", async () => {
    const mockRows = [
      { id: "c1", recipe_id: "r1", description: null, servings: null, prep_time: null, cook_time: null, total_time: null, instructions: ["Step A"], source_title: null, parsed_at: null, status: "completed", error_message: null, created_at: "2026-01-01T00:00:00Z" },
      { id: "c2", recipe_id: "r2", description: null, servings: null, prep_time: null, cook_time: null, total_time: null, instructions: null, source_title: null, parsed_at: null, status: "pending", error_message: null, created_at: "2026-01-01T00:00:00Z" },
    ];
    mockInQuery.mockResolvedValue({ data: mockRows, error: null });

    const { result } = renderHook(() => useRecipeContent(["r1", "r2"]));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.contentMap.size).toBe(2);
    expect(result.current.contentMap.get("r1")?.instructions).toEqual(["Step A"]);
    expect(result.current.contentMap.get("r2")?.status).toBe("pending");
  });

  it("passes all recipe IDs to the in() query", async () => {
    mockInQuery.mockResolvedValue({ data: [], error: null });

    renderHook(() => useRecipeContent(["r1", "r2", "r3"]));

    await waitFor(() => expect(mockInQuery).toHaveBeenCalledWith("recipe_id", ["r1", "r2", "r3"]));
  });
});
