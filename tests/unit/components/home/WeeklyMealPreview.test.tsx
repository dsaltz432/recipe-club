import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@tests/utils";
import WeeklyMealPreview from "@/components/home/WeeklyMealPreview";

// Hoisted mocks
const { mockFrom, mockLoadUserPreferences } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockLoadUserPreferences: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: mockFrom },
}));

vi.mock("@/lib/userPreferences", () => ({
  loadUserPreferences: (...args: unknown[]) => mockLoadUserPreferences(...args),
  getCachedAiModel: vi.fn().mockReturnValue("claude-sonnet-4-6"),
}));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.spyOn(console, "error").mockImplementation(() => {});

// --- Helpers ---

function makePlansChain(plans: unknown[]) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: plans, error: null }),
          }),
        }),
      }),
    }),
  };
}

function makeItemsChain(items: unknown[]) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: items, error: null }),
      }),
    }),
  };
}

function setupMocks({
  plans = [{ id: "plan-1" }] as unknown[],
  items = [] as unknown[],
} = {}) {
  mockLoadUserPreferences.mockResolvedValue({ weekStartDay: 0, mealTypes: [], householdSize: 2, aiModel: "claude-sonnet-4-6" });

  let callCount = 0;
  mockFrom.mockImplementation(() => {
    callCount++;
    if (callCount === 1) return makePlansChain(plans);
    return makeItemsChain(items);
  });
}

const MOCK_ITEMS_TODAY = [
  {
    id: "item-1",
    plan_id: "plan-1",
    recipe_id: "recipe-1",
    day_of_week: new Date().getDay(),
    meal_type: "dinner",
    custom_name: null,
    custom_url: null,
    sort_order: 0,
    recipes: { name: "Pasta Carbonara" },
  },
  {
    id: "item-2",
    plan_id: "plan-1",
    recipe_id: "recipe-2",
    day_of_week: new Date().getDay(),
    meal_type: "lunch",
    custom_name: null,
    custom_url: null,
    sort_order: 1,
    recipes: { name: "Caesar Salad" },
  },
];

const TOMORROW_DOW = (new Date().getDay() + 1) % 7;
const MOCK_ITEMS_TOMORROW = [
  {
    id: "item-3",
    plan_id: "plan-1",
    recipe_id: null,
    day_of_week: TOMORROW_DOW,
    meal_type: "breakfast",
    custom_name: "Oatmeal",
    custom_url: null,
    sort_order: 0,
    recipes: null,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockNavigate.mockClear();
});

describe("WeeklyMealPreview", () => {
  it("shows loading skeletons initially", () => {
    // Keep promises pending to observe loading state
    mockLoadUserPreferences.mockReturnValue(new Promise(() => {}));
    render(<WeeklyMealPreview userId="user-1" />);
    // Skeleton elements don't have text, but the card should be present
    expect(document.querySelector(".animate-pulse, [class*='skeleton']")).toBeTruthy();
  });

  describe("when no plan exists for this week", () => {
    beforeEach(() => {
      setupMocks({ plans: [] });
    });

    it("renders the empty state message", async () => {
      render(<WeeklyMealPreview userId="user-1" />);
      await waitFor(() => {
        expect(screen.getByText("No meals planned this week")).toBeInTheDocument();
      });
    });

    it("renders the empty state CTA button", async () => {
      render(<WeeklyMealPreview userId="user-1" />);
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /plan meals/i })).toBeInTheDocument();
      });
    });

    it("navigates to meals tab when CTA is clicked", async () => {
      render(<WeeklyMealPreview userId="user-1" />);
      await waitFor(() => {
        screen.getByRole("button", { name: /plan meals/i }).click();
      });
      expect(mockNavigate).toHaveBeenCalledWith("/dashboard/meals");
    });
  });

  describe("when plan exists but has no items", () => {
    beforeEach(() => {
      setupMocks({ plans: [{ id: "plan-1" }], items: [] });
    });

    it("renders the empty state message", async () => {
      render(<WeeklyMealPreview userId="user-1" />);
      await waitFor(() => {
        expect(screen.getByText("No meals planned this week")).toBeInTheDocument();
      });
    });
  });

  describe("when today has meals planned", () => {
    beforeEach(() => {
      setupMocks({ plans: [{ id: "plan-1" }], items: MOCK_ITEMS_TODAY });
    });

    it("renders the section header", async () => {
      render(<WeeklyMealPreview userId="user-1" />);
      await waitFor(() => {
        expect(screen.getByText("This Week's Meals")).toBeInTheDocument();
      });
    });

    it("shows Today label with date", async () => {
      render(<WeeklyMealPreview userId="user-1" />);
      await waitFor(() => {
        expect(screen.getByText(/Today ·/i)).toBeInTheDocument();
      });
    });

    it("renders today's recipes", async () => {
      render(<WeeklyMealPreview userId="user-1" />);
      await waitFor(() => {
        expect(screen.getByText("Pasta Carbonara")).toBeInTheDocument();
        expect(screen.getByText("Caesar Salad")).toBeInTheDocument();
      });
    });

    it("shows meal types for today's meals", async () => {
      render(<WeeklyMealPreview userId="user-1" />);
      await waitFor(() => {
        expect(screen.getByText("Dinner")).toBeInTheDocument();
        expect(screen.getByText("Lunch")).toBeInTheDocument();
      });
    });

    it("shows 'View full plan' link", async () => {
      render(<WeeklyMealPreview userId="user-1" />);
      await waitFor(() => {
        expect(screen.getByText("View full plan")).toBeInTheDocument();
      });
    });

    it("navigates to meals tab when 'View full plan' is clicked", async () => {
      render(<WeeklyMealPreview userId="user-1" />);
      await waitFor(() => {
        screen.getByText("View full plan").click();
      });
      expect(mockNavigate).toHaveBeenCalledWith("/dashboard/meals");
    });
  });

  describe("when a future day has meals planned", () => {
    beforeEach(() => {
      setupMocks({ plans: [{ id: "plan-1" }], items: MOCK_ITEMS_TOMORROW });
    });

    it("renders the future day with short day name", async () => {
      render(<WeeklyMealPreview userId="user-1" />);
      await waitFor(() => {
        expect(screen.getByText("Oatmeal")).toBeInTheDocument();
      });
    });

    it("renders meal type prefix in compact format", async () => {
      render(<WeeklyMealPreview userId="user-1" />);
      await waitFor(() => {
        expect(screen.getByText(/Breakfast:/i)).toBeInTheDocument();
      });
    });
  });

  describe("with custom meal name (no recipe)", () => {
    beforeEach(() => {
      setupMocks({
        plans: [{ id: "plan-1" }],
        items: [
          {
            id: "item-custom",
            plan_id: "plan-1",
            recipe_id: null,
            day_of_week: new Date().getDay(),
            meal_type: "dinner",
            custom_name: "Homemade Pizza",
            custom_url: null,
            sort_order: 0,
            recipes: null,
          },
        ],
      });
    });

    it("shows custom name when no recipe is linked", async () => {
      render(<WeeklyMealPreview userId="user-1" />);
      await waitFor(() => {
        expect(screen.getByText("Homemade Pizza")).toBeInTheDocument();
      });
    });
  });

  describe("with Monday week start preference", () => {
    it("still loads and renders correctly", async () => {
      mockLoadUserPreferences.mockResolvedValue({
        weekStartDay: 1,
        mealTypes: [],
        householdSize: 2,
        aiModel: "claude-sonnet-4-6",
      });

      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return makePlansChain([{ id: "plan-1" }]);
        return makeItemsChain([]);
      });

      render(<WeeklyMealPreview userId="user-1" />);
      await waitFor(() => {
        expect(screen.getByText("No meals planned this week")).toBeInTheDocument();
      });
    });
  });

  describe("when Supabase fetch errors", () => {
    it("renders the empty state gracefully", async () => {
      mockLoadUserPreferences.mockRejectedValue(new Error("Network error"));
      render(<WeeklyMealPreview userId="user-1" />);
      await waitFor(() => {
        // Should gracefully degrade — either show empty state or nothing
        // At minimum, loading state should be gone
        expect(screen.queryByText("This Week's Meals")).not.toBeInTheDocument();
      });
    });
  });
});
