import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@tests/utils";
import RecentlyCookedCard from "@/components/home/RecentlyCookedCard";

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

function makeQueryChain(resolvedValue: unknown) {
  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    not: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
  };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.not.mockReturnValue(chain);
  chain.order.mockReturnValue(chain);
  chain.limit.mockResolvedValue(resolvedValue);
  return chain;
}

function setupMocks(items: unknown[] = []) {
  const chain = makeQueryChain({ data: items, error: null });
  mockFrom.mockReturnValue(chain);
  return chain;
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

describe("RecentlyCookedCard", () => {
  it("shows loading skeletons initially", () => {
    makeQueryChain(new Promise(() => {}));
    mockFrom.mockReturnValue(makeQueryChain(new Promise(() => {})));
    render(<RecentlyCookedCard userId="user-1" />);
    // Skeleton divs are present while loading
    expect(document.querySelector(".animate-pulse, [data-slot='skeleton']")).toBeTruthy();
  });

  describe("when no meals have been cooked", () => {
    beforeEach(() => {
      setupMocks([]);
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
      setupMocks(MOCK_ITEMS);
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

  describe("when Supabase fetch errors", () => {
    it("renders gracefully with no items shown", async () => {
      const chain = makeQueryChain({ data: null, error: null });
      // Simulate an exception being thrown
      chain.limit.mockRejectedValue(new Error("Network error"));
      mockFrom.mockReturnValue(chain);

      render(<RecentlyCookedCard userId="user-1" />);
      await waitFor(() => {
        expect(screen.getByText("No meals cooked yet")).toBeInTheDocument();
      });
    });
  });

  describe("data query", () => {
    it("queries meal_plan_items table", async () => {
      setupMocks([]);
      render(<RecentlyCookedCard userId="user-1" />);
      await waitFor(() => {
        expect(mockFrom).toHaveBeenCalledWith("meal_plan_items");
      });
    });

    it("passes correct user ID to the query", async () => {
      const chain = setupMocks([]);
      render(<RecentlyCookedCard userId="user-42" />);
      await waitFor(() => {
        expect(chain.eq).toHaveBeenCalledWith("meal_plans.user_id", "user-42");
      });
    });

    it("filters only rows with cooked_at set", async () => {
      const chain = setupMocks([]);
      render(<RecentlyCookedCard userId="user-1" />);
      await waitFor(() => {
        expect(chain.not).toHaveBeenCalledWith("cooked_at", "is", null);
      });
    });

    it("limits results to 5 items", async () => {
      const chain = setupMocks([]);
      render(<RecentlyCookedCard userId="user-1" />);
      await waitFor(() => {
        expect(chain.limit).toHaveBeenCalledWith(5);
      });
    });
  });

  describe("with only a snack meal type", () => {
    it("renders 'Snack' badge", async () => {
      setupMocks([
        {
          id: "item-snack",
          custom_name: "Apple",
          meal_type: "snack",
          cooked_at: TODAY_ISO,
          recipes: null,
        },
      ]);
      render(<RecentlyCookedCard userId="user-1" />);
      await waitFor(() => {
        expect(screen.getByText("Snack")).toBeInTheDocument();
      });
    });
  });
});
