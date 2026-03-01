import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@tests/utils";
import RecipeInputForm, {
  createInitialFormData,
  canSubmitRecipeForm,
  buildIngredientPayload,
  type RecipeFormData,
} from "@/components/recipes/RecipeInputForm";
import { createBlankRow, type IngredientRow } from "@/components/recipes/ingredientRowTypes";
import { toast } from "sonner";

// Mock Supabase (needed by upload utility)
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
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

describe("RecipeInputForm", () => {
  const defaultFormData = createInitialFormData();
  const onFormDataChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders name input and mode selector", () => {
    render(
      <RecipeInputForm formData={defaultFormData} onFormDataChange={onFormDataChange} />
    );

    expect(screen.getByLabelText(/recipe name/i)).toBeInTheDocument();
    expect(screen.getByText("URL")).toBeInTheDocument();
    expect(screen.getByText("Upload")).toBeInTheDocument();
    expect(screen.getByText("Manual")).toBeInTheDocument();
  });

  it("hides Manual button when showManualMode is false", () => {
    render(
      <RecipeInputForm
        formData={defaultFormData}
        onFormDataChange={onFormDataChange}
        showManualMode={false}
      />
    );

    expect(screen.getByText("URL")).toBeInTheDocument();
    expect(screen.getByText("Upload")).toBeInTheDocument();
    expect(screen.queryByText("Manual")).not.toBeInTheDocument();
  });

  it("renders URL input by default", () => {
    render(
      <RecipeInputForm formData={defaultFormData} onFormDataChange={onFormDataChange} />
    );

    expect(screen.getByLabelText(/recipe url/i)).toBeInTheDocument();
  });

  it("uses custom nameLabel and namePlaceholder", () => {
    render(
      <RecipeInputForm
        formData={defaultFormData}
        onFormDataChange={onFormDataChange}
        nameLabel="Meal Name *"
        namePlaceholder="Enter meal name"
      />
    );

    expect(screen.getByText("Meal Name *")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Enter meal name")).toBeInTheDocument();
  });

  it("calls onFormDataChange when name changes", () => {
    render(
      <RecipeInputForm formData={defaultFormData} onFormDataChange={onFormDataChange} />
    );

    fireEvent.change(screen.getByLabelText(/recipe name/i), {
      target: { value: "New Recipe" },
    });

    expect(onFormDataChange).toHaveBeenCalledWith(
      expect.objectContaining({ name: "New Recipe" })
    );
  });

  it("calls onFormDataChange when URL changes", () => {
    render(
      <RecipeInputForm formData={defaultFormData} onFormDataChange={onFormDataChange} />
    );

    fireEvent.change(screen.getByLabelText(/recipe url/i), {
      target: { value: "https://example.com" },
    });

    expect(onFormDataChange).toHaveBeenCalledWith(
      expect.objectContaining({ url: "https://example.com" })
    );
  });

  it("shows URL validation error for invalid URL", () => {
    const data: RecipeFormData = { ...defaultFormData, url: "not-a-url" };
    render(
      <RecipeInputForm formData={data} onFormDataChange={onFormDataChange} />
    );

    expect(screen.getByText(/URL must start with http/i)).toBeInTheDocument();
  });

  it("does not show URL validation error for empty URL", () => {
    render(
      <RecipeInputForm formData={defaultFormData} onFormDataChange={onFormDataChange} />
    );

    expect(screen.queryByText(/URL must start with http/i)).not.toBeInTheDocument();
  });

  it("applies border-red-500 class for invalid URL", () => {
    const data: RecipeFormData = { ...defaultFormData, url: "bad" };
    render(
      <RecipeInputForm formData={data} onFormDataChange={onFormDataChange} />
    );

    const urlInput = screen.getByLabelText(/recipe url/i);
    expect(urlInput.className).toContain("border-red-500");
  });
});

describe("RecipeInputForm - Mode Switching", () => {
  const onFormDataChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("switches to upload mode", () => {
    const data = createInitialFormData();
    render(
      <RecipeInputForm formData={data} onFormDataChange={onFormDataChange} />
    );

    fireEvent.click(screen.getByText("Upload"));

    expect(onFormDataChange).toHaveBeenCalledWith(
      expect.objectContaining({ inputMode: "upload" })
    );
  });

  it("switches to manual mode and clears URL", () => {
    const data: RecipeFormData = { ...createInitialFormData(), url: "https://example.com" };
    render(
      <RecipeInputForm formData={data} onFormDataChange={onFormDataChange} />
    );

    fireEvent.click(screen.getByText("Manual"));

    expect(onFormDataChange).toHaveBeenCalledWith(
      expect.objectContaining({ inputMode: "manual", url: "" })
    );
  });

  it("switches to URL mode and resets ingredient rows", () => {
    const data: RecipeFormData = {
      ...createInitialFormData(),
      inputMode: "manual",
      ingredientRows: [{ ...createBlankRow(), name: "Chicken" }],
    };
    render(
      <RecipeInputForm formData={data} onFormDataChange={onFormDataChange} />
    );

    fireEvent.click(screen.getByText("URL"));

    const call = onFormDataChange.mock.calls[0][0];
    expect(call.inputMode).toBe("url");
    expect(call.ingredientRows).toHaveLength(1);
    expect(call.ingredientRows[0].name).toBe("");
  });

  it("renders upload UI when in upload mode", () => {
    const data: RecipeFormData = { ...createInitialFormData(), inputMode: "upload" };
    render(
      <RecipeInputForm formData={data} onFormDataChange={onFormDataChange} />
    );

    expect(screen.getByLabelText("Upload photo or PDF")).toBeInTheDocument();
    expect(screen.queryByLabelText(/recipe url/i)).not.toBeInTheDocument();
  });

  it("renders manual mode UI", () => {
    const data: RecipeFormData = { ...createInitialFormData(), inputMode: "manual" };
    render(
      <RecipeInputForm formData={data} onFormDataChange={onFormDataChange} />
    );

    expect(screen.getByText("Ingredients")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add ingredient/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/recipe url/i)).not.toBeInTheDocument();
  });

  it("updates ingredient rows via onFormDataChange", () => {
    const data: RecipeFormData = { ...createInitialFormData(), inputMode: "manual" };
    render(
      <RecipeInputForm formData={data} onFormDataChange={onFormDataChange} />
    );

    fireEvent.change(screen.getByLabelText("Name for row 1"), {
      target: { value: "Tomato" },
    });

    expect(onFormDataChange).toHaveBeenCalledWith(
      expect.objectContaining({
        ingredientRows: expect.arrayContaining([
          expect.objectContaining({ name: "Tomato" }),
        ]),
      })
    );
  });
});

describe("RecipeInputForm - File Upload", () => {
  const onFormDataChange = vi.fn();
  const onUploadingChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uploads a file and updates URL and auto-fills name", async () => {
    mockUploadRecipeFile.mockResolvedValue("https://storage.example.com/recipe.jpg");
    const data: RecipeFormData = { ...createInitialFormData(), inputMode: "upload" };

    render(
      <RecipeInputForm
        formData={data}
        onFormDataChange={onFormDataChange}
        isUploading={false}
        onUploadingChange={onUploadingChange}
      />
    );

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["dummy"], "my-pasta-recipe.jpg", { type: "image/jpeg" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(mockUploadRecipeFile).toHaveBeenCalledWith(file);
      expect(toast.success).toHaveBeenCalledWith("File uploaded!");
    });

    expect(onUploadingChange).toHaveBeenCalledWith(true);
    expect(onFormDataChange).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "https://storage.example.com/recipe.jpg",
        name: "my pasta recipe",
      })
    );
    expect(onUploadingChange).toHaveBeenCalledWith(false);
  });

  it("does not auto-fill name when name already exists", async () => {
    mockUploadRecipeFile.mockResolvedValue("https://storage.example.com/recipe.jpg");
    const data: RecipeFormData = { ...createInitialFormData(), inputMode: "upload", name: "Existing" };

    render(
      <RecipeInputForm
        formData={data}
        onFormDataChange={onFormDataChange}
        onUploadingChange={onUploadingChange}
      />
    );

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["dummy"], "different.jpg", { type: "image/jpeg" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("File uploaded!");
    });

    // Should only update url, not name
    expect(onFormDataChange).toHaveBeenCalledWith(
      expect.objectContaining({ url: "https://storage.example.com/recipe.jpg", name: "Existing" })
    );
  });

  it("shows error toast on FileValidationError", async () => {
    mockUploadRecipeFile.mockRejectedValue(new FileValidationError("File too large"));
    const data: RecipeFormData = { ...createInitialFormData(), inputMode: "upload" };

    render(
      <RecipeInputForm
        formData={data}
        onFormDataChange={onFormDataChange}
        onUploadingChange={onUploadingChange}
      />
    );

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["dummy"], "big.jpg", { type: "image/jpeg" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("File too large");
    });
    expect(onUploadingChange).toHaveBeenCalledWith(false);
  });

  it("shows generic error toast on unknown upload error", async () => {
    mockUploadRecipeFile.mockRejectedValue(new Error("Network error"));
    const data: RecipeFormData = { ...createInitialFormData(), inputMode: "upload" };

    render(
      <RecipeInputForm
        formData={data}
        onFormDataChange={onFormDataChange}
        onUploadingChange={onUploadingChange}
      />
    );

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["dummy"], "recipe.jpg", { type: "image/jpeg" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to upload file");
    });
  });

  it("does nothing when no file is selected", () => {
    const data: RecipeFormData = { ...createInitialFormData(), inputMode: "upload" };

    render(
      <RecipeInputForm
        formData={data}
        onFormDataChange={onFormDataChange}
        onUploadingChange={onUploadingChange}
      />
    );

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [] } });

    expect(mockUploadRecipeFile).not.toHaveBeenCalled();
  });

  it("renders read-only URL input in upload mode", () => {
    const data: RecipeFormData = { ...createInitialFormData(), inputMode: "upload" };

    render(
      <RecipeInputForm formData={data} onFormDataChange={onFormDataChange} />
    );

    const urlInput = document.querySelector('input[type="url"]') as HTMLInputElement;
    expect(urlInput).toHaveAttribute("readonly");

    // Cover the onChange handler on the read-only URL input
    fireEvent.change(urlInput, { target: { value: "test" } });

    // Click upload button to trigger fileInputRef
    fireEvent.click(screen.getByLabelText("Upload photo or PDF"));
  });

  it("shows uploading state when isUploading is true", () => {
    const data: RecipeFormData = { ...createInitialFormData(), inputMode: "upload" };

    render(
      <RecipeInputForm
        formData={data}
        onFormDataChange={onFormDataChange}
        isUploading={true}
      />
    );

    const uploadButton = screen.getByLabelText("Upload photo or PDF");
    expect(uploadButton).toBeDisabled();
  });
});

describe("createInitialFormData", () => {
  it("returns default form data", () => {
    const data = createInitialFormData();
    expect(data.name).toBe("");
    expect(data.url).toBe("");
    expect(data.inputMode).toBe("url");
    expect(data.ingredientRows).toHaveLength(1);
    expect(data.ingredientRows[0].name).toBe("");
  });
});

describe("canSubmitRecipeForm", () => {
  it("returns false when name is empty", () => {
    const data = createInitialFormData();
    expect(canSubmitRecipeForm(data, false)).toBe(false);
  });

  it("returns false when isSubmitting", () => {
    const data: RecipeFormData = {
      ...createInitialFormData(),
      name: "Test",
      url: "https://example.com",
    };
    expect(canSubmitRecipeForm(data, true)).toBe(false);
  });

  it("returns false in URL mode without valid URL", () => {
    const data: RecipeFormData = { ...createInitialFormData(), name: "Test", url: "bad" };
    expect(canSubmitRecipeForm(data, false)).toBe(false);
  });

  it("returns true in URL mode with valid URL", () => {
    const data: RecipeFormData = {
      ...createInitialFormData(),
      name: "Test",
      url: "https://example.com",
    };
    expect(canSubmitRecipeForm(data, false)).toBe(true);
  });

  it("returns false in URL mode with empty URL", () => {
    const data: RecipeFormData = { ...createInitialFormData(), name: "Test" };
    expect(canSubmitRecipeForm(data, false)).toBe(false);
  });

  it("returns false in upload mode without valid URL", () => {
    const data: RecipeFormData = {
      ...createInitialFormData(),
      name: "Test",
      inputMode: "upload",
    };
    expect(canSubmitRecipeForm(data, false)).toBe(false);
  });

  it("returns true in upload mode with valid URL", () => {
    const data: RecipeFormData = {
      ...createInitialFormData(),
      name: "Test",
      inputMode: "upload",
      url: "https://example.com/file.jpg",
    };
    expect(canSubmitRecipeForm(data, false)).toBe(true);
  });

  it("returns false in manual mode without ingredient names", () => {
    const data: RecipeFormData = {
      ...createInitialFormData(),
      name: "Test",
      inputMode: "manual",
    };
    expect(canSubmitRecipeForm(data, false)).toBe(false);
  });

  it("returns true in manual mode with ingredient names", () => {
    const data: RecipeFormData = {
      ...createInitialFormData(),
      name: "Test",
      inputMode: "manual",
      ingredientRows: [{ ...createBlankRow(), name: "Chicken" }],
    };
    expect(canSubmitRecipeForm(data, false)).toBe(true);
  });

  it("returns false when name is whitespace-only", () => {
    const data: RecipeFormData = {
      ...createInitialFormData(),
      name: "   ",
      url: "https://example.com",
    };
    expect(canSubmitRecipeForm(data, false)).toBe(false);
  });

  it("returns false in manual pasteOnly mode without paste text", () => {
    const data: RecipeFormData = {
      ...createInitialFormData(),
      name: "Test",
      inputMode: "manual",
      pasteText: "",
    };
    expect(canSubmitRecipeForm(data, false, true)).toBe(false);
  });

  it("returns true in manual pasteOnly mode with paste text", () => {
    const data: RecipeFormData = {
      ...createInitialFormData(),
      name: "Test",
      inputMode: "manual",
      pasteText: "1 lb spaghetti",
    };
    expect(canSubmitRecipeForm(data, false, true)).toBe(true);
  });
});

describe("buildIngredientPayload", () => {
  it("filters empty rows and builds payload", () => {
    const rows: IngredientRow[] = [
      { id: "1", name: "Chicken breast", quantity: "2", unit: "lb", category: "meat" },
      { id: "2", name: "", quantity: "", unit: "", category: "other" },
      { id: "3", name: "Salt", quantity: "", unit: "", category: "spices" },
    ];

    const payload = buildIngredientPayload(rows);

    expect(payload).toHaveLength(2);
    expect(payload[0]).toEqual({
      name: "Chicken breast",
      quantity: 2,
      unit: "lb",
      category: "meat",
      sort_order: 0,
    });
    expect(payload[1]).toEqual({
      name: "Salt",
      quantity: 1,
      unit: null,
      category: "spices",
      sort_order: 1,
    });
  });

  it("handles fraction quantities", () => {
    const rows: IngredientRow[] = [
      { id: "1", name: "Flour", quantity: "1/2", unit: "cup", category: "baking" },
    ];

    const payload = buildIngredientPayload(rows);

    expect(payload[0].quantity).toBe(0.5);
  });

  it("returns empty array for all-empty rows", () => {
    const rows: IngredientRow[] = [
      { id: "1", name: "", quantity: "", unit: "", category: "other" },
    ];

    expect(buildIngredientPayload(rows)).toHaveLength(0);
  });

  it("trims name and unit", () => {
    const rows: IngredientRow[] = [
      { id: "1", name: "  Chicken  ", quantity: "1", unit: "  lb  ", category: "meat" },
    ];

    const payload = buildIngredientPayload(rows);
    expect(payload[0].name).toBe("Chicken");
    expect(payload[0].unit).toBe("lb");
  });
});
