import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@tests/utils";
import PersonalEventsList from "@/components/events/PersonalEventsList";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockSupabase = {
  from: vi.fn(),
};
vi.mock("@/integrations/supabase/client", () => ({
  supabase: new Proxy(
    {},
    {
      get: (_target, prop) => {
        if (prop === "from") return mockSupabase.from;
        return undefined;
      },
    }
  ),
}));

const mockEventsChain = (events: unknown[]) => {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.neq = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockResolvedValue({ data: events, error: null });
  return chain;
};

const mockRecipesChain = (recipes: unknown[]) => {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.in = vi.fn().mockResolvedValue({ data: recipes, error: null });
  return chain;
};

const mockMealPlanChain = (linkedItems: unknown[]) => {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.in = vi.fn().mockReturnValue(chain);
  chain.not = vi.fn().mockResolvedValue({ data: linkedItems, error: null });
  return chain;
};

const defaultFromMock = (events: unknown[], mealPlanItems: unknown[] = [], recipes: unknown[] = []) =>
  (table: string) => {
    if (table === "scheduled_events") return mockEventsChain(events);
    if (table === "meal_plan_items") return mockMealPlanChain(mealPlanItems);
    if (table === "recipes") return mockRecipesChain(recipes);
    return mockEventsChain([]);
  };

describe("PersonalEventsList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockReset();
  });

  it("shows empty state when there are no events", async () => {
    mockSupabase.from.mockImplementation(defaultFromMock([]));

    render(<PersonalEventsList userId="user-1" />);
    await waitFor(() => {
      expect(screen.getByText("No cooking events yet")).toBeInTheDocument();
    });
  });

  it("shows create button", async () => {
    mockSupabase.from.mockImplementation(defaultFromMock([]));

    render(<PersonalEventsList userId="user-1" />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /new event/i })).toBeInTheDocument();
    });
  });

  it("renders upcoming and past events in separate sections", async () => {
    const events = [
      { id: "e1", event_date: "2026-04-01", event_time: null, status: "scheduled" },
      { id: "e2", event_date: "2026-03-01", event_time: null, status: "completed" },
    ];
    mockSupabase.from.mockImplementation(defaultFromMock(events));

    render(<PersonalEventsList userId="user-1" />);
    await waitFor(() => {
      expect(screen.getAllByText("Upcoming").length).toBeGreaterThan(0);
      expect(screen.getByText("Past")).toBeInTheDocument();
    });
  });

  it("excludes events auto-created by the meal planner", async () => {
    const events = [
      { id: "e1", event_date: "2026-04-01", event_time: null, status: "scheduled" },
      { id: "e2", event_date: "2026-04-08", event_time: null, status: "scheduled" },
    ];
    // e2 was created by meal planner
    const mealPlanItems = [{ event_id: "e2" }];
    mockSupabase.from.mockImplementation(defaultFromMock(events, mealPlanItems));

    render(<PersonalEventsList userId="user-1" />);
    await waitFor(() => screen.getByText(/April 1, 2026/));
    expect(screen.queryByText(/April 8, 2026/)).not.toBeInTheDocument();
  });

  it("opens the create dialog when New Event is clicked", async () => {
    mockSupabase.from.mockImplementation(defaultFromMock([]));

    render(<PersonalEventsList userId="user-1" />);
    await waitFor(() => screen.getByRole("button", { name: /new event/i }));

    fireEvent.click(screen.getByRole("button", { name: /new event/i }));
    await waitFor(() => {
      expect(screen.getByText("New Cooking Event")).toBeInTheDocument();
    });
  });

  it("navigates to event detail when an event card is clicked", async () => {
    const events = [
      { id: "e1", event_date: "2026-04-01", event_time: null, status: "scheduled" },
    ];
    mockSupabase.from.mockImplementation(defaultFromMock(events));

    render(<PersonalEventsList userId="user-1" />);
    await waitFor(() => screen.getByText(/April 1, 2026/));

    fireEvent.click(screen.getByText(/April 1, 2026/).closest("[class*=cursor-pointer]")!);
    expect(mockNavigate).toHaveBeenCalledWith("/meals/e1");
  });
});
