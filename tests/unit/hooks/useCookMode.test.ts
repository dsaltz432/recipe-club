import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const { mockMaybeSingle, mockEqHash, mockEqEvent, mockSelect, mockFrom, mockInvoke } =
  vi.hoisted(() => {
    const mockMaybeSingle = vi.fn();
    const mockEqHash = vi.fn(() => ({ maybeSingle: mockMaybeSingle }));
    const mockEqEvent = vi.fn(() => ({ eq: mockEqHash }));
    const mockSelect = vi.fn(() => ({ eq: mockEqEvent }));
    const mockFrom = vi.fn(() => ({ select: mockSelect }));
    const mockInvoke = vi.fn();
    return { mockMaybeSingle, mockEqHash, mockEqEvent, mockSelect, mockFrom, mockInvoke };
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
  });

  it("returns empty timeline, not loading, and no error initially", () => {
    const { result } = renderHook(() => useCookMode({ recipes: [] }));
    expect(result.current.timeline).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("single recipe: maps instructions to CookModeStep[] without calling edge function", async () => {
    const recipe = { id: "r1", name: "Pasta", instructions: ["Boil water", "Cook pasta"] };

    const { result } = renderHook(() =>
      useCookMode({ eventId: "event-1", recipes: [recipe] })
    );

    await act(async () => {
      await result.current.generateTimeline();
    });

    expect(result.current.timeline).toEqual([
      { recipeId: "r1", recipeName: "Pasta", instruction: "Boil water" },
      { recipeId: "r1", recipeName: "Pasta", instruction: "Cook pasta" },
    ]);
    expect(mockInvoke).not.toHaveBeenCalled();
    expect(mockFrom).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("single recipe with no instructions: produces empty timeline", async () => {
    const recipe = { id: "r1", name: "Pasta" };

    const { result } = renderHook(() => useCookMode({ recipes: [recipe] }));

    await act(async () => {
      await result.current.generateTimeline();
    });

    expect(result.current.timeline).toEqual([]);
    expect(mockInvoke).not.toHaveBeenCalled();
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

    // No cache check since eventId is undefined
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockInvoke).toHaveBeenCalled();
    expect(result.current.timeline).toEqual(generatedSteps);
  });
});
