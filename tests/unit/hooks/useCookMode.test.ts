import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const { mockMaybeSingle, mockIngredientsIn, mockFrom, mockInvoke } =
  vi.hoisted(() => {
    const mockMaybeSingle = vi.fn();
    const mockEqHash = vi.fn(() => ({ maybeSingle: mockMaybeSingle }));
    const mockEqEvent = vi.fn(() => ({ eq: mockEqHash }));
    const mockSelect = vi.fn(() => ({ eq: mockEqEvent }));
    const mockIngredientsIn = vi.fn().mockResolvedValue({ data: [], error: null });
    const mockFrom = vi.fn((tableName: string) => {
      if (tableName === "recipe_ingredients") {
        return { select: vi.fn(() => ({ in: mockIngredientsIn })) };
      }
      return { select: mockSelect };
    });
    const mockInvoke = vi.fn();
    return { mockMaybeSingle, mockEqHash, mockEqEvent, mockSelect, mockIngredientsIn, mockFrom, mockInvoke };
  });

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
    functions: { invoke: mockInvoke },
  },
}));

vi.mock("@/lib/userPreferences", () => ({
  getCachedAiModel: vi.fn(() => "claude-sonnet-4-6"),
}));

import { useCookMode } from "@/hooks/useCookMode";

describe("useCookMode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIngredientsIn.mockResolvedValue({ data: [], error: null });
  });

  it("returns empty timeline, not loading, and no error initially", () => {
    const { result } = renderHook(() => useCookMode({ recipes: [] }));
    expect(result.current.timeline).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("single recipe: calls edge function and returns generated timeline", async () => {
    const generatedSteps = [
      { recipeId: "r1", recipeName: "Pasta", instruction: "Boil water" },
      { recipeId: "r1", recipeName: "Pasta", instruction: "Cook pasta" },
    ];
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockInvoke.mockResolvedValue({
      data: { success: true, steps: generatedSteps },
      error: null,
    });

    const recipe = { id: "r1", name: "Pasta", instructions: ["Boil water", "Cook pasta"] };

    const { result } = renderHook(() =>
      useCookMode({ eventId: "event-1", recipes: [recipe] })
    );

    await act(async () => {
      await result.current.generateTimeline();
    });

    expect(result.current.timeline).toEqual(generatedSteps);
    expect(mockInvoke).toHaveBeenCalledWith(
      "generate-cook-timeline",
      expect.objectContaining({
        body: expect.objectContaining({
          eventId: "event-1",
          recipeIds: ["r1"],
        }),
      })
    );
    // mockFrom is called for recipe_ingredients fetch
    expect(mockFrom).toHaveBeenCalledWith("recipe_ingredients");
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("single recipe with no instructions: still calls edge function", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockInvoke.mockResolvedValue({
      data: { success: true, steps: [] },
      error: null,
    });

    const recipe = { id: "r1", name: "Pasta" };

    const { result } = renderHook(() => useCookMode({ eventId: "event-1", recipes: [recipe] }));

    await act(async () => {
      await result.current.generateTimeline();
    });

    expect(result.current.timeline).toEqual([]);
    expect(mockInvoke).toHaveBeenCalled();
  });

  it("multi-recipe: returns cached timeline on cache hit without calling edge function", async () => {
    const cachedSteps = [
      { recipeId: "r1", recipeName: "Pasta", instruction: "Boil water" },
      { recipeId: "r2", recipeName: "Salad", instruction: "Chop lettuce" },
    ];
    mockMaybeSingle.mockResolvedValue({ data: { steps: cachedSteps }, error: null });

    const recipes = [
      { id: "r1", name: "Pasta", instructions: ["Boil water"] },
      { id: "r2", name: "Salad", instructions: ["Chop lettuce"] },
    ];

    const { result } = renderHook(() =>
      useCookMode({ eventId: "event-1", recipes })
    );

    await act(async () => {
      await result.current.generateTimeline();
    });

    expect(result.current.timeline).toEqual(cachedSteps);
    expect(mockInvoke).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
  });

  it("multi-recipe: calls edge function on cache miss", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    const generatedSteps = [
      { recipeId: "r1", recipeName: "Pasta", instruction: "Preheat oven" },
    ];
    mockInvoke.mockResolvedValue({
      data: { success: true, steps: generatedSteps },
      error: null,
    });

    const recipes = [
      { id: "r1", name: "Pasta", instructions: ["Step 1"] },
      { id: "r2", name: "Salad", instructions: ["Step A"] },
    ];

    const { result } = renderHook(() =>
      useCookMode({ eventId: "event-1", recipes })
    );

    await act(async () => {
      await result.current.generateTimeline();
    });

    expect(mockInvoke).toHaveBeenCalledWith(
      "generate-cook-timeline",
      expect.objectContaining({
        body: expect.objectContaining({
          eventId: "event-1",
          recipeIds: ["r1", "r2"],
          model: "claude-sonnet-4-6",
        }),
      })
    );
    expect(result.current.timeline).toEqual(generatedSteps);
  });

  it("sets error state when edge function returns an error", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockInvoke.mockResolvedValue({
      data: null,
      error: new Error("Network failure"),
    });

    const recipes = [
      { id: "r1", name: "Pasta", instructions: ["Step 1"] },
      { id: "r2", name: "Salad", instructions: ["Step A"] },
    ];

    const { result } = renderHook(() =>
      useCookMode({ eventId: "event-1", recipes })
    );

    await act(async () => {
      await result.current.generateTimeline();
    });

    expect(result.current.error).toBe("Network failure");
    expect(result.current.timeline).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it("does nothing when recipes is empty", async () => {
    const { result } = renderHook(() => useCookMode({ recipes: [] }));

    await act(async () => {
      await result.current.generateTimeline();
    });

    expect(result.current.timeline).toEqual([]);
    expect(mockInvoke).not.toHaveBeenCalled();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("multi-recipe without eventId: skips cache check and calls edge function", async () => {
    const generatedSteps = [
      { recipeId: "r1", recipeName: "Pasta", instruction: "Step 1" },
    ];
    mockInvoke.mockResolvedValue({
      data: { success: true, steps: generatedSteps },
      error: null,
    });

    const recipes = [
      { id: "r1", name: "Pasta", instructions: ["Step 1"] },
      { id: "r2", name: "Salad", instructions: ["Step A"] },
    ];

    const { result } = renderHook(() => useCookMode({ recipes }));

    await act(async () => {
      await result.current.generateTimeline();
    });

    // Cache check skipped since eventId is undefined, but recipe_ingredients is still fetched
    expect(mockFrom).toHaveBeenCalledWith("recipe_ingredients");
    expect(mockFrom).not.toHaveBeenCalledWith("cook_mode_timelines");
    expect(mockInvoke).toHaveBeenCalled();
    expect(result.current.timeline).toEqual(generatedSteps);
  });

  it("populates ingredientsByRecipe after generateTimeline", async () => {
    const ingredientRow = {
      id: "ing-1", recipe_id: "r1", name: "flour", quantity: 2, unit: "cup",
      category: "pantry", raw_text: "2 cups flour", sort_order: 0, created_at: null,
    };
    mockIngredientsIn.mockResolvedValue({ data: [ingredientRow], error: null });

    const recipe = { id: "r1", name: "Pasta", instructions: ["Boil water"] };
    const { result } = renderHook(() => useCookMode({ recipes: [recipe] }));

    await act(async () => {
      await result.current.generateTimeline();
    });

    expect(result.current.ingredientsByRecipe.get("r1")).toEqual([
      expect.objectContaining({ id: "ing-1", name: "flour", quantity: 2, unit: "cup" }),
    ]);
  });
});
