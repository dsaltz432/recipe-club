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
    onRemoveMeal: vi.fn(),
    onEditMeal: vi.fn(),
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

  it("calls onRemoveMeal when remove button is clicked", () => {
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

    fireEvent.click(screen.getByTitle("Remove meal"));

    expect(defaultProps.onRemoveMeal).toHaveBeenCalledWith("item-1");
  });

  it("shows external link when item has recipe URL", () => {
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

    const link = document.querySelector('a[href="https://example.com/salmon"]');
    expect(link).toBeInTheDocument();
  });

  it("shows external link when item has custom URL", () => {
    const items: MealPlanItem[] = [
      {
        id: "item-1",
        planId: "plan-1",
        dayOfWeek: 1,
        mealType: "dinner",
        sortOrder: 0,
        customName: "External Recipe",
        customUrl: "https://example.com/recipe",
      },
    ];

    render(<MealPlanSlot {...defaultProps} items={items} />);

    const link = document.querySelector('a[href="https://example.com/recipe"]');
    expect(link).toBeInTheDocument();
  });

  it("does not show external link when no URL", () => {
    const items: MealPlanItem[] = [
      {
        id: "item-1",
        planId: "plan-1",
        dayOfWeek: 1,
        mealType: "dinner",
        sortOrder: 0,
        recipeName: "No URL Recipe",
      },
    ];

    render(<MealPlanSlot {...defaultProps} items={items} />);

    const links = document.querySelectorAll("a[target='_blank']");
    expect(links.length).toBe(0);
  });

  it("renders correct meal type labels", () => {
    render(<MealPlanSlot {...defaultProps} mealType="breakfast" />);
    expect(screen.getByText("Breakfast")).toBeInTheDocument();
  });

  it("renders lunch label", () => {
    render(<MealPlanSlot {...defaultProps} mealType="lunch" />);
    expect(screen.getByText("Lunch")).toBeInTheDocument();
  });

  it("renders snack label", () => {
    render(<MealPlanSlot {...defaultProps} mealType="snack" />);
    expect(screen.getByText("Snack")).toBeInTheDocument();
  });

  it("shows meal type label for filled slot", () => {
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

    expect(screen.getByText("Lunch")).toBeInTheDocument();
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

  it("calls onEditMeal when meal name is clicked", () => {
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

    fireEvent.click(screen.getByText("Grilled Salmon"));

    expect(defaultProps.onEditMeal).toHaveBeenCalledWith(items[0]);
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

  it("calls onRemoveMeal for correct item when multiple items exist", () => {
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

    const removeButtons = screen.getAllByTitle("Remove meal");
    fireEvent.click(removeButtons[1]);

    expect(defaultProps.onRemoveMeal).toHaveBeenCalledWith("item-2");
  });

  it("shows View meal details button when onViewMealEvent is provided", () => {
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

    fireEvent.click(screen.getByTitle("View meal details"));

    expect(onViewMealEvent).toHaveBeenCalledWith(1, "dinner");
  });

  it("does not show View meal details button when onViewMealEvent is not provided", () => {
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

    expect(screen.queryByTitle("View meal details")).not.toBeInTheDocument();
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

    it("shows Mark as Cooked button when onMarkCooked is provided and not cooked", () => {
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

      const onMarkCooked = vi.fn();
      render(<MealPlanSlot {...defaultProps} items={items} onMarkCooked={onMarkCooked} />);

      fireEvent.click(screen.getByTitle("Mark as cooked"));

      expect(onMarkCooked).toHaveBeenCalledWith(1, "dinner");
    });

    it("does not show Mark as Cooked when onMarkCooked is not provided", () => {
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

      expect(screen.queryByTitle("Mark as cooked")).not.toBeInTheDocument();
    });

    it("does not show Mark as Cooked when already cooked", () => {
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

      const onMarkCooked = vi.fn();
      render(<MealPlanSlot {...defaultProps} items={items} onMarkCooked={onMarkCooked} />);

      expect(screen.queryByTitle("Mark as cooked")).not.toBeInTheDocument();
    });

    it("shows Undo cook button when cooked and onUncook is provided", () => {
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

      const onUncook = vi.fn();
      render(<MealPlanSlot {...defaultProps} items={items} onUncook={onUncook} />);

      fireEvent.click(screen.getByTitle("Undo cook"));

      expect(onUncook).toHaveBeenCalledWith(1, "dinner");
    });

    it("does not show Undo cook when onUncook is not provided", () => {
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

      expect(screen.queryByTitle("Undo cook")).not.toBeInTheDocument();
    });

    it("does not show Undo cook when not cooked", () => {
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

      const onUncook = vi.fn();
      render(<MealPlanSlot {...defaultProps} items={items} onUncook={onUncook} />);

      expect(screen.queryByTitle("Undo cook")).not.toBeInTheDocument();
    });
  });
});
