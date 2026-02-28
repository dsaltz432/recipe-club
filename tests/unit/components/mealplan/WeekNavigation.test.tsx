import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@tests/utils";
import WeekNavigation from "@/components/mealplan/WeekNavigation";

describe("WeekNavigation", () => {
  // Use local dates to avoid timezone issues
  const makeLocalDate = (y: number, m: number, d: number) => new Date(y, m - 1, d);

  const defaultProps = {
    weekStart: makeLocalDate(2026, 2, 8), // Sunday Feb 8
    onPreviousWeek: vi.fn(),
    onNextWeek: vi.fn(),
    onCurrentWeek: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders week date range", () => {
    render(<WeekNavigation {...defaultProps} />);

    // Feb 8 - Feb 14
    expect(screen.getByText("Feb 8 - 14")).toBeInTheDocument();
  });

  it("renders week range spanning two months", () => {
    render(
      <WeekNavigation
        {...defaultProps}
        weekStart={makeLocalDate(2026, 1, 25)} // Sunday Jan 25
      />
    );

    // Jan 25 - Jan 31
    expect(screen.getByText("Jan 25 - 31")).toBeInTheDocument();
  });

  it("renders week range spanning month boundary", () => {
    render(
      <WeekNavigation
        {...defaultProps}
        weekStart={makeLocalDate(2026, 3, 29)} // Sunday Mar 29 to Apr 4
      />
    );

    // Crosses month boundary: Mar 29 - Apr 4
    expect(screen.getByText("Mar 29 - Apr 4")).toBeInTheDocument();
  });

  it("calls onPreviousWeek when left arrow is clicked", () => {
    render(<WeekNavigation {...defaultProps} />);

    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[0]); // First button is previous

    expect(defaultProps.onPreviousWeek).toHaveBeenCalled();
  });

  it("calls onNextWeek when right arrow is clicked", () => {
    render(<WeekNavigation {...defaultProps} />);

    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[buttons.length - 1]); // Last button is next

    expect(defaultProps.onNextWeek).toHaveBeenCalled();
  });

  it("shows Today button when not on current week", () => {
    // Use a date far in the past to ensure it's not the current week
    render(
      <WeekNavigation
        {...defaultProps}
        weekStart={makeLocalDate(2025, 1, 5)}
      />
    );

    expect(screen.getByText("Today")).toBeInTheDocument();
  });

  it("calls onCurrentWeek when Today is clicked", () => {
    render(
      <WeekNavigation
        {...defaultProps}
        weekStart={makeLocalDate(2025, 1, 5)}
      />
    );

    fireEvent.click(screen.getByText("Today"));

    expect(defaultProps.onCurrentWeek).toHaveBeenCalled();
  });

  it("has aria-labels on navigation buttons", () => {
    render(<WeekNavigation {...defaultProps} />);

    expect(screen.getByRole("button", { name: "Previous week" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next week" })).toBeInTheDocument();
  });

  it("hides Today button when on current week", () => {
    // Calculate current week's Sunday
    const now = new Date();
    const dayOfWeek = now.getDay();
    const currentSunday = new Date(now);
    currentSunday.setDate(currentSunday.getDate() - dayOfWeek);
    currentSunday.setHours(0, 0, 0, 0);

    render(
      <WeekNavigation
        {...defaultProps}
        weekStart={currentSunday}
      />
    );

    expect(screen.queryByText("Today")).not.toBeInTheDocument();
  });

  describe("weekStartDay prop", () => {
    it("hides Today button when on current week with weekStartDay=1", () => {
      // Calculate current week's Monday
      const now = new Date();
      const dayOfWeek = now.getDay();
      const diff = (dayOfWeek + 6) % 7; // Monday-start offset
      const currentMonday = new Date(now);
      currentMonday.setDate(currentMonday.getDate() - diff);
      currentMonday.setHours(0, 0, 0, 0);

      render(
        <WeekNavigation
          {...defaultProps}
          weekStart={currentMonday}
          weekStartDay={1}
        />
      );

      expect(screen.queryByText("Today")).not.toBeInTheDocument();
    });

    it("shows Today button when on a different week with weekStartDay=1", () => {
      render(
        <WeekNavigation
          {...defaultProps}
          weekStart={makeLocalDate(2025, 1, 6)} // Monday Jan 6, 2025
          weekStartDay={1}
        />
      );

      expect(screen.getByText("Today")).toBeInTheDocument();
    });

    it("displays correct week range with Monday-start", () => {
      // Monday Feb 9 to Sunday Feb 15
      render(
        <WeekNavigation
          {...defaultProps}
          weekStart={makeLocalDate(2026, 2, 9)}
          weekStartDay={1}
        />
      );

      expect(screen.getByText("Feb 9 - 15")).toBeInTheDocument();
    });
  });
});
