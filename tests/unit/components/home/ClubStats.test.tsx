import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@tests/utils";
import ClubStats from "@/components/home/ClubStats";

// Hoisted so we can configure per-test
const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: mockFrom },
}));

vi.spyOn(console, "error").mockImplementation(() => {});

// Helpers to build common query chains
// ingredients: from().select().gt().order().limit() → resolves
function makeIngredientsChain(data: unknown[]) {
  return {
    select: vi.fn().mockReturnValue({
      gt: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ data, error: null }),
        }),
      }),
    }),
  };
}

// recipe_ratings: from().select() → resolves
function makeRatingsChain(data: unknown[]) {
  return {
    select: vi.fn().mockResolvedValue({ data, error: null }),
  };
}

// scheduled_events: from().select().eq().eq() → resolves with count
function makeEventsCountChain(count: number) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ count, error: null }),
      }),
    }),
  };
}

// recipes: from().select().not() → resolves with count
function makeRecipesCountChain(count: number) {
  return {
    select: vi.fn().mockReturnValue({
      not: vi.fn().mockResolvedValue({ count, error: null }),
    }),
  };
}

function setupMocks({
  ingredients = [] as unknown[],
  ratings = [] as unknown[],
  eventsCount = 0,
  recipesCount = 0,
} = {}) {
  mockFrom.mockImplementation((table: string) => {
    if (table === "ingredients") return makeIngredientsChain(ingredients);
    if (table === "recipe_ratings") return makeRatingsChain(ratings);
    if (table === "scheduled_events") return makeEventsCountChain(eventsCount);
    return makeRecipesCountChain(recipesCount);
  });
}

describe("ClubStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading skeletons before data resolves", () => {
    // Return a chain where every terminal method hangs forever
    const hanging = new Promise<never>(() => {});
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        gt: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({ limit: vi.fn().mockReturnValue(hanging) }),
        }),
        eq: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue(hanging) }),
        not: vi.fn().mockReturnValue(hanging),
      }),
    });
    const { container } = render(<ClubStats />);
    // Skeleton divs are rendered during loading
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("renders nothing when there are no events and no ingredients", async () => {
    setupMocks({ ingredients: [], ratings: [], eventsCount: 0, recipesCount: 0 });
    const { container } = render(<ClubStats />);
    await waitFor(() => {
      expect(container.querySelectorAll(".animate-pulse").length).toBe(0);
    });
    // When component returns null, container should be empty
    expect(container).toBeEmptyDOMElement();
  });

  it("shows Club History heading when there is data", async () => {
    setupMocks({
      ingredients: [{ id: "i1", name: "Mushroom", used_count: 3, color: null }],
      eventsCount: 5,
      recipesCount: 12,
    });
    render(<ClubStats />);
    await waitFor(() => {
      expect(screen.getByText("Club History")).toBeInTheDocument();
    });
  });

  it("shows events completed and recipes cooked stats", async () => {
    setupMocks({
      ingredients: [{ id: "i1", name: "Basil", used_count: 1, color: null }],
      eventsCount: 7,
      recipesCount: 20,
    });
    render(<ClubStats />);
    await waitFor(() => {
      expect(screen.getByText("7")).toBeInTheDocument();
    });
    expect(screen.getByText("20")).toBeInTheDocument();
    expect(screen.getByText("Events Completed")).toBeInTheDocument();
    expect(screen.getByText("Recipes Cooked")).toBeInTheDocument();
  });

  it("shows ingredient leaderboard with usage counts", async () => {
    setupMocks({
      ingredients: [
        { id: "i1", name: "Mushroom", used_count: 4, color: null },
        { id: "i2", name: "Garlic", used_count: 2, color: null },
      ],
      eventsCount: 4,
      recipesCount: 8,
    });
    render(<ClubStats />);
    await waitFor(() => {
      expect(screen.getByText("Top Ingredients")).toBeInTheDocument();
    });
    // Mushroom appears in both the "Most Featured" bubble and the leaderboard list
    expect(screen.getAllByText("Mushroom").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Garlic")).toBeInTheDocument();
    expect(screen.getByText("4x")).toBeInTheDocument();
    expect(screen.getByText("2x")).toBeInTheDocument();
  });

  it("shows top-rated recipes with averaged star ratings", async () => {
    setupMocks({
      ingredients: [{ id: "i1", name: "Garlic", used_count: 3, color: null }],
      ratings: [
        { recipe_id: "r1", overall_rating: 5, recipes: { name: "Garlic Pasta" } },
        { recipe_id: "r1", overall_rating: 4, recipes: { name: "Garlic Pasta" } },
        { recipe_id: "r2", overall_rating: 3, recipes: { name: "Mushroom Soup" } },
        { recipe_id: "r2", overall_rating: 3, recipes: { name: "Mushroom Soup" } },
      ],
      eventsCount: 3,
      recipesCount: 6,
    });
    render(<ClubStats />);
    await waitFor(() => {
      expect(screen.getByText("Garlic Pasta")).toBeInTheDocument();
    });
    expect(screen.getByText("Mushroom Soup")).toBeInTheDocument();
    expect(screen.getByText("Top-Rated Recipes")).toBeInTheDocument();
    // Garlic Pasta avg = (5+4)/2 = 4.5 — compact mobile rating
    expect(screen.getByText("4.5 ★")).toBeInTheDocument();
  });

  it("excludes recipes with fewer than 2 ratings from top-rated list", async () => {
    setupMocks({
      ingredients: [{ id: "i1", name: "Basil", used_count: 1, color: null }],
      ratings: [
        // Only 1 rating — should not appear in top-rated
        { recipe_id: "r1", overall_rating: 5, recipes: { name: "Solo Recipe" } },
      ],
      eventsCount: 1,
      recipesCount: 1,
    });
    render(<ClubStats />);
    await waitFor(() => {
      expect(screen.getByText("Club History")).toBeInTheDocument();
    });
    expect(screen.queryByText("Top-Rated Recipes")).not.toBeInTheDocument();
    expect(screen.queryByText("Solo Recipe")).not.toBeInTheDocument();
  });
});
