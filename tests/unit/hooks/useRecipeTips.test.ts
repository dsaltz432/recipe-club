import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const mockDelete = vi.fn();
const mockEqDelete = vi.fn(() => ({ eq: mockDelete }));
const mockInsert = vi.fn();
const mockOrderAsc = vi.fn();
const mockEqSelect = vi.fn(() => ({ order: mockOrderAsc }));
const mockSelectFn = vi.fn(() => ({ eq: mockEqSelect }));
const mockFrom = vi.fn((tableName: string) => {
  if (tableName === "recipe_tips") {
    return {
      select: mockSelectFn,
      insert: mockInsert,
      delete: vi.fn(() => ({ eq: mockDelete })),
    };
  }
  return {};
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
}));

import { useRecipeTips } from "@/hooks/useRecipeTips";

const tipRow = {
  id: "tip-1",
  recipe_id: "r1",
  user_id: "user-1",
  tip_text: "Use cold butter",
  created_at: "2026-01-01T00:00:00Z",
};

describe("useRecipeTips", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("initially has empty tips", () => {
    mockOrderAsc.mockResolvedValue({ data: [], error: null });
    const { result } = renderHook(() => useRecipeTips("r1"));
    expect(result.current.tips).toEqual([]);
  });

  it("fetchTips populates tips", async () => {
    mockOrderAsc.mockResolvedValue({ data: [tipRow], error: null });
    const { result } = renderHook(() => useRecipeTips("r1"));

    await act(async () => { await result.current.fetchTips(); });

    expect(result.current.tips).toEqual([
      { id: "tip-1", recipeId: "r1", userId: "user-1", tipText: "Use cold butter", createdAt: "2026-01-01T00:00:00Z" },
    ]);
  });

  it("addTip calls insert and refreshes", async () => {
    mockInsert.mockResolvedValue({ error: null });
    mockOrderAsc.mockResolvedValue({ data: [tipRow], error: null });

    const { result } = renderHook(() => useRecipeTips("r1"));
    let success: boolean;
    await act(async () => { success = await result.current.addTip("Use cold butter", "user-1"); });

    expect(success!).toBe(true);
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ recipe_id: "r1", user_id: "user-1", tip_text: "Use cold butter" })
    );
  });

  it("deleteTip removes tip from state", async () => {
    mockOrderAsc.mockResolvedValue({ data: [tipRow], error: null });
    mockDelete.mockResolvedValue({ error: null });

    const { result } = renderHook(() => useRecipeTips("r1"));
    await act(async () => { await result.current.fetchTips(); });

    let success: boolean;
    await act(async () => { success = await result.current.deleteTip("tip-1"); });

    expect(success!).toBe(true);
    expect(result.current.tips).toEqual([]);
  });

  it("addTip returns false on error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockInsert.mockResolvedValue({ error: { message: "Permission denied" } });
    mockOrderAsc.mockResolvedValue({ data: [], error: null });

    const { result } = renderHook(() => useRecipeTips("r1"));
    let success: boolean;
    await act(async () => { success = await result.current.addTip("tip", "user-1"); });

    expect(success!).toBe(false);
    vi.restoreAllMocks();
  });
});
