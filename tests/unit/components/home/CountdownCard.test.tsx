import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@tests/utils";
import { createMockEvent } from "@tests/utils";
import CountdownCard from "@/components/home/CountdownCard";

// Mock Supabase
const mockSupabaseFrom = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => mockSupabaseFrom(...args),
  },
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
}));

// Mock Google Calendar functions
vi.mock("@/lib/googleCalendar", () => ({
  updateCalendarEvent: vi.fn().mockResolvedValue({ success: true }),
  deleteCalendarEvent: vi.fn().mockResolvedValue({ success: true }),
}));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe("CountdownCard", () => {
  const defaultProps = {
    event: createMockEvent({
      id: "event-1",
      ingredientName: "Salmon",
      eventDate: "2099-12-31",
      eventTime: "19:00",
      createdBy: "user-123",
    }),
    userId: "user-123",
    isAdmin: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2099-12-01T12:00:00"));
    mockSupabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders event ingredient name", () => {
    render(<CountdownCard {...defaultProps} />);
    expect(screen.getByText("Salmon")).toBeInTheDocument();
  });

  it("renders 'Mystery Ingredient' when ingredientName is missing", () => {
    render(
      <CountdownCard
        {...defaultProps}
        event={createMockEvent({ ingredientName: undefined, eventDate: "2099-12-31" })}
      />
    );
    expect(screen.getByText("Mystery Ingredient")).toBeInTheDocument();
  });

  it("renders View Event Details button that navigates to event page", () => {
    render(<CountdownCard {...defaultProps} />);
    const button = screen.getByText("View Event Details");
    fireEvent.click(button);
    expect(mockNavigate).toHaveBeenCalledWith("/events/event-1");
  });

  it("renders countdown numbers when event is in the future", () => {
    render(<CountdownCard {...defaultProps} />);
    expect(screen.getByText("days")).toBeInTheDocument();
  });

  it("shows 'Upcoming Event' label", () => {
    render(<CountdownCard {...defaultProps} />);
    expect(screen.getByText("Upcoming Event")).toBeInTheDocument();
  });

  it("renders formatted time (uppercase AM/PM)", () => {
    render(<CountdownCard {...defaultProps} />);
    expect(screen.getByText("7PM")).toBeInTheDocument();
  });

  it("formats time with minutes when not on the hour", () => {
    render(
      <CountdownCard
        {...defaultProps}
        event={createMockEvent({
          eventDate: "2099-12-31",
          eventTime: "14:30",
          createdBy: "user-123",
        })}
      />
    );
    expect(screen.getByText("2:30PM")).toBeInTheDocument();
  });

  it("formats 12:00 correctly as 12PM", () => {
    render(
      <CountdownCard
        {...defaultProps}
        event={createMockEvent({ eventDate: "2099-12-31", eventTime: "12:00", createdBy: "user-123" })}
      />
    );
    expect(screen.getByText("12PM")).toBeInTheDocument();
  });

  it("formats midnight (00:00) correctly as 12AM", () => {
    render(
      <CountdownCard
        {...defaultProps}
        event={createMockEvent({ eventDate: "2099-12-31", eventTime: "00:00", createdBy: "user-123" })}
      />
    );
    expect(screen.getByText("12AM")).toBeInTheDocument();
  });

  it("does not show event time when eventTime is not provided", () => {
    render(
      <CountdownCard
        {...defaultProps}
        event={createMockEvent({ eventDate: "2099-12-31", eventTime: undefined, createdBy: "user-123" })}
      />
    );
    expect(screen.queryByText(/[AP]M$/)).not.toBeInTheDocument();
  });

  it("shows edit and cancel buttons for admin who created the event", () => {
    render(
      <CountdownCard
        {...defaultProps}
        isAdmin={true}
        userId="user-123"
        event={createMockEvent({ eventDate: "2099-12-31", createdBy: "user-123" })}
      />
    );
    expect(screen.getByText("Edit")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  it("does not show edit/cancel buttons for non-admin", () => {
    render(<CountdownCard {...defaultProps} isAdmin={false} />);
    expect(screen.queryByText("Edit")).not.toBeInTheDocument();
  });

  it("does not show edit/cancel buttons for admin who did not create the event", () => {
    render(
      <CountdownCard
        {...defaultProps}
        isAdmin={true}
        userId="other-user"
        event={createMockEvent({ eventDate: "2099-12-31", createdBy: "user-123" })}
      />
    );
    expect(screen.queryByText("Edit")).not.toBeInTheDocument();
  });
});

describe("CountdownCard - It's Time! state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockSupabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows 'It's Time!' and guidance link when countdown reaches zero", () => {
    vi.setSystemTime(new Date("2024-01-01T12:00:00"));
    const pastEvent = createMockEvent({
      id: "event-1",
      eventDate: "2024-01-01",
      eventTime: "10:00",
      createdBy: "user-123",
    });

    render(<CountdownCard event={pastEvent} userId="user-123" />);

    expect(screen.getByText("It's Time!")).toBeInTheDocument();
    expect(screen.getByText("Head to the event for recipes and cooking!")).toBeInTheDocument();
  });

  it("navigates to event page when guidance link is clicked", () => {
    vi.setSystemTime(new Date("2024-01-01T12:00:00"));
    const pastEvent = createMockEvent({
      id: "event-1",
      eventDate: "2024-01-01",
      eventTime: "10:00",
      createdBy: "user-123",
    });

    render(<CountdownCard event={pastEvent} userId="user-123" />);

    const link = screen.getByText("Head to the event for recipes and cooking!");
    fireEvent.click(link);
    expect(mockNavigate).toHaveBeenCalledWith("/events/event-1");
  });
});

describe("CountdownCard - Countdown Display", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockSupabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows 'Starting in' when event is today", () => {
    vi.setSystemTime(new Date("2099-12-31T10:00:00"));

    render(
      <CountdownCard
        event={createMockEvent({ eventDate: "2099-12-31", eventTime: "19:00", createdBy: "user-123" })}
        userId="user-123"
      />
    );
    expect(screen.getByText("Starting in")).toBeInTheDocument();
  });

  it("shows 'Countdown' when event is more than a day away", () => {
    vi.setSystemTime(new Date("2099-12-01T10:00:00"));

    render(
      <CountdownCard
        event={createMockEvent({ eventDate: "2099-12-31", eventTime: "19:00", createdBy: "user-123" })}
        userId="user-123"
      />
    );
    expect(screen.getByText("Countdown")).toBeInTheDocument();
  });

  it("shows singular 'day' when exactly 1 day away", () => {
    vi.setSystemTime(new Date("2099-12-30T10:00:00"));

    render(
      <CountdownCard
        event={createMockEvent({ eventDate: "2099-12-31", eventTime: "19:00", createdBy: "user-123" })}
        userId="user-123"
      />
    );
    expect(screen.getByText("day")).toBeInTheDocument();
  });

  it("shows singular 'hr' when exactly 1 hour remaining", () => {
    vi.setSystemTime(new Date("2099-12-31T17:30:00"));

    render(
      <CountdownCard
        event={createMockEvent({ eventDate: "2099-12-31", eventTime: "19:00", createdBy: "user-123" })}
        userId="user-123"
      />
    );
    expect(screen.getByText("hr")).toBeInTheDocument();
  });
});
