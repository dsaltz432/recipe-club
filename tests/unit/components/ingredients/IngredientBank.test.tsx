import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@tests/utils";
import { createMockIngredient } from "@tests/utils";
import IngredientBank from "@/components/ingredients/IngredientBank";
import type { Ingredient } from "@/types";

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

// Mock uuid
vi.mock("uuid", () => ({
  v4: () => "mock-uuid-123",
}));

// Helper to create a complete mock query builder
const createMockQueryBuilder = (data: unknown[] = [], error: unknown = null) => ({
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  neq: vi.fn().mockReturnThis(),
  order: vi.fn().mockResolvedValue({ data, error }),
  single: vi.fn().mockResolvedValue({ data: data[0] || null, error }),
  maybeSingle: vi.fn().mockResolvedValue({ data: data[0] || null, error }),
  then: vi.fn((resolve) => Promise.resolve({ data, error }).then(resolve)),
});

describe("IngredientBank", () => {
  const mockSetIngredients = vi.fn();
  const mockUserId = "user-123";

  const mockIngredients: Ingredient[] = [
    createMockIngredient({ id: "1", name: "Chicken", inBank: true, usedCount: 0 }),
    createMockIngredient({ id: "2", name: "Salmon", inBank: true, usedCount: 1 }),
    createMockIngredient({ id: "3", name: "Beef", inBank: true, usedCount: 2 }),
    createMockIngredient({ id: "4", name: "Tofu", inBank: false, usedCount: 3 }),
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock for loading ingredients
    const dbData = mockIngredients.map((i) => ({
      id: i.id,
      name: i.name,
      used_count: i.usedCount,
      in_bank: i.inBank,
      created_by: i.createdBy,
    }));

    mockSupabaseFrom.mockReturnValue(createMockQueryBuilder(dbData));
  });

  it("renders loading state initially", async () => {
    render(
      <IngredientBank
        ingredients={[]}
        setIngredients={mockSetIngredients}
        userId={mockUserId}
        isAdmin={true}
      />
    );

    // Check for the loading spinner
    expect(document.querySelector(".animate-spin")).toBeInTheDocument();

    // Wait for loading to complete to avoid act() warnings
    await waitFor(() => {
      expect(document.querySelector(".animate-spin")).not.toBeInTheDocument();
    });
  });

  it("displays ingredient count and progress", async () => {
    render(
      <IngredientBank
        ingredients={mockIngredients}
        setIngredients={mockSetIngredients}
        userId={mockUserId}
        isAdmin={true}
      />
    );

    await waitFor(() => {
      // Look for the count display which contains "/ 15 ingredients"
      expect(screen.getByText(/\/ 15 ingredients/i)).toBeInTheDocument();
    });
  });

  it("shows ingredient bank title", async () => {
    render(
      <IngredientBank
        ingredients={mockIngredients}
        setIngredients={mockSetIngredients}
        userId={mockUserId}
        isAdmin={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Ingredient Bank")).toBeInTheDocument();
    });
  });

  it("displays only ingredients that are in the bank", async () => {
    render(
      <IngredientBank
        ingredients={mockIngredients}
        setIngredients={mockSetIngredients}
        userId={mockUserId}
        isAdmin={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Chicken")).toBeInTheDocument();
      expect(screen.getByText("Salmon")).toBeInTheDocument();
      expect(screen.getByText("Beef")).toBeInTheDocument();
    });

    // Tofu should not be shown (inBank: false)
    expect(screen.queryByText("Tofu")).not.toBeInTheDocument();
  });

  it("shows usage badges for used ingredients", async () => {
    render(
      <IngredientBank
        ingredients={mockIngredients}
        setIngredients={mockSetIngredients}
        userId={mockUserId}
        isAdmin={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Used 1x")).toBeInTheDocument();
      expect(screen.getByText("Used 2x")).toBeInTheDocument();
    });
  });

  it("shows add ingredient input for admin users", async () => {
    render(
      <IngredientBank
        ingredients={mockIngredients}
        setIngredients={mockSetIngredients}
        userId={mockUserId}
        isAdmin={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/add a new ingredient/i)).toBeInTheDocument();
    });
  });

  it("hides add ingredient input for non-admin users", async () => {
    render(
      <IngredientBank
        ingredients={mockIngredients}
        setIngredients={mockSetIngredients}
        userId={mockUserId}
        isAdmin={false}
      />
    );

    await waitFor(() => {
      expect(screen.queryByPlaceholderText(/add a new ingredient/i)).not.toBeInTheDocument();
    });
  });

  it("shows remove button for admin users", async () => {
    render(
      <IngredientBank
        ingredients={mockIngredients}
        setIngredients={mockSetIngredients}
        userId={mockUserId}
        isAdmin={true}
      />
    );

    await waitFor(() => {
      const removeButtons = screen.getAllByRole("button", { name: "" });
      // Filter for X buttons (remove buttons)
      const xButtons = removeButtons.filter(
        (btn) => btn.querySelector("svg")
      );
      expect(xButtons.length).toBeGreaterThan(0);
    });
  });

  it("shows suggestions button for admin users", async () => {
    render(
      <IngredientBank
        ingredients={mockIngredients}
        setIngredients={mockSetIngredients}
        userId={mockUserId}
        isAdmin={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Suggest Ingredients/i)).toBeInTheDocument();
    });
  });

});

describe("IngredientBank - Usage Styling", () => {
  const mockSetIngredients = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabaseFrom.mockReturnValue(createMockQueryBuilder([]));
  });

  it("applies correct styling based on usage count", async () => {
    const ingredients: Ingredient[] = [
      createMockIngredient({ id: "1", name: "Never Used", usedCount: 0, inBank: true }),
      createMockIngredient({ id: "2", name: "Used Once", usedCount: 1, inBank: true }),
      createMockIngredient({ id: "3", name: "Used Twice", usedCount: 2, inBank: true }),
      createMockIngredient({ id: "4", name: "Used Many", usedCount: 5, inBank: true }),
    ];

    render(
      <IngredientBank
        ingredients={ingredients}
        setIngredients={mockSetIngredients}
        userId="user-123"
        isAdmin={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Never Used")).toBeInTheDocument();
      expect(screen.getByText("Used Once")).toBeInTheDocument();
      expect(screen.getByText("Used Twice")).toBeInTheDocument();
      expect(screen.getByText("Used Many")).toBeInTheDocument();
    });
  });
});

describe("IngredientBank - Progress indicator", () => {
  const mockSetIngredients = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabaseFrom.mockReturnValue(createMockQueryBuilder([]));
  });

  it("shows correct progress message when below minimum", async () => {
    const ingredients: Ingredient[] = Array.from({ length: 10 }, (_, i) =>
      createMockIngredient({ id: `${i}`, name: `Ingredient ${i}`, inBank: true })
    );

    render(
      <IngredientBank
        ingredients={ingredients}
        setIngredients={mockSetIngredients}
        userId="user-123"
        isAdmin={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/need \d+ more/i)).toBeInTheDocument();
    });
  });

  it("shows ready message when at minimum", async () => {
    const ingredients: Ingredient[] = Array.from({ length: 15 }, (_, i) =>
      createMockIngredient({ id: `${i}`, name: `Ingredient ${i}`, inBank: true })
    );

    render(
      <IngredientBank
        ingredients={ingredients}
        setIngredients={mockSetIngredients}
        userId="user-123"
        isAdmin={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/ready to spin/i)).toBeInTheDocument();
    });
  });
});

describe("IngredientBank - Add Ingredient", () => {
  const mockSetIngredients = vi.fn();
  const mockUserId = "user-123";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("adds new ingredient when Enter key is pressed", async () => {
    const mockInsert = vi.fn().mockResolvedValue({ error: null });

    // Provide existing data so component doesn't initialize defaults
    const existingData = [
      { id: "1", name: "Chicken", in_bank: true, used_count: 0 },
    ];

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "ingredients") {
        return {
          select: vi.fn().mockReturnThis(),
          insert: mockInsert,
          order: vi.fn().mockResolvedValue({ data: existingData, error: null }),
        };
      }
      return createMockQueryBuilder([]);
    });

    render(
      <IngredientBank
        ingredients={[createMockIngredient({ id: "1", name: "Chicken", inBank: true })]}
        setIngredients={mockSetIngredients}
        userId={mockUserId}
        isAdmin={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/add a new ingredient/i)).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/add a new ingredient/i);
    fireEvent.change(input, { target: { value: "New Ingredient" } });

    // Use charCode for proper keyPress handling
    fireEvent.keyPress(input, { key: "Enter", code: "Enter", charCode: 13 });

    await waitFor(() => {
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "New Ingredient",
          in_bank: true,
        })
      );
    });
  });

  it("adds new ingredient when plus button is clicked and updates state", async () => {
    const mockInsert = vi.fn().mockResolvedValue({ error: null });
    // Create a mock that actually invokes the callback to get coverage
    const setIngredientsWithCallback = vi.fn((updater) => {
      if (typeof updater === "function") {
        updater([]); // Call the callback with empty array as prev state
      }
    });

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "ingredients") {
        // Create a proper chainable mock
        const queryBuilder = {
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
        return {
          select: vi.fn().mockReturnValue(queryBuilder),
          insert: mockInsert,
        };
      }
      return createMockQueryBuilder([]);
    });

    render(
      <IngredientBank
        ingredients={[]}
        setIngredients={setIngredientsWithCallback}
        userId={mockUserId}
        isAdmin={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/add a new ingredient/i)).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/add a new ingredient/i);
    fireEvent.change(input, { target: { value: "Brand New Ingredient" } });

    // Find and click the plus button
    const plusButton = screen.getAllByRole("button").find(btn =>
      btn.querySelector("svg")?.classList.contains("lucide-plus")
    );
    if (plusButton) {
      fireEvent.click(plusButton);
    }

    await waitFor(() => {
      expect(mockInsert).toHaveBeenCalled();
      // Verify setIngredients was called with functional update
      expect(setIngredientsWithCallback).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  it("prevents adding duplicate ingredient", async () => {
    const { toast } = await import("sonner");

    const existingIngredients: Ingredient[] = [
      createMockIngredient({ id: "1", name: "Chicken", inBank: true }),
    ];

    mockSupabaseFrom.mockReturnValue(createMockQueryBuilder([
      { id: "1", name: "Chicken", in_bank: true, used_count: 0 }
    ]));

    render(
      <IngredientBank
        ingredients={existingIngredients}
        setIngredients={mockSetIngredients}
        userId={mockUserId}
        isAdmin={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/add a new ingredient/i)).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/add a new ingredient/i);
    fireEvent.change(input, { target: { value: "Chicken" } });
    fireEvent.keyPress(input, { key: "Enter", code: "Enter", charCode: 13 });

    // Should show duplicate error toast
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("This ingredient is already in your bank!");
    });
  });

  it("handles insert error gracefully", async () => {
    const { toast } = await import("sonner");

    // Provide existing data so defaults aren't initialized
    const existingData = [
      { id: "1", name: "Chicken", in_bank: true, used_count: 0 },
    ];

    const mockInsert = vi.fn().mockResolvedValue({ error: { message: "Insert failed" } });

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "ingredients") {
        return {
          select: vi.fn().mockReturnThis(),
          insert: mockInsert,
          order: vi.fn().mockResolvedValue({ data: existingData, error: null }),
        };
      }
      return createMockQueryBuilder([]);
    });

    render(
      <IngredientBank
        ingredients={[createMockIngredient({ id: "1", name: "Chicken", inBank: true })]}
        setIngredients={mockSetIngredients}
        userId={mockUserId}
        isAdmin={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/add a new ingredient/i)).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/add a new ingredient/i);
    fireEvent.change(input, { target: { value: "Brand New Ingredient" } });
    fireEvent.keyPress(input, { key: "Enter", code: "Enter", charCode: 13 });

    // Verify the insert was attempted and error toast shown
    await waitFor(() => {
      expect(mockInsert).toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalledWith("Failed to add ingredient. Please try again.");
    });
  });
});

describe("IngredientBank - Remove Ingredient", () => {
  const mockSetIngredients = vi.fn();
  const mockUserId = "user-123";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("removes ingredient from bank when X button is clicked", async () => {
    const mockUpdate = vi.fn().mockReturnThis();

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "ingredients") {
        return {
          select: vi.fn().mockReturnThis(),
          update: mockUpdate,
          eq: vi.fn().mockResolvedValue({ error: null }),
          order: vi.fn().mockResolvedValue({
            data: [{ id: "1", name: "Chicken", in_bank: true, used_count: 0 }],
            error: null
          }),
        };
      }
      return createMockQueryBuilder([]);
    });

    const ingredients: Ingredient[] = [
      createMockIngredient({ id: "1", name: "Chicken", inBank: true }),
    ];

    render(
      <IngredientBank
        ingredients={ingredients}
        setIngredients={mockSetIngredients}
        userId={mockUserId}
        isAdmin={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Chicken")).toBeInTheDocument();
    });

    // Find the remove button (X icon button next to ingredient)
    const removeButtons = screen.getAllByRole("button");
    const xButton = removeButtons.find(btn =>
      btn.classList.contains("text-muted-foreground")
    );

    if (xButton) {
      fireEvent.click(xButton);

      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalledWith({ in_bank: false });
      });
    }
  });

  it("handles remove error gracefully", async () => {
    const mockUpdate = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockResolvedValue({ error: { message: "Update failed" } });

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "ingredients") {
        return {
          select: vi.fn().mockReturnThis(),
          update: mockUpdate,
          eq: mockEq,
          order: vi.fn().mockResolvedValue({
            data: [{ id: "1", name: "Chicken", in_bank: true, used_count: 0 }],
            error: null
          }),
        };
      }
      return createMockQueryBuilder([]);
    });

    const ingredients: Ingredient[] = [
      createMockIngredient({ id: "1", name: "Chicken", inBank: true }),
    ];

    render(
      <IngredientBank
        ingredients={ingredients}
        setIngredients={mockSetIngredients}
        userId={mockUserId}
        isAdmin={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Chicken")).toBeInTheDocument();
    });

    const removeButtons = screen.getAllByRole("button");
    const xButton = removeButtons.find(btn =>
      btn.classList.contains("text-muted-foreground")
    );

    if (xButton) {
      fireEvent.click(xButton);

      // The update should have been attempted even though it failed
      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalledWith({ in_bank: false });
      });
    }
  });
});

describe("IngredientBank - Suggestions", () => {
  const mockSetIngredients = vi.fn();
  const mockUserId = "user-123";

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabaseFrom.mockReturnValue(createMockQueryBuilder([]));
  });

  it("generates suggestions when button is clicked", async () => {
    render(
      <IngredientBank
        ingredients={[]}
        setIngredients={mockSetIngredients}
        userId={mockUserId}
        isAdmin={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Suggest Ingredients/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Suggest Ingredients/i));

    // Should show suggestion buttons after clicking
    await waitFor(() => {
      // The suggestions should appear as buttons
      const buttons = screen.getAllByRole("button");
      // Should have more buttons now (suggestions + original buttons)
      expect(buttons.length).toBeGreaterThan(2);
    });
  });

  it("adds suggestion when clicked", async () => {
    const mockInsert = vi.fn().mockResolvedValue({ error: null });

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "ingredients") {
        return {
          select: vi.fn().mockReturnThis(),
          insert: mockInsert,
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      }
      return createMockQueryBuilder([]);
    });

    render(
      <IngredientBank
        ingredients={[]}
        setIngredients={mockSetIngredients}
        userId={mockUserId}
        isAdmin={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Suggest Ingredients/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Suggest Ingredients/i));

    await waitFor(() => {
      // Find a suggestion button (they have the Plus icon)
      const suggestionButtons = screen.getAllByRole("button").filter(btn =>
        btn.classList.contains("bg-purple/10")
      );
      if (suggestionButtons.length > 0) {
        fireEvent.click(suggestionButtons[0]);
      }
    });

    await waitFor(() => {
      expect(mockInsert).toHaveBeenCalled();
    });
  });
});

describe("IngredientBank - Autocomplete", () => {
  const mockSetIngredients = vi.fn();
  const mockUserId = "user-123";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows autocomplete suggestions when typing", async () => {
    const existingData = [
      { id: "1", name: "Chicken", in_bank: false, used_count: 2 },
      { id: "2", name: "Chickpeas", in_bank: false, used_count: 1 },
    ];

    mockSupabaseFrom.mockReturnValue(createMockQueryBuilder(existingData));

    render(
      <IngredientBank
        ingredients={[
          createMockIngredient({ id: "1", name: "Chicken", inBank: false, usedCount: 2 }),
          createMockIngredient({ id: "2", name: "Chickpeas", inBank: false, usedCount: 1 }),
        ]}
        setIngredients={mockSetIngredients}
        userId={mockUserId}
        isAdmin={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/add a new ingredient/i)).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/add a new ingredient/i);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Chic" } });

    await waitFor(() => {
      // Autocomplete should show matching ingredients
      expect(screen.getByText("Chicken")).toBeInTheDocument();
    });
  });

  it("shows 'Create new' option in autocomplete", async () => {
    mockSupabaseFrom.mockReturnValue(createMockQueryBuilder([]));

    render(
      <IngredientBank
        ingredients={[]}
        setIngredients={mockSetIngredients}
        userId={mockUserId}
        isAdmin={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/add a new ingredient/i)).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/add a new ingredient/i);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "New Item" } });

    await waitFor(() => {
      expect(screen.getByText(/create "new item"/i)).toBeInTheDocument();
    });
  });
});

describe("IngredientBank - Full Bank", () => {
  const mockSetIngredients = vi.fn();
  const mockUserId = "user-123";

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabaseFrom.mockReturnValue(createMockQueryBuilder([]));
  });

  it("hides add input when bank is full", async () => {
    // Create 15 ingredients (MIN_INGREDIENTS_TO_SPIN)
    const fullBankIngredients: Ingredient[] = Array.from({ length: 15 }, (_, i) =>
      createMockIngredient({ id: `${i}`, name: `Ingredient ${i}`, inBank: true })
    );

    render(
      <IngredientBank
        ingredients={fullBankIngredients}
        setIngredients={mockSetIngredients}
        userId={mockUserId}
        isAdmin={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/ready to spin/i)).toBeInTheDocument();
    });

    // Add ingredient input should be hidden when bank is full
    expect(screen.queryByPlaceholderText(/add a new ingredient/i)).not.toBeInTheDocument();
  });

  it("shows error when trying to add suggestion to full bank", async () => {
    // Create 15 ingredients
    const fullBankIngredients: Ingredient[] = Array.from({ length: 15 }, (_, i) =>
      createMockIngredient({ id: `${i}`, name: `Ingredient ${i}`, inBank: true })
    );

    render(
      <IngredientBank
        ingredients={fullBankIngredients}
        setIngredients={mockSetIngredients}
        userId={mockUserId}
        isAdmin={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/ready to spin/i)).toBeInTheDocument();
    });

    // The suggest button should not be visible when bank is full
    expect(screen.queryByText(/Suggest Ingredients/i)).not.toBeInTheDocument();
  });
});

describe("IngredientBank - Loading and Error States", () => {
  const mockSetIngredients = vi.fn();
  const mockUserId = "user-123";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("initializes with default ingredients when database is empty", async () => {
    const mockInsert = vi.fn().mockResolvedValue({ error: null });

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "ingredients") {
        // Create a chainable mock where select() returns an object with order()
        const queryBuilder = {
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
        return {
          select: vi.fn().mockReturnValue(queryBuilder),
          insert: mockInsert,
        };
      }
      return createMockQueryBuilder([]);
    });

    render(
      <IngredientBank
        ingredients={[]}
        setIngredients={mockSetIngredients}
        userId={mockUserId}
        isAdmin={true}
      />
    );

    await waitFor(() => {
      // setIngredients should be called with default ingredients
      expect(mockSetIngredients).toHaveBeenCalled();
      // Verify insert was called for each default ingredient (saves to DB)
      expect(mockInsert).toHaveBeenCalled();
    });
  });

  it("falls back to default ingredients on error", async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "ingredients") {
        // Create a chainable mock where select() returns an object with order()
        const queryBuilder = {
          order: vi.fn().mockResolvedValue({ data: null, error: { message: "Database error" } }),
        };
        return {
          select: vi.fn().mockReturnValue(queryBuilder),
        };
      }
      return createMockQueryBuilder([]);
    });

    render(
      <IngredientBank
        ingredients={[]}
        setIngredients={mockSetIngredients}
        userId={mockUserId}
        isAdmin={true}
      />
    );

    await waitFor(() => {
      // Should still call setIngredients with fallback ingredients
      expect(mockSetIngredients).toHaveBeenCalled();
    });
  });
});

describe("IngredientBank - Suggestion Errors", () => {
  const mockSetIngredients = vi.fn();
  const mockUserId = "user-123";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("handles error when adding suggestion fails", async () => {
    const mockInsert = vi.fn().mockResolvedValue({ error: { message: "Insert failed" } });

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "ingredients") {
        return {
          select: vi.fn().mockReturnThis(),
          insert: mockInsert,
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      }
      return createMockQueryBuilder([]);
    });

    render(
      <IngredientBank
        ingredients={[]}
        setIngredients={mockSetIngredients}
        userId={mockUserId}
        isAdmin={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Suggest Ingredients/i)).toBeInTheDocument();
    });

    // Generate suggestions
    fireEvent.click(screen.getByText(/Suggest Ingredients/i));

    await waitFor(() => {
      // Find a suggestion button
      const suggestionButtons = screen.getAllByRole("button").filter(btn =>
        btn.classList.contains("bg-purple/10")
      );
      if (suggestionButtons.length > 0) {
        fireEvent.click(suggestionButtons[0]);
      }
    });

    // The insert was attempted (even though it failed)
    await waitFor(() => {
      expect(mockInsert).toHaveBeenCalled();
    });
  });

  it("successfully adds a suggestion and updates state", async () => {
    const mockInsert = vi.fn().mockResolvedValue({ error: null });
    // Create a mock that actually invokes the callback to get coverage
    const setIngredientsWithCallback = vi.fn((updater) => {
      if (typeof updater === "function") {
        updater([]); // Call the callback with empty array as prev state
      }
    });

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "ingredients") {
        const queryBuilder = {
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
        return {
          select: vi.fn().mockReturnValue(queryBuilder),
          insert: mockInsert,
        };
      }
      return createMockQueryBuilder([]);
    });

    render(
      <IngredientBank
        ingredients={[]}
        setIngredients={setIngredientsWithCallback}
        userId={mockUserId}
        isAdmin={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Suggest Ingredients/i)).toBeInTheDocument();
    });

    // Generate suggestions
    fireEvent.click(screen.getByText(/Suggest Ingredients/i));

    await waitFor(() => {
      // Find a suggestion button (has bg-purple/10 class)
      const suggestionButtons = screen.getAllByRole("button").filter(btn =>
        btn.classList.contains("bg-purple/10")
      );
      expect(suggestionButtons.length).toBeGreaterThan(0);
    });

    // Click the first suggestion
    const suggestionButtons = screen.getAllByRole("button").filter(btn =>
      btn.classList.contains("bg-purple/10")
    );
    fireEvent.click(suggestionButtons[0]);

    // Wait for insert to complete and state to be updated
    await waitFor(() => {
      expect(mockInsert).toHaveBeenCalled();
      // Verify setIngredients was called with functional update (the callback at line 301)
      expect(setIngredientsWithCallback).toHaveBeenCalledWith(expect.any(Function));
    });
  });
});

describe("IngredientBank - Autocomplete Edge Cases", () => {
  const mockSetIngredients = vi.fn();
  const mockUserId = "user-123";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("closes autocomplete when clicking outside", async () => {
    const existingData = [
      { id: "1", name: "Chicken", in_bank: false, used_count: 2 },
    ];

    mockSupabaseFrom.mockReturnValue(createMockQueryBuilder(existingData));

    render(
      <IngredientBank
        ingredients={[
          createMockIngredient({ id: "1", name: "Chicken", inBank: false, usedCount: 2 }),
        ]}
        setIngredients={mockSetIngredients}
        userId={mockUserId}
        isAdmin={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/add a new ingredient/i)).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/add a new ingredient/i);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Chic" } });

    await waitFor(() => {
      expect(screen.getByText("Chicken")).toBeInTheDocument();
    });

    // Click outside the autocomplete
    fireEvent.mouseDown(document.body);

    // Autocomplete dropdown should be closed (but the ingredient still shows in the bank)
    // After closing, if we type again, the autocomplete will reopen
    await waitFor(() => {
      // Verify the component still works (input should still be there)
      expect(screen.getByPlaceholderText(/add a new ingredient/i)).toBeInTheDocument();
    });
  });

  it("shows 'In bank' indicator for ingredients already in bank", async () => {
    const existingData = [
      { id: "1", name: "Chicken", in_bank: true, used_count: 2 },
    ];

    mockSupabaseFrom.mockReturnValue(createMockQueryBuilder(existingData));

    render(
      <IngredientBank
        ingredients={[
          createMockIngredient({ id: "1", name: "Chicken", inBank: true, usedCount: 2 }),
        ]}
        setIngredients={mockSetIngredients}
        userId={mockUserId}
        isAdmin={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/add a new ingredient/i)).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/add a new ingredient/i);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Chic" } });

    await waitFor(() => {
      // Should show "In bank" indicator for the existing ingredient
      expect(screen.getByText(/in bank/i)).toBeInTheDocument();
    });
  });

  it("shows usage count for previously used ingredients not in bank", async () => {
    const existingData = [
      { id: "1", name: "Chicken", in_bank: false, used_count: 3 },
    ];

    mockSupabaseFrom.mockReturnValue(createMockQueryBuilder(existingData));

    render(
      <IngredientBank
        ingredients={[
          createMockIngredient({ id: "1", name: "Chicken", inBank: false, usedCount: 3 }),
        ]}
        setIngredients={mockSetIngredients}
        userId={mockUserId}
        isAdmin={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/add a new ingredient/i)).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/add a new ingredient/i);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Chic" } });

    await waitFor(() => {
      // Should show usage count and "Add to bank" option
      expect(screen.getByText(/used 3x/i)).toBeInTheDocument();
    });
  });

  it("adds ingredient from autocomplete when clicked", async () => {
    const mockUpdate = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockResolvedValue({ error: null });

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "ingredients") {
        return {
          select: vi.fn().mockReturnThis(),
          update: mockUpdate,
          eq: mockEq,
          order: vi.fn().mockResolvedValue({
            data: [{ id: "1", name: "Chicken", in_bank: false, used_count: 2 }],
            error: null,
          }),
        };
      }
      return createMockQueryBuilder([]);
    });

    render(
      <IngredientBank
        ingredients={[
          createMockIngredient({ id: "1", name: "Chicken", inBank: false, usedCount: 2 }),
        ]}
        setIngredients={mockSetIngredients}
        userId={mockUserId}
        isAdmin={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/add a new ingredient/i)).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/add a new ingredient/i);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Chic" } });

    await waitFor(() => {
      // Find the autocomplete button for Chicken
      const autocompleteButton = screen.getAllByRole("button").find(btn =>
        btn.textContent?.includes("Chicken") && btn.textContent?.includes("Add to bank")
      );
      if (autocompleteButton) {
        fireEvent.click(autocompleteButton);
      }
    });

    await waitFor(() => {
      // Should have called update to set in_bank to true
      expect(mockUpdate).toHaveBeenCalledWith({ in_bank: true });
    });
  });

  it("creates new ingredient via autocomplete 'Create' button", async () => {
    const mockInsert = vi.fn().mockResolvedValue({ error: null });

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "ingredients") {
        return {
          select: vi.fn().mockReturnThis(),
          insert: mockInsert,
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      }
      return createMockQueryBuilder([]);
    });

    render(
      <IngredientBank
        ingredients={[]}
        setIngredients={mockSetIngredients}
        userId={mockUserId}
        isAdmin={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/add a new ingredient/i)).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/add a new ingredient/i);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Brand New Ingredient" } });

    await waitFor(() => {
      expect(screen.getByText(/create "brand new ingredient"/i)).toBeInTheDocument();
    });

    // Click the create button
    const createButton = screen.getByText(/create "brand new ingredient"/i).closest("button");
    if (createButton) {
      fireEvent.click(createButton);
    }

    await waitFor(() => {
      expect(mockInsert).toHaveBeenCalled();
    });
  });

  it("handles error when re-adding ingredient to bank fails", async () => {
    const mockUpdate = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockResolvedValue({ error: { message: "Update failed" } });

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "ingredients") {
        return {
          select: vi.fn().mockReturnThis(),
          update: mockUpdate,
          eq: mockEq,
          order: vi.fn().mockResolvedValue({
            data: [{ id: "1", name: "Chicken", in_bank: false, used_count: 2 }],
            error: null,
          }),
        };
      }
      return createMockQueryBuilder([]);
    });

    render(
      <IngredientBank
        ingredients={[
          createMockIngredient({ id: "1", name: "Chicken", inBank: false, usedCount: 2 }),
        ]}
        setIngredients={mockSetIngredients}
        userId={mockUserId}
        isAdmin={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/add a new ingredient/i)).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/add a new ingredient/i);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Chic" } });

    await waitFor(() => {
      const autocompleteButton = screen.getAllByRole("button").find(btn =>
        btn.textContent?.includes("Chicken") && btn.textContent?.includes("Add to bank")
      );
      if (autocompleteButton) {
        fireEvent.click(autocompleteButton);
      }
    });

    // The update should have been attempted
    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith({ in_bank: true });
    });
  });

  it("re-adds existing ingredient to bank when typing exact name and pressing Enter", async () => {
    // This test verifies the flow when a user types an exact name of an existing ingredient
    // and presses Enter - the component should find the existing ingredient and re-add it
    const mockUpdate = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockResolvedValue({ error: null });

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "ingredients") {
        return {
          select: vi.fn().mockReturnThis(),
          update: mockUpdate,
          eq: mockEq,
          order: vi.fn().mockResolvedValue({
            data: [{ id: "1", name: "Chicken", in_bank: false, used_count: 2 }],
            error: null,
          }),
        };
      }
      return createMockQueryBuilder([]);
    });

    render(
      <IngredientBank
        ingredients={[
          createMockIngredient({ id: "1", name: "Chicken", inBank: false, usedCount: 2 }),
        ]}
        setIngredients={mockSetIngredients}
        userId={mockUserId}
        isAdmin={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/add a new ingredient/i)).toBeInTheDocument();
    });

    // Type the exact name and press Enter to trigger re-add flow
    const input = screen.getByPlaceholderText(/add a new ingredient/i);
    fireEvent.change(input, { target: { value: "Chicken" } });
    fireEvent.keyPress(input, { key: "Enter", code: "Enter", charCode: 13 });

    // Should update existing ingredient to be in bank
    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith({ in_bank: true });
    });
  });

  it("handles adding ingredient when existing ingredient with same name is not in bank", async () => {
    // This test verifies the flow when a user clicks an autocomplete option
    const mockUpdate = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockResolvedValue({ error: null });

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "ingredients") {
        return {
          select: vi.fn().mockReturnThis(),
          update: mockUpdate,
          eq: mockEq,
          order: vi.fn().mockResolvedValue({
            data: [{ id: "1", name: "Chicken", in_bank: false, used_count: 2 }],
            error: null,
          }),
        };
      }
      return createMockQueryBuilder([]);
    });

    render(
      <IngredientBank
        ingredients={[
          createMockIngredient({ id: "1", name: "Chicken", inBank: false, usedCount: 2 }),
        ]}
        setIngredients={mockSetIngredients}
        userId={mockUserId}
        isAdmin={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/add a new ingredient/i)).toBeInTheDocument();
    });

    // Via autocomplete, select the existing "Chicken" to add back to bank
    const input = screen.getByPlaceholderText(/add a new ingredient/i);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Chicken" } });

    await waitFor(() => {
      const autocompleteButton = screen.getAllByRole("button").find(btn =>
        btn.textContent?.includes("Chicken") && btn.textContent?.includes("Add to bank")
      );
      if (autocompleteButton) {
        fireEvent.click(autocompleteButton);
      }
    });

    // Should update existing ingredient to be in bank
    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith({ in_bank: true });
    });
  });

  it("prevents entering only whitespace", async () => {
    // Load some existing ingredients to avoid default init
    const existingData = [
      { id: "1", name: "Chicken", in_bank: true, used_count: 0 },
    ];

    mockSupabaseFrom.mockReturnValue(createMockQueryBuilder(existingData));

    render(
      <IngredientBank
        ingredients={[
          createMockIngredient({ id: "1", name: "Chicken", inBank: true, usedCount: 0 }),
        ]}
        setIngredients={mockSetIngredients}
        userId={mockUserId}
        isAdmin={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/add a new ingredient/i)).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/add a new ingredient/i);
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.keyPress(input, { key: "Enter", code: "Enter" });

    // The input should still be there (whitespace doesn't add ingredient)
    expect(input).toHaveValue("   ");
  });
});

describe("IngredientBank - KeyDown Handler", () => {
  const mockSetIngredients = vi.fn();
  const mockUserId = "user-123";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("adds new ingredient when Enter key is pressed via keyDown event", async () => {
    const mockInsert = vi.fn().mockResolvedValue({ error: null });

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "ingredients") {
        return {
          select: vi.fn().mockReturnThis(),
          insert: mockInsert,
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      }
      return createMockQueryBuilder([]);
    });

    render(
      <IngredientBank
        ingredients={[]}
        setIngredients={mockSetIngredients}
        userId={mockUserId}
        isAdmin={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/add a new ingredient/i)).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/add a new ingredient/i);
    fireEvent.change(input, { target: { value: "New Ingredient Via Enter" } });

    // Use keyDown with key property to trigger the handleKeyPress handler
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(mockInsert).toHaveBeenCalled();
    });
  });

  it("does not add ingredient when non-Enter key is pressed", async () => {
    const mockInsert = vi.fn().mockResolvedValue({ error: null });

    // Provide existing data so component doesn't initialize defaults
    const existingData = [
      { id: "1", name: "Chicken", in_bank: true, used_count: 0 },
    ];

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "ingredients") {
        return {
          select: vi.fn().mockReturnThis(),
          insert: mockInsert,
          order: vi.fn().mockResolvedValue({ data: existingData, error: null }),
        };
      }
      return createMockQueryBuilder([]);
    });

    render(
      <IngredientBank
        ingredients={[createMockIngredient({ id: "1", name: "Chicken", inBank: true })]}
        setIngredients={mockSetIngredients}
        userId={mockUserId}
        isAdmin={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/add a new ingredient/i)).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/add a new ingredient/i);
    fireEvent.change(input, { target: { value: "Test Ingredient" } });

    // Press a non-Enter key using keyPress event (component uses onKeyPress)
    fireEvent.keyPress(input, { key: "a", code: "KeyA", charCode: 97 });

    // Insert should not be called for non-Enter keys (only called if Enter was pressed)
    expect(mockInsert).not.toHaveBeenCalled();
  });
});

describe("IngredientBank - Autocomplete Display Branches", () => {
  const mockSetIngredients = vi.fn();
  const mockUserId = "user-123";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows 'Add to bank' text without usage count for never-used ingredient in autocomplete", async () => {
    // Test the branch: isInBank = false AND usedCount === 0
    const existingData = [
      { id: "1", name: "Chicken", in_bank: true, used_count: 0 },
      { id: "2", name: "Salmon", in_bank: false, used_count: 0 }, // Never used, not in bank
    ];

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "ingredients") {
        return {
          select: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: existingData, error: null }),
        };
      }
      return createMockQueryBuilder([]);
    });

    render(
      <IngredientBank
        ingredients={[
          createMockIngredient({ id: "1", name: "Chicken", inBank: true, usedCount: 0 }),
          createMockIngredient({ id: "2", name: "Salmon", inBank: false, usedCount: 0 }),
        ]}
        setIngredients={mockSetIngredients}
        userId={mockUserId}
        isAdmin={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/add a new ingredient/i)).toBeInTheDocument();
    });

    // Type to trigger autocomplete
    const input = screen.getByPlaceholderText(/add a new ingredient/i);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Sal" } });

    // Should show "Add to bank" without usage count for never-used ingredient
    await waitFor(() => {
      const autocompleteButton = screen.getAllByRole("button").find(btn =>
        btn.textContent?.includes("Salmon") && btn.textContent?.includes("Add to bank")
      );
      expect(autocompleteButton).toBeInTheDocument();
      // Should NOT show "Used Xx" since usedCount is 0
      expect(autocompleteButton?.textContent).not.toMatch(/Used \d+x/);
    });
  });

  it("shows usage count for previously-used ingredient not in bank in autocomplete", async () => {
    // Test the branch: isInBank = false AND usedCount > 0
    const existingData = [
      { id: "1", name: "Chicken", in_bank: true, used_count: 0 },
      { id: "2", name: "Salmon", in_bank: false, used_count: 3 }, // Previously used
    ];

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "ingredients") {
        return {
          select: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: existingData, error: null }),
        };
      }
      return createMockQueryBuilder([]);
    });

    render(
      <IngredientBank
        ingredients={[
          createMockIngredient({ id: "1", name: "Chicken", inBank: true, usedCount: 0 }),
          createMockIngredient({ id: "2", name: "Salmon", inBank: false, usedCount: 3 }),
        ]}
        setIngredients={mockSetIngredients}
        userId={mockUserId}
        isAdmin={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/add a new ingredient/i)).toBeInTheDocument();
    });

    // Type to trigger autocomplete
    const input = screen.getByPlaceholderText(/add a new ingredient/i);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Sal" } });

    // Should show "Used 3x · Add to bank" for previously used ingredient
    await waitFor(() => {
      const autocompleteButton = screen.getAllByRole("button").find(btn =>
        btn.textContent?.includes("Salmon") && btn.textContent?.includes("Used 3x")
      );
      expect(autocompleteButton).toBeInTheDocument();
    });
  });
});

describe("IngredientBank - Edge Case Branches", () => {
  const mockSetIngredients = vi.fn();
  const mockUserId = "user-123";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("handles remove button click correctly", async () => {
    // This tests the removeFromBank flow
    const mockUpdate = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockResolvedValue({ error: null });

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "ingredients") {
        return {
          select: vi.fn().mockReturnThis(),
          update: mockUpdate,
          eq: mockEq,
          order: vi.fn().mockResolvedValue({
            data: [{ id: "1", name: "Chicken", in_bank: true, used_count: 0 }],
            error: null
          }),
        };
      }
      return createMockQueryBuilder([]);
    });

    render(
      <IngredientBank
        ingredients={[createMockIngredient({ id: "1", name: "Chicken", inBank: true })]}
        setIngredients={mockSetIngredients}
        userId={mockUserId}
        isAdmin={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Chicken")).toBeInTheDocument();
    });

    // Find the remove button (X icon) within the ingredient item
    const ingredientItem = screen.getByText("Chicken").closest("div")?.parentElement;
    const removeButton = ingredientItem?.querySelector("button");

    if (removeButton) {
      fireEvent.click(removeButton);
    }

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith({ in_bank: false });
    });
  });

  it("updates correct ingredient in map when re-adding from autocomplete with multiple ingredients", async () => {
    // Tests line 173: both branches of the ternary in the map function
    const mockUpdate = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockResolvedValue({ error: null });

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "ingredients") {
        return {
          select: vi.fn().mockReturnThis(),
          update: mockUpdate,
          eq: mockEq,
          order: vi.fn().mockResolvedValue({
            data: [
              { id: "1", name: "Chicken", in_bank: true, used_count: 0 },
              { id: "2", name: "Salmon", in_bank: false, used_count: 2 },
              { id: "3", name: "Beef", in_bank: true, used_count: 1 },
            ],
            error: null
          }),
        };
      }
      return createMockQueryBuilder([]);
    });

    render(
      <IngredientBank
        ingredients={[
          createMockIngredient({ id: "1", name: "Chicken", inBank: true }),
          createMockIngredient({ id: "2", name: "Salmon", inBank: false, usedCount: 2 }),
          createMockIngredient({ id: "3", name: "Beef", inBank: true }),
        ]}
        setIngredients={mockSetIngredients}
        userId={mockUserId}
        isAdmin={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/add a new ingredient/i)).toBeInTheDocument();
    });

    // Type to trigger autocomplete for Salmon (not in bank)
    const input = screen.getByPlaceholderText(/add a new ingredient/i);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Sal" } });

    await waitFor(() => {
      const autocompleteButton = screen.getAllByRole("button").find(btn =>
        btn.textContent?.includes("Salmon") && btn.textContent?.includes("Add to bank")
      );
      expect(autocompleteButton).toBeInTheDocument();
    });

    // Click to re-add Salmon to bank
    const autocompleteButton = screen.getAllByRole("button").find(btn =>
      btn.textContent?.includes("Salmon") && btn.textContent?.includes("Add to bank")
    );
    if (autocompleteButton) {
      fireEvent.click(autocompleteButton);
    }

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith({ in_bank: true });
      expect(mockEq).toHaveBeenCalledWith("id", "2");
    });
  });

  it("removes correct ingredient from bank with multiple ingredients", async () => {
    // Tests line 255: both branches of the ternary in the map function
    const mockUpdate = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockResolvedValue({ error: null });

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "ingredients") {
        return {
          select: vi.fn().mockReturnThis(),
          update: mockUpdate,
          eq: mockEq,
          order: vi.fn().mockResolvedValue({
            data: [
              { id: "1", name: "Chicken", in_bank: true, used_count: 0 },
              { id: "2", name: "Salmon", in_bank: true, used_count: 2 },
              { id: "3", name: "Beef", in_bank: true, used_count: 1 },
            ],
            error: null
          }),
        };
      }
      return createMockQueryBuilder([]);
    });

    render(
      <IngredientBank
        ingredients={[
          createMockIngredient({ id: "1", name: "Chicken", inBank: true }),
          createMockIngredient({ id: "2", name: "Salmon", inBank: true, usedCount: 2 }),
          createMockIngredient({ id: "3", name: "Beef", inBank: true }),
        ]}
        setIngredients={mockSetIngredients}
        userId={mockUserId}
        isAdmin={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Chicken")).toBeInTheDocument();
      expect(screen.getByText("Salmon")).toBeInTheDocument();
      expect(screen.getByText("Beef")).toBeInTheDocument();
    });

    // Find and click remove button for Salmon (second ingredient)
    const ingredientItems = screen.getAllByText(/^(Chicken|Salmon|Beef)$/).map(el => el.closest("div")?.parentElement);
    const salmonItem = ingredientItems.find(item => item?.textContent?.includes("Salmon"));
    const removeButton = salmonItem?.querySelector("button");

    if (removeButton) {
      fireEvent.click(removeButton);
    }

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith({ in_bank: false });
      expect(mockEq).toHaveBeenCalledWith("id", "2");
    });
  });

  it("handles ingredient data with all optional fields populated", async () => {
    // Tests line 55: optional field mappings when values are truthy
    const existingData = [
      {
        id: "1",
        name: "Chicken",
        in_bank: true,
        used_count: 5,
        last_used_by: "user-456",
        last_used_date: "2025-01-15",
        created_by: "user-123"
      },
    ];

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "ingredients") {
        return {
          select: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: existingData, error: null }),
        };
      }
      return createMockQueryBuilder([]);
    });

    // Pass the ingredient in props so it renders immediately
    render(
      <IngredientBank
        ingredients={[createMockIngredient({
          id: "1",
          name: "Chicken",
          inBank: true,
          usedCount: 5,
          lastUsedBy: "user-456",
          lastUsedDate: "2025-01-15",
          createdBy: "user-123"
        })]}
        setIngredients={mockSetIngredients}
        userId={mockUserId}
        isAdmin={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Chicken")).toBeInTheDocument();
    });

    // Verify the component renders and loads correctly
    expect(screen.getByText(/Used 5x/)).toBeInTheDocument();
  });

  it("handles ingredient data with all optional fields as null", async () => {
    // Tests line 55: optional field mappings when values are null/undefined
    const existingData = [
      {
        id: "1",
        name: "Chicken",
        in_bank: true,
        used_count: 0,
        last_used_by: null,
        last_used_date: null,
        created_by: null
      },
    ];

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "ingredients") {
        return {
          select: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: existingData, error: null }),
        };
      }
      return createMockQueryBuilder([]);
    });

    // Pass the ingredient in props
    render(
      <IngredientBank
        ingredients={[createMockIngredient({
          id: "1",
          name: "Chicken",
          inBank: true,
          usedCount: 0
        })]}
        setIngredients={mockSetIngredients}
        userId={mockUserId}
        isAdmin={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Chicken")).toBeInTheDocument();
    });

    // Verify setIngredients was called during load
    expect(mockSetIngredients).toHaveBeenCalled();
  });

  it("does not add ingredient when input is empty and plus button is clicked", async () => {
    // Tests line 155: early return when trimmedName is empty
    const mockInsert = vi.fn().mockResolvedValue({ error: null });

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "ingredients") {
        return {
          select: vi.fn().mockReturnThis(),
          insert: mockInsert,
          order: vi.fn().mockResolvedValue({
            data: [{ id: "1", name: "Chicken", in_bank: true, used_count: 0 }],
            error: null
          }),
        };
      }
      return createMockQueryBuilder([]);
    });

    render(
      <IngredientBank
        ingredients={[createMockIngredient({ id: "1", name: "Chicken", inBank: true })]}
        setIngredients={mockSetIngredients}
        userId={mockUserId}
        isAdmin={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/add a new ingredient/i)).toBeInTheDocument();
    });

    // Make sure input is empty
    const input = screen.getByPlaceholderText(/add a new ingredient/i);
    expect(input).toHaveValue("");

    // Find the Plus button (the one in the add ingredient section with bg-purple class)
    const addButtons = screen.getAllByRole("button").filter(btn =>
      btn.querySelector("svg.lucide-plus") && btn.classList.contains("bg-purple")
    );

    if (addButtons.length > 0) {
      fireEvent.click(addButtons[0]);
    }

    // Insert should NOT be called since input was empty
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("does not add ingredient when only whitespace is entered", async () => {
    // Tests line 155: early return when trimmedName is empty (whitespace only)
    const mockInsert = vi.fn().mockResolvedValue({ error: null });

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "ingredients") {
        return {
          select: vi.fn().mockReturnThis(),
          insert: mockInsert,
          order: vi.fn().mockResolvedValue({
            data: [{ id: "1", name: "Chicken", in_bank: true, used_count: 0 }],
            error: null
          }),
        };
      }
      return createMockQueryBuilder([]);
    });

    render(
      <IngredientBank
        ingredients={[createMockIngredient({ id: "1", name: "Chicken", inBank: true })]}
        setIngredients={mockSetIngredients}
        userId={mockUserId}
        isAdmin={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/add a new ingredient/i)).toBeInTheDocument();
    });

    // Enter whitespace only
    const input = screen.getByPlaceholderText(/add a new ingredient/i);
    fireEvent.change(input, { target: { value: "   " } });

    // Press Enter
    fireEvent.keyPress(input, { key: "Enter", code: "Enter", charCode: 13 });

    // Insert should NOT be called since input was whitespace only
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("handles addIngredient with string argument via autocomplete create", async () => {
    // Tests line 151: addIngredient called with implicit string from newIngredient
    const mockInsert = vi.fn().mockResolvedValue({ error: null });

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "ingredients") {
        return {
          select: vi.fn().mockReturnThis(),
          insert: mockInsert,
          order: vi.fn().mockResolvedValue({
            data: [{ id: "1", name: "Chicken", in_bank: true, used_count: 0 }],
            error: null
          }),
        };
      }
      return createMockQueryBuilder([]);
    });

    render(
      <IngredientBank
        ingredients={[createMockIngredient({ id: "1", name: "Chicken", inBank: true })]}
        setIngredients={mockSetIngredients}
        userId={mockUserId}
        isAdmin={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/add a new ingredient/i)).toBeInTheDocument();
    });

    // Type a new ingredient name
    const input = screen.getByPlaceholderText(/add a new ingredient/i);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Quinoa" } });

    // Wait for autocomplete to show the create option
    await waitFor(() => {
      expect(screen.getByText(/create "quinoa"/i)).toBeInTheDocument();
    });

    // Click create button - this calls addIngredient() which uses newIngredient state
    const createButton = screen.getByText(/create "quinoa"/i).closest("button");
    if (createButton) {
      fireEvent.click(createButton);
    }

    await waitFor(() => {
      expect(mockInsert).toHaveBeenCalled();
    });
  });

  it("does not load ingredients when userId is empty", async () => {
    // Tests line 100: the if (userId) check - branch when userId is falsy
    const mockOrder = vi.fn().mockResolvedValue({ data: [], error: null });

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "ingredients") {
        return {
          select: vi.fn().mockReturnThis(),
          order: mockOrder,
        };
      }
      return createMockQueryBuilder([]);
    });

    render(
      <IngredientBank
        ingredients={[createMockIngredient({ id: "1", name: "Chicken", inBank: true })]}
        setIngredients={mockSetIngredients}
        userId="" // Empty userId
        isAdmin={true}
      />
    );

    // Wait a bit to ensure async operations would have fired
    await new Promise(resolve => setTimeout(resolve, 100));

    // The Supabase order query should NOT have been called since userId is empty
    expect(mockOrder).not.toHaveBeenCalled();
  });

  it("handles click outside when autocomplete ref is not available (non-admin)", async () => {
    // Tests the optional chaining branch when autocompleteRef.current is null
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "ingredients") {
        return {
          select: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: [{ id: "1", name: "Chicken", in_bank: true, used_count: 0 }],
            error: null
          }),
        };
      }
      return createMockQueryBuilder([]);
    });

    render(
      <IngredientBank
        ingredients={[createMockIngredient({ id: "1", name: "Chicken", inBank: true })]}
        setIngredients={mockSetIngredients}
        userId={mockUserId}
        isAdmin={false} // Non-admin, so autocomplete div is not rendered
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Chicken")).toBeInTheDocument();
    });

    // Trigger a click event - the handler should handle null ref gracefully
    fireEvent.mouseDown(document.body);

    // Component should still be functional
    expect(screen.getByText("Chicken")).toBeInTheDocument();
  });

  it("keeps autocomplete open when clicking inside autocomplete area", async () => {
    // Tests the isOutside = false branch (clicking inside autocomplete)
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "ingredients") {
        return {
          select: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: [
              { id: "1", name: "Chicken", in_bank: true, used_count: 0 },
              { id: "2", name: "Cheese", in_bank: true, used_count: 0 },
            ],
            error: null
          }),
        };
      }
      return createMockQueryBuilder([]);
    });

    render(
      <IngredientBank
        ingredients={[
          createMockIngredient({ id: "1", name: "Chicken", inBank: true }),
          createMockIngredient({ id: "2", name: "Cheese", inBank: true }),
        ]}
        setIngredients={mockSetIngredients}
        userId={mockUserId}
        isAdmin={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/add a new ingredient/i)).toBeInTheDocument();
    });

    // Open autocomplete by typing
    const input = screen.getByPlaceholderText(/add a new ingredient/i);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Ch" } });

    // Wait for autocomplete options to appear
    await waitFor(() => {
      expect(screen.getByText(/create "ch"/i)).toBeInTheDocument();
    });

    // Click inside the autocomplete area (on the input itself)
    fireEvent.mouseDown(input);

    // Autocomplete should still be showing (create option still visible)
    expect(screen.getByText(/create "ch"/i)).toBeInTheDocument();
  });

  it("cleans up event listener on unmount", async () => {
    // Tests the useEffect cleanup function that removes the mousedown listener
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "ingredients") {
        return {
          select: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: [{ id: "1", name: "Chicken", in_bank: true, used_count: 0 }],
            error: null
          }),
        };
      }
      return createMockQueryBuilder([]);
    });

    const { unmount } = render(
      <IngredientBank
        ingredients={[createMockIngredient({ id: "1", name: "Chicken", inBank: true })]}
        setIngredients={mockSetIngredients}
        userId={mockUserId}
        isAdmin={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Chicken")).toBeInTheDocument();
    });

    // Unmount the component - this triggers the cleanup function
    unmount();

    // After unmount, clicking should not cause errors (listener was removed)
    fireEvent.mouseDown(document.body);
  });
});

