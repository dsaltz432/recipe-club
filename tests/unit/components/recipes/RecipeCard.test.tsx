import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@tests/utils";
import RecipeCard from "@/components/recipes/RecipeCard";
import type { Recipe, RecipeNote, RecipeRatingsSummary } from "@/types";

// Mock date-fns
vi.mock("date-fns", () => ({
  format: (date: Date) => {
    const d = new Date(date);
    return `${d.toLocaleString("en-US", { month: "short" })} ${d.getDate()}, ${d.getFullYear()}`;
  },
  parseISO: (str: string) => new Date(str),
}));

interface RecipeWithNotes extends Recipe {
  notes: RecipeNote[];
  ingredientName?: string;
  ratingSummary?: RecipeRatingsSummary;
}

const createMockNote = (overrides: Partial<RecipeNote> = {}): RecipeNote => ({
  id: "note-1",
  recipeId: "recipe-1",
  userId: "user-456",
  notes: undefined,
  photos: undefined,
  createdAt: "2025-01-15T10:00:00Z",
  userName: "Test User",
  userAvatar: "https://example.com/avatar.jpg",
  ...overrides,
});

const createMockRecipe = (overrides: Partial<RecipeWithNotes> = {}): RecipeWithNotes => ({
  id: "recipe-1",
  name: "Grilled Salmon",
  url: undefined,
  createdBy: "user-123",
  createdByName: "Test Creator",
  createdByAvatar: "https://example.com/creator-avatar.jpg",
  createdAt: "2025-01-15T10:00:00Z",
  eventId: "event-1",
  ingredientId: "ingredient-1",
  notes: [createMockNote()],
  ingredientName: "Salmon",
  ...overrides,
});

describe("RecipeCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders recipe name", () => {
    const recipe = createMockRecipe({ name: "Garlic Butter Salmon" });

    render(<RecipeCard recipe={recipe} />);

    expect(screen.getByText("Garlic Butter Salmon")).toBeInTheDocument();
  });

  it("renders ingredient badge", () => {
    const recipe = createMockRecipe({ ingredientName: "Salmon" });

    render(<RecipeCard recipe={recipe} />);

    expect(screen.getByText("Salmon")).toBeInTheDocument();
  });

  it("renders notes count", () => {
    const recipe = createMockRecipe({
      notes: [
        createMockNote({ id: "n1" }),
        createMockNote({ id: "n2" }),
        createMockNote({ id: "n3" }),
      ],
    });

    render(<RecipeCard recipe={recipe} />);

    expect(screen.getByText("3 notes")).toBeInTheDocument();
  });

  it("renders singular note text for one note", () => {
    const recipe = createMockRecipe({
      notes: [createMockNote()],
    });

    render(<RecipeCard recipe={recipe} />);

    expect(screen.getByText("1 note")).toBeInTheDocument();
  });

  it("renders submitter name", () => {
    const recipe = createMockRecipe({
      createdByName: "Alice",
    });

    render(<RecipeCard recipe={recipe} />);

    expect(screen.getByText(/by Alice/)).toBeInTheDocument();
  });

  it("renders submitter avatar with first letter fallback", () => {
    const recipe = createMockRecipe({
      createdByName: "Alice",
      createdByAvatar: undefined,
    });

    render(<RecipeCard recipe={recipe} />);

    expect(screen.getByText("A")).toBeInTheDocument();
  });

  it("shows submitter name without extra indicator", () => {
    const recipe = createMockRecipe({
      createdBy: "user-123",
      createdByName: "Test Creator",
    });

    render(<RecipeCard recipe={recipe} />);

    expect(screen.getByText(/by Test Creator/)).toBeInTheDocument();
  });

  it("renders recipe without crashing when all data is present", () => {
    const recipe = createMockRecipe({
      notes: [createMockNote()],
    });

    render(<RecipeCard recipe={recipe} />);

    expect(screen.getByText("Grilled Salmon")).toBeInTheDocument();
  });
});

describe("RecipeCard - Expandable Details", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows Show More button when there are details", () => {
    const recipe = createMockRecipe({ url: "https://example.com/recipe" });

    render(<RecipeCard recipe={recipe} />);

    expect(screen.getByRole("button", { name: /show more/i })).toBeInTheDocument();
  });

  it("does not show expand button when no URL and no notes", () => {
    const recipe = createMockRecipe({ url: undefined, notes: [] });

    render(<RecipeCard recipe={recipe} />);

    expect(screen.queryByRole("button", { name: /show more/i })).not.toBeInTheDocument();
  });

  it("toggles to Show Less when expanded", () => {
    const recipe = createMockRecipe({ url: "https://example.com/recipe" });

    render(<RecipeCard recipe={recipe} />);

    fireEvent.click(screen.getByRole("button", { name: /show more/i }));

    expect(screen.getByRole("button", { name: /show less/i })).toBeInTheDocument();
  });

  it("shows recipe URL link when expanded", () => {
    const recipe = createMockRecipe({ url: "https://example.com/salmon-recipe" });

    render(<RecipeCard recipe={recipe} />);

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
      notes: [createMockNote({ userName: "Alice", notes: "Great recipe!" })],
    });

    render(<RecipeCard recipe={recipe} />);

    // Expand
    fireEvent.click(screen.getByRole("button", { name: /show more/i }));

    expect(screen.getByText("Alice's Notes")).toBeInTheDocument();
  });

  it("shows note content when expanded", () => {
    const recipe = createMockRecipe({
      notes: [createMockNote({ notes: "Delicious with lemon!" })],
    });

    render(<RecipeCard recipe={recipe} />);

    // Expand
    fireEvent.click(screen.getByRole("button", { name: /show more/i }));

    expect(screen.getByText("Delicious with lemon!")).toBeInTheDocument();
  });

  it("shows note photos when expanded", () => {
    const recipe = createMockRecipe({
      notes: [
        createMockNote({
          photos: ["https://example.com/photo1.jpg", "https://example.com/photo2.jpg"],
        }),
      ],
    });

    render(<RecipeCard recipe={recipe} />);

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

    render(<RecipeCard recipe={recipe} />);

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
      url: undefined,
      notes: [createMockNote({ notes: "Some notes" })],
    });

    render(<RecipeCard recipe={recipe} />);

    // Expand
    fireEvent.click(screen.getByRole("button", { name: /show more/i }));

    expect(screen.queryByRole("link", { name: /view recipe/i })).not.toBeInTheDocument();
  });

  it("does not show notes section when note has no notes or photos", () => {
    const recipe = createMockRecipe({
      notes: [createMockNote({ notes: undefined, photos: undefined })],
    });

    render(<RecipeCard recipe={recipe} />);

    // Expand
    fireEvent.click(screen.getByRole("button", { name: /show more/i }));

    // Notes section should not be shown when there are no notes or photos
    expect(screen.queryByText(/Notes/i)).not.toBeInTheDocument();
  });

  it("does not render photos section when note has no photos", () => {
    const recipe = createMockRecipe({
      notes: [createMockNote({ photos: undefined })],
    });

    render(<RecipeCard recipe={recipe} />);

    // Expand
    fireEvent.click(screen.getByRole("button", { name: /show more/i }));

    // Should not have any recipe photos (avatars may still exist)
    const allImages = document.querySelectorAll('img[alt*="photo"]');
    expect(allImages.length).toBe(0);
  });

  it("does not render photos section when photos array is empty", () => {
    const recipe = createMockRecipe({
      notes: [createMockNote({ photos: [] })],
    });

    render(<RecipeCard recipe={recipe} />);

    // Expand
    fireEvent.click(screen.getByRole("button", { name: /show more/i }));

    // Should not have any recipe photos
    const allImages = document.querySelectorAll('img[alt*="photo"]');
    expect(allImages.length).toBe(0);
  });
});

describe("RecipeCard - Edge Cases", () => {
  it("handles recipe without ingredient name", () => {
    const recipe = createMockRecipe({ ingredientName: undefined });

    render(<RecipeCard recipe={recipe} />);

    // Recipe name should still render
    expect(screen.getByText("Grilled Salmon")).toBeInTheDocument();
  });

  it("handles empty notes array", () => {
    const recipe = createMockRecipe({ notes: [] });

    render(<RecipeCard recipe={recipe} />);

    expect(screen.getByText("0 notes")).toBeInTheDocument();
  });

  it("handles note without userName", () => {
    const recipe = createMockRecipe({
      notes: [createMockNote({ userName: undefined })],
    });

    render(<RecipeCard recipe={recipe} />);

    // Should not crash
    expect(screen.getByText("Grilled Salmon")).toBeInTheDocument();
  });

  it("shows photo count when notes have photos", () => {
    const recipe = createMockRecipe({
      notes: [
        createMockNote({ id: "n1", photos: ["photo1.jpg", "photo2.jpg"] }),
        createMockNote({ id: "n2", photos: ["photo3.jpg"] }),
        createMockNote({ id: "n3", photos: undefined }),
      ],
    });

    render(<RecipeCard recipe={recipe} />);

    // Should show total photo count (2 + 1 + 0 = 3)
    expect(screen.getByText("3 photos")).toBeInTheDocument();
  });

  it("shows photo count with empty photos array in some notes", () => {
    const recipe = createMockRecipe({
      notes: [
        createMockNote({ id: "n1", photos: ["photo1.jpg"] }),
        createMockNote({ id: "n2", photos: [] }),
      ],
    });

    render(<RecipeCard recipe={recipe} />);

    // Should show total photo count (1 + 0 = 1)
    expect(screen.getByText("1 photos")).toBeInTheDocument();
  });

  it("does not show photo count when no notes have photos", () => {
    const recipe = createMockRecipe({
      notes: [
        createMockNote({ id: "n1", photos: undefined }),
        createMockNote({ id: "n2", photos: [] }),
      ],
    });

    render(<RecipeCard recipe={recipe} />);

    // Photo count should not be shown
    expect(screen.queryByText(/photos/i)).not.toBeInTheDocument();
  });
});

describe("RecipeCard - Ratings Display", () => {
  it("displays rating summary when available", () => {
    const recipe = createMockRecipe({
      ratingSummary: {
        recipeId: "recipe-1",
        averageRating: 4.5,
        wouldCookAgainPercent: 80,
        totalRatings: 5,
        memberRatings: [
          { initial: "S", wouldCookAgain: true },
          { initial: "H", wouldCookAgain: true },
          { initial: "D", wouldCookAgain: true },
          { initial: "A", wouldCookAgain: true },
          { initial: "J", wouldCookAgain: false },
        ],
      },
    });

    render(<RecipeCard recipe={recipe} />);

    expect(screen.getByText("4.5/5")).toBeInTheDocument();
    expect(screen.getByText("Make again:")).toBeInTheDocument();
    expect(screen.getByText(/S: Yes/)).toBeInTheDocument();
    expect(screen.getByText(/J: No/)).toBeInTheDocument();
  });

  it("displays singular rating text for 1 rating", () => {
    const recipe = createMockRecipe({
      ratingSummary: {
        recipeId: "recipe-1",
        averageRating: 5.0,
        wouldCookAgainPercent: 100,
        totalRatings: 1,
        memberRatings: [{ initial: "S", wouldCookAgain: true }],
      },
    });

    render(<RecipeCard recipe={recipe} />);

    expect(screen.getByText("5/5")).toBeInTheDocument();
    expect(screen.getByText("S: Yes")).toBeInTheDocument();
  });

  it("does not display rating section when no ratings", () => {
    const recipe = createMockRecipe({
      ratingSummary: {
        recipeId: "recipe-1",
        averageRating: 0,
        wouldCookAgainPercent: 0,
        totalRatings: 0,
        memberRatings: [],
      },
    });

    render(<RecipeCard recipe={recipe} />);

    expect(screen.queryByText(/Make again:/i)).not.toBeInTheDocument();
  });

  it("does not display rating section when ratingSummary is undefined", () => {
    const recipe = createMockRecipe({
      ratingSummary: undefined,
    });

    render(<RecipeCard recipe={recipe} />);

    expect(screen.queryByText(/Make again:/i)).not.toBeInTheDocument();
  });

  it("handles ratingSummary without memberRatings array", () => {
    const recipe = createMockRecipe({
      ratingSummary: {
        recipeId: "recipe-1",
        averageRating: 4.0,
        wouldCookAgainPercent: 75,
        totalRatings: 4,
        memberRatings: [],
      },
    });

    render(<RecipeCard recipe={recipe} />);

    expect(screen.getByText("4/5")).toBeInTheDocument();
    // No "Make again:" section when memberRatings is empty
    expect(screen.queryByText("Make again:")).not.toBeInTheDocument();
  });
});
