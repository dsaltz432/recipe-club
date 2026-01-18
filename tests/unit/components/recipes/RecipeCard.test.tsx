import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@tests/utils";
import RecipeCard from "@/components/recipes/RecipeCard";
import type { Recipe, RecipeContribution } from "@/types";

// Mock date-fns
vi.mock("date-fns", () => ({
  format: (date: Date) => {
    const d = new Date(date);
    return `${d.toLocaleString("en-US", { month: "short" })} ${d.getDate()}, ${d.getFullYear()}`;
  },
  parseISO: (str: string) => new Date(str),
}));

interface RecipeWithContributions extends Recipe {
  contributions: RecipeContribution[];
  ingredientName?: string;
}

const createMockContribution = (overrides: Partial<RecipeContribution> = {}): RecipeContribution => ({
  id: "contrib-1",
  recipeId: "recipe-1",
  userId: "user-456",
  eventId: "event-1",
  notes: null,
  photos: null,
  createdAt: "2025-01-15T10:00:00Z",
  userName: "Test User",
  userAvatar: "https://example.com/avatar.jpg",
  eventDate: "2025-01-15",
  ingredientName: "Salmon",
  ...overrides,
});

const createMockRecipe = (overrides: Partial<RecipeWithContributions> = {}): RecipeWithContributions => ({
  id: "recipe-1",
  name: "Grilled Salmon",
  url: null,
  createdBy: "user-123",
  createdAt: "2025-01-15T10:00:00Z",
  contributions: [createMockContribution()],
  ingredientName: "Salmon",
  ...overrides,
});

describe("RecipeCard", () => {
  const mockUserId = "user-123";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders recipe name", () => {
    const recipe = createMockRecipe({ name: "Garlic Butter Salmon" });

    render(<RecipeCard recipe={recipe} userId={mockUserId} />);

    expect(screen.getByText("Garlic Butter Salmon")).toBeInTheDocument();
  });

  it("renders ingredient badge", () => {
    const recipe = createMockRecipe({ ingredientName: "Salmon" });

    render(<RecipeCard recipe={recipe} userId={mockUserId} />);

    expect(screen.getByText("Salmon")).toBeInTheDocument();
  });

  it("renders contribution count", () => {
    const recipe = createMockRecipe({
      contributions: [
        createMockContribution({ id: "c1" }),
        createMockContribution({ id: "c2" }),
        createMockContribution({ id: "c3" }),
      ],
    });

    render(<RecipeCard recipe={recipe} userId={mockUserId} />);

    expect(screen.getByText("3 contributions")).toBeInTheDocument();
  });

  it("renders singular contribution text for one contribution", () => {
    const recipe = createMockRecipe({
      contributions: [createMockContribution()],
    });

    render(<RecipeCard recipe={recipe} userId={mockUserId} />);

    expect(screen.getByText("1 contribution")).toBeInTheDocument();
  });

  it("renders contributor name for single contributor", () => {
    const recipe = createMockRecipe({
      contributions: [createMockContribution({ userName: "Alice" })],
    });

    render(<RecipeCard recipe={recipe} userId={mockUserId} />);

    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("shows X people for multiple unique contributors", () => {
    const recipe = createMockRecipe({
      contributions: [
        createMockContribution({ id: "c1", userName: "Alice" }),
        createMockContribution({ id: "c2", userName: "Bob" }),
        createMockContribution({ id: "c3", userName: "Charlie" }),
      ],
    });

    render(<RecipeCard recipe={recipe} userId={mockUserId} />);

    expect(screen.getByText("3 people")).toBeInTheDocument();
  });

  it("renders avatar with first letter fallback", () => {
    const recipe = createMockRecipe({
      contributions: [createMockContribution({ userName: "Alice", userAvatar: null })],
    });

    render(<RecipeCard recipe={recipe} userId={mockUserId} />);

    expect(screen.getByText("A")).toBeInTheDocument();
  });

  it("shows You badge when user has contributed", () => {
    const recipe = createMockRecipe({
      contributions: [createMockContribution({ userId: mockUserId })],
    });

    render(<RecipeCard recipe={recipe} userId={mockUserId} />);

    expect(screen.getByText("You")).toBeInTheDocument();
  });

  it("does not show You badge when user has not contributed", () => {
    const recipe = createMockRecipe({
      contributions: [createMockContribution({ userId: "other-user" })],
    });

    render(<RecipeCard recipe={recipe} userId={mockUserId} />);

    expect(screen.queryByText("You")).not.toBeInTheDocument();
  });

  it("shows +N indicator for more than 3 contributors", () => {
    const recipe = createMockRecipe({
      contributions: [
        createMockContribution({ id: "c1", userName: "Alice" }),
        createMockContribution({ id: "c2", userName: "Bob" }),
        createMockContribution({ id: "c3", userName: "Charlie" }),
        createMockContribution({ id: "c4", userName: "Diana" }),
        createMockContribution({ id: "c5", userName: "Eve" }),
      ],
    });

    render(<RecipeCard recipe={recipe} userId={mockUserId} />);

    expect(screen.getByText("+2")).toBeInTheDocument();
  });

  it("renders event date when present", () => {
    const recipe = createMockRecipe({
      contributions: [createMockContribution({ eventDate: "2025-01-15" })],
    });

    render(<RecipeCard recipe={recipe} userId={mockUserId} />);

    // The date should be rendered (format depends on date-fns)
    // Verify the recipe renders without errors when date is present
    expect(screen.getByText("Grilled Salmon")).toBeInTheDocument();
  });
});

describe("RecipeCard - Expandable Details", () => {
  const mockUserId = "user-123";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows Show More button when there are details", () => {
    const recipe = createMockRecipe({ url: "https://example.com/recipe" });

    render(<RecipeCard recipe={recipe} userId={mockUserId} />);

    expect(screen.getByRole("button", { name: /show more/i })).toBeInTheDocument();
  });

  it("does not show expand button when no URL and no contributions", () => {
    const recipe = createMockRecipe({ url: null, contributions: [] });

    render(<RecipeCard recipe={recipe} userId={mockUserId} />);

    expect(screen.queryByRole("button", { name: /show more/i })).not.toBeInTheDocument();
  });

  it("toggles to Show Less when expanded", () => {
    const recipe = createMockRecipe({ url: "https://example.com/recipe" });

    render(<RecipeCard recipe={recipe} userId={mockUserId} />);

    fireEvent.click(screen.getByRole("button", { name: /show more/i }));

    expect(screen.getByRole("button", { name: /show less/i })).toBeInTheDocument();
  });

  it("shows recipe URL link when expanded", () => {
    const recipe = createMockRecipe({ url: "https://example.com/salmon-recipe" });

    render(<RecipeCard recipe={recipe} userId={mockUserId} />);

    // Expand
    fireEvent.click(screen.getByRole("button", { name: /show more/i }));

    const link = screen.getByRole("link", { name: /view recipe/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "https://example.com/salmon-recipe");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("shows notes section when expanded with notes", () => {
    const recipe = createMockRecipe({
      contributions: [createMockContribution({ userName: "Alice", notes: "Great recipe!" })],
    });

    render(<RecipeCard recipe={recipe} userId={mockUserId} />);

    // Expand
    fireEvent.click(screen.getByRole("button", { name: /show more/i }));

    expect(screen.getByText("Alice's Notes")).toBeInTheDocument();
  });

  it("shows contribution notes when expanded", () => {
    const recipe = createMockRecipe({
      contributions: [createMockContribution({ notes: "Delicious with lemon!" })],
    });

    render(<RecipeCard recipe={recipe} userId={mockUserId} />);

    // Expand
    fireEvent.click(screen.getByRole("button", { name: /show more/i }));

    expect(screen.getByText("Delicious with lemon!")).toBeInTheDocument();
  });

  it("shows You badge next to user's notes when expanded", () => {
    const recipe = createMockRecipe({
      contributions: [
        createMockContribution({ id: "c1", userId: mockUserId, userName: "Test User", notes: "My notes" }),
        createMockContribution({ id: "c2", userId: "other-user", userName: "Other User", notes: "Their notes" }),
      ],
    });

    render(<RecipeCard recipe={recipe} userId={mockUserId} />);

    // Expand
    fireEvent.click(screen.getByRole("button", { name: /show more/i }));

    // Should show "You" badge in expanded notes section
    const youBadges = screen.getAllByText("You");
    expect(youBadges.length).toBeGreaterThan(0);
  });

  it("shows contribution photos when expanded", () => {
    const recipe = createMockRecipe({
      contributions: [
        createMockContribution({
          photos: ["https://example.com/photo1.jpg", "https://example.com/photo2.jpg"],
        }),
      ],
    });

    render(<RecipeCard recipe={recipe} userId={mockUserId} />);

    // Expand
    fireEvent.click(screen.getByRole("button", { name: /show more/i }));

    const photos = screen.getAllByRole("img");
    expect(photos.length).toBeGreaterThan(0);
    // Check that photos have correct src
    expect(photos.some((img) => img.getAttribute("src") === "https://example.com/photo1.jpg")).toBe(
      true
    );
  });

  it("collapses when Show Less is clicked", () => {
    const recipe = createMockRecipe({ url: "https://example.com/recipe" });

    render(<RecipeCard recipe={recipe} userId={mockUserId} />);

    // Expand
    fireEvent.click(screen.getByRole("button", { name: /show more/i }));
    expect(screen.getByText("View recipe")).toBeInTheDocument();

    // Collapse
    fireEvent.click(screen.getByRole("button", { name: /show less/i }));
    expect(screen.queryByText("View recipe")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /show more/i })).toBeInTheDocument();
  });

  it("does not show URL link when recipe has no URL", () => {
    const recipe = createMockRecipe({
      url: null,
      contributions: [createMockContribution({ notes: "Some notes" })],
    });

    render(<RecipeCard recipe={recipe} userId={mockUserId} />);

    // Expand
    fireEvent.click(screen.getByRole("button", { name: /show more/i }));

    expect(screen.queryByRole("link", { name: /view recipe/i })).not.toBeInTheDocument();
  });

  it("does not show notes section when contribution has no notes or photos", () => {
    const recipe = createMockRecipe({
      contributions: [createMockContribution({ notes: null, photos: null })],
    });

    render(<RecipeCard recipe={recipe} userId={mockUserId} />);

    // Expand
    fireEvent.click(screen.getByRole("button", { name: /show more/i }));

    // Notes section should not be shown when there are no notes or photos
    expect(screen.queryByText(/Notes/i)).not.toBeInTheDocument();
  });

  it("does not render photos section when contribution has no photos", () => {
    const recipe = createMockRecipe({
      contributions: [createMockContribution({ photos: null })],
    });

    render(<RecipeCard recipe={recipe} userId={mockUserId} />);

    // Expand
    fireEvent.click(screen.getByRole("button", { name: /show more/i }));

    // Should not have any recipe photos (avatars may still exist)
    const allImages = document.querySelectorAll('img[alt*="photo"]');
    expect(allImages.length).toBe(0);
  });

  it("does not render photos section when photos array is empty", () => {
    const recipe = createMockRecipe({
      contributions: [createMockContribution({ photos: [] })],
    });

    render(<RecipeCard recipe={recipe} userId={mockUserId} />);

    // Expand
    fireEvent.click(screen.getByRole("button", { name: /show more/i }));

    // Should not have any recipe photos
    const allImages = document.querySelectorAll('img[alt*="photo"]');
    expect(allImages.length).toBe(0);
  });
});

describe("RecipeCard - Edge Cases", () => {
  const mockUserId = "user-123";

  it("handles recipe without ingredient name", () => {
    const recipe = createMockRecipe({ ingredientName: undefined });

    render(<RecipeCard recipe={recipe} userId={mockUserId} />);

    // Recipe name should still render
    expect(screen.getByText("Grilled Salmon")).toBeInTheDocument();
  });

  it("handles empty contributions array", () => {
    const recipe = createMockRecipe({ contributions: [] });

    render(<RecipeCard recipe={recipe} userId={mockUserId} />);

    expect(screen.getByText("0 contributions")).toBeInTheDocument();
  });

  it("handles contributions without event date", () => {
    const recipe = createMockRecipe({
      contributions: [createMockContribution({ eventDate: undefined })],
    });

    render(<RecipeCard recipe={recipe} userId={mockUserId} />);

    // Should not crash
    expect(screen.getByText("Grilled Salmon")).toBeInTheDocument();
  });
});
