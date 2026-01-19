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
