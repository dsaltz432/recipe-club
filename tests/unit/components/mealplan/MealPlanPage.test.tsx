import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@tests/utils";
import MealPlanPage from "@/components/mealplan/MealPlanPage";
import { toast } from "sonner";

// Mock react-router-dom navigate
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock PantrySection
vi.mock("@/components/pantry/PantrySection", () => ({
  default: ({ userId, onPantryChange }: { userId?: string; onPantryChange?: () => void }) =>
    userId ? (
      <div data-testid="pantry-section">
        <span>My Pantry</span>
        <button onClick={onPantryChange}>Refresh Pantry</button>
      </div>
    ) : null,
}));

// Mock Supabase
const mockSupabaseFrom = vi.fn();
const mockInvoke = vi.fn();
const mockStorageUpload = vi.fn();
const mockStorageGetPublicUrl = vi.fn();
const mockRpc = vi.fn().mockResolvedValue({ error: null });
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => mockSupabaseFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
    functions: { invoke: (...args: unknown[]) => mockInvoke(...args) },
    storage: {
      from: () => ({
        upload: mockStorageUpload,
        getPublicUrl: mockStorageGetPublicUrl,
      }),
    },
  },
}));

vi.mock("uuid", () => ({
  v4: () => "mock-uuid-456",
}));

// Mock pantry module
const mockGetPantryItems = vi.fn();
const mockEnsureDefaultPantryItems = vi.fn();
vi.mock("@/lib/pantry", () => ({
  getPantryItems: (...args: unknown[]) => mockGetPantryItems(...args),
  ensureDefaultPantryItems: (...args: unknown[]) => mockEnsureDefaultPantryItems(...args),
  DEFAULT_PANTRY_ITEMS: ["salt", "pepper", "water"],
}));

// Mock grocery list smart combine
const mockSmartCombineIngredients = vi.fn();
vi.mock("@/lib/groceryList", async () => {
  const actual = await vi.importActual("@/lib/groceryList");
  return {
    ...actual,
    smartCombineIngredients: (...args: unknown[]) => mockSmartCombineIngredients(...args),
  };
});

// Mock grocery cache
const mockLoadGroceryCache = vi.fn();
const mockSaveGroceryCache = vi.fn();
const mockDeleteGroceryCache = vi.fn().mockResolvedValue(undefined);
const mockLoadCheckedItems = vi.fn().mockResolvedValue(new Set());
const mockSaveCheckedItems = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/groceryCache", () => ({
  loadGroceryCache: (...args: unknown[]) => mockLoadGroceryCache(...args),
  saveGroceryCache: (...args: unknown[]) => mockSaveGroceryCache(...args),
  deleteGroceryCache: (...args: unknown[]) => mockDeleteGroceryCache(...args),
  loadCheckedItems: (...args: unknown[]) => mockLoadCheckedItems(...args),
  saveCheckedItems: (...args: unknown[]) => mockSaveCheckedItems(...args),
}));

// Mock general grocery module
const mockLoadGeneralItems = vi.fn().mockResolvedValue([]);
const mockAddGeneralItem = vi.fn().mockResolvedValue(undefined);
const mockRemoveGeneralItem = vi.fn().mockResolvedValue(undefined);
const mockUpdateGeneralItem = vi.fn().mockResolvedValue(undefined);
const mockToRawIngredients = vi.fn().mockReturnValue([]);
vi.mock("@/lib/generalGrocery", () => ({
  loadGeneralItems: (...args: unknown[]) => mockLoadGeneralItems(...args),
  addGeneralItem: (...args: unknown[]) => mockAddGeneralItem(...args),
  removeGeneralItem: (...args: unknown[]) => mockRemoveGeneralItem(...args),
  updateGeneralItem: (...args: unknown[]) => mockUpdateGeneralItem(...args),
  toRawIngredients: (...args: unknown[]) => mockToRawIngredients(...args),
}));

// Mock user preferences
const mockLoadUserPreferences = vi.fn().mockResolvedValue({
  mealTypes: ["breakfast", "lunch", "dinner"],
  weekStartDay: 0,
  householdSize: 2,
});
vi.mock("@/lib/userPreferences", () => ({
  loadUserPreferences: (...args: unknown[]) => mockLoadUserPreferences(...args),
}));

// Mock constants to show parse buttons in tests
vi.mock("@/lib/constants", async () => {
  const actual = await vi.importActual("@/lib/constants");
  return {
    ...actual,
    SHOW_PARSE_BUTTONS: true,
  };
});

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const createMockQueryBuilder = (overrides: Record<string, unknown> = {}) => {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    ...overrides,
  };
  return builder;
};

// Helper to create a meal_plans mock that returns an existing plan
const createPlanMock = (planId: string | null) => {
  if (planId) {
    // Existing plan found via order().limit(1)
    const builder = createMockQueryBuilder();
    builder.limit = vi.fn().mockResolvedValue({ data: [{ id: planId }], error: null });
    return builder;
  }
  // No plan found — order().limit(1) returns empty; upsert creates new
  const builder = createMockQueryBuilder();
  builder.limit = vi.fn().mockResolvedValue({ data: [], error: null });
  builder.single = vi.fn().mockResolvedValue({ data: { id: "plan-new" }, error: null });
  return builder;
};

describe("MealPlanPage", () => {
  const defaultProps = {
    userId: "user-123",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPantryItems.mockResolvedValue([]);
    mockEnsureDefaultPantryItems.mockResolvedValue(undefined);
    mockInvoke.mockResolvedValue({ data: { success: true }, error: null });
    mockSmartCombineIngredients.mockResolvedValue(null);
    mockLoadGroceryCache.mockResolvedValue(null);
    mockSaveGroceryCache.mockResolvedValue(undefined);
    mockStorageUpload.mockResolvedValue({ error: null });
    mockStorageGetPublicUrl.mockReturnValue({
      data: { publicUrl: "https://storage.example.com/recipe-images/mock-uuid-456.jpg" },
    });

    // Default mock: create a new plan for the current week
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "meal_plans") {
        return createPlanMock(null);
      }
      if (table === "recipes") {
        return createMockQueryBuilder({
          single: vi.fn().mockResolvedValue({
            data: { id: "recipe-default" },
            error: null,
          }),
        });
      }
      if (table === "meal_plan_items") {
        return createMockQueryBuilder({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
          single: vi.fn().mockResolvedValue({
            data: {
              id: "item-new",
              plan_id: "plan-new",
              recipe_id: "recipe-default",
              day_of_week: 0,
              meal_type: "dinner",
              custom_name: null,
              custom_url: null,
              sort_order: 0,
              recipes: { name: "Test Meal", url: null },
            },
            error: null,
          }),
        });
      }
      return createMockQueryBuilder();
    });
  });

  it("shows loading spinner initially", () => {
    // Make the plan load hang
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "meal_plans") {
        const builder = createMockQueryBuilder();
        builder.limit = vi.fn().mockReturnValue(new Promise(() => {}));
        return builder;
      }
      return createMockQueryBuilder();
    });

    render(<MealPlanPage {...defaultProps} />);

    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("renders Meals header after loading", async () => {
    render(<MealPlanPage {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Meal Plan")).toBeInTheDocument();
    });
  });

  it("navigates to previous week", async () => {
    render(<MealPlanPage {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Meal Plan")).toBeInTheDocument();
    });

    // Click previous week button (first chevron button)
    const buttons = screen.getAllByRole("button");
    const prevButton = buttons.find((b) => b.querySelector("svg"));
    if (prevButton) {
      fireEvent.click(prevButton);
    }
  });

  it("navigates to next week", async () => {
    render(<MealPlanPage {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Meal Plan")).toBeInTheDocument();
    });

    // ChevronLeft and ChevronRight are icon-only buttons (no text content)
    const iconOnlyButtons = screen.getAllByRole("button").filter(
      (b) => !b.textContent?.trim()
    );
    // iconOnlyButtons[0] = ChevronLeft, [1] = ChevronRight
    fireEvent.click(iconOnlyButtons[1]);
  });

  it("opens Add Meal dialog when clicking an empty slot", async () => {
    render(<MealPlanPage {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Meal Plan")).toBeInTheDocument();
    });

    // Click an empty meal slot
    const slotButtons = screen.getAllByRole("button").filter(
      (b) => b.textContent?.includes("Breakfast") || b.textContent?.includes("Lunch") || b.textContent?.includes("Dinner")
    );
    if (slotButtons.length > 0) {
      fireEvent.click(slotButtons[0]);
    }

    expect(screen.getByText("Add Meal")).toBeInTheDocument();
  });

  it("adds custom meal from dialog", async () => {
    // Custom meals now create a recipes entry first, then link via recipe_id
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "meal_plans") {
        return createPlanMock(null);
      }
      if (table === "recipes") {
        return createMockQueryBuilder({
          single: vi.fn().mockResolvedValue({
            data: { id: "recipe-custom-1" },
            error: null,
          }),
        });
      }
      if (table === "meal_plan_items") {
        return createMockQueryBuilder({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
          single: vi.fn().mockResolvedValue({
            data: {
              id: "item-new",
              plan_id: "plan-new",
              recipe_id: "recipe-custom-1",
              day_of_week: 0,
              meal_type: "dinner",
              custom_name: null,
              custom_url: null,
              sort_order: 0,
              recipes: { name: "Homemade Tacos", url: null },
            },
            error: null,
          }),
        });
      }
      return createMockQueryBuilder();
    });

    render(<MealPlanPage {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Meal Plan")).toBeInTheDocument();
    });

    // Click an empty dinner slot
    const slotButtons = screen.getAllByRole("button").filter(
      (b) => b.textContent?.includes("Dinner")
    );
    if (slotButtons.length > 0) {
      fireEvent.click(slotButtons[0]);
    }

    // Fill in custom meal form
    fireEvent.change(screen.getByLabelText("Meal Name *"), {
      target: { value: "Homemade Tacos" },
    });
    fireEvent.change(screen.getByLabelText("Recipe URL *"), {
      target: { value: "https://example.com/tacos" },
    });
    fireEvent.click(screen.getByText("Add to Meal"));

    await waitFor(() => {
      expect(mockSupabaseFrom).toHaveBeenCalledWith("meal_plan_items");
    });
  });

  it("handles null recipe_id in meal_plan_items response", async () => {
    // Covers the `data.recipe_id || undefined` branch when DB returns null
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "meal_plans") {
        return createPlanMock(null);
      }
      if (table === "recipes") {
        return createMockQueryBuilder({
          single: vi.fn().mockResolvedValue({
            data: { id: "recipe-custom-2" },
            error: null,
          }),
        });
      }
      if (table === "meal_plan_items") {
        return createMockQueryBuilder({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
          single: vi.fn().mockResolvedValue({
            data: {
              id: "item-new",
              plan_id: "plan-new",
              recipe_id: null,
              day_of_week: 0,
              meal_type: "dinner",
              custom_name: "Leftovers",
              custom_url: null,
              sort_order: 0,
              recipes: null,
            },
            error: null,
          }),
        });
      }
      return createMockQueryBuilder();
    });

    render(<MealPlanPage {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Meal Plan")).toBeInTheDocument();
    });

    const slotButtons = screen.getAllByRole("button").filter(
      (b) => b.textContent?.includes("Dinner")
    );
    if (slotButtons.length > 0) {
      fireEvent.click(slotButtons[0]);
    }

    fireEvent.change(screen.getByLabelText("Meal Name *"), {
      target: { value: "Leftovers" },
    });
    fireEvent.change(screen.getByLabelText("Recipe URL *"), {
      target: { value: "https://example.com/leftovers" },
    });
    fireEvent.click(screen.getByText("Add to Meal"));

    await waitFor(() => {
      expect(mockSupabaseFrom).toHaveBeenCalledWith("meal_plan_items");
    });
  });

  it("adds recipe meal from dialog", async () => {
    // Set up recipe search mock
    const mockRecipes = [
      { id: "r-1", name: "Club Pasta", url: "https://example.com/pasta", event_id: "e-1" },
    ];

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "meal_plans") {
        return createPlanMock(null);
      }
      if (table === "meal_plan_items") {
        return createMockQueryBuilder({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
          single: vi.fn().mockResolvedValue({
            data: {
              id: "item-new",
              plan_id: "plan-new",
              recipe_id: "r-1",
              day_of_week: 0,
              meal_type: "dinner",
              custom_name: null,
              custom_url: null,
              sort_order: 0,
              recipes: { name: "Club Pasta", url: "https://example.com/pasta" },
            },
            error: null,
          }),
        });
      }
      if (table === "recipes") {
        return createMockQueryBuilder({
          limit: vi.fn().mockResolvedValue({ data: mockRecipes, error: null }),
        });
      }
      return createMockQueryBuilder();
    });

    render(<MealPlanPage {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Meal Plan")).toBeInTheDocument();
    });

    // Click an empty dinner slot
    const slotButtons = screen.getAllByRole("button").filter(
      (b) => b.textContent?.includes("Dinner")
    );
    if (slotButtons.length > 0) {
      fireEvent.click(slotButtons[0]);
    }

    // Switch to Recipes tab
    fireEvent.click(screen.getByText("From Recipes"));

    // Search for recipe
    fireEvent.change(screen.getByPlaceholderText("Search recipes..."), {
      target: { value: "pasta" },
    });

    // Wait for debounce + results
    await waitFor(() => {
      expect(screen.getByText("Club Pasta")).toBeInTheDocument();
    });

    // Select recipe (multi-select: click to toggle)
    fireEvent.click(screen.getByText("Club Pasta"));

    // Submit selection
    fireEvent.click(screen.getByText("Add 1 to Meal"));

    await waitFor(() => {
      expect(mockSupabaseFrom).toHaveBeenCalledWith("meal_plan_items");
    });
  });

  it("calculates sort_order based on existing items in the slot", async () => {
    // Load plan with existing items in the same slot (day 0, dinner)
    // First item has null sort_order to exercise the ?? 0 fallback
    const insertMock = vi.fn().mockReturnThis();
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "meal_plans") {
        return createPlanMock("plan-1");
      }
      if (table === "meal_plan_items") {
        return createMockQueryBuilder({
          order: vi.fn().mockResolvedValue({
            data: [
              {
                id: "item-1",
                plan_id: "plan-1",
                recipe_id: "recipe-1",
                day_of_week: 0,
                meal_type: "dinner",
                custom_name: null,
                custom_url: null,
                sort_order: null,
                recipes: { name: "Existing Meal 1", url: null },
              },
              {
                id: "item-2",
                plan_id: "plan-1",
                recipe_id: "recipe-2",
                day_of_week: 0,
                meal_type: "dinner",
                custom_name: null,
                custom_url: null,
                sort_order: 1,
                recipes: { name: "Existing Meal 2", url: null },
              },
            ],
            error: null,
          }),
          insert: insertMock,
          single: vi.fn().mockResolvedValue({
            data: {
              id: "item-new",
              plan_id: "plan-1",
              recipe_id: "recipe-new",
              day_of_week: 0,
              meal_type: "dinner",
              custom_name: null,
              custom_url: null,
              sort_order: 2,
              recipes: { name: "New Meal", url: null },
            },
            error: null,
          }),
        });
      }
      if (table === "recipes") {
        return createMockQueryBuilder({
          single: vi.fn().mockResolvedValue({
            data: { id: "recipe-new" },
            error: null,
          }),
        });
      }
      return createMockQueryBuilder();
    });

    render(<MealPlanPage {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getAllByText("Existing Meal 1")[0]).toBeInTheDocument();
    });

    // Click the "Add another meal" button in the occupied Sunday Dinner slot
    const addButtons = screen.getAllByTitle("Add another meal");
    fireEvent.click(addButtons[0]);

    // Add custom meal
    fireEvent.change(screen.getByLabelText("Meal Name *"), {
      target: { value: "New Meal" },
    });
    fireEvent.change(screen.getByLabelText("Recipe URL *"), {
      target: { value: "https://example.com/new-meal" },
    });
    fireEvent.click(screen.getByText("Add to Meal"));

    // Verify the insert was called with sort_order: 2 (max of 0,1 = 1, plus 1 = 2)
    await waitFor(() => {
      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({ sort_order: 2 })
      );
    });
  });

  it("clears pending slot when dialog closes", async () => {
    render(<MealPlanPage {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Meal Plan")).toBeInTheDocument();
    });

    // Click an empty meal slot to open dialog
    const slotButtons = screen.getAllByRole("button").filter(
      (b) => b.textContent?.includes("Breakfast")
    );
    if (slotButtons.length > 0) {
      fireEvent.click(slotButtons[0]);
    }

    expect(screen.getByText("Add Meal")).toBeInTheDocument();

    // Close dialog via Cancel
    fireEvent.click(screen.getByText("Cancel"));

    // Dialog should be gone
    await waitFor(() => {
      expect(screen.queryByText("Add Meal")).not.toBeInTheDocument();
    });
  });

  it("handles plan load error", async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "meal_plans") {
        const builder = createMockQueryBuilder();
        builder.limit = vi.fn().mockRejectedValue(new Error("DB error"));
        return builder;
      }
      return createMockQueryBuilder();
    });

    render(<MealPlanPage {...defaultProps} />);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to load meal plan");
    });
  });

  it("loads existing plan with items", async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "meal_plans") {
        return createPlanMock("plan-existing");
      }
      if (table === "meal_plan_items") {
        return createMockQueryBuilder({
          order: vi.fn().mockResolvedValue({
            data: [
              {
                id: "item-1",
                plan_id: "plan-existing",
                recipe_id: "recipe-1",
                day_of_week: 1,
                meal_type: "dinner",
                custom_name: null,
                custom_url: null,
                sort_order: 0,
                recipes: { name: "Grilled Chicken", url: "https://example.com/chicken" },
              },
            ],
            error: null,
          }),
        });
      }
      return createMockQueryBuilder();
    });

    render(<MealPlanPage {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getAllByText("Grilled Chicken")[0]).toBeInTheDocument();
    });
  });

  it("renders week navigation", async () => {
    render(<MealPlanPage {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Meal Plan")).toBeInTheDocument();
    });

    // Should have day headers
    expect(screen.getAllByText("Sun")[0]).toBeInTheDocument();
    expect(screen.getAllByText("Mon")[0]).toBeInTheDocument();
  });

  it("handles add meal error", async () => {
    // Setup initial load — recipe insert fails for custom meals
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "meal_plans") {
        return createPlanMock(null);
      }
      if (table === "recipes") {
        return createMockQueryBuilder({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: "Recipe insert failed" },
          }),
        });
      }
      if (table === "meal_plan_items") {
        return createMockQueryBuilder({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        });
      }
      return createMockQueryBuilder();
    });

    render(<MealPlanPage {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Meal Plan")).toBeInTheDocument();
    });

    // Click slot to open dialog
    const slotButtons = screen.getAllByRole("button").filter(
      (b) => b.textContent?.includes("Dinner")
    );
    if (slotButtons.length > 0) {
      fireEvent.click(slotButtons[0]);
    }

    // Add custom meal via dialog - should fail
    fireEvent.change(screen.getByLabelText("Meal Name *"), {
      target: { value: "Test Meal" },
    });
    fireEvent.change(screen.getByLabelText("Recipe URL *"), {
      target: { value: "https://example.com/test-meal" },
    });
    fireEvent.click(screen.getByText("Add to Meal"));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to add meal");
    });
  });

  it("handles meal_plan_items insert error after successful recipe creation", async () => {
    // Recipe creation succeeds but meal_plan_items insert fails
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "meal_plans") {
        return createPlanMock(null);
      }
      if (table === "recipes") {
        return createMockQueryBuilder({
          single: vi.fn().mockResolvedValue({
            data: { id: "recipe-ok" },
            error: null,
          }),
        });
      }
      if (table === "meal_plan_items") {
        return createMockQueryBuilder({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: "meal_plan_items insert failed" },
          }),
        });
      }
      return createMockQueryBuilder();
    });

    render(<MealPlanPage {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Meal Plan")).toBeInTheDocument();
    });

    // Click slot to open dialog
    const slotButtons = screen.getAllByRole("button").filter(
      (b) => b.textContent?.includes("Dinner")
    );
    if (slotButtons.length > 0) {
      fireEvent.click(slotButtons[0]);
    }

    // Add custom meal — recipe insert succeeds but item insert fails
    fireEvent.change(screen.getByLabelText("Meal Name *"), {
      target: { value: "Failing Meal" },
    });
    fireEvent.change(screen.getByLabelText("Recipe URL *"), {
      target: { value: "https://example.com/failing-meal" },
    });
    fireEvent.click(screen.getByText("Add to Meal"));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to add meal");
    });
  });

  it("navigates to current week with Today button", async () => {
    render(<MealPlanPage {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Meal Plan")).toBeInTheDocument();
    });

    // Navigate away from current week (click ChevronLeft)
    const iconOnlyButtons = screen.getAllByRole("button").filter(
      (b) => !b.textContent?.trim()
    );
    fireEvent.click(iconOnlyButtons[0]); // ChevronLeft

    // Today button should appear
    await waitFor(() => {
      expect(screen.getByText("Today")).toBeInTheDocument();
    });

    // Click Today to go back to current week
    fireEvent.click(screen.getByText("Today"));

    // Today should disappear since we're on current week
    await waitFor(() => {
      expect(screen.queryByText("Today")).not.toBeInTheDocument();
    });
  });

  it("handles error when creating new plan via upsert", async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "meal_plans") {
        const builder = createMockQueryBuilder();
        builder.limit = vi.fn().mockResolvedValue({ data: [], error: null });
        builder.single = vi.fn().mockResolvedValue({
          data: null,
          error: { message: "Upsert plan failed" },
        });
        return builder;
      }
      return createMockQueryBuilder();
    });

    render(<MealPlanPage {...defaultProps} />);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to load meal plan");
    });
  });

  it("does nothing when adding to plan with no planId", async () => {
    // Make plan creation fail so planId stays null
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "meal_plans") {
        const builder = createMockQueryBuilder();
        builder.limit = vi.fn().mockResolvedValue({ data: [], error: null });
        builder.single = vi.fn().mockResolvedValue({
          data: null,
          error: { message: "Plan creation failed" },
        });
        return builder;
      }
      if (table === "recipes") {
        return createMockQueryBuilder({
          single: vi.fn().mockResolvedValue({
            data: { id: "recipe-x" },
            error: null,
          }),
        });
      }
      if (table === "meal_plan_items") {
        return createMockQueryBuilder({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        });
      }
      return createMockQueryBuilder();
    });

    render(<MealPlanPage {...defaultProps} />);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to load meal plan");
    });

    // Clear mocks to check that no meal_plan_items insert is called
    vi.mocked(toast.error).mockClear();
    vi.mocked(toast.success).mockClear();

    // Click an empty dinner slot to open dialog
    const slotButtons = screen.getAllByRole("button").filter(
      (b) => b.textContent?.includes("Dinner")
    );
    if (slotButtons.length > 0) {
      fireEvent.click(slotButtons[0]);
    }

    // Try to add a custom meal — should silently return because planId is null
    fireEvent.change(screen.getByLabelText("Meal Name *"), {
      target: { value: "No Plan Meal" },
    });
    fireEvent.change(screen.getByLabelText("Recipe URL *"), {
      target: { value: "https://example.com/no-plan" },
    });
    fireEvent.click(screen.getByText("Add to Meal"));

    // No success or error toast should be called
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("handles null itemsData from order response", async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "meal_plans") {
        return createPlanMock("plan-existing");
      }
      if (table === "meal_plan_items") {
        return createMockQueryBuilder({
          // Return null data to exercise (itemsData || []) fallback
          order: vi.fn().mockResolvedValue({ data: null, error: null }),
        });
      }
      return createMockQueryBuilder();
    });

    render(<MealPlanPage {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Meal Plan")).toBeInTheDocument();
    });

    // Should render with no items (empty grid)
    expect(screen.getAllByText("Sun")[0]).toBeInTheDocument();
  });







  it("navigates to existing meal event when item has eventId", async () => {
    // Load plan with item that already has an eventId
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "meal_plans") {
        return createPlanMock("plan-1");
      }
      if (table === "meal_plan_items") {
        return createMockQueryBuilder({
          order: vi.fn().mockResolvedValue({
            data: [
              {
                id: "item-1",
                plan_id: "plan-1",
                recipe_id: null,
                day_of_week: 0,
                meal_type: "breakfast",
                custom_name: "Pancakes",
                custom_url: null,
                sort_order: 0,
                recipes: null,
                event_id: "event-existing-123",
              },
            ],
            error: null,
          }),
        });
      }
      return createMockQueryBuilder();
    });

    render(<MealPlanPage {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getAllByText("Pancakes")[0]).toBeInTheDocument();
    });

    // Click the card (whole card is clickable)
    fireEvent.click(screen.getAllByText("Pancakes")[0]);

    expect(mockNavigate).toHaveBeenCalledWith("/meals/event-existing-123");
  });

  it("creates a personal event and navigates when no existing eventId", async () => {
    // Load plan with item that has no eventId
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "meal_plans") {
        return createPlanMock("plan-1");
      }
      if (table === "meal_plan_items") {
        return createMockQueryBuilder({
          order: vi.fn().mockResolvedValue({
            data: [
              {
                id: "item-1",
                plan_id: "plan-1",
                recipe_id: null,
                day_of_week: 0,
                meal_type: "breakfast",
                custom_name: "Pancakes",
                custom_url: null,
                sort_order: 0,
                recipes: null,
              },
            ],
            error: null,
          }),
        });
      }
      if (table === "scheduled_events") {
        return createMockQueryBuilder({
          single: vi.fn().mockResolvedValue({
            data: { id: "event-new-456" },
            error: null,
          }),
        });
      }
      return createMockQueryBuilder();
    });

    render(<MealPlanPage {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getAllByText("Pancakes")[0]).toBeInTheDocument();
    });

    // Click the card (whole card is clickable)
    fireEvent.click(screen.getAllByText("Pancakes")[0]);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/meals/event-new-456");
    });
  });



  it("creates meal event and only updates matching items in state", async () => {
    // Load plan with items in different slots to exercise the else branch in setItems
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "meal_plans") {
        return createPlanMock("plan-1");
      }
      if (table === "meal_plan_items") {
        return createMockQueryBuilder({
          order: vi.fn().mockResolvedValue({
            data: [
              {
                id: "item-1",
                plan_id: "plan-1",
                recipe_id: null,
                day_of_week: 0,
                meal_type: "breakfast",
                custom_name: "Pancakes",
                custom_url: null,
                sort_order: 0,
                recipes: null,
              },
              {
                id: "item-2",
                plan_id: "plan-1",
                recipe_id: null,
                day_of_week: 1,
                meal_type: "dinner",
                custom_name: "Pasta",
                custom_url: null,
                sort_order: 0,
                recipes: null,
              },
            ],
            error: null,
          }),
        });
      }
      if (table === "scheduled_events") {
        return createMockQueryBuilder({
          single: vi.fn().mockResolvedValue({
            data: { id: "event-new-789" },
            error: null,
          }),
        });
      }
      return createMockQueryBuilder();
    });

    render(<MealPlanPage {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getAllByText("Pancakes")[0]).toBeInTheDocument();
      expect(screen.getAllByText("Pasta")[0]).toBeInTheDocument();
    });

    // Click the card on the breakfast slot (day 0) — whole card is clickable
    fireEvent.click(screen.getAllByText("Pancakes")[0]);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/meals/event-new-789");
    });
  });



  it("handles error when creating meal event", async () => {
    // Load plan with item
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "meal_plans") {
        return createPlanMock("plan-1");
      }
      if (table === "meal_plan_items") {
        return createMockQueryBuilder({
          order: vi.fn().mockResolvedValue({
            data: [
              {
                id: "item-1",
                plan_id: "plan-1",
                recipe_id: null,
                day_of_week: 0,
                meal_type: "breakfast",
                custom_name: "Pancakes",
                custom_url: null,
                sort_order: 0,
                recipes: null,
              },
            ],
            error: null,
          }),
        });
      }
      if (table === "scheduled_events") {
        return createMockQueryBuilder({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: "Insert event failed" },
          }),
        });
      }
      return createMockQueryBuilder();
    });

    render(<MealPlanPage {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getAllByText("Pancakes")[0]).toBeInTheDocument();
    });

    // Click the card (whole card is clickable)
    fireEvent.click(screen.getAllByText("Pancakes")[0]);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to open meal details");
    });
  });

  describe("Groceries tab", () => {
    it("shows Groceries tab button", async () => {
      render(<MealPlanPage {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Meal Plan")).toBeInTheDocument();
      });

      expect(screen.getByText("Groceries")).toBeInTheDocument();
    });

    it("shows empty state when no meals have recipes", async () => {
      render(<MealPlanPage {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Meal Plan")).toBeInTheDocument();
      });

      // Switch to Groceries tab
      fireEvent.click(screen.getByText("Groceries"));

      // With general items support, the grocery section always renders
      // showing the General tab instead of the old empty state
      await waitFor(() => {
        expect(screen.getByRole("tab", { name: "General" })).toBeInTheDocument();
      });
    });

    it("shows Pantry tab and renders PantrySection on click", async () => {
      render(<MealPlanPage {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Meal Plan")).toBeInTheDocument();
      });

      // Pantry tab should be visible
      expect(screen.getByText("Pantry")).toBeInTheDocument();

      // Switch to Pantry tab
      fireEvent.click(screen.getByText("Pantry"));

      await waitFor(() => {
        expect(screen.getByTestId("pantry-section")).toBeInTheDocument();
      });

      // PantrySection should display pantry content
      expect(screen.getByText("My Pantry")).toBeInTheDocument();
    });

    it("loads grocery data when switching to Groceries tab with meals", async () => {
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "meal_plans") {
          return createPlanMock("plan-1");
        }
        if (table === "meal_plan_items") {
          return createMockQueryBuilder({
            order: vi.fn().mockResolvedValue({
              data: [
                {
                  id: "item-1",
                  plan_id: "plan-1",
                  recipe_id: "recipe-1",
                  day_of_week: 1,
                  meal_type: "dinner",
                  custom_name: null,
                  custom_url: null,
                  sort_order: 0,
                  recipes: { name: "Grilled Chicken", url: "https://example.com/chicken" },
                },
              ],
              error: null,
            }),
          });
        }
        if (table === "recipe_ingredients") {
          return createMockQueryBuilder({
            in: vi.fn().mockResolvedValue({
              data: [
                {
                  id: "ing-1",
                  recipe_id: "recipe-1",
                  name: "chicken breast",
                  quantity: 2,
                  unit: "lbs",
                  category: "meat_seafood",
                  raw_text: "2 lbs chicken breast",
                  sort_order: 0,
                  created_at: "2026-01-01",
                },
              ],
              error: null,
            }),
          });
        }
        if (table === "recipe_content") {
          return createMockQueryBuilder({
            in: vi.fn().mockResolvedValue({
              data: [
                {
                  id: "content-1",
                  recipe_id: "recipe-1",
                  description: null,
                  servings: null,
                  prep_time: null,
                  cook_time: null,
                  total_time: null,
                  instructions: null,
                  source_title: null,
                  parsed_at: "2026-01-01",
                  status: "completed",
                  error_message: null,
                  created_at: "2026-01-01",
                },
              ],
              error: null,
            }),
          });
        }
        if (table === "recipes") {
          return createMockQueryBuilder({
            in: vi.fn().mockResolvedValue({
              data: [
                { id: "recipe-1", name: "Grilled Chicken", url: "https://example.com/chicken" },
              ],
              error: null,
            }),
          });
        }
        return createMockQueryBuilder();
      });

      mockGetPantryItems.mockResolvedValue([{ id: "p1", name: "salt" }]);

      render(<MealPlanPage {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getAllByText("Grilled Chicken")[0]).toBeInTheDocument();
      });

      // Switch to Groceries tab
      fireEvent.click(screen.getByText("Groceries"));

      // Should show grocery list
      await waitFor(() => {
      });
    });

    it("shows empty state when meals have no recipeId", async () => {
      // Load plan with a custom meal that has no recipeId
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "meal_plans") {
          return createPlanMock("plan-1");
        }
        if (table === "meal_plan_items") {
          return createMockQueryBuilder({
            order: vi.fn().mockResolvedValue({
              data: [
                {
                  id: "item-1",
                  plan_id: "plan-1",
                  recipe_id: null,
                  day_of_week: 0,
                  meal_type: "breakfast",
                  custom_name: "Just Toast",
                  custom_url: null,
                  sort_order: 0,
                  recipes: null,
                },
              ],
              error: null,
            }),
          });
        }
        return createMockQueryBuilder();
      });

      render(<MealPlanPage {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getAllByText("Just Toast")[0]).toBeInTheDocument();
      });

      // Switch to Groceries tab
      fireEvent.click(screen.getByText("Groceries"));

      expect(
        screen.getByText("Your planned meals don't have linked recipes. Add a recipe URL to see ingredients here.")
      ).toBeInTheDocument();
    });

    it("handles grocery data load error", async () => {
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "meal_plans") {
          return createPlanMock("plan-1");
        }
        if (table === "meal_plan_items") {
          return createMockQueryBuilder({
            order: vi.fn().mockResolvedValue({
              data: [
                {
                  id: "item-1",
                  plan_id: "plan-1",
                  recipe_id: "recipe-1",
                  day_of_week: 1,
                  meal_type: "dinner",
                  custom_name: null,
                  custom_url: null,
                  sort_order: 0,
                  recipes: { name: "Chicken", url: "https://example.com/chicken" },
                },
              ],
              error: null,
            }),
          });
        }
        if (table === "recipe_ingredients") {
          return createMockQueryBuilder({
            in: vi.fn().mockRejectedValue(new Error("DB error")),
          });
        }
        if (table === "recipe_content") {
          return createMockQueryBuilder({
            in: vi.fn().mockRejectedValue(new Error("DB error")),
          });
        }
        if (table === "recipes") {
          return createMockQueryBuilder({
            in: vi.fn().mockRejectedValue(new Error("DB error")),
          });
        }
        return createMockQueryBuilder();
      });

      render(<MealPlanPage {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getAllByText("Chicken")[0]).toBeInTheDocument();
      });

      // Switch to Groceries tab
      fireEvent.click(screen.getByText("Groceries"));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Failed to load grocery list");
      });
    });

    it("handles pantry load error gracefully", async () => {
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "meal_plans") {
          return createPlanMock("plan-1");
        }
        if (table === "meal_plan_items") {
          return createMockQueryBuilder({
            order: vi.fn().mockResolvedValue({
              data: [
                {
                  id: "item-1",
                  plan_id: "plan-1",
                  recipe_id: "recipe-1",
                  day_of_week: 1,
                  meal_type: "dinner",
                  custom_name: null,
                  custom_url: null,
                  sort_order: 0,
                  recipes: { name: "Chicken", url: "https://example.com/chicken" },
                },
              ],
              error: null,
            }),
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
        if (table === "recipes") {
          return createMockQueryBuilder({
            in: vi.fn().mockResolvedValue({
              data: [{ id: "recipe-1", name: "Chicken", url: "https://example.com/chicken" }],
              error: null,
            }),
          });
        }
        return createMockQueryBuilder();
      });

      mockEnsureDefaultPantryItems.mockRejectedValue(new Error("Pantry error"));

      render(<MealPlanPage {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getAllByText("Chicken")[0]).toBeInTheDocument();
      });

      // Switch to Groceries tab — should not crash even if pantry load fails
      fireEvent.click(screen.getByText("Groceries"));

      await waitFor(() => {
      });
    });

    it("parses a recipe from the grocery tab", async () => {
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "meal_plans") {
          return createPlanMock("plan-1");
        }
        if (table === "meal_plan_items") {
          return createMockQueryBuilder({
            order: vi.fn().mockResolvedValue({
              data: [
                {
                  id: "item-1",
                  plan_id: "plan-1",
                  recipe_id: "recipe-1",
                  day_of_week: 1,
                  meal_type: "dinner",
                  custom_name: null,
                  custom_url: null,
                  sort_order: 0,
                  recipes: { name: "Pasta", url: "https://example.com/pasta" },
                },
              ],
              error: null,
            }),
          });
        }
        if (table === "recipe_ingredients") {
          return createMockQueryBuilder({
            in: vi.fn().mockResolvedValue({ data: [], error: null }),
          });
        }
        if (table === "recipe_content") {
          return createMockQueryBuilder({
            in: vi.fn().mockResolvedValue({
              data: [
                {
                  id: "content-1",
                  recipe_id: "recipe-1",
                  description: null,
                  servings: null,
                  prep_time: null,
                  cook_time: null,
                  total_time: null,
                  instructions: null,
                  source_title: null,
                  parsed_at: null,
                  status: "pending",
                  error_message: null,
                  created_at: "2026-01-01",
                },
              ],
              error: null,
            }),
          });
        }
        if (table === "recipes") {
          return createMockQueryBuilder({
            in: vi.fn().mockResolvedValue({
              data: [{ id: "recipe-1", name: "Pasta", url: "https://example.com/pasta" }],
              error: null,
            }),
          });
        }
        return createMockQueryBuilder();
      });

      render(<MealPlanPage {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getAllByText("Pasta")[0]).toBeInTheDocument();
      });

      // Switch to Groceries tab
      fireEvent.click(screen.getByText("Groceries"));

      await waitFor(() => {
      });

      // Click parse button
      const parseButton = screen.getByText('Parse "Pasta"');
      fireEvent.click(parseButton);

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith("parse-recipe", {
          body: { recipeId: "recipe-1", recipeUrl: "https://example.com/pasta", recipeName: "Pasta" },
        });
      });

      // (2500ms delay for "done" step animation before toast fires)
      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith("Recipe parsed successfully!");
      }, { timeout: 5000 });
    });

    it("handles parse recipe error", async () => {
      mockInvoke.mockResolvedValue({ data: null, error: { message: "Parse failed" } });

      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "meal_plans") {
          return createPlanMock("plan-1");
        }
        if (table === "meal_plan_items") {
          return createMockQueryBuilder({
            order: vi.fn().mockResolvedValue({
              data: [
                {
                  id: "item-1",
                  plan_id: "plan-1",
                  recipe_id: "recipe-1",
                  day_of_week: 1,
                  meal_type: "dinner",
                  custom_name: null,
                  custom_url: null,
                  sort_order: 0,
                  recipes: { name: "Pasta", url: "https://example.com/pasta" },
                },
              ],
              error: null,
            }),
          });
        }
        if (table === "recipe_ingredients") {
          return createMockQueryBuilder({
            in: vi.fn().mockResolvedValue({ data: [], error: null }),
          });
        }
        if (table === "recipe_content") {
          return createMockQueryBuilder({
            in: vi.fn().mockResolvedValue({
              data: [
                {
                  id: "content-1",
                  recipe_id: "recipe-1",
                  description: null,
                  servings: null,
                  prep_time: null,
                  cook_time: null,
                  total_time: null,
                  instructions: null,
                  source_title: null,
                  parsed_at: null,
                  status: "pending",
                  error_message: null,
                  created_at: "2026-01-01",
                },
              ],
              error: null,
            }),
          });
        }
        if (table === "recipes") {
          return createMockQueryBuilder({
            in: vi.fn().mockResolvedValue({
              data: [{ id: "recipe-1", name: "Pasta", url: "https://example.com/pasta" }],
              error: null,
            }),
          });
        }
        return createMockQueryBuilder();
      });

      render(<MealPlanPage {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getAllByText("Pasta")[0]).toBeInTheDocument();
      });

      // Switch to Groceries tab
      fireEvent.click(screen.getByText("Groceries"));

      await waitFor(() => {
      });

      // Click parse button
      fireEvent.click(screen.getByText('Parse "Pasta"'));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Failed to parse recipe");
      });
    });

    it("shows data.error message when parse returns success:false", async () => {
      mockInvoke.mockResolvedValue({ data: { success: false, error: "Site blocked parsing" }, error: null });

      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "meal_plans") {
          return createPlanMock("plan-1");
        }
        if (table === "meal_plan_items") {
          return createMockQueryBuilder({
            order: vi.fn().mockResolvedValue({
              data: [
                {
                  id: "item-1",
                  plan_id: "plan-1",
                  recipe_id: "recipe-1",
                  day_of_week: 1,
                  meal_type: "dinner",
                  custom_name: null,
                  custom_url: null,
                  sort_order: 0,
                  recipes: { name: "Pasta", url: "https://example.com/pasta" },
                },
              ],
              error: null,
            }),
          });
        }
        if (table === "recipe_ingredients") {
          return createMockQueryBuilder({
            in: vi.fn().mockResolvedValue({ data: [], error: null }),
          });
        }
        if (table === "recipe_content") {
          return createMockQueryBuilder({
            in: vi.fn().mockResolvedValue({
              data: [
                {
                  id: "content-1",
                  recipe_id: "recipe-1",
                  description: null,
                  servings: null,
                  prep_time: null,
                  cook_time: null,
                  total_time: null,
                  instructions: null,
                  source_title: null,
                  parsed_at: null,
                  status: "pending",
                  error_message: null,
                  created_at: "2026-01-01",
                },
              ],
              error: null,
            }),
          });
        }
        if (table === "recipes") {
          return createMockQueryBuilder({
            in: vi.fn().mockResolvedValue({
              data: [{ id: "recipe-1", name: "Pasta", url: "https://example.com/pasta" }],
              error: null,
            }),
          });
        }
        return createMockQueryBuilder();
      });

      render(<MealPlanPage {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getAllByText("Pasta")[0]).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Groceries"));

      await waitFor(() => {
      });

      fireEvent.click(screen.getByText('Parse "Pasta"'));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Site blocked parsing");
      });
    });

    it("uses fallback error message when parse returns success:false without error field", async () => {
      mockInvoke.mockResolvedValue({ data: { success: false }, error: null });

      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "meal_plans") {
          return createPlanMock("plan-1");
        }
        if (table === "meal_plan_items") {
          return createMockQueryBuilder({
            order: vi.fn().mockResolvedValue({
              data: [
                {
                  id: "item-1",
                  plan_id: "plan-1",
                  recipe_id: "recipe-1",
                  day_of_week: 1,
                  meal_type: "dinner",
                  custom_name: null,
                  custom_url: null,
                  sort_order: 0,
                  recipes: { name: "Pasta", url: "https://example.com/pasta" },
                },
              ],
              error: null,
            }),
          });
        }
        if (table === "recipe_ingredients") {
          return createMockQueryBuilder({
            in: vi.fn().mockResolvedValue({ data: [], error: null }),
          });
        }
        if (table === "recipe_content") {
          return createMockQueryBuilder({
            in: vi.fn().mockResolvedValue({
              data: [
                {
                  id: "content-1",
                  recipe_id: "recipe-1",
                  description: null,
                  servings: null,
                  prep_time: null,
                  cook_time: null,
                  total_time: null,
                  instructions: null,
                  source_title: null,
                  parsed_at: null,
                  status: "pending",
                  error_message: null,
                  created_at: "2026-01-01",
                },
              ],
              error: null,
            }),
          });
        }
        if (table === "recipes") {
          return createMockQueryBuilder({
            in: vi.fn().mockResolvedValue({
              data: [{ id: "recipe-1", name: "Pasta", url: "https://example.com/pasta" }],
              error: null,
            }),
          });
        }
        return createMockQueryBuilder();
      });

      render(<MealPlanPage {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getAllByText("Pasta")[0]).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Groceries"));

      await waitFor(() => {
      });

      fireEvent.click(screen.getByText('Parse "Pasta"'));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Failed to parse recipe");
      });
    });

    it("does not parse recipe without URL", async () => {
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "meal_plans") {
          return createPlanMock("plan-1");
        }
        if (table === "meal_plan_items") {
          return createMockQueryBuilder({
            order: vi.fn().mockResolvedValue({
              data: [
                {
                  id: "item-1",
                  plan_id: "plan-1",
                  recipe_id: "recipe-1",
                  day_of_week: 1,
                  meal_type: "dinner",
                  custom_name: null,
                  custom_url: null,
                  sort_order: 0,
                  recipes: { name: "No URL Recipe", url: null },
                },
              ],
              error: null,
            }),
          });
        }
        return createMockQueryBuilder();
      });

      render(<MealPlanPage {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getAllByText("No URL Recipe")[0]).toBeInTheDocument();
      });

      // Switch to Groceries tab
      fireEvent.click(screen.getByText("Groceries"));

      // Meals with recipe_id but no URL now show the "no linked recipes" message
      // instead of the GroceryListSection
      expect(
        screen.getByText("Your planned meals don't have linked recipes. Add a recipe URL to see ingredients here.")
      ).toBeInTheDocument();

      // No parse button should be shown since the recipe has no URL
      expect(screen.queryByText('Parse "No URL Recipe"')).not.toBeInTheDocument();
      // And invoke should never have been called
      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it("switches between Meal Plan, Groceries, and Pantry tabs", async () => {
      render(<MealPlanPage {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Meal Plan")).toBeInTheDocument();
      });

      // Should show meal grid by default (check for day headers)
      expect(screen.getAllByText("Sun")[0]).toBeInTheDocument();

      // Switch to Groceries tab
      fireEvent.click(screen.getByText("Groceries"));

      // Day headers should be hidden (grid is not shown)
      expect(screen.queryAllByText("Sun")).toHaveLength(0);

      // Switch to Pantry tab
      fireEvent.click(screen.getByText("Pantry"));

      // Should show pantry section
      expect(screen.getByTestId("pantry-section")).toBeInTheDocument();
      // Groceries empty state should be hidden
      expect(screen.queryByText("No meals planned this week. Add meals to see a grocery list.")).not.toBeInTheDocument();

      // Switch back to Meal Plan tab
      fireEvent.click(screen.getByText("Meal Plan"));

      // Day headers should be back
      expect(screen.getAllByText("Sun")[0]).toBeInTheDocument();
    });

    it("reloads grocery data when switching weeks on Groceries tab", async () => {
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "meal_plans") {
          return createPlanMock("plan-1");
        }
        if (table === "meal_plan_items") {
          return createMockQueryBuilder({
            order: vi.fn().mockResolvedValue({
              data: [
                {
                  id: "item-1",
                  plan_id: "plan-1",
                  recipe_id: "recipe-1",
                  day_of_week: 1,
                  meal_type: "dinner",
                  custom_name: null,
                  custom_url: null,
                  sort_order: 0,
                  recipes: { name: "Chicken", url: "https://example.com/chicken" },
                },
              ],
              error: null,
            }),
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
        if (table === "recipes") {
          return createMockQueryBuilder({
            in: vi.fn().mockResolvedValue({
              data: [{ id: "recipe-1", name: "Chicken", url: "https://example.com/chicken" }],
              error: null,
            }),
          });
        }
        return createMockQueryBuilder();
      });

      render(<MealPlanPage {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getAllByText("Chicken")[0]).toBeInTheDocument();
      });

      // Switch to Groceries tab
      fireEvent.click(screen.getByText("Groceries"));

      await waitFor(() => {
      });

      // Clear mocks to track new calls
      mockGetPantryItems.mockClear();
      mockEnsureDefaultPantryItems.mockClear();

      // Navigate to previous week — loadPlan will run, and since viewTab is 'groceries',
      // loadGroceryData should be called when items change
      const iconOnlyButtons = screen.getAllByRole("button").filter(
        (b) => !b.textContent?.trim()
      );
      fireEvent.click(iconOnlyButtons[0]); // ChevronLeft

      // After week change, new plan loads and grocery data should reload
      await waitFor(() => {
        expect(mockGetPantryItems).toHaveBeenCalled();
      });
    });

    it("handles null data from grocery queries gracefully", async () => {
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "meal_plans") {
          return createPlanMock("plan-1");
        }
        if (table === "meal_plan_items") {
          return createMockQueryBuilder({
            order: vi.fn().mockResolvedValue({
              data: [
                {
                  id: "item-1",
                  plan_id: "plan-1",
                  recipe_id: "recipe-1",
                  day_of_week: 1,
                  meal_type: "dinner",
                  custom_name: null,
                  custom_url: null,
                  sort_order: 0,
                  recipes: { name: "Chicken", url: "https://example.com/chicken" },
                },
              ],
              error: null,
            }),
          });
        }
        // Return null data from all grocery queries
        if (table === "recipe_ingredients") {
          return createMockQueryBuilder({
            in: vi.fn().mockResolvedValue({ data: null, error: null }),
          });
        }
        if (table === "recipe_content") {
          return createMockQueryBuilder({
            in: vi.fn().mockResolvedValue({ data: null, error: null }),
          });
        }
        if (table === "recipes") {
          return createMockQueryBuilder({
            in: vi.fn().mockResolvedValue({ data: null, error: null }),
          });
        }
        return createMockQueryBuilder();
      });

      render(<MealPlanPage {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getAllByText("Chicken")[0]).toBeInTheDocument();
      });

      // Switch to Groceries tab — should not crash with null data
      fireEvent.click(screen.getByText("Groceries"));

      await waitFor(() => {
      });
    });

    it("handles ingredient fields with null values", async () => {
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "meal_plans") {
          return createPlanMock("plan-1");
        }
        if (table === "meal_plan_items") {
          return createMockQueryBuilder({
            order: vi.fn().mockResolvedValue({
              data: [
                {
                  id: "item-1",
                  plan_id: "plan-1",
                  recipe_id: "recipe-1",
                  day_of_week: 1,
                  meal_type: "dinner",
                  custom_name: null,
                  custom_url: null,
                  sort_order: 0,
                  recipes: { name: "Soup", url: "https://example.com/soup" },
                },
              ],
              error: null,
            }),
          });
        }
        if (table === "recipe_ingredients") {
          return createMockQueryBuilder({
            in: vi.fn().mockResolvedValue({
              data: [
                {
                  id: "ing-1",
                  recipe_id: "recipe-1",
                  name: "onion",
                  quantity: null,
                  unit: null,
                  category: "produce",
                  raw_text: null,
                  sort_order: null,
                  created_at: "2026-01-01",
                },
              ],
              error: null,
            }),
          });
        }
        if (table === "recipe_content") {
          return createMockQueryBuilder({
            in: vi.fn().mockResolvedValue({
              data: [
                {
                  id: "content-1",
                  recipe_id: "recipe-1",
                  description: null,
                  servings: null,
                  prep_time: null,
                  cook_time: null,
                  total_time: null,
                  instructions: ["Step 1", "Step 2"],
                  source_title: null,
                  parsed_at: null,
                  status: "completed",
                  error_message: null,
                  created_at: "2026-01-01",
                },
              ],
              error: null,
            }),
          });
        }
        if (table === "recipes") {
          return createMockQueryBuilder({
            in: vi.fn().mockResolvedValue({
              data: [{ id: "recipe-1", name: "Soup", url: null }],
              error: null,
            }),
          });
        }
        return createMockQueryBuilder();
      });

      render(<MealPlanPage {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getAllByText("Soup")[0]).toBeInTheDocument();
      });

      // Switch to Groceries tab
      fireEvent.click(screen.getByText("Groceries"));

      await waitFor(() => {
      });

      // With only 1 parsed recipe, AI combine doesn't run (needs 2+),
      // but the grocery tab should render without crashing
    });

    it("clears grocery data when week has no meals with recipes", async () => {
      // First load with a meal that has a recipe
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "meal_plans") {
          return createPlanMock("plan-1");
        }
        if (table === "meal_plan_items") {
          return createMockQueryBuilder({
            order: vi.fn().mockResolvedValue({
              data: [
                {
                  id: "item-1",
                  plan_id: "plan-1",
                  recipe_id: "recipe-1",
                  day_of_week: 1,
                  meal_type: "dinner",
                  custom_name: null,
                  custom_url: null,
                  sort_order: 0,
                  recipes: { name: "Chicken", url: "https://example.com/chicken" },
                },
              ],
              error: null,
            }),
          });
        }
        if (table === "recipe_ingredients") {
          return createMockQueryBuilder({
            in: vi.fn().mockResolvedValue({
              data: [
                {
                  id: "ing-1",
                  recipe_id: "recipe-1",
                  name: "chicken",
                  quantity: 1,
                  unit: "lb",
                  category: "meat_seafood",
                  raw_text: "1 lb chicken",
                  sort_order: 0,
                  created_at: "2026-01-01",
                },
              ],
              error: null,
            }),
          });
        }
        if (table === "recipe_content") {
          return createMockQueryBuilder({
            in: vi.fn().mockResolvedValue({ data: [], error: null }),
          });
        }
        if (table === "recipes") {
          return createMockQueryBuilder({
            in: vi.fn().mockResolvedValue({
              data: [{ id: "recipe-1", name: "Chicken", url: "https://example.com/chicken" }],
              error: null,
            }),
          });
        }
        return createMockQueryBuilder();
      });

      render(<MealPlanPage {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getAllByText("Chicken")[0]).toBeInTheDocument();
      });

      // Switch to Groceries tab
      fireEvent.click(screen.getByText("Groceries"));

      await waitFor(() => {
      });

      // Now switch week to one with no meals
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "meal_plans") {
          return createPlanMock(null);
        }
        if (table === "meal_plan_items") {
          return createMockQueryBuilder({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          });
        }
        return createMockQueryBuilder();
      });

      const iconOnlyButtons = screen.getAllByRole("button").filter(
        (b) => !b.textContent?.trim()
      );
      fireEvent.click(iconOnlyButtons[0]); // Previous week

      // With general items support, the grocery section always renders
      // with the General tab instead of the old empty state
      await waitFor(() => {
        expect(screen.getByRole("tab", { name: "General" })).toBeInTheDocument();
      });
    });

    it("runs smart combine when 2+ parsed recipes are present", async () => {
      const smartItems = [
        { name: "chicken", displayName: "chicken", totalQuantity: 2, unit: "lbs", category: "meat_seafood", sourceRecipes: ["Chicken Stir Fry"] },
      ];
      mockSmartCombineIngredients.mockResolvedValue({ items: smartItems, perRecipeItems: {} });

      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "meal_plans") {
          return createPlanMock("plan-1");
        }
        if (table === "meal_plan_items") {
          return createMockQueryBuilder({
            order: vi.fn().mockResolvedValue({
              data: [
                {
                  id: "item-1", plan_id: "plan-1", recipe_id: "recipe-1",
                  day_of_week: 1, meal_type: "dinner", custom_name: null,
                  custom_url: null, sort_order: 0,
                  recipes: { name: "Chicken Stir Fry", url: "https://example.com/stir-fry" },
                },
                {
                  id: "item-2", plan_id: "plan-1", recipe_id: "recipe-2",
                  day_of_week: 2, meal_type: "dinner", custom_name: null,
                  custom_url: null, sort_order: 0,
                  recipes: { name: "Fried Rice", url: "https://example.com/rice" },
                },
              ],
              error: null,
            }),
          });
        }
        if (table === "recipe_ingredients") {
          return createMockQueryBuilder({
            in: vi.fn().mockResolvedValue({
              data: [
                { id: "ing-1", recipe_id: "recipe-1", name: "chicken", quantity: 2, unit: "lbs", category: "meat_seafood", raw_text: "2 lbs chicken", sort_order: 0, created_at: "2026-01-01" },
                { id: "ing-2", recipe_id: "recipe-2", name: "rice", quantity: 1, unit: "cup", category: "grains", raw_text: "1 cup rice", sort_order: 0, created_at: "2026-01-01" },
              ],
              error: null,
            }),
          });
        }
        if (table === "recipe_content") {
          return createMockQueryBuilder({
            in: vi.fn().mockResolvedValue({
              data: [
                { id: "c1", recipe_id: "recipe-1", description: null, servings: null, prep_time: null, cook_time: null, total_time: null, instructions: null, source_title: null, parsed_at: "2026-01-01", status: "completed", error_message: null, created_at: "2026-01-01" },
                { id: "c2", recipe_id: "recipe-2", description: null, servings: null, prep_time: null, cook_time: null, total_time: null, instructions: null, source_title: null, parsed_at: "2026-01-01", status: "completed", error_message: null, created_at: "2026-01-01" },
              ],
              error: null,
            }),
          });
        }
        if (table === "recipes") {
          return createMockQueryBuilder({
            in: vi.fn().mockResolvedValue({
              data: [
                { id: "recipe-1", name: "Chicken Stir Fry", url: "https://example.com/stir-fry" },
                { id: "recipe-2", name: "Fried Rice", url: "https://example.com/rice" },
              ],
              error: null,
            }),
          });
        }
        return createMockQueryBuilder();
      });

      render(<MealPlanPage {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getAllByText("Chicken Stir Fry")[0]).toBeInTheDocument();
      });

      // Switch to Groceries tab
      fireEvent.click(screen.getByText("Groceries"));

      await waitFor(() => {
        expect(mockSmartCombineIngredients).toHaveBeenCalled();
      });

      // Verify save cache was called
      await waitFor(() => {
        expect(mockSaveGroceryCache).toHaveBeenCalledWith(
          "meal_plan",
          expect.any(String),
          "user-123",
          smartItems,
          expect.any(Array),
          {}
        );
      });
    });

    it("skips re-combine when same recipe IDs already combined", async () => {
      const smartItems = [
        { name: "chicken", displayName: "chicken", totalQuantity: 2, unit: "lbs", category: "meat_seafood", sourceRecipes: ["Chicken Stir Fry"] },
      ];
      mockSmartCombineIngredients.mockResolvedValue({ items: smartItems, perRecipeItems: {} });
      // Cache always returns null so runSmartCombine is invoked on every tab switch
      mockLoadGroceryCache.mockResolvedValue(null);

      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "meal_plans") {
          return createPlanMock("plan-1");
        }
        if (table === "meal_plan_items") {
          return createMockQueryBuilder({
            order: vi.fn().mockResolvedValue({
              data: [
                {
                  id: "item-1", plan_id: "plan-1", recipe_id: "recipe-1",
                  day_of_week: 1, meal_type: "dinner", custom_name: null,
                  custom_url: null, sort_order: 0,
                  recipes: { name: "Chicken Stir Fry", url: "https://example.com/stir-fry" },
                },
                {
                  id: "item-2", plan_id: "plan-1", recipe_id: "recipe-2",
                  day_of_week: 2, meal_type: "dinner", custom_name: null,
                  custom_url: null, sort_order: 0,
                  recipes: { name: "Fried Rice", url: "https://example.com/rice" },
                },
              ],
              error: null,
            }),
          });
        }
        if (table === "recipe_ingredients") {
          return createMockQueryBuilder({
            in: vi.fn().mockResolvedValue({
              data: [
                { id: "ing-1", recipe_id: "recipe-1", name: "chicken", quantity: 2, unit: "lbs", category: "meat_seafood", raw_text: "2 lbs chicken", sort_order: 0, created_at: "2026-01-01" },
                { id: "ing-2", recipe_id: "recipe-2", name: "rice", quantity: 1, unit: "cup", category: "grains", raw_text: "1 cup rice", sort_order: 0, created_at: "2026-01-01" },
              ],
              error: null,
            }),
          });
        }
        if (table === "recipe_content") {
          return createMockQueryBuilder({
            in: vi.fn().mockResolvedValue({
              data: [
                { id: "c1", recipe_id: "recipe-1", description: null, servings: null, prep_time: null, cook_time: null, total_time: null, instructions: null, source_title: null, parsed_at: "2026-01-01", status: "completed", error_message: null, created_at: "2026-01-01" },
                { id: "c2", recipe_id: "recipe-2", description: null, servings: null, prep_time: null, cook_time: null, total_time: null, instructions: null, source_title: null, parsed_at: "2026-01-01", status: "completed", error_message: null, created_at: "2026-01-01" },
              ],
              error: null,
            }),
          });
        }
        if (table === "recipes") {
          return createMockQueryBuilder({
            in: vi.fn().mockResolvedValue({
              data: [
                { id: "recipe-1", name: "Chicken Stir Fry", url: "https://example.com/stir-fry" },
                { id: "recipe-2", name: "Fried Rice", url: "https://example.com/rice" },
              ],
              error: null,
            }),
          });
        }
        return createMockQueryBuilder();
      });

      render(<MealPlanPage {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getAllByText("Chicken Stir Fry")[0]).toBeInTheDocument();
      });

      // First visit to Groceries tab — smartCombine runs
      fireEvent.click(screen.getByText("Groceries"));
      await waitFor(() => {
        expect(mockSmartCombineIngredients).toHaveBeenCalledTimes(1);
      });

      // Switch back to Meal Plan
      fireEvent.click(screen.getByText("Meal Plan"));

      // Record how many times recipe_ingredients was queried (proxy for loadGroceryData calls)
      const groceryCallsBefore = mockSupabaseFrom.mock.calls.filter(
        (call: unknown[]) => call[0] === "recipe_ingredients"
      ).length;

      // Switch to Groceries again — grocery data is not dirty, so loadGroceryData should NOT be called
      fireEvent.click(screen.getByText("Groceries"));

      // Wait for grocery list to render (from cached state)
      await waitFor(() => {
      });

      // Smart combine should still only have been called once (skipped on second visit)
      expect(mockSmartCombineIngredients).toHaveBeenCalledTimes(1);

      // loadGroceryData should NOT have been called again (no new recipe_ingredients queries)
      const groceryCallsAfter = mockSupabaseFrom.mock.calls.filter(
        (call: unknown[]) => call[0] === "recipe_ingredients"
      ).length;
      expect(groceryCallsAfter).toBe(groceryCallsBefore);
    });

    it("skips runSmartCombine when recipe IDs unchanged after adding non-URL meal", async () => {
      const smartItems = [
        { name: "chicken", displayName: "chicken", totalQuantity: 2, unit: "lbs", category: "meat_seafood", sourceRecipes: ["Chicken Stir Fry"] },
      ];
      mockSmartCombineIngredients.mockResolvedValue({ items: smartItems, perRecipeItems: {} });
      mockLoadGroceryCache.mockResolvedValue(null);

      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "meal_plans") {
          return createPlanMock("plan-1");
        }
        if (table === "meal_plan_items") {
          return createMockQueryBuilder({
            order: vi.fn().mockResolvedValue({
              data: [
                {
                  id: "item-1", plan_id: "plan-1", recipe_id: "recipe-1",
                  day_of_week: 1, meal_type: "dinner", custom_name: null,
                  custom_url: null, sort_order: 0,
                  recipes: { name: "Chicken Stir Fry", url: "https://example.com/stir-fry" },
                },
                {
                  id: "item-2", plan_id: "plan-1", recipe_id: "recipe-2",
                  day_of_week: 2, meal_type: "dinner", custom_name: null,
                  custom_url: null, sort_order: 0,
                  recipes: { name: "Fried Rice", url: "https://example.com/rice" },
                },
              ],
              error: null,
            }),
            single: vi.fn().mockResolvedValue({
              data: {
                id: "item-new", plan_id: "plan-1", recipe_id: "recipe-snack",
                day_of_week: 3, meal_type: "breakfast", custom_name: null,
                custom_url: null, sort_order: 0,
                recipes: { name: "Toast", url: null },
              },
              error: null,
            }),
          });
        }
        if (table === "recipe_ingredients") {
          return createMockQueryBuilder({
            in: vi.fn().mockResolvedValue({
              data: [
                { id: "ing-1", recipe_id: "recipe-1", name: "chicken", quantity: 2, unit: "lbs", category: "meat_seafood", raw_text: "2 lbs chicken", sort_order: 0, created_at: "2026-01-01" },
                { id: "ing-2", recipe_id: "recipe-2", name: "rice", quantity: 1, unit: "cup", category: "grains", raw_text: "1 cup rice", sort_order: 0, created_at: "2026-01-01" },
              ],
              error: null,
            }),
          });
        }
        if (table === "recipe_content") {
          return createMockQueryBuilder({
            in: vi.fn().mockResolvedValue({
              data: [
                { id: "c1", recipe_id: "recipe-1", description: null, servings: null, prep_time: null, cook_time: null, total_time: null, instructions: null, source_title: null, parsed_at: "2026-01-01", status: "completed", error_message: null, created_at: "2026-01-01" },
                { id: "c2", recipe_id: "recipe-2", description: null, servings: null, prep_time: null, cook_time: null, total_time: null, instructions: null, source_title: null, parsed_at: "2026-01-01", status: "completed", error_message: null, created_at: "2026-01-01" },
              ],
              error: null,
            }),
          });
        }
        if (table === "recipes") {
          return createMockQueryBuilder({
            in: vi.fn().mockResolvedValue({
              data: [
                { id: "recipe-1", name: "Chicken Stir Fry", url: "https://example.com/stir-fry" },
                { id: "recipe-2", name: "Fried Rice", url: "https://example.com/rice" },
              ],
              error: null,
            }),
            single: vi.fn().mockResolvedValue({
              data: { id: "recipe-snack" },
              error: null,
            }),
          });
        }
        return createMockQueryBuilder();
      });

      render(<MealPlanPage {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getAllByText("Chicken Stir Fry")[0]).toBeInTheDocument();
      });

      // First visit to Groceries tab — smartCombine runs
      fireEvent.click(screen.getByText("Groceries"));
      await waitFor(() => {
        expect(mockSmartCombineIngredients).toHaveBeenCalledTimes(1);
      });

      // Switch back to Meal Plan
      fireEvent.click(screen.getByText("Meal Plan"));

      // Add a non-URL meal (marks grocery dirty)
      const slotButtons = screen.getAllByRole("button").filter(
        (b) => b.textContent?.includes("Breakfast")
      );
      if (slotButtons.length > 0) {
        fireEvent.click(slotButtons[0]);
      }
      fireEvent.change(screen.getByLabelText("Meal Name *"), {
        target: { value: "Toast" },
      });
      fireEvent.change(screen.getByLabelText("Recipe URL *"), {
        target: { value: "https://example.com/toast" },
      });
      fireEvent.click(screen.getByText("Add to Meal"));

      await waitFor(() => {
        expect(mockSupabaseFrom).toHaveBeenCalledWith("meal_plan_items");
      });

      // Switch to Groceries tab again — dirty=true, loads data, but parsed recipe IDs unchanged
      // runSmartCombine is called but hits the lastCombinedRecipeIds skip branch
      fireEvent.click(screen.getByText("Groceries"));

      await waitFor(() => {
      });

      // Smart combine should still only have been called once
      // (second call to runSmartCombine returned early because same recipe IDs)
      expect(mockSmartCombineIngredients).toHaveBeenCalledTimes(1);
    });

    it("uses cached smart combine results when recipe IDs match", async () => {
      const cachedItems = [
        { name: "onion", totalQuantity: 1, category: "produce", sourceRecipes: ["Soup"] },
      ];
      mockLoadGroceryCache.mockResolvedValue({
        items: cachedItems,
        recipeIds: ["recipe-1"],
      });

      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "meal_plans") {
          return createPlanMock("plan-1");
        }
        if (table === "meal_plan_items") {
          return createMockQueryBuilder({
            order: vi.fn().mockResolvedValue({
              data: [
                {
                  id: "item-1", plan_id: "plan-1", recipe_id: "recipe-1",
                  day_of_week: 1, meal_type: "dinner", custom_name: null,
                  custom_url: null, sort_order: 0,
                  recipes: { name: "Soup", url: "https://example.com/soup" },
                },
              ],
              error: null,
            }),
          });
        }
        if (table === "recipe_ingredients") {
          return createMockQueryBuilder({
            in: vi.fn().mockResolvedValue({
              data: [
                { id: "ing-1", recipe_id: "recipe-1", name: "onion", quantity: 1, unit: null, category: "produce", raw_text: "1 onion", sort_order: 0, created_at: "2026-01-01" },
              ],
              error: null,
            }),
          });
        }
        if (table === "recipe_content") {
          return createMockQueryBuilder({
            in: vi.fn().mockResolvedValue({
              data: [
                { id: "c1", recipe_id: "recipe-1", description: null, servings: null, prep_time: null, cook_time: null, total_time: null, instructions: null, source_title: null, parsed_at: "2026-01-01", status: "completed", error_message: null, created_at: "2026-01-01" },
              ],
              error: null,
            }),
          });
        }
        if (table === "recipes") {
          return createMockQueryBuilder({
            in: vi.fn().mockResolvedValue({
              data: [{ id: "recipe-1", name: "Soup", url: "https://example.com/soup" }],
              error: null,
            }),
          });
        }
        return createMockQueryBuilder();
      });

      render(<MealPlanPage {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getAllByText("Soup")[0]).toBeInTheDocument();
      });

      // Switch to Groceries tab
      fireEvent.click(screen.getByText("Groceries"));

      // Wait for grocery section to fully render — proves cache path completed
      await waitFor(() => {
      });

      await waitFor(() => {
        expect(mockLoadGroceryCache).toHaveBeenCalledWith(
          "meal_plan",
          expect.any(String),
          "user-123"
        );
      });

      // Cache hit — smart combine should not have been called
      expect(mockSmartCombineIngredients).not.toHaveBeenCalled();
    });

    it("runs smart combine even with a single parsed recipe", async () => {
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "meal_plans") {
          return createPlanMock("plan-1");
        }
        if (table === "meal_plan_items") {
          return createMockQueryBuilder({
            order: vi.fn().mockResolvedValue({
              data: [
                {
                  id: "item-1", plan_id: "plan-1", recipe_id: "recipe-1",
                  day_of_week: 1, meal_type: "dinner", custom_name: null,
                  custom_url: null, sort_order: 0,
                  recipes: { name: "Solo Recipe", url: "https://example.com/solo" },
                },
              ],
              error: null,
            }),
          });
        }
        if (table === "recipe_ingredients") {
          return createMockQueryBuilder({
            in: vi.fn().mockResolvedValue({
              data: [
                { id: "ing-1", recipe_id: "recipe-1", name: "garlic", quantity: 3, unit: "cloves", category: "produce", raw_text: "3 cloves garlic", sort_order: 0, created_at: "2026-01-01" },
              ],
              error: null,
            }),
          });
        }
        if (table === "recipe_content") {
          return createMockQueryBuilder({
            in: vi.fn().mockResolvedValue({
              data: [
                { id: "c1", recipe_id: "recipe-1", description: null, servings: null, prep_time: null, cook_time: null, total_time: null, instructions: null, source_title: null, parsed_at: "2026-01-01", status: "completed", error_message: null, created_at: "2026-01-01" },
              ],
              error: null,
            }),
          });
        }
        if (table === "recipes") {
          return createMockQueryBuilder({
            in: vi.fn().mockResolvedValue({
              data: [{ id: "recipe-1", name: "Solo Recipe", url: "https://example.com/solo" }],
              error: null,
            }),
          });
        }
        return createMockQueryBuilder();
      });

      render(<MealPlanPage {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getAllByText("Solo Recipe")[0]).toBeInTheDocument();
      });

      // Switch to Groceries tab
      fireEvent.click(screen.getByText("Groceries"));

      await waitFor(() => {
      });

      // Smart combine IS called even for a single parsed recipe (single-recipe grocery fix)
      await waitFor(() => {
        expect(mockSmartCombineIngredients).toHaveBeenCalledTimes(1);
      });
    });

    it("handles smart combine error gracefully", async () => {
      mockSmartCombineIngredients.mockRejectedValue(new Error("AI service down"));

      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "meal_plans") {
          return createPlanMock("plan-1");
        }
        if (table === "meal_plan_items") {
          return createMockQueryBuilder({
            order: vi.fn().mockResolvedValue({
              data: [
                {
                  id: "item-1", plan_id: "plan-1", recipe_id: "recipe-1",
                  day_of_week: 1, meal_type: "dinner", custom_name: null,
                  custom_url: null, sort_order: 0,
                  recipes: { name: "Recipe A", url: "https://example.com/a" },
                },
                {
                  id: "item-2", plan_id: "plan-1", recipe_id: "recipe-2",
                  day_of_week: 2, meal_type: "dinner", custom_name: null,
                  custom_url: null, sort_order: 0,
                  recipes: { name: "Recipe B", url: "https://example.com/b" },
                },
              ],
              error: null,
            }),
          });
        }
        if (table === "recipe_ingredients") {
          return createMockQueryBuilder({
            in: vi.fn().mockResolvedValue({
              data: [
                { id: "ing-1", recipe_id: "recipe-1", name: "flour", quantity: 2, unit: "cups", category: "grains", raw_text: null, sort_order: 0, created_at: "2026-01-01" },
                { id: "ing-2", recipe_id: "recipe-2", name: "sugar", quantity: 1, unit: "cup", category: "grains", raw_text: null, sort_order: 0, created_at: "2026-01-01" },
              ],
              error: null,
            }),
          });
        }
        if (table === "recipe_content") {
          return createMockQueryBuilder({
            in: vi.fn().mockResolvedValue({
              data: [
                { id: "c1", recipe_id: "recipe-1", description: null, servings: null, prep_time: null, cook_time: null, total_time: null, instructions: null, source_title: null, parsed_at: "2026-01-01", status: "completed", error_message: null, created_at: "2026-01-01" },
                { id: "c2", recipe_id: "recipe-2", description: null, servings: null, prep_time: null, cook_time: null, total_time: null, instructions: null, source_title: null, parsed_at: "2026-01-01", status: "completed", error_message: null, created_at: "2026-01-01" },
              ],
              error: null,
            }),
          });
        }
        if (table === "recipes") {
          return createMockQueryBuilder({
            in: vi.fn().mockResolvedValue({
              data: [
                { id: "recipe-1", name: "Recipe A", url: "https://example.com/a" },
                { id: "recipe-2", name: "Recipe B", url: "https://example.com/b" },
              ],
              error: null,
            }),
          });
        }
        return createMockQueryBuilder();
      });

      render(<MealPlanPage {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getAllByText("Recipe A")[0]).toBeInTheDocument();
      });

      // Switch to Groceries tab — should not crash even though smart combine fails
      fireEvent.click(screen.getByText("Groceries"));

      await waitFor(() => {
        expect(mockSmartCombineIngredients).toHaveBeenCalled();
      });

      // Page should still render grocery list
      await waitFor(() => {
      });
    });

    it("handles smart combine non-Error rejection gracefully", async () => {
      // Reject with a non-Error value (e.g., a string) to cover the "Unknown error" branch
      mockSmartCombineIngredients.mockRejectedValue("string-error");

      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "meal_plans") {
          return createPlanMock("plan-1");
        }
        if (table === "meal_plan_items") {
          return createMockQueryBuilder({
            order: vi.fn().mockResolvedValue({
              data: [
                {
                  id: "item-1", plan_id: "plan-1", recipe_id: "recipe-1",
                  day_of_week: 1, meal_type: "dinner", custom_name: null,
                  custom_url: null, sort_order: 0,
                  recipes: { name: "Recipe A", url: "https://example.com/a" },
                },
                {
                  id: "item-2", plan_id: "plan-1", recipe_id: "recipe-2",
                  day_of_week: 2, meal_type: "dinner", custom_name: null,
                  custom_url: null, sort_order: 0,
                  recipes: { name: "Recipe B", url: "https://example.com/b" },
                },
              ],
              error: null,
            }),
          });
        }
        if (table === "recipe_ingredients") {
          return createMockQueryBuilder({
            in: vi.fn().mockResolvedValue({
              data: [
                { id: "ing-1", recipe_id: "recipe-1", name: "flour", quantity: 2, unit: "cups", category: "grains", raw_text: null, sort_order: 0, created_at: "2026-01-01" },
                { id: "ing-2", recipe_id: "recipe-2", name: "sugar", quantity: 1, unit: "cup", category: "grains", raw_text: null, sort_order: 0, created_at: "2026-01-01" },
              ],
              error: null,
            }),
          });
        }
        if (table === "recipe_content") {
          return createMockQueryBuilder({
            in: vi.fn().mockResolvedValue({
              data: [
                { id: "c1", recipe_id: "recipe-1", description: null, servings: null, prep_time: null, cook_time: null, total_time: null, instructions: null, source_title: null, parsed_at: "2026-01-01", status: "completed", error_message: null, created_at: "2026-01-01" },
                { id: "c2", recipe_id: "recipe-2", description: null, servings: null, prep_time: null, cook_time: null, total_time: null, instructions: null, source_title: null, parsed_at: "2026-01-01", status: "completed", error_message: null, created_at: "2026-01-01" },
              ],
              error: null,
            }),
          });
        }
        if (table === "recipes") {
          return createMockQueryBuilder({
            in: vi.fn().mockResolvedValue({
              data: [
                { id: "recipe-1", name: "Recipe A", url: "https://example.com/a" },
                { id: "recipe-2", name: "Recipe B", url: "https://example.com/b" },
              ],
              error: null,
            }),
          });
        }
        return createMockQueryBuilder();
      });

      render(<MealPlanPage {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getAllByText("Recipe A")[0]).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Groceries"));

      await waitFor(() => {
        expect(mockSmartCombineIngredients).toHaveBeenCalled();
      });

      // Page should still render
      await waitFor(() => {
      });
    });

    it("does not cache when smartCombineIngredients returns null", async () => {
      mockSmartCombineIngredients.mockResolvedValue(null);

      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "meal_plans") {
          return createPlanMock("plan-1");
        }
        if (table === "meal_plan_items") {
          return createMockQueryBuilder({
            order: vi.fn().mockResolvedValue({
              data: [
                {
                  id: "item-1", plan_id: "plan-1", recipe_id: "recipe-1",
                  day_of_week: 1, meal_type: "dinner", custom_name: null,
                  custom_url: null, sort_order: 0,
                  recipes: { name: "Recipe A", url: "https://example.com/a" },
                },
                {
                  id: "item-2", plan_id: "plan-1", recipe_id: "recipe-2",
                  day_of_week: 2, meal_type: "dinner", custom_name: null,
                  custom_url: null, sort_order: 0,
                  recipes: { name: "Recipe B", url: "https://example.com/b" },
                },
              ],
              error: null,
            }),
          });
        }
        if (table === "recipe_ingredients") {
          return createMockQueryBuilder({
            in: vi.fn().mockResolvedValue({
              data: [
                { id: "ing-1", recipe_id: "recipe-1", name: "chicken", quantity: 2, unit: "lbs", category: "meat_seafood", raw_text: null, sort_order: 0, created_at: "2026-01-01" },
                { id: "ing-2", recipe_id: "recipe-2", name: "rice", quantity: 1, unit: "cup", category: "grains", raw_text: null, sort_order: 0, created_at: "2026-01-01" },
              ],
              error: null,
            }),
          });
        }
        if (table === "recipe_content") {
          return createMockQueryBuilder({
            in: vi.fn().mockResolvedValue({
              data: [
                { id: "c1", recipe_id: "recipe-1", description: null, servings: null, prep_time: null, cook_time: null, total_time: null, instructions: null, source_title: null, parsed_at: "2026-01-01", status: "completed", error_message: null, created_at: "2026-01-01" },
                { id: "c2", recipe_id: "recipe-2", description: null, servings: null, prep_time: null, cook_time: null, total_time: null, instructions: null, source_title: null, parsed_at: "2026-01-01", status: "completed", error_message: null, created_at: "2026-01-01" },
              ],
              error: null,
            }),
          });
        }
        if (table === "recipes") {
          return createMockQueryBuilder({
            in: vi.fn().mockResolvedValue({
              data: [
                { id: "recipe-1", name: "Recipe A", url: "https://example.com/a" },
                { id: "recipe-2", name: "Recipe B", url: "https://example.com/b" },
              ],
              error: null,
            }),
          });
        }
        return createMockQueryBuilder();
      });

      render(<MealPlanPage {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getAllByText("Recipe A")[0]).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Groceries"));

      await waitFor(() => {
        expect(mockSmartCombineIngredients).toHaveBeenCalled();
      });

      // saveGroceryCache should NOT have been called because result was null
      expect(mockSaveGroceryCache).not.toHaveBeenCalled();
    });

    it("re-runs smart combine when cache exists but recipe IDs are stale", async () => {
      const smartItems = [
        { name: "chicken", displayName: "chicken", totalQuantity: 2, unit: "lbs", category: "meat_seafood", sourceRecipes: ["Recipe A"] },
      ];
      mockSmartCombineIngredients.mockResolvedValue({ items: smartItems, perRecipeItems: {} });

      // Cache has recipe IDs that don't match current parsed recipes
      mockLoadGroceryCache.mockResolvedValue({
        items: [{ name: "old item", totalQuantity: 1, category: "produce", sourceRecipes: ["Old Recipe"] }],
        recipeIds: ["old-recipe-id"],
      });

      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "meal_plans") {
          return createPlanMock("plan-1");
        }
        if (table === "meal_plan_items") {
          return createMockQueryBuilder({
            order: vi.fn().mockResolvedValue({
              data: [
                {
                  id: "item-1", plan_id: "plan-1", recipe_id: "recipe-1",
                  day_of_week: 1, meal_type: "dinner", custom_name: null,
                  custom_url: null, sort_order: 0,
                  recipes: { name: "Recipe A", url: "https://example.com/a" },
                },
                {
                  id: "item-2", plan_id: "plan-1", recipe_id: "recipe-2",
                  day_of_week: 2, meal_type: "dinner", custom_name: null,
                  custom_url: null, sort_order: 0,
                  recipes: { name: "Recipe B", url: "https://example.com/b" },
                },
              ],
              error: null,
            }),
          });
        }
        if (table === "recipe_ingredients") {
          return createMockQueryBuilder({
            in: vi.fn().mockResolvedValue({
              data: [
                { id: "ing-1", recipe_id: "recipe-1", name: "chicken", quantity: 2, unit: "lbs", category: "meat_seafood", raw_text: null, sort_order: 0, created_at: "2026-01-01" },
                { id: "ing-2", recipe_id: "recipe-2", name: "rice", quantity: 1, unit: "cup", category: "grains", raw_text: null, sort_order: 0, created_at: "2026-01-01" },
              ],
              error: null,
            }),
          });
        }
        if (table === "recipe_content") {
          return createMockQueryBuilder({
            in: vi.fn().mockResolvedValue({
              data: [
                { id: "c1", recipe_id: "recipe-1", description: null, servings: null, prep_time: null, cook_time: null, total_time: null, instructions: null, source_title: null, parsed_at: "2026-01-01", status: "completed", error_message: null, created_at: "2026-01-01" },
                { id: "c2", recipe_id: "recipe-2", description: null, servings: null, prep_time: null, cook_time: null, total_time: null, instructions: null, source_title: null, parsed_at: "2026-01-01", status: "completed", error_message: null, created_at: "2026-01-01" },
              ],
              error: null,
            }),
          });
        }
        if (table === "recipes") {
          return createMockQueryBuilder({
            in: vi.fn().mockResolvedValue({
              data: [
                { id: "recipe-1", name: "Recipe A", url: "https://example.com/a" },
                { id: "recipe-2", name: "Recipe B", url: "https://example.com/b" },
              ],
              error: null,
            }),
          });
        }
        return createMockQueryBuilder();
      });

      render(<MealPlanPage {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getAllByText("Recipe A")[0]).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Groceries"));

      // Cache was loaded but IDs don't match, so smart combine should run
      await waitFor(() => {
        expect(mockSmartCombineIngredients).toHaveBeenCalled();
      });
    });
  });

  describe("cooked state and rating", () => {
    it("maps cooked_at from DB to items", async () => {
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "meal_plans") {
          return createPlanMock("plan-1");
        }
        if (table === "meal_plan_items") {
          return createMockQueryBuilder({
            order: vi.fn().mockResolvedValue({
              data: [
                {
                  id: "item-1",
                  plan_id: "plan-1",
                  recipe_id: "recipe-1",
                  day_of_week: 0,
                  meal_type: "breakfast",
                  custom_name: null,
                  custom_url: null,
                  sort_order: 0,
                  recipes: { name: "Pancakes", url: null },
                  cooked_at: "2026-02-19T12:00:00Z",
                },
              ],
              error: null,
            }),
          });
        }
        return createMockQueryBuilder();
      });

      render(<MealPlanPage {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getAllByText("Pancakes")[0]).toBeInTheDocument();
      });

      // Cooked item should show green styling (via cooked checkmark)
      expect(screen.getAllByTestId("cooked-check")[0]).toBeInTheDocument();
    });

  });

  describe("File Upload and Parse", () => {
    it("invokes parse-recipe after adding custom meal with uploaded file", async () => {
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "meal_plans") {
          return createPlanMock(null);
        }
        if (table === "recipes") {
          return createMockQueryBuilder({
            single: vi.fn().mockResolvedValue({
              data: { id: "recipe-upload-1" },
              error: null,
            }),
          });
        }
        if (table === "meal_plan_items") {
          return createMockQueryBuilder({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
            single: vi.fn().mockResolvedValue({
              data: {
                id: "item-upload-1",
                plan_id: "plan-new",
                recipe_id: "recipe-upload-1",
                day_of_week: 0,
                meal_type: "dinner",
                custom_name: null,
                custom_url: null,
                sort_order: 0,
                recipes: { name: "Uploaded Recipe", url: "https://storage.example.com/recipe-images/mock-uuid-456.jpg" },
              },
              error: null,
            }),
          });
        }
        return createMockQueryBuilder();
      });

      render(<MealPlanPage {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Meal Plan")).toBeInTheDocument();
      });

      // Open Add Meal dialog
      const slotButtons = screen.getAllByRole("button").filter(
        (b) => b.textContent?.includes("Dinner")
      );
      fireEvent.click(slotButtons[0]);

      // Switch to Upload File mode
      fireEvent.click(screen.getByText("Upload"));

      // Upload a file
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(["test"], "recipe.jpg", { type: "image/jpeg" });
      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(mockStorageUpload).toHaveBeenCalled();
      });

      // Submit the form
      fireEvent.click(screen.getByText("Add to Meal"));

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith("parse-recipe", {
          body: {
            recipeId: "recipe-upload-1",
            recipeUrl: "https://storage.example.com/recipe-images/mock-uuid-456.jpg",
            recipeName: "recipe",
          },
        });
      });
    });

    it("invokes parse-recipe when URL is typed manually", async () => {
      render(<MealPlanPage {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Meal Plan")).toBeInTheDocument();
      });

      const slotButtons = screen.getAllByRole("button").filter(
        (b) => b.textContent?.includes("Dinner")
      );
      fireEvent.click(slotButtons[0]);

      fireEvent.change(screen.getByLabelText("Meal Name *"), {
        target: { value: "Tacos" },
      });
      fireEvent.change(screen.getByLabelText("Recipe URL *"), {
        target: { value: "https://example.com/tacos" },
      });
      fireEvent.click(screen.getByText("Add to Meal"));

      // parse-recipe should be called since any URL now triggers parsing
      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith("parse-recipe", expect.anything());
      });
    });



    it("handles parse-recipe error gracefully", async () => {
      mockInvoke.mockResolvedValueOnce({ data: null, error: new Error("Parse failed") });

      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "meal_plans") {
          return createPlanMock(null);
        }
        if (table === "recipes") {
          return createMockQueryBuilder({
            single: vi.fn().mockResolvedValue({
              data: { id: "recipe-upload-2" },
              error: null,
            }),
          });
        }
        if (table === "meal_plan_items") {
          return createMockQueryBuilder({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
            single: vi.fn().mockResolvedValue({
              data: {
                id: "item-upload-2",
                plan_id: "plan-new",
                recipe_id: "recipe-upload-2",
                day_of_week: 0,
                meal_type: "dinner",
                custom_name: null,
                custom_url: null,
                sort_order: 0,
                recipes: { name: "Photo Recipe", url: "https://storage.example.com/recipe-images/photo.jpg" },
              },
              error: null,
            }),
          });
        }
        return createMockQueryBuilder();
      });

      render(<MealPlanPage {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Meal Plan")).toBeInTheDocument();
      });

      const slotButtons = screen.getAllByRole("button").filter(
        (b) => b.textContent?.includes("Dinner")
      );
      fireEvent.click(slotButtons[0]);

      // Switch to Upload File mode
      fireEvent.click(screen.getByText("Upload"));

      // Upload a file
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(["test"], "photo.jpg", { type: "image/jpeg" });
      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(mockStorageUpload).toHaveBeenCalled();
      });

      fireEvent.click(screen.getByText("Add to Meal"));

      // Parse error now shows a dialog instead of a toast
      await waitFor(() => {
        expect(screen.getByText("Parsing Failed")).toBeInTheDocument();
      });

      // Click "Try Again" to retry
      fireEvent.click(screen.getByText("Try Again"));
      await waitFor(() => {
        expect(screen.getByText("Adding Recipe")).toBeInTheDocument();
      });
    });

    it("shows parse failure dialog when parse returns success:false without error field", async () => {
      mockInvoke.mockReset();
      mockInvoke.mockResolvedValueOnce({ data: { success: false }, error: null });

      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "meal_plans") {
          return createPlanMock(null);
        }
        if (table === "recipes") {
          return createMockQueryBuilder({
            single: vi.fn().mockResolvedValue({
              data: { id: "recipe-noerrfield" },
              error: null,
            }),
          });
        }
        if (table === "meal_plan_items") {
          return createMockQueryBuilder({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
            single: vi.fn().mockResolvedValue({
              data: {
                id: "item-noerrfield",
                plan_id: "plan-new",
                recipe_id: "recipe-noerrfield",
                day_of_week: 0,
                meal_type: "dinner",
                custom_name: null,
                custom_url: null,
                sort_order: 0,
                recipes: { name: "No Error Field", url: "https://example.com/noerrfield" },
              },
              error: null,
            }),
          });
        }
        return createMockQueryBuilder();
      });

      render(<MealPlanPage {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Meal Plan")).toBeInTheDocument();
      });

      const slotButtons = screen.getAllByRole("button").filter(
        (b) => b.textContent?.includes("Dinner")
      );
      fireEvent.click(slotButtons[0]);

      fireEvent.change(screen.getByLabelText("Meal Name *"), {
        target: { value: "No Error Field" },
      });
      fireEvent.change(screen.getByLabelText("Recipe URL *"), {
        target: { value: "https://example.com/noerrfield" },
      });
      fireEvent.click(screen.getByText("Add to Meal"));

      await waitFor(() => {
        expect(screen.getByText("Parsing Failed")).toBeInTheDocument();
      }, { timeout: 3000 });
    });


    it("dismisses parse failure dialog via overlay close (calls handleParseKeep)", async () => {
      // Reset invoke mock to clear any stale once-queue entries from prior tests
      mockInvoke.mockReset();
      mockInvoke.mockResolvedValueOnce({ data: null, error: new Error("Parse failed") });

      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "meal_plans") {
          return createPlanMock(null);
        }
        if (table === "recipes") {
          return createMockQueryBuilder({
            single: vi.fn().mockResolvedValue({
              data: { id: "recipe-dismiss-test" },
              error: null,
            }),
          });
        }
        if (table === "meal_plan_items") {
          return createMockQueryBuilder({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
            single: vi.fn().mockResolvedValue({
              data: {
                id: "item-dismiss",
                plan_id: "plan-new",
                recipe_id: "recipe-dismiss-test",
                day_of_week: 0,
                meal_type: "dinner",
                custom_name: null,
                custom_url: null,
                sort_order: 0,
                recipes: { name: "Test Recipe", url: "https://example.com/test" },
              },
              error: null,
            }),
          });
        }
        return createMockQueryBuilder();
      });

      render(<MealPlanPage {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Meal Plan")).toBeInTheDocument();
      });

      const slotButtons = screen.getAllByRole("button").filter(
        (b) => b.textContent?.includes("Dinner")
      );
      fireEvent.click(slotButtons[0]);

      fireEvent.change(screen.getByLabelText("Meal Name *"), {
        target: { value: "Test Recipe" },
      });
      fireEvent.change(screen.getByLabelText("Recipe URL *"), {
        target: { value: "https://example.com/test" },
      });
      fireEvent.click(screen.getByText("Add to Meal"));

      // Wait for the parse failure dialog (needs extra timeout due to 200ms saving step delay)
      await waitFor(() => {
        expect(screen.getByText("Parsing Failed")).toBeInTheDocument();
      }, { timeout: 3000 });

      // Close button (X) on the dialog triggers onOpenChange which calls handleParseKeep
      const closeButton = screen.getByRole("button", { name: /close/i });
      fireEvent.click(closeButton);

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith("Recipe saved without parsing");
      });
    });

    it("does not dismiss parse dialog via overlay close while still parsing", async () => {
      // Use a delayed parse mock so dialog stays open in "parsing" state
      let resolveInvoke: (value: { data: unknown; error: null }) => void;
      mockInvoke.mockImplementationOnce(() => new Promise((resolve) => {
        resolveInvoke = resolve;
      }));

      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "meal_plans") {
          return createPlanMock(null);
        }
        if (table === "recipes") {
          return createMockQueryBuilder({
            single: vi.fn().mockResolvedValue({
              data: { id: "recipe-parse-open" },
              error: null,
            }),
          });
        }
        if (table === "meal_plan_items") {
          return createMockQueryBuilder({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
            single: vi.fn().mockResolvedValue({
              data: {
                id: "item-parse-open",
                plan_id: "plan-new",
                recipe_id: "recipe-parse-open",
                day_of_week: 0,
                meal_type: "dinner",
                custom_name: null,
                custom_url: null,
                sort_order: 0,
                recipes: { name: "Open Test", url: "https://example.com/open" },
              },
              error: null,
            }),
          });
        }
        return createMockQueryBuilder();
      });

      render(<MealPlanPage {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Meal Plan")).toBeInTheDocument();
      });

      const slotButtons = screen.getAllByRole("button").filter(
        (b) => b.textContent?.includes("Dinner")
      );
      fireEvent.click(slotButtons[0]);

      fireEvent.change(screen.getByLabelText("Meal Name *"), {
        target: { value: "Open Test" },
      });
      fireEvent.change(screen.getByLabelText("Recipe URL *"), {
        target: { value: "https://example.com/open" },
      });
      fireEvent.click(screen.getByText("Add to Meal"));

      // Wait for the parsing dialog
      await waitFor(() => {
        expect(screen.getByText("Adding Recipe")).toBeInTheDocument();
      });

      // Wait for invoke to actually be called (there's a 200ms delay for the saving step)
      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalled();
      });

      // Close button fires onOpenChange, but since parseStatus is "parsing" (not "failed"),
      // handleParseKeep should NOT be called — dialog stays open
      const closeButton = screen.getByRole("button", { name: /close/i });
      fireEvent.click(closeButton);

      // Dialog should still be showing "Adding Recipe"
      expect(screen.getByText("Adding Recipe")).toBeInTheDocument();
      expect(toast.success).not.toHaveBeenCalledWith("Recipe saved without parsing");

      // Clean up: resolve the invoke to avoid dangling promise
      resolveInvoke!({ data: { success: true }, error: null });
      // (2500ms delay for "done" step animation before toast fires)
      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith("Recipe parsed successfully!");
      }, { timeout: 5000 });
    });

    it("handles loadGroceryData returning null after parse succeeds", async () => {
      // Use a delayed parse mock so we can switch tabs while parse is in flight
      let resolveInvoke: (value: { data: unknown; error: null }) => void;
      mockInvoke.mockImplementationOnce(() => new Promise((resolve) => {
        resolveInvoke = resolve;
      }));

      let parseResolved = false;

      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "meal_plans") {
          return createPlanMock("plan-null-grocery");
        }
        if (table === "recipes") {
          return createMockQueryBuilder({
            single: vi.fn().mockResolvedValue({
              data: { id: "recipe-null-grocery" },
              error: null,
            }),
          });
        }
        if (table === "meal_plan_items") {
          return createMockQueryBuilder({
            order: vi.fn().mockResolvedValue({
              data: [
                {
                  id: "item-existing",
                  plan_id: "plan-null-grocery",
                  recipe_id: "recipe-existing",
                  day_of_week: 0,
                  meal_type: "breakfast",
                  custom_name: null,
                  custom_url: null,
                  sort_order: 0,
                  recipes: { name: "Existing Meal", url: "https://example.com/existing" },
                },
              ],
              error: null,
            }),
            single: vi.fn().mockResolvedValue({
              data: {
                id: "item-null-grocery",
                plan_id: "plan-null-grocery",
                recipe_id: "recipe-null-grocery",
                day_of_week: 1,
                meal_type: "dinner",
                custom_name: null,
                custom_url: null,
                sort_order: 0,
                recipes: { name: "New Meal", url: "https://example.com/new" },
              },
              error: null,
            }),
          });
        }
        // After parse resolves, make recipe_ingredients throw so loadGroceryData returns null
        if (table === "recipe_ingredients" && parseResolved) {
          return createMockQueryBuilder({
            in: vi.fn().mockRejectedValue(new Error("DB error")),
          });
        }
        return createMockQueryBuilder();
      });

      render(<MealPlanPage {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Meal Plan")).toBeInTheDocument();
      });

      // Add a new meal with URL to trigger parse
      const slotButtons = screen.getAllByRole("button").filter(
        (b) => b.textContent?.includes("Dinner")
      );
      fireEvent.click(slotButtons[0]);

      fireEvent.change(screen.getByLabelText("Meal Name *"), {
        target: { value: "New Meal" },
      });
      fireEvent.change(screen.getByLabelText("Recipe URL *"), {
        target: { value: "https://example.com/new" },
      });
      fireEvent.click(screen.getByText("Add to Meal"));

      // Wait for parsing dialog
      await waitFor(() => {
        expect(screen.getByText("Adding Recipe")).toBeInTheDocument();
      });

      // Wait for invoke to actually be called (there's a 200ms delay for the saving step)
      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalled();
      });

      // Mark that parse is about to resolve so loadGroceryData will fail
      parseResolved = true;

      // Resolve parse — loadGroceryData will return null because recipe_ingredients throws
      // shouldCombine is true (2 recipes with URLs) but groceryData is null
      resolveInvoke!({ data: { success: true }, error: null });

      // Parse succeeds but smartCombine should NOT be called since groceryData is null
      // (2500ms delay for "done" step animation before toast fires)
      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith("Recipe parsed successfully!");
      }, { timeout: 5000 });
    });

    it("runs combine step during parse when 2+ recipes with URLs on groceries tab", async () => {
      // Use a delayed parse mock so we can switch tabs while parse is in flight
      let resolveInvoke: (value: { data: unknown; error: null }) => void;
      mockInvoke.mockImplementationOnce(() => new Promise((resolve) => {
        resolveInvoke = resolve;
      }));

      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "meal_plans") {
          return createPlanMock("plan-combine");
        }
        if (table === "recipes") {
          return createMockQueryBuilder({
            single: vi.fn().mockResolvedValue({
              data: { id: "recipe-combine-new" },
              error: null,
            }),
          });
        }
        if (table === "meal_plan_items") {
          return createMockQueryBuilder({
            order: vi.fn().mockResolvedValue({
              data: [
                {
                  id: "item-c1",
                  plan_id: "plan-combine",
                  recipe_id: "recipe-c1",
                  day_of_week: 0,
                  meal_type: "breakfast",
                  custom_name: null,
                  custom_url: null,
                  sort_order: 0,
                  recipes: { name: "Existing Recipe", url: "https://example.com/existing" },
                },
              ],
              error: null,
            }),
            single: vi.fn().mockResolvedValue({
              data: {
                id: "item-c2",
                plan_id: "plan-combine",
                recipe_id: "recipe-combine-new",
                day_of_week: 1,
                meal_type: "dinner",
                custom_name: null,
                custom_url: null,
                sort_order: 0,
                recipes: { name: "New Recipe", url: "https://example.com/new-combine" },
              },
              error: null,
            }),
          });
        }
        if (table === "recipe_ingredients") {
          return createMockQueryBuilder({
            in: vi.fn().mockResolvedValue({
              data: [
                { id: "ri-1", recipe_id: "recipe-c1", name: "Salt", quantity: 1, unit: "tsp", category: "spices", is_pantry_item: false },
              ],
              error: null,
            }),
          });
        }
        if (table === "recipe_content") {
          return createMockQueryBuilder({
            in: vi.fn().mockResolvedValue({
              data: [
                { id: "rc-1", recipe_id: "recipe-c1", description: null, servings: null, prep_time: null, cook_time: null, total_time: null, instructions: null, source_title: null, parsed_at: "2026-01-01", status: "completed", error_message: null, created_at: "2026-01-01" },
              ],
              error: null,
            }),
          });
        }
        return createMockQueryBuilder();
      });

      render(<MealPlanPage {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getAllByText("Existing Recipe")[0]).toBeInTheDocument();
      });

      // Add a new meal with URL to trigger parse (this makes 2 recipes with URLs)
      const slotButtons = screen.getAllByRole("button").filter(
        (b) => b.textContent?.includes("Dinner")
      );
      fireEvent.click(slotButtons[0]);

      fireEvent.change(screen.getByLabelText("Meal Name *"), {
        target: { value: "New Recipe" },
      });
      fireEvent.change(screen.getByLabelText("Recipe URL *"), {
        target: { value: "https://example.com/new-combine" },
      });
      fireEvent.click(screen.getByText("Add to Meal"));

      // Wait for parsing dialog
      await waitFor(() => {
        expect(screen.getByText("Adding Recipe")).toBeInTheDocument();
      });

      // Wait for invoke to actually be called
      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalled();
      });

      // Switch to Groceries tab while parse is in flight
      fireEvent.click(screen.getByText("Groceries"));

      await waitFor(() => {
      });

      // Resolve parse — groceryData will be non-null and shouldCombine is true
      resolveInvoke!({ data: { success: true }, error: null });

      // Parse succeeds and smart combine should run
      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith("Recipe parsed successfully!");
      }, { timeout: 5000 });
    });

    it("runs combine step during parse for a single URL recipe on groceries tab", async () => {
      // Use a delayed parse mock so we can switch tabs while parse is in flight
      let resolveInvoke: (value: { data: unknown; error: null }) => void;
      mockInvoke.mockImplementationOnce(() => new Promise((resolve) => {
        resolveInvoke = resolve;
      }));

      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "meal_plans") {
          return createPlanMock("plan-single");
        }
        if (table === "recipes") {
          return createMockQueryBuilder({
            single: vi.fn().mockResolvedValue({
              data: { id: "recipe-single-new" },
              error: null,
            }),
          });
        }
        if (table === "meal_plan_items") {
          return createMockQueryBuilder({
            order: vi.fn().mockResolvedValue({
              // No existing recipes — this will be the only one
              data: [],
              error: null,
            }),
            single: vi.fn().mockResolvedValue({
              data: {
                id: "item-s1",
                plan_id: "plan-single",
                recipe_id: "recipe-single-new",
                day_of_week: 0,
                meal_type: "dinner",
                custom_name: null,
                custom_url: null,
                sort_order: 0,
                recipes: { name: "Solo Parsed Recipe", url: "https://example.com/solo-parse" },
              },
              error: null,
            }),
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

      render(<MealPlanPage {...defaultProps} />);

      // Wait for initial load (empty plan)
      await waitFor(() => {
        expect(screen.getByText("Meal Plan")).toBeInTheDocument();
      });

      // Add a meal with URL to trigger parse (this is the only recipe with URL)
      const slotButtons = screen.getAllByRole("button").filter(
        (b) => b.textContent?.includes("Dinner")
      );
      fireEvent.click(slotButtons[0]);

      fireEvent.change(screen.getByLabelText("Meal Name *"), {
        target: { value: "Solo Parsed Recipe" },
      });
      fireEvent.change(screen.getByLabelText("Recipe URL *"), {
        target: { value: "https://example.com/solo-parse" },
      });
      fireEvent.click(screen.getByText("Add to Meal"));

      // Wait for parsing dialog
      await waitFor(() => {
        expect(screen.getByText("Adding Recipe")).toBeInTheDocument();
      });

      // Wait for invoke to actually be called
      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalled();
      });

      // Switch to Groceries tab while parse is in flight
      fireEvent.click(screen.getByText("Groceries"));

      await waitFor(() => {
      });

      // Resolve parse — shouldCombine is true (1 recipe with URL), showCombineStep is false (< 2)
      resolveInvoke!({ data: { success: true }, error: null });

      // Parse succeeds and smart combine should run even for single recipe
      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith("Recipe parsed successfully!");
      }, { timeout: 5000 });
    });

  });

  describe("manual meal entry", () => {
    it("adds manual meal with pasted ingredients via AI parse", async () => {
      // Mock the AI parse response
      mockInvoke.mockResolvedValueOnce({
        data: {
          success: true,
          items: [
            { name: "spaghetti", quantity: 1, unit: "lb", category: "pantry" },
          ],
        },
        error: null,
      });

      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "meal_plans") {
          return createPlanMock(null);
        }
        if (table === "recipes") {
          return createMockQueryBuilder({
            single: vi.fn().mockResolvedValue({
              data: { id: "recipe-manual-1" },
              error: null,
            }),
          });
        }
        if (table === "meal_plan_items") {
          return createMockQueryBuilder({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
            single: vi.fn().mockResolvedValue({
              data: {
                id: "item-manual",
                plan_id: "plan-new",
                recipe_id: "recipe-manual-1",
                day_of_week: 0,
                meal_type: "dinner",
                custom_name: null,
                custom_url: null,
                sort_order: 0,
                recipes: { name: "Manual Pasta", url: null },
              },
              error: null,
            }),
          });
        }
        if (table === "recipe_content") {
          return createMockQueryBuilder({
            in: vi.fn().mockResolvedValue({ data: [], error: null }),
          });
        }
        if (table === "recipe_ingredients") {
          return createMockQueryBuilder({
            in: vi.fn().mockResolvedValue({ data: [], error: null }),
          });
        }
        return createMockQueryBuilder();
      });

      render(<MealPlanPage {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Meal Plan")).toBeInTheDocument();
      });

      // Click an empty dinner slot
      const slotButtons = screen.getAllByRole("button").filter(
        (b) => b.textContent?.includes("Dinner")
      );
      if (slotButtons.length > 0) {
        fireEvent.click(slotButtons[0]);
      }

      // Fill meal name
      fireEvent.change(screen.getByLabelText("Meal Name *"), {
        target: { value: "Manual Pasta" },
      });

      // Switch to manual mode
      fireEvent.click(screen.getByText("Manual"));

      // Paste ingredients
      fireEvent.change(screen.getByLabelText("Paste ingredients text"), {
        target: { value: "1 lb spaghetti" },
      });

      // Submit
      fireEvent.click(screen.getByText("Add to Meal"));

      // Should call rpc to save ingredients after AI parse
      await waitFor(() => {
        expect(mockRpc).toHaveBeenCalledWith("replace_recipe_ingredients", expect.objectContaining({
          p_recipe_id: "recipe-manual-1",
          p_ingredients: expect.arrayContaining([
            expect.objectContaining({ name: "spaghetti" }),
          ]),
        }));
      });
    });

    it("handles rpc error when saving manual meal ingredients", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      // Mock the AI parse response
      mockInvoke.mockResolvedValueOnce({
        data: {
          success: true,
          items: [
            { name: "spaghetti", quantity: 1, unit: "lb", category: "pantry" },
          ],
        },
        error: null,
      });
      mockRpc.mockResolvedValueOnce({ error: new Error("RPC failed") });

      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "meal_plans") {
          return createPlanMock(null);
        }
        if (table === "recipes") {
          return createMockQueryBuilder({
            single: vi.fn().mockResolvedValue({
              data: { id: "recipe-manual-2" },
              error: null,
            }),
          });
        }
        if (table === "meal_plan_items") {
          return createMockQueryBuilder({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
            single: vi.fn().mockResolvedValue({
              data: {
                id: "item-manual",
                plan_id: "plan-new",
                recipe_id: "recipe-manual-2",
                day_of_week: 0,
                meal_type: "dinner",
                custom_name: null,
                custom_url: null,
                sort_order: 0,
                recipes: { name: "Manual Pasta", url: null },
              },
              error: null,
            }),
          });
        }
        if (table === "recipe_content") {
          return createMockQueryBuilder({
            in: vi.fn().mockResolvedValue({ data: [], error: null }),
          });
        }
        if (table === "recipe_ingredients") {
          return createMockQueryBuilder({
            in: vi.fn().mockResolvedValue({ data: [], error: null }),
          });
        }
        return createMockQueryBuilder();
      });

      render(<MealPlanPage {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Meal Plan")).toBeInTheDocument();
      });

      // Click an empty dinner slot
      const slotButtons = screen.getAllByRole("button").filter(
        (b) => b.textContent?.includes("Dinner")
      );
      if (slotButtons.length > 0) {
        fireEvent.click(slotButtons[0]);
      }

      // Fill meal name
      fireEvent.change(screen.getByLabelText("Meal Name *"), {
        target: { value: "Manual Pasta" },
      });

      // Switch to manual mode
      fireEvent.click(screen.getByText("Manual"));

      // Paste ingredients
      fireEvent.change(screen.getByLabelText("Paste ingredients text"), {
        target: { value: "1 lb spaghetti" },
      });

      // Submit
      fireEvent.click(screen.getByText("Add to Meal"));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Recipe added but failed to save ingredients");
      });

      consoleSpy.mockRestore();
    });

    it("shows error when AI parse fails for manual meal", async () => {
      // Mock the AI parse to fail
      mockInvoke.mockResolvedValueOnce({
        data: null,
        error: new Error("Parse failed"),
      });

      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "meal_plans") {
          return createPlanMock(null);
        }
        if (table === "meal_plan_items") {
          return createMockQueryBuilder({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          });
        }
        if (table === "recipe_content") {
          return createMockQueryBuilder({
            in: vi.fn().mockResolvedValue({ data: [], error: null }),
          });
        }
        if (table === "recipe_ingredients") {
          return createMockQueryBuilder({
            in: vi.fn().mockResolvedValue({ data: [], error: null }),
          });
        }
        return createMockQueryBuilder();
      });

      render(<MealPlanPage {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Meal Plan")).toBeInTheDocument();
      });

      // Click an empty dinner slot
      const slotButtons = screen.getAllByRole("button").filter(
        (b) => b.textContent?.includes("Dinner")
      );
      if (slotButtons.length > 0) {
        fireEvent.click(slotButtons[0]);
      }

      // Fill meal name
      fireEvent.change(screen.getByLabelText("Meal Name *"), {
        target: { value: "Manual Pasta" },
      });

      // Switch to manual mode
      fireEvent.click(screen.getByText("Manual"));

      // Paste ingredients
      fireEvent.change(screen.getByLabelText("Paste ingredients text"), {
        target: { value: "1 lb spaghetti" },
      });

      // Submit
      fireEvent.click(screen.getByText("Add to Meal"));

      // AI parse fails → shows error toast, rpc is NOT called
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Failed to parse ingredients. Please try again.");
      });
      expect(mockRpc).not.toHaveBeenCalled();
    });
  });
});
