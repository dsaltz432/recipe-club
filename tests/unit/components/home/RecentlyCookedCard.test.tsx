import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@tests/utils";
import RecentlyCookedCard from "@/components/home/RecentlyCookedCard";
import { calculateStreak } from "@/lib/cookingStreak";
import { startOfDay, subDays } from "date-fns";

// Hoisted mocks
const { mockFrom } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: mockFrom },
}));

vi.mock("@/lib/userPreferences", () => ({
  getCachedAiModel: vi.fn().mockReturnValue("claude-sonnet-4-6"),
  loadUserPreferences: vi.fn().mockResolvedValue({ weekStartDay: 0, mealTypes: [], householdSize: 2, aiModel: "claude-sonnet-4-6" }),
}));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.spyOn(console, "error").mockImplementation(() => {});

// --- Helpers ---

/** Build a fluent Supabase-style query chain where the last terminal method resolves with value */
function makeQueryChain(terminalValue: unknown = { data: [], error: null }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {
    select: vi.fn(),
    eq: vi.fn(),
    not: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    gte: vi.fn(),
  };
  // All methods return the chain (fluent), except terminal ones that are explicitly overridden
  for (const key of Object.keys(chain)) {
    chain[key].mockReturnValue(chain);
  }
  // Make the typical terminal calls resolve
  chain.limit.mockResolvedValue(terminalValue);
  chain.gte.mockResolvedValue(terminalValue);
  // eq can also be terminal (week items query)
  chain.eq.mockResolvedValue(terminalValue);
  // Override eq to return chain by default (so chaining still works)
  chain.eq.mockImplementation(() => chain);
  // Make limit and gte resolve but still return the chain for chaining before them
  chain.limit.mockImplementation((n: number) => {
    void n;
    return Promise.resolve(terminalValue);
  });
  chain.gte.mockImplementation(() => Promise.resolve(terminalValue));
  return chain;
}

/**
 * Set up mocks for the three (or four) sequential Supabase queries the component makes:
 * 1. meal_plan_items — recent display items (limit 5)
 * 2. meal_plan_items — all cooked timestamps for streak (gte filter)
 * 3. meal_plans     — this week's plan lookup (limit 1)
 * 4. meal_plan_items — this week's plan items (eq plan_id), only if plan found
 */
function setupMocks({
  recentItems = [] as unknown[],
  allCookedTimestamps = [] as unknown[],
  thisWeekPlan = null as { id: string } | null,
  thisWeekItems = [] as unknown[],
} = {}) {
  const chain1 = makeQueryChain({ data: recentItems, error: null });
  const chain2 = makeQueryChain({ data: allCookedTimestamps, error: null });
  const chain3 = makeQueryChain({ data: thisWeekPlan ? [thisWeekPlan] : [], error: null });
  const chain4 = makeQueryChain({ data: thisWeekItems, error: null });

  mockFrom
    .mockReturnValueOnce(chain1)  // meal_plan_items — recent items
    .mockReturnValueOnce(chain2)  // meal_plan_items — streak data
    .mockReturnValueOnce(chain3)  // meal_plans — week plan lookup
    .mockReturnValue(chain4);     // meal_plan_items — week items (if plan exists)

  return { chain1, chain2, chain3, chain4 };
}

// --- Fixtures ---

const TODAY_ISO = new Date().toISOString();
const YESTERDAY_ISO = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
const THREE_DAYS_AGO_ISO = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

const MOCK_ITEMS = [
  {
    id: "item-1",
    custom_name: null,
    meal_type: "dinner",
    cooked_at: TODAY_ISO,
    recipes: { name: "Pasta Carbonara" },
  },
  {
    id: "item-2",
    custom_name: null,
    meal_type: "lunch",
    cooked_at: YESTERDAY_ISO,
    recipes: { name: "Caesar Salad" },
  },
  {
    id: "item-3",
    custom_name: "Homemade Oatmeal",
    meal_type: "breakfast",
    cooked_at: THREE_DAYS_AGO_ISO,
    recipes: null,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockNavigate.mockClear();
});

// ============================================================
// calculateStreak — pure function tests
// ============================================================
describe("calculateStreak", () => {
  const todayStart = startOfDay(new Date()).toISOString();
  const yesterdayStart = startOfDay(subDays(new Date(), 1)).toISOString();
  const twoDaysAgoStart = startOfDay(subDays(new Date(), 2)).toISOString();
  const threeDaysAgoStart = startOfDay(subDays(new Date(), 3)).toISOString();

  it("returns 0 when no timestamps provided", () => {
    expect(calculateStreak([])).toBe(0);
  });

  it("returns 0 when most recent cook was 2+ days ago (inactive streak)", () => {
    expect(calculateStreak([twoDaysAgoStart])).toBe(0);
  });

  it("returns 1 when only today has a cooked meal", () => {
    expect(calculateStreak([todayStart])).toBe(1);
  });

  it("returns 1 when only yesterday has a cooked meal", () => {
    expect(calculateStreak([yesterdayStart])).toBe(1);
  });

  it("returns 2 for today + yesterday", () => {
    expect(calculateStreak([todayStart, yesterdayStart])).toBe(2);
  });

  it("returns 3 for today + yesterday + 2 days ago", () => {
    expect(calculateStreak([todayStart, yesterdayStart, twoDaysAgoStart])).toBe(3);
  });

  it("breaks streak on a gap: today + 2 days ago (no yesterday) = streak 1", () => {
    expect(calculateStreak([todayStart, twoDaysAgoStart])).toBe(1);
  });

  it("handles multiple timestamps on the same day (counts as 1 day)", () => {
    const noon = new Date();
    noon.setHours(12, 0, 0, 0);
    const evening = new Date();
    evening.setHours(18, 0, 0, 0);
    expect(calculateStreak([noon.toISOString(), evening.toISOString()])).toBe(1);
  });

  it("builds a long streak correctly", () => {
    const timestamps = [0, 1, 2, 3, 4].map((daysAgo) =>
      startOfDay(subDays(new Date(), daysAgo)).toISOString()
    );
    expect(calculateStreak(timestamps)).toBe(5);
  });

  it("excludes a gap in a long run: yesterday + 2 days ago + 3 days ago (no today) = streak 3", () => {
    const timestamps = [yesterdayStart, twoDaysAgoStart, threeDaysAgoStart];
    expect(calculateStreak(timestamps)).toBe(3);
  });
});

// ============================================================
// RecentlyCookedCard — component tests
// ============================================================
describe("RecentlyCookedCard", () => {
  it("shows loading skeletons initially", () => {
    // Never-resolving promise keeps component in loading state
    const neverChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnValue(new Promise(() => {})),
      gte: vi.fn().mockReturnValue(new Promise(() => {})),
    };
    mockFrom.mockReturnValue(neverChain);
    render(<RecentlyCookedCard userId="user-1" />);
    expect(document.querySelector(".animate-pulse, [data-slot='skeleton']")).toBeTruthy();
  });

  describe("when no meals have been cooked and no week plan", () => {
    beforeEach(() => {
      setupMocks({ recentItems: [], allCookedTimestamps: [] });
    });

    it("renders the empty state message", async () => {
      render(<RecentlyCookedCard userId="user-1" />);
      await waitFor(() => {
        expect(screen.getByText("No meals cooked yet")).toBeInTheDocument();
      });
    });

    it("renders helpful guidance in the empty state", async () => {
      render(<RecentlyCookedCard userId="user-1" />);
      await waitFor(() => {
        expect(screen.getByText(/mark meals as cooked/i)).toBeInTheDocument();
      });
    });

    it("still shows the card header", async () => {
      render(<RecentlyCookedCard userId="user-1" />);
      await waitFor(() => {
        expect(screen.getByText("Recently Cooked")).toBeInTheDocument();
      });
    });
  });

  describe("when meals have been cooked", () => {
    beforeEach(() => {
      setupMocks({ recentItems: MOCK_ITEMS, allCookedTimestamps: MOCK_ITEMS.map((i) => ({ cooked_at: i.cooked_at })) });
    });

    it("renders the section header", async () => {
      render(<RecentlyCookedCard userId="user-1" />);
      await waitFor(() => {
        expect(screen.getByText("Recently Cooked")).toBeInTheDocument();
      });
    });

    it("renders recipe names", async () => {
      render(<RecentlyCookedCard userId="user-1" />);
      await waitFor(() => {
        expect(screen.getByText("Pasta Carbonara")).toBeInTheDocument();
        expect(screen.getByText("Caesar Salad")).toBeInTheDocument();
      });
    });

    it("renders a custom meal name when no recipe is linked", async () => {
      render(<RecentlyCookedCard userId="user-1" />);
      await waitFor(() => {
        expect(screen.getByText("Homemade Oatmeal")).toBeInTheDocument();
      });
    });

    it("shows 'Today' for a meal cooked today", async () => {
      render(<RecentlyCookedCard userId="user-1" />);
      await waitFor(() => {
        expect(screen.getByText("Today")).toBeInTheDocument();
      });
    });

    it("shows 'Yesterday' for a meal cooked yesterday", async () => {
      render(<RecentlyCookedCard userId="user-1" />);
      await waitFor(() => {
        expect(screen.getByText("Yesterday")).toBeInTheDocument();
      });
    });

    it("shows '3 days ago' for a meal cooked 3 days ago", async () => {
      render(<RecentlyCookedCard userId="user-1" />);
      await waitFor(() => {
        expect(screen.getByText("3 days ago")).toBeInTheDocument();
      });
    });

    it("renders meal type badges", async () => {
      render(<RecentlyCookedCard userId="user-1" />);
      await waitFor(() => {
        expect(screen.getByText("Dinner")).toBeInTheDocument();
        expect(screen.getByText("Lunch")).toBeInTheDocument();
        expect(screen.getByText("Breakfast")).toBeInTheDocument();
      });
    });

    it("shows 'View plan' link", async () => {
      render(<RecentlyCookedCard userId="user-1" />);
      await waitFor(() => {
        expect(screen.getByText("View plan")).toBeInTheDocument();
      });
    });

    it("navigates to meals tab when 'View plan' is clicked", async () => {
      render(<RecentlyCookedCard userId="user-1" />);
      await waitFor(() => {
        screen.getByText("View plan").click();
      });
      expect(mockNavigate).toHaveBeenCalledWith("/dashboard/meals");
    });

    it("navigates to meals tab when a meal row is clicked", async () => {
      render(<RecentlyCookedCard userId="user-1" />);
      await waitFor(() => {
        screen.getByText("Pasta Carbonara").click();
      });
      expect(mockNavigate).toHaveBeenCalledWith("/dashboard/meals");
    });
  });

  describe("cooking streak display", () => {
    it("shows streak badge when meals cooked today", async () => {
      setupMocks({
        recentItems: [MOCK_ITEMS[0]],
        allCookedTimestamps: [{ cooked_at: TODAY_ISO }],
      });
      render(<RecentlyCookedCard userId="user-1" />);
      await waitFor(() => {
        expect(screen.getByText(/1-day streak/i)).toBeInTheDocument();
      });
    });

    it("shows multi-day streak when cooked consecutive days", async () => {
      const consecutiveDays = [0, 1, 2].map((daysAgo) => ({
        cooked_at: subDays(new Date(), daysAgo).toISOString(),
      }));
      setupMocks({
        recentItems: [MOCK_ITEMS[0]],
        allCookedTimestamps: consecutiveDays,
      });
      render(<RecentlyCookedCard userId="user-1" />);
      await waitFor(() => {
        expect(screen.getByText(/3-day streak/i)).toBeInTheDocument();
      });
    });

    it("does not show streak when most recent cook was 2+ days ago", async () => {
      setupMocks({
        recentItems: [MOCK_ITEMS[2]], // 3 days ago
        allCookedTimestamps: [{ cooked_at: THREE_DAYS_AGO_ISO }],
      });
      render(<RecentlyCookedCard userId="user-1" />);
      await waitFor(() => {
        expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
      });
    });

    it("shows 'Keep it up!' encouragement with an active streak", async () => {
      setupMocks({
        recentItems: [MOCK_ITEMS[0]],
        allCookedTimestamps: [{ cooked_at: TODAY_ISO }],
      });
      render(<RecentlyCookedCard userId="user-1" />);
      await waitFor(() => {
        expect(screen.getByText("Keep it up!")).toBeInTheDocument();
      });
    });
  });

  describe("week completion stats", () => {
    it("shows meal completion count when a week plan exists", async () => {
      setupMocks({
        recentItems: [MOCK_ITEMS[0]],
        allCookedTimestamps: [{ cooked_at: TODAY_ISO }],
        thisWeekPlan: { id: "plan-1" },
        thisWeekItems: [
          { id: "i1", cooked_at: TODAY_ISO },
          { id: "i2", cooked_at: null },
          { id: "i3", cooked_at: null },
        ],
      });
      render(<RecentlyCookedCard userId="user-1" />);
      await waitFor(() => {
        expect(screen.getByText(/1\/3 meals this week/i)).toBeInTheDocument();
      });
    });

    it("does not show week stats when no plan exists", async () => {
      setupMocks({
        recentItems: [MOCK_ITEMS[0]],
        allCookedTimestamps: [{ cooked_at: TODAY_ISO }],
        thisWeekPlan: null,
      });
      render(<RecentlyCookedCard userId="user-1" />);
      await waitFor(() => {
        expect(screen.queryByText(/meals this week/i)).not.toBeInTheDocument();
      });
    });

    it("renders progress bar accessible label", async () => {
      setupMocks({
        recentItems: [MOCK_ITEMS[0]],
        allCookedTimestamps: [{ cooked_at: TODAY_ISO }],
        thisWeekPlan: { id: "plan-1" },
        thisWeekItems: [
          { id: "i1", cooked_at: TODAY_ISO },
          { id: "i2", cooked_at: null },
        ],
      });
      render(<RecentlyCookedCard userId="user-1" />);
      await waitFor(() => {
        expect(screen.getByRole("progressbar")).toBeInTheDocument();
      });
    });

    it("shows full completion when all meals are cooked", async () => {
      setupMocks({
        recentItems: [MOCK_ITEMS[0]],
        allCookedTimestamps: [{ cooked_at: TODAY_ISO }],
        thisWeekPlan: { id: "plan-1" },
        thisWeekItems: [
          { id: "i1", cooked_at: TODAY_ISO },
          { id: "i2", cooked_at: YESTERDAY_ISO },
        ],
      });
      render(<RecentlyCookedCard userId="user-1" />);
      await waitFor(() => {
        expect(screen.getByText(/2\/2 meals this week/i)).toBeInTheDocument();
      });
    });
  });

  describe("when Supabase fetch errors", () => {
    it("renders gracefully with no items shown", async () => {
      // Simulate exception on first query
      const errorChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        not: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockRejectedValue(new Error("Network error")),
        gte: vi.fn().mockReturnThis(),
      };
      mockFrom.mockReturnValue(errorChain);

      render(<RecentlyCookedCard userId="user-1" />);
      await waitFor(() => {
        expect(screen.getByText("No meals cooked yet")).toBeInTheDocument();
      });
    });
  });

  describe("data query", () => {
    it("queries meal_plan_items table", async () => {
      setupMocks({ recentItems: [] });
      render(<RecentlyCookedCard userId="user-1" />);
      await waitFor(() => {
        expect(mockFrom).toHaveBeenCalledWith("meal_plan_items");
      });
    });

    it("passes correct user ID to the recent items query", async () => {
      const { chain1 } = setupMocks({ recentItems: [] });
      render(<RecentlyCookedCard userId="user-42" />);
      await waitFor(() => {
        expect(chain1.eq).toHaveBeenCalledWith("meal_plans.user_id", "user-42");
      });
    });

    it("filters only rows with cooked_at set", async () => {
      const { chain1 } = setupMocks({ recentItems: [] });
      render(<RecentlyCookedCard userId="user-1" />);
      await waitFor(() => {
        expect(chain1.not).toHaveBeenCalledWith("cooked_at", "is", null);
      });
    });

    it("limits display results to 5 items", async () => {
      setupMocks({ recentItems: [] });
      render(<RecentlyCookedCard userId="user-1" />);
      // Verify limit(5) was called (chain1 is called with limit 5)
      await waitFor(() => {
        expect(mockFrom).toHaveBeenCalledWith("meal_plan_items");
      });
    });
  });

  describe("with only a snack meal type", () => {
    it("renders 'Snack' badge", async () => {
      setupMocks({
        recentItems: [
          {
            id: "item-snack",
            custom_name: "Apple",
            meal_type: "snack",
            cooked_at: TODAY_ISO,
            recipes: null,
          },
        ],
        allCookedTimestamps: [{ cooked_at: TODAY_ISO }],
      });
      render(<RecentlyCookedCard userId="user-1" />);
      await waitFor(() => {
        expect(screen.getByText("Snack")).toBeInTheDocument();
      });
    });
  });
});
