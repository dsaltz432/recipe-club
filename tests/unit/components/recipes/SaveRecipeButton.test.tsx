import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@tests/utils";
import SaveRecipeButton from "@/components/recipes/SaveRecipeButton";
import { toast } from "sonner";

// Mock Supabase
const mockSupabaseFrom = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => mockSupabaseFrom(...args),
  },
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const createMockQueryBuilder = (error: unknown = null) => ({
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockResolvedValue({ error }),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  then: vi.fn((resolve) => Promise.resolve({ error }).then(resolve)),
});

describe("SaveRecipeButton", () => {
  const defaultProps = {
    recipeId: "recipe-123",
    userId: "user-123",
    isSaved: false,
    onToggle: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders unsaved state", () => {
    mockSupabaseFrom.mockReturnValue(createMockQueryBuilder());
    render(<SaveRecipeButton {...defaultProps} />);

    const button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("title", "Save to collection");
  });

  it("renders saved state", () => {
    mockSupabaseFrom.mockReturnValue(createMockQueryBuilder());
    render(<SaveRecipeButton {...defaultProps} isSaved={true} />);

    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("title", "Remove from collection");
  });

  it("saves recipe when clicked in unsaved state", async () => {
    const mockBuilder = createMockQueryBuilder();
    mockSupabaseFrom.mockReturnValue(mockBuilder);

    render(<SaveRecipeButton {...defaultProps} />);

    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(mockSupabaseFrom).toHaveBeenCalledWith("saved_recipes");
      expect(defaultProps.onToggle).toHaveBeenCalledWith("recipe-123", true);
      expect(toast.success).toHaveBeenCalledWith("Recipe saved to collection");
    });
  });

  it("removes recipe when clicked in saved state", async () => {
    const mockBuilder = createMockQueryBuilder();
    // Make the chain resolve properly for delete
    mockBuilder.eq.mockImplementation(() => ({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }));
    mockSupabaseFrom.mockReturnValue(mockBuilder);

    render(<SaveRecipeButton {...defaultProps} isSaved={true} />);

    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(mockSupabaseFrom).toHaveBeenCalledWith("saved_recipes");
      expect(defaultProps.onToggle).toHaveBeenCalledWith("recipe-123", false);
      expect(toast.success).toHaveBeenCalledWith("Recipe removed from collection");
    });
  });

  it("handles save error", async () => {
    const mockBuilder = createMockQueryBuilder({ message: "Save error" });
    mockSupabaseFrom.mockReturnValue(mockBuilder);

    render(<SaveRecipeButton {...defaultProps} />);

    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to update saved recipe");
      expect(defaultProps.onToggle).not.toHaveBeenCalled();
    });
  });

  it("handles remove error", async () => {
    const mockBuilder = createMockQueryBuilder();
    mockBuilder.eq.mockImplementation(() => ({
      eq: vi.fn().mockResolvedValue({ error: { message: "Delete error" } }),
    }));
    mockSupabaseFrom.mockReturnValue(mockBuilder);

    render(<SaveRecipeButton {...defaultProps} isSaved={true} />);

    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to update saved recipe");
      expect(defaultProps.onToggle).not.toHaveBeenCalled();
    });
  });

  it("disables button while loading", async () => {
    // Create a slow-resolving promise
    let resolveInsert: (value: unknown) => void;
    const insertPromise = new Promise((resolve) => {
      resolveInsert = resolve;
    });

    const mockBuilder = {
      ...createMockQueryBuilder(),
      insert: vi.fn().mockReturnValue(insertPromise),
    };
    mockSupabaseFrom.mockReturnValue(mockBuilder);

    render(<SaveRecipeButton {...defaultProps} />);

    const button = screen.getByRole("button");
    fireEvent.click(button);

    // Button should be disabled while loading
    expect(button).toBeDisabled();

    // Resolve the promise
    resolveInsert!({ error: null });

    await waitFor(() => {
      expect(button).not.toBeDisabled();
    });
  });
});
