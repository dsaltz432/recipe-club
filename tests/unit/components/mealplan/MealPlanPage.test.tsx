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

// Mock Supabase
const mockSupabaseFrom = vi.fn();
const mockInvoke = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => mockSupabaseFrom(...args),
    functions: { invoke: (...args: unknown[]) => mockInvoke(...args) },
  },
}));

// Mock pantry module
const mockGetPantryItems = vi.fn();
const mockEnsureDefaultPantryItems = vi.fn();
vi.mock("@/lib/pantry", () => ({
  getPantryItems: (...args: unknown[]) => mockGetPantryItems(...args),
  ensureDefaultPantryItems: (...args: unknown[]) => mockEnsureDefaultPantryItems(...args),
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
    fireEvent.click(screen.getByText("Add to Plan"));

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
    fireEvent.click(screen.getByText("Add to Plan"));

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
    fireEvent.click(screen.getByText("Add 1 to Plan"));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalled();
    });
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
    fireEvent.click(screen.getByText("Add to Plan"));

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
    fireEvent.click(screen.getByText("Add to Plan"));

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
    fireEvent.click(screen.getByText("Add to Plan"));

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

  it("replaces a meal via edit flow (delete old + insert new)", async () => {
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
          single: vi.fn().mockResolvedValue({
            data: {
              id: "item-new",
              plan_id: "plan-1",
              recipe_id: null,
              day_of_week: 0,
              meal_type: "breakfast",
              custom_name: "Waffles",
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
      expect(screen.getByText("Pancakes")).toBeInTheDocument();
    });

    // Now set up delete mock + recipe creation for the replace flow
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "meal_plan_items") {
        return createMockQueryBuilder({
          eq: vi.fn().mockResolvedValue({ error: null }),
          single: vi.fn().mockResolvedValue({
            data: {
              id: "item-new",
              plan_id: "plan-1",
              recipe_id: "recipe-waffles",
              day_of_week: 0,
              meal_type: "breakfast",
              custom_name: null,
              custom_url: null,
              sort_order: 0,
              recipes: { name: "Waffles", url: null },
            },
            error: null,
          }),
        });
      }
      if (table === "recipes") {
        return createMockQueryBuilder({
          single: vi.fn().mockResolvedValue({
            data: { id: "recipe-waffles" },
            error: null,
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
    fireEvent.click(screen.getByText("Add to Plan"));

    await waitFor(() => {
      // Should show success for both delete and add
      expect(toast.success).toHaveBeenCalled();
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

    // Click the "View meal details" button
    fireEvent.click(screen.getByTitle("View meal details"));

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

    // Click the "View meal details" button
    fireEvent.click(screen.getByTitle("View meal details"));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/meals/event-new-456");
    });
  });

  it("replaces a meal via recipe tab edit flow (delete old + add recipe)", async () => {
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
          single: vi.fn().mockResolvedValue({
            data: {
              id: "item-new",
              plan_id: "plan-1",
              recipe_id: "r-1",
              day_of_week: 0,
              meal_type: "breakfast",
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
      expect(screen.getByText("Old Meal")).toBeInTheDocument();
    });

    // Set up delete mock for edit flow
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "meal_plan_items") {
        return createMockQueryBuilder({
          eq: vi.fn().mockResolvedValue({ error: null }),
          single: vi.fn().mockResolvedValue({
            data: {
              id: "item-new",
              plan_id: "plan-1",
              recipe_id: "r-1",
              day_of_week: 0,
              meal_type: "breakfast",
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
    fireEvent.click(screen.getByText("Add 1 to Plan"));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalled();
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

    // Click "View meal details" on the breakfast slot (day 0)
    const viewButtons = screen.getAllByTitle("View meal details");
    fireEvent.click(viewButtons[0]);

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

    // Click the "View meal details" button
    fireEvent.click(screen.getByTitle("View meal details"));

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
        screen.getByText("Add meals to your plan to generate a grocery list.")
      ).toBeInTheDocument();
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
        screen.getByText("Add meals to your plan to generate a grocery list.")
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
                  recipes: { name: "Chicken", url: null },
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
                  recipes: { name: "Chicken", url: null },
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
              data: [{ id: "recipe-1", name: "Chicken", url: null }],
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
              data: [{ id: "recipe-1", name: "No URL Recipe", url: null }],
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

      await waitFor(() => {
        expect(screen.getByText("Grocery List")).toBeInTheDocument();
      });

      // No parse button should be shown since the recipe has no URL
      // The GroceryListSection only shows parse buttons for recipes with URLs
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
                  recipes: { name: "Chicken", url: null },
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
              data: [{ id: "recipe-1", name: "Chicken", url: null }],
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
                  recipes: { name: "Chicken", url: null },
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
                  recipes: { name: "Soup", url: null },
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
                  recipes: { name: "Chicken", url: null },
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
              data: [{ id: "recipe-1", name: "Chicken", url: null }],
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
          screen.getByText("Add meals to your plan to generate a grocery list.")
        ).toBeInTheDocument();
      });
    });
  });
});
