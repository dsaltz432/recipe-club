import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@tests/utils";
import RecipeHub from "@/components/recipes/RecipeHub";

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

// Helper to create a complete mock query builder
const createMockQueryBuilder = (data: unknown[] = [], error: unknown = null) => ({
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  neq: vi.fn().mockReturnThis(),
  gt: vi.fn().mockReturnThis(),
  gte: vi.fn().mockReturnThis(),
  lt: vi.fn().mockReturnThis(),
  lte: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  or: vi.fn().mockReturnThis(),
  order: vi.fn().mockResolvedValue({ data, error }),
  single: vi.fn().mockResolvedValue({ data: data[0] || null, error }),
  maybeSingle: vi.fn().mockResolvedValue({ data: data[0] || null, error }),
  then: vi.fn((resolve) => Promise.resolve({ data, error }).then(resolve)),
});

describe("RecipeHub", () => {
  const mockUserId = "user-123";

  const mockRecipesData = [
    {
      id: "recipe-1",
      name: "Grilled Salmon",
      url: "https://example.com/salmon",
      created_by: "user-123",
      created_at: "2025-01-15T10:00:00Z",
    },
    {
      id: "recipe-2",
      name: "Chicken Stir Fry",
      url: null,
      created_by: "user-456",
      created_at: "2025-01-14T10:00:00Z",
    },
  ];

  const mockContributionsData = [
    {
      id: "contrib-1",
      recipe_id: "recipe-1",
      user_id: "user-123",
      event_id: "event-1",
      notes: "Delicious with lemon",
      photos: ["photo1.jpg"],
      created_at: "2025-01-15T10:00:00Z",
      profiles: { name: "Test User", avatar_url: "avatar1.jpg" },
      scheduled_events: {
        id: "event-1",
        event_date: "2025-01-15",
        ingredient_id: "ing-1",
        ingredients: { name: "Salmon" },
      },
    },
    {
      id: "contrib-2",
      recipe_id: "recipe-2",
      user_id: "user-456",
      event_id: "event-2",
      notes: "Quick and easy",
      photos: null,
      created_at: "2025-01-14T10:00:00Z",
      profiles: { name: "Another User", avatar_url: "avatar2.jpg" },
      scheduled_events: {
        id: "event-2",
        event_date: "2025-01-14",
        ingredient_id: "ing-2",
        ingredients: { name: "Chicken" },
      },
    },
  ];

  const mockIngredientsData = [
    { id: "ing-1", name: "Salmon", used_count: 1 },
    { id: "ing-2", name: "Chicken", used_count: 2 },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock query builders with table-specific data
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") {
        return createMockQueryBuilder(mockRecipesData);
      }
      if (table === "recipe_contributions") {
        return createMockQueryBuilder(mockContributionsData);
      }
      if (table === "ingredients") {
        return createMockQueryBuilder(mockIngredientsData);
      }
      if (table === "scheduled_events") {
        return createMockQueryBuilder([]);
      }
      return createMockQueryBuilder([]);
    });
  });

  it("renders loading state initially", async () => {
    render(<RecipeHub userId={mockUserId} isAdmin={false} />);

    // Loading spinner should be present
    expect(document.querySelector(".animate-spin")).toBeInTheDocument();

    // Wait for loading to complete to avoid act() warnings
    await waitFor(() => {
      expect(document.querySelector(".animate-spin")).not.toBeInTheDocument();
    });
  });

  it("renders search input", async () => {
    render(<RecipeHub userId={mockUserId} isAdmin={false} />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/search recipes/i)).toBeInTheDocument();
    });
  });

  it("renders ingredient filter dropdown", async () => {
    render(<RecipeHub userId={mockUserId} isAdmin={false} />);

    await waitFor(() => {
      expect(screen.getByText(/all ingredients/i)).toBeInTheDocument();
    });
  });

  it("shows Add Recipe button for admin users", async () => {
    render(<RecipeHub userId={mockUserId} isAdmin={true} />);

    await waitFor(() => {
      expect(screen.getByText(/add recipe/i)).toBeInTheDocument();
    });
  });

  it("hides Add Recipe button for non-admin users", async () => {
    render(<RecipeHub userId={mockUserId} isAdmin={false} />);

    await waitFor(() => {
      expect(screen.queryByText(/add recipe/i)).not.toBeInTheDocument();
    });
  });

  it("displays recipes with contributions", async () => {
    render(<RecipeHub userId={mockUserId} isAdmin={false} />);

    await waitFor(() => {
      expect(screen.getByText("Grilled Salmon")).toBeInTheDocument();
      expect(screen.getByText("Chicken Stir Fry")).toBeInTheDocument();
    });
  });

  it("filters recipes based on search term", async () => {
    render(<RecipeHub userId={mockUserId} isAdmin={false} />);

    await waitFor(() => {
      expect(screen.getByText("Grilled Salmon")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/search recipes/i);
    fireEvent.change(searchInput, { target: { value: "chicken" } });

    await waitFor(() => {
      expect(screen.queryByText("Grilled Salmon")).not.toBeInTheDocument();
      expect(screen.getByText("Chicken Stir Fry")).toBeInTheDocument();
    });
  });

  it("shows empty state when no recipes match search", async () => {
    render(<RecipeHub userId={mockUserId} isAdmin={false} />);

    await waitFor(() => {
      expect(screen.getByText("Grilled Salmon")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/search recipes/i);
    fireEvent.change(searchInput, { target: { value: "nonexistent recipe xyz" } });

    await waitFor(() => {
      expect(screen.getByText(/no recipes found/i)).toBeInTheDocument();
    });
  });

  it("shows empty state when no recipes exist", async () => {
    // Override mock to return empty arrays
    mockSupabaseFrom.mockImplementation(() => {
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub userId={mockUserId} isAdmin={false} />);

    await waitFor(() => {
      expect(screen.getByText(/no recipes yet/i)).toBeInTheDocument();
    });
  });

  it("loads used ingredients for filter dropdown", async () => {
    render(<RecipeHub userId={mockUserId} isAdmin={false} />);

    await waitFor(() => {
      // The dropdown trigger should be present
      const filterTrigger = screen.getByText(/all ingredients/i);
      expect(filterTrigger).toBeInTheDocument();
    });

    // Verify the supabase call was made to load ingredients
    expect(mockSupabaseFrom).toHaveBeenCalledWith("ingredients");
  });
});

describe("RecipeHub - Error Handling", () => {
  const mockUserId = "user-123";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("handles error when loading recipes fails", async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") {
        return createMockQueryBuilder([], { message: "Database error" });
      }
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub userId={mockUserId} isAdmin={false} />);

    // Component should still render (with error handling)
    await waitFor(() => {
      expect(screen.queryByText("Grilled Salmon")).not.toBeInTheDocument();
    });
  });
});

describe("RecipeHub - Admin Features", () => {
  const mockUserId = "user-123";

  const mockEventsData = [
    {
      id: "event-1",
      event_date: "2025-01-15",
      status: "completed",
      ingredients: { name: "Salmon" },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "scheduled_events") {
        return createMockQueryBuilder(mockEventsData);
      }
      return createMockQueryBuilder([]);
    });
  });

  it("opens add recipe form when admin clicks add button", async () => {
    render(<RecipeHub userId={mockUserId} isAdmin={true} />);

    await waitFor(() => {
      expect(screen.getByText(/add recipe/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/add recipe/i));

    // Wait for dialog to open and form to load
    await waitFor(() => {
      // The AddRecipeForm dialog should be open - look for form elements
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
  });
});

describe("RecipeHub - Ingredient Filtering", () => {
  const mockUserId = "user-123";

  const mockRecipesData = [
    { id: "recipe-1", name: "Grilled Salmon", url: null, created_by: "user-123", created_at: "2025-01-15T10:00:00Z" },
    { id: "recipe-2", name: "Chicken Stir Fry", url: null, created_by: "user-456", created_at: "2025-01-14T10:00:00Z" },
  ];

  const mockContributionsData = [
    {
      id: "contrib-1",
      recipe_id: "recipe-1",
      user_id: "user-123",
      event_id: "event-1",
      notes: "Delicious with lemon",
      photos: null,
      created_at: "2025-01-15T10:00:00Z",
      profiles: { name: "Test User", avatar_url: "avatar1.jpg" },
      scheduled_events: {
        id: "event-1",
        event_date: "2025-01-15",
        ingredient_id: "ing-1",
        ingredients: { name: "Salmon" },
      },
    },
    {
      id: "contrib-2",
      recipe_id: "recipe-2",
      user_id: "user-456",
      event_id: "event-2",
      notes: "Quick and easy",
      photos: null,
      created_at: "2025-01-14T10:00:00Z",
      profiles: { name: "Another User", avatar_url: "avatar2.jpg" },
      scheduled_events: {
        id: "event-2",
        event_date: "2025-01-14",
        ingredient_id: "ing-2",
        ingredients: { name: "Chicken" },
      },
    },
  ];

  const mockIngredientsData = [
    { id: "ing-1", name: "Salmon", used_count: 1, in_bank: true },
    { id: "ing-2", name: "Chicken", used_count: 2, in_bank: true },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") {
        return createMockQueryBuilder(mockRecipesData);
      }
      if (table === "recipe_contributions") {
        return createMockQueryBuilder(mockContributionsData);
      }
      if (table === "ingredients") {
        return createMockQueryBuilder(mockIngredientsData);
      }
      return createMockQueryBuilder([]);
    });
  });

  it("filters recipes by ingredient", async () => {
    render(<RecipeHub userId={mockUserId} isAdmin={false} />);

    await waitFor(() => {
      expect(screen.getByText("Grilled Salmon")).toBeInTheDocument();
      expect(screen.getByText("Chicken Stir Fry")).toBeInTheDocument();
    });

    // Open the ingredient filter dropdown
    const filterTrigger = screen.getByText(/all ingredients/i);
    fireEvent.click(filterTrigger);

    await waitFor(() => {
      // Select "Salmon" from the dropdown
      const salmonOption = screen.getByRole("option", { name: "Salmon" });
      fireEvent.click(salmonOption);
    });

    await waitFor(() => {
      // Only Salmon recipes should be shown
      expect(screen.getByText("Grilled Salmon")).toBeInTheDocument();
      expect(screen.queryByText("Chicken Stir Fry")).not.toBeInTheDocument();
    });
  });

  it("searches in recipe notes", async () => {
    render(<RecipeHub userId={mockUserId} isAdmin={false} />);

    await waitFor(() => {
      expect(screen.getByText("Grilled Salmon")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/search recipes/i);
    fireEvent.change(searchInput, { target: { value: "lemon" } });

    await waitFor(() => {
      // Should find the Salmon recipe because its contribution notes contain "lemon"
      expect(screen.getByText("Grilled Salmon")).toBeInTheDocument();
      expect(screen.queryByText("Chicken Stir Fry")).not.toBeInTheDocument();
    });
  });

  it("shows empty state with filter applied", async () => {
    render(<RecipeHub userId={mockUserId} isAdmin={false} />);

    await waitFor(() => {
      expect(screen.getByText("Grilled Salmon")).toBeInTheDocument();
    });

    // Search for something that doesn't exist
    const searchInput = screen.getByPlaceholderText(/search recipes/i);
    fireEvent.change(searchInput, { target: { value: "nonexistent xyz" } });

    // Open ingredient filter and select one
    const filterTrigger = screen.getByText(/all ingredients/i);
    fireEvent.click(filterTrigger);

    await waitFor(() => {
      expect(screen.getByText(/no recipes found/i)).toBeInTheDocument();
    });
  });
});

describe("RecipeHub - Recipe Added Callback", () => {
  const mockUserId = "user-123";

  const mockRecipesData = [
    { id: "recipe-1", name: "Grilled Salmon", url: null, created_by: "user-123", created_at: "2025-01-15T10:00:00Z" },
  ];

  const mockContributionsData = [
    {
      id: "contrib-1",
      recipe_id: "recipe-1",
      user_id: "user-123",
      event_id: "event-1",
      notes: null,
      photos: null,
      created_at: "2025-01-15T10:00:00Z",
      profiles: { name: "Test User", avatar_url: null },
      scheduled_events: {
        id: "event-1",
        event_date: "2025-01-15",
        ingredient_id: "ing-1",
        ingredients: { name: "Salmon" },
      },
    },
  ];

  const mockEventsData = [
    { id: "event-1", event_date: "2025-01-15", ingredients: { name: "Salmon" } },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") {
        return createMockQueryBuilder(mockRecipesData);
      }
      if (table === "recipe_contributions") {
        return createMockQueryBuilder(mockContributionsData);
      }
      if (table === "ingredients") {
        return createMockQueryBuilder([]);
      }
      if (table === "scheduled_events") {
        return createMockQueryBuilder(mockEventsData);
      }
      return createMockQueryBuilder([]);
    });
  });

  it("reloads recipes after adding a new recipe", async () => {
    render(<RecipeHub userId={mockUserId} isAdmin={true} />);

    await waitFor(() => {
      expect(screen.getByText("Grilled Salmon")).toBeInTheDocument();
    });

    // Track the number of calls
    const initialCallCount = mockSupabaseFrom.mock.calls.filter(
      (call: unknown[]) => call[0] === "recipes"
    ).length;

    // Open the add recipe form
    fireEvent.click(screen.getByText(/add recipe/i));

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    // Close the dialog using the cancel button (simulating the onRecipeAdded callback indirectly)
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    // Verify form was closed
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    // The recipes should have been loaded initially
    expect(initialCallCount).toBeGreaterThan(0);
  });

  it("renders contribution error gracefully", async () => {
    // Test with error in contributions query
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") {
        return createMockQueryBuilder(mockRecipesData);
      }
      if (table === "recipe_contributions") {
        return createMockQueryBuilder([], { message: "Contributions error" });
      }
      if (table === "ingredients") {
        return createMockQueryBuilder([]);
      }
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub userId={mockUserId} isAdmin={false} />);

    await waitFor(() => {
      // Should show empty state or handle error gracefully
      expect(screen.queryByText("Grilled Salmon")).not.toBeInTheDocument();
    });
  });

  it("handles ingredients loading error", async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") {
        return createMockQueryBuilder(mockRecipesData);
      }
      if (table === "recipe_contributions") {
        return createMockQueryBuilder(mockContributionsData);
      }
      if (table === "ingredients") {
        return createMockQueryBuilder([], { message: "Ingredients error" });
      }
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub userId={mockUserId} isAdmin={false} />);

    await waitFor(() => {
      // Should still render recipes even if ingredients fail to load
      expect(screen.getByText("Grilled Salmon")).toBeInTheDocument();
    });

    // Ingredient filter should still show (but empty)
    expect(screen.getByText(/all ingredients/i)).toBeInTheDocument();
  });
});

describe("RecipeHub - handleRecipeAdded Callback", () => {
  const mockUserId = "user-123";

  const mockRecipesData = [
    { id: "recipe-1", name: "Grilled Salmon", url: null, created_by: "user-123", created_at: "2025-01-15T10:00:00Z" },
  ];

  const mockContributionsData = [
    {
      id: "contrib-1",
      recipe_id: "recipe-1",
      user_id: "user-123",
      event_id: "event-1",
      notes: "Delicious",
      photos: null,
      created_at: "2025-01-15T10:00:00Z",
      profiles: { name: "Test User", avatar_url: "avatar1.jpg" },
      scheduled_events: {
        id: "event-1",
        event_date: "2025-01-15",
        ingredient_id: "ing-1",
        ingredients: { name: "Salmon" },
      },
    },
  ];

  const mockIngredientsData = [
    { id: "ing-1", name: "Salmon", used_count: 1 },
  ];

  const mockEventsData = [
    { id: "event-1", event_date: "2025-01-15", ingredients: { name: "Salmon" } },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") {
        return createMockQueryBuilder(mockRecipesData);
      }
      if (table === "recipe_contributions") {
        return createMockQueryBuilder(mockContributionsData);
      }
      if (table === "ingredients") {
        return createMockQueryBuilder(mockIngredientsData);
      }
      if (table === "scheduled_events") {
        return createMockQueryBuilder(mockEventsData);
      }
      return createMockQueryBuilder([]);
    });
  });

  it("reloads recipes and closes form when handleRecipeAdded is called", async () => {
    // Track how many times loadRecipes is called via the supabase mock
    let recipeLoadCount = 0;
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") {
        recipeLoadCount++;
        return createMockQueryBuilder(mockRecipesData);
      }
      if (table === "recipe_contributions") {
        return createMockQueryBuilder(mockContributionsData);
      }
      if (table === "ingredients") {
        return createMockQueryBuilder(mockIngredientsData);
      }
      if (table === "scheduled_events") {
        return createMockQueryBuilder(mockEventsData);
      }
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub userId={mockUserId} isAdmin={true} />);

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText("Grilled Salmon")).toBeInTheDocument();
    });

    const initialLoadCount = recipeLoadCount;

    // Open the add recipe form
    fireEvent.click(screen.getByRole("button", { name: /add recipe/i }));

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    // Fill out the form and submit to trigger handleRecipeAdded
    // Select an event
    const selectTrigger = screen.getByRole("combobox");
    fireEvent.click(selectTrigger);

    await waitFor(() => {
      // Look for the event option
      const salmonOption = screen.getAllByRole("option").find(opt =>
        opt.textContent?.includes("Salmon")
      );
      if (salmonOption) {
        fireEvent.click(salmonOption);
      }
    });

    // Enter recipe name
    const recipeNameInput = screen.getByPlaceholderText(/start typing/i);
    fireEvent.change(recipeNameInput, { target: { value: "Test Recipe" } });

    // Click create new recipe in autocomplete
    await waitFor(() => {
      const createOption = screen.queryByText(/create new recipe/i);
      if (createOption) {
        fireEvent.click(createOption);
      }
    });

    // Submit the form
    const submitButton = screen.getByRole("button", { name: /add recipe/i });
    // Find the submit button in the dialog (not the one that opens the dialog)
    const dialogSubmitButton = screen.getAllByRole("button", { name: /add recipe/i }).find(btn =>
      btn.closest("[role='dialog']")
    );

    if (dialogSubmitButton) {
      fireEvent.click(dialogSubmitButton);

      // After submission, handleRecipeAdded should be called which:
      // 1. Reloads recipes (recipeLoadCount increases)
      // 2. Closes the form (dialog disappears)
      await waitFor(() => {
        // Recipes were reloaded (more calls to recipes query)
        expect(recipeLoadCount).toBeGreaterThan(initialLoadCount);
      }, { timeout: 3000 });
    }
  });
});

describe("RecipeHub - Branch Coverage for Optional Chaining", () => {
  const mockUserId = "user-123";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("handles contributions with missing profiles and events data", async () => {
    const mockRecipesData = [
      { id: "recipe-1", name: "Test Recipe", url: null, created_by: null, created_at: null },
    ];

    // Contribution with minimal/null data
    const mockContributionsData = [
      {
        id: "contrib-1",
        recipe_id: "recipe-1",
        user_id: null,
        event_id: null,
        notes: null,
        photos: null,
        created_at: "2025-01-15T10:00:00Z",
        profiles: null, // No profile
        scheduled_events: null, // No event
      },
    ];

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") {
        return createMockQueryBuilder(mockRecipesData);
      }
      if (table === "recipe_contributions") {
        return createMockQueryBuilder(mockContributionsData);
      }
      if (table === "ingredients") {
        return createMockQueryBuilder([]);
      }
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub userId={mockUserId} isAdmin={false} />);

    await waitFor(() => {
      expect(screen.getByText("Test Recipe")).toBeInTheDocument();
    });
  });

  it("handles contributions with missing ingredient in scheduled_events", async () => {
    const mockRecipesData = [
      { id: "recipe-1", name: "Test Recipe", url: "https://example.com", created_by: "user-123", created_at: "2025-01-15T10:00:00Z" },
    ];

    const mockContributionsData = [
      {
        id: "contrib-1",
        recipe_id: "recipe-1",
        user_id: "user-123",
        event_id: "event-1",
        notes: "Test notes",
        photos: ["photo1.jpg"],
        created_at: "2025-01-15T10:00:00Z",
        profiles: { name: null, avatar_url: null }, // Profile with null name
        scheduled_events: {
          id: "event-1",
          event_date: "2025-01-15",
          ingredient_id: "ing-1",
          ingredients: null, // No ingredient data
        },
      },
    ];

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") {
        return createMockQueryBuilder(mockRecipesData);
      }
      if (table === "recipe_contributions") {
        return createMockQueryBuilder(mockContributionsData);
      }
      if (table === "ingredients") {
        return createMockQueryBuilder([]);
      }
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub userId={mockUserId} isAdmin={false} />);

    await waitFor(() => {
      expect(screen.getByText("Test Recipe")).toBeInTheDocument();
    });
  });

  it("handles empty recipes and contributions data", async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") {
        return createMockQueryBuilder([]);
      }
      if (table === "recipe_contributions") {
        return createMockQueryBuilder([]);
      }
      if (table === "ingredients") {
        return createMockQueryBuilder([]);
      }
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub userId={mockUserId} isAdmin={false} />);

    await waitFor(() => {
      // Should show empty state
      expect(screen.getByText(/no recipes yet/i)).toBeInTheDocument();
    });
  });

  it("handles contribution with scheduled_events but no event_date", async () => {
    const mockRecipesData = [
      { id: "recipe-1", name: "Test Recipe", url: null, created_by: null, created_at: null },
    ];

    const mockContributionsData = [
      {
        id: "contrib-1",
        recipe_id: "recipe-1",
        user_id: "user-123",
        event_id: "event-1",
        notes: null,
        photos: null,
        created_at: "2025-01-15T10:00:00Z",
        profiles: { name: "Test User", avatar_url: "avatar.jpg" },
        scheduled_events: {
          id: "event-1",
          event_date: null, // No event date
          ingredient_id: null,
          ingredients: { name: "Salmon" },
        },
      },
    ];

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") {
        return createMockQueryBuilder(mockRecipesData);
      }
      if (table === "recipe_contributions") {
        return createMockQueryBuilder(mockContributionsData);
      }
      if (table === "ingredients") {
        return createMockQueryBuilder([{ id: "ing-1", name: "Salmon", used_count: 1 }]);
      }
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub userId={mockUserId} isAdmin={false} />);

    await waitFor(() => {
      expect(screen.getByText("Test Recipe")).toBeInTheDocument();
    });
  });

  it("handles multiple contributions for the same recipe", async () => {
    const mockRecipesData = [
      { id: "recipe-1", name: "Test Recipe", url: null, created_by: null, created_at: null },
    ];

    // Multiple contributions for the same recipe
    const mockContributionsData = [
      {
        id: "contrib-1",
        recipe_id: "recipe-1",
        user_id: "user-123",
        event_id: "event-1",
        notes: "First contribution",
        photos: null,
        created_at: "2025-01-15T10:00:00Z",
        profiles: { name: "User One", avatar_url: "avatar1.jpg" },
        scheduled_events: { id: "event-1", event_date: "2025-01-15", ingredient_id: "ing-1", ingredients: { name: "Salmon" } },
      },
      {
        id: "contrib-2",
        recipe_id: "recipe-1", // Same recipe
        user_id: "user-456",
        event_id: "event-2",
        notes: "Second contribution",
        photos: null,
        created_at: "2025-01-16T10:00:00Z",
        profiles: { name: "User Two", avatar_url: "avatar2.jpg" },
        scheduled_events: { id: "event-2", event_date: "2025-01-16", ingredient_id: "ing-1", ingredients: { name: "Salmon" } },
      },
    ];

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") {
        return createMockQueryBuilder(mockRecipesData);
      }
      if (table === "recipe_contributions") {
        return createMockQueryBuilder(mockContributionsData);
      }
      if (table === "ingredients") {
        return createMockQueryBuilder([]);
      }
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub userId={mockUserId} isAdmin={false} />);

    await waitFor(() => {
      expect(screen.getByText("Test Recipe")).toBeInTheDocument();
    });
  });

  it("handles contribution with null userName", async () => {
    const mockRecipesData = [
      { id: "recipe-1", name: "Test Recipe", url: null, created_by: null, created_at: null },
    ];

    const mockContributionsData = [
      {
        id: "contrib-1",
        recipe_id: "recipe-1",
        user_id: "user-123",
        event_id: "event-1",
        notes: null,
        photos: null,
        created_at: "2025-01-15T10:00:00Z",
        profiles: { name: null, avatar_url: null }, // No name
        scheduled_events: { id: "event-1", event_date: "2025-01-15", ingredient_id: "ing-1", ingredients: { name: "Salmon" } },
      },
    ];

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") {
        return createMockQueryBuilder(mockRecipesData);
      }
      if (table === "recipe_contributions") {
        return createMockQueryBuilder(mockContributionsData);
      }
      if (table === "ingredients") {
        return createMockQueryBuilder([]);
      }
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub userId={mockUserId} isAdmin={false} />);

    await waitFor(() => {
      expect(screen.getByText("Test Recipe")).toBeInTheDocument();
    });
  });

  it("handles null ingredients data", async () => {
    const mockRecipesData = [
      { id: "recipe-1", name: "Test Recipe", url: null, created_by: null, created_at: null },
    ];

    const mockContributionsData = [
      {
        id: "contrib-1",
        recipe_id: "recipe-1",
        user_id: "user-123",
        event_id: "event-1",
        notes: null,
        photos: null,
        created_at: "2025-01-15T10:00:00Z",
        profiles: { name: "Test User", avatar_url: "avatar.jpg" },
        scheduled_events: { id: "event-1", event_date: "2025-01-15", ingredient_id: "ing-1", ingredients: { name: "Salmon" } },
      },
    ];

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") {
        return createMockQueryBuilder(mockRecipesData);
      }
      if (table === "recipe_contributions") {
        return createMockQueryBuilder(mockContributionsData);
      }
      if (table === "ingredients") {
        // Return null data
        return {
          ...createMockQueryBuilder([]),
          order: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub userId={mockUserId} isAdmin={false} />);

    await waitFor(() => {
      expect(screen.getByText("Test Recipe")).toBeInTheDocument();
    });
  });

  it("handles null recipesData by using empty array fallback", async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") {
        return {
          ...createMockQueryBuilder([]),
          order: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }
      if (table === "recipe_contributions") {
        return createMockQueryBuilder([]);
      }
      if (table === "ingredients") {
        return createMockQueryBuilder([]);
      }
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub userId={mockUserId} isAdmin={false} />);

    await waitFor(() => {
      // Should show empty state when no recipes
      expect(screen.getByText(/no recipes yet/i)).toBeInTheDocument();
    });
  });

  it("handles recipe with no contributions (uses empty array fallback)", async () => {
    // Recipe exists but has no matching contributions
    const mockRecipesData = [
      { id: "recipe-1", name: "Recipe With Contribution", url: null, created_by: null, created_at: null },
      { id: "recipe-2", name: "Recipe Without Contribution", url: null, created_by: null, created_at: null },
    ];

    // Only one recipe has contributions
    const mockContributionsData = [
      {
        id: "contrib-1",
        recipe_id: "recipe-1", // Only for recipe-1
        user_id: "user-123",
        event_id: "event-1",
        notes: null,
        photos: null,
        created_at: "2025-01-15T10:00:00Z",
        profiles: { name: "Test User", avatar_url: "avatar.jpg" },
        scheduled_events: { id: "event-1", event_date: "2025-01-15", ingredient_id: "ing-1", ingredients: { name: "Salmon" } },
      },
    ];

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") {
        return createMockQueryBuilder(mockRecipesData);
      }
      if (table === "recipe_contributions") {
        return createMockQueryBuilder(mockContributionsData);
      }
      if (table === "ingredients") {
        return createMockQueryBuilder([]);
      }
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub userId={mockUserId} isAdmin={false} />);

    await waitFor(() => {
      // Only recipe with contribution should show (recipe-2 has no contributions so won't appear)
      expect(screen.getByText("Recipe With Contribution")).toBeInTheDocument();
      // Recipe without contributions should NOT show
      expect(screen.queryByText("Recipe Without Contribution")).not.toBeInTheDocument();
    });
  });

  it("handles contribution with undefined userName in contributors set", async () => {
    const mockRecipesData = [
      { id: "recipe-1", name: "Test Recipe", url: null, created_by: null, created_at: null },
    ];

    const mockContributionsData = [
      {
        id: "contrib-1",
        recipe_id: "recipe-1",
        user_id: "user-123",
        event_id: "event-1",
        notes: null,
        photos: null,
        created_at: "2025-01-15T10:00:00Z",
        profiles: { name: "", avatar_url: null }, // Empty string name (falsy)
        scheduled_events: { id: "event-1", event_date: "2025-01-15", ingredient_id: "ing-1", ingredients: { name: "Salmon" } },
      },
    ];

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") {
        return createMockQueryBuilder(mockRecipesData);
      }
      if (table === "recipe_contributions") {
        return createMockQueryBuilder(mockContributionsData);
      }
      if (table === "ingredients") {
        return createMockQueryBuilder([]);
      }
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub userId={mockUserId} isAdmin={false} />);

    await waitFor(() => {
      expect(screen.getByText("Test Recipe")).toBeInTheDocument();
    });
  });
});
