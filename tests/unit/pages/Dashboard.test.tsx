import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockSupabaseFrom = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => mockSupabaseFrom(...args),
  },
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn().mockResolvedValue({
    id: "user-123",
    name: "Test User",
    email: "test@example.com",
    avatar_url: null,
  }),
  getAllowedUser: vi.fn().mockResolvedValue({ role: "admin" }),
  isAdmin: vi.fn().mockReturnValue(true),
  signOut: vi.fn(),
}));

vi.mock("@/components/home/HomeSection", () => ({
  default: () => <div data-testid="home-section" />,
}));
vi.mock("@/components/events/RecipeClubEvents", () => ({
  default: () => <div data-testid="events-section" />,
}));
vi.mock("@/components/recipes/RecipeHub", () => ({
  default: () => <div data-testid="recipe-hub" />,
}));
vi.mock("@/components/mealplan/MealPlanPage", () => ({
  default: () => <div data-testid="meal-plan" />,
}));
vi.mock("@/components/pantry/PantryDialog", () => ({
  default: () => <div data-testid="pantry-dialog" />,
}));

const createMockQueryBuilder = (overrides: Record<string, unknown> = {}) => {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    ...overrides,
  };
  return builder;
};

const setupMocks = (eventsCount = 5, recipesCount = 12) => {
  mockSupabaseFrom.mockImplementation((table: string) => {
    if (table === "scheduled_events") {
      return createMockQueryBuilder({
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        in: vi.fn().mockResolvedValue({ count: eventsCount, data: null, error: null }),
      });
    }
    if (table === "recipes") {
      return createMockQueryBuilder({
        select: vi.fn().mockResolvedValue({ count: recipesCount, data: null, error: null }),
      });
    }
    if (table === "ingredients") {
      return createMockQueryBuilder({
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      });
    }
    return createMockQueryBuilder();
  });
};

import Dashboard from "@/pages/Dashboard";

const renderDashboard = (route = "/dashboard") => {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/dashboard/:tab" element={<Dashboard />} />
      </Routes>
    </MemoryRouter>
  );
};

describe("Dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
  });

  it("shows tab labels on mobile (always visible)", async () => {
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByTestId("home-section")).toBeInTheDocument();
    });

    // All four tab labels should be in the DOM (not hidden)
    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.getByText("Events")).toBeInTheDocument();
    expect(screen.getByText("Recipes")).toBeInTheDocument();
    expect(screen.getByText("Meals")).toBeInTheDocument();
  });

  it("shows 'Club Events' and 'Club Recipes' labels in header", async () => {
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByTestId("home-section")).toBeInTheDocument();
    });

    // Desktop header labels
    const clubEventsLabels = screen.getAllByText("Club Events");
    expect(clubEventsLabels.length).toBeGreaterThanOrEqual(1);

    const clubRecipesLabels = screen.getAllByText("Club Recipes");
    expect(clubRecipesLabels.length).toBeGreaterThanOrEqual(1);
  });
});
