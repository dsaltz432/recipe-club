import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// Build per-chain mocks for Supabase builder pattern
const mockSelectEqThen = vi.fn();
const mockSelectEq = vi.fn(() => ({ then: mockSelectEqThen }));
const mockSelectFn = vi.fn(() => ({ eq: mockSelectEq }));

const mockDeleteEqUserEqRecipe = vi.fn();
const mockDeleteEqUser = vi.fn(() => ({ eq: mockDeleteEqUserEqRecipe }));
const mockDeleteFn = vi.fn(() => ({ eq: mockDeleteEqUser }));

const mockInsertFn = vi.fn();

const mockFrom = vi.fn(() => ({
  select: mockSelectFn,
  delete: mockDeleteFn,
  insert: mockInsertFn,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

import { useRecipeFavorites } from "@/hooks/useRecipeFavorites";

describe("useRecipeFavorites", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: select returns empty favorites
    mockSelectEqThen.mockImplementation((cb: (v: { data: unknown; error: unknown }) => void) => {
      cb({ data: [], error: null });
      return Promise.resolve({ data: [], error: null });
    });
    mockInsertFn.mockResolvedValue({ error: null });
    mockDeleteEqUserEqRecipe.mockResolvedValue({ error: null });
  });

  it("starts with empty favoriteIds when userId is undefined", () => {
    const { result } = renderHook(() => useRecipeFavorites(undefined));
    expect(result.current.favoriteIds.size).toBe(0);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("loads favorites for a logged-in user", async () => {
    mockSelectEqThen.mockImplementation((cb: (v: { data: unknown; error: unknown }) => void) => {
      cb({ data: [{ recipe_id: "r1" }, { recipe_id: "r2" }], error: null });
      return Promise.resolve({ data: [{ recipe_id: "r1" }, { recipe_id: "r2" }], error: null });
    });

    const { result } = renderHook(() => useRecipeFavorites("user-1"));

    // Wait for useEffect async load
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.favoriteIds.has("r1")).toBe(true);
    expect(result.current.favoriteIds.has("r2")).toBe(true);
  });

  it("toggleFavorite adds a new favorite optimistically", async () => {
    const { result } = renderHook(() => useRecipeFavorites("user-1"));

    await act(async () => {
      await result.current.toggleFavorite("r-new");
    });

    expect(result.current.favoriteIds.has("r-new")).toBe(true);
    expect(mockInsertFn).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "user-1", recipe_id: "r-new" })
    );
  });

  it("toggleFavorite removes an existing favorite optimistically", async () => {
    mockSelectEqThen.mockImplementation((cb: (v: { data: unknown; error: unknown }) => void) => {
      cb({ data: [{ recipe_id: "r-existing" }], error: null });
      return Promise.resolve({ data: [{ recipe_id: "r-existing" }], error: null });
    });

    const { result } = renderHook(() => useRecipeFavorites("user-1"));

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.favoriteIds.has("r-existing")).toBe(true);

    await act(async () => {
      await result.current.toggleFavorite("r-existing");
    });

    expect(result.current.favoriteIds.has("r-existing")).toBe(false);
    expect(mockDeleteFn).toHaveBeenCalled();
  });

  it("reverts optimistic add on insert error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockInsertFn.mockResolvedValue({ error: { message: "Insert failed" } });

    const { result } = renderHook(() => useRecipeFavorites("user-1"));

    await act(async () => {
      await result.current.toggleFavorite("r-fail");
    });

    // Optimistic add was reverted
    expect(result.current.favoriteIds.has("r-fail")).toBe(false);
    vi.restoreAllMocks();
  });

  it("reverts optimistic remove on delete error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockSelectEqThen.mockImplementation((cb: (v: { data: unknown; error: unknown }) => void) => {
      cb({ data: [{ recipe_id: "r-del-fail" }], error: null });
      return Promise.resolve({ data: [{ recipe_id: "r-del-fail" }], error: null });
    });
    mockDeleteEqUserEqRecipe.mockResolvedValue({ error: { message: "Delete failed" } });

    const { result } = renderHook(() => useRecipeFavorites("user-1"));

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      await result.current.toggleFavorite("r-del-fail");
    });

    // Optimistic remove was reverted
    expect(result.current.favoriteIds.has("r-del-fail")).toBe(true);
    vi.restoreAllMocks();
  });
});
