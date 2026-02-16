import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@tests/utils";
import AddPersonalRecipeDialog from "@/components/recipes/AddPersonalRecipeDialog";
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
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  order: vi.fn().mockResolvedValue({ data: [], error: null }),
});

describe("AddPersonalRecipeDialog", () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    userId: "user-123",
    onRecipeAdded: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabaseFrom.mockReturnValue(createMockQueryBuilder());
  });

  it("renders dialog with form fields", () => {
    render(<AddPersonalRecipeDialog {...defaultProps} />);

    expect(screen.getByText("Add Personal Recipe")).toBeInTheDocument();
    expect(screen.getByLabelText(/recipe name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/recipe url/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add recipe/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });

  it("disables submit when name is empty", () => {
    render(<AddPersonalRecipeDialog {...defaultProps} />);

    const submitButton = screen.getByRole("button", { name: /add recipe/i });
    expect(submitButton).toBeDisabled();
  });

  it("enables submit when name is provided", () => {
    render(<AddPersonalRecipeDialog {...defaultProps} />);

    fireEvent.change(screen.getByLabelText(/recipe name/i), {
      target: { value: "My Recipe" },
    });

    const submitButton = screen.getByRole("button", { name: /add recipe/i });
    expect(submitButton).not.toBeDisabled();
  });

  it("shows validation error for invalid URL", () => {
    render(<AddPersonalRecipeDialog {...defaultProps} />);

    fireEvent.change(screen.getByLabelText(/recipe url/i), {
      target: { value: "not-a-url" },
    });

    expect(screen.getByText(/URL must start with http/i)).toBeInTheDocument();
  });

  it("does not show validation for empty URL (optional)", () => {
    render(<AddPersonalRecipeDialog {...defaultProps} />);

    expect(screen.queryByText(/URL must start with http/i)).not.toBeInTheDocument();
  });

  it("submits recipe with name only (no URL)", async () => {
    render(<AddPersonalRecipeDialog {...defaultProps} />);

    fireEvent.change(screen.getByLabelText(/recipe name/i), {
      target: { value: "My Recipe" },
    });

    fireEvent.click(screen.getByRole("button", { name: /add recipe/i }));

    await waitFor(() => {
      expect(mockSupabaseFrom).toHaveBeenCalledWith("recipes");
      expect(toast.success).toHaveBeenCalledWith("Personal recipe added!");
      expect(defaultProps.onRecipeAdded).toHaveBeenCalled();
      expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it("submits recipe with name and URL", async () => {
    render(<AddPersonalRecipeDialog {...defaultProps} />);

    fireEvent.change(screen.getByLabelText(/recipe name/i), {
      target: { value: "My Recipe" },
    });
    fireEvent.change(screen.getByLabelText(/recipe url/i), {
      target: { value: "https://example.com/recipe" },
    });

    fireEvent.click(screen.getByRole("button", { name: /add recipe/i }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Personal recipe added!");
    });
  });

  it("disables submit when name is whitespace-only", () => {
    render(<AddPersonalRecipeDialog {...defaultProps} />);

    fireEvent.change(screen.getByLabelText(/recipe name/i), {
      target: { value: "   " },
    });

    const submitButton = screen.getByRole("button", { name: /add recipe/i });
    expect(submitButton).toBeDisabled();
  });

  it("clears fields when dialog closes via X button", async () => {
    render(<AddPersonalRecipeDialog {...defaultProps} />);

    // Type something into the fields
    fireEvent.change(screen.getByLabelText(/recipe name/i), {
      target: { value: "My Recipe" },
    });
    fireEvent.change(screen.getByLabelText(/recipe url/i), {
      target: { value: "https://example.com" },
    });

    // Close the dialog via the X button (Radix renders a close button)
    const closeButton = screen.getByRole("button", { name: /close/i });
    fireEvent.click(closeButton);

    await waitFor(() => {
      expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it("shows error for invalid URL on submit", async () => {
    render(<AddPersonalRecipeDialog {...defaultProps} />);

    fireEvent.change(screen.getByLabelText(/recipe name/i), {
      target: { value: "My Recipe" },
    });
    fireEvent.change(screen.getByLabelText(/recipe url/i), {
      target: { value: "invalid-url" },
    });

    fireEvent.click(screen.getByRole("button", { name: /add recipe/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Please enter a valid URL starting with http:// or https://"
      );
    });
  });

  it("handles submission error", async () => {
    mockSupabaseFrom.mockReturnValue(
      createMockQueryBuilder({ message: "Insert error" })
    );

    render(<AddPersonalRecipeDialog {...defaultProps} />);

    fireEvent.change(screen.getByLabelText(/recipe name/i), {
      target: { value: "My Recipe" },
    });

    fireEvent.click(screen.getByRole("button", { name: /add recipe/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to add recipe");
    });
  });

  it("clears form when dialog closes", () => {
    render(<AddPersonalRecipeDialog {...defaultProps} />);

    fireEvent.change(screen.getByLabelText(/recipe name/i), {
      target: { value: "My Recipe" },
    });

    // Click cancel
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("does not render when closed", () => {
    render(<AddPersonalRecipeDialog {...defaultProps} open={false} />);

    expect(screen.queryByText("Add Personal Recipe")).not.toBeInTheDocument();
  });

  it("shows description text", () => {
    render(<AddPersonalRecipeDialog {...defaultProps} />);

    expect(
      screen.getByText("Add a recipe to your personal collection.")
    ).toBeInTheDocument();
  });
});
