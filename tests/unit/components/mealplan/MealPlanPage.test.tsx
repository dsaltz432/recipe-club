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

// Mock EventRatingDialog
vi.mock("@/components/events/EventRatingDialog", () => ({
  default: ({ onComplete, onCancel }: { onComplete: () => void; onCancel: () => void }) => (
    <div data-testid="rating-dialog">
      <button onClick={onComplete}>Complete Rating</button>
      <button onClick={onCancel}>Cancel Rating</button>
    </div>
  ),
}));

// Mock PantryDialog
vi.mock("@/components/pantry/PantryDialog", () => ({
  default: ({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) =>
    open ? (
      <div data-testid="pantry-dialog">
        <button onClick={() => onOpenChange(false)}>Close Pantry</button>
      </div>
    ) : null,
}));

// Mock Supabase
const mockSupabaseFrom = vi.fn();
const mockInvoke = vi.fn();
const mockStorageUpload = vi.fn();
const mockStorageGetPublicUrl = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => mockSupabaseFrom(...args),
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
}));

// Mock grocery list smart combine (preserve other exports like combineIngredients)
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
vi.mock("@/lib/groceryCache", () => ({
  loadGroceryCache: (...args: unknown[]) => mockLoadGroceryCache(...args),
  saveGroceryCache: (...args: unknown[]) => mockSaveGroceryCache(...args),
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
    mockInvoke.mockResolvedValue({ data: {}, error: null });
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
      expect(screen.getByText("Meals")).toBeInTheDocument();
    });
  });

  it("navigates to previous week", async () => {
    render(<MealPlanPage {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Meals")).toBeInTheDocument();
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
      expect(screen.getByText("Meals")).toBeInTheDocument();
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
      expect(screen.getByText("Meals")).toBeInTheDocument();
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
      expect(screen.getByText("Meals")).toBeInTheDocument();
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
    fireEvent.click(screen.getByText("Add to Meal"));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalled();
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
      expect(screen.getByText("Meals")).toBeInTheDocument();
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
    fireEvent.click(screen.getByText("Add to Meal"));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalled();
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
      expect(screen.getByText("Meals")).toBeInTheDocument();
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
      expect(toast.success).toHaveBeenCalled();
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
      expect(screen.getByText("Existing Meal 1")).toBeInTheDocument();
    });

    // Click the "Add another meal" button in the occupied Sunday Dinner slot
    const addButtons = screen.getAllByTitle("Add another meal");
    fireEvent.click(addButtons[0]);

    // Add custom meal
    fireEvent.change(screen.getByLabelText("Meal Name *"), {
      target: { value: "New Meal" },
    });
    fireEvent.click(screen.getByText("Add to Meal"));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalled();
    });

    // Verify the insert was called with sort_order: 2 (max of 0,1 = 1, plus 1 = 2)
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ sort_order: 2 })
    );
  });

  it("clears pending slot when dialog closes", async () => {
    render(<MealPlanPage {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Meals")).toBeInTheDocument();
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

  it("removes a meal item", async () => {
    // Mock plan with existing item
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
      return createMockQueryBuilder();
    });

    render(<MealPlanPage {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Pancakes")).toBeInTheDocument();
    });

    // Now set up delete mock
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "meal_plan_items") {
        return createMockQueryBuilder({
          eq: vi.fn().mockResolvedValue({ error: null }),
        });
      }
      return createMockQueryBuilder();
    });

    fireEvent.click(screen.getByTitle("Remove meal"));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Meal removed");
    });
  });

  it("handles remove meal error", async () => {
    // Setup to load with an existing item
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
      return createMockQueryBuilder();
    });

    render(<MealPlanPage {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Pancakes")).toBeInTheDocument();
    });

    // Now set up delete to fail
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "meal_plan_items") {
        const builder = createMockQueryBuilder();
        builder.delete = vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: { message: "Delete failed" } }),
        });
        return builder;
      }
      return createMockQueryBuilder();
    });

    fireEvent.click(screen.getByTitle("Remove meal"));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to remove meal");
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
      expect(screen.getByText("Grilled Chicken")).toBeInTheDocument();
    });
  });

  it("renders week navigation", async () => {
    render(<MealPlanPage {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Meals")).toBeInTheDocument();
    });

    // Should have day headers
    expect(screen.getByText("Sun")).toBeInTheDocument();
    expect(screen.getByText("Mon")).toBeInTheDocument();
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
      expect(screen.getByText("Meals")).toBeInTheDocument();
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
      expect(screen.getByText("Meals")).toBeInTheDocument();
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
    fireEvent.click(screen.getByText("Add to Meal"));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to add meal");
    });
  });

  it("navigates to current week with Today button", async () => {
    render(<MealPlanPage {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Meals")).toBeInTheDocument();
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
      expect(screen.getByText("Meals")).toBeInTheDocument();
    });

    // Should render with no items (empty grid)
    expect(screen.getByText("Sun")).toBeInTheDocument();
  });

  it("edits a meal item by clicking its name", async () => {
    // Load plan with existing item
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
      return createMockQueryBuilder();
    });

    render(<MealPlanPage {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Pancakes")).toBeInTheDocument();
    });

    // Click meal name to edit
    fireEvent.click(screen.getByText("Pancakes"));

    // Should open dialog in edit mode
    expect(screen.getByText("Edit Meal")).toBeInTheDocument();
    expect(screen.getByText('Replace "Pancakes" for Sunday breakfast.')).toBeInTheDocument();
  });

  it("replaces a meal via edit flow (UPDATE in place)", async () => {
    // Load plan with two items — second item exercises the ternary else branch in setItems
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
      return createMockQueryBuilder();
    });

    render(<MealPlanPage {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Pancakes")).toBeInTheDocument();
    });

    // Set up mocks for the UPDATE-based edit flow:
    // 1. recipes.insert (creates new recipe for custom meal)
    // 2. meal_plan_items.update (updates existing item in place)
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") {
        return createMockQueryBuilder({
          single: vi.fn().mockResolvedValue({
            data: { id: "recipe-waffles" },
            error: null,
          }),
        });
      }
      if (table === "meal_plan_items") {
        return createMockQueryBuilder({
          eq: vi.fn().mockResolvedValue({ error: null }),
        });
      }
      return createMockQueryBuilder();
    });

    // Click meal name to edit
    fireEvent.click(screen.getByText("Pancakes"));

    // Fill in replacement meal
    fireEvent.change(screen.getByLabelText("Meal Name *"), {
      target: { value: "Waffles" },
    });
    fireEvent.click(screen.getByText("Save Changes"));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Updated meal to "Waffles"');
    });
  });

  it("edits a meal with existing recipeId via UPDATE (updates recipe record)", async () => {
    // Load plan with existing item that has a recipeId
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
                recipe_id: "recipe-existing",
                day_of_week: 0,
                meal_type: "breakfast",
                custom_name: null,
                custom_url: null,
                sort_order: 0,
                recipes: { name: "Old Recipe", url: null },
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
      expect(screen.getByText("Old Recipe")).toBeInTheDocument();
    });

    // Set up mocks for the UPDATE-based edit flow:
    // 1. recipes.update (updates existing linked recipe)
    // 2. meal_plan_items.update (updates item in place)
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") {
        return createMockQueryBuilder({
          eq: vi.fn().mockResolvedValue({ error: null }),
        });
      }
      if (table === "meal_plan_items") {
        return createMockQueryBuilder({
          eq: vi.fn().mockResolvedValue({ error: null }),
        });
      }
      return createMockQueryBuilder();
    });

    // Click meal name to edit
    fireEvent.click(screen.getByText("Old Recipe"));

    // Fill in replacement meal
    fireEvent.change(screen.getByLabelText("Meal Name *"), {
      target: { value: "New Recipe Name" },
    });
    fireEvent.click(screen.getByText("Save Changes"));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Updated meal to "New Recipe Name"');
    });
  });

  it("handles edit custom meal error", async () => {
    // Load plan with existing item (no recipeId)
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
      return createMockQueryBuilder();
    });

    render(<MealPlanPage {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Pancakes")).toBeInTheDocument();
    });

    // Set up mocks for the UPDATE-based edit flow to fail on recipe insert
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipes") {
        return createMockQueryBuilder({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: "Recipe insert failed" },
          }),
        });
      }
      return createMockQueryBuilder();
    });

    // Click meal name to edit
    fireEvent.click(screen.getByText("Pancakes"));

    // Fill in replacement meal
    fireEvent.change(screen.getByLabelText("Meal Name *"), {
      target: { value: "Waffles" },
    });
    fireEvent.click(screen.getByText("Save Changes"));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to update meal");
    });
  });

  it("handles meal_plan_items update error during custom meal edit", async () => {
    // Load plan with existing item (no recipeId)
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
      return createMockQueryBuilder();
    });

    render(<MealPlanPage {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Pancakes")).toBeInTheDocument();
    });

    // Recipe insert succeeds, but meal_plan_items update fails
    mockSupabaseFrom.mockImplementation((table: string) => {
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
          eq: vi.fn().mockResolvedValue({ error: { message: "Update failed" } }),
        });
      }
      return createMockQueryBuilder();
    });

    // Click meal name to edit
    fireEvent.click(screen.getByText("Pancakes"));

    // Fill in replacement meal
    fireEvent.change(screen.getByLabelText("Meal Name *"), {
      target: { value: "Waffles" },
    });
    fireEvent.click(screen.getByText("Save Changes"));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to update meal");
    });
  });

  it("clears editingItem when dialog closes during edit", async () => {
    // Load plan with existing item
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
      return createMockQueryBuilder();
    });

    render(<MealPlanPage {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Pancakes")).toBeInTheDocument();
    });

    // Click meal name to edit
    fireEvent.click(screen.getByText("Pancakes"));
    expect(screen.getByText("Edit Meal")).toBeInTheDocument();

    // Close dialog via Cancel
    fireEvent.click(screen.getByText("Cancel"));

    await waitFor(() => {
      expect(screen.queryByText("Edit Meal")).not.toBeInTheDocument();
    });
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
      expect(screen.getByText("Pancakes")).toBeInTheDocument();
    });

    // Click the card (whole card is now clickable)
    fireEvent.click(screen.getByLabelText("View meal details"));

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
      expect(screen.getByText("Pancakes")).toBeInTheDocument();
    });

    // Click the card (whole card is now clickable)
    fireEvent.click(screen.getByLabelText("View meal details"));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/meals/event-new-456");
    });
  });

  it("replaces a meal via recipe tab edit flow (UPDATE in place)", async () => {
    const mockRecipes = [
      { id: "r-1", name: "Club Pasta", url: "https://example.com/pasta", event_id: "e-1" },
    ];

    // Load plan with two items — second item exercises ternary else branch in setItems
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
                custom_name: "Old Meal",
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
                custom_name: "Other Meal",
                custom_url: null,
                sort_order: 0,
                recipes: null,
              },
            ],
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
      expect(screen.getByText("Old Meal")).toBeInTheDocument();
    });

    // Set up UPDATE mock for recipe edit flow
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "meal_plan_items") {
        return createMockQueryBuilder({
          eq: vi.fn().mockResolvedValue({ error: null }),
        });
      }
      if (table === "recipes") {
        return createMockQueryBuilder({
          limit: vi.fn().mockResolvedValue({ data: mockRecipes, error: null }),
        });
      }
      return createMockQueryBuilder();
    });

    // Click meal name to edit
    fireEvent.click(screen.getByText("Old Meal"));

    // Switch to recipes tab
    fireEvent.click(screen.getByText("From Recipes"));

    // Search
    fireEvent.change(screen.getByPlaceholderText("Search recipes..."), {
      target: { value: "pasta" },
    });

    await waitFor(() => {
      expect(screen.getByText("Club Pasta")).toBeInTheDocument();
    });

    // Select recipe and submit
    fireEvent.click(screen.getByText("Club Pasta"));
    fireEvent.click(screen.getByText("Add 1 to Meal"));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Updated meal to "Club Pasta"');
    });
  });

  it("handles recipe tab edit flow error", async () => {
    const mockRecipes = [
      { id: "r-1", name: "Club Pasta", url: "https://example.com/pasta", event_id: "e-1" },
    ];

    // Load plan with existing item
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
                custom_name: "Old Meal",
                custom_url: null,
                sort_order: 0,
                recipes: null,
              },
            ],
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
      expect(screen.getByText("Old Meal")).toBeInTheDocument();
    });

    // Set up UPDATE mock to fail
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "meal_plan_items") {
        return createMockQueryBuilder({
          eq: vi.fn().mockResolvedValue({ error: { message: "Update failed" } }),
        });
      }
      if (table === "recipes") {
        return createMockQueryBuilder({
          limit: vi.fn().mockResolvedValue({ data: mockRecipes, error: null }),
        });
      }
      return createMockQueryBuilder();
    });

    // Click meal name to edit
    fireEvent.click(screen.getByText("Old Meal"));

    // Switch to recipes tab
    fireEvent.click(screen.getByText("From Recipes"));

    // Search
    fireEvent.change(screen.getByPlaceholderText("Search recipes..."), {
      target: { value: "pasta" },
    });

    await waitFor(() => {
      expect(screen.getByText("Club Pasta")).toBeInTheDocument();
    });

    // Select recipe and submit
    fireEvent.click(screen.getByText("Club Pasta"));
    fireEvent.click(screen.getByText("Add 1 to Meal"));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to update meal");
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
      expect(screen.getByText("Pancakes")).toBeInTheDocument();
      expect(screen.getByText("Pasta")).toBeInTheDocument();
    });

    // Click the card on the breakfast slot (day 0) — whole card is now clickable
    const viewCards = screen.getAllByLabelText("View meal details");
    fireEvent.click(viewCards[0]);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/meals/event-new-789");
    });
  });

  it("shows Unnamed meal in editingItemName when item has no name", async () => {
    // Load plan with item that has neither recipeName nor customName
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
                custom_name: null,
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
      expect(screen.getByText("Unnamed meal")).toBeInTheDocument();
    });

    // Click meal name to edit — should show "Unnamed meal" as editingItemName
    fireEvent.click(screen.getByText("Unnamed meal"));

    expect(screen.getByText("Edit Meal")).toBeInTheDocument();
    expect(screen.getByText('Replace "Unnamed meal" for Sunday breakfast.')).toBeInTheDocument();
  });

  it("shows recipeName in editingItemName when item has recipeName", async () => {
    // Load plan with item that has recipeName
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
                recipes: { name: "Club Recipe", url: null },
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
      expect(screen.getByText("Club Recipe")).toBeInTheDocument();
    });

    // Click meal name to edit — should show recipeName as editingItemName
    fireEvent.click(screen.getByText("Club Recipe"));

    expect(screen.getByText("Edit Meal")).toBeInTheDocument();
    expect(screen.getByText('Replace "Club Recipe" for Sunday breakfast.')).toBeInTheDocument();
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
      expect(screen.getByText("Pancakes")).toBeInTheDocument();
    });

    // Click the card (whole card is now clickable)
    fireEvent.click(screen.getByLabelText("View meal details"));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to open meal details");
    });
  });

  describe("Groceries tab", () => {
    it("shows Groceries tab button", async () => {
      render(<MealPlanPage {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Meals")).toBeInTheDocument();
      });

      expect(screen.getByText("Groceries")).toBeInTheDocument();
    });

    it("shows empty state when no meals have recipes", async () => {
      render(<MealPlanPage {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Meals")).toBeInTheDocument();
      });

      // Switch to Groceries tab
      fireEvent.click(screen.getByText("Groceries"));

      expect(
        screen.getByText("No meals planned this week. Add meals to see a grocery list.")
      ).toBeInTheDocument();
    });

    it("shows Manage Pantry button and opens PantryDialog on click", async () => {
      render(<MealPlanPage {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Meals")).toBeInTheDocument();
      });

      // Switch to Groceries tab
      fireEvent.click(screen.getByText("Groceries"));

      // Manage Pantry button should be visible
      const manageButton = screen.getByRole("button", { name: /Manage Pantry/ });
      expect(manageButton).toBeInTheDocument();

      // Click to open PantryDialog
      fireEvent.click(manageButton);

      await waitFor(() => {
        expect(screen.getByTestId("pantry-dialog")).toBeInTheDocument();
      });

      // Close the dialog
      fireEvent.click(screen.getByText("Close Pantry"));

      await waitFor(() => {
        expect(screen.queryByTestId("pantry-dialog")).not.toBeInTheDocument();
      });
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
        expect(screen.getByText("Grilled Chicken")).toBeInTheDocument();
      });

      // Switch to Groceries tab
      fireEvent.click(screen.getByText("Groceries"));

      // Should show grocery list
      await waitFor(() => {
        expect(screen.getByText("Grocery List")).toBeInTheDocument();
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
        expect(screen.getByText("Just Toast")).toBeInTheDocument();
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
        expect(screen.getByText("Chicken")).toBeInTheDocument();
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
        expect(screen.getByText("Chicken")).toBeInTheDocument();
      });

      // Switch to Groceries tab — should not crash even if pantry load fails
      fireEvent.click(screen.getByText("Groceries"));

      await waitFor(() => {
        expect(screen.getByText("Grocery List")).toBeInTheDocument();
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
        expect(screen.getByText("Pasta")).toBeInTheDocument();
      });

      // Switch to Groceries tab
      fireEvent.click(screen.getByText("Groceries"));

      await waitFor(() => {
        expect(screen.getByText("Grocery List")).toBeInTheDocument();
      });

      // Click parse button
      const parseButton = screen.getByText('Parse "Pasta"');
      fireEvent.click(parseButton);

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith("parse-recipe", {
          body: { recipeId: "recipe-1", recipeUrl: "https://example.com/pasta", recipeName: "Pasta" },
        });
      });

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith("Recipe parsed successfully!");
      });
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
        expect(screen.getByText("Pasta")).toBeInTheDocument();
      });

      // Switch to Groceries tab
      fireEvent.click(screen.getByText("Groceries"));

      await waitFor(() => {
        expect(screen.getByText("Grocery List")).toBeInTheDocument();
      });

      // Click parse button
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
        expect(screen.getByText("No URL Recipe")).toBeInTheDocument();
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

    it("switches between Meal Plan and Groceries tabs", async () => {
      render(<MealPlanPage {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Meals")).toBeInTheDocument();
      });

      // Should show meal grid by default (check for day headers)
      expect(screen.getByText("Sun")).toBeInTheDocument();

      // Switch to Groceries tab
      fireEvent.click(screen.getByText("Groceries"));

      // Day headers should be hidden (grid is not shown)
      expect(screen.queryByText("Sun")).not.toBeInTheDocument();

      // Switch back to Meal Plan tab
      fireEvent.click(screen.getByText("Meal Plan"));

      // Day headers should be back
      expect(screen.getByText("Sun")).toBeInTheDocument();
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
        expect(screen.getByText("Chicken")).toBeInTheDocument();
      });

      // Switch to Groceries tab
      fireEvent.click(screen.getByText("Groceries"));

      await waitFor(() => {
        expect(screen.getByText("Grocery List")).toBeInTheDocument();
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
        expect(screen.getByText("Chicken")).toBeInTheDocument();
      });

      // Switch to Groceries tab — should not crash with null data
      fireEvent.click(screen.getByText("Groceries"));

      await waitFor(() => {
        expect(screen.getByText("Grocery List")).toBeInTheDocument();
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
        expect(screen.getByText("Soup")).toBeInTheDocument();
      });

      // Switch to Groceries tab
      fireEvent.click(screen.getByText("Groceries"));

      await waitFor(() => {
        expect(screen.getByText("Grocery List")).toBeInTheDocument();
      });

      // Ingredients with null fields should still display
      expect(screen.getByText("onion")).toBeInTheDocument();
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
        expect(screen.getByText("Chicken")).toBeInTheDocument();
      });

      // Switch to Groceries tab
      fireEvent.click(screen.getByText("Groceries"));

      await waitFor(() => {
        expect(screen.getByText("Grocery List")).toBeInTheDocument();
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

      // Should show empty state since no meals
      await waitFor(() => {
        expect(
          screen.getByText("No meals planned this week. Add meals to see a grocery list.")
        ).toBeInTheDocument();
      });
    });

    it("runs smart combine when 2+ parsed recipes are present", async () => {
      const smartItems = [
        { name: "chicken", totalQuantity: 2, unit: "lbs", category: "meat_seafood", sourceRecipes: ["Chicken Stir Fry"] },
      ];
      mockSmartCombineIngredients.mockResolvedValue(smartItems);

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
        expect(screen.getByText("Chicken Stir Fry")).toBeInTheDocument();
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
          expect.any(Array)
        );
      });
    });

    it("skips re-combine when same recipe IDs already combined", async () => {
      const smartItems = [
        { name: "chicken", totalQuantity: 2, unit: "lbs", category: "meat_seafood", sourceRecipes: ["Chicken Stir Fry"] },
      ];
      mockSmartCombineIngredients.mockResolvedValue(smartItems);
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
        expect(screen.getByText("Chicken Stir Fry")).toBeInTheDocument();
      });

      // First visit to Groceries tab — smartCombine runs
      fireEvent.click(screen.getByText("Groceries"));
      await waitFor(() => {
        expect(mockSmartCombineIngredients).toHaveBeenCalledTimes(1);
      });

      // Switch back to Meal Plan
      fireEvent.click(screen.getByText("Meal Plan"));

      // Switch to Groceries again — same recipe IDs, should skip re-combine
      fireEvent.click(screen.getByText("Groceries"));

      // Wait for grocery data to load
      await waitFor(() => {
        expect(screen.getByText("Grocery List")).toBeInTheDocument();
      });

      // Smart combine should still only have been called once (skipped on second visit)
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
        expect(screen.getByText("Soup")).toBeInTheDocument();
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

      // Smart combine should NOT have been called because cache was hit
      expect(mockSmartCombineIngredients).not.toHaveBeenCalled();
    });

    it("skips smart combine when fewer than 2 parsed recipes", async () => {
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
        expect(screen.getByText("Solo Recipe")).toBeInTheDocument();
      });

      // Switch to Groceries tab
      fireEvent.click(screen.getByText("Groceries"));

      await waitFor(() => {
        expect(screen.getByText("Grocery List")).toBeInTheDocument();
      });

      // Smart combine should NOT have been called (only 1 parsed recipe)
      expect(mockSmartCombineIngredients).not.toHaveBeenCalled();
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
        expect(screen.getByText("Recipe A")).toBeInTheDocument();
      });

      // Switch to Groceries tab — should not crash even though smart combine fails
      fireEvent.click(screen.getByText("Groceries"));

      await waitFor(() => {
        expect(mockSmartCombineIngredients).toHaveBeenCalled();
      });

      // Page should still render grocery list
      await waitFor(() => {
        expect(screen.getByText("Grocery List")).toBeInTheDocument();
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
        expect(screen.getByText("Recipe A")).toBeInTheDocument();
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
        { name: "chicken", totalQuantity: 2, unit: "lbs", category: "meat_seafood", sourceRecipes: ["Recipe A"] },
      ];
      mockSmartCombineIngredients.mockResolvedValue(smartItems);

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
        expect(screen.getByText("Recipe A")).toBeInTheDocument();
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
        expect(screen.getByText("Pancakes")).toBeInTheDocument();
      });

      // Cooked item should show green styling (via cooked checkmark)
      expect(screen.getByTestId("cooked-check")).toBeInTheDocument();
    });

    it("marks slot as cooked directly when no recipes (custom meals only)", async () => {
      // Two items in different slots — marking one should preserve the other
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
                  custom_name: "Toast",
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
                  custom_name: "Soup",
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
        expect(screen.getByText("Toast")).toBeInTheDocument();
        expect(screen.getByText("Soup")).toBeInTheDocument();
      });

      // Set up the update mock for marking as cooked
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "meal_plan_items") {
          return createMockQueryBuilder({
            in: vi.fn().mockResolvedValue({ error: null }),
          });
        }
        return createMockQueryBuilder();
      });

      // Mark breakfast as cooked — Toast slot
      const markButtons = screen.getAllByTitle("Mark as cooked");
      fireEvent.click(markButtons[0]);

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith("Marked as cooked!");
      });

      // Should NOT open rating dialog since no recipes
      expect(screen.queryByTestId("rating-dialog")).not.toBeInTheDocument();
    });

    it("opens rating dialog when marking cooked with recipes and existing event", async () => {
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
                  recipes: { name: "Pancakes", url: "https://example.com/pancakes" },
                  event_id: "event-123",
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
        expect(screen.getByText("Pancakes")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTitle("Mark as cooked"));

      // Rating dialog should appear
      await waitFor(() => {
        expect(screen.getByTestId("rating-dialog")).toBeInTheDocument();
      });
    });

    it("creates event then opens rating dialog when no existing event", async () => {
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
                  recipes: { name: "Pancakes", url: "https://example.com/pancakes" },
                },
              ],
              error: null,
            }),
          });
        }
        if (table === "scheduled_events") {
          return createMockQueryBuilder({
            single: vi.fn().mockResolvedValue({
              data: { id: "event-new-100" },
              error: null,
            }),
          });
        }
        return createMockQueryBuilder();
      });

      render(<MealPlanPage {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Pancakes")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTitle("Mark as cooked"));

      // Rating dialog should appear after event creation
      await waitFor(() => {
        expect(screen.getByTestId("rating-dialog")).toBeInTheDocument();
      });
    });

    it("marks items as cooked after completing rating", async () => {
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
                  recipes: { name: "Pancakes", url: "https://example.com/pancakes" },
                  event_id: "event-123",
                },
              ],
              error: null,
            }),
            in: vi.fn().mockResolvedValue({ error: null }),
          });
        }
        return createMockQueryBuilder();
      });

      render(<MealPlanPage {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Pancakes")).toBeInTheDocument();
      });

      // Open rating dialog
      fireEvent.click(screen.getByTitle("Mark as cooked"));

      await waitFor(() => {
        expect(screen.getByTestId("rating-dialog")).toBeInTheDocument();
      });

      // Complete rating — silent=true suppresses "Marked as cooked!" toast
      fireEvent.click(screen.getByText("Complete Rating"));

      await waitFor(() => {
        expect(screen.queryByTestId("rating-dialog")).not.toBeInTheDocument();
      });

      // "Marked as cooked!" toast should NOT appear (silent mode after rating)
      expect(toast.success).not.toHaveBeenCalledWith("Marked as cooked!");
    });

    it("closes rating dialog on cancel without marking as cooked", async () => {
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
                  recipes: { name: "Pancakes", url: "https://example.com/pancakes" },
                  event_id: "event-123",
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
        expect(screen.getByText("Pancakes")).toBeInTheDocument();
      });

      // Open rating dialog
      fireEvent.click(screen.getByTitle("Mark as cooked"));

      await waitFor(() => {
        expect(screen.getByTestId("rating-dialog")).toBeInTheDocument();
      });

      // Cancel rating
      fireEvent.click(screen.getByText("Cancel Rating"));

      // Dialog should be closed
      expect(screen.queryByTestId("rating-dialog")).not.toBeInTheDocument();

      // Should NOT have been marked as cooked
      expect(toast.success).not.toHaveBeenCalledWith("Marked as cooked!");
    });

    it("uncooks a meal", async () => {
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
                  custom_name: "Toast",
                  custom_url: null,
                  sort_order: 0,
                  recipes: null,
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
        expect(screen.getByText("Toast")).toBeInTheDocument();
      });

      // Set up update mock for uncooking
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "meal_plan_items") {
          return createMockQueryBuilder({
            in: vi.fn().mockResolvedValue({ error: null }),
          });
        }
        return createMockQueryBuilder();
      });

      fireEvent.click(screen.getByTitle("Undo cook"));

      // Confirmation dialog should appear
      await waitFor(() => {
        expect(screen.getByText("Undo cook?")).toBeInTheDocument();
      });
      fireEvent.click(screen.getByRole("button", { name: "Continue" }));

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith("Meal unmarked as cooked");
      });
    });

    it("handles mark as cooked error", async () => {
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
                  custom_name: "Toast",
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
        expect(screen.getByText("Toast")).toBeInTheDocument();
      });

      // Set up update mock to fail
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "meal_plan_items") {
          return createMockQueryBuilder({
            in: vi.fn().mockResolvedValue({ error: { message: "Update failed" } }),
          });
        }
        return createMockQueryBuilder();
      });

      fireEvent.click(screen.getByTitle("Mark as cooked"));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Failed to mark as cooked");
      });
    });

    it("handles uncook error", async () => {
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
                  custom_name: "Toast",
                  custom_url: null,
                  sort_order: 0,
                  recipes: null,
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
        expect(screen.getByText("Toast")).toBeInTheDocument();
      });

      // Set up update mock to fail
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "meal_plan_items") {
          return createMockQueryBuilder({
            in: vi.fn().mockResolvedValue({ error: { message: "Update failed" } }),
          });
        }
        return createMockQueryBuilder();
      });

      fireEvent.click(screen.getByTitle("Undo cook"));

      // Confirmation dialog should appear
      await waitFor(() => {
        expect(screen.getByText("Undo cook?")).toBeInTheDocument();
      });
      fireEvent.click(screen.getByRole("button", { name: "Continue" }));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Failed to uncook meal");
      });
    });

    it("cancels uncook when Cancel is clicked in confirmation dialog", async () => {
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
                  custom_name: "Toast",
                  custom_url: null,
                  sort_order: 0,
                  recipes: null,
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
        expect(screen.getByText("Toast")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTitle("Undo cook"));

      // Confirmation dialog should appear
      await waitFor(() => {
        expect(screen.getByText("Undo cook?")).toBeInTheDocument();
      });

      // Click Cancel
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

      // Dialog should close, no uncook happened
      await waitFor(() => {
        expect(screen.queryByText("Undo cook?")).not.toBeInTheDocument();
      });
      expect(toast.success).not.toHaveBeenCalledWith("Meal unmarked as cooked");
    });

    it("handles event creation error during mark as cooked", async () => {
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
                  recipes: { name: "Pancakes", url: "https://example.com/pancakes" },
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
              error: { message: "Event creation failed" },
            }),
          });
        }
        return createMockQueryBuilder();
      });

      render(<MealPlanPage {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Pancakes")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTitle("Mark as cooked"));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Failed to mark as cooked");
      });

      // Rating dialog should NOT appear
      expect(screen.queryByTestId("rating-dialog")).not.toBeInTheDocument();
    });

    it("preserves other slot items when creating event during mark cooked", async () => {
      // Two items in different slots — event creation for one should not affect the other
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
                  recipes: { name: "Pancakes", url: "https://example.com/pancakes" },
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
              data: { id: "event-new-200" },
              error: null,
            }),
          });
        }
        return createMockQueryBuilder();
      });

      render(<MealPlanPage {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Pancakes")).toBeInTheDocument();
        expect(screen.getByText("Pasta")).toBeInTheDocument();
      });

      // Mark cooked on the breakfast slot (which has a recipe)
      const markButtons = screen.getAllByTitle("Mark as cooked");
      fireEvent.click(markButtons[0]); // First mark-as-cooked button (breakfast)

      // Should open rating dialog — the Pasta item should be unchanged
      await waitFor(() => {
        expect(screen.getByTestId("rating-dialog")).toBeInTheDocument();
      });
    });

    it("preserves other slot items when uncooking a meal", async () => {
      // Two items in different slots — uncooking one should not affect the other
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
                  custom_name: "Toast",
                  custom_url: null,
                  sort_order: 0,
                  recipes: null,
                  cooked_at: "2026-02-19T12:00:00Z",
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
        expect(screen.getByText("Toast")).toBeInTheDocument();
        expect(screen.getByText("Pasta")).toBeInTheDocument();
      });

      // Set up update mock for uncooking
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "meal_plan_items") {
          return createMockQueryBuilder({
            in: vi.fn().mockResolvedValue({ error: null }),
          });
        }
        return createMockQueryBuilder();
      });

      // Uncook the first slot (breakfast)
      const undoButtons = screen.getAllByTitle("Undo cook");
      fireEvent.click(undoButtons[0]);

      // Confirmation dialog should appear
      await waitFor(() => {
        expect(screen.getByText("Undo cook?")).toBeInTheDocument();
      });
      fireEvent.click(screen.getByRole("button", { name: "Continue" }));

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith("Meal unmarked as cooked");
      });
    });

    it("uses customName fallback for recipe name in rating dialog", async () => {
      // Recipe item with no recipeName but has customName
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
                  custom_name: "My Custom Meal",
                  custom_url: "https://example.com/custom",
                  sort_order: 0,
                  recipes: null, // No joined recipe data
                  event_id: "event-123",
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
        expect(screen.getByText("My Custom Meal")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTitle("Mark as cooked"));

      await waitFor(() => {
        expect(screen.getByTestId("rating-dialog")).toBeInTheDocument();
      });
    });

    it("uses 'Unnamed' fallback when recipe has no name at all", async () => {
      // Recipe item with neither recipeName nor customName
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
                  custom_url: "https://example.com/unnamed",
                  sort_order: 0,
                  recipes: null, // No joined recipe data
                  event_id: "event-123",
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
        expect(screen.getByText("Unnamed meal")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTitle("Mark as cooked"));

      await waitFor(() => {
        expect(screen.getByTestId("rating-dialog")).toBeInTheDocument();
      });
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
        expect(screen.getByText("Meals")).toBeInTheDocument();
      });

      // Open Add Meal dialog
      const slotButtons = screen.getAllByRole("button").filter(
        (b) => b.textContent?.includes("Dinner")
      );
      fireEvent.click(slotButtons[0]);

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
        expect(screen.getByText("Meals")).toBeInTheDocument();
      });

      const slotButtons = screen.getAllByRole("button").filter(
        (b) => b.textContent?.includes("Dinner")
      );
      fireEvent.click(slotButtons[0]);

      fireEvent.change(screen.getByLabelText("Meal Name *"), {
        target: { value: "Tacos" },
      });
      fireEvent.change(screen.getByLabelText("Recipe URL or Photo/PDF"), {
        target: { value: "https://example.com/tacos" },
      });
      fireEvent.click(screen.getByText("Add to Meal"));

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith(expect.stringContaining("Added"));
      });

      // parse-recipe should be called since any URL now triggers parsing
      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith("parse-recipe", expect.anything());
      });
    });

    it("invokes parse-recipe when editing a custom meal with a file upload", async () => {
      // Load plan with existing item (no recipeId)
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
                  meal_type: "dinner",
                  custom_name: "Old Meal",
                  custom_url: null,
                  sort_order: 0,
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
              data: { id: "recipe-edit-upload" },
              error: null,
            }),
          });
        }
        return createMockQueryBuilder();
      });

      render(<MealPlanPage {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Old Meal")).toBeInTheDocument();
      });

      // Set up mocks for the edit flow
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "recipes") {
          return createMockQueryBuilder({
            single: vi.fn().mockResolvedValue({
              data: { id: "recipe-edit-upload" },
              error: null,
            }),
          });
        }
        if (table === "meal_plan_items") {
          return createMockQueryBuilder({
            eq: vi.fn().mockResolvedValue({ error: null }),
          });
        }
        return createMockQueryBuilder();
      });

      // Click meal name to edit
      fireEvent.click(screen.getByText("Old Meal"));

      // Upload a file
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(["test"], "recipe-photo.jpg", { type: "image/jpeg" });
      fireEvent.change(fileInput, { target: { files: [file] } });

      // Wait for the full upload to complete (including name auto-fill)
      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith("File uploaded!");
      });

      // Submit the edit form
      fireEvent.click(screen.getByText("Save Changes"));

      await waitFor(() => {
        // In edit mode, the name field is pre-filled with the existing meal name,
        // so the filename auto-fill doesn't apply (only applies when name is empty)
        expect(mockInvoke).toHaveBeenCalledWith("parse-recipe", {
          body: {
            recipeId: "recipe-edit-upload",
            recipeUrl: "https://storage.example.com/recipe-images/mock-uuid-456.jpg",
            recipeName: "Old Meal",
          },
        });
      });
    });

    it("handles parse error during edit with file upload", async () => {
      mockInvoke.mockResolvedValueOnce({ data: null, error: new Error("Parse failed during edit") });

      // Load plan with existing item (no recipeId)
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
                  meal_type: "dinner",
                  custom_name: "Old Meal",
                  custom_url: null,
                  sort_order: 0,
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
              data: { id: "recipe-edit-parse-fail" },
              error: null,
            }),
          });
        }
        return createMockQueryBuilder();
      });

      render(<MealPlanPage {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Old Meal")).toBeInTheDocument();
      });

      // Set up mocks for the edit flow
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "recipes") {
          return createMockQueryBuilder({
            single: vi.fn().mockResolvedValue({
              data: { id: "recipe-edit-parse-fail" },
              error: null,
            }),
          });
        }
        if (table === "meal_plan_items") {
          return createMockQueryBuilder({
            eq: vi.fn().mockResolvedValue({ error: null }),
          });
        }
        return createMockQueryBuilder();
      });

      // Click meal name to edit
      fireEvent.click(screen.getByText("Old Meal"));

      // Upload a file
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(["test"], "recipe-photo.jpg", { type: "image/jpeg" });
      fireEvent.change(fileInput, { target: { files: [file] } });

      // Wait for the full upload to complete
      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith("File uploaded!");
      });

      // Submit the edit form
      fireEvent.click(screen.getByText("Save Changes"));

      // Parse error now shows a dialog instead of a toast
      await waitFor(() => {
        expect(screen.getByText("Parsing Failed")).toBeInTheDocument();
      });

      // "Keep Recipe Anyway" dismisses dialog
      fireEvent.click(screen.getByText("Keep Recipe Anyway"));
      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith("Recipe saved without parsing");
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
        expect(screen.getByText("Meals")).toBeInTheDocument();
      });

      const slotButtons = screen.getAllByRole("button").filter(
        (b) => b.textContent?.includes("Dinner")
      );
      fireEvent.click(slotButtons[0]);

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
        expect(screen.getByText("Parsing Recipe")).toBeInTheDocument();
      });
    });

    it("dismisses parse failure dialog via overlay close (calls handleParseKeep)", async () => {
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
        expect(screen.getByText("Meals")).toBeInTheDocument();
      });

      const slotButtons = screen.getAllByRole("button").filter(
        (b) => b.textContent?.includes("Dinner")
      );
      fireEvent.click(slotButtons[0]);

      fireEvent.change(screen.getByLabelText("Meal Name *"), {
        target: { value: "Test Recipe" },
      });
      fireEvent.change(screen.getByLabelText("Recipe URL or Photo/PDF"), {
        target: { value: "https://example.com/test" },
      });
      fireEvent.click(screen.getByText("Add to Meal"));

      // Wait for the parse failure dialog
      await waitFor(() => {
        expect(screen.getByText("Parsing Failed")).toBeInTheDocument();
      });

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
        expect(screen.getByText("Meals")).toBeInTheDocument();
      });

      const slotButtons = screen.getAllByRole("button").filter(
        (b) => b.textContent?.includes("Dinner")
      );
      fireEvent.click(slotButtons[0]);

      fireEvent.change(screen.getByLabelText("Meal Name *"), {
        target: { value: "Open Test" },
      });
      fireEvent.change(screen.getByLabelText("Recipe URL or Photo/PDF"), {
        target: { value: "https://example.com/open" },
      });
      fireEvent.click(screen.getByText("Add to Meal"));

      // Wait for the parsing dialog
      await waitFor(() => {
        expect(screen.getByText("Parsing Recipe")).toBeInTheDocument();
      });

      // Close button fires onOpenChange, but since parseStatus is "parsing" (not "failed"),
      // handleParseKeep should NOT be called — dialog stays open
      const closeButton = screen.getByRole("button", { name: /close/i });
      fireEvent.click(closeButton);

      // Dialog should still be showing "Parsing Recipe"
      expect(screen.getByText("Parsing Recipe")).toBeInTheDocument();
      expect(toast.success).not.toHaveBeenCalledWith("Recipe saved without parsing");

      // Clean up: resolve the invoke to avoid dangling promise
      resolveInvoke!({ data: {}, error: null });
      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith("Recipe parsed successfully!");
      });
    });

    it("handles loadGroceryData returning null after parse succeeds on groceries tab", async () => {
      // Use a delayed parse mock so we can switch tabs while parse is in flight
      let resolveInvoke: (value: { data: unknown; error: null }) => void;
      mockInvoke.mockImplementationOnce(() => new Promise((resolve) => {
        resolveInvoke = resolve;
      }));

      let parseResolved = false;

      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "meal_plans") {
          return createPlanMock(null);
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
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
            single: vi.fn().mockResolvedValue({
              data: {
                id: "item-null-grocery",
                plan_id: "plan-new",
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
        expect(screen.getByText("Meals")).toBeInTheDocument();
      });

      // Add a new meal with URL to trigger parse
      const slotButtons = screen.getAllByRole("button").filter(
        (b) => b.textContent?.includes("Dinner")
      );
      fireEvent.click(slotButtons[0]);

      fireEvent.change(screen.getByLabelText("Meal Name *"), {
        target: { value: "New Meal" },
      });
      fireEvent.change(screen.getByLabelText("Recipe URL or Photo/PDF"), {
        target: { value: "https://example.com/new" },
      });
      fireEvent.click(screen.getByText("Add to Meal"));

      // Wait for parsing dialog
      await waitFor(() => {
        expect(screen.getByText("Parsing Recipe")).toBeInTheDocument();
      });

      // Switch to Groceries tab while parse is in flight
      fireEvent.click(screen.getByText("Groceries"));

      await waitFor(() => {
        expect(screen.getByText("Grocery List")).toBeInTheDocument();
      });

      // Mark that parse is about to resolve so loadGroceryData will fail
      parseResolved = true;

      // Resolve parse — loadGroceryData will return null because recipe_ingredients throws
      resolveInvoke!({ data: {}, error: null });

      // Parse succeeds but smartCombine should NOT be called since groceryData is null
      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith("Recipe parsed successfully!");
      });
    });

    it("reloads grocery data after successful parse while on groceries tab", async () => {
      // Use a delayed parse mock so we can switch tabs while parse is in flight
      let resolveInvoke: (value: { data: unknown; error: null }) => void;
      mockInvoke.mockImplementationOnce(() => new Promise((resolve) => {
        resolveInvoke = resolve;
      }));
      mockSmartCombineIngredients.mockResolvedValue([
        { name: "chicken", totalQuantity: 2, unit: "lbs", category: "meat_seafood", sourceRecipes: ["Tacos"] },
      ]);

      // Start with a plan that has 2 recipes with URLs (needed for smart combine to trigger)
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
                  recipes: { name: "Tacos", url: "https://example.com/tacos" },
                },
                {
                  id: "item-2", plan_id: "plan-1", recipe_id: "recipe-2",
                  day_of_week: 2, meal_type: "dinner", custom_name: null,
                  custom_url: null, sort_order: 0,
                  recipes: { name: "Burritos", url: "https://example.com/burritos" },
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
                { id: "ing-2", recipe_id: "recipe-2", name: "beans", quantity: 1, unit: "can", category: "canned", raw_text: null, sort_order: 0, created_at: "2026-01-01" },
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
                { id: "recipe-1", name: "Tacos", url: "https://example.com/tacos" },
                { id: "recipe-2", name: "Burritos", url: "https://example.com/burritos" },
              ],
              error: null,
            }),
          });
        }
        return createMockQueryBuilder();
      });

      render(<MealPlanPage {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Tacos")).toBeInTheDocument();
      });

      // Click the meal to edit and add a URL to trigger parse
      fireEvent.click(screen.getByText("Tacos"));
      fireEvent.change(screen.getByLabelText("Recipe URL or Photo/PDF"), {
        target: { value: "https://example.com/tacos-v2" },
      });
      fireEvent.click(screen.getByText("Save Changes"));

      // Wait for the parsing dialog to appear
      await waitFor(() => {
        expect(screen.getByText("Parsing Recipe")).toBeInTheDocument();
      });

      // Switch to Groceries tab while parse is still in flight
      fireEvent.click(screen.getByText("Groceries"));

      await waitFor(() => {
        expect(screen.getByText("Grocery List")).toBeInTheDocument();
      });

      // Now resolve the parse — since viewTab is "groceries", it should reload grocery data
      resolveInvoke!({ data: {}, error: null });

      // Parse succeeds and reloads grocery data + runs smart combine
      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith("Recipe parsed successfully!");
      });
    });
  });
});
