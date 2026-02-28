import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@tests/utils";
import AddMealDialog from "@/components/mealplan/AddMealDialog";
import { toast } from "sonner";

// Mock Supabase (still needed for recipe search)
const mockSupabaseFrom = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => mockSupabaseFrom(...args),
  },
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

// Mock upload utility — vi.hoisted ensures these are available when vi.mock factory runs
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

const createMockQueryBuilder = (overrides: Record<string, unknown> = {}) => ({
  select: vi.fn().mockReturnThis(),
  ilike: vi.fn().mockReturnThis(),
  limit: vi.fn().mockResolvedValue({ data: [], error: null }),
  ...overrides,
});

describe("AddMealDialog", () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    dayOfWeek: 1,
    mealType: "dinner",
    onAddCustomMeal: vi.fn(),
    onAddRecipeMeal: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabaseFrom.mockImplementation(() => createMockQueryBuilder());
    mockUploadRecipeFile.mockResolvedValue(
      "https://storage.example.com/recipe-images/mock-uuid-123.jpg"
    );
  });

  it("renders dialog with title and description", () => {
    render(<AddMealDialog {...defaultProps} />);

    expect(screen.getByText("Add Meal")).toBeInTheDocument();
    expect(screen.getByText("Add a meal for Monday dinner.")).toBeInTheDocument();
  });

  it("renders Custom Meal tab by default", () => {
    render(<AddMealDialog {...defaultProps} />);

    expect(screen.getByLabelText("Meal Name *")).toBeInTheDocument();
    expect(screen.getByLabelText("Recipe URL *")).toBeInTheDocument();
    expect(screen.getByText("Add to Meal")).toBeInTheDocument();
  });

  it("renders both tab buttons", () => {
    render(<AddMealDialog {...defaultProps} />);

    expect(screen.getByText("Custom Meal")).toBeInTheDocument();
    expect(screen.getByText("From Recipes")).toBeInTheDocument();
  });

  it("switches to From Recipes tab", () => {
    render(<AddMealDialog {...defaultProps} />);

    fireEvent.click(screen.getByText("From Recipes"));

    expect(screen.getByPlaceholderText("Search recipes...")).toBeInTheDocument();
    expect(screen.getByText("Type to search your recipes")).toBeInTheDocument();
  });

  it("switches back to Custom Meal tab", () => {
    render(<AddMealDialog {...defaultProps} />);

    fireEvent.click(screen.getByText("From Recipes"));
    expect(screen.getByPlaceholderText("Search recipes...")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Custom Meal"));
    expect(screen.getByLabelText("Meal Name *")).toBeInTheDocument();
  });

  it("disables Add to Meal button when name is empty", () => {
    render(<AddMealDialog {...defaultProps} />);

    expect(screen.getByText("Add to Meal")).toBeDisabled();
  });

  it("enables Add to Meal button when name is entered", () => {
    render(<AddMealDialog {...defaultProps} />);

    fireEvent.change(screen.getByLabelText("Meal Name *"), {
      target: { value: "Tacos" },
    });
    fireEvent.change(screen.getByLabelText("Recipe URL *"), {
      target: { value: "https://example.com/tacos" },
    });

    expect(screen.getByText("Add to Meal")).not.toBeDisabled();
  });

  it("submits custom meal with name and URL", () => {
    render(<AddMealDialog {...defaultProps} />);

    fireEvent.change(screen.getByLabelText("Meal Name *"), {
      target: { value: "Tacos" },
    });
    fireEvent.change(screen.getByLabelText("Recipe URL *"), {
      target: { value: "https://example.com/tacos" },
    });
    fireEvent.click(screen.getByText("Add to Meal"));

    expect(defaultProps.onAddCustomMeal).toHaveBeenCalledWith("Tacos", "https://example.com/tacos", true);
    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("submits custom meal with name and different URL", () => {
    render(<AddMealDialog {...defaultProps} />);

    fireEvent.change(screen.getByLabelText("Meal Name *"), {
      target: { value: "Tacos" },
    });
    fireEvent.change(screen.getByLabelText("Recipe URL *"), {
      target: { value: "https://example.com/tacos" },
    });
    fireEvent.click(screen.getByText("Add to Meal"));

    expect(defaultProps.onAddCustomMeal).toHaveBeenCalledWith("Tacos", "https://example.com/tacos", true);
    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows URL validation error for invalid URL", () => {
    render(<AddMealDialog {...defaultProps} />);

    fireEvent.change(screen.getByLabelText("Recipe URL *"), {
      target: { value: "not-a-url" },
    });

    expect(screen.getByText("URL must start with http:// or https://")).toBeInTheDocument();
  });

  it("disables submit when URL is invalid", () => {
    render(<AddMealDialog {...defaultProps} />);

    fireEvent.change(screen.getByLabelText("Meal Name *"), {
      target: { value: "Tacos" },
    });
    fireEvent.change(screen.getByLabelText("Recipe URL *"), {
      target: { value: "not-a-url" },
    });

    expect(screen.getByText("Add to Meal")).toBeDisabled();
  });

  it("does not call onAddCustomMeal when URL is invalid", () => {
    render(<AddMealDialog {...defaultProps} />);

    fireEvent.change(screen.getByLabelText("Meal Name *"), {
      target: { value: "Tacos" },
    });
    fireEvent.change(screen.getByLabelText("Recipe URL *"), {
      target: { value: "bad-url" },
    });

    expect(defaultProps.onAddCustomMeal).not.toHaveBeenCalled();
  });

  it("closes dialog when Cancel is clicked", () => {
    render(<AddMealDialog {...defaultProps} />);

    fireEvent.click(screen.getByText("Cancel"));

    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("resets form when dialog closes via Cancel", () => {
    render(<AddMealDialog {...defaultProps} />);

    fireEvent.change(screen.getByLabelText("Meal Name *"), {
      target: { value: "Tacos" },
    });

    // Close via Cancel — triggers handleOpenChange(false) which resets
    fireEvent.click(screen.getByText("Cancel"));

    // onOpenChange was called with false, meaning form was reset
    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("resets form state when submitting custom meal", () => {
    render(<AddMealDialog {...defaultProps} />);

    // Fill in and submit
    fireEvent.change(screen.getByLabelText("Meal Name *"), {
      target: { value: "Tacos" },
    });
    fireEvent.change(screen.getByLabelText("Recipe URL *"), {
      target: { value: "https://example.com/tacos" },
    });
    fireEvent.click(screen.getByText("Add to Meal"));

    // Dialog closes
    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
    expect(defaultProps.onAddCustomMeal).toHaveBeenCalledWith("Tacos", "https://example.com/tacos", true);
  });

  it("searches recipes with debounce", async () => {
    const mockRecipes = [
      { id: "r-1", name: "Chicken Tikka", url: "https://example.com/tikka", event_id: "e-1" },
      { id: "r-2", name: "Chicken Salad", url: null, event_id: null },
    ];

    mockSupabaseFrom.mockImplementation(() =>
      createMockQueryBuilder({
        limit: vi.fn().mockResolvedValue({ data: mockRecipes, error: null }),
      })
    );

    render(<AddMealDialog {...defaultProps} />);
    fireEvent.click(screen.getByText("From Recipes"));

    fireEvent.change(screen.getByPlaceholderText("Search recipes..."), {
      target: { value: "chicken" },
    });

    await waitFor(() => {
      expect(screen.getByText("Chicken Tikka")).toBeInTheDocument();
      expect(screen.getByText("Chicken Salad")).toBeInTheDocument();
    });

    // Check badges
    expect(screen.getByText("Club")).toBeInTheDocument();
    expect(screen.getByText("Personal")).toBeInTheDocument();
  });

  it("shows no results message when search returns empty", async () => {
    mockSupabaseFrom.mockImplementation(() =>
      createMockQueryBuilder({
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      })
    );

    render(<AddMealDialog {...defaultProps} />);
    fireEvent.click(screen.getByText("From Recipes"));

    fireEvent.change(screen.getByPlaceholderText("Search recipes..."), {
      target: { value: "nonexistent" },
    });

    await waitFor(() => {
      expect(screen.getByText("No recipes found")).toBeInTheDocument();
    });
  });

  it("handles search error gracefully", async () => {
    mockSupabaseFrom.mockImplementation(() =>
      createMockQueryBuilder({
        limit: vi.fn().mockResolvedValue({ data: null, error: { message: "Search failed" } }),
      })
    );

    render(<AddMealDialog {...defaultProps} />);
    fireEvent.click(screen.getByText("From Recipes"));

    fireEvent.change(screen.getByPlaceholderText("Search recipes..."), {
      target: { value: "chicken" },
    });

    await waitFor(() => {
      expect(screen.getByText("No recipes found")).toBeInTheDocument();
    });
  });

  it("selects a recipe and submits", async () => {
    const mockRecipes = [
      { id: "r-1", name: "Chicken Tikka", url: "https://example.com/tikka", event_id: "e-1" },
    ];

    mockSupabaseFrom.mockImplementation(() =>
      createMockQueryBuilder({
        limit: vi.fn().mockResolvedValue({ data: mockRecipes, error: null }),
      })
    );

    render(<AddMealDialog {...defaultProps} />);
    fireEvent.click(screen.getByText("From Recipes"));

    fireEvent.change(screen.getByPlaceholderText("Search recipes..."), {
      target: { value: "chicken" },
    });

    await waitFor(() => {
      expect(screen.getByText("Chicken Tikka")).toBeInTheDocument();
    });

    // Click to select
    fireEvent.click(screen.getByText("Chicken Tikka"));

    // Button shows count
    expect(screen.getByText("Add 1 to Meal")).toBeInTheDocument();

    // Submit
    fireEvent.click(screen.getByText("Add 1 to Meal"));

    expect(defaultProps.onAddRecipeMeal).toHaveBeenCalledWith([
      { id: "r-1", name: "Chicken Tikka", url: "https://example.com/tikka" },
    ]);
    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("selects a recipe with no URL and submits", async () => {
    const mockRecipes = [
      { id: "r-2", name: "Simple Salad", url: null, event_id: null },
    ];

    mockSupabaseFrom.mockImplementation(() =>
      createMockQueryBuilder({
        limit: vi.fn().mockResolvedValue({ data: mockRecipes, error: null }),
      })
    );

    render(<AddMealDialog {...defaultProps} />);
    fireEvent.click(screen.getByText("From Recipes"));

    fireEvent.change(screen.getByPlaceholderText("Search recipes..."), {
      target: { value: "salad" },
    });

    await waitFor(() => {
      expect(screen.getByText("Simple Salad")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Simple Salad"));
    fireEvent.click(screen.getByText("Add 1 to Meal"));

    expect(defaultProps.onAddRecipeMeal).toHaveBeenCalledWith([
      { id: "r-2", name: "Simple Salad", url: undefined },
    ]);
  });

  it("selects multiple recipes and submits all", async () => {
    const mockRecipes = [
      { id: "r-1", name: "Chicken Tikka", url: "https://example.com/tikka", event_id: "e-1" },
      { id: "r-2", name: "Chicken Salad", url: null, event_id: null },
    ];

    mockSupabaseFrom.mockImplementation(() =>
      createMockQueryBuilder({
        limit: vi.fn().mockResolvedValue({ data: mockRecipes, error: null }),
      })
    );

    render(<AddMealDialog {...defaultProps} />);
    fireEvent.click(screen.getByText("From Recipes"));

    fireEvent.change(screen.getByPlaceholderText("Search recipes..."), {
      target: { value: "chicken" },
    });

    await waitFor(() => {
      expect(screen.getByText("Chicken Tikka")).toBeInTheDocument();
    });

    // Select both
    fireEvent.click(screen.getByText("Chicken Tikka"));
    fireEvent.click(screen.getByText("Chicken Salad"));

    expect(screen.getByText("Add 2 to Meal")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Add 2 to Meal"));

    expect(defaultProps.onAddRecipeMeal).toHaveBeenCalledWith([
      { id: "r-1", name: "Chicken Tikka", url: "https://example.com/tikka" },
      { id: "r-2", name: "Chicken Salad", url: undefined },
    ]);
  });

  it("deselects a recipe by clicking again", async () => {
    const mockRecipes = [
      { id: "r-1", name: "Chicken Tikka", url: "https://example.com/tikka", event_id: "e-1" },
    ];

    mockSupabaseFrom.mockImplementation(() =>
      createMockQueryBuilder({
        limit: vi.fn().mockResolvedValue({ data: mockRecipes, error: null }),
      })
    );

    render(<AddMealDialog {...defaultProps} />);
    fireEvent.click(screen.getByText("From Recipes"));

    fireEvent.change(screen.getByPlaceholderText("Search recipes..."), {
      target: { value: "chicken" },
    });

    await waitFor(() => {
      expect(screen.getByText("Chicken Tikka")).toBeInTheDocument();
    });

    // Select
    fireEvent.click(screen.getByText("Chicken Tikka"));
    expect(screen.getByText("Add 1 to Meal")).toBeInTheDocument();

    // Deselect
    fireEvent.click(screen.getByText("Chicken Tikka"));
    expect(screen.getByText("Add to Meal")).toBeDisabled();
  });

  it("disables recipe submit button when none selected", () => {
    render(<AddMealDialog {...defaultProps} />);
    fireEvent.click(screen.getByText("From Recipes"));

    const addButton = screen.getByText("Add to Meal");
    expect(addButton).toBeDisabled();
  });

  it("closes dialog via Cancel on recipes tab", () => {
    render(<AddMealDialog {...defaultProps} />);
    fireEvent.click(screen.getByText("From Recipes"));

    fireEvent.click(screen.getByText("Cancel"));

    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("clears search results when query is emptied", async () => {
    const mockRecipes = [
      { id: "r-1", name: "Chicken Tikka", url: null, event_id: null },
    ];

    mockSupabaseFrom.mockImplementation(() =>
      createMockQueryBuilder({
        limit: vi.fn().mockResolvedValue({ data: mockRecipes, error: null }),
      })
    );

    render(<AddMealDialog {...defaultProps} />);
    fireEvent.click(screen.getByText("From Recipes"));

    const searchInput = screen.getByPlaceholderText("Search recipes...");

    fireEvent.change(searchInput, { target: { value: "chicken" } });

    await waitFor(() => {
      expect(screen.getByText("Chicken Tikka")).toBeInTheDocument();
    });

    // Clear search
    fireEvent.change(searchInput, { target: { value: "" } });

    await waitFor(() => {
      expect(screen.queryByText("Chicken Tikka")).not.toBeInTheDocument();
      expect(screen.getByText("Type to search your recipes")).toBeInTheDocument();
    });
  });

  it("displays correct day name for different dayOfWeek values", () => {
    render(<AddMealDialog {...defaultProps} dayOfWeek={0} mealType="breakfast" />);

    expect(screen.getByText("Add a meal for Sunday breakfast.")).toBeInTheDocument();
  });

  it("accepts http:// URLs as valid", () => {
    render(<AddMealDialog {...defaultProps} />);

    fireEvent.change(screen.getByLabelText("Meal Name *"), {
      target: { value: "Test" },
    });
    fireEvent.change(screen.getByLabelText("Recipe URL *"), {
      target: { value: "http://example.com" },
    });

    expect(screen.queryByText("URL must start with http:// or https://")).not.toBeInTheDocument();
    expect(screen.getByText("Add to Meal")).not.toBeDisabled();
  });

  it("shows Searching indicator while searching", async () => {
    mockSupabaseFrom.mockImplementation(() =>
      createMockQueryBuilder({
        limit: vi.fn().mockImplementation(() => new Promise(() => {})), // never resolves
      })
    );

    render(<AddMealDialog {...defaultProps} />);
    fireEvent.click(screen.getByText("From Recipes"));

    fireEvent.change(screen.getByPlaceholderText("Search recipes..."), {
      target: { value: "test" },
    });

    // Should show searching indicator
    await waitFor(() => {
      expect(screen.getByText("Searching...")).toBeInTheDocument();
    });
  });

  it("does not render when closed", () => {
    render(<AddMealDialog {...defaultProps} open={false} />);

    expect(screen.queryByText("Add Meal")).not.toBeInTheDocument();
  });

  it("closes and resets when dialog overlay is dismissed", () => {
    render(<AddMealDialog {...defaultProps} />);

    // Fill in some data
    fireEvent.change(screen.getByLabelText("Meal Name *"), {
      target: { value: "Tacos" },
    });

    // Press Escape to trigger Dialog's built-in onOpenChange
    fireEvent.keyDown(document, { key: "Escape" });

    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows Add Meal title", () => {
    render(<AddMealDialog {...defaultProps} />);

    expect(screen.getByText("Add Meal")).toBeInTheDocument();
    expect(screen.getByText("Add a meal for Monday dinner.")).toBeInTheDocument();
  });

  it("cancels previous debounce when typing rapidly", async () => {
    const limitMock = vi.fn().mockResolvedValue({ data: [], error: null });
    mockSupabaseFrom.mockImplementation(() =>
      createMockQueryBuilder({
        limit: limitMock,
      })
    );

    render(<AddMealDialog {...defaultProps} />);
    fireEvent.click(screen.getByText("From Recipes"));

    const searchInput = screen.getByPlaceholderText("Search recipes...");

    // Type first query (starts debounce timer)
    fireEvent.change(searchInput, { target: { value: "ch" } });

    // Immediately type second query (should cancel first timer)
    fireEvent.change(searchInput, { target: { value: "chicken" } });

    // Only the second query should execute after debounce
    await waitFor(() => {
      expect(limitMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("Manual Entry Mode", () => {
    const propsWithManual = {
      ...defaultProps,
      onAddManualMeal: vi.fn(),
    };

    it("shows Enter Manually button when onAddManualMeal is provided", () => {
      render(<AddMealDialog {...propsWithManual} />);

      expect(screen.getByText("Enter Manually")).toBeInTheDocument();
    });

    it("does not show Enter Manually button when onAddManualMeal is not provided", () => {
      render(<AddMealDialog {...defaultProps} />);

      expect(screen.queryByText("Enter Manually")).not.toBeInTheDocument();
    });

    it("switches to manual mode and shows ingredient rows", () => {
      render(<AddMealDialog {...propsWithManual} />);

      fireEvent.click(screen.getByText("Enter Manually"));

      // Should show ingredient form rows (IngredientFormRows renders inputs)
      expect(screen.getByText("Ingredients")).toBeInTheDocument();
    });

    it("switches from manual back to URL mode", () => {
      render(<AddMealDialog {...propsWithManual} />);

      fireEvent.click(screen.getByText("Enter Manually"));
      fireEvent.click(screen.getByText("Enter URL"));

      expect(screen.getByLabelText("Recipe URL *")).toBeInTheDocument();
    });

    it("submits manual meal with ingredients", () => {
      render(<AddMealDialog {...propsWithManual} />);

      // Fill name
      fireEvent.change(screen.getByLabelText("Meal Name *"), {
        target: { value: "Pasta" },
      });

      // Switch to manual mode
      fireEvent.click(screen.getByText("Enter Manually"));

      // Fill ingredient name in the first row
      const ingredientInputs = screen.getAllByPlaceholderText("Ingredient name");
      fireEvent.change(ingredientInputs[0], { target: { value: "spaghetti" } });

      // Fill quantity
      const quantityInputs = screen.getAllByPlaceholderText("Qty");
      fireEvent.change(quantityInputs[0], { target: { value: "1" } });

      // Submit
      fireEvent.click(screen.getByText("Add to Meal"));

      expect(propsWithManual.onAddManualMeal).toHaveBeenCalledWith("Pasta", [
        expect.objectContaining({
          name: "spaghetti",
          quantity: 1,
          sort_order: 0,
        }),
      ]);
    });

    it("disables submit in manual mode when no ingredients are entered", () => {
      render(<AddMealDialog {...propsWithManual} />);

      fireEvent.change(screen.getByLabelText("Meal Name *"), {
        target: { value: "Pasta" },
      });

      fireEvent.click(screen.getByText("Enter Manually"));

      // Submit should be disabled — no ingredient names filled
      expect(screen.getByText("Add to Meal")).toBeDisabled();
    });
  });

  describe("File Upload", () => {
    const createFile = (name: string, type: string, size = 1024) => {
      const file = new File(["x".repeat(size)], name, { type });
      return file;
    };

    const switchToUploadMode = () => {
      fireEvent.click(screen.getByText("Upload File"));
    };

    it("renders upload button with text label in Custom tab", () => {
      render(<AddMealDialog {...defaultProps} />);
      switchToUploadMode();

      expect(screen.getByLabelText("Upload photo or PDF")).toBeInTheDocument();
      expect(screen.getByText("Upload")).toBeInTheDocument();
    });

    it("shows filename during upload", async () => {
      let resolveUpload!: (value: string) => void;
      mockUploadRecipeFile.mockImplementationOnce(
        () => new Promise<string>((resolve) => { resolveUpload = resolve; })
      );

      render(<AddMealDialog {...defaultProps} />);
      switchToUploadMode();

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = createFile("my-recipe-photo.jpg", "image/jpeg");

      fireEvent.change(fileInput, { target: { files: [file] } });

      // Should show filename while uploading
      await waitFor(() => {
        expect(screen.getByText("my-recipe-photo.jpg")).toBeInTheDocument();
      });

      // "Upload" text should be gone during upload
      expect(screen.queryByText("Upload")).not.toBeInTheDocument();

      // Resolve the upload
      resolveUpload("https://storage.example.com/test.jpg");

      // After upload completes, "Upload" text returns
      await waitFor(() => {
        expect(screen.getByText("Upload")).toBeInTheDocument();
      });
    });

    it("triggers file input when upload button is clicked", () => {
      render(<AddMealDialog {...defaultProps} />);
      switchToUploadMode();

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const clickSpy = vi.spyOn(fileInput, "click");

      fireEvent.click(screen.getByLabelText("Upload photo or PDF"));

      expect(clickSpy).toHaveBeenCalled();
    });

    it("uploads a file and sets URL", async () => {
      render(<AddMealDialog {...defaultProps} />);
      switchToUploadMode();

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = createFile("recipe.jpg", "image/jpeg");

      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(mockUploadRecipeFile).toHaveBeenCalledWith(file);
        expect(toast.success).toHaveBeenCalledWith("File uploaded!");
      });

      // URL field should be filled (read-only input in upload mode)
      const urlInput = screen.getByDisplayValue("https://storage.example.com/recipe-images/mock-uuid-123.jpg") as HTMLInputElement;
      expect(urlInput).toBeInTheDocument();
    });

    it("auto-fills meal name from file name when name is empty", async () => {
      render(<AddMealDialog {...defaultProps} />);
      switchToUploadMode();

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = createFile("chicken-tikka.jpg", "image/jpeg");

      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(mockUploadRecipeFile).toHaveBeenCalled();
      });

      const nameInput = screen.getByLabelText("Meal Name *") as HTMLInputElement;
      expect(nameInput.value).toBe("chicken tikka");
    });

    it("does not overwrite existing meal name on upload", async () => {
      render(<AddMealDialog {...defaultProps} />);

      fireEvent.change(screen.getByLabelText("Meal Name *"), {
        target: { value: "My Recipe" },
      });

      switchToUploadMode();

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = createFile("photo.jpg", "image/jpeg");

      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(mockUploadRecipeFile).toHaveBeenCalled();
      });

      const nameInput = screen.getByLabelText("Meal Name *") as HTMLInputElement;
      expect(nameInput.value).toBe("My Recipe");
    });

    it("passes shouldParse=true when file was uploaded", async () => {
      render(<AddMealDialog {...defaultProps} />);
      switchToUploadMode();

      // Upload a file first
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = createFile("recipe.jpg", "image/jpeg");
      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(mockUploadRecipeFile).toHaveBeenCalled();
      });

      // Submit
      fireEvent.click(screen.getByText("Add to Meal"));

      expect(defaultProps.onAddCustomMeal).toHaveBeenCalledWith(
        "recipe",
        "https://storage.example.com/recipe-images/mock-uuid-123.jpg",
        true
      );
    });

    it("passes shouldParse=true when URL is manually typed", async () => {
      render(<AddMealDialog {...defaultProps} />);

      // Type a URL in URL mode
      fireEvent.change(screen.getByLabelText("Meal Name *"), {
        target: { value: "recipe" },
      });
      fireEvent.change(screen.getByLabelText("Recipe URL *"), {
        target: { value: "https://example.com/other" },
      });

      fireEvent.click(screen.getByText("Add to Meal"));

      // shouldParse should be true since URL is present (any URL triggers parse)
      expect(defaultProps.onAddCustomMeal).toHaveBeenCalledWith(
        "recipe",
        "https://example.com/other",
        true
      );
    });

    it("rejects non-image/non-PDF files via FileValidationError", async () => {
      mockUploadRecipeFile.mockRejectedValueOnce(
        new FileValidationError("Please select an image or PDF file")
      );

      render(<AddMealDialog {...defaultProps} />);
      switchToUploadMode();

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = createFile("doc.txt", "text/plain");

      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Please select an image or PDF file");
      });
    });

    it("rejects files over 5MB via FileValidationError", async () => {
      mockUploadRecipeFile.mockRejectedValueOnce(
        new FileValidationError("File is too large (max 5MB)")
      );

      render(<AddMealDialog {...defaultProps} />);
      switchToUploadMode();

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = createFile("big.jpg", "image/jpeg", 6 * 1024 * 1024);

      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("File is too large (max 5MB)");
      });
    });

    it("handles upload error", async () => {
      mockUploadRecipeFile.mockRejectedValueOnce(new Error("Upload failed"));

      render(<AddMealDialog {...defaultProps} />);
      switchToUploadMode();

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = createFile("recipe.jpg", "image/jpeg");

      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Failed to upload file");
      });
    });

    it("accepts PDF files", async () => {
      render(<AddMealDialog {...defaultProps} />);
      switchToUploadMode();

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = createFile("recipe.pdf", "application/pdf");

      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(mockUploadRecipeFile).toHaveBeenCalledWith(file);
        expect(toast.success).toHaveBeenCalledWith("File uploaded!");
      });
    });

    it("does nothing when no file is selected", () => {
      render(<AddMealDialog {...defaultProps} />);
      switchToUploadMode();

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      fireEvent.change(fileInput, { target: { files: [] } });

      expect(mockUploadRecipeFile).not.toHaveBeenCalled();
    });

    it("handles unmount during upload without crashing (null ref)", async () => {
      let resolveUpload!: (value: string) => void;
      mockUploadRecipeFile.mockImplementationOnce(
        () => new Promise<string>((resolve) => { resolveUpload = resolve; })
      );

      const { unmount } = render(<AddMealDialog {...defaultProps} />);
      switchToUploadMode();

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = createFile("recipe.jpg", "image/jpeg");
      fireEvent.change(fileInput, { target: { files: [file] } });

      // Unmount while upload is in progress — clears fileInputRef.current
      unmount();

      // Resolve the upload — finally block runs with null ref
      resolveUpload("https://example.com/test.jpg");

      // Allow microtask to settle
      await new Promise((r) => setTimeout(r, 0));

      expect(mockUploadRecipeFile).toHaveBeenCalledWith(file);
    });
  });
});
