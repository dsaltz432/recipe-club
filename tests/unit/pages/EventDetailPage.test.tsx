import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// --- Mocks ---

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockSupabaseFrom = vi.fn();
const mockRpc = vi.fn();
const mockFunctionsInvoke = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => mockSupabaseFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
    functions: {
      invoke: (...args: unknown[]) => mockFunctionsInvoke(...args),
    },
  },
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn().mockResolvedValue({
    id: "user-123",
    name: "Test User",
    email: "test@example.com",
    avatar_url: null,
  }),
  getAllowedUser: vi.fn().mockResolvedValue({ is_club_member: true, role: "admin" }),
  isAdmin: vi.fn().mockReturnValue(true),
  signOut: vi.fn(),
}));

vi.mock("@/lib/googleCalendar", () => ({
  updateCalendarEvent: vi.fn().mockResolvedValue({ success: true }),
  deleteCalendarEvent: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("@/lib/devMode", () => ({
  isDevMode: vi.fn().mockReturnValue(false),
}));

vi.mock("@/lib/upload", () => ({
  uploadRecipeFile: vi.fn(),
  FileValidationError: class extends Error {
    constructor(msg: string) {
      super(msg);
      this.name = "FileValidationError";
    }
  },
}));

vi.mock("@/lib/pantry", () => ({
  getPantryItems: vi.fn().mockResolvedValue([]),
  ensureDefaultPantryItems: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/groceryList", () => ({
  smartCombineIngredients: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/groceryCache", () => ({
  loadGroceryCache: vi.fn().mockResolvedValue(null),
  saveGroceryCache: vi.fn(),
  deleteGroceryCache: vi.fn(),
}));

vi.mock("@/lib/ingredientColors", () => ({
  getIngredientColor: (name: string) => `#color-${name}`,
  getLightBackgroundColor: () => "#fff",
  getBorderColor: () => "#ccc",
  getDarkerTextColor: () => "#333",
}));

// Mock child components that are complex
vi.mock("@/components/events/EventRatingDialog", () => ({
  default: () => <div data-testid="rating-dialog" />,
}));

vi.mock("@/components/events/EventRecipesTab", () => ({
  default: ({
    onAddRecipeClick,
    onEditRecipeClick,
  }: {
    onAddRecipeClick: () => void;
    onEditRecipeClick: (recipe: { id: string; name: string; url?: string }) => void;
  }) => (
    <div data-testid="event-recipes-tab">
      <button onClick={onAddRecipeClick}>Add Recipe</button>
      <button
        onClick={() =>
          onEditRecipeClick({ id: "recipe-1", name: "Pasta", url: "https://example.com/pasta" })
        }
      >
        Edit Recipe With URL
      </button>
      <button
        onClick={() =>
          onEditRecipeClick({ id: "recipe-2", name: "Salad" })
        }
      >
        Edit Recipe No URL
      </button>
    </div>
  ),
}));

vi.mock("@/components/recipes/PhotoUpload", () => ({
  default: () => <div data-testid="photo-upload" />,
}));

vi.mock("@/components/recipes/GroceryListSection", () => ({
  default: () => <div data-testid="grocery-section" />,
}));

vi.mock("@/components/pantry/PantryDialog", () => ({
  default: () => <div data-testid="pantry-dialog" />,
}));

vi.mock("@/components/pantry/PantrySection", () => ({
  default: () => <div data-testid="pantry-section" />,
}));

// --- Helpers ---

const createMockQueryBuilder = (overrides: Record<string, unknown> = {}) => {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    ...overrides,
  };
  return builder;
};

const eventData = {
  id: "event-1",
  ingredient_id: "ing-1",
  event_date: "2026-03-01",
  event_time: "19:00",
  created_by: "user-123",
  status: "scheduled",
  calendar_event_id: null,
  type: "club",
  ingredients: { name: "Tomato", color: "#ff0000" },
};

const recipeData = [
  {
    id: "recipe-1",
    name: "Pasta",
    url: "https://example.com/pasta",
    event_id: "event-1",
    ingredient_id: "ing-1",
    created_by: "user-123",
    created_at: "2026-02-01T00:00:00Z",
    profiles: { name: "Test User", avatar_url: null },
  },
];

// Setup supabase mocks for the initial data load
const setupLoadMocks = () => {
  mockSupabaseFrom.mockImplementation((table: string) => {
    if (table === "scheduled_events") {
      return createMockQueryBuilder({
        single: vi.fn().mockResolvedValue({ data: eventData, error: null }),
      });
    }
    if (table === "recipes") {
      return createMockQueryBuilder({
        order: vi.fn().mockResolvedValue({ data: recipeData, error: null }),
        single: vi.fn().mockResolvedValue({
          data: { id: "new-recipe", name: "New", url: "https://example.com" },
          error: null,
        }),
      });
    }
    if (table === "recipe_notes") {
      return createMockQueryBuilder({
        in: vi.fn().mockResolvedValue({ data: [], error: null }),
      });
    }
    if (table === "recipe_ratings") {
      return createMockQueryBuilder({
        in: vi.fn().mockResolvedValue({ data: [], error: null }),
      });
    }
    if (table === "recipe_ingredients") {
      return createMockQueryBuilder({
        in: vi.fn().mockResolvedValue({ data: [], error: null }),
      });
    }
    if (table === "recipe_content") {
      return createMockQueryBuilder({
        in: vi.fn().mockResolvedValue({ data: [], error: null }),
      });
    }
    return createMockQueryBuilder();
  });
};

// Import the component after mocks are set up
import EventDetailPage from "@/pages/EventDetailPage";

const renderPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/events/event-1"]}>
        <Routes>
          <Route path="/events/:eventId" element={<EventDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

// --- Tests ---

describe("EventDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupLoadMocks();
    mockRpc.mockResolvedValue({ data: null, error: null });
    mockFunctionsInvoke.mockResolvedValue({ data: null, error: null });
  });

  it("renders event details after loading", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Tomato")).toBeInTheDocument();
    });
    expect(screen.getByTestId("event-recipes-tab")).toBeInTheDocument();
  });

  describe("Add Recipe Dialog - dismissible during parsing", () => {
    it("allows closing dialog during parsing with confirm", async () => {
      const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
      renderPage();
      await waitFor(() => {
        expect(screen.getByText("Tomato")).toBeInTheDocument();
      });

      // Open add recipe dialog
      fireEvent.click(screen.getByText("Add Recipe"));
      await waitFor(() => {
        expect(screen.getByText("Add a Recipe")).toBeInTheDocument();
      });

      // Fill in the form
      fireEvent.change(screen.getByLabelText("Recipe Name *"), {
        target: { value: "New Recipe" },
      });
      fireEvent.change(screen.getByLabelText("Recipe URL"), {
        target: { value: "https://example.com/new" },
      });

      // Make parse-recipe return a pending promise (never resolves)
      mockFunctionsInvoke.mockReturnValue(new Promise(() => {}));

      // Click Add Recipe to start the parse flow
      fireEvent.click(screen.getByRole("button", { name: "Add Recipe" }));

      // Wait for the parsing state
      await waitFor(() => {
        expect(screen.getByText("Parsing ingredients & instructions")).toBeInTheDocument();
      });

      // Try to close the dialog (press Escape)
      fireEvent.keyDown(document, { key: "Escape" });

      // Should show confirm dialog
      expect(confirmSpy).toHaveBeenCalledWith(
        "Parsing is in progress. The recipe has been saved. Close anyway?"
      );

      confirmSpy.mockRestore();
    });

    it("keeps dialog open when user cancels the confirm", async () => {
      const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
      renderPage();
      await waitFor(() => {
        expect(screen.getByText("Tomato")).toBeInTheDocument();
      });

      // Open and fill in form
      fireEvent.click(screen.getByText("Add Recipe"));
      await waitFor(() => {
        expect(screen.getByText("Add a Recipe")).toBeInTheDocument();
      });
      fireEvent.change(screen.getByLabelText("Recipe Name *"), {
        target: { value: "New Recipe" },
      });
      fireEvent.change(screen.getByLabelText("Recipe URL"), {
        target: { value: "https://example.com/new" },
      });

      mockFunctionsInvoke.mockReturnValue(new Promise(() => {}));

      fireEvent.click(screen.getByRole("button", { name: "Add Recipe" }));
      await waitFor(() => {
        expect(screen.getByText("Parsing ingredients & instructions")).toBeInTheDocument();
      });

      // Close attempt - user cancels
      fireEvent.keyDown(document, { key: "Escape" });
      expect(confirmSpy).toHaveBeenCalled();

      // Dialog should still be open (parsing text still visible)
      expect(screen.getByText("Parsing ingredients & instructions")).toBeInTheDocument();

      confirmSpy.mockRestore();
    });
  });

  describe("Parse failure messaging", () => {
    const getToFailedState = async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText("Tomato")).toBeInTheDocument();
      });

      // Open dialog and fill form
      fireEvent.click(screen.getByText("Add Recipe"));
      await waitFor(() => {
        expect(screen.getByText("Add a Recipe")).toBeInTheDocument();
      });
      fireEvent.change(screen.getByLabelText("Recipe Name *"), {
        target: { value: "Failing Recipe" },
      });
      fireEvent.change(screen.getByLabelText("Recipe URL"), {
        target: { value: "https://example.com/fail" },
      });

      // Parse fails
      mockFunctionsInvoke.mockResolvedValueOnce({ data: null, error: new Error("Parse timeout") });

      fireEvent.click(screen.getByRole("button", { name: "Add Recipe" }));

      // Wait for failed state
      await waitFor(() => {
        expect(screen.getByText("Your recipe has been saved!")).toBeInTheDocument();
      });
    };

    it("shows recipe saved confirmation on parse failure", async () => {
      await getToFailedState();
      expect(screen.getByText("Your recipe has been saved!")).toBeInTheDocument();
      expect(
        screen.getByText("However, we couldn't extract ingredients automatically.")
      ).toBeInTheDocument();
      expect(screen.getByText("Parse timeout")).toBeInTheDocument();
    });

    it("shows 'Continue without ingredients' and 'Try parsing again' buttons", async () => {
      await getToFailedState();
      expect(
        screen.getByRole("button", { name: "Continue without ingredients" })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Try parsing again" })
      ).toBeInTheDocument();
    });

    it("'Continue without ingredients' closes dialog with success toast", async () => {
      await getToFailedState();

      // Reset mocks for the loadEventData call
      setupLoadMocks();

      fireEvent.click(screen.getByRole("button", { name: "Continue without ingredients" }));

      // Dialog should close
      await waitFor(() => {
        expect(screen.queryByText("Your recipe has been saved!")).not.toBeInTheDocument();
      });
    });

    it("'Try parsing again' retries and closes on success", async () => {
      await getToFailedState();

      // Mock successful parse on retry
      mockFunctionsInvoke.mockResolvedValueOnce({ data: { success: true }, error: null });
      setupLoadMocks();

      fireEvent.click(screen.getByRole("button", { name: "Try parsing again" }));

      // Should show parsing state
      await waitFor(() => {
        expect(screen.getByText("Parsing ingredients & instructions")).toBeInTheDocument();
      });

      // Should eventually close on success
      await waitFor(() => {
        expect(screen.queryByText("Parsing ingredients & instructions")).not.toBeInTheDocument();
      });
    });

    it("'Try parsing again' shows failure if retry fails", async () => {
      await getToFailedState();

      // Mock failed parse on retry
      mockFunctionsInvoke.mockResolvedValueOnce({
        data: null,
        error: new Error("Retry also failed"),
      });

      fireEvent.click(screen.getByRole("button", { name: "Try parsing again" }));

      // Should go back to failed state with new error
      await waitFor(() => {
        expect(screen.getByText("Your recipe has been saved!")).toBeInTheDocument();
        expect(screen.getByText("Retry also failed")).toBeInTheDocument();
      });
    });
  });

  describe("Edit Recipe Dialog - URL optional", () => {
    it("allows saving edit with empty URL", async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText("Tomato")).toBeInTheDocument();
      });

      // Click edit on a recipe (with URL)
      fireEvent.click(screen.getByText("Edit Recipe With URL"));
      await waitFor(() => {
        expect(screen.getByText("Edit Recipe")).toBeInTheDocument();
      });

      // Clear the URL field
      fireEvent.change(screen.getByLabelText("Recipe URL"), {
        target: { value: "" },
      });

      // Save button should still be enabled (name is filled)
      const saveButton = screen.getByRole("button", { name: "Save Changes" });
      expect(saveButton).not.toBeDisabled();
    });

    it("opens edit dialog for recipe without URL with Save enabled", async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText("Tomato")).toBeInTheDocument();
      });

      // Click edit on recipe without URL
      fireEvent.click(screen.getByText("Edit Recipe No URL"));
      await waitFor(() => {
        expect(screen.getByText("Edit Recipe")).toBeInTheDocument();
      });

      // URL field should be empty, Save should be enabled
      const urlInput = screen.getByLabelText("Recipe URL") as HTMLInputElement;
      expect(urlInput.value).toBe("");

      const saveButton = screen.getByRole("button", { name: "Save Changes" });
      expect(saveButton).not.toBeDisabled();
    });

    it("URL placeholder says optional", async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText("Tomato")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Edit Recipe With URL"));
      await waitFor(() => {
        expect(screen.getByText("Edit Recipe")).toBeInTheDocument();
      });

      const urlInput = screen.getByLabelText("Recipe URL") as HTMLInputElement;
      expect(urlInput.placeholder).toContain("optional");
    });

    it("still shows inline validation for invalid URL format", async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText("Tomato")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Edit Recipe With URL"));
      await waitFor(() => {
        expect(screen.getByText("Edit Recipe")).toBeInTheDocument();
      });

      // Enter invalid URL
      fireEvent.change(screen.getByLabelText("Recipe URL"), {
        target: { value: "not-a-url" },
      });

      expect(
        screen.getByText("URL must start with http:// or https://")
      ).toBeInTheDocument();
    });
  });

  describe("Upload button UX improvements", () => {
    it("upload button shows 'Upload' text label", async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText("Tomato")).toBeInTheDocument();
      });

      // Open add recipe dialog
      fireEvent.click(screen.getByText("Add Recipe"));
      await waitFor(() => {
        expect(screen.getByText("Add a Recipe")).toBeInTheDocument();
      });

      expect(screen.getByLabelText("Upload photo or PDF")).toBeInTheDocument();
      expect(screen.getByText("Upload")).toBeInTheDocument();
    });

    it("auto-fills recipe name from filename when name is empty", async () => {
      const { uploadRecipeFile } = await import("@/lib/upload");
      (uploadRecipeFile as ReturnType<typeof vi.fn>).mockResolvedValueOnce("https://storage.example.com/test.jpg");

      renderPage();
      await waitFor(() => {
        expect(screen.getByText("Tomato")).toBeInTheDocument();
      });

      // Open add recipe dialog
      fireEvent.click(screen.getByText("Add Recipe"));
      await waitFor(() => {
        expect(screen.getByText("Add a Recipe")).toBeInTheDocument();
      });

      // Upload a file without filling in the name
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(["data"], "chicken-tikka-masala.jpg", { type: "image/jpeg" });
      fireEvent.change(fileInput, { target: { files: [file] } });

      // Name should be auto-filled from filename
      await waitFor(() => {
        const nameInput = screen.getByLabelText("Recipe Name *") as HTMLInputElement;
        expect(nameInput.value).toBe("chicken tikka masala");
      });
    });

    it("does not overwrite existing recipe name on upload", async () => {
      const { uploadRecipeFile } = await import("@/lib/upload");
      (uploadRecipeFile as ReturnType<typeof vi.fn>).mockResolvedValueOnce("https://storage.example.com/test.jpg");

      renderPage();
      await waitFor(() => {
        expect(screen.getByText("Tomato")).toBeInTheDocument();
      });

      // Open add recipe dialog
      fireEvent.click(screen.getByText("Add Recipe"));
      await waitFor(() => {
        expect(screen.getByText("Add a Recipe")).toBeInTheDocument();
      });

      // Fill in name first
      fireEvent.change(screen.getByLabelText("Recipe Name *"), {
        target: { value: "My Custom Name" },
      });

      // Upload a file
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(["data"], "photo.jpg", { type: "image/jpeg" });
      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(uploadRecipeFile).toHaveBeenCalledWith(file);
      });

      // Name should NOT be overwritten
      const nameInput = screen.getByLabelText("Recipe Name *") as HTMLInputElement;
      expect(nameInput.value).toBe("My Custom Name");
    });
  });
});
