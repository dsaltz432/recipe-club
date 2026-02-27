import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@tests/utils";
import RecipeHub from "@/components/recipes/RecipeHub";

// Mock Supabase
const mockSupabaseFrom = vi.fn();
const mockFunctionsInvoke = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => mockSupabaseFrom(...args),
    functions: { invoke: (...args: unknown[]) => mockFunctionsInvoke(...args) },
  },
}));

// Mock sonner toast — toast is both a callable function and has .error/.success methods
vi.mock("sonner", () => {
  const fn = vi.fn() as ReturnType<typeof vi.fn> & { error: ReturnType<typeof vi.fn>; success: ReturnType<typeof vi.fn> };
  fn.error = vi.fn();
  fn.success = vi.fn();
  return { toast: fn };
});

// Mock PhotoUpload to allow testing photo addition
vi.mock("@/components/recipes/PhotoUpload", () => ({
  default: ({ photos, onPhotosChange }: { photos: string[]; onPhotosChange: (p: string[]) => void }) => (
    <div data-testid="photo-upload">
      <span>Files ({photos.length}/5)</span>
      <button onClick={() => onPhotosChange([...photos, "https://example.com/photo.jpg"])}>
        Add Test Photo
      </button>
    </div>
  ),
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
  is: vi.fn().mockReturnThis(),
  not: vi.fn().mockReturnThis(),
  or: vi.fn().mockReturnThis(),
  order: vi.fn().mockResolvedValue({ data, error }),
  single: vi.fn().mockResolvedValue({ data: data[0] || null, error }),
  maybeSingle: vi.fn().mockResolvedValue({ data: data[0] || null, error }),
  then: vi.fn((resolve) => Promise.resolve({ data, error }).then(resolve)),
});

describe("RecipeHub", () => {

  // New schema: recipes have event_id and ingredient_id directly
  const mockRecipesData = [
    {
      id: "recipe-1",
      name: "Grilled Salmon",
      url: "https://example.com/salmon",
      event_id: "event-1",
      ingredient_id: "ing-1",
      created_by: "user-123",
      created_at: "2025-01-15T10:00:00Z",
      ingredients: { name: "Salmon" },
      scheduled_events: { type: "club" },
    },
    {
      id: "recipe-2",
      name: "Chicken Stir Fry",
      url: null,
      event_id: "event-2",
      ingredient_id: "ing-2",
      created_by: "user-456",
      created_at: "2025-01-14T10:00:00Z",
      ingredients: { name: "Chicken" },
      scheduled_events: { type: "club" },
    },
  ];

  // New schema: recipe_notes (not recipe_contributions)
  const mockNotesData = [
    {
      id: "note-1",
      recipe_id: "recipe-1",
      user_id: "user-123",
      notes: "Delicious with lemon",
      photos: ["photo1.jpg"],
      created_at: "2025-01-15T10:00:00Z",
      profiles: { name: "Test User", avatar_url: "avatar1.jpg" },
    },
    {
      id: "note-2",
      recipe_id: "recipe-2",
      user_id: "user-456",
      notes: "Quick and easy",
      photos: null,
      created_at: "2025-01-14T10:00:00Z",
      profiles: { name: "Another User", avatar_url: "avatar2.jpg" },
    },
  ];

  const mockIngredientsData = [
    { id: "ing-1", name: "Salmon", used_count: 1, in_bank: true },
    { id: "ing-2", name: "Chicken", used_count: 2, in_bank: true },
  ];

  const mockRatingsData = [
    { recipe_id: "recipe-1", overall_rating: 5, would_cook_again: true },
    { recipe_id: "recipe-1", overall_rating: 4, would_cook_again: true },
    { recipe_id: "recipe-2", overall_rating: 3, would_cook_again: false },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock query builders with table-specific data
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") {
        return createMockQueryBuilder(mockRecipesData);
      }
      if (table === "recipe_notes") {
        return createMockQueryBuilder(mockNotesData);
      }
      if (table === "recipe_ratings") {
        return createMockQueryBuilder(mockRatingsData);
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
    render(<RecipeHub />);

    // Loading spinner should be present
    expect(document.querySelector(".animate-spin")).toBeInTheDocument();

    // Wait for loading to complete to avoid act() warnings
    await waitFor(() => {
      expect(document.querySelector(".animate-spin")).not.toBeInTheDocument();
    });
  });

  it("renders search input", async () => {
    render(<RecipeHub />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/search recipes/i)).toBeInTheDocument();
    });
  });

  it("renders ingredient filter dropdown", async () => {
    render(<RecipeHub />);

    await waitFor(() => {
      expect(screen.getByText(/all ingredients/i)).toBeInTheDocument();
    });
  });

  it("displays recipes with notes", async () => {
    render(<RecipeHub />);

    await waitFor(() => {
      expect(screen.getByText("Grilled Salmon")).toBeInTheDocument();
      expect(screen.getByText("Chicken Stir Fry")).toBeInTheDocument();
    });
  });

  it("filters recipes based on search term", async () => {
    render(<RecipeHub />);

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
    render(<RecipeHub />);

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

    render(<RecipeHub />);

    await waitFor(() => {
      expect(screen.getByText(/no recipes yet/i)).toBeInTheDocument();
    });
  });

  it("loads used ingredients for filter dropdown", async () => {
    render(<RecipeHub />);

    await waitFor(() => {
      // The dropdown trigger should be present
      const filterTrigger = screen.getByText(/all ingredients/i);
      expect(filterTrigger).toBeInTheDocument();
    });

    // Verify the supabase call was made to load ingredients
    expect(mockSupabaseFrom).toHaveBeenCalledWith("ingredients");
  });

  it("sets pantry item names when userId provided and pantry returns items", async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") return createMockQueryBuilder(mockRecipesData);
      if (table === "recipe_notes") return createMockQueryBuilder(mockNotesData);
      if (table === "recipe_ratings") return createMockQueryBuilder(mockRatingsData);
      if (table === "ingredients") return createMockQueryBuilder(mockIngredientsData);
      if (table === "user_pantry_items") {
        return createMockQueryBuilder([
          { id: "p1", name: "salt" },
          { id: "p2", name: "pepper" },
        ]);
      }
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub userId="user-123" />);

    await waitFor(() => {
      expect(screen.getByText("Grilled Salmon")).toBeInTheDocument();
    });

    // Pantry items were loaded; user_pantry_items table was queried
    expect(mockSupabaseFrom).toHaveBeenCalledWith("user_pantry_items");
  });

  it("falls back gracefully when getPantryItems throws", async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") return createMockQueryBuilder(mockRecipesData);
      if (table === "recipe_notes") return createMockQueryBuilder(mockNotesData);
      if (table === "recipe_ratings") return createMockQueryBuilder(mockRatingsData);
      if (table === "ingredients") return createMockQueryBuilder(mockIngredientsData);
      if (table === "user_pantry_items") {
        return createMockQueryBuilder([], { message: "Pantry fetch failed" });
      }
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub userId="user-123" />);

    await waitFor(() => {
      expect(screen.getByText("Grilled Salmon")).toBeInTheDocument();
    });

    // Component renders normally despite pantry error (catch handler swallows the error)
    expect(mockSupabaseFrom).toHaveBeenCalledWith("user_pantry_items");
  });
});

describe("RecipeHub - Error Handling", () => {

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

    render(<RecipeHub />);

    // Component should still render (with error handling)
    await waitFor(() => {
      expect(screen.queryByText("Grilled Salmon")).not.toBeInTheDocument();
    });
  });
});

describe("RecipeHub - Ingredient Filtering", () => {

  const mockRecipesData = [
    {
      id: "recipe-1",
      name: "Grilled Salmon",
      url: null,
      event_id: "event-1",
      ingredient_id: "ing-1",
      created_by: "user-123",
      created_at: "2025-01-15T10:00:00Z",
      ingredients: { name: "Salmon" },
      scheduled_events: { type: "club" },
    },
    {
      id: "recipe-2",
      name: "Chicken Stir Fry",
      url: null,
      event_id: "event-2",
      ingredient_id: "ing-2",
      created_by: "user-456",
      created_at: "2025-01-14T10:00:00Z",
      ingredients: { name: "Chicken" },
      scheduled_events: { type: "club" },
    },
  ];

  const mockNotesData = [
    {
      id: "note-1",
      recipe_id: "recipe-1",
      user_id: "user-123",
      notes: "Delicious with lemon",
      photos: null,
      created_at: "2025-01-15T10:00:00Z",
      profiles: { name: "Test User", avatar_url: "avatar1.jpg" },
    },
    {
      id: "note-2",
      recipe_id: "recipe-2",
      user_id: "user-456",
      notes: "Quick and easy",
      photos: null,
      created_at: "2025-01-14T10:00:00Z",
      profiles: { name: "Another User", avatar_url: "avatar2.jpg" },
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
      if (table === "recipe_notes") {
        return createMockQueryBuilder(mockNotesData);
      }
      if (table === "ingredients") {
        return createMockQueryBuilder(mockIngredientsData);
      }
      return createMockQueryBuilder([]);
    });
  });

  it("filters recipes by ingredient", async () => {
    render(<RecipeHub />);

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
    render(<RecipeHub />);

    await waitFor(() => {
      expect(screen.getByText("Grilled Salmon")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/search recipes/i);
    fireEvent.change(searchInput, { target: { value: "lemon" } });

    await waitFor(() => {
      // Should find the Salmon recipe because its notes contain "lemon"
      expect(screen.getByText("Grilled Salmon")).toBeInTheDocument();
      expect(screen.queryByText("Chicken Stir Fry")).not.toBeInTheDocument();
    });
  });

  it("shows empty state with filter applied", async () => {
    render(<RecipeHub />);

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

describe("RecipeHub - Error Handling Extended", () => {
  const mockRecipesData = [
    {
      id: "recipe-1",
      name: "Grilled Salmon",
      url: null,
      event_id: "event-1",
      ingredient_id: "ing-1",
      created_by: "user-123",
      created_at: "2025-01-15T10:00:00Z",
      ingredients: { name: "Salmon" },
      scheduled_events: { type: "club" },
    },
  ];

  const mockNotesData = [
    {
      id: "note-1",
      recipe_id: "recipe-1",
      user_id: "user-123",
      notes: null,
      photos: null,
      created_at: "2025-01-15T10:00:00Z",
      profiles: { name: "Test User", avatar_url: null },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders notes error gracefully", async () => {
    // Test with error in notes query
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") {
        return createMockQueryBuilder(mockRecipesData);
      }
      if (table === "recipe_notes") {
        return createMockQueryBuilder([], { message: "Notes error" });
      }
      if (table === "ingredients") {
        return createMockQueryBuilder([]);
      }
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub />);

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
      if (table === "recipe_notes") {
        return createMockQueryBuilder(mockNotesData);
      }
      if (table === "ingredients") {
        return createMockQueryBuilder([], { message: "Ingredients error" });
      }
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub />);

    await waitFor(() => {
      // Should still render recipes even if ingredients fail to load
      expect(screen.getByText("Grilled Salmon")).toBeInTheDocument();
    });

    // Ingredient filter should still show (but empty)
    expect(screen.getByText(/all ingredients/i)).toBeInTheDocument();
  });

  it("handles null ratingsData gracefully", async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") {
        return createMockQueryBuilder(mockRecipesData);
      }
      if (table === "recipe_notes") {
        return createMockQueryBuilder(mockNotesData);
      }
      if (table === "recipe_ratings") {
        // Return null data to exercise (ratingsData || []) fallback
        const builder = createMockQueryBuilder([]);
        builder.then = vi.fn((resolve) =>
          Promise.resolve({ data: null, error: null }).then(resolve)
        );
        return builder;
      }
      if (table === "ingredients") {
        return createMockQueryBuilder([]);
      }
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub />);

    await waitFor(() => {
      expect(screen.getByText("Grilled Salmon")).toBeInTheDocument();
    });
  });
});

describe("RecipeHub - Branch Coverage for Optional Chaining", () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("handles notes with missing profiles data", async () => {
    const mockRecipesData = [
      {
        id: "recipe-1",
        name: "Test Recipe",
        url: null,
        event_id: "event-1",
        ingredient_id: "ing-1",
        created_by: null,
        created_at: null,
        ingredients: { name: "Salmon" },
        scheduled_events: { type: "club" },
      },
    ];

    // Note with null profile
    const mockNotesData = [
      {
        id: "note-1",
        recipe_id: "recipe-1",
        user_id: null,
        notes: null,
        photos: null,
        created_at: "2025-01-15T10:00:00Z",
        profiles: null, // No profile
      },
    ];

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") {
        return createMockQueryBuilder(mockRecipesData);
      }
      if (table === "recipe_notes") {
        return createMockQueryBuilder(mockNotesData);
      }
      if (table === "ingredients") {
        return createMockQueryBuilder([]);
      }
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub />);

    await waitFor(() => {
      expect(screen.getByText("Test Recipe")).toBeInTheDocument();
    });
  });

  it("handles recipe with no ingredient data", async () => {
    const mockRecipesData = [
      {
        id: "recipe-1",
        name: "Test Recipe",
        url: "https://example.com",
        event_id: "event-1",
        ingredient_id: "ing-1",
        created_by: "user-123",
        created_at: "2025-01-15T10:00:00Z",
        ingredients: null, // No ingredient data
        scheduled_events: { type: "club" },
      },
    ];

    const mockNotesData = [
      {
        id: "note-1",
        recipe_id: "recipe-1",
        user_id: "user-123",
        notes: "Test notes",
        photos: ["photo1.jpg"],
        created_at: "2025-01-15T10:00:00Z",
        profiles: { name: "Test User", avatar_url: "avatar.jpg" },
      },
    ];

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") {
        return createMockQueryBuilder(mockRecipesData);
      }
      if (table === "recipe_notes") {
        return createMockQueryBuilder(mockNotesData);
      }
      if (table === "ingredients") {
        return createMockQueryBuilder([]);
      }
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub />);

    await waitFor(() => {
      expect(screen.getByText("Test Recipe")).toBeInTheDocument();
    });
  });

  it("handles empty recipes and notes data", async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") {
        return createMockQueryBuilder([]);
      }
      if (table === "recipe_notes") {
        return createMockQueryBuilder([]);
      }
      if (table === "ingredients") {
        return createMockQueryBuilder([]);
      }
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub />);

    await waitFor(() => {
      // Should show empty state
      expect(screen.getByText(/no recipes yet/i)).toBeInTheDocument();
    });
  });

  it("handles multiple notes for the same recipe", async () => {
    const mockRecipesData = [
      {
        id: "recipe-1",
        name: "Test Recipe",
        url: null,
        event_id: "event-1",
        ingredient_id: "ing-1",
        created_by: null,
        created_at: null,
        ingredients: { name: "Salmon" },
        scheduled_events: { type: "club" },
      },
    ];

    // Multiple notes for the same recipe
    const mockNotesData = [
      {
        id: "note-1",
        recipe_id: "recipe-1",
        user_id: "user-123",
        notes: "First note",
        photos: null,
        created_at: "2025-01-15T10:00:00Z",
        profiles: { name: "User One", avatar_url: "avatar1.jpg" },
      },
      {
        id: "note-2",
        recipe_id: "recipe-1", // Same recipe
        user_id: "user-456",
        notes: "Second note",
        photos: null,
        created_at: "2025-01-16T10:00:00Z",
        profiles: { name: "User Two", avatar_url: "avatar2.jpg" },
      },
    ];

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") {
        return createMockQueryBuilder(mockRecipesData);
      }
      if (table === "recipe_notes") {
        return createMockQueryBuilder(mockNotesData);
      }
      if (table === "ingredients") {
        return createMockQueryBuilder([]);
      }
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub />);

    await waitFor(() => {
      expect(screen.getByText("Test Recipe")).toBeInTheDocument();
    });
  });

  it("handles note with null userName", async () => {
    const mockRecipesData = [
      {
        id: "recipe-1",
        name: "Test Recipe",
        url: null,
        event_id: "event-1",
        ingredient_id: "ing-1",
        created_by: null,
        created_at: null,
        ingredients: { name: "Salmon" },
        scheduled_events: { type: "club" },
      },
    ];

    const mockNotesData = [
      {
        id: "note-1",
        recipe_id: "recipe-1",
        user_id: "user-123",
        notes: null,
        photos: null,
        created_at: "2025-01-15T10:00:00Z",
        profiles: { name: null, avatar_url: null }, // No name
      },
    ];

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") {
        return createMockQueryBuilder(mockRecipesData);
      }
      if (table === "recipe_notes") {
        return createMockQueryBuilder(mockNotesData);
      }
      if (table === "ingredients") {
        return createMockQueryBuilder([]);
      }
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub />);

    await waitFor(() => {
      expect(screen.getByText("Test Recipe")).toBeInTheDocument();
    });
  });

  it("handles null ingredients data", async () => {
    const mockRecipesData = [
      {
        id: "recipe-1",
        name: "Test Recipe",
        url: null,
        event_id: "event-1",
        ingredient_id: "ing-1",
        created_by: null,
        created_at: null,
        ingredients: { name: "Salmon" },
        scheduled_events: { type: "club" },
      },
    ];

    const mockNotesData = [
      {
        id: "note-1",
        recipe_id: "recipe-1",
        user_id: "user-123",
        notes: null,
        photos: null,
        created_at: "2025-01-15T10:00:00Z",
        profiles: { name: "Test User", avatar_url: "avatar.jpg" },
      },
    ];

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") {
        return createMockQueryBuilder(mockRecipesData);
      }
      if (table === "recipe_notes") {
        return createMockQueryBuilder(mockNotesData);
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

    render(<RecipeHub />);

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
      if (table === "recipe_notes") {
        return createMockQueryBuilder([]);
      }
      if (table === "ingredients") {
        return createMockQueryBuilder([]);
      }
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub />);

    await waitFor(() => {
      // Should show empty state when no recipes
      expect(screen.getByText(/no recipes yet/i)).toBeInTheDocument();
    });
  });

  it("handles note with empty string userName in contributors set", async () => {
    const mockRecipesData = [
      {
        id: "recipe-1",
        name: "Test Recipe",
        url: null,
        event_id: "event-1",
        ingredient_id: "ing-1",
        created_by: null,
        created_at: null,
        ingredients: { name: "Salmon" },
        scheduled_events: { type: "club" },
      },
    ];

    const mockNotesData = [
      {
        id: "note-1",
        recipe_id: "recipe-1",
        user_id: "user-123",
        notes: null,
        photos: null,
        created_at: "2025-01-15T10:00:00Z",
        profiles: { name: "", avatar_url: null }, // Empty string name (falsy)
      },
    ];

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") {
        return createMockQueryBuilder(mockRecipesData);
      }
      if (table === "recipe_notes") {
        return createMockQueryBuilder(mockNotesData);
      }
      if (table === "ingredients") {
        return createMockQueryBuilder([]);
      }
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub />);

    await waitFor(() => {
      expect(screen.getByText("Test Recipe")).toBeInTheDocument();
    });
  });

  it("handles recipe with no notes - uses empty array fallback", async () => {
    // This test covers line 86: const notes = notesByRecipe.get(r.id) || [];
    const mockRecipesData = [
      {
        id: "recipe-1",
        name: "Recipe With Notes",
        url: null,
        event_id: "event-1",
        ingredient_id: "ing-1",
        created_by: "user-123",
        created_at: "2025-01-15T10:00:00Z",
        ingredients: { name: "Salmon" },
        scheduled_events: { type: "club" },
      },
      {
        id: "recipe-2",
        name: "Recipe Without Notes",
        url: null,
        event_id: "event-2",
        ingredient_id: "ing-2",
        created_by: "user-123",
        created_at: "2025-01-15T10:00:00Z",
        ingredients: { name: "Chicken" },
        scheduled_events: { type: "club" },
      },
    ];

    // Only notes for recipe-1, none for recipe-2
    const mockNotesData = [
      {
        id: "note-1",
        recipe_id: "recipe-1", // Only recipe-1 has notes
        user_id: "user-123",
        notes: "Test notes",
        photos: null,
        created_at: "2025-01-15T10:00:00Z",
        profiles: { name: "Test User", avatar_url: "avatar.jpg" },
      },
    ];

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") {
        return createMockQueryBuilder(mockRecipesData);
      }
      if (table === "recipe_notes") {
        return createMockQueryBuilder(mockNotesData);
      }
      if (table === "ingredients") {
        return createMockQueryBuilder([]);
      }
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub />);

    await waitFor(() => {
      // Both recipes should render
      expect(screen.getByText("Recipe With Notes")).toBeInTheDocument();
      expect(screen.getByText("Recipe Without Notes")).toBeInTheDocument();
    });
  });

  it("handles recipe with null event_id and ingredient_id", async () => {
    // This test covers lines 93-94: eventId: r.event_id || undefined, ingredientId: r.ingredient_id || undefined
    const mockRecipesData = [
      {
        id: "recipe-1",
        name: "Recipe With Null IDs",
        url: null,
        event_id: null, // null event_id
        ingredient_id: null, // null ingredient_id
        created_by: "user-123",
        created_at: "2025-01-15T10:00:00Z",
        ingredients: { name: "Salmon" },
        scheduled_events: null,
      },
    ];

    const mockNotesData = [
      {
        id: "note-1",
        recipe_id: "recipe-1",
        user_id: "user-123",
        notes: "Test notes",
        photos: null,
        created_at: "2025-01-15T10:00:00Z",
        profiles: { name: "Test User", avatar_url: "avatar.jpg" },
      },
    ];

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") {
        return createMockQueryBuilder(mockRecipesData);
      }
      if (table === "recipe_notes") {
        return createMockQueryBuilder(mockNotesData);
      }
      if (table === "ingredients") {
        return createMockQueryBuilder([]);
      }
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub />);

    await waitFor(() => {
      expect(screen.getByText("Recipe With Null IDs")).toBeInTheDocument();
    });
  });
});

describe("RecipeHub - Rating Calculations", () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calculates rating summaries for recipes with ratings", async () => {
    const mockRecipesData = [
      {
        id: "recipe-1",
        name: "Rated Recipe",
        url: null,
        event_id: "event-1",
        ingredient_id: "ing-1",
        created_by: "user-123",
        created_at: "2025-01-15T10:00:00Z",
        ingredients: { name: "Salmon" },
        profiles: { name: "Test User", avatar_url: "avatar.jpg" },
        scheduled_events: { type: "club" },
      },
    ];

    const mockNotesData = [
      {
        id: "note-1",
        recipe_id: "recipe-1",
        user_id: "user-123",
        notes: "Test notes",
        photos: null,
        created_at: "2025-01-15T10:00:00Z",
        profiles: { name: "Test User", avatar_url: "avatar.jpg" },
      },
    ];

    // Multiple ratings for the same recipe to test aggregation (with profiles for initials)
    const mockRatingsData = [
      { recipe_id: "recipe-1", overall_rating: 5, would_cook_again: true, profiles: { name: "Sarah" } },
      { recipe_id: "recipe-1", overall_rating: 4, would_cook_again: true, profiles: { name: "Hannah" } },
      { recipe_id: "recipe-1", overall_rating: 3, would_cook_again: false, profiles: { name: "Daniel" } },
    ];

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") {
        return createMockQueryBuilder(mockRecipesData);
      }
      if (table === "recipe_notes") {
        return createMockQueryBuilder(mockNotesData);
      }
      if (table === "recipe_ratings") {
        return createMockQueryBuilder(mockRatingsData);
      }
      if (table === "ingredients") {
        return createMockQueryBuilder([]);
      }
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub />);

    await waitFor(() => {
      expect(screen.getByText("Rated Recipe")).toBeInTheDocument();
      // Average: (5+4+3)/3 = 4.0
      expect(screen.getByText("4/5")).toBeInTheDocument();
      // Check member initials format
      expect(screen.getByText("Make again:")).toBeInTheDocument();
      expect(screen.getByText(/S: Yes/)).toBeInTheDocument();
      expect(screen.getByText(/H: Yes/)).toBeInTheDocument();
      expect(screen.getByText(/D: No/)).toBeInTheDocument();
    });
  });

  it("handles ratings error gracefully", async () => {
    const mockRecipesData = [
      {
        id: "recipe-1",
        name: "Recipe Without Ratings",
        url: null,
        event_id: "event-1",
        ingredient_id: "ing-1",
        created_by: "user-123",
        created_at: "2025-01-15T10:00:00Z",
        ingredients: { name: "Salmon" },
        profiles: { name: "Test User", avatar_url: "avatar.jpg" },
        scheduled_events: { type: "club" },
      },
    ];

    const mockNotesData = [
      {
        id: "note-1",
        recipe_id: "recipe-1",
        user_id: "user-123",
        notes: "Test notes",
        photos: null,
        created_at: "2025-01-15T10:00:00Z",
        profiles: { name: "Test User", avatar_url: "avatar.jpg" },
      },
    ];

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") {
        return createMockQueryBuilder(mockRecipesData);
      }
      if (table === "recipe_notes") {
        return createMockQueryBuilder(mockNotesData);
      }
      if (table === "recipe_ratings") {
        return createMockQueryBuilder([], { message: "Ratings error" });
      }
      if (table === "ingredients") {
        return createMockQueryBuilder([]);
      }
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub />);

    // Component should still render even if ratings fail to load
    await waitFor(() => {
      expect(screen.queryByText("Recipe Without Ratings")).not.toBeInTheDocument();
    });
  });

  it("handles recipes with no ratings (empty ratingSummary)", async () => {
    const mockRecipesData = [
      {
        id: "recipe-1",
        name: "Unrated Recipe",
        url: null,
        event_id: "event-1",
        ingredient_id: "ing-1",
        created_by: "user-123",
        created_at: "2025-01-15T10:00:00Z",
        ingredients: { name: "Salmon" },
        profiles: { name: "Test User", avatar_url: "avatar.jpg" },
        scheduled_events: { type: "club" },
      },
    ];

    const mockNotesData = [
      {
        id: "note-1",
        recipe_id: "recipe-1",
        user_id: "user-123",
        notes: "Test notes",
        photos: null,
        created_at: "2025-01-15T10:00:00Z",
        profiles: { name: "Test User", avatar_url: "avatar.jpg" },
      },
    ];

    // No ratings at all
    const mockRatingsData: unknown[] = [];

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") {
        return createMockQueryBuilder(mockRecipesData);
      }
      if (table === "recipe_notes") {
        return createMockQueryBuilder(mockNotesData);
      }
      if (table === "recipe_ratings") {
        return createMockQueryBuilder(mockRatingsData);
      }
      if (table === "ingredients") {
        return createMockQueryBuilder([]);
      }
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub />);

    await waitFor(() => {
      expect(screen.getByText("Unrated Recipe")).toBeInTheDocument();
      // No ratings should be displayed
      expect(screen.queryByText(/Make again:/)).not.toBeInTheDocument();
    });
  });

  it("handles multiple recipes with different ratings", async () => {
    const mockRecipesData = [
      {
        id: "recipe-1",
        name: "Recipe One",
        url: null,
        event_id: "event-1",
        ingredient_id: "ing-1",
        created_by: "user-123",
        created_at: "2025-01-15T10:00:00Z",
        ingredients: { name: "Salmon" },
        profiles: { name: "Test User", avatar_url: "avatar.jpg" },
        scheduled_events: { type: "club" },
      },
      {
        id: "recipe-2",
        name: "Recipe Two",
        url: null,
        event_id: "event-2",
        ingredient_id: "ing-2",
        created_by: "user-456",
        created_at: "2025-01-14T10:00:00Z",
        ingredients: { name: "Chicken" },
        profiles: { name: "Another User", avatar_url: "avatar2.jpg" },
        scheduled_events: { type: "club" },
      },
    ];

    const mockNotesData = [
      {
        id: "note-1",
        recipe_id: "recipe-1",
        user_id: "user-123",
        notes: "Test notes",
        photos: null,
        created_at: "2025-01-15T10:00:00Z",
        profiles: { name: "Test User", avatar_url: "avatar.jpg" },
      },
    ];

    // Ratings for recipe-1 (2 ratings) and recipe-2 (1 rating) - with profiles for initials
    const mockRatingsData = [
      { recipe_id: "recipe-1", overall_rating: 5, would_cook_again: true, profiles: { name: "Sarah" } },
      { recipe_id: "recipe-1", overall_rating: 5, would_cook_again: true, profiles: { name: "Hannah" } },
      { recipe_id: "recipe-2", overall_rating: 3, would_cook_again: false, profiles: { name: "Daniel" } },
    ];

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") {
        return createMockQueryBuilder(mockRecipesData);
      }
      if (table === "recipe_notes") {
        return createMockQueryBuilder(mockNotesData);
      }
      if (table === "recipe_ratings") {
        return createMockQueryBuilder(mockRatingsData);
      }
      if (table === "ingredients") {
        return createMockQueryBuilder([]);
      }
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub />);

    await waitFor(() => {
      expect(screen.getByText("Recipe One")).toBeInTheDocument();
      expect(screen.getByText("Recipe Two")).toBeInTheDocument();
      // Recipe 1: avg 5.0, both would cook again
      expect(screen.getByText("5/5")).toBeInTheDocument();
      // Recipe 2: avg 3.0, would not cook again
      expect(screen.getByText("3/5")).toBeInTheDocument();
      // Check member initials exist for both
      expect(screen.getAllByText("Make again:")).toHaveLength(2);
    });
  });

  it("handles rating with would_cook_again false branch", async () => {
    const mockRecipesData = [
      {
        id: "recipe-1",
        name: "Test Recipe",
        url: null,
        event_id: "event-1",
        ingredient_id: "ing-1",
        created_by: "user-123",
        created_at: "2025-01-15T10:00:00Z",
        ingredients: { name: "Salmon" },
        profiles: { name: "Test User", avatar_url: "avatar.jpg" },
        scheduled_events: { type: "club" },
      },
    ];

    const mockNotesData = [
      {
        id: "note-1",
        recipe_id: "recipe-1",
        user_id: "user-123",
        notes: "Test notes",
        photos: null,
        created_at: "2025-01-15T10:00:00Z",
        profiles: { name: "Test User", avatar_url: "avatar.jpg" },
      },
    ];

    // All ratings have would_cook_again = false - with profiles for initials
    const mockRatingsData = [
      { recipe_id: "recipe-1", overall_rating: 2, would_cook_again: false, profiles: { name: "Sarah" } },
      { recipe_id: "recipe-1", overall_rating: 3, would_cook_again: false, profiles: { name: "Hannah" } },
    ];

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") {
        return createMockQueryBuilder(mockRecipesData);
      }
      if (table === "recipe_notes") {
        return createMockQueryBuilder(mockNotesData);
      }
      if (table === "recipe_ratings") {
        return createMockQueryBuilder(mockRatingsData);
      }
      if (table === "ingredients") {
        return createMockQueryBuilder([]);
      }
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub />);

    await waitFor(() => {
      expect(screen.getByText("Test Recipe")).toBeInTheDocument();
      // Average: (2+3)/2 = 2.5
      expect(screen.getByText("2.5/5")).toBeInTheDocument();
      // Both ratings say No
      expect(screen.getByText("Make again:")).toBeInTheDocument();
      expect(screen.getByText(/S: No/)).toBeInTheDocument();
      expect(screen.getByText(/H: No/)).toBeInTheDocument();
    });
  });
});

describe("RecipeHub - Sub-tabs", () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Club and My Recipes sub-tab buttons with counts", async () => {
    mockSupabaseFrom.mockImplementation(() => createMockQueryBuilder([]));

    render(<RecipeHub userId="user-123" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^Club/ })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /My Recipes/ })).toBeInTheDocument();
    });
  });

  it("shows club recipes by default with count in tab label", async () => {
    const mockRecipesData = [
      {
        id: "recipe-1",
        name: "Club Recipe",
        url: null,
        event_id: "event-1",
        ingredient_id: "ing-1",
        created_by: "user-123",
        created_at: "2025-01-15T10:00:00Z",
        ingredients: { name: "Salmon" },
        scheduled_events: { type: "club" },
      },
    ];

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") return createMockQueryBuilder(mockRecipesData);
      if (table === "recipe_notes") return createMockQueryBuilder([]);
      if (table === "recipe_ratings") return createMockQueryBuilder([]);
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub userId="user-123" />);

    await waitFor(() => {
      expect(screen.getByText("Club Recipe")).toBeInTheDocument();
      // Club tab shows count after loading
      expect(screen.getByRole("button", { name: "Club (1)" })).toBeInTheDocument();
    });
  });

  it("shows personal empty state when switching to My Recipes tab", async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") {
        return {
          ...createMockQueryBuilder([]),
          is: vi.fn().mockReturnThis(),
        };
      }
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub userId="user-123" />);

    // Wait for initial load
    await waitFor(() => {
      expect(screen.queryByText("animate-spin")).not.toBeInTheDocument();
    });

    // Click "My Recipes" tab
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /My Recipes/ })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /My Recipes/ }));

    await waitFor(() => {
      expect(
        screen.getByText(/no personal recipes yet\. add recipes from events or meal plans\./i)
      ).toBeInTheDocument();
    });
  });


  it("does not show ingredient filter in personal tab", async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") {
        return {
          ...createMockQueryBuilder([]),
          is: vi.fn().mockReturnThis(),
        };
      }
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub userId="user-123" />);

    // In club tab, ingredient filter should be visible
    await waitFor(() => {
      expect(screen.getByText(/all ingredients/i)).toBeInTheDocument();
    });

    // Switch to personal tab
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /My Recipes/ })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /My Recipes/ }));

    await waitFor(() => {
      expect(screen.queryByText(/all ingredients/i)).not.toBeInTheDocument();
    });
  });

  it("loads personal recipes created by user", async () => {
    const personalRecipesData = [
      {
        id: "personal-1",
        name: "My Home Recipe",
        url: "https://example.com/home",
        event_id: null,
        ingredient_id: "ing-1",
        created_by: "user-123",
        created_at: "2025-01-15T10:00:00Z",
        profiles: { name: "Test User", avatar_url: "avatar.jpg" },
        ingredients: { name: "Chicken", color: null },
        scheduled_events: null,
      },
    ];

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") {
        return createMockQueryBuilder(personalRecipesData);
      }
      if (table === "recipe_notes") {
        return createMockQueryBuilder([]);
      }
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub userId="user-123" />);

    // Switch to personal tab
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /My Recipes/ })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /My Recipes/ }));

    await waitFor(() => {
      expect(screen.getByText("My Home Recipe")).toBeInTheDocument();
    });
  });

  it("loads notes for personal recipes", async () => {
    const personalRecipesData = [
      {
        id: "personal-1",
        name: "Recipe With Notes",
        url: null,
        event_id: null,
        ingredient_id: null,
        created_by: "user-123",
        created_at: "2025-01-15T10:00:00Z",
        profiles: { name: "Test User", avatar_url: null },
        scheduled_events: null,
      },
    ];

    const notesData = [
      {
        id: "note-1",
        recipe_id: "personal-1",
        user_id: "user-123",
        notes: "My personal notes",
        photos: null,
        created_at: "2025-01-15T10:00:00Z",
        profiles: { name: "Test User", avatar_url: null },
      },
    ];

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") {
        return createMockQueryBuilder(personalRecipesData);
      }
      if (table === "recipe_notes") {
        return createMockQueryBuilder(notesData);
      }
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub userId="user-123" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /My Recipes/ })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /My Recipes/ }));

    await waitFor(() => {
      expect(screen.getByText("Recipe With Notes")).toBeInTheDocument();
      // 1 note should show
      expect(screen.getByText("1 note")).toBeInTheDocument();
    });
  });

  it("handles personal recipes error", async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") {
        return createMockQueryBuilder([], { message: "Error" });
      }
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub userId="user-123" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /My Recipes/ })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /My Recipes/ }));

    await waitFor(() => {
      expect(screen.getByText(/no personal recipes yet\. add recipes from events or meal plans\./i)).toBeInTheDocument();
    });
  });

  it("returns empty recipes when no userId in personal tab", async () => {
    mockSupabaseFrom.mockImplementation(() => createMockQueryBuilder([]));

    render(<RecipeHub />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /My Recipes/ })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /My Recipes/ }));

    await waitFor(() => {
      expect(screen.getByText(/no personal recipes yet\. add recipes from events or meal plans\./i)).toBeInTheDocument();
    });
  });


  it("handles null personalResult data", async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") {
        // Return null data to exercise (personalResult.data || []) fallback
        const builder = createMockQueryBuilder([]);
        builder.order = vi.fn().mockResolvedValue({ data: null, error: null });
        return builder;
      }
      if (table === "recipe_notes") {
        return createMockQueryBuilder([]);
      }
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub userId="user-123" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /My Recipes/ })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /My Recipes/ }));

    await waitFor(() => {
      expect(screen.getByText(/no personal recipes yet\. add recipes from events or meal plans\./i)).toBeInTheDocument();
    });
  });

  it("handles personal recipe with null created_by", async () => {
    const personalRecipesData = [
      {
        id: "personal-1",
        name: "Anonymous Recipe",
        url: null,
        event_id: null,
        ingredient_id: null,
        created_by: null,
        created_at: "2025-01-15T10:00:00Z",
        profiles: null,
        scheduled_events: null,
      },
    ];

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") {
        return createMockQueryBuilder(personalRecipesData);
      }
      if (table === "recipe_notes") {
        return createMockQueryBuilder([]);
      }
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub userId="user-123" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /My Recipes/ })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /My Recipes/ }));

    await waitFor(() => {
      expect(screen.getByText("Anonymous Recipe")).toBeInTheDocument();
    });
  });

  it("handles null notesData when loading personal recipes", async () => {
    const personalRecipesData = [
      {
        id: "personal-1",
        name: "Recipe With Null Notes",
        url: null,
        event_id: null,
        ingredient_id: null,
        created_by: "user-123",
        created_at: "2025-01-15T10:00:00Z",
        profiles: { name: "Test User", avatar_url: null },
        scheduled_events: null,
      },
    ];

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") {
        return createMockQueryBuilder(personalRecipesData);
      }
      if (table === "recipe_notes") {
        // Return null data to exercise (notesData) false branch
        const builder = createMockQueryBuilder([]);
        builder.then = vi.fn((resolve) =>
          Promise.resolve({ data: null, error: null }).then(resolve)
        );
        return builder;
      }
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub userId="user-123" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /My Recipes/ })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /My Recipes/ }));

    await waitFor(() => {
      expect(screen.getByText("Recipe With Null Notes")).toBeInTheDocument();
    });
  });

  it("processes multiple notes per personal recipe with varied profile data", async () => {
    const personalRecipesData = [
      {
        id: "personal-1",
        name: "Recipe With Multiple Notes",
        url: null,
        event_id: null,
        ingredient_id: null,
        created_by: "user-123",
        created_at: "2025-01-15T10:00:00Z",
        profiles: { name: "Test User", avatar_url: null },
        scheduled_events: null,
      },
    ];

    // Multiple notes for the same recipe to exercise the "already in map" branch
    const notesData = [
      {
        id: "note-1",
        recipe_id: "personal-1",
        user_id: "user-123",
        notes: "First note text",
        photos: ["photo1.jpg"],
        created_at: "2025-01-15T10:00:00Z",
        profiles: { name: "User One", avatar_url: "avatar1.jpg" },
      },
      {
        id: "note-2",
        recipe_id: "personal-1",
        user_id: "user-456",
        notes: null,
        photos: null,
        created_at: "2025-01-16T10:00:00Z",
        profiles: null,
      },
    ];

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") {
        return createMockQueryBuilder(personalRecipesData);
      }
      if (table === "recipe_notes") {
        return createMockQueryBuilder(notesData);
      }
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub userId="user-123" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /My Recipes/ })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /My Recipes/ }));

    await waitFor(() => {
      expect(screen.getByText("Recipe With Multiple Notes")).toBeInTheDocument();
      // 2 notes should show
      expect(screen.getByText("2 notes")).toBeInTheDocument();
    });
  });

  it("switches back to club tab from personal tab", async () => {
    const clubRecipesData = [
      {
        id: "recipe-1",
        name: "Club Recipe",
        url: null,
        event_id: "event-1",
        ingredient_id: null,
        created_by: "user-123",
        created_at: "2025-01-15T10:00:00Z",
        ingredients: null,
        scheduled_events: { type: "club" },
      },
    ];

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") return createMockQueryBuilder(clubRecipesData);
      if (table === "recipe_notes") return createMockQueryBuilder([]);
      if (table === "recipe_ratings") return createMockQueryBuilder([]);
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub userId="user-123" />);

    // Wait for club tab to load
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^Club/ })).toBeInTheDocument();
    });

    // Switch to personal tab
    fireEvent.click(screen.getByRole("button", { name: /My Recipes/ }));
    await waitFor(() => {
      expect(screen.queryByText(/all ingredients/i)).not.toBeInTheDocument();
    });

    // Switch back to club tab - exercises setSubTab("club") onClick
    fireEvent.click(screen.getByRole("button", { name: /^Club/ }));
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/search recipes/i)).toBeInTheDocument();
    });
  });

  it("shows personal count in My Recipes tab after switching", async () => {
    const personalRecipesData = [
      {
        id: "personal-1",
        name: "My Recipe 1",
        url: null,
        event_id: null,
        ingredient_id: null,
        created_by: "user-123",
        created_at: "2025-01-15T10:00:00Z",
        profiles: { name: "Test User", avatar_url: null },
        scheduled_events: null,
      },
      {
        id: "personal-2",
        name: "My Recipe 2",
        url: null,
        event_id: null,
        ingredient_id: null,
        created_by: "user-123",
        created_at: "2025-01-14T10:00:00Z",
        profiles: { name: "Test User", avatar_url: null },
        scheduled_events: null,
      },
    ];

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") return createMockQueryBuilder(personalRecipesData);
      if (table === "recipe_notes") return createMockQueryBuilder([]);
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub userId="user-123" />);

    // Switch to personal tab
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /My Recipes/ })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /My Recipes/ }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "My Recipes (2)" })).toBeInTheDocument();
    });
  });

  it("shows personal count 0 when no userId", async () => {
    mockSupabaseFrom.mockImplementation(() => createMockQueryBuilder([]));

    render(<RecipeHub />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /My Recipes/ })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /My Recipes/ }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "My Recipes (0)" })).toBeInTheDocument();
    });
  });

  it("eagerly loads personal count on mount without clicking tab", async () => {
    const personalRecipesData = [
      {
        id: "personal-1",
        name: "My Recipe 1",
        url: null,
        event_id: null,
        ingredient_id: null,
        created_by: "user-123",
        created_at: "2025-01-15T10:00:00Z",
        profiles: { name: "Test User", avatar_url: null },
        scheduled_events: null,
      },
      {
        id: "personal-2",
        name: "My Recipe 2",
        url: null,
        event_id: null,
        ingredient_id: null,
        created_by: "user-123",
        created_at: "2025-01-14T10:00:00Z",
        profiles: { name: "Test User", avatar_url: null },
        scheduled_events: null,
      },
      {
        id: "personal-3",
        name: "My Recipe 3",
        url: null,
        event_id: null,
        ingredient_id: null,
        created_by: "user-123",
        created_at: "2025-01-13T10:00:00Z",
        profiles: { name: "Test User", avatar_url: null },
        scheduled_events: null,
      },
    ];

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") return createMockQueryBuilder(personalRecipesData);
      if (table === "recipe_notes") return createMockQueryBuilder([]);
      if (table === "recipe_ratings") return createMockQueryBuilder([]);
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub userId="user-123" />);

    // Personal count should show immediately on mount without clicking the tab
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "My Recipes (3)" })).toBeInTheDocument();
    });

    // Club tab should still be the active tab (not switched)
    expect(screen.getByRole("button", { name: /^Club/ })).toBeInTheDocument();
  });

  it("handles null data in loadPersonalCount gracefully", async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") {
        return {
          ...createMockQueryBuilder([]),
          order: vi.fn().mockResolvedValue({ data: null, error: null }),
          then: vi.fn((resolve: (v: unknown) => void) =>
            Promise.resolve({ data: null, error: null }).then(resolve)
          ),
        };
      }
      if (table === "recipe_notes") return createMockQueryBuilder([]);
      if (table === "recipe_ratings") return createMockQueryBuilder([]);
      if (table === "ingredients") return createMockQueryBuilder([]);
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub userId="user-123" />);

    await waitFor(() => {
      // personalCount should be 0 (from null data fallback)
      expect(screen.getByRole("button", { name: "My Recipes (0)" })).toBeInTheDocument();
    });
  });

  it("shows My Recipes without count when loadPersonalCount errors", async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") {
        const builder = createMockQueryBuilder([]);
        // Override eq to return a rejecting thenable (loadPersonalCount uses .eq, loadClubRecipes uses .not/.order)
        builder.eq = vi.fn().mockReturnValue({
          then: (_resolve: unknown, reject: (e: unknown) => void) =>
            reject(new Error("Network error")),
        });
        return builder;
      }
      if (table === "recipe_notes") return createMockQueryBuilder([]);
      if (table === "recipe_ratings") return createMockQueryBuilder([]);
      if (table === "ingredients") return createMockQueryBuilder([]);
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub userId="user-123" />);

    await waitFor(() => {
      // Club tab loaded successfully
      expect(screen.getByRole("button", { name: "Club (0)" })).toBeInTheDocument();
      // personalCount stays null because loadPersonalCount errored — no count shown
      expect(screen.getByRole("button", { name: "My Recipes" })).toBeInTheDocument();
    });
  });
});

describe("RecipeHub - Ingredient Name Search", () => {
  const mockRecipesData = [
    {
      id: "recipe-1",
      name: "Grilled Salmon",
      url: null,
      event_id: "event-1",
      ingredient_id: "ing-1",
      created_by: "user-123",
      created_at: "2025-01-15T10:00:00Z",
      ingredients: { name: "Salmon" },
      scheduled_events: { type: "club" },
    },
    {
      id: "recipe-2",
      name: "Chicken Stir Fry",
      url: null,
      event_id: "event-2",
      ingredient_id: "ing-2",
      created_by: "user-456",
      created_at: "2025-01-14T10:00:00Z",
      ingredients: { name: "Chicken" },
      scheduled_events: { type: "club" },
    },
  ];

  const mockNotesData = [
    {
      id: "note-1",
      recipe_id: "recipe-1",
      user_id: "user-123",
      notes: "Delicious",
      photos: null,
      created_at: "2025-01-15T10:00:00Z",
      profiles: { name: "Test User", avatar_url: "avatar1.jpg" },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") return createMockQueryBuilder(mockRecipesData);
      if (table === "recipe_notes") return createMockQueryBuilder(mockNotesData);
      if (table === "recipe_ratings") return createMockQueryBuilder([]);
      return createMockQueryBuilder([]);
    });
  });

  it("searches recipes by ingredient name", async () => {
    render(<RecipeHub />);

    await waitFor(() => {
      expect(screen.getByText("Grilled Salmon")).toBeInTheDocument();
      expect(screen.getByText("Chicken Stir Fry")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/search recipes/i);
    fireEvent.change(searchInput, { target: { value: "salmon" } });

    await waitFor(() => {
      // "Salmon" matches the ingredientName, not the recipe name "Grilled Salmon" — but also matches recipe name
      expect(screen.getByText("Grilled Salmon")).toBeInTheDocument();
      expect(screen.queryByText("Chicken Stir Fry")).not.toBeInTheDocument();
    });
  });

  it("searches by ingredient name only (not in recipe name)", async () => {
    render(<RecipeHub />);

    await waitFor(() => {
      expect(screen.getByText("Grilled Salmon")).toBeInTheDocument();
    });

    // Search for "chicken" - matches ingredient name for recipe-2
    const searchInput = screen.getByPlaceholderText(/search recipes/i);
    fireEvent.change(searchInput, { target: { value: "chicken" } });

    await waitFor(() => {
      // Chicken Stir Fry has ingredientName "Chicken"
      expect(screen.getByText("Chicken Stir Fry")).toBeInTheDocument();
      expect(screen.queryByText("Grilled Salmon")).not.toBeInTheDocument();
    });
  });

  it("handles search with no ingredientName on recipe", async () => {
    // Recipe without ingredient data - exercises the ?. branch
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") {
        return createMockQueryBuilder([
          {
            id: "recipe-1",
            name: "Mystery Recipe",
            url: null,
            event_id: "event-1",
            ingredient_id: null,
            created_by: "user-123",
            created_at: "2025-01-15T10:00:00Z",
            ingredients: null,
            scheduled_events: { type: "club" },
          },
        ]);
      }
      if (table === "recipe_notes") return createMockQueryBuilder([]);
      if (table === "recipe_ratings") return createMockQueryBuilder([]);
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub />);

    await waitFor(() => {
      expect(screen.getByText("Mystery Recipe")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/search recipes/i);
    fireEvent.change(searchInput, { target: { value: "something" } });

    await waitFor(() => {
      // No match since recipe has no ingredient name
      expect(screen.queryByText("Mystery Recipe")).not.toBeInTheDocument();
    });
  });
});

describe("RecipeHub - Sort Options", () => {
  const mockRecipesData = [
    {
      id: "recipe-1",
      name: "Zesty Salmon",
      url: null,
      event_id: "event-1",
      ingredient_id: "ing-1",
      created_by: "user-123",
      created_at: "2025-01-15T10:00:00Z",
      ingredients: { name: "Salmon" },
      profiles: { name: "Test User", avatar_url: "avatar.jpg" },
      scheduled_events: { type: "club" },
    },
    {
      id: "recipe-2",
      name: "Apple Pie",
      url: null,
      event_id: "event-2",
      ingredient_id: "ing-2",
      created_by: "user-456",
      created_at: "2025-01-20T10:00:00Z",
      ingredients: { name: "Apple" },
      profiles: { name: "Another User", avatar_url: "avatar2.jpg" },
      scheduled_events: { type: "club" },
    },
    {
      id: "recipe-3",
      name: "Mango Smoothie",
      url: null,
      event_id: "event-3",
      ingredient_id: "ing-3",
      created_by: "user-789",
      created_at: "2025-01-10T10:00:00Z",
      ingredients: { name: "Mango" },
      profiles: { name: "Third User", avatar_url: "avatar3.jpg" },
      scheduled_events: { type: "club" },
    },
  ];

  const mockNotesData = [
    {
      id: "note-1",
      recipe_id: "recipe-1",
      user_id: "user-123",
      notes: "Test",
      photos: null,
      created_at: "2025-01-15T10:00:00Z",
      profiles: { name: "Test User", avatar_url: "avatar.jpg" },
    },
  ];

  const mockRatingsData = [
    { recipe_id: "recipe-1", overall_rating: 5, would_cook_again: true, profiles: { name: "Sarah" } },
    { recipe_id: "recipe-2", overall_rating: 3, would_cook_again: false, profiles: { name: "Daniel" } },
    // recipe-3 has no ratings
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") return createMockQueryBuilder(mockRecipesData);
      if (table === "recipe_notes") return createMockQueryBuilder(mockNotesData);
      if (table === "recipe_ratings") return createMockQueryBuilder(mockRatingsData);
      return createMockQueryBuilder([]);
    });
  });

  it("renders sort dropdown with default 'Newest First'", async () => {
    render(<RecipeHub />);

    await waitFor(() => {
      expect(screen.getByText("Newest First")).toBeInTheDocument();
    });
  });

  it("sorts alphabetically when 'Alphabetical (A-Z)' is selected", async () => {
    render(<RecipeHub />);

    await waitFor(() => {
      expect(screen.getByText("Zesty Salmon")).toBeInTheDocument();
    });

    // Open sort dropdown
    fireEvent.click(screen.getByText("Newest First"));
    await waitFor(() => {
      const alphaOption = screen.getByRole("option", { name: "Alphabetical (A-Z)" });
      fireEvent.click(alphaOption);
    });

    // Wait for re-render - all three recipes should be visible
    await waitFor(() => {
      expect(screen.getByText("Apple Pie")).toBeInTheDocument();
      expect(screen.getByText("Mango Smoothie")).toBeInTheDocument();
      expect(screen.getByText("Zesty Salmon")).toBeInTheDocument();
    });

    // Verify alphabetical order by checking DOM order
    const cards = screen.getAllByRole("heading", { level: 3 });
    expect(cards[0].textContent).toBe("Apple Pie");
    expect(cards[1].textContent).toBe("Mango Smoothie");
    expect(cards[2].textContent).toBe("Zesty Salmon");
  });

  it("sorts by highest rated when selected", async () => {
    render(<RecipeHub />);

    await waitFor(() => {
      expect(screen.getByText("Zesty Salmon")).toBeInTheDocument();
    });

    // Open sort dropdown
    fireEvent.click(screen.getByText("Newest First"));
    await waitFor(() => {
      const ratedOption = screen.getByRole("option", { name: "Highest Rated" });
      fireEvent.click(ratedOption);
    });

    // Wait for re-render - highest rated first (recipe-1: 5, recipe-2: 3, recipe-3: 0)
    await waitFor(() => {
      const cards = screen.getAllByRole("heading", { level: 3 });
      expect(cards[0].textContent).toBe("Zesty Salmon"); // rating 5
      expect(cards[1].textContent).toBe("Apple Pie"); // rating 3
      expect(cards[2].textContent).toBe("Mango Smoothie"); // no rating (0)
    });
  });

  it("sorts by newest first (default)", async () => {
    render(<RecipeHub />);

    // Default sort is newest first
    await waitFor(() => {
      const cards = screen.getAllByRole("heading", { level: 3 });
      expect(cards[0].textContent).toBe("Apple Pie"); // 2025-01-20
      expect(cards[1].textContent).toBe("Zesty Salmon"); // 2025-01-15
      expect(cards[2].textContent).toBe("Mango Smoothie"); // 2025-01-10
    });
  });

  it("sorts recipes with null createdAt using fallback", async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") {
        return createMockQueryBuilder([
          {
            id: "recipe-1",
            name: "Old Recipe",
            url: null,
            event_id: "event-1",
            ingredient_id: null,
            created_by: null,
            created_at: null,
            ingredients: null,
            scheduled_events: { type: "club" },
          },
          {
            id: "recipe-2",
            name: "New Recipe",
            url: null,
            event_id: "event-2",
            ingredient_id: null,
            created_by: null,
            created_at: "2025-01-20T10:00:00Z",
            ingredients: null,
            scheduled_events: { type: "club" },
          },
        ]);
      }
      if (table === "recipe_notes") return createMockQueryBuilder([]);
      if (table === "recipe_ratings") return createMockQueryBuilder([]);
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub />);

    await waitFor(() => {
      const cards = screen.getAllByRole("heading", { level: 3 });
      expect(cards[0].textContent).toBe("New Recipe"); // has date
      expect(cards[1].textContent).toBe("Old Recipe"); // null date → 0
    });
  });

  it("sorts by highest rated with unrated recipe first in input", async () => {
    // Unrated recipe first to ensure ?? 0 covers ratingA branch
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") {
        return createMockQueryBuilder([
          {
            id: "recipe-unrated",
            name: "Unrated First",
            url: null,
            event_id: "event-3",
            ingredient_id: null,
            created_by: null,
            created_at: "2025-01-10T10:00:00Z",
            ingredients: null,
            scheduled_events: { type: "club" },
          },
          {
            id: "recipe-rated",
            name: "Rated Recipe",
            url: null,
            event_id: "event-1",
            ingredient_id: null,
            created_by: null,
            created_at: "2025-01-15T10:00:00Z",
            ingredients: null,
            scheduled_events: { type: "club" },
          },
        ]);
      }
      if (table === "recipe_notes") return createMockQueryBuilder([]);
      if (table === "recipe_ratings") {
        return createMockQueryBuilder([
          { recipe_id: "recipe-rated", overall_rating: 4, would_cook_again: true, profiles: { name: "User" } },
        ]);
      }
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub />);

    await waitFor(() => {
      expect(screen.getByText("Unrated First")).toBeInTheDocument();
    });

    // Switch to highest rated
    fireEvent.click(screen.getByText("Newest First"));
    await waitFor(() => {
      fireEvent.click(screen.getByRole("option", { name: "Highest Rated" }));
    });

    await waitFor(() => {
      const cards = screen.getAllByRole("heading", { level: 3 });
      expect(cards[0].textContent).toBe("Rated Recipe"); // rating 4
      expect(cards[1].textContent).toBe("Unrated First"); // no rating → 0
    });
  });

  it("sorts newest with all null createdAt dates", async () => {
    // Both recipes have null createdAt — covers || 0 for both a and b
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") {
        return createMockQueryBuilder([
          {
            id: "recipe-1",
            name: "Recipe A",
            url: null,
            event_id: "event-1",
            ingredient_id: null,
            created_by: null,
            created_at: null,
            ingredients: null,
            scheduled_events: { type: "club" },
          },
          {
            id: "recipe-2",
            name: "Recipe B",
            url: null,
            event_id: "event-2",
            ingredient_id: null,
            created_by: null,
            created_at: null,
            ingredients: null,
            scheduled_events: { type: "club" },
          },
        ]);
      }
      if (table === "recipe_notes") return createMockQueryBuilder([]);
      if (table === "recipe_ratings") return createMockQueryBuilder([]);
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub />);

    // Both have null dates, so order is stable (0 - 0 = 0)
    await waitFor(() => {
      expect(screen.getByText("Recipe A")).toBeInTheDocument();
      expect(screen.getByText("Recipe B")).toBeInTheDocument();
    });
  });
});

describe("RecipeHub - Edit Personal Recipe", () => {
  const personalRecipesData = [
    {
      id: "personal-1",
      name: "My Home Recipe",
      url: "https://example.com/home",
      event_id: null,
      ingredient_id: null,
      created_by: "user-123",
      created_at: "2025-01-15T10:00:00Z",
      profiles: { name: "Test User", avatar_url: null },
      scheduled_events: null,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") return createMockQueryBuilder(personalRecipesData);
      if (table === "recipe_notes") return createMockQueryBuilder([]);
      return createMockQueryBuilder([]);
    });
  });

  it("shows edit and delete buttons on personal recipe cards", async () => {
    render(<RecipeHub userId="user-123" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /My Recipes/ })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /My Recipes/ }));

    await waitFor(() => {
      expect(screen.getByText("My Home Recipe")).toBeInTheDocument();
      expect(screen.getByLabelText("Edit recipe")).toBeInTheDocument();
      expect(screen.getByLabelText("Delete recipe")).toBeInTheDocument();
    });
  });

  it("opens edit dialog with pre-filled values when edit is clicked", async () => {
    render(<RecipeHub userId="user-123" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /My Recipes/ })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /My Recipes/ }));

    await waitFor(() => {
      expect(screen.getByLabelText("Edit recipe")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByLabelText("Edit recipe"));

    await waitFor(() => {
      expect(screen.getByText("Edit Recipe")).toBeInTheDocument();
      expect(screen.getByLabelText(/recipe name/i)).toHaveValue("My Home Recipe");
      expect(screen.getByDisplayValue("https://example.com/home")).toBeInTheDocument();
    });
  });

  it("saves edited recipe successfully", async () => {
    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") {
        const builder = createMockQueryBuilder(personalRecipesData);
        builder.update = mockUpdate;
        return builder;
      }
      if (table === "recipe_notes") return createMockQueryBuilder([]);
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub userId="user-123" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /My Recipes/ })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /My Recipes/ }));

    await waitFor(() => {
      expect(screen.getByLabelText("Edit recipe")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByLabelText("Edit recipe"));

    await waitFor(() => {
      expect(screen.getByLabelText(/recipe name/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/recipe name/i), {
      target: { value: "Updated Recipe" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith({
        name: "Updated Recipe",
        url: "https://example.com/home",
      });
    });
  });

  it("shows error toast when edit fails", async () => {
    const { toast } = await import("sonner");
    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: { message: "Update failed" } }),
    });

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") {
        const builder = createMockQueryBuilder(personalRecipesData);
        builder.update = mockUpdate;
        return builder;
      }
      if (table === "recipe_notes") return createMockQueryBuilder([]);
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub userId="user-123" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /My Recipes/ })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /My Recipes/ }));

    await waitFor(() => {
      expect(screen.getByLabelText("Edit recipe")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByLabelText("Edit recipe"));

    await waitFor(() => {
      expect(screen.getByLabelText(/recipe name/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to update recipe");
    });
  });

  it("closes edit dialog when cancel is clicked", async () => {
    render(<RecipeHub userId="user-123" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /My Recipes/ })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /My Recipes/ }));

    await waitFor(() => {
      expect(screen.getByLabelText("Edit recipe")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByLabelText("Edit recipe"));

    await waitFor(() => {
      expect(screen.getByText("Edit Recipe")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));

    await waitFor(() => {
      expect(screen.queryByText("Edit Recipe")).not.toBeInTheDocument();
    });
  });

  it("shows URL validation error in edit dialog", async () => {
    const { toast } = await import("sonner");

    render(<RecipeHub userId="user-123" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /My Recipes/ })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /My Recipes/ }));

    await waitFor(() => {
      expect(screen.getByLabelText("Edit recipe")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByLabelText("Edit recipe"));

    await waitFor(() => {
      expect(screen.getByDisplayValue("https://example.com/home")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByDisplayValue("https://example.com/home"), {
      target: { value: "not-a-url" },
    });

    // Shows inline validation text
    await waitFor(() => {
      expect(screen.getByText("URL must start with http:// or https://")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Please enter a valid URL starting with http:// or https://"
      );
    });
  });

  it("disables save button when name is empty", async () => {
    render(<RecipeHub userId="user-123" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /My Recipes/ })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /My Recipes/ }));

    await waitFor(() => {
      expect(screen.getByLabelText("Edit recipe")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByLabelText("Edit recipe"));

    await waitFor(() => {
      expect(screen.getByLabelText(/recipe name/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/recipe name/i), {
      target: { value: "" },
    });

    expect(screen.getByRole("button", { name: /save changes/i })).toBeDisabled();
  });

  it("closes edit dialog via Escape key (onOpenChange)", async () => {
    render(<RecipeHub userId="user-123" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /My Recipes/ })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /My Recipes/ }));

    await waitFor(() => {
      expect(screen.getByLabelText("Edit recipe")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByLabelText("Edit recipe"));

    await waitFor(() => {
      expect(screen.getByText("Edit Recipe")).toBeInTheDocument();
    });

    // Press Escape to close via Dialog's onOpenChange
    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByText("Edit Recipe")).not.toBeInTheDocument();
    });
  });

  it("shows edit and delete buttons on club event recipe cards", async () => {
    const clubRecipesData = [
      {
        id: "recipe-1",
        name: "Club Recipe",
        url: null,
        event_id: "event-1",
        ingredient_id: null,
        created_by: "user-123",
        created_at: "2025-01-15T10:00:00Z",
        ingredients: null,
        scheduled_events: { type: "club" },
      },
    ];

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") return createMockQueryBuilder(clubRecipesData);
      if (table === "recipe_notes") return createMockQueryBuilder([]);
      if (table === "recipe_ratings") return createMockQueryBuilder([]);
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub userId="user-123" />);

    await waitFor(() => {
      expect(screen.getByText("Club Recipe")).toBeInTheDocument();
    });

    // Club event recipes now show edit and delete like personal recipes
    expect(screen.getByLabelText("Edit recipe")).toBeInTheDocument();
    expect(screen.getByLabelText("Delete recipe")).toBeInTheDocument();
  });

  it("opens edit dialog with empty URL for recipe without URL", async () => {
    const recipesNoUrl = [
      {
        id: "personal-1",
        name: "No URL Recipe",
        url: null,
        event_id: null,
        ingredient_id: null,
        created_by: "user-123",
        created_at: "2025-01-15T10:00:00Z",
        profiles: { name: "Test User", avatar_url: null },
        scheduled_events: null,
      },
    ];

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") return createMockQueryBuilder(recipesNoUrl);
      if (table === "recipe_notes") return createMockQueryBuilder([]);
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub userId="user-123" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /My Recipes/ })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /My Recipes/ }));

    await waitFor(() => {
      expect(screen.getByLabelText("Edit recipe")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByLabelText("Edit recipe"));

    await waitFor(() => {
      expect(screen.getByLabelText(/recipe url/i)).toHaveValue("");
    });
  });

  it("saves edit with empty URL (URL is optional)", async () => {
    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") {
        const builder = createMockQueryBuilder(personalRecipesData);
        builder.update = mockUpdate;
        return builder;
      }
      if (table === "recipe_notes") return createMockQueryBuilder([]);
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub userId="user-123" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /My Recipes/ })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /My Recipes/ }));

    await waitFor(() => {
      expect(screen.getByLabelText("Edit recipe")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByLabelText("Edit recipe"));

    await waitFor(() => {
      expect(screen.getByDisplayValue("https://example.com/home")).toBeInTheDocument();
    });

    // Clear the URL
    fireEvent.change(screen.getByDisplayValue("https://example.com/home"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith({
        name: "My Home Recipe",
        url: null,
      });
    });
  });
});

describe("RecipeHub - Edit Rating", () => {
  const ratingMockRecipesData = [
    {
      id: "recipe-1",
      name: "Rated Club Recipe",
      url: null,
      event_id: "event-1",
      ingredient_id: "ing-1",
      created_by: "user-123",
      created_at: "2025-01-15T10:00:00Z",
      ingredients: { name: "Salmon", color: null },
      profiles: { name: "Test User", avatar_url: "avatar.jpg" },
      scheduled_events: { type: "club" },
    },
  ];

  const ratingMockNotesData = [
    {
      id: "note-1",
      recipe_id: "recipe-1",
      user_id: "user-123",
      notes: "Test notes",
      photos: null,
      created_at: "2025-01-15T10:00:00Z",
      profiles: { name: "Test User", avatar_url: "avatar.jpg" },
    },
  ];

  const ratingMockRatingsData = [
    { recipe_id: "recipe-1", overall_rating: 4, would_cook_again: true, profiles: { name: "Sarah" } },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") return createMockQueryBuilder(ratingMockRecipesData);
      if (table === "recipe_notes") return createMockQueryBuilder(ratingMockNotesData);
      if (table === "recipe_ratings") return createMockQueryBuilder(ratingMockRatingsData);
      return createMockQueryBuilder([]);
    });
  });

  it("shows edit rating button on club recipes with ratings when userId is provided", async () => {
    render(<RecipeHub userId="user-123" />);

    await waitFor(() => {
      expect(screen.getByText("Rated Club Recipe")).toBeInTheDocument();
      expect(screen.getByLabelText("Edit rating")).toBeInTheDocument();
    });
  });

  it("does not show edit rating button when no userId", async () => {
    render(<RecipeHub />);

    await waitFor(() => {
      expect(screen.getByText("Rated Club Recipe")).toBeInTheDocument();
    });

    expect(screen.queryByLabelText("Edit rating")).not.toBeInTheDocument();
  });

  it("opens rating dialog when edit rating button is clicked", async () => {
    render(<RecipeHub userId="user-123" />);

    await waitFor(() => {
      expect(screen.getByLabelText("Edit rating")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText("Edit rating"));

    await waitFor(() => {
      expect(screen.getByText("Rate the Recipes")).toBeInTheDocument();
    });
  });

  it("closes rating dialog when cancel is triggered", async () => {
    render(<RecipeHub userId="user-123" />);

    await waitFor(() => {
      expect(screen.getByLabelText("Edit rating")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText("Edit rating"));

    await waitFor(() => {
      expect(screen.getByText("Rate the Recipes")).toBeInTheDocument();
    });

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByText("Rate the Recipes")).not.toBeInTheDocument();
    });
  });

  it("closes rating dialog and reloads recipes on complete", async () => {
    const mockUpsert = vi.fn().mockResolvedValue({ error: null });

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") return createMockQueryBuilder(ratingMockRecipesData);
      if (table === "recipe_notes") return createMockQueryBuilder(ratingMockNotesData);
      if (table === "recipe_ratings") {
        const builder = createMockQueryBuilder(ratingMockRatingsData);
        builder.upsert = mockUpsert;
        return builder;
      }
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub userId="user-123" />);

    await waitFor(() => {
      expect(screen.getByLabelText("Edit rating")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText("Edit rating"));

    await waitFor(() => {
      expect(screen.getByText("Rate the Recipes")).toBeInTheDocument();
    });

    const yesButton = screen.getByRole("button", { name: /yes/i });
    fireEvent.click(yesButton);

    const fiveStarButton = screen.getByLabelText("Rate 5 out of 5 stars");
    fireEvent.click(fiveStarButton);

    fireEvent.click(screen.getByRole("button", { name: /submit ratings/i }));

    await waitFor(() => {
      expect(screen.queryByText("Rate the Recipes")).not.toBeInTheDocument();
    });
  });

  it("opens rating dialog for recipe with null createdAt (uses fallback)", async () => {
    const nullDateRecipes = [
      {
        id: "recipe-1",
        name: "No Date Recipe",
        url: null,
        event_id: "event-1",
        ingredient_id: "ing-1",
        created_by: "user-123",
        created_at: null,
        ingredients: { name: "Salmon", color: null },
        profiles: { name: "Test User", avatar_url: "avatar.jpg" },
        scheduled_events: { type: "club" },
      },
    ];

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") return createMockQueryBuilder(nullDateRecipes);
      if (table === "recipe_notes") return createMockQueryBuilder(ratingMockNotesData);
      if (table === "recipe_ratings") return createMockQueryBuilder(ratingMockRatingsData);
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub userId="user-123" />);

    await waitFor(() => {
      expect(screen.getByLabelText("Edit rating")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText("Edit rating"));

    await waitFor(() => {
      expect(screen.getByText("Rate the Recipes")).toBeInTheDocument();
    });
  });

  it("does not show edit rating button on personal recipes without eventId", async () => {
    const personalRecipesNoEvent = [
      {
        id: "personal-1",
        name: "Personal Recipe",
        url: null,
        event_id: null,
        ingredient_id: null,
        created_by: "user-123",
        created_at: "2025-01-15T10:00:00Z",
        profiles: { name: "Test User", avatar_url: null },
        scheduled_events: null,
      },
    ];

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") return createMockQueryBuilder(personalRecipesNoEvent);
      if (table === "recipe_notes") return createMockQueryBuilder([]);
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub userId="user-123" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /My Recipes/ })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /My Recipes/ }));

    await waitFor(() => {
      expect(screen.getByText("Personal Recipe")).toBeInTheDocument();
    });

    expect(screen.queryByLabelText("Edit rating")).not.toBeInTheDocument();
  });
});

describe("RecipeHub - Delete Personal Recipe", () => {
  const personalRecipesData = [
    {
      id: "personal-1",
      name: "Recipe To Delete",
      url: null,
      event_id: null,
      ingredient_id: null,
      created_by: "user-123",
      created_at: "2025-01-15T10:00:00Z",
      profiles: { name: "Test User", avatar_url: null },
      scheduled_events: null,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") return createMockQueryBuilder(personalRecipesData);
      if (table === "recipe_notes") return createMockQueryBuilder([]);
      return createMockQueryBuilder([]);
    });
  });

  it("shows delete confirmation dialog when delete is clicked", async () => {
    render(<RecipeHub userId="user-123" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /My Recipes/ })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /My Recipes/ }));

    await waitFor(() => {
      expect(screen.getByLabelText("Delete recipe")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByLabelText("Delete recipe"));

    await waitFor(() => {
      expect(screen.getByText("Delete Recipe")).toBeInTheDocument();
      expect(
        screen.getByText(/are you sure you want to delete this recipe/i)
      ).toBeInTheDocument();
    });
  });

  it("deletes recipe when confirmed", async () => {
    const { toast } = await import("sonner");
    const mockDelete = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") {
        const builder = createMockQueryBuilder(personalRecipesData);
        builder.delete = mockDelete;
        return builder;
      }
      if (table === "recipe_notes") return createMockQueryBuilder([]);
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub userId="user-123" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /My Recipes/ })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /My Recipes/ }));

    await waitFor(() => {
      expect(screen.getByLabelText("Delete recipe")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByLabelText("Delete recipe"));

    await waitFor(() => {
      expect(screen.getByText("Delete Recipe")).toBeInTheDocument();
    });

    // Click the "Delete" confirmation button
    fireEvent.click(screen.getByRole("button", { name: /^delete$/i }));

    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith("Recipe deleted!");
    });
  });

  it("shows error toast when delete fails", async () => {
    const { toast } = await import("sonner");
    const mockDelete = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: { message: "Delete failed" } }),
    });

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") {
        const builder = createMockQueryBuilder(personalRecipesData);
        builder.delete = mockDelete;
        return builder;
      }
      if (table === "recipe_notes") return createMockQueryBuilder([]);
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub userId="user-123" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /My Recipes/ })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /My Recipes/ }));

    await waitFor(() => {
      expect(screen.getByLabelText("Delete recipe")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByLabelText("Delete recipe"));

    await waitFor(() => {
      expect(screen.getByText("Delete Recipe")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /^delete$/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to delete recipe");
    });
  });

  it("closes delete dialog when cancel is clicked", async () => {
    render(<RecipeHub userId="user-123" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /My Recipes/ })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /My Recipes/ }));

    await waitFor(() => {
      expect(screen.getByLabelText("Delete recipe")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByLabelText("Delete recipe"));

    await waitFor(() => {
      expect(screen.getByText("Delete Recipe")).toBeInTheDocument();
    });

    // Click cancel in the AlertDialog
    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));

    await waitFor(() => {
      expect(screen.queryByText("Delete Recipe")).not.toBeInTheDocument();
    });
  });
  it("shows guard dialog when recipe is linked to a meal plan", async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") return createMockQueryBuilder(personalRecipesData);
      if (table === "recipe_notes") return createMockQueryBuilder([]);
      if (table === "meal_plan_items") {
        const builder = createMockQueryBuilder([]);
        // Override the then to return count > 0
        builder.then = vi.fn((resolve) =>
          Promise.resolve({ data: null, error: null, count: 1 }).then(resolve)
        );
        return builder;
      }
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub userId="user-123" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /My Recipes/ })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /My Recipes/ }));

    await waitFor(() => {
      expect(screen.getByLabelText("Delete recipe")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByLabelText("Delete recipe"));

    await waitFor(() => {
      expect(screen.getByText("Cannot Delete Recipe")).toBeInTheDocument();
      expect(
        screen.getByText(/remove it from those first before deleting/i)
      ).toBeInTheDocument();
    });

    // Dismiss the guard dialog via OK button (covers onOpenChange handler)
    fireEvent.click(screen.getByRole("button", { name: /OK/i }));

    await waitFor(() => {
      expect(screen.queryByText("Cannot Delete Recipe")).not.toBeInTheDocument();
    });
  });

  it("allows deletion of recipe with eventId when not linked to meal plan", async () => {
    const recipesWithEvent = [
      {
        id: "personal-event",
        name: "Event Recipe",
        url: null,
        event_id: "event-1",
        ingredient_id: null,
        created_by: "user-123",
        created_at: "2025-01-15T10:00:00Z",
        profiles: { name: "Test User", avatar_url: null },
        scheduled_events: { type: "personal" },
      },
    ];

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") return createMockQueryBuilder(recipesWithEvent);
      if (table === "recipe_notes") return createMockQueryBuilder([]);
      if (table === "meal_plan_items") return createMockQueryBuilder([]);
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub userId="user-123" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /My Recipes/ })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /My Recipes/ }));

    await waitFor(() => {
      expect(screen.getByLabelText("Delete recipe")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByLabelText("Delete recipe"));

    // Should show delete confirmation, not guard dialog (eventId no longer blocks deletion)
    await waitFor(() => {
      expect(screen.getByText("Delete Recipe")).toBeInTheDocument();
      expect(screen.queryByText("Cannot Delete Recipe")).not.toBeInTheDocument();
    });
  });

  it("allows deletion when guard check fails (fallback)", async () => {
    const { toast } = await import("sonner");

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") {
        const builder = createMockQueryBuilder(personalRecipesData);
        builder.delete = vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        });
        return builder;
      }
      if (table === "recipe_notes") return createMockQueryBuilder([]);
      if (table === "meal_plan_items") {
        const builder = createMockQueryBuilder([]);
        // Make the guard check throw by rejecting at .eq()
        builder.select = vi.fn().mockReturnValue({
          eq: vi.fn().mockRejectedValue(new Error("DB error")),
        });
        return builder;
      }
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub userId="user-123" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /My Recipes/ })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /My Recipes/ }));

    await waitFor(() => {
      expect(screen.getByLabelText("Delete recipe")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByLabelText("Delete recipe"));

    // Guard fails, so deletion should still proceed — delete dialog should appear
    await waitFor(() => {
      expect(screen.getByText("Delete Recipe")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /^delete$/i }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Recipe deleted!");
    });
  });

  it("shows delete and edit buttons on club event recipes", async () => {
    const clubRecipesData = [
      {
        id: "club-recipe-1",
        name: "Club Event Recipe",
        url: null,
        event_id: "event-1",
        ingredient_id: null,
        created_by: "user-456",
        created_at: "2025-01-15T10:00:00Z",
        ingredients: null,
        scheduled_events: { type: "club" },
      },
    ];

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") return createMockQueryBuilder(clubRecipesData);
      if (table === "recipe_notes") return createMockQueryBuilder([]);
      if (table === "recipe_ratings") return createMockQueryBuilder([]);
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub userId="user-123" />);

    // Club tab is default — wait for recipe to load
    await waitFor(() => {
      expect(screen.getByText("Club Event Recipe")).toBeInTheDocument();
    });

    // Club event recipes now show edit and delete like personal recipes
    expect(screen.getByLabelText("Delete recipe")).toBeInTheDocument();
    expect(screen.getByLabelText("Edit recipe")).toBeInTheDocument();
  });
});

describe("RecipeHub - Personal Event Filtering (US-007)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("excludes personal-event recipes from Club tab", async () => {
    const mixedRecipes = [
      {
        id: "recipe-club",
        name: "Club Event Recipe",
        url: null,
        event_id: "event-club",
        ingredient_id: "ing-1",
        created_by: "user-123",
        created_at: "2025-01-15T10:00:00Z",
        ingredients: { name: "Salmon" },
        scheduled_events: { type: "club" },
      },
      {
        id: "recipe-personal",
        name: "Personal Meal Recipe",
        url: null,
        event_id: "event-personal",
        ingredient_id: "ing-2",
        created_by: "user-123",
        created_at: "2025-01-14T10:00:00Z",
        ingredients: { name: "Chicken" },
        scheduled_events: { type: "personal" },
      },
    ];

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") return createMockQueryBuilder(mixedRecipes);
      if (table === "recipe_notes") return createMockQueryBuilder([]);
      if (table === "recipe_ratings") return createMockQueryBuilder([]);
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub userId="user-123" />);

    await waitFor(() => {
      // Club recipe should appear
      expect(screen.getByText("Club Event Recipe")).toBeInTheDocument();
      // Personal meal recipe should NOT appear in Club tab
      expect(screen.queryByText("Personal Meal Recipe")).not.toBeInTheDocument();
      // Count should only include club recipes
      expect(screen.getByRole("button", { name: "Club (1)" })).toBeInTheDocument();
    });
  });

  it("includes personal-event recipes in My Recipes tab", async () => {
    const userRecipes = [
      {
        id: "recipe-no-event",
        name: "No Event Recipe",
        url: null,
        event_id: null,
        ingredient_id: null,
        created_by: "user-123",
        created_at: "2025-01-15T10:00:00Z",
        ingredients: null,
        profiles: { name: "Test User", avatar_url: null },
        scheduled_events: null,
      },
      {
        id: "recipe-personal-meal",
        name: "Personal Meal Recipe",
        url: null,
        event_id: "event-personal",
        ingredient_id: "ing-1",
        created_by: "user-123",
        created_at: "2025-01-14T10:00:00Z",
        ingredients: { name: "Chicken", color: null },
        profiles: { name: "Test User", avatar_url: null },
        scheduled_events: { type: "personal" },
      },
      {
        id: "recipe-club-event",
        name: "Club Event Recipe",
        url: null,
        event_id: "event-club",
        ingredient_id: "ing-2",
        created_by: "user-123",
        created_at: "2025-01-13T10:00:00Z",
        ingredients: { name: "Salmon", color: null },
        profiles: { name: "Test User", avatar_url: null },
        scheduled_events: { type: "club" },
      },
    ];

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") return createMockQueryBuilder(userRecipes);
      if (table === "recipe_notes") return createMockQueryBuilder([]);
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub userId="user-123" />);

    // Switch to personal tab
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /My Recipes/ })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /My Recipes/ }));

    await waitFor(() => {
      // No-event recipe should appear (personal)
      expect(screen.getByText("No Event Recipe")).toBeInTheDocument();
      // Personal-event recipe should appear
      expect(screen.getByText("Personal Meal Recipe")).toBeInTheDocument();
      // Club-event recipe should NOT appear in personal tab
      expect(screen.queryByText("Club Event Recipe")).not.toBeInTheDocument();
      // Count should only include personal recipes
      expect(screen.getByRole("button", { name: "My Recipes (2)" })).toBeInTheDocument();
    });
  });

  it("handles club recipe with null scheduled_events in Club tab", async () => {
    const recipesWithNullEvents = [
      {
        id: "recipe-1",
        name: "Recipe With Null Events",
        url: null,
        event_id: "event-1",
        ingredient_id: null,
        created_by: "user-123",
        created_at: "2025-01-15T10:00:00Z",
        ingredients: null,
        scheduled_events: null,
      },
    ];

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") return createMockQueryBuilder(recipesWithNullEvents);
      if (table === "recipe_notes") return createMockQueryBuilder([]);
      if (table === "recipe_ratings") return createMockQueryBuilder([]);
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub />);

    await waitFor(() => {
      // Recipe with null scheduled_events should still appear (not personal)
      expect(screen.getByText("Recipe With Null Events")).toBeInTheDocument();
    });
  });

  it("marks personal-event recipes as isPersonal in My Recipes tab", async () => {
    const personalEventRecipes = [
      {
        id: "recipe-personal-meal",
        name: "My Personal Meal",
        url: null,
        event_id: "event-personal",
        ingredient_id: "ing-1",
        created_by: "user-123",
        created_at: "2025-01-14T10:00:00Z",
        ingredients: { name: "Chicken", color: null },
        profiles: { name: "Test User", avatar_url: null },
        scheduled_events: { type: "personal" },
      },
    ];

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") return createMockQueryBuilder(personalEventRecipes);
      if (table === "recipe_notes") return createMockQueryBuilder([]);
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub userId="user-123" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /My Recipes/ })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /My Recipes/ }));

    await waitFor(() => {
      expect(screen.getByText("My Personal Meal")).toBeInTheDocument();
    });
  });
});

describe("RecipeHub - Add Note", () => {
  const clubRecipesData = [
    {
      id: "recipe-1",
      name: "Grilled Salmon",
      url: "https://example.com/salmon",
      event_id: "event-1",
      ingredient_id: "ing-1",
      created_by: "user-123",
      created_at: "2025-01-15T10:00:00Z",
      ingredients: { name: "Salmon" },
      profiles: { name: "Test User", avatar_url: "avatar.jpg" },
      scheduled_events: { type: "club" },
    },
  ];

  const mockNotesData = [
    {
      id: "note-1",
      recipe_id: "recipe-1",
      user_id: "user-123",
      notes: "Test notes",
      photos: null,
      created_at: "2025-01-15T10:00:00Z",
      profiles: { name: "Test User", avatar_url: "avatar.jpg" },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") return createMockQueryBuilder(clubRecipesData);
      if (table === "recipe_notes") return createMockQueryBuilder(mockNotesData);
      if (table === "recipe_ratings") return createMockQueryBuilder([]);
      return createMockQueryBuilder([]);
    });
  });

  it("shows Add Note button on recipe cards when userId is provided", async () => {
    render(<RecipeHub userId="user-123" />);

    await waitFor(() => {
      expect(screen.getByText("Grilled Salmon")).toBeInTheDocument();
      expect(screen.getByLabelText("Add note")).toBeInTheDocument();
    });
  });

  it("does not show Add Note button when no userId", async () => {
    render(<RecipeHub />);

    await waitFor(() => {
      expect(screen.getByText("Grilled Salmon")).toBeInTheDocument();
    });

    expect(screen.queryByLabelText("Add note")).not.toBeInTheDocument();
  });

  it("opens note dialog when Add Note button is clicked", async () => {
    render(<RecipeHub userId="user-123" />);

    await waitFor(() => {
      expect(screen.getByLabelText("Add note")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText("Add note"));

    await waitFor(() => {
      expect(screen.getByText(/Add notes and photos for "Grilled Salmon"/)).toBeInTheDocument();
      expect(screen.getByLabelText("Notes")).toBeInTheDocument();
    });
  });

  it("closes note dialog when cancel is clicked", async () => {
    render(<RecipeHub userId="user-123" />);

    await waitFor(() => {
      expect(screen.getByLabelText("Add note")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText("Add note"));

    await waitFor(() => {
      expect(screen.getByText(/Add notes and photos for/)).toBeInTheDocument();
    });

    // Click cancel
    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));

    await waitFor(() => {
      expect(screen.queryByText(/Add notes and photos for/)).not.toBeInTheDocument();
    });
  });

  it("disables Save Note button when note text is empty and no photos", async () => {
    render(<RecipeHub userId="user-123" />);

    await waitFor(() => {
      expect(screen.getByLabelText("Add note")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText("Add note"));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /save note/i })).toBeDisabled();
    });
  });

  it("enables Save Note button when note text is entered", async () => {
    render(<RecipeHub userId="user-123" />);

    await waitFor(() => {
      expect(screen.getByLabelText("Add note")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText("Add note"));

    await waitFor(() => {
      expect(screen.getByLabelText("Notes")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Notes"), {
      target: { value: "Great recipe!" },
    });

    expect(screen.getByRole("button", { name: /save note/i })).not.toBeDisabled();
  });

  it("saves note successfully", async () => {
    const { toast } = await import("sonner");
    const mockInsert = vi.fn().mockResolvedValue({ error: null });

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") return createMockQueryBuilder(clubRecipesData);
      if (table === "recipe_notes") {
        const builder = createMockQueryBuilder(mockNotesData);
        builder.insert = mockInsert;
        return builder;
      }
      if (table === "recipe_ratings") return createMockQueryBuilder([]);
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub userId="user-123" />);

    await waitFor(() => {
      expect(screen.getByLabelText("Add note")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText("Add note"));

    await waitFor(() => {
      expect(screen.getByLabelText("Notes")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Notes"), {
      target: { value: "Delicious recipe!" },
    });

    fireEvent.click(screen.getByRole("button", { name: /save note/i }));

    await waitFor(() => {
      expect(mockInsert).toHaveBeenCalledWith({
        recipe_id: "recipe-1",
        user_id: "user-123",
        notes: "Delicious recipe!",
        photos: null,
      });
      expect(toast.success).toHaveBeenCalledWith("Note added!");
    });
  });

  it("shows error toast when save note fails", async () => {
    const { toast } = await import("sonner");
    const mockInsert = vi.fn().mockResolvedValue({ error: { message: "Insert failed" } });

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") return createMockQueryBuilder(clubRecipesData);
      if (table === "recipe_notes") {
        const builder = createMockQueryBuilder(mockNotesData);
        builder.insert = mockInsert;
        return builder;
      }
      if (table === "recipe_ratings") return createMockQueryBuilder([]);
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub userId="user-123" />);

    await waitFor(() => {
      expect(screen.getByLabelText("Add note")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText("Add note"));

    await waitFor(() => {
      expect(screen.getByLabelText("Notes")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Notes"), {
      target: { value: "Note text" },
    });

    fireEvent.click(screen.getByRole("button", { name: /save note/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to save note");
    });
  });

  it("closes note dialog via Escape key", async () => {
    render(<RecipeHub userId="user-123" />);

    await waitFor(() => {
      expect(screen.getByLabelText("Add note")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText("Add note"));

    await waitFor(() => {
      expect(screen.getByText(/Add notes and photos for/)).toBeInTheDocument();
    });

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByText(/Add notes and photos for/)).not.toBeInTheDocument();
    });
  });

  it("does not save note when userId is missing", async () => {
    const mockInsert = vi.fn().mockResolvedValue({ error: null });

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") return createMockQueryBuilder(clubRecipesData);
      if (table === "recipe_notes") {
        const builder = createMockQueryBuilder(mockNotesData);
        builder.insert = mockInsert;
        return builder;
      }
      if (table === "recipe_ratings") return createMockQueryBuilder([]);
      return createMockQueryBuilder([]);
    });

    // Render without userId — note buttons won't appear
    render(<RecipeHub />);

    await waitFor(() => {
      expect(screen.getByText("Grilled Salmon")).toBeInTheDocument();
    });

    // No Add Note button should appear
    expect(screen.queryByLabelText("Add note")).not.toBeInTheDocument();
  });

  it("saves note with photos and empty text", async () => {
    const { toast } = await import("sonner");
    const mockInsert = vi.fn().mockResolvedValue({ error: null });

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") return createMockQueryBuilder(clubRecipesData);
      if (table === "recipe_notes") {
        const builder = createMockQueryBuilder(mockNotesData);
        builder.insert = mockInsert;
        return builder;
      }
      if (table === "recipe_ratings") return createMockQueryBuilder([]);
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub userId="user-123" />);

    await waitFor(() => {
      expect(screen.getByLabelText("Add note")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText("Add note"));

    await waitFor(() => {
      expect(screen.getByLabelText("Notes")).toBeInTheDocument();
    });

    // Add a photo via the mocked PhotoUpload
    fireEvent.click(screen.getByText("Add Test Photo"));

    // Save Note button should now be enabled (photos present even though text is empty)
    expect(screen.getByRole("button", { name: /save note/i })).not.toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /save note/i }));

    await waitFor(() => {
      expect(mockInsert).toHaveBeenCalledWith({
        recipe_id: "recipe-1",
        user_id: "user-123",
        notes: null,
        photos: ["https://example.com/photo.jpg"],
      });
      expect(toast.success).toHaveBeenCalledWith("Note added!");
    });
  });

  it("disables Save Note when text is whitespace only and no photos", async () => {
    render(<RecipeHub userId="user-123" />);

    await waitFor(() => {
      expect(screen.getByLabelText("Add note")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText("Add note"));

    await waitFor(() => {
      expect(screen.getByLabelText("Notes")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Notes"), {
      target: { value: "   " },
    });

    expect(screen.getByRole("button", { name: /save note/i })).toBeDisabled();
  });
});

describe("RecipeHub - Recipe Ingredients & Content", () => {
  const clubRecipesData = [
    {
      id: "recipe-1",
      name: "Grilled Salmon",
      url: "https://example.com/salmon",
      event_id: "event-1",
      ingredient_id: "ing-1",
      created_by: "user-123",
      created_at: "2025-01-15T10:00:00Z",
      ingredients: { name: "Salmon" },
      profiles: { name: "Test User", avatar_url: "avatar.jpg" },
      scheduled_events: { type: "club" },
    },
  ];

  const mockIngredientsResult = [
    {
      id: "ri-1",
      recipe_id: "recipe-1",
      name: "Salmon fillet",
      quantity: 2,
      unit: "lb",
      category: "meat_seafood",
      raw_text: "2 lb salmon fillet",
      sort_order: 0,
      created_at: "2025-01-15T10:00:00Z",
    },
    {
      id: "ri-2",
      recipe_id: "recipe-1",
      name: "Lemon",
      quantity: 1,
      unit: null,
      category: "produce",
      raw_text: "1 lemon",
      sort_order: 1,
      created_at: "2025-01-15T10:00:00Z",
    },
  ];

  const mockContentResult = [
    {
      id: "rc-1",
      recipe_id: "recipe-1",
      status: "completed",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads and displays ingredient count on recipe cards", async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") return createMockQueryBuilder(clubRecipesData);
      if (table === "recipe_notes") return createMockQueryBuilder([]);
      if (table === "recipe_ratings") return createMockQueryBuilder([]);
      if (table === "recipe_ingredients") return createMockQueryBuilder(mockIngredientsResult);
      if (table === "recipe_content") return createMockQueryBuilder(mockContentResult);
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub userId="user-123" />);

    await waitFor(() => {
      expect(screen.getByText("Grilled Salmon")).toBeInTheDocument();
      expect(screen.getByText("2 ingredients")).toBeInTheDocument();
    });
  });

  it("handles ingredients with null optional fields", async () => {
    const nullFieldIngredients = [
      {
        id: "ri-1",
        recipe_id: "recipe-1",
        name: "Garlic",
        quantity: null,
        unit: null,
        category: "produce",
        raw_text: null,
        sort_order: null,
        created_at: null,
      },
    ];

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") return createMockQueryBuilder(clubRecipesData);
      if (table === "recipe_notes") return createMockQueryBuilder([]);
      if (table === "recipe_ratings") return createMockQueryBuilder([]);
      if (table === "recipe_ingredients") return createMockQueryBuilder(nullFieldIngredients);
      if (table === "recipe_content") return createMockQueryBuilder(mockContentResult);
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub userId="user-123" />);

    await waitFor(() => {
      expect(screen.getByText("Grilled Salmon")).toBeInTheDocument();
      expect(screen.getByText("1 ingredient")).toBeInTheDocument();
    });
  });

  it("loads recipe content status alongside ingredients", async () => {
    const parsingContent = [{ id: "rc-1", recipe_id: "recipe-1", status: "parsing" }];

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") return createMockQueryBuilder(clubRecipesData);
      if (table === "recipe_notes") return createMockQueryBuilder([]);
      if (table === "recipe_ratings") return createMockQueryBuilder([]);
      if (table === "recipe_ingredients") return createMockQueryBuilder([]);
      if (table === "recipe_content") return createMockQueryBuilder(parsingContent);
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub userId="user-123" />);

    await waitFor(() => {
      expect(screen.getByText("Parsing ingredients...")).toBeInTheDocument();
    });
  });

  it("shows Parse Ingredients button when recipe has URL but no parsed ingredients", async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") return createMockQueryBuilder(clubRecipesData);
      if (table === "recipe_notes") return createMockQueryBuilder([]);
      if (table === "recipe_ratings") return createMockQueryBuilder([]);
      if (table === "recipe_ingredients") return createMockQueryBuilder([]);
      if (table === "recipe_content") return createMockQueryBuilder([]);
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub userId="user-123" />);

    await waitFor(() => {
      expect(screen.getByText("Grilled Salmon")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /parse ingredients/i })).toBeInTheDocument();
    });
  });

  it("handles null data from recipe_ingredients and recipe_content queries", async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") return createMockQueryBuilder(clubRecipesData);
      if (table === "recipe_notes") return createMockQueryBuilder([]);
      if (table === "recipe_ratings") return createMockQueryBuilder([]);
      if (table === "recipe_ingredients") {
        const builder = createMockQueryBuilder([]);
        builder.in = vi.fn().mockResolvedValue({ data: null, error: null });
        return builder;
      }
      if (table === "recipe_content") {
        const builder = createMockQueryBuilder([]);
        builder.in = vi.fn().mockResolvedValue({ data: null, error: null });
        return builder;
      }
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub userId="user-123" />);

    await waitFor(() => {
      expect(screen.getByText("Grilled Salmon")).toBeInTheDocument();
    });
  });

  it("clears ingredient maps when loading recipes with empty IDs", async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") return createMockQueryBuilder([]);
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub userId="user-123" />);

    await waitFor(() => {
      expect(screen.getByText(/no recipes yet/i)).toBeInTheDocument();
    });
  });
});

describe("RecipeHub - Parse Recipe", () => {
  const clubRecipesData = [
    {
      id: "recipe-1",
      name: "Grilled Salmon",
      url: "https://example.com/salmon",
      event_id: "event-1",
      ingredient_id: "ing-1",
      created_by: "user-123",
      created_at: "2025-01-15T10:00:00Z",
      ingredients: { name: "Salmon" },
      profiles: { name: "Test User", avatar_url: "avatar.jpg" },
      scheduled_events: { type: "club" },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockFunctionsInvoke.mockResolvedValue({ data: null, error: null });
  });

  it("triggers parse-recipe when Parse Ingredients button is clicked", async () => {
    const { toast } = await import("sonner");

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") return createMockQueryBuilder(clubRecipesData);
      if (table === "recipe_notes") return createMockQueryBuilder([]);
      if (table === "recipe_ratings") return createMockQueryBuilder([]);
      if (table === "recipe_ingredients") return createMockQueryBuilder([]);
      if (table === "recipe_content") return createMockQueryBuilder([]);
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub userId="user-123" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /parse ingredients/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /parse ingredients/i }));

    await waitFor(() => {
      expect(mockFunctionsInvoke).toHaveBeenCalledWith("parse-recipe", {
        body: {
          recipeId: "recipe-1",
          recipeUrl: "https://example.com/salmon",
          recipeName: "Grilled Salmon",
        },
      });
      expect(toast.success).toHaveBeenCalledWith("Recipe parsed!");
    });
  });

  it("shows error toast when parse-recipe fails", async () => {
    const { toast } = await import("sonner");
    mockFunctionsInvoke.mockResolvedValue({ data: null, error: { message: "Parse failed" } });

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") return createMockQueryBuilder(clubRecipesData);
      if (table === "recipe_notes") return createMockQueryBuilder([]);
      if (table === "recipe_ratings") return createMockQueryBuilder([]);
      if (table === "recipe_ingredients") return createMockQueryBuilder([]);
      if (table === "recipe_content") return createMockQueryBuilder([]);
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub userId="user-123" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /parse ingredients/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /parse ingredients/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to parse recipe");
    });
  });

  it("does not call parse-recipe when recipe has no URL", async () => {
    const noUrlRecipes = [
      { ...clubRecipesData[0], url: null },
    ];

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") return createMockQueryBuilder(noUrlRecipes);
      if (table === "recipe_notes") return createMockQueryBuilder([]);
      if (table === "recipe_ratings") return createMockQueryBuilder([]);
      if (table === "recipe_ingredients") return createMockQueryBuilder([]);
      if (table === "recipe_content") return createMockQueryBuilder([]);
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub userId="user-123" />);

    await waitFor(() => {
      expect(screen.getByText("Grilled Salmon")).toBeInTheDocument();
    });

    // No parse button should appear for recipe without URL
    expect(screen.queryByRole("button", { name: /parse ingredients/i })).not.toBeInTheDocument();
    expect(mockFunctionsInvoke).not.toHaveBeenCalled();
  });

  it("shows edit ingredients button for personal recipes and opens dialog", async () => {
    const personalRecipesData = [
      {
        id: "personal-1",
        name: "My Editable Recipe",
        url: null,
        event_id: null,
        ingredient_id: null,
        created_by: "user-123",
        created_at: "2025-01-15T10:00:00Z",
        profiles: { name: "Test User", avatar_url: null },
        scheduled_events: null,
      },
    ];

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") return createMockQueryBuilder(personalRecipesData);
      if (table === "recipe_notes") return createMockQueryBuilder([]);
      if (table === "recipe_ingredients") return createMockQueryBuilder([]);
      if (table === "recipe_content") return createMockQueryBuilder([]);
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub userId="user-123" />);

    // Switch to personal tab
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /My Recipes/ })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /My Recipes/ }));

    await waitFor(() => {
      expect(screen.getByText("My Editable Recipe")).toBeInTheDocument();
    });

    // Click edit ingredients button
    fireEvent.click(screen.getByLabelText("Edit ingredients"));

    // Edit Ingredients Dialog should open
    await waitFor(() => {
      expect(screen.getByText("Edit Ingredients")).toBeInTheDocument();
    });
  });

  it("reloads recipes after saving ingredients", async () => {
    const personalRecipesData = [
      {
        id: "personal-1",
        name: "Recipe To Edit",
        url: null,
        event_id: null,
        ingredient_id: null,
        created_by: "user-123",
        created_at: "2025-01-15T10:00:00Z",
        profiles: { name: "Test User", avatar_url: null },
        scheduled_events: null,
      },
    ];

    // Mock rpc for saving ingredients
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") return createMockQueryBuilder(personalRecipesData);
      if (table === "recipe_notes") return createMockQueryBuilder([]);
      if (table === "recipe_ingredients") return createMockQueryBuilder([]);
      if (table === "recipe_content") return createMockQueryBuilder([]);
      return createMockQueryBuilder([]);
    });

    // Need to also mock rpc on supabase for the EditRecipeIngredientsDialog save
    const { supabase } = await import("@/integrations/supabase/client");
    (supabase as unknown as Record<string, unknown>).rpc = vi.fn().mockResolvedValue({ error: null });

    render(<RecipeHub userId="user-123" />);

    // Switch to personal tab
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /My Recipes/ })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /My Recipes/ }));

    await waitFor(() => {
      expect(screen.getByText("Recipe To Edit")).toBeInTheDocument();
    });

    // Click edit ingredients button
    fireEvent.click(screen.getByLabelText("Edit ingredients"));

    await waitFor(() => {
      expect(screen.getByText("Edit Ingredients")).toBeInTheDocument();
    });

    // Add an ingredient name so save will work
    fireEvent.change(screen.getByLabelText("Name for row 1"), {
      target: { value: "Flour" },
    });

    // Click save
    fireEvent.click(screen.getByRole("button", { name: /save ingredients/i }));

    // The dialog should close and recipes should reload
    await waitFor(() => {
      expect(screen.queryByText("Edit Ingredients")).not.toBeInTheDocument();
    });
  });
});
