import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@tests/utils";
import MealPlanGrid from "@/components/mealplan/MealPlanGrid";
import type { MealPlanItem } from "@/types";

describe("MealPlanGrid", () => {
  const defaultProps = {
    items: [] as MealPlanItem[],
    weekStart: new Date(2026, 1, 8), // Sunday Feb 8 (local time)
    onAddMeal: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders day headers", () => {
    render(<MealPlanGrid {...defaultProps} />);

    // Day headers appear in both mobile and desktop layouts
    expect(screen.getAllByText("Sun").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Mon").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Tue").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Wed").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Thu").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Fri").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Sat").length).toBeGreaterThan(0);
  });

  it("renders date labels for each day", () => {
    render(<MealPlanGrid {...defaultProps} />);

    // Feb 8 is Sunday, Feb 14 is Saturday (appear in both mobile + desktop)
    expect(screen.getAllByText("2/8").length).toBeGreaterThan(0);
    expect(screen.getAllByText("2/14").length).toBeGreaterThan(0);
  });

  it("renders date labels with readable text-sm font size", () => {
    render(<MealPlanGrid {...defaultProps} />);

    const dateLabels = screen.getAllByText("2/8");
    expect(dateLabels.some((el) => el.className.includes("text-sm"))).toBe(true);
  });

  it("renders meal type row labels", () => {
    render(<MealPlanGrid {...defaultProps} />);

    // Labels appear in both mobile and desktop layouts
    const breakfastLabels = screen.getAllByText("breakfast");
    expect(breakfastLabels.length).toBeGreaterThan(0);
  });

  it("renders empty slots for all days and meal types", () => {
    render(<MealPlanGrid {...defaultProps} />);

    // 7 days * 3 meal types = 21 per layout, x2 for mobile + desktop = 42
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBe(42);
  });

  it("renders mobile card layout with 7 day containers", () => {
    const { container } = render(<MealPlanGrid {...defaultProps} />);

    // Mobile layout: 7 day cards inside the md:hidden container
    const mobileContainer = container.querySelector(".md\\:hidden");
    expect(mobileContainer).toBeInTheDocument();
    // Each day gets a card with a border
    const dayCards = mobileContainer!.querySelectorAll(".border.rounded-lg");
    expect(dayCards.length).toBe(7);
  });

  it("renders items in correct slots", () => {
    const items: MealPlanItem[] = [
      {
        id: "item-1",
        planId: "plan-1",
        dayOfWeek: 1, // Monday
        mealType: "dinner",
        sortOrder: 0,
        recipeName: "Grilled Salmon",
      },
    ];

    render(<MealPlanGrid {...defaultProps} items={items} />);

    // Item appears in both mobile and desktop layouts
    expect(screen.getAllByText("Grilled Salmon").length).toBeGreaterThan(0);
  });

  it("calls onAddMeal when empty slot is clicked", () => {
    render(<MealPlanGrid {...defaultProps} />);

    // Click the first button (Sunday Breakfast)
    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[0]);

    expect(defaultProps.onAddMeal).toHaveBeenCalled();
  });

  it("renders multiple items in the same slot", () => {
    const items: MealPlanItem[] = [
      {
        id: "item-1",
        planId: "plan-1",
        dayOfWeek: 2,
        mealType: "lunch",
        sortOrder: 0,
        recipeName: "Sandwich",
      },
      {
        id: "item-2",
        planId: "plan-1",
        dayOfWeek: 2,
        mealType: "lunch",
        sortOrder: 1,
        customName: "Fruit Cup",
      },
    ];

    render(<MealPlanGrid {...defaultProps} items={items} />);

    // Items appear in both mobile and desktop layouts
    expect(screen.getAllByText("Sandwich").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Fruit Cup").length).toBeGreaterThan(0);
  });

  it("passes onViewMealEvent to MealPlanSlot", () => {
    const items: MealPlanItem[] = [
      {
        id: "item-1",
        planId: "plan-1",
        dayOfWeek: 0,
        mealType: "breakfast",
        sortOrder: 0,
        recipeName: "Pancakes",
      },
    ];

    const onViewMealEvent = vi.fn();
    render(<MealPlanGrid {...defaultProps} items={items} onViewMealEvent={onViewMealEvent} />);

    // The whole card is clickable (click the first occurrence)
    fireEvent.click(screen.getAllByText("Pancakes")[0]);

    expect(onViewMealEvent).toHaveBeenCalledWith(0, "breakfast");
  });

});
