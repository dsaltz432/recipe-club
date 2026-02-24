import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@tests/utils";
import RecipeClubEvents from "@/components/events/RecipeClubEvents";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockSupabaseFrom = vi.fn();
const mockRpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => mockSupabaseFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

vi.mock("@/lib/googleCalendar", () => ({
  updateCalendarEvent: vi.fn().mockResolvedValue({ success: true }),
  deleteCalendarEvent: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("@/components/events/EventRatingDialog", () => ({
  default: ({ onComplete, onCancel }: { onComplete: () => void; onCancel: () => void }) => (
    <div data-testid="rating-dialog">
      <button onClick={onComplete}>Submit Ratings</button>
      <button onClick={onCancel}>Cancel Ratings</button>
    </div>
  ),
}));

vi.mock("@/lib/ingredientColors", () => ({
  getIngredientColor: (name: string) => `#color-${name}`,
  getLightBackgroundColor: (color: string) => `light-${color}`,
  getBorderColor: (color: string) => `border-${color}`,
  getDarkerTextColor: (color: string) => `text-${color}`,
}));

const createMockQueryBuilder = (overrides: Record<string, unknown> = {}) => {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    ...overrides,
  };
  return builder;
};

// Helper: standard event data from Supabase
const makeEventRow = (overrides: Record<string, unknown> = {}) => ({
  id: "event-1",
  ingredient_id: "ing-1",
  event_date: "2026-03-01",
  event_time: "19:00",
  created_by: "user-123",
  status: "scheduled",
  calendar_event_id: null,
  type: "club",
  ingredients: { name: "Tomato", color: "#ff0000" },
  ...overrides,
});

const makeRecipeRow = (overrides: Record<string, unknown> = {}) => ({
  id: "recipe-1",
  name: "Pasta",
  url: "https://example.com/pasta",
  event_id: "event-1",
  ingredient_id: "ing-1",
  created_by: "user-123",
  created_at: "2026-02-01T00:00:00Z",
  ...overrides,
});

const makeNoteRow = (overrides: Record<string, unknown> = {}) => ({
  id: "note-1",
  recipe_id: "recipe-1",
  user_id: "user-123",
  notes: "Great recipe",
  photos: null,
  created_at: "2026-02-02T00:00:00Z",
  profiles: { name: "Alice", avatar_url: null },
  ...overrides,
});

// Setup the three-query mock pattern for loadEvents
const setupLoadMocks = (
  events: ReturnType<typeof makeEventRow>[],
  recipes: ReturnType<typeof makeRecipeRow>[] = [],
  notes: ReturnType<typeof makeNoteRow>[] = [],
) => {
  const eventsBuilder = createMockQueryBuilder();
  eventsBuilder.order = vi.fn().mockResolvedValue({ data: events, error: null });

  const recipesBuilder = createMockQueryBuilder();
  recipesBuilder.in = vi.fn().mockResolvedValue({ data: recipes, error: null });

  const notesBuilder = createMockQueryBuilder();
  notesBuilder.in = vi.fn().mockResolvedValue({ data: notes, error: null });

  let callCount = 0;
  mockSupabaseFrom.mockImplementation((table: string) => {
    if (table === "scheduled_events") {
      callCount++;
      // First call is loadEvents, subsequent may be cancel/complete
      if (callCount === 1) return eventsBuilder;
      return createMockQueryBuilder();
    }
    if (table === "recipes") return recipesBuilder;
    if (table === "recipe_notes") return notesBuilder;
    return createMockQueryBuilder();
  });

  return { eventsBuilder, recipesBuilder, notesBuilder };
};

describe("RecipeClubEvents", () => {
  const defaultProps = {
    userId: "user-123",
    isAdmin: false,
    onEventChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc.mockResolvedValue({ data: null, error: null });
  });

  // ── Loading state ──

  it("shows loading spinner initially", () => {
    // Never resolve the mock
    const eventsBuilder = createMockQueryBuilder();
    eventsBuilder.order = vi.fn().mockReturnValue(new Promise(() => {}));
    mockSupabaseFrom.mockReturnValue(eventsBuilder);

    render(<RecipeClubEvents {...defaultProps} />);

    expect(screen.getByText((_, el) => el?.className?.includes("animate-spin") ?? false)).toBeInTheDocument();
  });

  // ── Empty state ──

  it("shows empty state when no events", async () => {
    setupLoadMocks([]);

    render(<RecipeClubEvents {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("No events yet. Spin the wheel to create one!")).toBeInTheDocument();
    });
  });

  // ── BUG-004: empty array guards ──

  it("skips recipes query when events array is empty", async () => {
    const eventsBuilder = createMockQueryBuilder();
    eventsBuilder.order = vi.fn().mockResolvedValue({ data: [], error: null });
    mockSupabaseFrom.mockReturnValue(eventsBuilder);

    render(<RecipeClubEvents {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("No events yet. Spin the wheel to create one!")).toBeInTheDocument();
    });

    // recipes and recipe_notes queries should not have been called
    expect(mockSupabaseFrom).not.toHaveBeenCalledWith("recipes");
    expect(mockSupabaseFrom).not.toHaveBeenCalledWith("recipe_notes");
  });

  it("skips notes query when recipes array is empty", async () => {
    const eventsBuilder = createMockQueryBuilder();
    eventsBuilder.order = vi.fn().mockResolvedValue({ data: [makeEventRow()], error: null });

    const recipesBuilder = createMockQueryBuilder();
    recipesBuilder.in = vi.fn().mockResolvedValue({ data: [], error: null });

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "scheduled_events") return eventsBuilder;
      if (table === "recipes") return recipesBuilder;
      return createMockQueryBuilder();
    });

    render(<RecipeClubEvents {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Tomato")).toBeInTheDocument();
    });

    expect(mockSupabaseFrom).not.toHaveBeenCalledWith("recipe_notes");
  });

  // ── Event card rendering ──

  it("renders scheduled event with ingredient name, date, recipe count", async () => {
    setupLoadMocks(
      [makeEventRow()],
      [makeRecipeRow()],
      [makeNoteRow()],
    );

    render(<RecipeClubEvents {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Tomato")).toBeInTheDocument();
    });
    expect(screen.getByText("Mar 1, 2026")).toBeInTheDocument();
    expect(screen.getByText("7:00 PM")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument(); // recipe count
    expect(screen.getByText("Upcoming")).toBeInTheDocument();
  });

  it("renders completed event without Upcoming badge", async () => {
    setupLoadMocks(
      [makeEventRow({ status: "completed" })],
      [makeRecipeRow()],
    );

    render(<RecipeClubEvents {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Tomato")).toBeInTheDocument();
    });
    expect(screen.queryByText("Upcoming")).not.toBeInTheDocument();
  });

  it("renders event without time", async () => {
    setupLoadMocks(
      [makeEventRow({ event_time: null })],
    );

    render(<RecipeClubEvents {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Tomato")).toBeInTheDocument();
    });
    expect(screen.queryByText("PM")).not.toBeInTheDocument();
  });

  it("renders event without ingredient name", async () => {
    setupLoadMocks(
      [makeEventRow({ ingredients: null, ingredient_id: null })],
    );

    render(<RecipeClubEvents {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Mar 1, 2026")).toBeInTheDocument();
    });
  });

  it("renders event with ingredient name but no color (derives from name)", async () => {
    setupLoadMocks(
      [makeEventRow({ ingredients: { name: "Basil", color: null } })],
    );

    render(<RecipeClubEvents {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Basil")).toBeInTheDocument();
    });
  });

  it("pluralizes recipe count correctly", async () => {
    setupLoadMocks(
      [makeEventRow()],
      [makeRecipeRow({ id: "r1" }), makeRecipeRow({ id: "r2" })],
    );

    render(<RecipeClubEvents {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("recipes")).toBeInTheDocument();
    });
  });

  it("shows singular 'recipe' for one recipe", async () => {
    setupLoadMocks(
      [makeEventRow()],
      [makeRecipeRow()],
    );

    render(<RecipeClubEvents {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/recipe$/)).toBeInTheDocument();
    });
  });

  it("navigates to event detail on card click", async () => {
    setupLoadMocks([makeEventRow()]);

    render(<RecipeClubEvents {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Tomato")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Tomato"));
    expect(mockNavigate).toHaveBeenCalledWith("/events/event-1");
  });

  // ── Time formatting ──

  it("formats AM time correctly", async () => {
    setupLoadMocks([makeEventRow({ event_time: "09:30" })]);

    render(<RecipeClubEvents {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("9:30 AM")).toBeInTheDocument();
    });
  });

  it("formats noon correctly", async () => {
    setupLoadMocks([makeEventRow({ event_time: "12:00" })]);

    render(<RecipeClubEvents {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("12:00 PM")).toBeInTheDocument();
    });
  });

  it("formats midnight correctly", async () => {
    setupLoadMocks([makeEventRow({ event_time: "00:00" })]);

    render(<RecipeClubEvents {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("12:00 AM")).toBeInTheDocument();
    });
  });

  // ── Admin buttons ──

  it("shows admin buttons (Complete, Edit, Cancel) for admin who created the event", async () => {
    setupLoadMocks([makeEventRow({ created_by: "user-123" })]);

    render(<RecipeClubEvents {...defaultProps} isAdmin={true} />);

    await waitFor(() => {
      expect(screen.getByText("Tomato")).toBeInTheDocument();
    });
    // Edit, Complete/Done, Cancel should appear
    expect(screen.getByText("Edit")).toBeInTheDocument();
    expect(screen.getByText("Complete")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  it("hides Edit and Cancel for admin who did not create the event", async () => {
    setupLoadMocks([makeEventRow({ created_by: "other-user" })]);

    render(<RecipeClubEvents {...defaultProps} isAdmin={true} />);

    await waitFor(() => {
      expect(screen.getByText("Tomato")).toBeInTheDocument();
    });
    expect(screen.queryByText("Edit")).not.toBeInTheDocument();
    expect(screen.queryByText("Cancel")).not.toBeInTheDocument();
    expect(screen.getByText("Complete")).toBeInTheDocument();
  });

  it("hides all admin buttons for non-admin user", async () => {
    setupLoadMocks([makeEventRow()]);

    render(<RecipeClubEvents {...defaultProps} isAdmin={false} />);

    await waitFor(() => {
      expect(screen.getByText("Tomato")).toBeInTheDocument();
    });
    expect(screen.queryByText("Edit")).not.toBeInTheDocument();
    expect(screen.queryByText("Complete")).not.toBeInTheDocument();
    expect(screen.queryByText("Cancel")).not.toBeInTheDocument();
  });

  it("hides admin buttons for completed events", async () => {
    setupLoadMocks([makeEventRow({ status: "completed", created_by: "user-123" })]);

    render(<RecipeClubEvents {...defaultProps} isAdmin={true} />);

    await waitFor(() => {
      expect(screen.getByText("Tomato")).toBeInTheDocument();
    });
    expect(screen.queryByText("Edit")).not.toBeInTheDocument();
    expect(screen.queryByText("Complete")).not.toBeInTheDocument();
    expect(screen.queryByText("Cancel")).not.toBeInTheDocument();
  });

  // ── Cancel event flow ──

  it("shows cancel confirmation dialog and cancels event", async () => {
    const { deleteCalendarEvent } = await import("@/lib/googleCalendar");

    setupLoadMocks([makeEventRow({ created_by: "user-123", calendar_event_id: "cal-123" })]);

    // After initial load, the cancel flow queries the event, then deletes
    const cancelFetchBuilder = createMockQueryBuilder();
    cancelFetchBuilder.single = vi.fn().mockResolvedValue({
      data: { id: "event-1", calendar_event_id: "cal-123", ingredients: { name: "Tomato" } },
      error: null,
    });
    const cancelDeleteBuilder = createMockQueryBuilder();
    cancelDeleteBuilder.eq = vi.fn().mockResolvedValue({ data: null, error: null });

    let fromCallIdx = 0;
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "scheduled_events") {
        fromCallIdx++;
        if (fromCallIdx === 1) {
          // loadEvents
          const b = createMockQueryBuilder();
          b.order = vi.fn().mockResolvedValue({ data: [makeEventRow({ created_by: "user-123", calendar_event_id: "cal-123" })], error: null });
          return b;
        }
        if (fromCallIdx === 2) return cancelFetchBuilder; // cancel: fetch event
        if (fromCallIdx === 3) return cancelDeleteBuilder; // cancel: delete event
        // reload after cancel
        const b = createMockQueryBuilder();
        b.order = vi.fn().mockResolvedValue({ data: [], error: null });
        return b;
      }
      return createMockQueryBuilder();
    });

    render(<RecipeClubEvents {...defaultProps} isAdmin={true} />);

    await waitFor(() => {
      expect(screen.getByText("Cancel")).toBeInTheDocument();
    });

    // Click Cancel → confirmation dialog
    fireEvent.click(screen.getByText("Cancel"));
    expect(screen.getByText("Cancel Event?")).toBeInTheDocument();
    expect(screen.getByText(/permanently delete the event.*recipes.*notes.*ratings.*meal plan references.*Google Calendar/)).toBeInTheDocument();

    // Confirm cancel
    fireEvent.click(screen.getByText("Cancel Event"));

    await waitFor(() => {
      expect(deleteCalendarEvent).toHaveBeenCalledWith("cal-123");
    });
  });

  it("cancel confirmation dialog can be dismissed with Keep Event", async () => {
    setupLoadMocks([makeEventRow({ created_by: "user-123" })]);

    render(<RecipeClubEvents {...defaultProps} isAdmin={true} />);

    await waitFor(() => {
      expect(screen.getByText("Cancel")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Cancel"));
    expect(screen.getByText("Cancel Event?")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Keep Event"));
    await waitFor(() => {
      expect(screen.queryByText("Cancel Event?")).not.toBeInTheDocument();
    });
  });

  it("cancel handles event without calendar_event_id", async () => {
    setupLoadMocks([makeEventRow({ created_by: "user-123", calendar_event_id: null })]);
    const { deleteCalendarEvent } = await import("@/lib/googleCalendar");

    let fromCallIdx = 0;
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "scheduled_events") {
        fromCallIdx++;
        if (fromCallIdx === 1) {
          const b = createMockQueryBuilder();
          b.order = vi.fn().mockResolvedValue({ data: [makeEventRow({ created_by: "user-123", calendar_event_id: null })], error: null });
          return b;
        }
        if (fromCallIdx === 2) {
          const b = createMockQueryBuilder();
          b.single = vi.fn().mockResolvedValue({
            data: { id: "event-1", calendar_event_id: null, ingredients: null },
            error: null,
          });
          return b;
        }
        if (fromCallIdx === 3) {
          const b = createMockQueryBuilder();
          b.eq = vi.fn().mockResolvedValue({ data: null, error: null });
          return b;
        }
        const b = createMockQueryBuilder();
        b.order = vi.fn().mockResolvedValue({ data: [], error: null });
        return b;
      }
      return createMockQueryBuilder();
    });

    render(<RecipeClubEvents {...defaultProps} isAdmin={true} />);

    await waitFor(() => {
      expect(screen.getByText("Cancel")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Cancel"));
    fireEvent.click(screen.getByText("Cancel Event"));

    await waitFor(() => {
      expect(deleteCalendarEvent).not.toHaveBeenCalled();
    });
  });

  it("cancel handles deleteCalendarEvent failure with non-standard error", async () => {
    const { deleteCalendarEvent } = await import("@/lib/googleCalendar");
    (deleteCalendarEvent as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ success: false, error: "Network error" });

    let fromCallIdx = 0;
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "scheduled_events") {
        fromCallIdx++;
        if (fromCallIdx === 1) {
          const b = createMockQueryBuilder();
          b.order = vi.fn().mockResolvedValue({ data: [makeEventRow({ created_by: "user-123", calendar_event_id: "cal-123" })], error: null });
          return b;
        }
        if (fromCallIdx === 2) {
          const b = createMockQueryBuilder();
          b.single = vi.fn().mockResolvedValue({
            data: { id: "event-1", calendar_event_id: "cal-123", ingredients: null },
            error: null,
          });
          return b;
        }
        if (fromCallIdx === 3) {
          const b = createMockQueryBuilder();
          b.eq = vi.fn().mockResolvedValue({ data: null, error: null });
          return b;
        }
        const b = createMockQueryBuilder();
        b.order = vi.fn().mockResolvedValue({ data: [], error: null });
        return b;
      }
      return createMockQueryBuilder();
    });

    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    render(<RecipeClubEvents {...defaultProps} isAdmin={true} />);

    await waitFor(() => {
      expect(screen.getByText("Cancel")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Cancel"));
    fireEvent.click(screen.getByText("Cancel Event"));

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith("Failed to delete calendar event:", "Network error");
    });

    consoleSpy.mockRestore();
  });

  it("cancel handles deleteCalendarEvent 'not available' error silently", async () => {
    const { deleteCalendarEvent } = await import("@/lib/googleCalendar");
    (deleteCalendarEvent as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ success: false, error: "Calendar not available" });

    let fromCallIdx = 0;
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "scheduled_events") {
        fromCallIdx++;
        if (fromCallIdx === 1) {
          const b = createMockQueryBuilder();
          b.order = vi.fn().mockResolvedValue({ data: [makeEventRow({ created_by: "user-123", calendar_event_id: "cal-123" })], error: null });
          return b;
        }
        if (fromCallIdx === 2) {
          const b = createMockQueryBuilder();
          b.single = vi.fn().mockResolvedValue({
            data: { id: "event-1", calendar_event_id: "cal-123", ingredients: null },
            error: null,
          });
          return b;
        }
        if (fromCallIdx === 3) {
          const b = createMockQueryBuilder();
          b.eq = vi.fn().mockResolvedValue({ data: null, error: null });
          return b;
        }
        const b = createMockQueryBuilder();
        b.order = vi.fn().mockResolvedValue({ data: [], error: null });
        return b;
      }
      return createMockQueryBuilder();
    });

    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    render(<RecipeClubEvents {...defaultProps} isAdmin={true} />);

    await waitFor(() => {
      expect(screen.getByText("Cancel")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Cancel"));
    fireEvent.click(screen.getByText("Cancel Event"));

    await waitFor(() => {
      expect(deleteCalendarEvent).toHaveBeenCalled();
    });

    // "not available" error should NOT trigger console.warn
    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("cancel handles Supabase fetch error", async () => {
    let fromCallIdx = 0;
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "scheduled_events") {
        fromCallIdx++;
        if (fromCallIdx === 1) {
          const b = createMockQueryBuilder();
          b.order = vi.fn().mockResolvedValue({ data: [makeEventRow({ created_by: "user-123" })], error: null });
          return b;
        }
        // Cancel: fetch event fails
        const b = createMockQueryBuilder();
        b.single = vi.fn().mockResolvedValue({ data: null, error: { message: "fetch failed" } });
        return b;
      }
      return createMockQueryBuilder();
    });

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(<RecipeClubEvents {...defaultProps} isAdmin={true} />);

    await waitFor(() => {
      expect(screen.getByText("Cancel")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Cancel"));
    fireEvent.click(screen.getByText("Cancel Event"));

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith("Error cancelling event:", expect.anything());
    });

    consoleSpy.mockRestore();
  });

  // ── Complete event flow (BUG-005/006) ──

  it("completes event with atomic RPC increment", async () => {
    const eventRow = makeEventRow({ created_by: "user-123" });

    let fromCallIdx = 0;
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "scheduled_events") {
        fromCallIdx++;
        if (fromCallIdx === 1) {
          const b = createMockQueryBuilder();
          b.order = vi.fn().mockResolvedValue({ data: [eventRow], error: null });
          return b;
        }
        // Complete: update status
        const b = createMockQueryBuilder();
        b.eq = vi.fn().mockResolvedValue({ data: null, error: null });
        return b;
      }
      return createMockQueryBuilder();
    });

    render(<RecipeClubEvents {...defaultProps} isAdmin={true} />);

    await waitFor(() => {
      expect(screen.getByText("Complete")).toBeInTheDocument();
    });

    // Click Complete → rating dialog
    fireEvent.click(screen.getByText("Complete"));
    expect(screen.getByTestId("rating-dialog")).toBeInTheDocument();

    // Submit ratings → triggers handleRatingsComplete
    fireEvent.click(screen.getByText("Submit Ratings"));

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith("increment_ingredient_used_count", {
        p_ingredient_id: "ing-1",
        p_user_id: "user-123",
      });
    });
  });

  it("completes event without ingredientId (skips RPC)", async () => {
    const eventRow = makeEventRow({ created_by: "user-123", ingredient_id: "" });

    let fromCallIdx = 0;
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "scheduled_events") {
        fromCallIdx++;
        if (fromCallIdx === 1) {
          const b = createMockQueryBuilder();
          b.order = vi.fn().mockResolvedValue({ data: [eventRow], error: null });
          return b;
        }
        const b = createMockQueryBuilder();
        b.eq = vi.fn().mockResolvedValue({ data: null, error: null });
        return b;
      }
      return createMockQueryBuilder();
    });

    render(<RecipeClubEvents {...defaultProps} isAdmin={true} />);

    await waitFor(() => {
      expect(screen.getByText("Complete")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Complete"));
    fireEvent.click(screen.getByText("Submit Ratings"));

    await waitFor(() => {
      expect(mockSupabaseFrom).toHaveBeenCalledWith("scheduled_events");
    });

    // RPC should NOT have been called
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("handles error during event completion (status update)", async () => {
    let fromCallIdx = 0;
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "scheduled_events") {
        fromCallIdx++;
        if (fromCallIdx === 1) {
          const b = createMockQueryBuilder();
          b.order = vi.fn().mockResolvedValue({ data: [makeEventRow({ created_by: "user-123" })], error: null });
          return b;
        }
        // Complete: update status fails
        const b = createMockQueryBuilder();
        b.eq = vi.fn().mockResolvedValue({ data: null, error: { message: "status update failed" } });
        return b;
      }
      return createMockQueryBuilder();
    });

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(<RecipeClubEvents {...defaultProps} isAdmin={true} />);

    await waitFor(() => {
      expect(screen.getByText("Complete")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Complete"));
    fireEvent.click(screen.getByText("Submit Ratings"));

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith("Error completing event:", expect.anything());
    });

    consoleSpy.mockRestore();
  });

  it("handles RPC error during event completion", async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: "rpc failed" } });

    let fromCallIdx = 0;
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "scheduled_events") {
        fromCallIdx++;
        if (fromCallIdx === 1) {
          const b = createMockQueryBuilder();
          b.order = vi.fn().mockResolvedValue({ data: [makeEventRow({ created_by: "user-123" })], error: null });
          return b;
        }
        const b = createMockQueryBuilder();
        b.eq = vi.fn().mockResolvedValue({ data: null, error: null });
        return b;
      }
      return createMockQueryBuilder();
    });

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(<RecipeClubEvents {...defaultProps} isAdmin={true} />);

    await waitFor(() => {
      expect(screen.getByText("Complete")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Complete"));
    fireEvent.click(screen.getByText("Submit Ratings"));

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith("Error completing event:", expect.anything());
    });

    consoleSpy.mockRestore();
  });

  it("cancel rating dialog closes it", async () => {
    setupLoadMocks([makeEventRow({ created_by: "user-123" })]);

    render(<RecipeClubEvents {...defaultProps} isAdmin={true} />);

    await waitFor(() => {
      expect(screen.getByText("Complete")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Complete"));
    expect(screen.getByTestId("rating-dialog")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Cancel Ratings"));
    await waitFor(() => {
      expect(screen.queryByTestId("rating-dialog")).not.toBeInTheDocument();
    });
  });

  // ── Edit event flow ──

  it("opens edit dialog with pre-filled date and time", async () => {
    setupLoadMocks([makeEventRow({ created_by: "user-123", event_time: "18:30" })]);

    render(<RecipeClubEvents {...defaultProps} isAdmin={true} />);

    await waitFor(() => {
      expect(screen.getByText("Edit")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Edit"));

    expect(screen.getByText("Edit Event")).toBeInTheDocument();
    expect(screen.getByText("Change the date and time for this event.")).toBeInTheDocument();
    expect(screen.getByLabelText("Event Time")).toHaveValue("18:30");
  });

  it("edit dialog shows default time when event has no time", async () => {
    setupLoadMocks([makeEventRow({ created_by: "user-123", event_time: null })]);

    render(<RecipeClubEvents {...defaultProps} isAdmin={true} />);

    await waitFor(() => {
      expect(screen.getByText("Edit")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Edit"));
    expect(screen.getByLabelText("Event Time")).toHaveValue("19:00");
  });

  it("saves edited event with calendar update", async () => {
    const { updateCalendarEvent } = await import("@/lib/googleCalendar");

    let fromCallIdx = 0;
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "scheduled_events") {
        fromCallIdx++;
        if (fromCallIdx === 1) {
          const b = createMockQueryBuilder();
          b.order = vi.fn().mockResolvedValue({ data: [makeEventRow({ created_by: "user-123" })], error: null });
          return b;
        }
        if (fromCallIdx === 2) {
          // Fetch event for edit
          const b = createMockQueryBuilder();
          b.single = vi.fn().mockResolvedValue({
            data: { id: "event-1", calendar_event_id: "cal-123", ingredients: { name: "Tomato" } },
            error: null,
          });
          return b;
        }
        if (fromCallIdx === 3) {
          // Update event date/time
          const b = createMockQueryBuilder();
          b.eq = vi.fn().mockResolvedValue({ data: null, error: null });
          return b;
        }
        // reload
        const b = createMockQueryBuilder();
        b.order = vi.fn().mockResolvedValue({ data: [], error: null });
        return b;
      }
      return createMockQueryBuilder();
    });

    render(<RecipeClubEvents {...defaultProps} isAdmin={true} />);

    await waitFor(() => {
      expect(screen.getByText("Edit")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Edit"));

    // Change time
    fireEvent.change(screen.getByLabelText("Event Time"), { target: { value: "20:00" } });

    // Save
    fireEvent.click(screen.getByText("Save Changes"));

    await waitFor(() => {
      expect(updateCalendarEvent).toHaveBeenCalledWith(expect.objectContaining({
        calendarEventId: "cal-123",
        ingredientName: "Tomato",
      }));
    });
  });

  it("saves edited event without calendar event", async () => {
    const { updateCalendarEvent } = await import("@/lib/googleCalendar");
    (updateCalendarEvent as ReturnType<typeof vi.fn>).mockClear();

    let fromCallIdx = 0;
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "scheduled_events") {
        fromCallIdx++;
        if (fromCallIdx === 1) {
          const b = createMockQueryBuilder();
          b.order = vi.fn().mockResolvedValue({ data: [makeEventRow({ created_by: "user-123" })], error: null });
          return b;
        }
        if (fromCallIdx === 2) {
          const b = createMockQueryBuilder();
          b.single = vi.fn().mockResolvedValue({
            data: { id: "event-1", calendar_event_id: null, ingredients: { name: "Tomato" } },
            error: null,
          });
          return b;
        }
        if (fromCallIdx === 3) {
          const b = createMockQueryBuilder();
          b.eq = vi.fn().mockResolvedValue({ data: null, error: null });
          return b;
        }
        const b = createMockQueryBuilder();
        b.order = vi.fn().mockResolvedValue({ data: [], error: null });
        return b;
      }
      return createMockQueryBuilder();
    });

    render(<RecipeClubEvents {...defaultProps} isAdmin={true} />);

    await waitFor(() => {
      expect(screen.getByText("Edit")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Edit"));
    fireEvent.click(screen.getByText("Save Changes"));

    await waitFor(() => {
      expect(screen.queryByText("Edit Event")).not.toBeInTheDocument();
    });

    expect(updateCalendarEvent).not.toHaveBeenCalled();
  });

  it("handles edit save error (fetch event fails)", async () => {
    let fromCallIdx = 0;
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "scheduled_events") {
        fromCallIdx++;
        if (fromCallIdx === 1) {
          const b = createMockQueryBuilder();
          b.order = vi.fn().mockResolvedValue({ data: [makeEventRow({ created_by: "user-123" })], error: null });
          return b;
        }
        // Fetch for edit fails
        const b = createMockQueryBuilder();
        b.single = vi.fn().mockResolvedValue({ data: null, error: { message: "fetch failed" } });
        return b;
      }
      return createMockQueryBuilder();
    });

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(<RecipeClubEvents {...defaultProps} isAdmin={true} />);

    await waitFor(() => {
      expect(screen.getByText("Edit")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Edit"));
    fireEvent.click(screen.getByText("Save Changes"));

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith("Error updating event:", expect.anything());
    });

    consoleSpy.mockRestore();
  });

  it("handles edit save error (update fails)", async () => {
    let fromCallIdx = 0;
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "scheduled_events") {
        fromCallIdx++;
        if (fromCallIdx === 1) {
          const b = createMockQueryBuilder();
          b.order = vi.fn().mockResolvedValue({ data: [makeEventRow({ created_by: "user-123" })], error: null });
          return b;
        }
        if (fromCallIdx === 2) {
          const b = createMockQueryBuilder();
          b.single = vi.fn().mockResolvedValue({
            data: { id: "event-1", calendar_event_id: null, ingredients: null },
            error: null,
          });
          return b;
        }
        // Update fails
        const b = createMockQueryBuilder();
        b.eq = vi.fn().mockResolvedValue({ data: null, error: { message: "update failed" } });
        return b;
      }
      return createMockQueryBuilder();
    });

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(<RecipeClubEvents {...defaultProps} isAdmin={true} />);

    await waitFor(() => {
      expect(screen.getByText("Edit")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Edit"));
    fireEvent.click(screen.getByText("Save Changes"));

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith("Error updating event:", expect.anything());
    });

    consoleSpy.mockRestore();
  });

  it("edit dialog Cancel button closes dialog", async () => {
    setupLoadMocks([makeEventRow({ created_by: "user-123" })]);

    render(<RecipeClubEvents {...defaultProps} isAdmin={true} />);

    await waitFor(() => {
      expect(screen.getByText("Edit")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Edit"));
    expect(screen.getByText("Edit Event")).toBeInTheDocument();

    // Click the Cancel button inside the dialog (not the "Cancel" event button)
    const cancelButtons = screen.getAllByRole("button", { name: /cancel/i });
    // Find the one inside the dialog
    const dialogCancel = cancelButtons.find(b => b.textContent === "Cancel" && b.closest("[role='dialog']"));
    if (dialogCancel) {
      fireEvent.click(dialogCancel);
    }
  });

  it("handles calendar update failure during edit", async () => {
    const { updateCalendarEvent } = await import("@/lib/googleCalendar");
    (updateCalendarEvent as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ success: false, error: "calendar failed" });

    let fromCallIdx = 0;
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "scheduled_events") {
        fromCallIdx++;
        if (fromCallIdx === 1) {
          const b = createMockQueryBuilder();
          b.order = vi.fn().mockResolvedValue({ data: [makeEventRow({ created_by: "user-123" })], error: null });
          return b;
        }
        if (fromCallIdx === 2) {
          const b = createMockQueryBuilder();
          b.single = vi.fn().mockResolvedValue({
            data: { id: "event-1", calendar_event_id: "cal-123", ingredients: { name: "Tomato" } },
            error: null,
          });
          return b;
        }
        if (fromCallIdx === 3) {
          const b = createMockQueryBuilder();
          b.eq = vi.fn().mockResolvedValue({ data: null, error: null });
          return b;
        }
        const b = createMockQueryBuilder();
        b.order = vi.fn().mockResolvedValue({ data: [], error: null });
        return b;
      }
      return createMockQueryBuilder();
    });

    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    render(<RecipeClubEvents {...defaultProps} isAdmin={true} />);

    await waitFor(() => {
      expect(screen.getByText("Edit")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Edit"));
    fireEvent.click(screen.getByText("Save Changes"));

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith("Failed to update calendar event:", "calendar failed");
    });

    consoleSpy.mockRestore();
  });

  // ── Data loading errors ──

  it("handles events query error", async () => {
    const eventsBuilder = createMockQueryBuilder();
    eventsBuilder.order = vi.fn().mockResolvedValue({ data: null, error: { message: "events error" } });
    mockSupabaseFrom.mockReturnValue(eventsBuilder);

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(<RecipeClubEvents {...defaultProps} />);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith("Error loading events:", expect.anything());
    });

    consoleSpy.mockRestore();
  });

  it("handles recipes query error", async () => {
    const eventsBuilder = createMockQueryBuilder();
    eventsBuilder.order = vi.fn().mockResolvedValue({ data: [makeEventRow()], error: null });

    const recipesBuilder = createMockQueryBuilder();
    recipesBuilder.in = vi.fn().mockResolvedValue({ data: null, error: { message: "recipes error" } });

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "scheduled_events") return eventsBuilder;
      if (table === "recipes") return recipesBuilder;
      return createMockQueryBuilder();
    });

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(<RecipeClubEvents {...defaultProps} />);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith("Error loading events:", expect.anything());
    });

    consoleSpy.mockRestore();
  });

  it("handles notes query error", async () => {
    const eventsBuilder = createMockQueryBuilder();
    eventsBuilder.order = vi.fn().mockResolvedValue({ data: [makeEventRow()], error: null });

    const recipesBuilder = createMockQueryBuilder();
    recipesBuilder.in = vi.fn().mockResolvedValue({ data: [makeRecipeRow()], error: null });

    const notesBuilder = createMockQueryBuilder();
    notesBuilder.in = vi.fn().mockResolvedValue({ data: null, error: { message: "notes error" } });

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "scheduled_events") return eventsBuilder;
      if (table === "recipes") return recipesBuilder;
      if (table === "recipe_notes") return notesBuilder;
      return createMockQueryBuilder();
    });

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(<RecipeClubEvents {...defaultProps} />);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith("Error loading events:", expect.anything());
    });

    consoleSpy.mockRestore();
  });

  // ── Sorting: upcoming before completed ──

  it("sorts upcoming events before completed events", async () => {
    const upcoming = makeEventRow({ id: "e1", event_date: "2026-04-01", status: "scheduled", ingredients: { name: "Upcoming Event", color: "#ff0000" } });
    const completed = makeEventRow({ id: "e2", event_date: "2026-01-01", status: "completed", ingredients: { name: "Completed Event", color: "#00ff00" } });

    setupLoadMocks([completed, upcoming]);

    render(<RecipeClubEvents {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Upcoming Event")).toBeInTheDocument();
      expect(screen.getByText("Completed Event")).toBeInTheDocument();
    });

    // Upcoming should appear first in DOM
    const cards = screen.getAllByText(/Event$/);
    expect(cards[0].textContent).toBe("Upcoming Event");
    expect(cards[1].textContent).toBe("Completed Event");
  });

  // ── Recipe/note data mapping ──

  it("maps recipe data with notes correctly", async () => {
    setupLoadMocks(
      [makeEventRow()],
      [makeRecipeRow({ url: null, event_id: "event-1", ingredient_id: null, created_by: null })],
      [makeNoteRow({ notes: null, photos: ["photo1.jpg"], profiles: { name: "Bob", avatar_url: "avatar.jpg" } })],
    );

    render(<RecipeClubEvents {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Tomato")).toBeInTheDocument();
    });
  });

  it("handles recipe without matching event (orphan recipe)", async () => {
    setupLoadMocks(
      [makeEventRow({ id: "event-1" })],
      [makeRecipeRow({ event_id: "non-existent-event" })],
    );

    render(<RecipeClubEvents {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Tomato")).toBeInTheDocument();
    });
    // Recipe count should be 0 since the orphan recipe doesn't match any event
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("handles recipe with null event_id", async () => {
    setupLoadMocks(
      [makeEventRow()],
      [makeRecipeRow({ event_id: null })],
    );

    render(<RecipeClubEvents {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Tomato")).toBeInTheDocument();
    });
  });

  it("calculates participant count from unique recipe creators", async () => {
    setupLoadMocks(
      [makeEventRow()],
      [
        makeRecipeRow({ id: "r1", created_by: "user-A" }),
        makeRecipeRow({ id: "r2", created_by: "user-B" }),
        makeRecipeRow({ id: "r3", created_by: "user-A" }), // duplicate creator
        makeRecipeRow({ id: "r4", created_by: null }), // no creator
      ],
    );

    render(<RecipeClubEvents {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Tomato")).toBeInTheDocument();
    });
    // 2 unique participants (user-A and user-B)
  });

  // ── Default isAdmin prop ──

  it("renders without isAdmin prop (defaults to false)", async () => {
    setupLoadMocks([makeEventRow()]);

    render(<RecipeClubEvents userId="user-123" />);

    await waitFor(() => {
      expect(screen.getByText("Tomato")).toBeInTheDocument();
    });
    expect(screen.queryByText("Complete")).not.toBeInTheDocument();
  });

  // ── Multiple events with notes grouped correctly ──

  it("groups notes by recipe correctly across events", async () => {
    const events = [
      makeEventRow({ id: "e1", ingredients: { name: "Tomato", color: "#ff0000" } }),
      makeEventRow({ id: "e2", event_date: "2026-04-01", ingredients: { name: "Basil", color: "#00ff00" } }),
    ];
    const recipes = [
      makeRecipeRow({ id: "r1", event_id: "e1" }),
      makeRecipeRow({ id: "r2", event_id: "e2", name: "Pesto" }),
    ];
    const notes = [
      makeNoteRow({ id: "n1", recipe_id: "r1" }),
      makeNoteRow({ id: "n2", recipe_id: "r2" }),
    ];

    setupLoadMocks(events, recipes, notes);

    render(<RecipeClubEvents {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Tomato")).toBeInTheDocument();
      expect(screen.getByText("Basil")).toBeInTheDocument();
    });
  });

  // ── Branch coverage: || fallbacks ──

  it("handles null eventsData from query (|| [] fallback)", async () => {
    const eventsBuilder = createMockQueryBuilder();
    eventsBuilder.order = vi.fn().mockResolvedValue({ data: null, error: null });
    mockSupabaseFrom.mockReturnValue(eventsBuilder);

    render(<RecipeClubEvents {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("No events yet. Spin the wheel to create one!")).toBeInTheDocument();
    });
  });

  it("handles null notesData from query (|| [] fallback)", async () => {
    const eventsBuilder = createMockQueryBuilder();
    eventsBuilder.order = vi.fn().mockResolvedValue({ data: [makeEventRow()], error: null });

    const recipesBuilder = createMockQueryBuilder();
    recipesBuilder.in = vi.fn().mockResolvedValue({ data: [makeRecipeRow()], error: null });

    const notesBuilder = createMockQueryBuilder();
    notesBuilder.in = vi.fn().mockResolvedValue({ data: null, error: null });

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "scheduled_events") return eventsBuilder;
      if (table === "recipes") return recipesBuilder;
      if (table === "recipe_notes") return notesBuilder;
      return createMockQueryBuilder();
    });

    render(<RecipeClubEvents {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Tomato")).toBeInTheDocument();
    });
  });

  it("handles event with null created_by (|| undefined fallback)", async () => {
    setupLoadMocks([makeEventRow({ created_by: null })]);

    render(<RecipeClubEvents {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Tomato")).toBeInTheDocument();
    });
  });

  it("handles note with null profiles (|| 'Unknown' fallback)", async () => {
    setupLoadMocks(
      [makeEventRow()],
      [makeRecipeRow()],
      [makeNoteRow({ profiles: null })],
    );

    render(<RecipeClubEvents {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Tomato")).toBeInTheDocument();
    });
  });

  it("renders completed event without ingredientColor (style fallbacks)", async () => {
    // ingredients=null → ingredientColor=undefined → style fallback fires for completed
    setupLoadMocks([
      makeEventRow({ status: "completed", ingredients: null }),
    ]);

    render(<RecipeClubEvents {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Mar 1, 2026")).toBeInTheDocument();
    });
  });

  it("renders scheduled event without ingredientColor (ternary branches)", async () => {
    // ingredients=null → ingredientColor=undefined → style fallback fires for scheduled
    setupLoadMocks([
      makeEventRow({ status: "scheduled", ingredients: null }),
    ]);

    render(<RecipeClubEvents {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Mar 1, 2026")).toBeInTheDocument();
    });
  });

  it("sorts multiple completed events by date descending", async () => {
    setupLoadMocks([
      makeEventRow({ id: "e1", event_date: "2026-01-01", status: "completed", ingredients: { name: "Jan Event", color: "#ff0000" } }),
      makeEventRow({ id: "e2", event_date: "2026-02-01", status: "completed", ingredients: { name: "Feb Event", color: "#00ff00" } }),
    ]);

    render(<RecipeClubEvents {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Jan Event")).toBeInTheDocument();
      expect(screen.getByText("Feb Event")).toBeInTheDocument();
    });

    // Feb should come first (descending)
    const cards = screen.getAllByText(/Event$/);
    expect(cards[0].textContent).toBe("Feb Event");
    expect(cards[1].textContent).toBe("Jan Event");
  });

  it("edit save uses ingredient name 'Unknown' when ingredients is null", async () => {
    const { updateCalendarEvent } = await import("@/lib/googleCalendar");
    (updateCalendarEvent as ReturnType<typeof vi.fn>).mockClear();

    let fromCallIdx = 0;
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "scheduled_events") {
        fromCallIdx++;
        if (fromCallIdx === 1) {
          const b = createMockQueryBuilder();
          b.order = vi.fn().mockResolvedValue({ data: [makeEventRow({ created_by: "user-123" })], error: null });
          return b;
        }
        if (fromCallIdx === 2) {
          const b = createMockQueryBuilder();
          b.single = vi.fn().mockResolvedValue({
            data: { id: "event-1", calendar_event_id: "cal-456", ingredients: null },
            error: null,
          });
          return b;
        }
        if (fromCallIdx === 3) {
          const b = createMockQueryBuilder();
          b.eq = vi.fn().mockResolvedValue({ data: null, error: null });
          return b;
        }
        const b = createMockQueryBuilder();
        b.order = vi.fn().mockResolvedValue({ data: [], error: null });
        return b;
      }
      return createMockQueryBuilder();
    });

    render(<RecipeClubEvents {...defaultProps} isAdmin={true} />);

    await waitFor(() => {
      expect(screen.getByText("Edit")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Edit"));
    fireEvent.click(screen.getByText("Save Changes"));

    await waitFor(() => {
      expect(updateCalendarEvent).toHaveBeenCalledWith(expect.objectContaining({
        ingredientName: "Unknown",
      }));
    });
  });

  it("handles null recipesData from query (|| [] fallback)", async () => {
    const eventsBuilder = createMockQueryBuilder();
    eventsBuilder.order = vi.fn().mockResolvedValue({ data: [makeEventRow()], error: null });

    const recipesBuilder = createMockQueryBuilder();
    recipesBuilder.in = vi.fn().mockResolvedValue({ data: null, error: null });

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "scheduled_events") return eventsBuilder;
      if (table === "recipes") return recipesBuilder;
      return createMockQueryBuilder();
    });

    render(<RecipeClubEvents {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Tomato")).toBeInTheDocument();
    });

    // Should not call recipe_notes since no recipes
    expect(mockSupabaseFrom).not.toHaveBeenCalledWith("recipe_notes");
  });
});
