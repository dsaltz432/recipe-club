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

  it("renders mobile compact grid with B/L/D column headers", () => {
    const { container } = render(<MealPlanGrid {...defaultProps} />);

    // Mobile layout: compact grid inside the md:hidden container
    const mobileContainer = container.querySelector(".md\\:hidden");
    expect(mobileContainer).toBeInTheDocument();
    // Column headers show single-letter meal type abbreviations
    expect(screen.getByText("B")).toBeInTheDocument();
    expect(screen.getByText("L")).toBeInTheDocument();
    expect(screen.getByText("D")).toBeInTheDocument();
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

  describe("mealTypes prop", () => {
    it("defaults to breakfast, lunch, dinner when mealTypes is not provided", () => {
      render(<MealPlanGrid {...defaultProps} />);

      // All three meal types render in desktop layout
      expect(screen.getAllByText("breakfast").length).toBeGreaterThan(0);
      expect(screen.getAllByText("lunch").length).toBeGreaterThan(0);
      expect(screen.getAllByText("dinner").length).toBeGreaterThan(0);
    });

    it("renders only the specified meal types", () => {
      render(<MealPlanGrid {...defaultProps} mealTypes={["dinner"]} />);

      // Only dinner renders
      expect(screen.getAllByText("dinner").length).toBeGreaterThan(0);
      // Breakfast and lunch do not render
      expect(screen.queryByText("breakfast")).not.toBeInTheDocument();
      expect(screen.queryByText("lunch")).not.toBeInTheDocument();
    });

    it("renders fewer slots when fewer meal types are provided", () => {
      render(<MealPlanGrid {...defaultProps} mealTypes={["breakfast", "dinner"]} />);

      // 7 days * 2 meal types = 14 per layout, x2 for mobile + desktop = 28
      const buttons = screen.getAllByRole("button");
      expect(buttons.length).toBe(28);
    });

    it("renders single meal type column header on mobile", () => {
      render(<MealPlanGrid {...defaultProps} mealTypes={["dinner"]} />);

      // Only "D" column header on mobile
      expect(screen.getByText("D")).toBeInTheDocument();
      expect(screen.queryByText("B")).not.toBeInTheDocument();
      expect(screen.queryByText("L")).not.toBeInTheDocument();
    });

    it("renders two meal types correctly", () => {
      render(<MealPlanGrid {...defaultProps} mealTypes={["breakfast", "lunch"]} />);

      expect(screen.getAllByText("breakfast").length).toBeGreaterThan(0);
      expect(screen.getAllByText("lunch").length).toBeGreaterThan(0);
      expect(screen.queryByText("dinner")).not.toBeInTheDocument();
      // Mobile headers
      expect(screen.getByText("B")).toBeInTheDocument();
      expect(screen.getByText("L")).toBeInTheDocument();
      expect(screen.queryByText("D")).not.toBeInTheDocument();
    });

    it("preserves items for disabled meal types in display", () => {
      const items: MealPlanItem[] = [
        {
          id: "item-1",
          planId: "plan-1",
          dayOfWeek: 0,
          mealType: "dinner",
          sortOrder: 0,
          recipeName: "Pasta",
        },
        {
          id: "item-2",
          planId: "plan-1",
          dayOfWeek: 0,
          mealType: "breakfast",
          sortOrder: 0,
          recipeName: "Oatmeal",
        },
      ];

      // Only show dinner — breakfast items exist but breakfast slot is not rendered
      render(<MealPlanGrid {...defaultProps} items={items} mealTypes={["dinner"]} />);

      expect(screen.getAllByText("Pasta").length).toBeGreaterThan(0);
      // Oatmeal item exists in data but no breakfast slot is rendered to display it
      expect(screen.queryByText("Oatmeal")).not.toBeInTheDocument();
    });
  });

});
