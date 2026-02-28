import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@tests/utils";
import MealPlanSlot from "@/components/mealplan/MealPlanSlot";
import type { MealPlanItem } from "@/types";

describe("MealPlanSlot", () => {
  const defaultProps = {
    items: [] as MealPlanItem[],
    dayOfWeek: 1,
    mealType: "dinner" as const,
    onAddMeal: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders empty slot with Add button", () => {
    render(<MealPlanSlot {...defaultProps} />);

    expect(screen.getByText("Dinner")).toBeInTheDocument();
  });

  it("calls onAddMeal when empty slot is clicked", () => {
    render(<MealPlanSlot {...defaultProps} />);

    fireEvent.click(screen.getByRole("button"));

    expect(defaultProps.onAddMeal).toHaveBeenCalledWith(1, "dinner");
  });

  it("renders meal item with recipe name", () => {
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

    render(<MealPlanSlot {...defaultProps} items={items} />);

    expect(screen.getByText("Grilled Salmon")).toBeInTheDocument();
  });

  it("renders meal item with custom name when no recipe", () => {
    const items: MealPlanItem[] = [
      {
        id: "item-1",
        planId: "plan-1",
        dayOfWeek: 1,
        mealType: "dinner",
        sortOrder: 0,
        customName: "Homemade Pizza",
      },
    ];

    render(<MealPlanSlot {...defaultProps} items={items} />);

    expect(screen.getByText("Homemade Pizza")).toBeInTheDocument();
  });

  it("renders Unnamed meal when no name provided", () => {
    const items: MealPlanItem[] = [
      {
        id: "item-1",
        planId: "plan-1",
        dayOfWeek: 1,
        mealType: "dinner",
        sortOrder: 0,
      },
    ];

    render(<MealPlanSlot {...defaultProps} items={items} />);

    expect(screen.getByText("Unnamed meal")).toBeInTheDocument();
  });

  it("does not show external link icons in populated cards", () => {
    const items: MealPlanItem[] = [
      {
        id: "item-1",
        planId: "plan-1",
        dayOfWeek: 1,
        mealType: "dinner",
        sortOrder: 0,
        recipeName: "Grilled Salmon",
        recipeUrl: "https://example.com/salmon",
      },
    ];

    render(<MealPlanSlot {...defaultProps} items={items} />);

    const links = document.querySelectorAll("a[target='_blank']");
    expect(links.length).toBe(0);
  });

  it("renders correct meal type labels for empty slots", () => {
    render(<MealPlanSlot {...defaultProps} mealType="breakfast" />);
    expect(screen.getByText("Breakfast")).toBeInTheDocument();
  });

  it("renders lunch label for empty slot", () => {
    render(<MealPlanSlot {...defaultProps} mealType="lunch" />);
    expect(screen.getByText("Lunch")).toBeInTheDocument();
  });

  it("renders snack label for empty slot", () => {
    render(<MealPlanSlot {...defaultProps} mealType="snack" />);
    expect(screen.getByText("Snack")).toBeInTheDocument();
  });

  it("does not show meal type label in populated cards", () => {
    const items: MealPlanItem[] = [
      {
        id: "item-1",
        planId: "plan-1",
        dayOfWeek: 1,
        mealType: "lunch",
        sortOrder: 0,
        recipeName: "Salad",
      },
    ];

    render(<MealPlanSlot {...defaultProps} items={items} mealType="lunch" />);

    expect(screen.queryByText("Lunch")).not.toBeInTheDocument();
  });

  it("renders multiple items in the same slot", () => {
    const items: MealPlanItem[] = [
      {
        id: "item-1",
        planId: "plan-1",
        dayOfWeek: 1,
        mealType: "dinner",
        sortOrder: 0,
        recipeName: "Grilled Salmon",
      },
      {
        id: "item-2",
        planId: "plan-1",
        dayOfWeek: 1,
        mealType: "dinner",
        sortOrder: 1,
        customName: "Side Salad",
      },
    ];

    render(<MealPlanSlot {...defaultProps} items={items} />);

    expect(screen.getByText("Grilled Salmon")).toBeInTheDocument();
    expect(screen.getByText("Side Salad")).toBeInTheDocument();
  });

  it("meal name is a plain div, not a clickable button", () => {
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

    render(<MealPlanSlot {...defaultProps} items={items} />);

    const nameElement = screen.getByText("Grilled Salmon");
    // The name should be inside a <p> inside a <div>, not a <button>
    expect(nameElement.closest("button")).toBeNull();
  });

  it("shows add-more button on filled slot", () => {
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

    render(<MealPlanSlot {...defaultProps} items={items} />);

    fireEvent.click(screen.getByTitle("Add another meal"));

    expect(defaultProps.onAddMeal).toHaveBeenCalledWith(1, "dinner");
  });

  it("clicking filled card calls onViewMealEvent", () => {
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

    const onViewMealEvent = vi.fn();
    render(<MealPlanSlot {...defaultProps} items={items} onViewMealEvent={onViewMealEvent} />);

    fireEvent.click(screen.getByText("Grilled Salmon"));

    expect(onViewMealEvent).toHaveBeenCalledWith(1, "dinner");
  });

  it("has aria-label on add-another-meal button", () => {
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

    render(<MealPlanSlot {...defaultProps} items={items} />);

    expect(screen.getByLabelText("Add another meal")).toBeInTheDocument();
  });

  it("does not show Done or Undo buttons on card", () => {
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

    render(<MealPlanSlot {...defaultProps} items={items} />);

    expect(screen.queryByLabelText("Mark as cooked")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Undo cook")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("View meal details")).not.toBeInTheDocument();
  });

  describe("action buttons call correct handlers", () => {
    it("add-more button calls onAddMeal", () => {
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

      render(<MealPlanSlot {...defaultProps} items={items} />);

      fireEvent.click(screen.getByTitle("Add another meal"));

      expect(defaultProps.onAddMeal).toHaveBeenCalledWith(1, "dinner");
    });
  });

  describe("styling on filled tiles", () => {
    it("has purple styling on uncooked filled tile", () => {
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

      const { container } = render(<MealPlanSlot {...defaultProps} items={items} />);

      const outerDiv = container.firstChild as HTMLElement;
      expect(outerDiv.className).toContain("bg-purple/5");
      expect(outerDiv.className).toContain("border-purple/20");
      expect(outerDiv.className).toContain("transition-colors");
    });

    it("has green styling on cooked filled tile", () => {
      const items: MealPlanItem[] = [
        {
          id: "item-1",
          planId: "plan-1",
          dayOfWeek: 1,
          mealType: "dinner",
          sortOrder: 0,
          recipeName: "Grilled Salmon",
          cookedAt: "2026-02-19T12:00:00Z",
        },
      ];

      const { container } = render(<MealPlanSlot {...defaultProps} items={items} />);

      const outerDiv = container.firstChild as HTMLElement;
      expect(outerDiv.className).toContain("bg-green-50");
      expect(outerDiv.className).toContain("border-green-200");
      expect(outerDiv.className).toContain("transition-colors");
    });
  });

  describe("cooked state", () => {
    it("shows green styling when all items are cooked", () => {
      const items: MealPlanItem[] = [
        {
          id: "item-1",
          planId: "plan-1",
          dayOfWeek: 1,
          mealType: "dinner",
          sortOrder: 0,
          recipeName: "Grilled Salmon",
          cookedAt: "2026-02-19T12:00:00Z",
        },
      ];

      const { container } = render(<MealPlanSlot {...defaultProps} items={items} />);

      const slot = container.querySelector(".bg-green-50");
      expect(slot).toBeInTheDocument();
    });

    it("shows sr-only Cooked text for screen readers when cooked", () => {
      const items: MealPlanItem[] = [
        {
          id: "item-1",
          planId: "plan-1",
          dayOfWeek: 1,
          mealType: "dinner",
          sortOrder: 0,
          recipeName: "Grilled Salmon",
          cookedAt: "2026-02-19T12:00:00Z",
        },
      ];

      const { container } = render(<MealPlanSlot {...defaultProps} items={items} />);

      const srOnly = container.querySelector(".sr-only");
      expect(srOnly).toBeInTheDocument();
      expect(srOnly?.textContent).toBe("Cooked");
    });

    it("does not show sr-only Cooked text when not cooked", () => {
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

      const { container } = render(<MealPlanSlot {...defaultProps} items={items} />);

      const srOnly = container.querySelector(".sr-only");
      expect(srOnly).not.toBeInTheDocument();
    });

    it("shows checkmark icons when cooked", () => {
      const items: MealPlanItem[] = [
        {
          id: "item-1",
          planId: "plan-1",
          dayOfWeek: 1,
          mealType: "dinner",
          sortOrder: 0,
          recipeName: "Grilled Salmon",
          cookedAt: "2026-02-19T12:00:00Z",
        },
      ];

      render(<MealPlanSlot {...defaultProps} items={items} />);

      expect(screen.getByTestId("cooked-check")).toBeInTheDocument();
    });

    it("does not show checkmark when not cooked", () => {
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

      render(<MealPlanSlot {...defaultProps} items={items} />);

      expect(screen.queryByTestId("cooked-check")).not.toBeInTheDocument();
    });

    it("is not cooked when only some items have cookedAt", () => {
      const items: MealPlanItem[] = [
        {
          id: "item-1",
          planId: "plan-1",
          dayOfWeek: 1,
          mealType: "dinner",
          sortOrder: 0,
          recipeName: "Salmon",
          cookedAt: "2026-02-19T12:00:00Z",
        },
        {
          id: "item-2",
          planId: "plan-1",
          dayOfWeek: 1,
          mealType: "dinner",
          sortOrder: 1,
          recipeName: "Salad",
        },
      ];

      const { container } = render(<MealPlanSlot {...defaultProps} items={items} />);

      expect(container.querySelector(".bg-green-50")).not.toBeInTheDocument();
      expect(screen.queryByTestId("cooked-check")).not.toBeInTheDocument();
    });
  });
});
