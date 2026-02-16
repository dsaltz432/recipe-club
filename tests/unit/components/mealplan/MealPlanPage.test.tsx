import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@tests/utils";
import MealPlanPage from "@/components/mealplan/MealPlanPage";
import { toast } from "sonner";
import { isDevMode } from "@/lib/devMode";

// Mock Supabase
const mockSupabaseFrom = vi.fn();
const mockInvoke = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => mockSupabaseFrom(...args),
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
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

// Mock devMode
vi.mock("@/lib/devMode", () => ({
  isDevMode: vi.fn(() => true), // Use dev mode for tests
}));

const createMockQueryBuilder = (overrides: Record<string, unknown> = {}) => ({
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  upsert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  order: vi.fn().mockResolvedValue({ data: [], error: null }),
  limit: vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue({ data: null, error: null }),
  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  ...overrides,
});

describe("MealPlanPage", () => {
  const defaultProps = {
    userId: "user-123",
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock: create a new plan for the current week
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "user_preferences") {
        return createMockQueryBuilder({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        });
      }
      if (table === "meal_plans") {
        return createMockQueryBuilder({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          single: vi.fn().mockResolvedValue({
            data: { id: "plan-new" },
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
              custom_name: "Test Meal",
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
  });

  it("shows loading spinner initially", () => {
    // Make the plan load hang
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "user_preferences") {
        return createMockQueryBuilder({
          maybeSingle: vi.fn().mockReturnValue(new Promise(() => {})),
        });
      }
      if (table === "meal_plans") {
        return createMockQueryBuilder({
          maybeSingle: vi.fn().mockReturnValue(new Promise(() => {})),
        });
      }
      return createMockQueryBuilder();
    });

    render(<MealPlanPage {...defaultProps} />);

    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("renders Meal Plan header after loading", async () => {
    render(<MealPlanPage {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Meal Plan")).toBeInTheDocument();
    });
  });

  it("renders Preferences button", async () => {
    render(<MealPlanPage {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Preferences")).toBeInTheDocument();
    });
  });

  it("renders Get Suggestions button", async () => {
    render(<MealPlanPage {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Get Suggestions")).toBeInTheDocument();
    });
  });

  it("opens preferences dialog", async () => {
    render(<MealPlanPage {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Preferences")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Preferences"));

    expect(screen.getByText("Meal Preferences")).toBeInTheDocument();
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

  it("shows pending slot message when clicking an empty slot", async () => {
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

    expect(screen.getByText(/adding meal for/i)).toBeInTheDocument();
  });

  it("cancels pending slot", async () => {
    render(<MealPlanPage {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Meal Plan")).toBeInTheDocument();
    });

    // Click an empty meal slot
    const slotButtons = screen.getAllByRole("button").filter(
      (b) => b.textContent?.includes("Breakfast")
    );
    if (slotButtons.length > 0) {
      fireEvent.click(slotButtons[0]);
    }

    // Cancel
    fireEvent.click(screen.getByText("cancel"));

    expect(screen.queryByText(/adding meal for/i)).not.toBeInTheDocument();
  });

  it("gets mock suggestions in dev mode", async () => {
    render(<MealPlanPage {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Get Suggestions")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Get Suggestions"));

    await waitFor(() => {
      expect(screen.getByText("Mediterranean Quinoa Bowl")).toBeInTheDocument();
      expect(screen.getByText("Honey Garlic Salmon")).toBeInTheDocument();
    });
  });

  it("adds suggestion to plan with pending slot", async () => {
    render(<MealPlanPage {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Meal Plan")).toBeInTheDocument();
    });

    // Click an empty meal slot to set pending
    const slotButtons = screen.getAllByRole("button").filter(
      (b) => b.textContent?.includes("Dinner")
    );
    if (slotButtons.length > 0) {
      fireEvent.click(slotButtons[0]);
    }

    // Get suggestions
    fireEvent.click(screen.getByText("Get Suggestions"));

    await waitFor(() => {
      expect(screen.getByText("Mediterranean Quinoa Bowl")).toBeInTheDocument();
    });

    // Click Add to Plan
    const addButtons = screen.getAllByText("Add to Plan");
    fireEvent.click(addButtons[0]);

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalled();
    });
  });

  it("adds suggestion to next available dinner slot when no pending slot", async () => {
    render(<MealPlanPage {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Meal Plan")).toBeInTheDocument();
    });

    // Get suggestions first (no pending slot)
    fireEvent.click(screen.getByText("Get Suggestions"));

    await waitFor(() => {
      expect(screen.getByText("Mediterranean Quinoa Bowl")).toBeInTheDocument();
    });

    // Add to plan without pending slot
    const addButtons = screen.getAllByText("Add to Plan");
    fireEvent.click(addButtons[0]);

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalled();
    });
  });

  it("removes a meal item", async () => {
    // Mock plan with existing item
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "user_preferences") {
        return createMockQueryBuilder({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        });
      }
      if (table === "meal_plans") {
        return createMockQueryBuilder({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: "plan-1" },
            error: null,
          }),
          single: vi.fn().mockResolvedValue({
            data: { id: "plan-1" },
            error: null,
          }),
        });
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
      if (table === "user_preferences") {
        return createMockQueryBuilder({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        });
      }
      if (table === "meal_plans") {
        return createMockQueryBuilder({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: "plan-1" },
            error: null,
          }),
          single: vi.fn().mockResolvedValue({
            data: { id: "plan-1" },
            error: null,
          }),
        });
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
      if (table === "user_preferences") {
        return createMockQueryBuilder({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        });
      }
      if (table === "meal_plans") {
        return createMockQueryBuilder({
          maybeSingle: vi.fn().mockRejectedValue(new Error("DB error")),
        });
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
      if (table === "user_preferences") {
        return createMockQueryBuilder({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        });
      }
      if (table === "meal_plans") {
        return createMockQueryBuilder({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: "plan-existing" },
            error: null,
          }),
        });
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

  it("sends chat message and gets suggestions", async () => {
    render(<MealPlanPage {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Meal Plan")).toBeInTheDocument();
    });

    const chatInput = screen.getByPlaceholderText("Ask about meals...");
    fireEvent.change(chatInput, { target: { value: "Quick dinner ideas" } });
    fireEvent.keyDown(chatInput, { key: "Enter" });

    await waitFor(() => {
      expect(screen.getByText("Quick dinner ideas")).toBeInTheDocument();
      expect(screen.getByText("Mediterranean Quinoa Bowl")).toBeInTheDocument();
    });
  });

  it("renders week navigation", async () => {
    render(<MealPlanPage {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Meal Plan")).toBeInTheDocument();
    });

    // Should have day headers
    expect(screen.getByText("Sun")).toBeInTheDocument();
    expect(screen.getByText("Mon")).toBeInTheDocument();
  });

  it("handles add meal error", async () => {
    // Setup initial load
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "user_preferences") {
        return createMockQueryBuilder({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        });
      }
      if (table === "meal_plans") {
        return createMockQueryBuilder({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          single: vi.fn().mockResolvedValue({
            data: { id: "plan-new" },
            error: null,
          }),
        });
      }
      if (table === "meal_plan_items") {
        return createMockQueryBuilder({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: "Insert failed" },
          }),
        });
      }
      return createMockQueryBuilder();
    });

    render(<MealPlanPage {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Meal Plan")).toBeInTheDocument();
    });

    // Click slot to set pending
    const slotButtons = screen.getAllByRole("button").filter(
      (b) => b.textContent?.includes("Dinner")
    );
    if (slotButtons.length > 0) {
      fireEvent.click(slotButtons[0]);
    }

    // Get suggestions
    fireEvent.click(screen.getByText("Get Suggestions"));

    await waitFor(() => {
      expect(screen.getByText("Mediterranean Quinoa Bowl")).toBeInTheDocument();
    });

    // Try to add - should fail
    const addButtons = screen.getAllByText("Add to Plan");
    fireEvent.click(addButtons[0]);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to add meal");
    });
  });

  it("shows error when all dinner slots are filled and no pending slot", async () => {
    // Create items for all 7 dinner slots
    const filledItems = Array.from({ length: 7 }, (_, i) => ({
      id: `item-${i}`,
      plan_id: "plan-1",
      recipe_id: null,
      day_of_week: i,
      meal_type: "dinner",
      custom_name: `Dinner ${i}`,
      custom_url: null,
      sort_order: 0,
      recipes: null,
    }));

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "user_preferences") {
        return createMockQueryBuilder({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        });
      }
      if (table === "meal_plans") {
        return createMockQueryBuilder({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: "plan-1" },
            error: null,
          }),
        });
      }
      if (table === "meal_plan_items") {
        return createMockQueryBuilder({
          order: vi.fn().mockResolvedValue({ data: filledItems, error: null }),
        });
      }
      return createMockQueryBuilder();
    });

    render(<MealPlanPage {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Dinner 0")).toBeInTheDocument();
    });

    // Get suggestions
    fireEvent.click(screen.getByText("Get Suggestions"));

    await waitFor(() => {
      expect(screen.getByText("Mediterranean Quinoa Bowl")).toBeInTheDocument();
    });

    // Try to add without pending slot
    const addButtons = screen.getAllByText("Add to Plan");
    fireEvent.click(addButtons[0]);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("All dinner slots are filled. Click an empty slot first.");
    });
  });

  it("loads user preferences on mount", async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "user_preferences") {
        return createMockQueryBuilder({
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: "pref-1",
              user_id: "user-123",
              dietary_restrictions: ["Vegetarian"],
              cuisine_preferences: ["Italian"],
              disliked_ingredients: ["cilantro"],
              household_size: 3,
              cooking_skill: "beginner",
              max_cook_time_minutes: 30,
              updated_at: "2026-02-14T00:00:00Z",
            },
            error: null,
          }),
        });
      }
      if (table === "meal_plans") {
        return createMockQueryBuilder({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          single: vi.fn().mockResolvedValue({
            data: { id: "plan-new" },
            error: null,
          }),
        });
      }
      return createMockQueryBuilder({
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      });
    });

    render(<MealPlanPage {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Meal Plan")).toBeInTheDocument();
    });

    // Open preferences to verify they loaded
    fireEvent.click(screen.getByText("Preferences"));

    expect(screen.getByLabelText("Household Size")).toHaveValue(3);
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

  it("handles error when creating new plan", async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "user_preferences") {
        return createMockQueryBuilder({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        });
      }
      if (table === "meal_plans") {
        return createMockQueryBuilder({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: "Insert plan failed" },
          }),
        });
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
      if (table === "user_preferences") {
        return createMockQueryBuilder({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        });
      }
      if (table === "meal_plans") {
        return createMockQueryBuilder({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: "Plan creation failed" },
          }),
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

    // Get suggestions
    fireEvent.click(screen.getByText("Get Suggestions"));

    await waitFor(() => {
      expect(screen.getByText("Mediterranean Quinoa Bowl")).toBeInTheDocument();
    });

    // Try to add - should silently return because planId is null
    const addButtons = screen.getAllByText("Add to Plan");
    fireEvent.click(addButtons[0]);

    // No success or error toast should be called
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("gets suggestions from edge function in non-dev mode", async () => {
    vi.mocked(isDevMode).mockReturnValue(false);

    mockInvoke.mockResolvedValue({
      data: {
        success: true,
        suggestions: [
          {
            id: "s-1",
            name: "AI Pasta",
            cuisine: "Italian",
            timeEstimate: "20 min",
            reason: "Based on your preferences",
          },
        ],
      },
      error: null,
    });

    render(<MealPlanPage {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Get Suggestions")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Get Suggestions"));

    await waitFor(() => {
      expect(screen.getByText("AI Pasta")).toBeInTheDocument();
    });

    expect(mockInvoke).toHaveBeenCalledWith("generate-meal-suggestions", expect.any(Object));
  });

  it("handles chat response in non-dev mode", async () => {
    vi.mocked(isDevMode).mockReturnValue(false);

    mockInvoke.mockResolvedValue({
      data: {
        success: true,
        suggestions: [],
        chatResponse: "Here are your dinner ideas!",
      },
      error: null,
    });

    render(<MealPlanPage {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Meal Plan")).toBeInTheDocument();
    });

    const chatInput = screen.getByPlaceholderText("Ask about meals...");
    fireEvent.change(chatInput, { target: { value: "Give me ideas" } });
    fireEvent.keyDown(chatInput, { key: "Enter" });

    await waitFor(() => {
      expect(screen.getByText("Here are your dinner ideas!")).toBeInTheDocument();
    });
  });

  it("handles edge function error in non-dev mode", async () => {
    vi.mocked(isDevMode).mockReturnValue(false);

    mockInvoke.mockResolvedValue({
      data: null,
      error: { message: "Function failed" },
    });

    render(<MealPlanPage {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Get Suggestions")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Get Suggestions"));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to get suggestions");
    });
  });

  it("handles unsuccessful response in non-dev mode", async () => {
    vi.mocked(isDevMode).mockReturnValue(false);

    mockInvoke.mockResolvedValue({
      data: { success: false, error: "Rate limited" },
      error: null,
    });

    render(<MealPlanPage {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Get Suggestions")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Get Suggestions"));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to get suggestions");
    });
  });

  it("handles unsuccessful response with default message in non-dev mode", async () => {
    vi.mocked(isDevMode).mockReturnValue(false);

    mockInvoke.mockResolvedValue({
      data: { success: false },
      error: null,
    });

    render(<MealPlanPage {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Get Suggestions")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Get Suggestions"));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to get suggestions");
    });
  });

  it("adds suggestion with recipeId to plan", async () => {
    vi.mocked(isDevMode).mockReturnValue(false);

    mockInvoke.mockResolvedValue({
      data: {
        success: true,
        suggestions: [
          {
            id: "s-1",
            name: "Saved Recipe Dish",
            cuisine: "American",
            timeEstimate: "30 min",
            reason: "From your recipes",
            recipeId: "recipe-abc",
          },
        ],
      },
      error: null,
    });

    // Set up insert to return success with recipe data
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "user_preferences") {
        return createMockQueryBuilder({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        });
      }
      if (table === "meal_plans") {
        return createMockQueryBuilder({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          single: vi.fn().mockResolvedValue({
            data: { id: "plan-new" },
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
              recipe_id: "recipe-abc",
              day_of_week: 0,
              meal_type: "dinner",
              custom_name: null,
              custom_url: null,
              sort_order: 0,
              recipes: { name: "Saved Recipe Dish", url: null },
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

    // Get suggestions
    fireEvent.click(screen.getByText("Get Suggestions"));

    await waitFor(() => {
      expect(screen.getByText("Saved Recipe Dish")).toBeInTheDocument();
    });

    // Add to plan (no pending slot — goes to next available dinner)
    fireEvent.click(screen.getByText("Add to Plan"));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalled();
    });
  });

  it("adds suggestion with url but no recipeId to plan", async () => {
    vi.mocked(isDevMode).mockReturnValue(false);

    mockInvoke.mockResolvedValue({
      data: {
        success: true,
        suggestions: [
          {
            id: "s-2",
            name: "Web Recipe",
            cuisine: "Thai",
            timeEstimate: "25 min",
            reason: "Found online",
            url: "https://example.com/recipe",
          },
        ],
      },
      error: null,
    });

    // Set up insert to return success
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "user_preferences") {
        return createMockQueryBuilder({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        });
      }
      if (table === "meal_plans") {
        return createMockQueryBuilder({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          single: vi.fn().mockResolvedValue({
            data: { id: "plan-new" },
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
              custom_name: "Web Recipe",
              custom_url: "https://example.com/recipe",
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

    // Click a slot to set pending
    const slotButtons = screen.getAllByRole("button").filter(
      (b) => b.textContent?.includes("Dinner")
    );
    fireEvent.click(slotButtons[0]);

    // Get suggestions
    fireEvent.click(screen.getByText("Get Suggestions"));

    await waitFor(() => {
      expect(screen.getByText("Web Recipe")).toBeInTheDocument();
    });

    // Add to plan
    fireEvent.click(screen.getByText("Add to Plan"));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalled();
    });
  });

  it("handles null itemsData from order response", async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "user_preferences") {
        return createMockQueryBuilder({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        });
      }
      if (table === "meal_plans") {
        return createMockQueryBuilder({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: "plan-existing" },
            error: null,
          }),
        });
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
    expect(screen.getByText("Sun")).toBeInTheDocument();
  });

  it("maps item with no recipeName or customName as Unknown", async () => {
    vi.mocked(isDevMode).mockReturnValue(false);

    // Load a plan with an item that has neither recipeName nor customName
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "user_preferences") {
        return createMockQueryBuilder({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        });
      }
      if (table === "meal_plans") {
        return createMockQueryBuilder({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: "plan-1" },
            error: null,
          }),
        });
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

    mockInvoke.mockResolvedValue({
      data: {
        success: true,
        suggestions: [],
      },
      error: null,
    });

    render(<MealPlanPage {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Meal Plan")).toBeInTheDocument();
    });

    // Get suggestions to trigger currentPlanItems mapping with "Unknown" name
    fireEvent.click(screen.getByText("Get Suggestions"));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        "generate-meal-suggestions",
        expect.objectContaining({
          body: expect.objectContaining({
            currentPlanItems: [
              expect.objectContaining({ name: "Unknown" }),
            ],
          }),
        })
      );
    });
  });

  it("handles null suggestions in non-dev mode response", async () => {
    vi.mocked(isDevMode).mockReturnValue(false);

    mockInvoke.mockResolvedValue({
      data: {
        success: true,
        // suggestions is undefined — exercises (data.suggestions || [])
      },
      error: null,
    });

    render(<MealPlanPage {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Get Suggestions")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Get Suggestions"));

    // Should not crash — suggestions defaults to empty, showing the empty state
    await waitFor(() => {
      expect(screen.getByText(/Click "Get Suggestions"/)).toBeInTheDocument();
    });
  });
});
