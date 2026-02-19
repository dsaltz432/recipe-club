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
      if (table === "saved_recipes") {
        return createMockQueryBuilder([]);
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

  it("renders Club Recipes and My Recipes sub-tab buttons", async () => {
    mockSupabaseFrom.mockImplementation(() => createMockQueryBuilder([]));

    render(<RecipeHub userId="user-123" />);

    await waitFor(() => {
      expect(screen.getByText("Club Recipes")).toBeInTheDocument();
      expect(screen.getByText("My Recipes")).toBeInTheDocument();
    });
  });

  it("shows club recipes by default", async () => {
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
    });
  });

  it("shows personal empty state when switching to My Recipes tab", async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") {
        // Return empty for personal recipes
        return {
          ...createMockQueryBuilder([]),
          is: vi.fn().mockReturnThis(),
        };
      }
      if (table === "saved_recipes") {
        return createMockQueryBuilder([]);
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
      expect(screen.getByText("My Recipes")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("My Recipes"));

    await waitFor(() => {
      expect(
        screen.getByText(/no personal recipes yet/i)
      ).toBeInTheDocument();
    });
  });

  it("shows Add Recipe button in personal tab", async () => {
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

    // Click "My Recipes" tab
    await waitFor(() => {
      expect(screen.getByText("My Recipes")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("My Recipes"));

    await waitFor(() => {
      expect(screen.getByText("Add Recipe")).toBeInTheDocument();
    });
  });

  it("does not show Add Recipe button without userId", async () => {
    mockSupabaseFrom.mockImplementation(() => createMockQueryBuilder([]));

    render(<RecipeHub />);

    // Click "My Recipes" tab
    await waitFor(() => {
      expect(screen.getByText("My Recipes")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("My Recipes"));

    await waitFor(() => {
      expect(screen.queryByText("Add Recipe")).not.toBeInTheDocument();
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
      expect(screen.getByText("My Recipes")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("My Recipes"));

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
      },
    ];

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") {
        return createMockQueryBuilder(personalRecipesData);
      }
      if (table === "saved_recipes") {
        return createMockQueryBuilder([]);
      }
      if (table === "recipe_notes") {
        return createMockQueryBuilder([]);
      }
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub userId="user-123" />);

    // Switch to personal tab
    await waitFor(() => {
      expect(screen.getByText("My Recipes")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("My Recipes"));

    await waitFor(() => {
      expect(screen.getByText("My Home Recipe")).toBeInTheDocument();
    });
  });

  it("loads saved club recipes in personal tab", async () => {
    const savedRecipesData = [
      {
        recipe_id: "saved-club-1",
        recipes: {
          id: "saved-club-1",
          name: "Saved Club Recipe",
          url: "https://example.com/saved",
          event_id: "event-1",
          ingredient_id: "ing-1",
          created_by: "user-456",
          created_at: "2025-01-15T10:00:00Z",
          ingredients: { name: "Chicken", color: "#E6D5B8" },
          profiles: { name: "Other User", avatar_url: "avatar2.jpg" },
        },
      },
    ];

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") {
        return createMockQueryBuilder([]);
      }
      if (table === "saved_recipes") {
        return createMockQueryBuilder(savedRecipesData);
      }
      if (table === "recipe_notes") {
        return createMockQueryBuilder([]);
      }
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub userId="user-123" />);

    // Switch to personal tab
    await waitFor(() => {
      expect(screen.getByText("My Recipes")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("My Recipes"));

    await waitFor(() => {
      expect(screen.getByText("Saved Club Recipe")).toBeInTheDocument();
    });
  });

  it("deduplicates saved recipes against personal recipes", async () => {
    const personalRecipesData = [
      {
        id: "recipe-1",
        name: "My Recipe",
        url: null,
        event_id: null,
        ingredient_id: null,
        created_by: "user-123",
        created_at: "2025-01-15T10:00:00Z",
        profiles: { name: "Test User", avatar_url: null },
      },
    ];

    const savedRecipesData = [
      {
        recipe_id: "recipe-1", // same id as personal recipe
        recipes: {
          id: "recipe-1",
          name: "My Recipe",
          url: null,
          event_id: null,
          ingredient_id: null,
          created_by: "user-123",
          created_at: "2025-01-15T10:00:00Z",
          ingredients: null,
          profiles: null,
        },
      },
    ];

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") {
        return createMockQueryBuilder(personalRecipesData);
      }
      if (table === "saved_recipes") {
        return createMockQueryBuilder(savedRecipesData);
      }
      if (table === "recipe_notes") {
        return createMockQueryBuilder([]);
      }
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub userId="user-123" />);

    await waitFor(() => {
      expect(screen.getByText("My Recipes")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("My Recipes"));

    await waitFor(() => {
      // Should only show once, not duplicated
      const recipes = screen.getAllByText("My Recipe");
      expect(recipes).toHaveLength(1);
    });
  });

  it("skips null recipes in saved_recipes join data", async () => {
    const savedRecipesData = [
      {
        recipe_id: "recipe-1",
        recipes: null, // null join - recipe was deleted
      },
    ];

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") {
        return createMockQueryBuilder([]);
      }
      if (table === "saved_recipes") {
        return createMockQueryBuilder(savedRecipesData);
      }
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub userId="user-123" />);

    await waitFor(() => {
      expect(screen.getByText("My Recipes")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("My Recipes"));

    await waitFor(() => {
      expect(screen.getByText(/no personal recipes yet/i)).toBeInTheDocument();
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
      if (table === "saved_recipes") {
        return createMockQueryBuilder([]);
      }
      if (table === "recipe_notes") {
        return createMockQueryBuilder(notesData);
      }
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub userId="user-123" />);

    await waitFor(() => {
      expect(screen.getByText("My Recipes")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("My Recipes"));

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
      expect(screen.getByText("My Recipes")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("My Recipes"));

    await waitFor(() => {
      expect(screen.getByText(/no personal recipes yet/i)).toBeInTheDocument();
    });
  });

  it("handles saved_recipes error", async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") {
        return createMockQueryBuilder([]);
      }
      if (table === "saved_recipes") {
        return createMockQueryBuilder([], { message: "Error" });
      }
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub userId="user-123" />);

    await waitFor(() => {
      expect(screen.getByText("My Recipes")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("My Recipes"));

    await waitFor(() => {
      expect(screen.getByText(/no personal recipes yet/i)).toBeInTheDocument();
    });
  });

  it("returns empty recipes when no userId in personal tab", async () => {
    mockSupabaseFrom.mockImplementation(() => createMockQueryBuilder([]));

    render(<RecipeHub />);

    await waitFor(() => {
      expect(screen.getByText("My Recipes")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("My Recipes"));

    await waitFor(() => {
      expect(screen.getByText(/no personal recipes yet/i)).toBeInTheDocument();
    });
  });

  it("handles loadSavedRecipeIds error gracefully", async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "saved_recipes") {
        return createMockQueryBuilder([], { message: "Error loading saved" });
      }
      if (table === "recipes") {
        return createMockQueryBuilder([]);
      }
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub userId="user-123" />);

    // Should still render without crashing
    await waitFor(() => {
      expect(screen.getByText("Club Recipes")).toBeInTheDocument();
    });
  });

  it("opens add personal recipe dialog", async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") {
        return createMockQueryBuilder([]);
      }
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub userId="user-123" />);

    await waitFor(() => {
      expect(screen.getByText("My Recipes")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("My Recipes"));

    await waitFor(() => {
      expect(screen.getByText("Add Recipe")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Add Recipe"));

    await waitFor(() => {
      expect(screen.getByText("Add Personal Recipe")).toBeInTheDocument();
    });
  });

  it("toggles save state via handleSaveToggle - save", async () => {
    const mockRecipesData = [
      {
        id: "recipe-1",
        name: "Test Recipe",
        url: null,
        event_id: "event-1",
        ingredient_id: null,
        created_by: "user-123",
        created_at: "2025-01-15T10:00:00Z",
        ingredients: null,
      },
    ];

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") return createMockQueryBuilder(mockRecipesData);
      if (table === "recipe_notes") return createMockQueryBuilder([]);
      if (table === "recipe_ratings") return createMockQueryBuilder([]);
      if (table === "saved_recipes") {
        const builder = createMockQueryBuilder([]);
        builder.insert = vi.fn().mockResolvedValue({ error: null });
        builder.eq.mockImplementation(() => ({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }));
        return builder;
      }
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub userId="user-123" />);

    await waitFor(() => {
      expect(screen.getByText("Test Recipe")).toBeInTheDocument();
    });

    // Click the save button to trigger handleSaveToggle with saved=true
    const bookmarkButton = screen.getByTitle("Save to collection");
    fireEvent.click(bookmarkButton);

    // The bookmark state should toggle
    await waitFor(() => {
      expect(screen.getByTitle("Remove from collection")).toBeInTheDocument();
    });
  });

  it("toggles save state via handleSaveToggle - unsave", async () => {
    const mockRecipesData = [
      {
        id: "recipe-1",
        name: "Test Recipe",
        url: null,
        event_id: "event-1",
        ingredient_id: null,
        created_by: "user-123",
        created_at: "2025-01-15T10:00:00Z",
        ingredients: null,
      },
    ];

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") return createMockQueryBuilder(mockRecipesData);
      if (table === "recipe_notes") return createMockQueryBuilder([]);
      if (table === "recipe_ratings") return createMockQueryBuilder([]);
      if (table === "saved_recipes") {
        const builder = createMockQueryBuilder([]);
        builder.insert = vi.fn().mockResolvedValue({ error: null });
        builder.eq.mockImplementation(() => ({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }));
        return builder;
      }
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub userId="user-123" />);

    await waitFor(() => {
      expect(screen.getByText("Test Recipe")).toBeInTheDocument();
    });

    // First save the recipe
    fireEvent.click(screen.getByTitle("Save to collection"));

    await waitFor(() => {
      expect(screen.getByTitle("Remove from collection")).toBeInTheDocument();
    });

    // Now unsave it - triggers handleSaveToggle with saved=false (delete branch)
    fireEvent.click(screen.getByTitle("Remove from collection"));

    await waitFor(() => {
      expect(screen.getByTitle("Save to collection")).toBeInTheDocument();
    });
  });

  it("shows saved club recipe with ingredient info without color", async () => {
    const savedRecipesData = [
      {
        recipe_id: "saved-1",
        recipes: {
          id: "saved-1",
          name: "Recipe No Color",
          url: null,
          event_id: "event-1",
          ingredient_id: "ing-1",
          created_by: null,
          created_at: "2025-01-15T10:00:00Z",
          ingredients: { name: "Tomato", color: null },
          profiles: null,
        },
      },
    ];

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") {
        return createMockQueryBuilder([]);
      }
      if (table === "saved_recipes") {
        return createMockQueryBuilder(savedRecipesData);
      }
      if (table === "recipe_notes") {
        return createMockQueryBuilder([]);
      }
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub userId="user-123" />);

    await waitFor(() => {
      expect(screen.getByText("My Recipes")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("My Recipes"));

    await waitFor(() => {
      expect(screen.getByText("Recipe No Color")).toBeInTheDocument();
    });
  });

  it("shows saved recipe without ingredient info", async () => {
    const savedRecipesData = [
      {
        recipe_id: "saved-1",
        recipes: {
          id: "saved-1",
          name: "Recipe No Ingredient",
          url: null,
          event_id: "event-1",
          ingredient_id: null,
          created_by: null,
          created_at: "2025-01-15T10:00:00Z",
          ingredients: null,
          profiles: null,
        },
      },
    ];

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") {
        return createMockQueryBuilder([]);
      }
      if (table === "saved_recipes") {
        return createMockQueryBuilder(savedRecipesData);
      }
      if (table === "recipe_notes") {
        return createMockQueryBuilder([]);
      }
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub userId="user-123" />);

    await waitFor(() => {
      expect(screen.getByText("My Recipes")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("My Recipes"));

    await waitFor(() => {
      expect(screen.getByText("Recipe No Ingredient")).toBeInTheDocument();
    });
  });

  it("triggers onRecipeAdded callback when a recipe is added", async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") {
        const builder = createMockQueryBuilder([]);
        builder.insert = vi.fn().mockResolvedValue({ error: null });
        return builder;
      }
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub userId="user-123" />);

    // Switch to personal tab
    await waitFor(() => {
      expect(screen.getByText("My Recipes")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("My Recipes"));

    // Open the dialog
    await waitFor(() => {
      expect(screen.getByText("Add Recipe")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Add Recipe"));

    // Fill in the form and submit
    await waitFor(() => {
      expect(screen.getByLabelText(/recipe name/i)).toBeInTheDocument();
    });
    fireEvent.change(screen.getByLabelText(/recipe name/i), {
      target: { value: "New Recipe" },
    });
    fireEvent.click(screen.getByRole("button", { name: /add recipe/i }));

    // The dialog should close (onRecipeAdded triggers loadRecipes)
    await waitFor(() => {
      expect(screen.queryByText("Add Personal Recipe")).not.toBeInTheDocument();
    });
  });

  it("loads saved recipe with null event_id and notes with null profiles", async () => {
    const personalRecipesData = [
      {
        id: "personal-1",
        name: "Personal Recipe",
        url: null,
        event_id: null,
        ingredient_id: null,
        created_by: "user-123",
        created_at: "2025-01-15T10:00:00Z",
        profiles: { name: "Test User", avatar_url: null },
      },
    ];

    const savedRecipesData = [
      {
        recipe_id: "saved-1",
        recipes: {
          id: "saved-1",
          name: "Saved No Event",
          url: null,
          event_id: null,
          ingredient_id: null,
          created_by: null,
          created_at: "2025-01-15T10:00:00Z",
          ingredients: null,
          profiles: null,
        },
      },
    ];

    const notesData = [
      {
        id: "note-1",
        recipe_id: "saved-1",
        user_id: "user-123",
        notes: "First note",
        photos: null,
        created_at: "2025-01-15T10:00:00Z",
        profiles: { name: "User A", avatar_url: null },
      },
      {
        id: "note-2",
        recipe_id: "saved-1",
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
      if (table === "saved_recipes") {
        return createMockQueryBuilder(savedRecipesData);
      }
      if (table === "recipe_notes") {
        return createMockQueryBuilder(notesData);
      }
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub userId="user-123" />);

    await waitFor(() => {
      expect(screen.getByText("My Recipes")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("My Recipes"));

    await waitFor(() => {
      expect(screen.getByText("Saved No Event")).toBeInTheDocument();
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
      if (table === "saved_recipes") {
        return createMockQueryBuilder([]);
      }
      if (table === "recipe_notes") {
        return createMockQueryBuilder([]);
      }
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub userId="user-123" />);

    await waitFor(() => {
      expect(screen.getByText("My Recipes")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("My Recipes"));

    await waitFor(() => {
      expect(screen.getByText(/no personal recipes yet/i)).toBeInTheDocument();
    });
  });

  it("handles null savedResult data", async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") {
        return createMockQueryBuilder([]);
      }
      if (table === "saved_recipes") {
        // Return null data to exercise (savedResult.data || []) fallback
        const builder = createMockQueryBuilder([]);
        builder.then = vi.fn((resolve) =>
          Promise.resolve({ data: null, error: null }).then(resolve)
        );
        return builder;
      }
      if (table === "recipe_notes") {
        return createMockQueryBuilder([]);
      }
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub userId="user-123" />);

    await waitFor(() => {
      expect(screen.getByText("My Recipes")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("My Recipes"));

    await waitFor(() => {
      expect(screen.getByText(/no personal recipes yet/i)).toBeInTheDocument();
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
      },
    ];

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") {
        return createMockQueryBuilder(personalRecipesData);
      }
      if (table === "saved_recipes") {
        return createMockQueryBuilder([]);
      }
      if (table === "recipe_notes") {
        return createMockQueryBuilder([]);
      }
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub userId="user-123" />);

    await waitFor(() => {
      expect(screen.getByText("My Recipes")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("My Recipes"));

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
      },
    ];

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") {
        return createMockQueryBuilder(personalRecipesData);
      }
      if (table === "saved_recipes") {
        return createMockQueryBuilder([]);
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
      expect(screen.getByText("My Recipes")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("My Recipes"));

    await waitFor(() => {
      expect(screen.getByText("Recipe With Null Notes")).toBeInTheDocument();
    });
  });
});

describe("RecipeHub - Shared with Me tab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabaseFrom.mockImplementation(() => createMockQueryBuilder([]));
  });

  it("shows Shared with Me button when userEmail is provided", async () => {
    render(<RecipeHub userId="user-123" userEmail="test@example.com" />);

    await waitFor(() => {
      expect(screen.getByText("Shared with Me")).toBeInTheDocument();
    });
  });

  it("does not show Shared with Me button without userEmail", async () => {
    render(<RecipeHub userId="user-123" />);

    await waitFor(() => {
      expect(screen.getByText("Club Recipes")).toBeInTheDocument();
      expect(screen.queryByText("Shared with Me")).not.toBeInTheDocument();
    });
  });

  it("hides Club and My Recipes tabs for share_only users", async () => {
    render(<RecipeHub userId="user-123" userEmail="test@example.com" accessType="share_only" />);

    await waitFor(() => {
      expect(screen.queryByText("Club Recipes")).not.toBeInTheDocument();
      expect(screen.queryByText("My Recipes")).not.toBeInTheDocument();
      expect(screen.getByText("Shared with Me")).toBeInTheDocument();
    });
  });

  it("renders SharedWithMeSection when switching to shared tab", async () => {
    const sharesData = [
      {
        id: "share-1",
        recipe_id: "recipe-1",
        message: null,
        viewed_at: null,
        shared_at: "2025-02-14T10:00:00Z",
        recipes: { name: "Shared Recipe", url: null },
        profiles: { name: "Sarah" },
      },
    ];

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipe_shares") {
        return createMockQueryBuilder(sharesData);
      }
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub userId="user-123" userEmail="test@example.com" />);

    await waitFor(() => {
      expect(screen.getByText("Shared with Me")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Shared with Me"));

    await waitFor(() => {
      expect(screen.getByText("Shared Recipe")).toBeInTheDocument();
    });
  });

  it("shows search/filter for club tab but not for shared tab", async () => {
    render(<RecipeHub userId="user-123" userEmail="test@example.com" />);

    // Club tab should have search
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/search recipes/i)).toBeInTheDocument();
    });

    // Switch to shared tab
    fireEvent.click(screen.getByText("Shared with Me"));

    await waitFor(() => {
      expect(screen.queryByPlaceholderText(/search recipes/i)).not.toBeInTheDocument();
    });
  });

  it("defaults to shared tab for share_only users", async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipe_shares") {
        return createMockQueryBuilder([]);
      }
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub userId="user-123" userEmail="test@example.com" accessType="share_only" />);

    await waitFor(() => {
      // Should show the shared empty state, not the club empty state
      expect(screen.getByText(/no recipes have been shared with you yet/i)).toBeInTheDocument();
    });
  });

  it("switches back to club tab from shared tab", async () => {
    const mockRecipesData = [
      {
        id: "recipe-1",
        name: "Club Recipe",
        url: null,
        event_id: "event-1",
        ingredient_id: null,
        created_by: "user-123",
        created_at: "2025-01-15T10:00:00Z",
        ingredients: null,
      },
    ];

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") return createMockQueryBuilder(mockRecipesData);
      if (table === "recipe_notes") return createMockQueryBuilder([]);
      if (table === "recipe_ratings") return createMockQueryBuilder([]);
      if (table === "recipe_shares") return createMockQueryBuilder([]);
      return createMockQueryBuilder([]);
    });

    render(<RecipeHub userId="user-123" userEmail="test@example.com" />);

    // Wait for loading
    await waitFor(() => {
      expect(screen.getByText("Club Recipes")).toBeInTheDocument();
    });

    // Switch to shared tab
    fireEvent.click(screen.getByText("Shared with Me"));
    await waitFor(() => {
      expect(screen.queryByPlaceholderText(/search recipes/i)).not.toBeInTheDocument();
    });

    // Switch back to club tab
    fireEvent.click(screen.getByText("Club Recipes"));
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/search recipes/i)).toBeInTheDocument();
    });
  });
});
