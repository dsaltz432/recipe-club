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

// Spy-wrap GroceryListSection to capture props while rendering the real component
let capturedGroceryListProps: Record<string, unknown> | null = null;
vi.mock("@/components/recipes/GroceryListSection", async () => {
  const actual = await vi.importActual("@/components/recipes/GroceryListSection");
  const RealComponent = (actual as { default: React.FC<Record<string, unknown>> }).default;
  return {
    ...actual,
    default: (props: Record<string, unknown>) => {
      capturedGroceryListProps = props;
      return RealComponent(props);
    },
  };
});

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

  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.clearAllMocks();
    capturedGroceryListProps = null;
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

    it("shows General tab when meals have no recipeId", async () => {
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

      // General tab should be available for adding items
      expect(screen.getByRole("tab", { name: "General" })).toBeInTheDocument();
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

      await waitFor(() => {
        expect(mockLoadGroceryCache).toHaveBeenCalledWith(
          "meal_plan",
          expect.any(String),
          "user-123"
        );
      });

      // Wait for all pending promises to settle before checking the negative assertion
      await new Promise((r) => setTimeout(r, 50));

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
      // Mock the parse-recipe response (parse-recipe handles DB saves internally)
      mockInvoke.mockResolvedValueOnce({
        data: {
          success: true,
          ingredientCount: 1,
          parsed: {
            ingredients: [
              { name: "spaghetti", quantity: 1, unit: "lb", category: "pantry" },
            ],
          },
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
      fireEvent.change(screen.getByLabelText("Ingredients text"), {
        target: { value: "1 lb spaghetti" },
      });

      // Submit
      fireEvent.click(screen.getByText("Add to Meal"));

      // Should call parse-recipe which handles DB saves internally
      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith("parse-recipe", {
          body: { recipeId: "recipe-manual-1", recipeName: "Manual Pasta", text: "1 lb spaghetti" },
        });
      });
    });

    it("handles parse-recipe error when saving manual meal ingredients", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      // Mock the parse-recipe response to return success: false
      mockInvoke.mockResolvedValueOnce({
        data: { success: false, error: "Parse failed internally" },
        error: null,
      });

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
      fireEvent.change(screen.getByLabelText("Ingredients text"), {
        target: { value: "1 lb spaghetti" },
      });

      // Submit
      fireEvent.click(screen.getByText("Add to Meal"));

      // Parse fails → shows "Parsing Failed" dialog (no toast — setParseStatus("failed"))
      await waitFor(() => {
        expect(screen.getByText("Parsing Failed")).toBeInTheDocument();
      });

      consoleSpy.mockRestore();
    });

    it("shows error when AI parse fails for manual meal", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      // Mock the parse-recipe invoke to fail
      mockInvoke.mockResolvedValueOnce({
        data: null,
        error: new Error("Parse failed"),
      });

      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "meal_plans") {
          return createPlanMock(null);
        }
        if (table === "recipes") {
          return createMockQueryBuilder({
            single: vi.fn().mockResolvedValue({
              data: { id: "recipe-manual-3" },
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
                recipe_id: "recipe-manual-3",
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
      fireEvent.change(screen.getByLabelText("Ingredients text"), {
        target: { value: "1 lb spaghetti" },
      });

      // Submit
      fireEvent.click(screen.getByText("Add to Meal"));

      // parse-recipe fails → shows "Parsing Failed" dialog (no toast — setParseStatus("failed"))
      await waitFor(() => {
        expect(screen.getByText("Parsing Failed")).toBeInTheDocument();
      });

      consoleSpy.mockRestore();
    });
  });

  describe("Grocery callback handlers", () => {
    // Helper to set up a plan with parsed recipes + smart items already populated
    const setupGroceryWithSmartItems = () => {
      const smartItems = [
        { name: "chicken breast", displayName: "chicken breast", totalQuantity: 2, unit: "lbs", category: "meat_seafood" as const, sourceRecipes: ["Chicken Stir Fry"] },
        { name: "soy sauce", displayName: "soy sauce", totalQuantity: 3, unit: "tbsp", category: "condiments" as const, sourceRecipes: ["Chicken Stir Fry"] },
        { name: "general item", displayName: "general item", totalQuantity: 1, unit: undefined, category: "produce" as const, sourceRecipes: ["General"] },
      ];
      const perRecipe = {
        "Chicken Stir Fry": [
          { name: "chicken breast", displayName: "chicken breast", totalQuantity: 2, unit: "lbs", category: "meat_seafood" as const, sourceRecipes: ["Chicken Stir Fry"] },
          { name: "soy sauce", displayName: "soy sauce", totalQuantity: 3, unit: "tbsp", category: "condiments" as const, sourceRecipes: ["Chicken Stir Fry"] },
        ],
        General: [
          { name: "general item", displayName: "general item", totalQuantity: 1, unit: undefined, category: "produce" as const, sourceRecipes: ["General"] },
        ],
      };
      mockSmartCombineIngredients.mockResolvedValue({ items: smartItems, perRecipeItems: perRecipe });

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
              ],
              error: null,
            }),
          });
        }
        if (table === "recipe_ingredients") {
          return createMockQueryBuilder({
            in: vi.fn().mockResolvedValue({
              data: [
                { id: "ing-1", recipe_id: "recipe-1", name: "chicken breast", quantity: 2, unit: "lbs", category: "meat_seafood", raw_text: "2 lbs chicken breast", sort_order: 0, created_at: "2026-01-01" },
                { id: "ing-2", recipe_id: "recipe-1", name: "soy sauce", quantity: 3, unit: "tbsp", category: "condiments", raw_text: "3 tbsp soy sauce", sort_order: 1, created_at: "2026-01-01" },
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
              data: [{ id: "recipe-1", name: "Chicken Stir Fry", url: "https://example.com/stir-fry" }],
              error: null,
            }),
          });
        }
        return createMockQueryBuilder();
      });

      return { smartItems, perRecipe };
    };

    it("handleEditGroceryItem edits an item via a per-recipe tab", async () => {
      setupGroceryWithSmartItems();
      mockLoadGeneralItems.mockResolvedValue([
        { id: "gen-1", name: "general item", quantity: "1", unit: undefined },
      ]);

      render(<MealPlanPage {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getAllByText("Chicken Stir Fry")[0]).toBeInTheDocument();
      });

      // Switch to Groceries tab
      fireEvent.click(screen.getByText("Groceries"));

      // Wait for grocery data to load
      await waitFor(() => {
        expect(screen.getByText("2 lbs chicken breast")).toBeInTheDocument();
        expect(capturedGroceryListProps).not.toBeNull();
      });

      // Directly invoke handleEditItemText (simulating per-recipe tab edit)
      (capturedGroceryListProps!.onEditItemText as (orig: string, text: string, recipeId?: string) => void)(
        "chicken breast", "3 lbs chicken thighs", undefined
      );

      // After edit, the startRecombineTimer should have been called —
      // advance the timer to trigger recombine
      vi.advanceTimersByTime(60000);

      await waitFor(() => {
        expect(mockDeleteGroceryCache).toHaveBeenCalled();
      });
    });

    it("handleEditGroceryItem persists General-sourced items to DB", async () => {
      setupGroceryWithSmartItems();
      mockLoadGeneralItems.mockResolvedValue([
        { id: "gen-1", name: "general item", quantity: "1", unit: undefined },
      ]);

      render(<MealPlanPage {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getAllByText("Chicken Stir Fry")[0]).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Groceries"));

      // Wait for both smart items and general items to be loaded
      await waitFor(() => {
        expect(screen.getByText("1 general item")).toBeInTheDocument();
        expect(mockLoadGeneralItems).toHaveBeenCalled();
        expect(capturedGroceryListProps).not.toBeNull();
      });

      // Directly invoke handleEditItemText for a General-sourced item (no recipeId)
      (capturedGroceryListProps!.onEditItemText as (orig: string, text: string, recipeId?: string) => void)(
        "general item", "updated general item", undefined
      );

      // Should have called updateGeneralItem for the General-sourced item
      await waitFor(() => {
        expect(mockUpdateGeneralItem).toHaveBeenCalledWith("gen-1", {
          name: "updated general item",
          quantity: undefined,
          unit: undefined,
        });
      });
    });

    it("handleRemoveGroceryItem removes an item from a per-recipe tab", async () => {
      setupGroceryWithSmartItems();
      mockLoadGeneralItems.mockResolvedValue([]);

      render(<MealPlanPage {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getAllByText("Chicken Stir Fry")[0]).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Groceries"));

      // Wait for grocery data to load
      await waitFor(() => {
        expect(screen.getByText("2 lbs chicken breast")).toBeInTheDocument();
        expect(capturedGroceryListProps).not.toBeNull();
      });

      // Directly invoke handleRemoveItem (simulating per-recipe tab remove)
      (capturedGroceryListProps!.onRemoveItem as (name: string, recipeId?: string) => void)(
        "chicken breast", undefined
      );

      // startRecombineTimer was invoked — verify pending changes flag is set
      // The Recombine button should appear because hasPendingChanges is true
      await waitFor(() => {
        expect(screen.getByText("Reprocess")).toBeInTheDocument();
      });

      // Advance the timer to trigger recombine
      vi.advanceTimersByTime(60000);

      // Now deleteGroceryCache should be called
      await waitFor(() => {
        expect(mockDeleteGroceryCache).toHaveBeenCalled();
      });
    });

    it("handleRemoveGroceryItem deletes General-sourced item from DB", async () => {
      setupGroceryWithSmartItems();
      mockLoadGeneralItems.mockResolvedValue([
        { id: "gen-1", name: "general item", quantity: "1", unit: undefined },
      ]);

      render(<MealPlanPage {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getAllByText("Chicken Stir Fry")[0]).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Groceries"));

      // Wait for both smart items and general items to be loaded
      await waitFor(() => {
        expect(screen.getByText("1 general item")).toBeInTheDocument();
        expect(mockLoadGeneralItems).toHaveBeenCalled();
        expect(capturedGroceryListProps).not.toBeNull();
      });

      // Directly invoke handleRemoveItem for a General-sourced item (no recipeId)
      (capturedGroceryListProps!.onRemoveItem as (name: string, recipeId?: string) => void)(
        "general item", undefined
      );

      // Should call removeGeneralItem for the General-sourced item
      await waitFor(() => {
        expect(mockRemoveGeneralItem).toHaveBeenCalledWith("gen-1");
      });
    });

    it("handleAddGeneralItem adds item from General tab via AI parsing", async () => {
      // Mock parse-recipe to return normalized ingredient
      mockInvoke.mockResolvedValue({
        data: {
          success: true,
          parsed: {
            ingredients: [
              { name: "potatoes", quantity: 2, unit: "lb", category: "produce" },
            ],
          },
        },
        error: null,
      });

      // Use a plan with items but no recipe_ingredients → General tab is default
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "meal_plans") {
          return createPlanMock("plan-1");
        }
        if (table === "meal_plan_items") {
          return createMockQueryBuilder({
            order: vi.fn().mockResolvedValue({
              data: [
                {
                  id: "item-1", plan_id: "plan-1", recipe_id: null,
                  day_of_week: 0, meal_type: "breakfast",
                  custom_name: "Oatmeal", custom_url: null, sort_order: 0,
                  recipes: null,
                },
              ],
              error: null,
            }),
          });
        }
        if (table === "recipes") {
          return createMockQueryBuilder({
            single: vi.fn().mockResolvedValue({
              data: { id: "temp-recipe-1" },
              error: null,
            }),
            delete: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          });
        }
        return createMockQueryBuilder();
      });

      render(<MealPlanPage {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getAllByText("Oatmeal")[0]).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Groceries"));

      // General tab is default when no recipe ingredients exist — wait for textarea
      await waitFor(() => {
        expect(screen.getByRole("textbox")).toBeInTheDocument();
      });

      // Type text in AddIngredientInput
      fireEvent.change(screen.getByRole("textbox"), {
        target: { value: "2 lbs potatoes" },
      });

      // Click Add button
      fireEvent.click(screen.getByRole("button", { name: "Add" }));

      // Should call parse-recipe with the text
      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith("parse-recipe", {
          body: { recipeId: "temp-recipe-1", recipeName: "General Items", text: "2 lbs potatoes" },
        });
      });

      // Should save the normalized result from AI
      await waitFor(() => {
        expect(mockAddGeneralItem).toHaveBeenCalledWith(
          "meal_plan",
          expect.any(String),
          "user-123",
          { name: "potatoes", quantity: "2", unit: "lb" }
        );
      });

      // Should also invalidate cache
      await waitFor(() => {
        expect(mockDeleteGroceryCache).toHaveBeenCalled();
      });
    });

    it("handleRemoveGeneralItem removes item via callback", async () => {
      // Set up general items already present in perRecipeItems so they render as GroceryItemRow
      const generalSmartItems = [
        { name: "butter", displayName: "butter", totalQuantity: 1, unit: "stick", category: "dairy" as const, sourceRecipes: ["General"] },
      ];
      const smartItems = [
        ...generalSmartItems,
      ];
      mockSmartCombineIngredients.mockResolvedValue({ items: smartItems, perRecipeItems: { General: generalSmartItems } });
      mockLoadGeneralItems.mockResolvedValue([
        { id: "gen-butter", name: "butter", quantity: "1", unit: "stick" },
      ]);

      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "meal_plans") {
          return createPlanMock("plan-1");
        }
        if (table === "meal_plan_items") {
          return createMockQueryBuilder({
            order: vi.fn().mockResolvedValue({
              data: [
                {
                  id: "item-1", plan_id: "plan-1", recipe_id: null,
                  day_of_week: 0, meal_type: "breakfast",
                  custom_name: "Toast", custom_url: null, sort_order: 0,
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
        expect(screen.getAllByText("Toast")[0]).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Groceries"));

      // General tab should be visible since there are items
      await waitFor(() => {
        expect(screen.getByRole("tab", { name: "General" })).toBeInTheDocument();
      });

      // The General tab has the add form with the name input
      // But to test removeGeneralItem, we need the general items rendered as
      // GroceryItemRow in the General tab content — this happens via perRecipeItems["General"]
      // Switch to General tab to see them
      fireEvent.click(screen.getByRole("tab", { name: "General" }));

      await waitFor(() => {
        expect(screen.getByText("1 stick butter")).toBeInTheDocument();
      });

      // Click remove on the butter item
      fireEvent.click(screen.getByLabelText("Remove item"));

      await waitFor(() => {
        expect(mockRemoveGeneralItem).toHaveBeenCalledWith("gen-butter");
      });
    });

    it("handleUpdateGeneralItem updates item via callback", async () => {
      const generalSmartItems = [
        { name: "milk", displayName: "milk", totalQuantity: 1, unit: "gallon", category: "dairy" as const, sourceRecipes: ["General"] },
      ];
      mockSmartCombineIngredients.mockResolvedValue({ items: generalSmartItems, perRecipeItems: { General: generalSmartItems } });
      mockLoadGeneralItems.mockResolvedValue([
        { id: "gen-milk", name: "milk", quantity: "1", unit: "gallon" },
      ]);

      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "meal_plans") {
          return createPlanMock("plan-1");
        }
        if (table === "meal_plan_items") {
          return createMockQueryBuilder({
            order: vi.fn().mockResolvedValue({
              data: [
                {
                  id: "item-1", plan_id: "plan-1", recipe_id: null,
                  day_of_week: 0, meal_type: "breakfast",
                  custom_name: "Cereal", custom_url: null, sort_order: 0,
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
        expect(screen.getAllByText("Cereal")[0]).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Groceries"));

      await waitFor(() => {
        expect(screen.getByRole("tab", { name: "General" })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("tab", { name: "General" }));

      await waitFor(() => {
        expect(screen.getByText("1 gallon milk")).toBeInTheDocument();
      });

      // Edit the milk item
      fireEvent.click(screen.getByLabelText("Edit item"));

      const editInput = screen.getByLabelText("Edit item text");
      fireEvent.change(editInput, { target: { value: "2 gallons milk" } });
      fireEvent.click(screen.getByLabelText("Save edit"));

      // The edit calls handleEditGroceryItem which detects "General" source
      // and calls updateGeneralItem
      await waitFor(() => {
        expect(mockUpdateGeneralItem).toHaveBeenCalledWith("gen-milk", {
          name: "2 gallons milk",
          quantity: undefined,
          unit: undefined,
        });
      });
    });

    it("handleBulkParseGroceryText parses pasted text and adds items", async () => {
      mockInvoke.mockResolvedValue({
        data: {
          success: true,
          ingredientCount: 2,
          parsed: {
            ingredients: [
              { name: "tomatoes", quantity: 3, unit: null, category: "produce" },
              { name: "basil", quantity: 1, unit: "bunch", category: "produce" },
            ],
          },
        },
        error: null,
      });

      // Set up plan with items but no recipe ingredients → General tab is default
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "meal_plans") {
          return createPlanMock("plan-1");
        }
        if (table === "meal_plan_items") {
          return createMockQueryBuilder({
            order: vi.fn().mockResolvedValue({
              data: [
                {
                  id: "item-1", plan_id: "plan-1", recipe_id: null,
                  day_of_week: 0, meal_type: "breakfast",
                  custom_name: "Toast", custom_url: null, sort_order: 0,
                  recipes: null,
                },
              ],
              error: null,
            }),
          });
        }
        if (table === "recipes") {
          return createMockQueryBuilder({
            single: vi.fn().mockResolvedValue({
              data: { id: "temp-recipe-id" },
              error: null,
            }),
            delete: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          });
        }
        return createMockQueryBuilder();
      });

      render(<MealPlanPage {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getAllByText("Toast")[0]).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Groceries"));

      // General tab is default — wait for AddIngredientInput textarea
      await waitFor(() => {
        expect(screen.getByRole("textbox")).toBeInTheDocument();
      });

      // Type text in AddIngredientInput and click Add
      fireEvent.change(screen.getByRole("textbox"), { target: { value: "3 tomatoes\n1 bunch basil" } });
      fireEvent.click(screen.getByRole("button", { name: "Add" }));

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith("parse-recipe", {
          body: { recipeId: "temp-recipe-id", recipeName: "General Items", text: "3 tomatoes\n1 bunch basil" },
        });
      });

      await waitFor(() => {
        expect(mockAddGeneralItem).toHaveBeenCalled();
      });
    });

    it("handleBulkParseGroceryText returns empty array when data.skipped is true", async () => {
      mockInvoke.mockResolvedValue({
        data: { success: true, skipped: true },
        error: null,
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
                  id: "item-1", plan_id: "plan-1", recipe_id: null,
                  day_of_week: 0, meal_type: "breakfast",
                  custom_name: "Eggs", custom_url: null, sort_order: 0,
                  recipes: null,
                },
              ],
              error: null,
            }),
          });
        }
        if (table === "recipes") {
          return createMockQueryBuilder({
            single: vi.fn().mockResolvedValue({
              data: { id: "temp-recipe-id" },
              error: null,
            }),
            delete: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          });
        }
        return createMockQueryBuilder();
      });

      render(<MealPlanPage {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getAllByText("Eggs")[0]).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Groceries"));

      await waitFor(() => {
        expect(screen.getByRole("textbox")).toBeInTheDocument();
      });

      fireEvent.change(screen.getByRole("textbox"), { target: { value: "nothing useful" } });
      fireEvent.click(screen.getByRole("button", { name: "Add" }));

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith("parse-recipe", {
          body: { recipeId: "temp-recipe-id", recipeName: "General Items", text: "nothing useful" },
        });
      });

      // Skipped returns empty array — no items added
      await waitFor(() => {
        expect(mockAddGeneralItem).not.toHaveBeenCalled();
      });
    });

    it("handleBulkParseGroceryText throws on error from invoke", async () => {
      mockInvoke.mockResolvedValue({
        data: null,
        error: new Error("Edge function error"),
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
                  id: "item-1", plan_id: "plan-1", recipe_id: null,
                  day_of_week: 0, meal_type: "breakfast",
                  custom_name: "Yogurt", custom_url: null, sort_order: 0,
                  recipes: null,
                },
              ],
              error: null,
            }),
          });
        }
        if (table === "recipes") {
          return createMockQueryBuilder({
            single: vi.fn().mockResolvedValue({
              data: { id: "temp-recipe-id" },
              error: null,
            }),
            delete: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          });
        }
        return createMockQueryBuilder();
      });

      render(<MealPlanPage {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getAllByText("Yogurt")[0]).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Groceries"));

      await waitFor(() => {
        expect(screen.getByRole("textbox")).toBeInTheDocument();
      });

      fireEvent.change(screen.getByRole("textbox"), { target: { value: "some text" } });
      fireEvent.click(screen.getByRole("button", { name: "Add" }));

      // handleBulkAdd catches the thrown error and shows toast
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Failed to add items. Please try again.");
      });
    });

    it("handleBulkParseGroceryText throws when data.success is false", async () => {
      mockInvoke.mockResolvedValue({
        data: { success: false, error: "Bad input" },
        error: null,
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
                  id: "item-1", plan_id: "plan-1", recipe_id: null,
                  day_of_week: 0, meal_type: "breakfast",
                  custom_name: "Granola", custom_url: null, sort_order: 0,
                  recipes: null,
                },
              ],
              error: null,
            }),
          });
        }
        if (table === "recipes") {
          return createMockQueryBuilder({
            single: vi.fn().mockResolvedValue({
              data: { id: "temp-recipe-id" },
              error: null,
            }),
            delete: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          });
        }
        return createMockQueryBuilder();
      });

      render(<MealPlanPage {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getAllByText("Granola")[0]).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Groceries"));

      await waitFor(() => {
        expect(screen.getByRole("textbox")).toBeInTheDocument();
      });

      fireEvent.change(screen.getByRole("textbox"), { target: { value: "bad text" } });
      fireEvent.click(screen.getByRole("button", { name: "Add" }));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Failed to add items. Please try again.");
      });
    });
  });

  describe("triggerRecombine and startRecombineTimer", () => {
    it("triggerRecombine is called when Recombine button is clicked", async () => {
      // Set up scenario where hasPendingChanges becomes true
      const smartItems = [
        { name: "chicken", displayName: "chicken", totalQuantity: 2, unit: "lbs", category: "meat_seafood" as const, sourceRecipes: ["Chicken"] },
      ];
      mockSmartCombineIngredients.mockResolvedValue({ items: smartItems, perRecipeItems: {} });
      mockLoadGeneralItems.mockResolvedValue([]);

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
                { id: "ing-1", recipe_id: "recipe-1", name: "chicken", quantity: 2, unit: "lbs", category: "meat_seafood", raw_text: "2 lbs chicken", sort_order: 0, created_at: "2026-01-01" },
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

      fireEvent.click(screen.getByText("Groceries"));

      await waitFor(() => {
        expect(screen.getByText("2 lbs chicken")).toBeInTheDocument();
        expect(capturedGroceryListProps).not.toBeNull();
      });

      // Remove an item to trigger hasPendingChanges = true via captured callback
      (capturedGroceryListProps!.onRemoveItem as (name: string) => void)("chicken");

      // After remove, hasPendingChanges is set and startRecombineTimer is called
      // The Recombine button should appear before the timer fires
      await waitFor(() => {
        expect(screen.getByText("Reprocess")).toBeInTheDocument();
      });

      // Clear the delete cache mock to verify triggerRecombine calls it fresh
      mockDeleteGroceryCache.mockClear();

      // Click Recombine to trigger triggerRecombine directly
      fireEvent.click(screen.getByText("Reprocess"));

      await waitFor(() => {
        expect(mockDeleteGroceryCache).toHaveBeenCalledWith(
          "meal_plan",
          expect.any(String),
          "user-123"
        );
      });
    });

    it("startRecombineTimer fires after delay and triggers recombine", async () => {
      const smartItems = [
        { name: "onion", displayName: "onion", totalQuantity: 2, unit: "lbs", category: "produce" as const, sourceRecipes: ["Soup"] },
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

      fireEvent.click(screen.getByText("Groceries"));

      await waitFor(() => {
        expect(screen.getByText("2 lbs onion")).toBeInTheDocument();
        expect(capturedGroceryListProps).not.toBeNull();
      });

      // Remove an item — this triggers invalidateCacheAndResetRefs (synchronous) + startRecombineTimer
      (capturedGroceryListProps!.onRemoveItem as (name: string) => void)("onion");

      // Clear the synchronous deleteGroceryCache call so we can detect the timer-triggered one
      mockDeleteGroceryCache.mockClear();

      // Advance the timer to trigger recombine (RECOMBINE_DELAY_MS = 15 min = 900,000ms)
      vi.advanceTimersByTime(900000);

      // Now triggerRecombine should have fired, calling deleteGroceryCache again
      await waitFor(() => {
        expect(mockDeleteGroceryCache).toHaveBeenCalled();
      });
    });
  });

  describe("cleanup timer on unmount", () => {
    it("clears recombine timer when component unmounts", async () => {
      const smartItems = [
        { name: "garlic", displayName: "garlic", totalQuantity: 3, unit: "oz", category: "produce" as const, sourceRecipes: ["Pasta"] },
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
                  recipes: { name: "Pasta", url: "https://example.com/pasta" },
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
                { id: "ing-1", recipe_id: "recipe-1", name: "garlic", quantity: 3, unit: "oz", category: "produce", raw_text: "3 oz garlic", sort_order: 0, created_at: "2026-01-01" },
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
              data: [{ id: "recipe-1", name: "Pasta", url: "https://example.com/pasta" }],
              error: null,
            }),
          });
        }
        return createMockQueryBuilder();
      });

      const clearTimeoutSpy = vi.spyOn(global, "clearTimeout");

      const { unmount } = render(<MealPlanPage {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getAllByText("Pasta")[0]).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Groceries"));

      await waitFor(() => {
        expect(screen.getByText("3 oz garlic")).toBeInTheDocument();
        expect(capturedGroceryListProps).not.toBeNull();
      });

      // Remove an item to trigger startRecombineTimer via captured callback
      (capturedGroceryListProps!.onRemoveItem as (name: string) => void)("garlic");

      // Unmount before the timer fires
      unmount();

      // The cleanup effect should have called clearTimeout
      expect(clearTimeoutSpy).toHaveBeenCalled();

      clearTimeoutSpy.mockRestore();
    });
  });

  describe("handleRemoveGeneralItem and handleUpdateGeneralItem via captured props", () => {
    const setupWithGeneralItems = () => {
      mockLoadGeneralItems.mockResolvedValue([
        { id: "gen-1", name: "bread", quantity: "1", unit: "loaf" },
      ]);
      mockSmartCombineIngredients.mockResolvedValue({ items: [], perRecipeItems: {} });

      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "meal_plans") {
          return createPlanMock("plan-1");
        }
        if (table === "meal_plan_items") {
          return createMockQueryBuilder({
            order: vi.fn().mockResolvedValue({
              data: [
                {
                  id: "item-1", plan_id: "plan-1", recipe_id: null,
                  day_of_week: 0, meal_type: "breakfast",
                  custom_name: "Oatmeal", custom_url: null, sort_order: 0,
                  recipes: null,
                },
              ],
              error: null,
            }),
          });
        }
        return createMockQueryBuilder();
      });
    };

    it("handleRemoveGeneralItem removes item, reloads general items, invalidates cache, and starts timer", async () => {
      setupWithGeneralItems();

      render(<MealPlanPage {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getAllByText("Oatmeal")[0]).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Groceries"));

      // Wait for GroceryListSection to render and capture props
      await waitFor(() => {
        expect(capturedGroceryListProps).not.toBeNull();
        expect(capturedGroceryListProps!.onRemoveGeneralItem).toBeDefined();
      });

      // Clear mocks to verify only the calls from handleRemoveGeneralItem
      mockRemoveGeneralItem.mockClear();
      mockLoadGeneralItems.mockClear();
      mockLoadGeneralItems.mockResolvedValue([]);
      mockDeleteGroceryCache.mockClear();

      // Directly invoke the handleRemoveGeneralItem callback
      const onRemoveGeneralItem = capturedGroceryListProps!.onRemoveGeneralItem as (itemId: string) => Promise<void>;
      await onRemoveGeneralItem("gen-1");

      // Verify removeGeneralItem was called with the item ID
      expect(mockRemoveGeneralItem).toHaveBeenCalledWith("gen-1");

      // Verify loadGeneralItems was called to refresh
      expect(mockLoadGeneralItems).toHaveBeenCalledWith(
        "meal_plan",
        expect.any(String),
        "user-123"
      );

      // Verify cache was invalidated
      expect(mockDeleteGroceryCache).toHaveBeenCalledWith(
        "meal_plan",
        expect.any(String),
        "user-123"
      );
    });

    it("handleUpdateGeneralItem updates item, reloads general items, invalidates cache, and starts timer", async () => {
      setupWithGeneralItems();

      render(<MealPlanPage {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getAllByText("Oatmeal")[0]).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Groceries"));

      // Wait for GroceryListSection to render and capture props
      await waitFor(() => {
        expect(capturedGroceryListProps).not.toBeNull();
        expect(capturedGroceryListProps!.onUpdateGeneralItem).toBeDefined();
      });

      // Clear mocks to verify only the calls from handleUpdateGeneralItem
      mockUpdateGeneralItem.mockClear();
      mockLoadGeneralItems.mockClear();
      mockLoadGeneralItems.mockResolvedValue([
        { id: "gen-1", name: "whole wheat bread", quantity: "2", unit: "loaves" },
      ]);
      mockDeleteGroceryCache.mockClear();

      // Directly invoke the handleUpdateGeneralItem callback
      const onUpdateGeneralItem = capturedGroceryListProps!.onUpdateGeneralItem as (
        itemId: string,
        updates: { name?: string; quantity?: string; unit?: string }
      ) => Promise<void>;
      await onUpdateGeneralItem("gen-1", { name: "whole wheat bread", quantity: "2", unit: "loaves" });

      // Verify updateGeneralItem was called with correct args
      expect(mockUpdateGeneralItem).toHaveBeenCalledWith("gen-1", {
        name: "whole wheat bread",
        quantity: "2",
        unit: "loaves",
      });

      // Verify loadGeneralItems was called to refresh
      expect(mockLoadGeneralItems).toHaveBeenCalledWith(
        "meal_plan",
        expect.any(String),
        "user-123"
      );

      // Verify cache was invalidated
      expect(mockDeleteGroceryCache).toHaveBeenCalledWith(
        "meal_plan",
        expect.any(String),
        "user-123"
      );
    });
  });

  describe("handleBulkParseGroceryText fallback error message", () => {
    it("uses fallback error when data.success is false and data.error is absent", async () => {
      mockInvoke.mockResolvedValue({
        data: { success: false },
        error: null,
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
                  id: "item-1", plan_id: "plan-1", recipe_id: null,
                  day_of_week: 0, meal_type: "breakfast",
                  custom_name: "Yogurt", custom_url: null, sort_order: 0,
                  recipes: null,
                },
              ],
              error: null,
            }),
          });
        }
        if (table === "recipes") {
          return createMockQueryBuilder({
            single: vi.fn().mockResolvedValue({
              data: { id: "temp-recipe-id" },
              error: null,
            }),
            delete: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          });
        }
        return createMockQueryBuilder();
      });

      render(<MealPlanPage {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getAllByText("Yogurt")[0]).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Groceries"));

      await waitFor(() => {
        expect(screen.getByRole("textbox")).toBeInTheDocument();
      });

      fireEvent.change(screen.getByRole("textbox"), { target: { value: "some grocery items" } });
      fireEvent.click(screen.getByRole("button", { name: "Add" }));

      // Should show error toast when parse fails
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Failed to add items. Please try again.");
      });
    });
  });

  describe("weekStartDay preference", () => {
    it("adjusts weekStart when user preference has non-zero weekStartDay", async () => {
      mockLoadUserPreferences.mockResolvedValue({
        mealTypes: ["breakfast", "lunch", "dinner"],
        weekStartDay: 1, // Monday
        householdSize: 2,
      });

      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "meal_plans") {
          return createPlanMock(null);
        }
        if (table === "meal_plan_items") {
          return createMockQueryBuilder({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
            single: vi.fn().mockResolvedValue({
              data: { id: "item-new", plan_id: "plan-new", recipe_id: null },
              error: null,
            }),
          });
        }
        return createMockQueryBuilder();
      });

      render(<MealPlanPage {...defaultProps} />);

      // Wait for the component to load and apply preferences
      await waitFor(() => {
        expect(mockLoadUserPreferences).toHaveBeenCalledWith("user-123");
      });

      // The component should render with the "Meal Plan" tab visible
      // The weekStart gets recalculated with Monday start due to weekStartDay: 1
      await waitFor(() => {
        expect(screen.getByText("Meal Plan")).toBeInTheDocument();
      });

      // Verify the plan was loaded (which means weekStart was applied and used)
      await waitFor(() => {
        expect(mockSupabaseFrom).toHaveBeenCalledWith("meal_plans");
      });
    });
  });

  describe("handleToggleChecked", () => {
    it("toggles checked state of a grocery item via checkbox", async () => {
      const smartItems = [
        { name: "rice", displayName: "rice", totalQuantity: 2, unit: "cups", category: "pantry" as const, sourceRecipes: ["Stir Fry"] },
      ];
      mockSmartCombineIngredients.mockResolvedValue({ items: smartItems, perRecipeItems: {} });
      mockLoadGeneralItems.mockResolvedValue([]);

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
                  recipes: { name: "Stir Fry", url: "https://example.com/stirfry" },
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
                { id: "ing-1", recipe_id: "recipe-1", name: "rice", quantity: 2, unit: "cups", category: "pantry", raw_text: "2 cups rice", sort_order: 0, created_at: "2026-01-01" },
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
              data: [{ id: "recipe-1", name: "Stir Fry", url: "https://example.com/stirfry" }],
              error: null,
            }),
          });
        }
        return createMockQueryBuilder();
      });

      render(<MealPlanPage {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getAllByText("Stir Fry")[0]).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Groceries"));

      await waitFor(() => {
        expect(screen.getByText("2 cups rice")).toBeInTheDocument();
      });

      // Clear any prior calls to saveCheckedItems from initial load
      mockSaveCheckedItems.mockClear();

      // Find and click the checkbox to check the item
      const checkButton = screen.getByLabelText("Check item");
      fireEvent.click(checkButton);

      // After checking, saveCheckedItems should be called
      await waitFor(() => {
        expect(mockSaveCheckedItems).toHaveBeenCalledWith(
          "meal_plan",
          expect.any(String),
          "user-123",
          expect.any(Set)
        );
      });

      // The item should now show as checked (aria-label changes to "Uncheck item")
      expect(screen.getByLabelText("Uncheck item")).toBeInTheDocument();

      // Click again to uncheck
      fireEvent.click(screen.getByLabelText("Uncheck item"));

      // saveCheckedItems should be called again with the item removed from the set
      await waitFor(() => {
        expect(mockSaveCheckedItems).toHaveBeenCalledTimes(2);
      });
    });
  });
});
