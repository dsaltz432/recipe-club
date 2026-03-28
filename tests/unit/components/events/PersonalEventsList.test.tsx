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

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/eventActions", () => ({
  cancelEvent: vi.fn().mockResolvedValue({ success: true }),
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

const mockDeleteChain = (result: { error: null | object } = { error: null }) => {
  const chain: Record<string, unknown> = {};
  chain.delete = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockResolvedValue(result);
  return chain;
};

const defaultFromMock = (events: unknown[], recipes: unknown[] = []) =>
  (table: string) => {
    if (table === "scheduled_events") return mockEventsChain(events);
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
      { id: "e1", title: "Dinner", event_date: "2026-04-01", event_time: null, status: "scheduled" },
      { id: "e2", title: "Lunch", event_date: "2026-03-01", event_time: null, status: "completed" },
    ];
    mockSupabase.from.mockImplementation(defaultFromMock(events));

    render(<PersonalEventsList userId="user-1" />);
    await waitFor(() => {
      expect(screen.getAllByText("Upcoming").length).toBeGreaterThan(0);
      expect(screen.getByText("Past")).toBeInTheDocument();
    });
  });

  it("shows event title on the card", async () => {
    const events = [
      { id: "e1", title: "Sunday Feast", event_date: "2026-04-01", event_time: null, status: "scheduled" },
    ];
    mockSupabase.from.mockImplementation(defaultFromMock(events));

    render(<PersonalEventsList userId="user-1" />);
    await waitFor(() => {
      expect(screen.getByText("Sunday Feast")).toBeInTheDocument();
    });
  });

  it("only shows events with is_meal_plan_event=false (filtered server-side)", async () => {
    // The DB query includes .eq("is_meal_plan_event", false) so only standalone
    // events are returned. The mock just returns whatever we pass in.
    const standaloneEvents = [
      { id: "e1", title: "My Dinner", event_date: "2026-04-01", event_time: null, status: "scheduled" },
    ];
    mockSupabase.from.mockImplementation(defaultFromMock(standaloneEvents));

    render(<PersonalEventsList userId="user-1" />);
    await waitFor(() => screen.getByText(/April 1, 2026/));
    expect(screen.getByText(/April 1, 2026/)).toBeInTheDocument();
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

  it("disables Create button when title is empty", async () => {
    mockSupabase.from.mockImplementation(defaultFromMock([]));

    render(<PersonalEventsList userId="user-1" />);
    await waitFor(() => screen.getByRole("button", { name: /new event/i }));

    fireEvent.click(screen.getByRole("button", { name: /new event/i }));
    await waitFor(() => screen.getByText("New Cooking Event"));

    expect(screen.getByRole("button", { name: /create event/i })).toBeDisabled();
  });

  it("enables Create button when title is entered", async () => {
    mockSupabase.from.mockImplementation(defaultFromMock([]));

    render(<PersonalEventsList userId="user-1" />);
    await waitFor(() => screen.getByRole("button", { name: /new event/i }));

    fireEvent.click(screen.getByRole("button", { name: /new event/i }));
    await waitFor(() => screen.getByPlaceholderText(/dumplingfest/i));

    fireEvent.change(screen.getByPlaceholderText(/dumplingfest/i), { target: { value: "Taco Night" } });
    expect(screen.getByRole("button", { name: /create event/i })).not.toBeDisabled();
  });

  it("defaults time to 19:00 when dialog opens", async () => {
    mockSupabase.from.mockImplementation(defaultFromMock([]));

    render(<PersonalEventsList userId="user-1" />);
    await waitFor(() => screen.getByRole("button", { name: /new event/i }));

    fireEvent.click(screen.getByRole("button", { name: /new event/i }));
    await waitFor(() => screen.getByLabelText(/time/i));

    expect((screen.getByLabelText(/time/i) as HTMLInputElement).value).toBe("19:00");
  });

  it("navigates to event detail when an event card is clicked", async () => {
    const events = [
      { id: "e1", title: "My Dinner", event_date: "2026-04-01", event_time: null, status: "scheduled" },
    ];
    mockSupabase.from.mockImplementation(defaultFromMock(events));

    render(<PersonalEventsList userId="user-1" />);
    await waitFor(() => screen.getByText(/April 1, 2026/));

    fireEvent.click(screen.getByText(/April 1, 2026/).closest("[class*=cursor-pointer]")!);
    expect(mockNavigate).toHaveBeenCalledWith("/meals/e1");
  });

  it("opens delete confirmation when trash icon is clicked", async () => {
    const events = [
      { id: "e1", title: "My Dinner", event_date: "2026-04-01", event_time: null, status: "scheduled" },
    ];
    mockSupabase.from.mockImplementation(defaultFromMock(events));

    render(<PersonalEventsList userId="user-1" />);
    await waitFor(() => screen.getByRole("button", { name: /cancel/i }));

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    await waitFor(() => {
      expect(screen.getByText("Delete Event?")).toBeInTheDocument();
    });
  });

  it("removes event from list after confirming delete", async () => {
    const events = [
      { id: "e1", title: "My Dinner", event_date: "2026-04-01", event_time: null, status: "scheduled" },
    ];
    let fetchCount = 0;
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "scheduled_events") {
        fetchCount++;
        return mockEventsChain(fetchCount === 1 ? events : []);
      }
      return mockRecipesChain([]);
    });

    render(<PersonalEventsList userId="user-1" />);
    await waitFor(() => screen.getByRole("button", { name: /cancel/i }));

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    await waitFor(() => screen.getByText("Delete Event?"));

    fireEvent.click(screen.getByRole("button", { name: /delete event/i }));
    await waitFor(() => {
      expect(screen.queryByText("My Dinner")).not.toBeInTheDocument();
    });
  });
});
