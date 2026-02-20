import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@tests/utils";
import { createMockUser, createMockIngredient, createMockEvent } from "@tests/utils";
import HomeSection from "@/components/home/HomeSection";

// Mock child components to isolate HomeSection logic
vi.mock("@/components/home/CountdownCard", () => ({
  default: ({ event }: { event: { ingredientName?: string } }) => (
    <div data-testid="countdown-card">CountdownCard: {event.ingredientName}</div>
  ),
}));

vi.mock("@/components/wheel/IngredientWheel", () => ({
  default: () => <div data-testid="ingredient-wheel">IngredientWheel</div>,
}));

vi.mock("@/components/ingredients/IngredientBank", () => ({
  default: () => <div data-testid="ingredient-bank">IngredientBank</div>,
}));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe("HomeSection", () => {
  const defaultProps = {
    user: createMockUser({ name: "Alice Smith" }),
    activeEvent: null as ReturnType<typeof createMockEvent> | null,
    ingredients: [createMockIngredient()],
    setIngredients: vi.fn(),
    isAdmin: false,
    onEventCreated: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders personalized greeting with user first name", () => {
    render(<HomeSection {...defaultProps} />);
    expect(screen.getByText(/What's Cooking, Alice\?/)).toBeInTheDocument();
  });

  it("renders fallback greeting when user has no name", () => {
    render(<HomeSection {...defaultProps} user={createMockUser({ name: undefined })} />);
    expect(screen.getByText(/What's Cooking, Chef\?/)).toBeInTheDocument();
  });

  it("renders CountdownCard when there is an active event", () => {
    const event = createMockEvent({ ingredientName: "Salmon" });
    render(<HomeSection {...defaultProps} activeEvent={event} />);
    expect(screen.getByTestId("countdown-card")).toBeInTheDocument();
    expect(screen.getByText("You have an upcoming event!")).toBeInTheDocument();
  });

  it("renders IngredientWheel and IngredientBank for admin with no active event", () => {
    render(<HomeSection {...defaultProps} isAdmin={true} />);
    expect(screen.getByTestId("ingredient-wheel")).toBeInTheDocument();
    expect(screen.getByTestId("ingredient-bank")).toBeInTheDocument();
    expect(screen.getByText("Ready to start a new culinary adventure?")).toBeInTheDocument();
  });

  it("renders non-admin empty state with Browse Recipes button when no active event", () => {
    render(<HomeSection {...defaultProps} isAdmin={false} />);
    expect(screen.getByText("No Event Scheduled")).toBeInTheDocument();
    expect(screen.getByText("Welcome back to Recipe Club!")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /browse recipes/i })).toBeInTheDocument();
  });

  it("navigates to recipes tab when Browse Recipes button is clicked", async () => {
    const { fireEvent } = await import("@testing-library/react");
    render(<HomeSection {...defaultProps} isAdmin={false} />);
    const button = screen.getByRole("button", { name: /browse recipes/i });
    fireEvent.click(button);
    expect(mockNavigate).toHaveBeenCalledWith("/dashboard/recipes");
  });

  it("passes correct props to CountdownCard", () => {
    const event = createMockEvent();
    const onRecipeAdded = vi.fn();
    const onEventUpdated = vi.fn();
    render(
      <HomeSection
        {...defaultProps}
        activeEvent={event}
        onRecipeAdded={onRecipeAdded}
        onEventUpdated={onEventUpdated}
      />
    );
    expect(screen.getByTestId("countdown-card")).toBeInTheDocument();
  });
});
