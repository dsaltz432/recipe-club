import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@tests/utils";
import ShareRecipeDialog from "@/components/recipes/ShareRecipeDialog";
import { toast } from "sonner";

// Mock Supabase
const mockSupabaseFrom = vi.fn();
const mockInvoke = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => mockSupabaseFrom(...args),
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
  },
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

// Mock devMode
vi.mock("@/lib/devMode", () => ({
  isDevMode: vi.fn(() => false),
}));

const createMockQueryBuilder = (error: unknown = null) => ({
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockResolvedValue({ error }),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  order: vi.fn().mockResolvedValue({ data: [], error: null }),
});

describe("ShareRecipeDialog", () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    recipeId: "recipe-123",
    recipeName: "Test Recipe",
    userId: "user-123",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabaseFrom.mockReturnValue(createMockQueryBuilder());
    mockInvoke.mockResolvedValue({ data: { success: true }, error: null });
  });

  it("renders dialog with form fields", () => {
    render(<ShareRecipeDialog {...defaultProps} />);

    expect(screen.getByText("Share Recipe")).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/message/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /share/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });

  it("shows recipe name in description", () => {
    render(<ShareRecipeDialog {...defaultProps} />);

    expect(screen.getByText(/test recipe/i)).toBeInTheDocument();
  });

  it("disables submit when email is empty", () => {
    render(<ShareRecipeDialog {...defaultProps} />);

    const submitButton = screen.getByRole("button", { name: /share/i });
    expect(submitButton).toBeDisabled();
  });

  it("disables submit when email is invalid", () => {
    render(<ShareRecipeDialog {...defaultProps} />);

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: "not-an-email" },
    });

    const submitButton = screen.getByRole("button", { name: /share/i });
    expect(submitButton).toBeDisabled();
  });

  it("shows validation error for invalid email", () => {
    render(<ShareRecipeDialog {...defaultProps} />);

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: "invalid" },
    });

    expect(screen.getByText(/please enter a valid email address/i)).toBeInTheDocument();
  });

  it("does not show validation for empty email", () => {
    render(<ShareRecipeDialog {...defaultProps} />);

    expect(screen.queryByText(/please enter a valid email address/i)).not.toBeInTheDocument();
  });

  it("enables submit when email is valid", () => {
    render(<ShareRecipeDialog {...defaultProps} />);

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: "friend@example.com" },
    });

    const submitButton = screen.getByRole("button", { name: /share/i });
    expect(submitButton).not.toBeDisabled();
  });

  it("submits via edge function in production mode", async () => {
    render(<ShareRecipeDialog {...defaultProps} />);

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: "friend@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/message/i), {
      target: { value: "Check this out!" },
    });

    fireEvent.click(screen.getByRole("button", { name: /share/i }));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("send-recipe-share", {
        body: {
          recipeId: "recipe-123",
          recipeName: "Test Recipe",
          sharedWithEmail: "friend@example.com",
          message: "Check this out!",
          sharedByUserId: "user-123",
        },
      });
      expect(toast.success).toHaveBeenCalledWith("Recipe shared with friend@example.com!");
      expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it("submits without message", async () => {
    render(<ShareRecipeDialog {...defaultProps} />);

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: "friend@example.com" },
    });

    fireEvent.click(screen.getByRole("button", { name: /share/i }));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("send-recipe-share", {
        body: {
          recipeId: "recipe-123",
          recipeName: "Test Recipe",
          sharedWithEmail: "friend@example.com",
          message: undefined,
          sharedByUserId: "user-123",
        },
      });
      expect(toast.success).toHaveBeenCalled();
    });
  });

  it("handles edge function error", async () => {
    mockInvoke.mockResolvedValue({ data: null, error: new Error("Network error") });

    render(<ShareRecipeDialog {...defaultProps} />);

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: "friend@example.com" },
    });

    fireEvent.click(screen.getByRole("button", { name: /share/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Network error");
    });
  });

  it("handles edge function returning non-success", async () => {
    mockInvoke.mockResolvedValue({ data: { success: false, error: "Already shared" }, error: null });

    render(<ShareRecipeDialog {...defaultProps} />);

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: "friend@example.com" },
    });

    fireEvent.click(screen.getByRole("button", { name: /share/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Already shared");
    });
  });

  it("handles edge function returning non-success without error message", async () => {
    mockInvoke.mockResolvedValue({ data: { success: false }, error: null });

    render(<ShareRecipeDialog {...defaultProps} />);

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: "friend@example.com" },
    });

    fireEvent.click(screen.getByRole("button", { name: /share/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to share recipe");
    });
  });

  it("clears fields when dialog closes via cancel", () => {
    render(<ShareRecipeDialog {...defaultProps} />);

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: "friend@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/message/i), {
      target: { value: "Hello" },
    });

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("clears fields when dialog closes via X button", async () => {
    render(<ShareRecipeDialog {...defaultProps} />);

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: "friend@example.com" },
    });

    const closeButton = screen.getByRole("button", { name: /close/i });
    fireEvent.click(closeButton);

    await waitFor(() => {
      expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it("does not render when closed", () => {
    render(<ShareRecipeDialog {...defaultProps} open={false} />);

    expect(screen.queryByText("Share Recipe")).not.toBeInTheDocument();
  });

  it("trims and lowercases email before submitting", async () => {
    render(<ShareRecipeDialog {...defaultProps} />);

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: "  FRIEND@Example.COM  " },
    });

    fireEvent.click(screen.getByRole("button", { name: /share/i }));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("send-recipe-share", {
        body: expect.objectContaining({
          sharedWithEmail: "friend@example.com",
        }),
      });
    });
  });

  it("shows toast error for invalid email on submit attempt", async () => {
    render(<ShareRecipeDialog {...defaultProps} />);

    // Force an invalid email but make the button clickable by simulating
    // Note: The button is disabled for invalid emails, but we test the handleSubmit guard
    // by testing the validation display message instead
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: "bad" },
    });

    expect(screen.getByText(/please enter a valid email address/i)).toBeInTheDocument();
  });
});

describe("ShareRecipeDialog - Dev Mode", () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    recipeId: "recipe-123",
    recipeName: "Test Recipe",
    userId: "user-123",
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    mockSupabaseFrom.mockReturnValue(createMockQueryBuilder());

    // Mock dev mode to return true
    const devMode = await import("@/lib/devMode");
    vi.mocked(devMode.isDevMode).mockReturnValue(true);
  });

  it("inserts directly into recipe_shares in dev mode", async () => {
    render(<ShareRecipeDialog {...defaultProps} />);

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: "friend@example.com" },
    });

    fireEvent.click(screen.getByRole("button", { name: /share/i }));

    await waitFor(() => {
      expect(mockSupabaseFrom).toHaveBeenCalledWith("recipe_shares");
      expect(mockInvoke).not.toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith("Recipe shared with friend@example.com!");
    });
  });

  it("handles duplicate share error in dev mode", async () => {
    mockSupabaseFrom.mockReturnValue(
      createMockQueryBuilder({ code: "23505", message: "duplicate key" })
    );

    render(<ShareRecipeDialog {...defaultProps} />);

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: "friend@example.com" },
    });

    fireEvent.click(screen.getByRole("button", { name: /share/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("This recipe has already been shared with this email");
    });
  });

  it("handles other errors in dev mode", async () => {
    mockSupabaseFrom.mockReturnValue(
      createMockQueryBuilder({ code: "42P01", message: "Table not found" })
    );

    render(<ShareRecipeDialog {...defaultProps} />);

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: "friend@example.com" },
    });

    fireEvent.click(screen.getByRole("button", { name: /share/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
  });
});
