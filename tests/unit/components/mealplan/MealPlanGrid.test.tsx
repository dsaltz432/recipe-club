import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@tests/utils";
import MealPlanGrid from "@/components/mealplan/MealPlanGrid";
import type { MealPlanItem } from "@/types";

describe("MealPlanGrid", () => {
  const defaultProps = {
    items: [] as MealPlanItem[],
    weekStart: new Date(2026, 1, 8), // Sunday Feb 8 (local time)
    onAddMeal: vi.fn(),
    onRemoveMeal: vi.fn(),
    onEditMeal: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders day headers", () => {
    render(<MealPlanGrid {...defaultProps} />);

    expect(screen.getByText("Sun")).toBeInTheDocument();
    expect(screen.getByText("Mon")).toBeInTheDocument();
    expect(screen.getByText("Tue")).toBeInTheDocument();
    expect(screen.getByText("Wed")).toBeInTheDocument();
    expect(screen.getByText("Thu")).toBeInTheDocument();
    expect(screen.getByText("Fri")).toBeInTheDocument();
    expect(screen.getByText("Sat")).toBeInTheDocument();
  });

  it("renders date labels for each day", () => {
    render(<MealPlanGrid {...defaultProps} />);

    // Feb 8 is Sunday, Feb 14 is Saturday
    expect(screen.getByText("2/8")).toBeInTheDocument();
    expect(screen.getByText("2/14")).toBeInTheDocument();
  });

  it("renders date labels with readable text-sm font size", () => {
    render(<MealPlanGrid {...defaultProps} />);

    const dateLabel = screen.getByText("2/8");
    expect(dateLabel.className).toContain("text-sm");
  });

  it("renders meal type row labels", () => {
    render(<MealPlanGrid {...defaultProps} />);

    // We should have labels for breakfast, lunch, dinner
    // Since there are empty slots, each row label appears as text
    const breakfastLabels = screen.getAllByText("breakfast");
    expect(breakfastLabels.length).toBeGreaterThan(0);
  });

  it("renders empty slots for all days and meal types", () => {
    render(<MealPlanGrid {...defaultProps} />);

    // 7 days * 3 meal types = 21 empty slots (buttons)
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBe(21);
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

    expect(screen.getByText("Grilled Salmon")).toBeInTheDocument();
  });

  it("calls onAddMeal when empty slot is clicked", () => {
    render(<MealPlanGrid {...defaultProps} />);

    // Click the first button (Sunday Breakfast)
    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[0]);

    expect(defaultProps.onAddMeal).toHaveBeenCalled();
  });

  it("calls onRemoveMeal when filled slot remove is clicked", () => {
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

    render(<MealPlanGrid {...defaultProps} items={items} />);

    fireEvent.click(screen.getByTitle("Remove meal"));

    expect(defaultProps.onRemoveMeal).toHaveBeenCalledWith("item-1");
  });

  it("calls onEditMeal when a meal name is clicked", () => {
    const items: MealPlanItem[] = [
      {
        id: "item-1",
        planId: "plan-1",
        dayOfWeek: 1,
        mealType: "dinner",
        sortOrder: 0,
        recipeName: "Grilled Salmon",
      },
    ];

    render(<MealPlanGrid {...defaultProps} items={items} />);

    fireEvent.click(screen.getByText("Grilled Salmon"));

    expect(defaultProps.onEditMeal).toHaveBeenCalledWith(items[0]);
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

    expect(screen.getByText("Sandwich")).toBeInTheDocument();
    expect(screen.getByText("Fruit Cup")).toBeInTheDocument();
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

    // The whole card is now clickable since onViewMealEvent is provided
    fireEvent.click(screen.getByLabelText("View meal details"));

    expect(onViewMealEvent).toHaveBeenCalledWith(0, "breakfast");
  });

  it("passes onMarkCooked to MealPlanSlot", () => {
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

    const onMarkCooked = vi.fn();
    render(<MealPlanGrid {...defaultProps} items={items} onMarkCooked={onMarkCooked} />);

    fireEvent.click(screen.getByTitle("Mark as cooked"));

    expect(onMarkCooked).toHaveBeenCalledWith(0, "breakfast");
  });

  it("passes onUncook to MealPlanSlot", () => {
    const items: MealPlanItem[] = [
      {
        id: "item-1",
        planId: "plan-1",
        dayOfWeek: 0,
        mealType: "breakfast",
        sortOrder: 0,
        recipeName: "Pancakes",
        cookedAt: "2026-02-19T12:00:00Z",
      },
    ];

    const onUncook = vi.fn();
    render(<MealPlanGrid {...defaultProps} items={items} onUncook={onUncook} />);

    fireEvent.click(screen.getByTitle("Undo cook"));

    expect(onUncook).toHaveBeenCalledWith(0, "breakfast");
  });
});
