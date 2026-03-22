import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFrom = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

import { saveInstructionsEdit } from "@/lib/recipeActions";

describe("saveInstructionsEdit", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("saves instructions successfully", async () => {
    const mockEq = vi.fn().mockResolvedValue({ error: null });
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValue({ update: mockUpdate });

    const result = await saveInstructionsEdit("recipe-123", ["Step 1", "Step 2"]);

    expect(result).toEqual({ success: true });
    expect(mockFrom).toHaveBeenCalledWith("recipe_content");
    expect(mockUpdate).toHaveBeenCalledWith({ instructions: ["Step 1", "Step 2"] });
    expect(mockEq).toHaveBeenCalledWith("recipe_id", "recipe-123");
  });

  it("returns failure on DB error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const mockEq = vi.fn().mockResolvedValue({ error: { message: "Permission denied" } });
    mockFrom.mockReturnValue({ update: vi.fn().mockReturnValue({ eq: mockEq }) });

    const result = await saveInstructionsEdit("recipe-123", ["Step 1"]);

    expect(result).toEqual({ success: false, error: "Failed to save instructions" });
    vi.restoreAllMocks();
  });
});
