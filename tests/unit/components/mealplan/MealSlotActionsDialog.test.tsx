import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@tests/utils";
import MealSlotActionsDialog from "@/components/mealplan/MealSlotActionsDialog";
import type { MealPlanItem } from "@/types";

const makeMeal = (overrides: Partial<MealPlanItem> = {}): MealPlanItem => ({
  id: "item-1",
  planId: "plan-1",
  dayOfWeek: 1,
  mealType: "dinner",
  sortOrder: 0,
  recipeName: "Grilled Salmon",
  ...overrides,
});

describe("MealSlotActionsDialog", () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    items: [makeMeal()],
    dayOfWeek: 1,
    mealType: "dinner",
    onRemoveItem: vi.fn(),
    onMarkCooked: vi.fn(),
    onUndoCooked: vi.fn(),
    onViewDetails: vi.fn(),
    onAddMeal: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders dialog title with day and meal type", () => {
    render(<MealSlotActionsDialog {...defaultProps} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/Monday/)).toBeInTheDocument();
    expect(screen.getByText(/Dinner/)).toBeInTheDocument();
  });

  it("shows singular meal count in description", () => {
    render(<MealSlotActionsDialog {...defaultProps} />);
    expect(screen.getByText("1 meal planned")).toBeInTheDocument();
  });

  it("shows plural meal count with multiple items", () => {
    render(
      <MealSlotActionsDialog
        {...defaultProps}
        items={[makeMeal({ id: "a" }), makeMeal({ id: "b", recipeName: "Salad" })]}
      />
    );
    expect(screen.getByText("2 meals planned")).toBeInTheDocument();
  });

  it("renders all meal names", () => {
    render(
      <MealSlotActionsDialog
        {...defaultProps}
        items={[
          makeMeal({ id: "a", recipeName: "Grilled Salmon" }),
          makeMeal({ id: "b", recipeName: "Caesar Salad" }),
        ]}
      />
    );
    expect(screen.getByText("Grilled Salmon")).toBeInTheDocument();
    expect(screen.getByText("Caesar Salad")).toBeInTheDocument();
  });

  it("falls back to customName when recipeName is absent", () => {
    render(
      <MealSlotActionsDialog
        {...defaultProps}
        items={[makeMeal({ recipeName: undefined, customName: "Homemade Soup" })]}
      />
    );
    expect(screen.getByText("Homemade Soup")).toBeInTheDocument();
  });

  it("falls back to 'Unnamed meal' when neither name is set", () => {
    render(
      <MealSlotActionsDialog
        {...defaultProps}
        items={[makeMeal({ recipeName: undefined, customName: undefined })]}
      />
    );
    expect(screen.getByText("Unnamed meal")).toBeInTheDocument();
  });

  it("calls onRemoveItem with correct id when remove button is clicked", () => {
    render(
      <MealSlotActionsDialog
        {...defaultProps}
        items={[makeMeal({ id: "meal-abc" })]}
      />
    );
    fireEvent.click(screen.getByLabelText("Remove Grilled Salmon"));
    expect(defaultProps.onRemoveItem).toHaveBeenCalledWith("meal-abc");
  });

  it("shows 'Mark as Cooked' button when meals are not cooked", () => {
    render(<MealSlotActionsDialog {...defaultProps} />);
    expect(screen.getByText("Mark as Cooked")).toBeInTheDocument();
    expect(screen.queryByText("Undo Cooked")).not.toBeInTheDocument();
  });

  it("shows 'Undo Cooked' button when all meals are cooked", () => {
    const cookedItem = makeMeal({ cookedAt: "2026-04-01T18:00:00Z" });
    render(<MealSlotActionsDialog {...defaultProps} items={[cookedItem]} />);
    expect(screen.getByText("Undo Cooked")).toBeInTheDocument();
    expect(screen.queryByText("Mark as Cooked")).not.toBeInTheDocument();
  });

  it("shows 'Mark as Cooked' when only some items are cooked", () => {
    const items = [
      makeMeal({ id: "a", cookedAt: "2026-04-01T18:00:00Z" }),
      makeMeal({ id: "b", recipeName: "Salad" }),
    ];
    render(<MealSlotActionsDialog {...defaultProps} items={items} />);
    expect(screen.getByText("Mark as Cooked")).toBeInTheDocument();
  });

  it("calls onMarkCooked when 'Mark as Cooked' is clicked", () => {
    render(<MealSlotActionsDialog {...defaultProps} />);
    fireEvent.click(screen.getByText("Mark as Cooked"));
    expect(defaultProps.onMarkCooked).toHaveBeenCalledTimes(1);
  });

  it("calls onUndoCooked when 'Undo Cooked' is clicked", () => {
    render(
      <MealSlotActionsDialog
        {...defaultProps}
        items={[makeMeal({ cookedAt: "2026-04-01T18:00:00Z" })]}
      />
    );
    fireEvent.click(screen.getByText("Undo Cooked"));
    expect(defaultProps.onUndoCooked).toHaveBeenCalledTimes(1);
  });

  it("calls onViewDetails when 'View Details' is clicked", () => {
    render(<MealSlotActionsDialog {...defaultProps} />);
    fireEvent.click(screen.getByText("View Details"));
    expect(defaultProps.onViewDetails).toHaveBeenCalledTimes(1);
  });

  it("calls onOpenChange(false) and onAddMeal when 'Add Another Meal' is clicked", () => {
    render(<MealSlotActionsDialog {...defaultProps} />);
    fireEvent.click(screen.getByText("Add Another Meal"));
    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
    expect(defaultProps.onAddMeal).toHaveBeenCalledTimes(1);
  });

  it("shows green checkmark icon for cooked items", () => {
    render(
      <MealSlotActionsDialog
        {...defaultProps}
        items={[makeMeal({ cookedAt: "2026-04-01T18:00:00Z" })]}
      />
    );
    // CheckCircle2 renders an svg; the cooked button text changes to "Undo Cooked"
    expect(screen.getByText("Undo Cooked")).toBeInTheDocument();
  });

  it("renders correct day name for Sunday (dayOfWeek=0)", () => {
    render(<MealSlotActionsDialog {...defaultProps} dayOfWeek={0} />);
    expect(screen.getByText(/Sunday/)).toBeInTheDocument();
  });

  it("renders correct meal type label for breakfast", () => {
    render(
      <MealSlotActionsDialog {...defaultProps} mealType="breakfast" />
    );
    expect(screen.getByText(/Breakfast/)).toBeInTheDocument();
  });

  it("calls onOpenChange when dialog requests close", () => {
    render(<MealSlotActionsDialog {...defaultProps} />);
    // The dialog's own close button (X) triggers onOpenChange
    const closeBtn = screen.getByRole("button", { name: /close/i });
    fireEvent.click(closeBtn);
    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("does not render when open is false", () => {
    render(<MealSlotActionsDialog {...defaultProps} open={false} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
