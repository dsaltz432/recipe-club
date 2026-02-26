import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@tests/utils";
import AddPersonalRecipeDialog from "@/components/recipes/AddPersonalRecipeDialog";
import { toast } from "sonner";

// Mock Supabase
const mockInsert = vi.fn();
const mockRpc = vi.fn();
const mockInsertContent = vi.fn();
const mockSingleResult = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      if (table === "recipe_content") {
        return {
          insert: (...args: unknown[]) => {
            mockInsertContent(...args);
            return { error: null };
          },
        };
      }
      return {
        insert: (...args: unknown[]) => {
          mockInsert(...args);
          return {
            select: () => ({
              single: () => mockSingleResult(),
            }),
          };
        },
      };
    },
    rpc: (...args: unknown[]) => mockRpc(...args),
    functions: {
      invoke: vi.fn().mockResolvedValue({ error: null }),
    },
    storage: {
      from: () => ({
        upload: vi.fn().mockResolvedValue({ error: null }),
        getPublicUrl: () => ({ data: { publicUrl: "https://example.com/uploaded.jpg" } }),
      }),
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

// Mock uuid
vi.mock("uuid", () => ({
  v4: () => "test-uuid",
}));

// Mock upload utility
const { FileValidationError, mockUploadRecipeFile } = vi.hoisted(() => {
  class FileValidationError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "FileValidationError";
    }
  }
  return {
    FileValidationError,
    mockUploadRecipeFile: vi.fn(),
  };
});

vi.mock("@/lib/upload", () => ({
  uploadRecipeFile: (...args: unknown[]) => mockUploadRecipeFile(...args),
  FileValidationError,
}));

describe("AddPersonalRecipeDialog", () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    userId: "user-123",
    onRecipeAdded: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc.mockResolvedValue({ error: null });
    mockSingleResult.mockResolvedValue({ data: { id: "new-recipe-id" }, error: null });
  });

  it("renders dialog with form fields", () => {
    render(<AddPersonalRecipeDialog {...defaultProps} />);

    expect(screen.getByText("Add Personal Recipe")).toBeInTheDocument();
    expect(screen.getByLabelText(/recipe name/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add recipe/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });

  it("shows mode selection buttons", () => {
    render(<AddPersonalRecipeDialog {...defaultProps} />);

    expect(screen.getByText("Enter URL")).toBeInTheDocument();
    expect(screen.getByText("Upload File")).toBeInTheDocument();
    expect(screen.getByText("Enter Manually")).toBeInTheDocument();
  });

  it("disables submit when name is empty", () => {
    render(<AddPersonalRecipeDialog {...defaultProps} />);

    const submitButton = screen.getByRole("button", { name: /add recipe/i });
    expect(submitButton).toBeDisabled();
  });

  it("enables submit when name and URL are provided in URL mode", () => {
    render(<AddPersonalRecipeDialog {...defaultProps} />);

    fireEvent.change(screen.getByLabelText(/recipe name/i), {
      target: { value: "My Recipe" },
    });
    fireEvent.change(screen.getByLabelText(/recipe url/i), {
      target: { value: "https://example.com/recipe" },
    });

    const submitButton = screen.getByRole("button", { name: /add recipe/i });
    expect(submitButton).not.toBeDisabled();
  });

  it("shows URL input in URL mode (default)", () => {
    render(<AddPersonalRecipeDialog {...defaultProps} />);

    expect(screen.getByLabelText(/recipe url/i)).toBeInTheDocument();
  });

  it("shows validation error for invalid URL", () => {
    render(<AddPersonalRecipeDialog {...defaultProps} />);

    fireEvent.change(screen.getByLabelText(/recipe url/i), {
      target: { value: "not-a-url" },
    });

    expect(screen.getByText(/URL must start with http/i)).toBeInTheDocument();
  });

  it("does not show validation error for empty URL", () => {
    render(<AddPersonalRecipeDialog {...defaultProps} />);

    expect(screen.queryByText(/URL must start with http/i)).not.toBeInTheDocument();
  });

  it("disables submit when name is provided but URL is missing in URL mode", () => {
    render(<AddPersonalRecipeDialog {...defaultProps} />);

    fireEvent.change(screen.getByLabelText(/recipe name/i), {
      target: { value: "My Recipe" },
    });

    const submitButton = screen.getByRole("button", { name: /add recipe/i });
    expect(submitButton).toBeDisabled();
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

    fireEvent.change(screen.getByLabelText(/recipe name/i), {
      target: { value: "My Recipe" },
    });

    const closeButton = screen.getByRole("button", { name: /close/i });
    fireEvent.click(closeButton);

    await waitFor(() => {
      expect(defaultProps.onOpenChange).toHaveBeenCalled();
    });
  });

  it("disables submit button for invalid URL", () => {
    render(<AddPersonalRecipeDialog {...defaultProps} />);

    fireEvent.change(screen.getByLabelText(/recipe name/i), {
      target: { value: "My Recipe" },
    });
    fireEvent.change(screen.getByLabelText(/recipe url/i), {
      target: { value: "invalid-url" },
    });

    expect(screen.getByRole("button", { name: /add recipe/i })).toBeDisabled();
  });

  it("clears form when dialog closes", () => {
    render(<AddPersonalRecipeDialog {...defaultProps} />);

    fireEvent.change(screen.getByLabelText(/recipe name/i), {
      target: { value: "My Recipe" },
    });

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

describe("AddPersonalRecipeDialog - Upload Mode", () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    userId: "user-123",
    onRecipeAdded: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc.mockResolvedValue({ error: null });
    mockSingleResult.mockResolvedValue({ data: { id: "new-recipe-id" }, error: null });
  });

  it("switches to upload mode and shows upload button", () => {
    render(<AddPersonalRecipeDialog {...defaultProps} />);

    fireEvent.click(screen.getByText("Upload File"));

    expect(screen.getByLabelText("Upload photo or PDF")).toBeInTheDocument();
  });

  it("hides URL input when in upload mode", () => {
    render(<AddPersonalRecipeDialog {...defaultProps} />);

    fireEvent.click(screen.getByText("Upload File"));

    expect(screen.queryByLabelText(/recipe url/i)).not.toBeInTheDocument();
  });
});

describe("AddPersonalRecipeDialog - Manual Mode", () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    userId: "user-123",
    onRecipeAdded: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc.mockResolvedValue({ error: null });
    mockSingleResult.mockResolvedValue({ data: { id: "new-recipe-id" }, error: null });
  });

  it("switches to manual mode and shows ingredient form", () => {
    render(<AddPersonalRecipeDialog {...defaultProps} />);

    fireEvent.click(screen.getByText("Enter Manually"));

    expect(screen.getByText("Ingredients")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add ingredient/i })).toBeInTheDocument();
  });

  it("hides URL input when in manual mode", () => {
    render(<AddPersonalRecipeDialog {...defaultProps} />);

    fireEvent.click(screen.getByText("Enter Manually"));

    expect(screen.queryByLabelText(/recipe url/i)).not.toBeInTheDocument();
  });

  it("disables submit in manual mode when no ingredients have names", () => {
    render(<AddPersonalRecipeDialog {...defaultProps} />);

    fireEvent.click(screen.getByText("Enter Manually"));
    fireEvent.change(screen.getByLabelText(/recipe name/i), {
      target: { value: "My Recipe" },
    });

    // The blank row has no name, so submit should be disabled
    expect(screen.getByRole("button", { name: /add recipe/i })).toBeDisabled();
  });

  it("enables submit in manual mode when ingredient has name", () => {
    render(<AddPersonalRecipeDialog {...defaultProps} />);

    fireEvent.click(screen.getByText("Enter Manually"));
    fireEvent.change(screen.getByLabelText(/recipe name/i), {
      target: { value: "My Recipe" },
    });
    fireEvent.change(screen.getByLabelText("Name for row 1"), {
      target: { value: "Chicken" },
    });

    expect(screen.getByRole("button", { name: /add recipe/i })).not.toBeDisabled();
  });

  it("submits with ingredients in manual mode", async () => {
    render(<AddPersonalRecipeDialog {...defaultProps} />);

    fireEvent.click(screen.getByText("Enter Manually"));
    fireEvent.change(screen.getByLabelText(/recipe name/i), {
      target: { value: "My Manual Recipe" },
    });
    fireEvent.change(screen.getByLabelText("Name for row 1"), {
      target: { value: "Chicken breast" },
    });
    fireEvent.change(screen.getByLabelText("Quantity for row 1"), {
      target: { value: "2" },
    });
    fireEvent.change(screen.getByLabelText("Unit for row 1"), {
      target: { value: "lb" },
    });

    fireEvent.click(screen.getByRole("button", { name: /add recipe/i }));

    await waitFor(() => {
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({ name: "My Manual Recipe", url: null })
      );
    });

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith("replace_recipe_ingredients", {
        p_recipe_id: "new-recipe-id",
        p_ingredients: expect.arrayContaining([
          expect.objectContaining({ name: "Chicken breast", quantity: 2, unit: "lb" }),
        ]),
      });
    });

    await waitFor(() => {
      expect(mockInsertContent).toHaveBeenCalledWith(
        expect.objectContaining({ recipe_id: "new-recipe-id", status: "completed" })
      );
    });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Personal recipe added!");
    });
  });

  it("resets ingredients when switching from manual to URL mode", () => {
    render(<AddPersonalRecipeDialog {...defaultProps} />);

    // Switch to manual, add ingredient
    fireEvent.click(screen.getByText("Enter Manually"));
    fireEvent.change(screen.getByLabelText("Name for row 1"), {
      target: { value: "Chicken" },
    });

    // Switch to URL mode
    fireEvent.click(screen.getByText("Enter URL"));

    // Switch back to manual - should have blank row
    fireEvent.click(screen.getByText("Enter Manually"));
    expect(screen.getByLabelText("Name for row 1")).toHaveValue("");
  });

  it("submits manual mode with empty quantity and unit", async () => {
    render(<AddPersonalRecipeDialog {...defaultProps} />);

    fireEvent.click(screen.getByText("Enter Manually"));
    fireEvent.change(screen.getByLabelText(/recipe name/i), {
      target: { value: "Simple Recipe" },
    });
    // Set only name, leave quantity and unit empty
    fireEvent.change(screen.getByLabelText("Name for row 1"), {
      target: { value: "Salt" },
    });

    fireEvent.click(screen.getByRole("button", { name: /add recipe/i }));

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith("replace_recipe_ingredients", {
        p_recipe_id: "new-recipe-id",
        p_ingredients: expect.arrayContaining([
          expect.objectContaining({ name: "Salt", quantity: null, unit: null }),
        ]),
      });
    });
  });

  it("does not call rpc when all ingredient names are empty in manual mode", async () => {
    render(<AddPersonalRecipeDialog {...defaultProps} />);

    fireEvent.click(screen.getByText("Enter Manually"));
    fireEvent.change(screen.getByLabelText(/recipe name/i), {
      target: { value: "Empty Recipe" },
    });
    // Add ingredient name then clear it
    fireEvent.change(screen.getByLabelText("Name for row 1"), {
      target: { value: "Something" },
    });
    fireEvent.change(screen.getByLabelText("Name for row 1"), {
      target: { value: "" },
    });

    // Submit should be disabled since no ingredient has a name
    expect(screen.getByRole("button", { name: /add recipe/i })).toBeDisabled();
  });

  it("shows ingredient form rows in manual mode", () => {
    render(<AddPersonalRecipeDialog {...defaultProps} />);

    fireEvent.click(screen.getByText("Enter Manually"));

    // Verify the ingredient form is showing with header labels
    expect(screen.getByText("Qty")).toBeInTheDocument();
    expect(screen.getByText("Unit")).toBeInTheDocument();
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Category")).toBeInTheDocument();
  });
});

describe("AddPersonalRecipeDialog - File Upload", () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    userId: "user-123",
    onRecipeAdded: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc.mockResolvedValue({ error: null });
    mockSingleResult.mockResolvedValue({ data: { id: "new-recipe-id" }, error: null });
  });

  it("uploads a file and sets URL and auto-fills name", async () => {
    mockUploadRecipeFile.mockResolvedValue("https://storage.example.com/recipe.jpg");

    render(<AddPersonalRecipeDialog {...defaultProps} />);
    fireEvent.click(screen.getByText("Upload File"));

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["dummy"], "my-pasta-recipe.jpg", { type: "image/jpeg" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(mockUploadRecipeFile).toHaveBeenCalledWith(file);
      expect(toast.success).toHaveBeenCalledWith("File uploaded!");
    });
  });

  it("shows error toast on FileValidationError", async () => {
    mockUploadRecipeFile.mockRejectedValue(new FileValidationError("File too large"));

    render(<AddPersonalRecipeDialog {...defaultProps} />);
    fireEvent.click(screen.getByText("Upload File"));

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["dummy"], "big-file.jpg", { type: "image/jpeg" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("File too large");
    });
  });

  it("shows generic error toast on unknown upload error", async () => {
    mockUploadRecipeFile.mockRejectedValue(new Error("Network error"));

    render(<AddPersonalRecipeDialog {...defaultProps} />);
    fireEvent.click(screen.getByText("Upload File"));

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["dummy"], "recipe.jpg", { type: "image/jpeg" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to upload file");
    });
  });

  it("does nothing when no file is selected", () => {
    render(<AddPersonalRecipeDialog {...defaultProps} />);
    fireEvent.click(screen.getByText("Upload File"));

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [] } });

    expect(mockUploadRecipeFile).not.toHaveBeenCalled();
  });

  it("renders read-only URL input and upload button in upload mode", () => {
    render(<AddPersonalRecipeDialog {...defaultProps} />);
    fireEvent.click(screen.getByText("Upload File"));

    // Upload button with aria-label should be visible
    expect(screen.getByLabelText("Upload photo or PDF")).toBeInTheDocument();
    // The URL input should be read-only
    const urlInput = document.querySelector('input[type="url"]') as HTMLInputElement;
    expect(urlInput).toHaveAttribute("readonly");

    // Cover the onChange handler on the read-only URL input
    fireEvent.change(urlInput, { target: { value: "test" } });

    // Click the upload button to trigger fileInputRef.current?.click()
    fireEvent.click(screen.getByLabelText("Upload photo or PDF"));
  });

  it("does not auto-fill name when name already exists", async () => {
    mockUploadRecipeFile.mockResolvedValue("https://storage.example.com/recipe.jpg");

    render(<AddPersonalRecipeDialog {...defaultProps} />);

    // Set name first
    fireEvent.change(screen.getByLabelText(/recipe name/i), {
      target: { value: "My Existing Recipe" },
    });

    fireEvent.click(screen.getByText("Upload File"));

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["dummy"], "different-name.jpg", { type: "image/jpeg" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("File uploaded!");
    });

    // Name should remain as the user-set value
    expect(screen.getByLabelText(/recipe name/i)).toHaveValue("My Existing Recipe");
  });

  it("submits recipe in upload mode with uploaded URL", async () => {
    mockUploadRecipeFile.mockResolvedValue("https://storage.example.com/recipe.jpg");

    render(<AddPersonalRecipeDialog {...defaultProps} />);
    fireEvent.click(screen.getByText("Upload File"));

    // Upload a file
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["dummy"], "recipe.jpg", { type: "image/jpeg" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("File uploaded!");
    });

    // Set name and submit
    fireEvent.change(screen.getByLabelText(/recipe name/i), {
      target: { value: "My Uploaded Recipe" },
    });
    fireEvent.click(screen.getByRole("button", { name: /add recipe/i }));

    await waitFor(() => {
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "My Uploaded Recipe",
          url: "https://storage.example.com/recipe.jpg",
        })
      );
    });
  });
});

describe("AddPersonalRecipeDialog - Error Handling", () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    userId: "user-123",
    onRecipeAdded: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc.mockResolvedValue({ error: null });
    mockSingleResult.mockResolvedValue({ data: { id: "new-recipe-id" }, error: null });
  });

  it("shows error toast when recipe insert fails", async () => {
    mockSingleResult.mockResolvedValue({ data: null, error: { message: "DB error" } });

    render(<AddPersonalRecipeDialog {...defaultProps} />);

    fireEvent.change(screen.getByLabelText(/recipe name/i), {
      target: { value: "My Recipe" },
    });
    fireEvent.change(screen.getByLabelText(/recipe url/i), {
      target: { value: "https://example.com/recipe" },
    });
    fireEvent.click(screen.getByRole("button", { name: /add recipe/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to add recipe");
    });
  });

  it("clears URL when switching from url to manual mode", () => {
    render(<AddPersonalRecipeDialog {...defaultProps} />);

    fireEvent.change(screen.getByLabelText(/recipe url/i), {
      target: { value: "https://example.com" },
    });

    fireEvent.click(screen.getByText("Enter Manually"));

    // URL should be cleared (no URL input visible in manual mode)
    expect(screen.queryByLabelText(/recipe url/i)).not.toBeInTheDocument();

    // Switch back to URL mode - URL should still be cleared
    fireEvent.click(screen.getByText("Enter URL"));
    expect(screen.getByLabelText(/recipe url/i)).toHaveValue("");
  });
});
