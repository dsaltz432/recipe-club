import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@tests/utils";
import HomeSection from "@/components/home/HomeSection";
import { createMockUser, createMockEvent, createMockIngredient } from "@tests/utils";
import type { Ingredient } from "@/types";

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

// Mock supabase (needed by CountdownCard and HomeSection rpc)
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
    }),
    rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
  },
}));

// Mock sonner
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// Mock Google Calendar
vi.mock("@/lib/googleCalendar", () => ({
  updateCalendarEvent: vi.fn().mockResolvedValue({ success: true }),
  deleteCalendarEvent: vi.fn().mockResolvedValue({ success: true }),
}));

// Mock CountdownCard to simplify HomeSection testing
vi.mock("@/components/home/CountdownCard", () => ({
  default: ({ event }: { event: { ingredientName?: string } }) => (
    <div data-testid="countdown-card">{event.ingredientName}</div>
  ),
}));

// Mock IngredientWheel
vi.mock("@/components/wheel/IngredientWheel", () => ({
  default: () => <div data-testid="ingredient-wheel">Wheel</div>,
}));

// Mock IngredientBank
vi.mock("@/components/ingredients/IngredientBank", () => ({
  default: () => <div data-testid="ingredient-bank">Bank</div>,
}));

describe("HomeSection", () => {
  const user = createMockUser({ name: "Alice Smith" });
  const ingredients: Ingredient[] = [createMockIngredient()];

  const defaultProps = {
    user,
    activeEvent: null as ReturnType<typeof createMockEvent> | null,
    ingredients,
    setIngredients: vi.fn(),
    isAdmin: false,
    onEventCreated: vi.fn(),
    onRecipeAdded: vi.fn(),
    onEventUpdated: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows greeting with user first name", () => {
    render(<HomeSection {...defaultProps} />);
    expect(screen.getByText("What's Cooking, Alice?")).toBeInTheDocument();
  });

  it("shows 'Chef' when user has no name", () => {
    render(<HomeSection {...defaultProps} user={createMockUser({ name: "" })} />);
    expect(screen.getByText("What's Cooking, Chef?")).toBeInTheDocument();
  });

  it("shows 'Chef' when user is null", () => {
    render(<HomeSection {...defaultProps} user={null} />);
    expect(screen.getByText("What's Cooking, Chef?")).toBeInTheDocument();
  });

  describe("with active event", () => {
    const activeEvent = createMockEvent({ ingredientName: "Mushroom" });

    it("shows 'You have an upcoming event!' message", () => {
      render(<HomeSection {...defaultProps} activeEvent={activeEvent} />);
      expect(screen.getByText("You have an upcoming event!")).toBeInTheDocument();
    });

    it("renders CountdownCard", () => {
      render(<HomeSection {...defaultProps} activeEvent={activeEvent} />);
      expect(screen.getByTestId("countdown-card")).toBeInTheDocument();
      expect(screen.getByText("Mushroom")).toBeInTheDocument();
    });

    it("does not show wheel or bank", () => {
      render(<HomeSection {...defaultProps} activeEvent={activeEvent} isAdmin={true} />);
      expect(screen.queryByTestId("ingredient-wheel")).not.toBeInTheDocument();
      expect(screen.queryByTestId("ingredient-bank")).not.toBeInTheDocument();
    });

    it("passes empty string when user is null", () => {
      render(<HomeSection {...defaultProps} activeEvent={activeEvent} user={null} />);
      expect(screen.getByTestId("countdown-card")).toBeInTheDocument();
    });
  });

  describe("without active event, admin", () => {
    it("shows admin-specific message", () => {
      render(<HomeSection {...defaultProps} isAdmin={true} />);
      expect(screen.getByText("Ready to start a new culinary adventure?")).toBeInTheDocument();
    });

    it("renders wheel and bank for admin", () => {
      render(<HomeSection {...defaultProps} isAdmin={true} />);
      expect(screen.getByTestId("ingredient-wheel")).toBeInTheDocument();
      expect(screen.getByTestId("ingredient-bank")).toBeInTheDocument();
    });

    it("renders wheel and bank for admin with null user", () => {
      render(<HomeSection {...defaultProps} isAdmin={true} user={null} />);
      expect(screen.getByTestId("ingredient-wheel")).toBeInTheDocument();
      expect(screen.getByTestId("ingredient-bank")).toBeInTheDocument();
    });
  });

  describe("without active event, non-admin", () => {
    it("shows welcome message for non-admin", () => {
      render(<HomeSection {...defaultProps} isAdmin={false} />);
      expect(screen.getByText("Welcome back to Recipe Club!")).toBeInTheDocument();
    });

    it("renders no event scheduled card", () => {
      render(<HomeSection {...defaultProps} isAdmin={false} />);
      expect(screen.getByText("No Event Scheduled")).toBeInTheDocument();
      expect(screen.getByText(/There's no upcoming Recipe Club event/)).toBeInTheDocument();
    });

    it("does not show wheel or bank", () => {
      render(<HomeSection {...defaultProps} isAdmin={false} />);
      expect(screen.queryByTestId("ingredient-wheel")).not.toBeInTheDocument();
      expect(screen.queryByTestId("ingredient-bank")).not.toBeInTheDocument();
    });

    it("navigates to /dashboard/recipes when Browse Recipes is clicked", () => {
      render(<HomeSection {...defaultProps} isAdmin={false} />);
      fireEvent.click(screen.getByText("Browse Recipes"));
      expect(mockNavigate).toHaveBeenCalledWith("/dashboard/recipes");
    });
  });
});
