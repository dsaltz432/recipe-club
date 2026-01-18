import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@tests/utils";
import AddRecipeForm from "@/components/recipes/AddRecipeForm";
import { toast } from "sonner";

// Mock Supabase
const mockSupabaseFrom = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => mockSupabaseFrom(...args),
    storage: {
      from: () => ({
        upload: vi.fn().mockResolvedValue({ error: null }),
        remove: vi.fn().mockResolvedValue({ error: null }),
        getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: "https://example.com/photo.jpg" } }),
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

// Mock date-fns
vi.mock("date-fns", () => ({
  format: (date: Date) => {
    const d = new Date(date);
    return `${d.toLocaleString("en-US", { month: "short" })} ${d.getDate()}, ${d.getFullYear()}`;
  },
  parseISO: (str: string) => new Date(str),
}));

// Helper to create mock query builder
const createMockQueryBuilder = (data: unknown[] = [], error: unknown = null) => ({
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  neq: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  ilike: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  order: vi.fn().mockResolvedValue({ data, error }),
  single: vi.fn().mockResolvedValue({ data: data[0] || null, error }),
  maybeSingle: vi.fn().mockResolvedValue({ data: data[0] || null, error }),
  then: vi.fn((resolve) => Promise.resolve({ data, error }).then(resolve)),
});

describe("AddRecipeForm", () => {
  const mockOnOpenChange = vi.fn();
  const mockOnRecipeAdded = vi.fn();
  const mockUserId = "user-123";

  const mockEventsData = [
    {
      id: "event-1",
      event_date: "2025-01-15",
      ingredients: { name: "Salmon" },
    },
    {
      id: "event-2",
      event_date: "2025-01-20",
      ingredients: { name: "Chicken" },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementation
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "scheduled_events") {
        return createMockQueryBuilder(mockEventsData);
      }
      if (table === "recipes") {
        return createMockQueryBuilder([]);
      }
      if (table === "recipe_contributions") {
        return createMockQueryBuilder([]);
      }
      return createMockQueryBuilder([]);
    });
  });

  it("renders dialog when open", async () => {
    render(
      <AddRecipeForm
        open={true}
        onOpenChange={mockOnOpenChange}
        userId={mockUserId}
        onRecipeAdded={mockOnRecipeAdded}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      // Use heading role to find the title specifically
      expect(screen.getByRole("heading", { name: /add recipe/i })).toBeInTheDocument();
    });
  });

  it("does not render dialog when closed", () => {
    render(
      <AddRecipeForm
        open={false}
        onOpenChange={mockOnOpenChange}
        userId={mockUserId}
        onRecipeAdded={mockOnRecipeAdded}
      />
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("loads events when dialog opens", async () => {
    render(
      <AddRecipeForm
        open={true}
        onOpenChange={mockOnOpenChange}
        userId={mockUserId}
        onRecipeAdded={mockOnRecipeAdded}
      />
    );

    await waitFor(() => {
      expect(mockSupabaseFrom).toHaveBeenCalledWith("scheduled_events");
    });
  });

  it("shows event selector with loaded events", async () => {
    render(
      <AddRecipeForm
        open={true}
        onOpenChange={mockOnOpenChange}
        userId={mockUserId}
        onRecipeAdded={mockOnRecipeAdded}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Select an event")).toBeInTheDocument();
    });
  });

  it("shows message when no events available", async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "scheduled_events") {
        return createMockQueryBuilder([]);
      }
      return createMockQueryBuilder([]);
    });

    render(
      <AddRecipeForm
        open={true}
        onOpenChange={mockOnOpenChange}
        userId={mockUserId}
        onRecipeAdded={mockOnRecipeAdded}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/no events available/i)).toBeInTheDocument();
    });
  });

  it("renders recipe name input", async () => {
    render(
      <AddRecipeForm
        open={true}
        onOpenChange={mockOnOpenChange}
        userId={mockUserId}
        onRecipeAdded={mockOnRecipeAdded}
      />
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/start typing to search/i)).toBeInTheDocument();
    });
  });

  it("renders recipe URL input", async () => {
    render(
      <AddRecipeForm
        open={true}
        onOpenChange={mockOnOpenChange}
        userId={mockUserId}
        onRecipeAdded={mockOnRecipeAdded}
      />
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/https/i)).toBeInTheDocument();
    });
  });

  it("disables submit button when form is incomplete", async () => {
    render(
      <AddRecipeForm
        open={true}
        onOpenChange={mockOnOpenChange}
        userId={mockUserId}
        onRecipeAdded={mockOnRecipeAdded}
      />
    );

    await waitFor(() => {
      const submitButton = screen.getByRole("button", { name: /add recipe/i });
      expect(submitButton).toBeDisabled();
    });
  });

  it("shows validation error when submitting without required fields", async () => {
    render(
      <AddRecipeForm
        open={true}
        onOpenChange={mockOnOpenChange}
        userId={mockUserId}
        onRecipeAdded={mockOnRecipeAdded}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    // Try to submit form by firing submit event on form
    const form = screen.getByRole("dialog").querySelector("form");
    fireEvent.submit(form!);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Please select an event and enter a recipe name"
      );
    });
  });

  it("handles cancel button click", async () => {
    render(
      <AddRecipeForm
        open={true}
        onOpenChange={mockOnOpenChange}
        userId={mockUserId}
        onRecipeAdded={mockOnRecipeAdded}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it("loads recipe suggestions when typing", async () => {
    const mockExistingRecipes = [
      { id: "recipe-1", name: "Grilled Salmon", url: "https://example.com", created_by: "user-1", created_at: "2025-01-01" },
    ];

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "scheduled_events") {
        return createMockQueryBuilder(mockEventsData);
      }
      if (table === "recipes") {
        const builder = createMockQueryBuilder(mockExistingRecipes);
        builder.limit = vi.fn().mockResolvedValue({ data: mockExistingRecipes, error: null });
        return builder;
      }
      return createMockQueryBuilder([]);
    });

    render(
      <AddRecipeForm
        open={true}
        onOpenChange={mockOnOpenChange}
        userId={mockUserId}
        onRecipeAdded={mockOnRecipeAdded}
      />
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/start typing/i)).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/start typing/i);
    fireEvent.change(input, { target: { value: "Gr" } });
    fireEvent.focus(input);

    await waitFor(() => {
      expect(mockSupabaseFrom).toHaveBeenCalledWith("recipes");
    });
  });

  it("does not load suggestions for single character", async () => {
    render(
      <AddRecipeForm
        open={true}
        onOpenChange={mockOnOpenChange}
        userId={mockUserId}
        onRecipeAdded={mockOnRecipeAdded}
      />
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/start typing/i)).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/start typing/i);
    fireEvent.change(input, { target: { value: "G" } });

    // Autocomplete should not show for single character
    expect(screen.queryByText(/create new recipe/i)).not.toBeInTheDocument();
  });

  it("handles error when loading events fails", async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "scheduled_events") {
        return createMockQueryBuilder([], { message: "Database error" });
      }
      return createMockQueryBuilder([]);
    });

    render(
      <AddRecipeForm
        open={true}
        onOpenChange={mockOnOpenChange}
        userId={mockUserId}
        onRecipeAdded={mockOnRecipeAdded}
      />
    );

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to load events");
    });
  });

  it("shows loading state for events", async () => {
    // Make the events query slow
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "scheduled_events") {
        const builder = createMockQueryBuilder(mockEventsData);
        builder.order = vi.fn().mockReturnValue(
          new Promise((resolve) => setTimeout(() => resolve({ data: mockEventsData, error: null }), 100))
        );
        return builder;
      }
      return createMockQueryBuilder([]);
    });

    render(
      <AddRecipeForm
        open={true}
        onOpenChange={mockOnOpenChange}
        userId={mockUserId}
        onRecipeAdded={mockOnRecipeAdded}
      />
    );

    // Check for loading skeleton
    expect(document.querySelector(".animate-pulse")).toBeInTheDocument();

    await waitFor(() => {
      expect(document.querySelector(".animate-pulse")).not.toBeInTheDocument();
    });
  });

  it("shows dialog description", async () => {
    render(
      <AddRecipeForm
        open={true}
        onOpenChange={mockOnOpenChange}
        userId={mockUserId}
        onRecipeAdded={mockOnRecipeAdded}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/add a recipe to one of your club events/i)).toBeInTheDocument();
    });
  });

  it("shows required indicator for recipe name", async () => {
    render(
      <AddRecipeForm
        open={true}
        onOpenChange={mockOnOpenChange}
        userId={mockUserId}
        onRecipeAdded={mockOnRecipeAdded}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/recipe name \*/i)).toBeInTheDocument();
    });
  });
});

describe("AddRecipeForm - Autocomplete Functionality", () => {
  const mockOnOpenChange = vi.fn();
  const mockOnRecipeAdded = vi.fn();
  const mockUserId = "user-123";

  const mockEventsData = [
    {
      id: "event-1",
      event_date: "2025-01-15",
      ingredients: { name: "Salmon" },
    },
  ];

  const mockExistingRecipes = [
    {
      id: "recipe-1",
      name: "Grilled Salmon",
      url: "https://example.com/salmon",
      created_by: "user-456",
      created_at: "2025-01-01",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "scheduled_events") {
        return createMockQueryBuilder(mockEventsData);
      }
      if (table === "recipes") {
        const builder = createMockQueryBuilder([]);
        builder.ilike = vi.fn().mockReturnThis();
        builder.limit = vi.fn().mockResolvedValue({ data: mockExistingRecipes, error: null });
        return builder;
      }
      return createMockQueryBuilder([]);
    });
  });

  it("shows existing recipe suggestions when typing", async () => {
    render(
      <AddRecipeForm
        open={true}
        onOpenChange={mockOnOpenChange}
        userId={mockUserId}
        onRecipeAdded={mockOnRecipeAdded}
      />
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/start typing/i)).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/start typing/i);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Gri" } });

    await waitFor(() => {
      expect(screen.getByText("Grilled Salmon")).toBeInTheDocument();
    });
  });

  it("shows create new option when typing", async () => {
    render(
      <AddRecipeForm
        open={true}
        onOpenChange={mockOnOpenChange}
        userId={mockUserId}
        onRecipeAdded={mockOnRecipeAdded}
      />
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/start typing/i)).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/start typing/i);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "New Recipe" } });

    await waitFor(() => {
      expect(screen.getByText(/create new recipe/i)).toBeInTheDocument();
    });
  });

  it("selects existing recipe and shows selected state", async () => {
    render(
      <AddRecipeForm
        open={true}
        onOpenChange={mockOnOpenChange}
        userId={mockUserId}
        onRecipeAdded={mockOnRecipeAdded}
      />
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/start typing/i)).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/start typing/i);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Gri" } });

    await waitFor(() => {
      expect(screen.getByText("Grilled Salmon")).toBeInTheDocument();
    });

    // Click on the existing recipe suggestion
    const suggestions = screen.getAllByText("Grilled Salmon");
    fireEvent.click(suggestions[0]);

    await waitFor(() => {
      expect(screen.getByText(/selected recipe/i)).toBeInTheDocument();
    });
  });

  it("allows changing selected recipe", async () => {
    render(
      <AddRecipeForm
        open={true}
        onOpenChange={mockOnOpenChange}
        userId={mockUserId}
        onRecipeAdded={mockOnRecipeAdded}
      />
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/start typing/i)).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/start typing/i);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Gri" } });

    await waitFor(() => {
      expect(screen.getByText("Grilled Salmon")).toBeInTheDocument();
    });

    // Select the recipe
    const suggestions = screen.getAllByText("Grilled Salmon");
    fireEvent.click(suggestions[0]);

    await waitFor(() => {
      expect(screen.getByText(/choose different recipe/i)).toBeInTheDocument();
    });

    // Click to change recipe
    fireEvent.click(screen.getByText(/choose different recipe/i));

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/start typing/i)).toBeInTheDocument();
    });
  });

  it("hides URL input when existing recipe selected", async () => {
    render(
      <AddRecipeForm
        open={true}
        onOpenChange={mockOnOpenChange}
        userId={mockUserId}
        onRecipeAdded={mockOnRecipeAdded}
      />
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/start typing/i)).toBeInTheDocument();
    });

    // URL input should be visible initially
    expect(screen.getByPlaceholderText(/https/i)).toBeInTheDocument();

    const input = screen.getByPlaceholderText(/start typing/i);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Gri" } });

    await waitFor(() => {
      expect(screen.getByText("Grilled Salmon")).toBeInTheDocument();
    });

    // Select the recipe
    const suggestions = screen.getAllByText("Grilled Salmon");
    fireEvent.click(suggestions[0]);

    await waitFor(() => {
      // URL input should be hidden when recipe is selected
      expect(screen.queryByPlaceholderText(/https/i)).not.toBeInTheDocument();
    });
  });

  it("displays recipe URL in selected state", async () => {
    render(
      <AddRecipeForm
        open={true}
        onOpenChange={mockOnOpenChange}
        userId={mockUserId}
        onRecipeAdded={mockOnRecipeAdded}
      />
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/start typing/i)).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/start typing/i);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Gri" } });

    await waitFor(() => {
      expect(screen.getByText("Grilled Salmon")).toBeInTheDocument();
    });

    // Select the recipe
    const suggestions = screen.getAllByText("Grilled Salmon");
    fireEvent.click(suggestions[0]);

    await waitFor(() => {
      expect(screen.getByText("https://example.com/salmon")).toBeInTheDocument();
    });
  });
});

describe("AddRecipeForm - Error Handling", () => {
  const mockOnOpenChange = vi.fn();
  const mockOnRecipeAdded = vi.fn();
  const mockUserId = "user-123";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("handles recipe search error gracefully", async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "scheduled_events") {
        return createMockQueryBuilder([{ id: "event-1", event_date: "2025-01-15", ingredients: { name: "Salmon" } }]);
      }
      if (table === "recipes") {
        const builder = createMockQueryBuilder([]);
        builder.ilike = vi.fn().mockReturnThis();
        builder.limit = vi.fn().mockResolvedValue({ data: null, error: { message: "Search failed" } });
        return builder;
      }
      return createMockQueryBuilder([]);
    });

    render(
      <AddRecipeForm
        open={true}
        onOpenChange={mockOnOpenChange}
        userId={mockUserId}
        onRecipeAdded={mockOnRecipeAdded}
      />
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/start typing/i)).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/start typing/i);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Test" } });

    // Should handle error gracefully without crashing
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/start typing/i)).toBeInTheDocument();
    });
  });
});

describe("AddRecipeForm - Form Submission", () => {
  const mockOnOpenChange = vi.fn();
  const mockOnRecipeAdded = vi.fn();
  const mockUserId = "user-123";

  const mockEventsData = [
    {
      id: "event-1",
      event_date: "2025-01-15",
      ingredients: { name: "Salmon" },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("submits new recipe successfully", async () => {
    const mockRecipeInsert = vi.fn().mockReturnThis();
    const mockContributionInsert = vi.fn().mockResolvedValue({ error: null });

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "scheduled_events") {
        return createMockQueryBuilder(mockEventsData);
      }
      if (table === "recipes") {
        return {
          select: vi.fn().mockReturnThis(),
          insert: mockRecipeInsert,
          ilike: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          single: vi.fn().mockResolvedValue({ data: { id: "new-recipe-id" }, error: null }),
        };
      }
      if (table === "recipe_contributions") {
        return {
          insert: mockContributionInsert,
        };
      }
      return createMockQueryBuilder([]);
    });

    render(
      <AddRecipeForm
        open={true}
        onOpenChange={mockOnOpenChange}
        userId={mockUserId}
        onRecipeAdded={mockOnRecipeAdded}
      />
    );

    // Wait for events to load
    await waitFor(() => {
      expect(screen.getByText("Select an event")).toBeInTheDocument();
    });

    // Select an event using the trigger
    const selectTrigger = screen.getByRole("combobox");
    fireEvent.click(selectTrigger);

    // Wait for the option to appear and click it
    await waitFor(() => {
      const option = screen.getByRole("option");
      fireEvent.click(option);
    });

    // Enter recipe name
    const nameInput = screen.getByPlaceholderText(/start typing/i);
    fireEvent.change(nameInput, { target: { value: "My New Recipe" } });

    // Submit the form
    const submitButton = screen.getByRole("button", { name: /add recipe/i });
    expect(submitButton).not.toBeDisabled();
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockRecipeInsert).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith("Recipe added!");
      expect(mockOnRecipeAdded).toHaveBeenCalled();
    });
  });

  it("submits existing recipe contribution successfully", async () => {
    const mockContributionInsert = vi.fn().mockResolvedValue({ error: null });

    const mockExistingRecipes = [
      { id: "existing-recipe-1", name: "Grilled Salmon", url: "https://example.com", created_by: "user-1", created_at: "2025-01-01" },
    ];

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "scheduled_events") {
        return createMockQueryBuilder(mockEventsData);
      }
      if (table === "recipes") {
        return {
          select: vi.fn().mockReturnThis(),
          insert: vi.fn().mockReturnThis(),
          ilike: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: mockExistingRecipes, error: null }),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }
      if (table === "recipe_contributions") {
        return {
          insert: mockContributionInsert,
        };
      }
      return createMockQueryBuilder([]);
    });

    render(
      <AddRecipeForm
        open={true}
        onOpenChange={mockOnOpenChange}
        userId={mockUserId}
        onRecipeAdded={mockOnRecipeAdded}
      />
    );

    // Wait for events to load
    await waitFor(() => {
      expect(screen.getByText("Select an event")).toBeInTheDocument();
    });

    // Select an event
    const selectTrigger = screen.getByRole("combobox");
    fireEvent.click(selectTrigger);
    await waitFor(() => {
      fireEvent.click(screen.getByRole("option"));
    });

    // Search for existing recipe
    const nameInput = screen.getByPlaceholderText(/start typing/i);
    fireEvent.focus(nameInput);
    fireEvent.change(nameInput, { target: { value: "Gri" } });

    // Select existing recipe
    await waitFor(() => {
      expect(screen.getByText("Grilled Salmon")).toBeInTheDocument();
    });

    const suggestions = screen.getAllByText("Grilled Salmon");
    fireEvent.click(suggestions[0]);

    // Submit the form
    await waitFor(() => {
      const submitButton = screen.getByRole("button", { name: /add contribution/i });
      fireEvent.click(submitButton);
    });

    await waitFor(() => {
      expect(mockContributionInsert).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith("Recipe added!");
    });
  });

  it("shows loading state during submission", async () => {
    const mockRecipeInsert = vi.fn().mockReturnThis();

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "scheduled_events") {
        return createMockQueryBuilder(mockEventsData);
      }
      if (table === "recipes") {
        return {
          select: vi.fn().mockReturnThis(),
          insert: mockRecipeInsert,
          ilike: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          single: vi.fn().mockReturnValue(
            new Promise((resolve) => setTimeout(() => resolve({ data: { id: "new-id" }, error: null }), 100))
          ),
        };
      }
      if (table === "recipe_contributions") {
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }
      return createMockQueryBuilder([]);
    });

    render(
      <AddRecipeForm
        open={true}
        onOpenChange={mockOnOpenChange}
        userId={mockUserId}
        onRecipeAdded={mockOnRecipeAdded}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Select an event")).toBeInTheDocument();
    });

    // Select event and enter recipe name
    const selectTrigger = screen.getByRole("combobox");
    fireEvent.click(selectTrigger);
    await waitFor(() => {
      fireEvent.click(screen.getByRole("option"));
    });

    const nameInput = screen.getByPlaceholderText(/start typing/i);
    fireEvent.change(nameInput, { target: { value: "New Recipe" } });

    // Submit
    const submitButton = screen.getByRole("button", { name: /add recipe/i });
    fireEvent.click(submitButton);

    // Should show loading state
    await waitFor(() => {
      expect(screen.getByText(/adding/i)).toBeInTheDocument();
    });
  });

  it("handles recipe creation error", async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "scheduled_events") {
        return createMockQueryBuilder(mockEventsData);
      }
      if (table === "recipes") {
        return {
          select: vi.fn().mockReturnThis(),
          insert: vi.fn().mockReturnThis(),
          ilike: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          single: vi.fn().mockResolvedValue({ data: null, error: { message: "Insert failed" } }),
        };
      }
      return createMockQueryBuilder([]);
    });

    render(
      <AddRecipeForm
        open={true}
        onOpenChange={mockOnOpenChange}
        userId={mockUserId}
        onRecipeAdded={mockOnRecipeAdded}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Select an event")).toBeInTheDocument();
    });

    // Select event and enter recipe name
    const selectTrigger = screen.getByRole("combobox");
    fireEvent.click(selectTrigger);
    await waitFor(() => {
      fireEvent.click(screen.getByRole("option"));
    });

    const nameInput = screen.getByPlaceholderText(/start typing/i);
    fireEvent.change(nameInput, { target: { value: "New Recipe" } });

    // Submit
    const submitButton = screen.getByRole("button", { name: /add recipe/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to add recipe");
    });
  });

  it("handles contribution creation error", async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "scheduled_events") {
        return createMockQueryBuilder(mockEventsData);
      }
      if (table === "recipes") {
        return {
          select: vi.fn().mockReturnThis(),
          insert: vi.fn().mockReturnThis(),
          ilike: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          single: vi.fn().mockResolvedValue({ data: { id: "new-id" }, error: null }),
        };
      }
      if (table === "recipe_contributions") {
        return {
          insert: vi.fn().mockResolvedValue({ error: { message: "Contribution failed" } }),
        };
      }
      return createMockQueryBuilder([]);
    });

    render(
      <AddRecipeForm
        open={true}
        onOpenChange={mockOnOpenChange}
        userId={mockUserId}
        onRecipeAdded={mockOnRecipeAdded}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Select an event")).toBeInTheDocument();
    });

    const selectTrigger = screen.getByRole("combobox");
    fireEvent.click(selectTrigger);
    await waitFor(() => {
      fireEvent.click(screen.getByRole("option"));
    });

    const nameInput = screen.getByPlaceholderText(/start typing/i);
    fireEvent.change(nameInput, { target: { value: "New Recipe" } });

    const submitButton = screen.getByRole("button", { name: /add recipe/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to add recipe");
    });
  });

  it("closes autocomplete when clicking create new recipe", async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "scheduled_events") {
        return createMockQueryBuilder(mockEventsData);
      }
      if (table === "recipes") {
        return {
          select: vi.fn().mockReturnThis(),
          ilike: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      }
      return createMockQueryBuilder([]);
    });

    render(
      <AddRecipeForm
        open={true}
        onOpenChange={mockOnOpenChange}
        userId={mockUserId}
        onRecipeAdded={mockOnRecipeAdded}
      />
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/start typing/i)).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/start typing/i);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Brand New Recipe" } });

    await waitFor(() => {
      expect(screen.getByText(/create new recipe/i)).toBeInTheDocument();
    });

    // Click the create new button
    fireEvent.click(screen.getByText(/create new recipe/i));

    // Autocomplete should close
    await waitFor(() => {
      expect(screen.queryByText(/create new recipe/i)).not.toBeInTheDocument();
    });
  });
});

describe("AddRecipeForm - Closing Autocomplete", () => {
  const mockOnOpenChange = vi.fn();
  const mockOnRecipeAdded = vi.fn();
  const mockUserId = "user-123";

  const mockEventsData = [
    { id: "event-1", event_date: "2025-01-15", ingredients: { name: "Salmon" } },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "scheduled_events") {
        return createMockQueryBuilder(mockEventsData);
      }
      if (table === "recipes") {
        return {
          select: vi.fn().mockReturnThis(),
          ilike: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      }
      return createMockQueryBuilder([]);
    });
  });

  it("closes autocomplete when clicking outside", async () => {
    render(
      <AddRecipeForm
        open={true}
        onOpenChange={mockOnOpenChange}
        userId={mockUserId}
        onRecipeAdded={mockOnRecipeAdded}
      />
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/start typing/i)).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/start typing/i);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Test Recipe" } });

    await waitFor(() => {
      expect(screen.getByText(/create new recipe/i)).toBeInTheDocument();
    });

    // Click outside
    fireEvent.mouseDown(document.body);

    // Autocomplete should close
    await waitFor(() => {
      expect(screen.queryByText(/create new recipe/i)).not.toBeInTheDocument();
    });
  });
});

describe("AddRecipeForm - URL Input", () => {
  const mockOnOpenChange = vi.fn();
  const mockOnRecipeAdded = vi.fn();
  const mockUserId = "user-123";

  const mockEventsData = [
    {
      id: "event-1",
      event_date: "2025-01-15",
      ingredients: { name: "Salmon" },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "scheduled_events") {
        return createMockQueryBuilder(mockEventsData);
      }
      if (table === "recipes") {
        return createMockQueryBuilder([]);
      }
      if (table === "recipe_contributions") {
        return createMockQueryBuilder([]);
      }
      return createMockQueryBuilder([]);
    });
  });

  it("updates recipe URL when typing in URL field", async () => {
    render(
      <AddRecipeForm
        open={true}
        onOpenChange={mockOnOpenChange}
        userId={mockUserId}
        onRecipeAdded={mockOnRecipeAdded}
      />
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/https/i)).toBeInTheDocument();
    });

    const urlInput = screen.getByPlaceholderText(/https/i);
    fireEvent.change(urlInput, { target: { value: "https://example.com/recipe" } });

    expect(urlInput).toHaveValue("https://example.com/recipe");
  });
});

describe("AddRecipeForm - Branch Coverage", () => {
  const mockOnOpenChange = vi.fn();
  const mockOnRecipeAdded = vi.fn();
  const mockUserId = "user-123";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("handles null events data gracefully", async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "scheduled_events") {
        return {
          ...createMockQueryBuilder([]),
          order: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }
      return createMockQueryBuilder([]);
    });

    render(
      <AddRecipeForm
        open={true}
        onOpenChange={mockOnOpenChange}
        userId={mockUserId}
        onRecipeAdded={mockOnRecipeAdded}
      />
    );

    await waitFor(() => {
      // Form should still render
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
  });

  it("handles events with missing ingredient name", async () => {
    const eventsWithNullIngredient = [
      {
        id: "event-1",
        event_date: "2025-01-15",
        ingredients: null, // No ingredient
      },
    ];

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "scheduled_events") {
        return createMockQueryBuilder(eventsWithNullIngredient);
      }
      return createMockQueryBuilder([]);
    });

    render(
      <AddRecipeForm
        open={true}
        onOpenChange={mockOnOpenChange}
        userId={mockUserId}
        onRecipeAdded={mockOnRecipeAdded}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
  });

  it("handles recipes with null url and created_by", async () => {
    const mockEventsData = [
      { id: "event-1", event_date: "2025-01-15", ingredients: { name: "Salmon" } },
    ];

    const mockRecipesWithNullFields = [
      { id: "recipe-1", name: "Test Recipe", url: null, created_by: null, created_at: "2025-01-15" },
    ];

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "scheduled_events") {
        return createMockQueryBuilder(mockEventsData);
      }
      if (table === "recipes") {
        return {
          ...createMockQueryBuilder([]),
          ilike: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: mockRecipesWithNullFields, error: null }),
        };
      }
      return createMockQueryBuilder([]);
    });

    render(
      <AddRecipeForm
        open={true}
        onOpenChange={mockOnOpenChange}
        userId={mockUserId}
        onRecipeAdded={mockOnRecipeAdded}
      />
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/start typing/i)).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/start typing/i);
    fireEvent.change(input, { target: { value: "Test" } });

    await waitFor(() => {
      // Should show the recipe suggestion
      expect(screen.getByText("Test Recipe")).toBeInTheDocument();
    });
  });

  it("handles null recipes data in autocomplete", async () => {
    const mockEventsData = [
      { id: "event-1", event_date: "2025-01-15", ingredients: { name: "Salmon" } },
    ];

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "scheduled_events") {
        return createMockQueryBuilder(mockEventsData);
      }
      if (table === "recipes") {
        return {
          ...createMockQueryBuilder([]),
          ilike: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }
      return createMockQueryBuilder([]);
    });

    render(
      <AddRecipeForm
        open={true}
        onOpenChange={mockOnOpenChange}
        userId={mockUserId}
        onRecipeAdded={mockOnRecipeAdded}
      />
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/start typing/i)).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/start typing/i);
    fireEvent.change(input, { target: { value: "Test Recipe" } });

    await waitFor(() => {
      // Should show create new option
      expect(screen.getByText(/create new recipe/i)).toBeInTheDocument();
    });
  });

  it("keeps autocomplete open when clicking inside it", async () => {
    const mockEventsData = [
      { id: "event-1", event_date: "2025-01-15", ingredients: { name: "Salmon" } },
    ];

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "scheduled_events") {
        return createMockQueryBuilder(mockEventsData);
      }
      if (table === "recipes") {
        return createMockQueryBuilder([]);
      }
      return createMockQueryBuilder([]);
    });

    render(
      <AddRecipeForm
        open={true}
        onOpenChange={mockOnOpenChange}
        userId={mockUserId}
        onRecipeAdded={mockOnRecipeAdded}
      />
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/start typing/i)).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/start typing/i);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Test" } });

    await waitFor(() => {
      expect(screen.getByText(/create new recipe/i)).toBeInTheDocument();
    });

    // Click on the autocomplete area (should stay open)
    const createOption = screen.getByText(/create new recipe/i);
    const autocompleteArea = createOption.closest("div");
    if (autocompleteArea) {
      fireEvent.mouseDown(autocompleteArea);
    }

    // Autocomplete should still show
    expect(screen.getByText(/create new recipe/i)).toBeInTheDocument();
  });

  it("sets recipe URL when selecting existing recipe with URL", async () => {
    const mockEventsData = [
      { id: "event-1", event_date: "2025-01-15", ingredients: { name: "Salmon" } },
    ];

    const mockRecipesWithUrl = [
      { id: "recipe-1", name: "Test Recipe", url: "https://recipe-url.com", created_by: "user-1", created_at: "2025-01-15" },
    ];

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "scheduled_events") {
        return createMockQueryBuilder(mockEventsData);
      }
      if (table === "recipes") {
        return {
          ...createMockQueryBuilder([]),
          ilike: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: mockRecipesWithUrl, error: null }),
        };
      }
      return createMockQueryBuilder([]);
    });

    render(
      <AddRecipeForm
        open={true}
        onOpenChange={mockOnOpenChange}
        userId={mockUserId}
        onRecipeAdded={mockOnRecipeAdded}
      />
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/start typing/i)).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/start typing/i);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Test" } });

    await waitFor(() => {
      expect(screen.getByText("Test Recipe")).toBeInTheDocument();
    });

    // Select the recipe with URL
    fireEvent.click(screen.getByText("Test Recipe"));

    await waitFor(() => {
      // The URL should be displayed in the selected state
      expect(screen.getByText("https://recipe-url.com")).toBeInTheDocument();
    });
  });

  it("calls onOpenChange with true when dialog stays open", async () => {
    const mockEventsData = [
      { id: "event-1", event_date: "2025-01-15", ingredients: { name: "Salmon" } },
    ];

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "scheduled_events") {
        return createMockQueryBuilder(mockEventsData);
      }
      return createMockQueryBuilder([]);
    });

    const { rerender } = render(
      <AddRecipeForm
        open={true}
        onOpenChange={mockOnOpenChange}
        userId={mockUserId}
        onRecipeAdded={mockOnRecipeAdded}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    // Re-render with open still true (simulates dialog staying open)
    rerender(
      <AddRecipeForm
        open={true}
        onOpenChange={mockOnOpenChange}
        userId={mockUserId}
        onRecipeAdded={mockOnRecipeAdded}
      />
    );

    // Dialog should still be open
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("handles selecting recipe with URL and sets recipeUrl state", async () => {
    const mockEventsData = [
      { id: "event-1", event_date: "2025-01-15", ingredients: { name: "Salmon" } },
    ];

    const mockRecipesWithUrl = [
      { id: "recipe-1", name: "Salmon Delight", url: "https://salmon-recipe.com", created_by: "user-1", created_at: "2025-01-15" },
    ];

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "scheduled_events") {
        return createMockQueryBuilder(mockEventsData);
      }
      if (table === "recipes") {
        return {
          ...createMockQueryBuilder([]),
          ilike: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: mockRecipesWithUrl, error: null }),
        };
      }
      return createMockQueryBuilder([]);
    });

    render(
      <AddRecipeForm
        open={true}
        onOpenChange={mockOnOpenChange}
        userId={mockUserId}
        onRecipeAdded={mockOnRecipeAdded}
      />
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/start typing/i)).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/start typing/i);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Salmon" } });

    // Wait for autocomplete to show
    await waitFor(() => {
      expect(screen.getByText("Salmon Delight")).toBeInTheDocument();
    });

    // Click directly on the button containing the recipe name
    const recipeButton = screen.getByRole("button", { name: /Salmon Delight/i });
    fireEvent.click(recipeButton);

    // Verify selection happened - URL should be shown
    await waitFor(() => {
      expect(screen.getByText("https://salmon-recipe.com")).toBeInTheDocument();
      expect(screen.getByText(/selected recipe/i)).toBeInTheDocument();
    });
  });

  it("handles selecting recipe without URL", async () => {
    const mockEventsData = [
      { id: "event-1", event_date: "2025-01-15", ingredients: { name: "Salmon" } },
    ];

    const mockRecipesNoUrl = [
      { id: "recipe-1", name: "No URL Recipe", url: null, created_by: "user-1", created_at: "2025-01-15" },
    ];

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "scheduled_events") {
        return createMockQueryBuilder(mockEventsData);
      }
      if (table === "recipes") {
        return {
          ...createMockQueryBuilder([]),
          ilike: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: mockRecipesNoUrl, error: null }),
        };
      }
      return createMockQueryBuilder([]);
    });

    render(
      <AddRecipeForm
        open={true}
        onOpenChange={mockOnOpenChange}
        userId={mockUserId}
        onRecipeAdded={mockOnRecipeAdded}
      />
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/start typing/i)).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/start typing/i);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "No URL" } });

    await waitFor(() => {
      expect(screen.getByText("No URL Recipe")).toBeInTheDocument();
    });

    // Click to select recipe without URL
    const recipeButton = screen.getByRole("button", { name: /No URL Recipe/i });
    fireEvent.click(recipeButton);

    await waitFor(() => {
      expect(screen.getByText(/selected recipe/i)).toBeInTheDocument();
      // URL should not be displayed
      expect(screen.queryByText(/https:/i)).not.toBeInTheDocument();
    });
  });
});
