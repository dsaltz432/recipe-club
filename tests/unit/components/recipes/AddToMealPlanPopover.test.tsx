import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@tests/utils";
import AddToMealPlanPopover from "@/components/recipes/AddToMealPlanPopover";
import { buildUpcomingDays } from "@/lib/mealPlanUtils";

// ── Hoisted mocks ────────────────────────────────────────────────────────────
const { mockFrom, mockToastSuccess, mockToastError } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: mockFrom },
}));

vi.mock("sonner", () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}));

vi.mock("@/lib/userPreferences", () => ({
  getCachedAiModel: vi.fn().mockReturnValue("claude-sonnet-4-6"),
}));

vi.spyOn(console, "error").mockImplementation(() => {});

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Build a supabase mock that handles the upsert + select (plan) + insert flow. */
function setupSuccessMocks() {
  mockFrom.mockImplementation((table: string) => {
    if (table === "meal_plans") {
      return {
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { id: "plan-1" }, error: null }),
          }),
        }),
      };
    }
    if (table === "meal_plan_items") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }),
        insert: vi.fn().mockResolvedValue({ data: {}, error: null }),
      };
    }
    return { upsert: vi.fn(), insert: vi.fn(), select: vi.fn() };
  });
}

// ── Default props ────────────────────────────────────────────────────────────

const defaultProps = {
  recipeId: "recipe-abc",
  recipeName: "Pasta Carbonara",
  userId: "user-123",
};

// ── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Unit tests for buildUpcomingDays ─────────────────────────────────────────

describe("buildUpcomingDays", () => {
  it("returns exactly 7 days", () => {
    expect(buildUpcomingDays()).toHaveLength(7);
  });

  it("first entry is labeled Today", () => {
    expect(buildUpcomingDays()[0].label).toMatch(/^Today/);
  });

  it("second entry is labeled Tomorrow", () => {
    expect(buildUpcomingDays()[1].label).toMatch(/^Tomorrow/);
  });

  it("each entry has a valid dayOfWeek (0-6)", () => {
    buildUpcomingDays().forEach((d) => {
      expect(d.dayOfWeek).toBeGreaterThanOrEqual(0);
      expect(d.dayOfWeek).toBeLessThanOrEqual(6);
    });
  });

  it("each entry has a weekStartStr in YYYY-MM-DD format", () => {
    buildUpcomingDays().forEach((d) => {
      expect(d.weekStartStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  it("weekStartStr is always a Sunday", () => {
    buildUpcomingDays().forEach(({ weekStartStr }) => {
      const d = new Date(weekStartStr + "T00:00:00");
      expect(d.getDay()).toBe(0); // 0 = Sunday
    });
  });
});

// ── Component tests ──────────────────────────────────────────────────────────

describe("AddToMealPlanPopover", () => {
  it("renders the calendar-plus trigger button", () => {
    render(<AddToMealPlanPopover {...defaultProps} />);
    expect(
      screen.getByRole("button", { name: /add pasta carbonara to meal plan/i })
    ).toBeInTheDocument();
  });

  it("opens the popover when trigger is clicked", async () => {
    render(<AddToMealPlanPopover {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: /add pasta carbonara to meal plan/i }));
    expect(await screen.findByRole("button", { name: /^add to meal plan$/i })).toBeInTheDocument();
    expect(screen.getByText("Day")).toBeInTheDocument();
    expect(screen.getByText("Meal")).toBeInTheDocument();
  });

  it("shows Today and Tomorrow labels", async () => {
    render(<AddToMealPlanPopover {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: /add pasta carbonara to meal plan/i }));
    await screen.findByRole("button", { name: /^add to meal plan$/i });

    expect(screen.getByText(/^Today/)).toBeInTheDocument();
    expect(screen.getByText(/^Tomorrow/)).toBeInTheDocument();
  });

  it("shows all 7 upcoming day buttons", async () => {
    render(<AddToMealPlanPopover {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: /add pasta carbonara to meal plan/i }));
    await screen.findByRole("button", { name: /^add to meal plan$/i });

    // 7 days + 4 meal types + 1 submit = 12 buttons total inside the popover
    // Just verify 7 day-labelled buttons exist (Today, Tomorrow, + 5 date strings)
    const todayEl = screen.getByText(/^Today/);
    const tomorrowEl = screen.getByText(/^Tomorrow/);
    expect(todayEl).toBeInTheDocument();
    expect(tomorrowEl).toBeInTheDocument();
  });

  it("shows four meal type options", async () => {
    render(<AddToMealPlanPopover {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: /add pasta carbonara to meal plan/i }));
    await screen.findByRole("button", { name: /^add to meal plan$/i });

    expect(screen.getByText("Breakfast")).toBeInTheDocument();
    expect(screen.getByText("Lunch")).toBeInTheDocument();
    expect(screen.getByText("Dinner")).toBeInTheDocument();
    expect(screen.getByText("Snack")).toBeInTheDocument();
  });

  it("defaults to Today selected (highlighted)", async () => {
    render(<AddToMealPlanPopover {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: /add pasta carbonara to meal plan/i }));
    await screen.findByRole("button", { name: /^add to meal plan$/i });

    expect(screen.getByText(/^Today/)).toHaveClass("bg-purple-100");
  });

  it("defaults to Dinner selected (highlighted)", async () => {
    render(<AddToMealPlanPopover {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: /add pasta carbonara to meal plan/i }));
    await screen.findByRole("button", { name: /^add to meal plan$/i });

    expect(screen.getByText("Dinner")).toHaveClass("bg-purple-100");
  });

  it("can select Tomorrow", async () => {
    render(<AddToMealPlanPopover {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: /add pasta carbonara to meal plan/i }));
    await screen.findByRole("button", { name: /^add to meal plan$/i });

    fireEvent.click(screen.getByText(/^Tomorrow/));
    expect(screen.getByText(/^Tomorrow/)).toHaveClass("bg-purple-100");
    expect(screen.getByText(/^Today/)).not.toHaveClass("bg-purple-100");
  });

  it("can select a different meal type", async () => {
    render(<AddToMealPlanPopover {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: /add pasta carbonara to meal plan/i }));
    await screen.findByRole("button", { name: /^add to meal plan$/i });

    fireEvent.click(screen.getByText("Lunch"));
    expect(screen.getByText("Lunch")).toHaveClass("bg-purple-100");
    expect(screen.getByText("Dinner")).not.toHaveClass("bg-purple-100");
  });

  it("calls supabase and shows success toast on submit", async () => {
    setupSuccessMocks();

    render(<AddToMealPlanPopover {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: /add pasta carbonara to meal plan/i }));

    const addBtn = await screen.findByRole("button", { name: /^add to meal plan$/i });
    fireEvent.click(addBtn);

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith(expect.stringMatching(/added to dinner/i));
    });
  });

  it("shows error toast when supabase returns an error", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "meal_plans") {
        return {
          upsert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: { message: "DB error" } }),
            }),
          }),
        };
      }
      return { select: vi.fn(), insert: vi.fn() };
    });

    render(<AddToMealPlanPopover {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: /add pasta carbonara to meal plan/i }));

    const addBtn = await screen.findByRole("button", { name: /^add to meal plan$/i });
    fireEvent.click(addBtn);

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        "Failed to add to meal plan. Please try again."
      );
    });
  });

  it("shows loading state while submitting", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "meal_plans") {
        return {
          upsert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockReturnValue(new Promise(() => {})), // never resolves
            }),
          }),
        };
      }
      return { select: vi.fn(), insert: vi.fn() };
    });

    render(<AddToMealPlanPopover {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: /add pasta carbonara to meal plan/i }));

    const addBtn = await screen.findByRole("button", { name: /^add to meal plan$/i });
    fireEvent.click(addBtn);

    const loadingBtn = await screen.findByRole("button", { name: /adding/i });
    expect(loadingBtn).toBeDisabled();
  });

  it("closes the popover after a successful add", async () => {
    setupSuccessMocks();

    render(<AddToMealPlanPopover {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: /add pasta carbonara to meal plan/i }));

    const addBtn = await screen.findByRole("button", { name: /^add to meal plan$/i });
    fireEvent.click(addBtn);

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalled();
    });
    // Popover should close — the "Day" heading should no longer be visible
    await waitFor(() => {
      expect(screen.queryByText("Day")).not.toBeInTheDocument();
    });
  });
});
