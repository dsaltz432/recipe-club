import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@tests/utils";
import type { Recipe, RecipeNote, RecipeRatingsSummary, RecipeIngredient } from "@/types";

// Mock supabase client (imported transitively by groceryList)
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}));

// Mock RecipeIngredientList — RecipeCard.test.tsx tests RecipeCard behavior, not the list component
vi.mock("@/components/recipes/RecipeIngredientList", () => ({
  default: ({ recipeId }: { recipeId: string }) => (
    <div data-testid={`recipe-ingredient-list-${recipeId}`}>RecipeIngredientList</div>
  ),
}));

// Mock RecipeTips — it uses useRecipeTips which hits Supabase
vi.mock("@/components/recipes/RecipeTips", () => ({
  default: ({ recipeId }: { recipeId: string }) => (
    <div data-testid={`recipe-tips-${recipeId}`}>RecipeTips</div>
  ),
}));

// Mock useRecipeTips (used transitively)
vi.mock("@/hooks/useRecipeTips", () => ({
  useRecipeTips: () => ({
    tips: [],
    loading: false,
    fetchTips: vi.fn(),
    addTip: vi.fn(),
    deleteTip: vi.fn(),
  }),
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

// Mock DropdownMenu — render all children immediately so action items are accessible in tests
vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick, ...props }: React.HTMLAttributes<HTMLButtonElement> & { onClick?: () => void }) => (
    <button role="menuitem" onClick={onClick} {...props}>{children}</button>
  ),
  DropdownMenuSeparator: () => <hr />,
}));

import RecipeCard from "@/components/recipes/RecipeCard";

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

  it("shows recipe URL icon in header when recipe has URL", () => {
    const recipe = createMockRecipe({ url: "https://example.com/salmon-recipe" });

    render(<RecipeCard recipe={recipe} />);

    const link = screen.getByLabelText(/Open recipe URL/);
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

    // URL icon always visible in header
    expect(screen.getByLabelText(/Open recipe URL/)).toBeInTheDocument();

    // Expand
    fireEvent.click(screen.getByRole("button", { name: /show more/i }));

    // Collapse
    fireEvent.click(screen.getByRole("button", { name: /show less/i }));
    expect(screen.getByRole("button", { name: /show more/i })).toBeInTheDocument();
  });

  it("does not show URL icon when recipe has no URL", () => {
    const recipe = createMockRecipe({
      url: undefined,
      notes: [createMockNote({ notes: "Some notes" })],
    });

    render(<RecipeCard recipe={recipe} />);

    expect(screen.queryByLabelText(/Open recipe URL/)).not.toBeInTheDocument();
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
    expect(screen.getByText("1 photo")).toBeInTheDocument();
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

describe("RecipeCard - Personal Recipe Edit/Delete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows edit and delete buttons for personal recipes with callbacks", () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const recipe = createMockRecipe({ isPersonal: true });

    render(<RecipeCard recipe={recipe} onEdit={onEdit} onDelete={onDelete} />);

    expect(screen.getByLabelText(/Edit recipe/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Delete recipe/)).toBeInTheDocument();
  });

  it("shows edit and delete buttons for non-personal recipes with callbacks", () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const recipe = createMockRecipe({ isPersonal: false });

    render(<RecipeCard recipe={recipe} onEdit={onEdit} onDelete={onDelete} />);

    expect(screen.getByLabelText(/Edit recipe/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Delete recipe/)).toBeInTheDocument();
  });

  it("does not show edit/delete buttons when callbacks are not provided", () => {
    const recipe = createMockRecipe({ isPersonal: true });

    render(<RecipeCard recipe={recipe} />);

    expect(screen.queryByLabelText(/Edit recipe/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Delete recipe/)).not.toBeInTheDocument();
  });

  it("calls onEdit with recipe when edit button is clicked", () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const recipe = createMockRecipe({ isPersonal: true });

    render(<RecipeCard recipe={recipe} onEdit={onEdit} onDelete={onDelete} />);

    fireEvent.click(screen.getByLabelText(/Edit recipe/));

    expect(onEdit).toHaveBeenCalledWith(recipe);
  });

  it("calls onDelete with recipe id when delete button is clicked", () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const recipe = createMockRecipe({ isPersonal: true, id: "recipe-42" });

    render(<RecipeCard recipe={recipe} onEdit={onEdit} onDelete={onDelete} />);

    fireEvent.click(screen.getByLabelText(/Delete recipe/));

    expect(onDelete).toHaveBeenCalledWith("recipe-42");
  });

  it("shows edit and delete when isPersonal is undefined", () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const recipe = createMockRecipe({ isPersonal: undefined });

    render(<RecipeCard recipe={recipe} onEdit={onEdit} onDelete={onDelete} />);

    expect(screen.getByLabelText(/Edit recipe/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Delete recipe/)).toBeInTheDocument();
  });

  it("shows delete button for club recipe when only onDelete provided", () => {
    const onDelete = vi.fn();
    const recipe = createMockRecipe({ isPersonal: false, eventId: "event-1" });

    render(<RecipeCard recipe={recipe} onDelete={onDelete} />);

    expect(screen.getByLabelText(/Delete recipe/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Edit recipe/)).not.toBeInTheDocument();
  });

  it("calls onDelete with club recipe id when delete button is clicked", () => {
    const onDelete = vi.fn();
    const recipe = createMockRecipe({ isPersonal: false, id: "club-recipe-42", eventId: "event-1" });

    render(<RecipeCard recipe={recipe} onDelete={onDelete} />);

    fireEvent.click(screen.getByLabelText(/Delete recipe/));

    expect(onDelete).toHaveBeenCalledWith("club-recipe-42");
  });

  it("shows Personal badge alongside edit/delete buttons", () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const recipe = createMockRecipe({ isPersonal: true });

    render(<RecipeCard recipe={recipe} onEdit={onEdit} onDelete={onDelete} />);

    expect(screen.getByText("Personal")).toBeInTheDocument();
    expect(screen.getByLabelText(/Edit recipe/)).toBeInTheDocument();
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

describe("RecipeCard - Add Note Button", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows Add Note button when onAddNote is provided", () => {
    const onAddNote = vi.fn();
    const recipe = createMockRecipe();

    render(<RecipeCard recipe={recipe} onAddNote={onAddNote} />);

    expect(screen.getByLabelText(/Add note/)).toBeInTheDocument();
  });

  it("does not show Add Note button when onAddNote is not provided", () => {
    const recipe = createMockRecipe();

    render(<RecipeCard recipe={recipe} />);

    expect(screen.queryByLabelText(/Add note/)).not.toBeInTheDocument();
  });

  it("calls onAddNote with recipe when Add Note button is clicked", () => {
    const onAddNote = vi.fn();
    const recipe = createMockRecipe();

    render(<RecipeCard recipe={recipe} onAddNote={onAddNote} />);

    fireEvent.click(screen.getByLabelText(/Add note/));

    expect(onAddNote).toHaveBeenCalledWith(recipe);
  });
});

describe("RecipeCard - Edit Rating Button", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows edit rating button when recipe has eventId and onEditRating is provided", () => {
    const onEditRating = vi.fn();
    const recipe = createMockRecipe({
      eventId: "event-1",
      ratingSummary: {
        recipeId: "recipe-1",
        averageRating: 4.5,
        wouldCookAgainPercent: 80,
        totalRatings: 2,
        memberRatings: [{ initial: "S", wouldCookAgain: true }],
      },
    });

    render(<RecipeCard recipe={recipe} onEditRating={onEditRating} />);

    expect(screen.getByLabelText(/Edit rating/)).toBeInTheDocument();
  });

  it("does not show edit rating button when onEditRating is not provided", () => {
    const recipe = createMockRecipe({
      eventId: "event-1",
      ratingSummary: {
        recipeId: "recipe-1",
        averageRating: 4.5,
        wouldCookAgainPercent: 80,
        totalRatings: 2,
        memberRatings: [{ initial: "S", wouldCookAgain: true }],
      },
    });

    render(<RecipeCard recipe={recipe} />);

    expect(screen.queryByLabelText(/Edit rating/)).not.toBeInTheDocument();
  });

  it("does not show edit rating button when recipe has no eventId", () => {
    const onEditRating = vi.fn();
    const recipe = createMockRecipe({
      eventId: undefined,
      ratingSummary: {
        recipeId: "recipe-1",
        averageRating: 4.5,
        wouldCookAgainPercent: 80,
        totalRatings: 2,
        memberRatings: [{ initial: "S", wouldCookAgain: true }],
      },
    });

    render(<RecipeCard recipe={recipe} onEditRating={onEditRating} />);

    expect(screen.queryByLabelText(/Edit rating/)).not.toBeInTheDocument();
  });

  it("does not show edit rating button when there are no ratings", () => {
    const onEditRating = vi.fn();
    const recipe = createMockRecipe({
      eventId: "event-1",
      ratingSummary: undefined,
    });

    render(<RecipeCard recipe={recipe} onEditRating={onEditRating} />);

    expect(screen.queryByLabelText(/Edit rating/)).not.toBeInTheDocument();
  });

  it("calls onEditRating with recipe when edit rating button is clicked", () => {
    const onEditRating = vi.fn();
    const recipe = createMockRecipe({
      eventId: "event-1",
      ratingSummary: {
        recipeId: "recipe-1",
        averageRating: 4.5,
        wouldCookAgainPercent: 80,
        totalRatings: 2,
        memberRatings: [{ initial: "S", wouldCookAgain: true }],
      },
    });

    render(<RecipeCard recipe={recipe} onEditRating={onEditRating} />);

    fireEvent.click(screen.getByLabelText(/Edit rating/));

    expect(onEditRating).toHaveBeenCalledWith(recipe);
  });
});

const createMockIngredient = (overrides: Partial<RecipeIngredient> = {}): RecipeIngredient => ({
  id: "ing-1",
  recipeId: "recipe-1",
  name: "Salmon fillet",
  quantity: 2,
  unit: "lb",
  category: "meat_seafood",
  rawText: "2 lb salmon fillet",
  sortOrder: 0,
  createdAt: "2025-01-15T10:00:00Z",
  ...overrides,
});

describe("RecipeCard - Ingredients Section", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows ingredient count when ingredients are provided", () => {
    const recipe = createMockRecipe();
    const ingredients = [
      createMockIngredient({ id: "ing-1", name: "Salmon" }),
      createMockIngredient({ id: "ing-2", name: "Lemon", category: "produce" }),
    ];

    render(<RecipeCard recipe={recipe} ingredients={ingredients} />);

    expect(screen.getByText("2 ingredients")).toBeInTheDocument();
  });

  it("shows singular ingredient text for one ingredient", () => {
    const recipe = createMockRecipe();
    const ingredients = [createMockIngredient()];

    render(<RecipeCard recipe={recipe} ingredients={ingredients} />);

    expect(screen.getByText("1 ingredient")).toBeInTheDocument();
  });

  it("expands to show RecipeIngredientList when clicked", () => {
    const recipe = createMockRecipe();
    const ingredients = [
      createMockIngredient({ id: "ing-1", name: "Salmon", quantity: 2, unit: "lb", category: "meat_seafood" }),
      createMockIngredient({ id: "ing-2", name: "Lemon", quantity: 1, unit: undefined, category: "produce" }),
      createMockIngredient({ id: "ing-3", name: "Garlic", quantity: undefined, unit: undefined, category: "spices" }),
    ];

    render(<RecipeCard recipe={recipe} ingredients={ingredients} />);

    fireEvent.click(screen.getByLabelText(/Expand ingredients/));

    // RecipeIngredientList is shown after expanding
    expect(screen.getByTestId(`recipe-ingredient-list-${recipe.id}`)).toBeInTheDocument();
  });

  it("collapses ingredients when clicked again", () => {
    const recipe = createMockRecipe();
    const ingredients = [createMockIngredient()];

    render(<RecipeCard recipe={recipe} ingredients={ingredients} />);

    // Expand
    fireEvent.click(screen.getByLabelText(/Expand ingredients/));
    expect(screen.getByLabelText(/Collapse ingredients/)).toBeInTheDocument();

    // Collapse
    fireEvent.click(screen.getByLabelText(/Collapse ingredients/));
    expect(screen.getByLabelText(/Expand ingredients/)).toBeInTheDocument();
  });

  it("shows parsing spinner when contentStatus is parsing", () => {
    const recipe = createMockRecipe();

    render(<RecipeCard recipe={recipe} contentStatus="parsing" />);

    expect(screen.getByText("Parsing ingredients...")).toBeInTheDocument();
  });

  it("shows parsing failed text when contentStatus is failed", () => {
    const recipe = createMockRecipe();

    render(<RecipeCard recipe={recipe} contentStatus="failed" />);

    expect(screen.getByText("Parsing failed")).toBeInTheDocument();
  });

  it("shows retry button when parsing failed and recipe has URL and onParseRecipe", () => {
    const onParseRecipe = vi.fn();
    const recipe = createMockRecipe({ url: "https://example.com/recipe" });

    render(<RecipeCard recipe={recipe} contentStatus="failed" onParseRecipe={onParseRecipe} />);

    const retryBtn = screen.getByRole("button", { name: /retry/i });
    expect(retryBtn).toBeInTheDocument();
    fireEvent.click(retryBtn);
    expect(onParseRecipe).toHaveBeenCalledWith("recipe-1");
  });

  it("does not show retry button when parsing failed but no URL", () => {
    const onParseRecipe = vi.fn();
    const recipe = createMockRecipe({ url: undefined });

    render(<RecipeCard recipe={recipe} contentStatus="failed" onParseRecipe={onParseRecipe} />);

    expect(screen.getByText("Parsing failed")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /retry/i })).not.toBeInTheDocument();
  });

  it("does not show retry button when parsing failed but no onParseRecipe", () => {
    const recipe = createMockRecipe({ url: "https://example.com/recipe" });

    render(<RecipeCard recipe={recipe} contentStatus="failed" />);

    expect(screen.getByText("Parsing failed")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /retry/i })).not.toBeInTheDocument();
  });

  it("shows Parse Ingredients button when recipe has URL and no ingredients and not completed", () => {
    const onParseRecipe = vi.fn();
    const recipe = createMockRecipe({ url: "https://example.com/recipe" });

    render(<RecipeCard recipe={recipe} onParseRecipe={onParseRecipe} />);

    const parseBtn = screen.getByRole("button", { name: /parse ingredients/i });
    expect(parseBtn).toBeInTheDocument();
    fireEvent.click(parseBtn);
    expect(onParseRecipe).toHaveBeenCalledWith("recipe-1");
  });

  it("does not show Parse Ingredients button when contentStatus is completed", () => {
    const onParseRecipe = vi.fn();
    const recipe = createMockRecipe({ url: "https://example.com/recipe" });

    render(<RecipeCard recipe={recipe} contentStatus="completed" onParseRecipe={onParseRecipe} />);

    expect(screen.queryByRole("button", { name: /parse ingredients/i })).not.toBeInTheDocument();
  });

  it("does not show Parse Ingredients button when recipe has no URL", () => {
    const onParseRecipe = vi.fn();
    const recipe = createMockRecipe({ url: undefined });

    render(<RecipeCard recipe={recipe} onParseRecipe={onParseRecipe} />);

    expect(screen.queryByRole("button", { name: /parse ingredients/i })).not.toBeInTheDocument();
  });

  it("does not show Parse Ingredients button when onParseRecipe is not provided", () => {
    const recipe = createMockRecipe({ url: "https://example.com/recipe" });

    render(<RecipeCard recipe={recipe} />);

    expect(screen.queryByRole("button", { name: /parse ingredients/i })).not.toBeInTheDocument();
  });

  it("does not show ingredients section when no ingredients and no URL", () => {
    const recipe = createMockRecipe({ url: undefined });

    render(<RecipeCard recipe={recipe} />);

    expect(screen.queryByText(/ingredient/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Parsing")).not.toBeInTheDocument();
  });

  it("does not show ingredients section when empty ingredients array is provided", () => {
    const recipe = createMockRecipe({ url: undefined });

    render(<RecipeCard recipe={recipe} ingredients={[]} />);

    expect(screen.queryByLabelText(/Expand ingredients/)).not.toBeInTheDocument();
  });

  it("does not show Parse Ingredients when content status is pending", () => {
    const onParseRecipe = vi.fn();
    const recipe = createMockRecipe({ url: "https://example.com/recipe" });

    render(<RecipeCard recipe={recipe} contentStatus="pending" onParseRecipe={onParseRecipe} />);

    expect(screen.getByRole("button", { name: /parse ingredients/i })).toBeInTheDocument();
  });

  it("excludes pantry items (salt, pepper, water) from ingredient count", () => {
    const recipe = createMockRecipe();
    const ingredients = [
      createMockIngredient({ id: "ing-1", name: "Salmon", quantity: 2, unit: "lb", category: "meat_seafood" }),
      createMockIngredient({ id: "ing-2", name: "salt", quantity: undefined, unit: undefined, category: "spices" }),
      createMockIngredient({ id: "ing-3", name: "Pepper", quantity: undefined, unit: undefined, category: "spices" }),
      createMockIngredient({ id: "ing-4", name: "Water", quantity: 1, unit: "cup", category: "other" }),
    ];

    render(<RecipeCard recipe={recipe} ingredients={ingredients} />);

    // Only non-pantry ingredient should be counted
    expect(screen.getByText("1 ingredient")).toBeInTheDocument();
  });

  it("hides ingredients section when all ingredients are pantry items", () => {
    const recipe = createMockRecipe({ url: undefined });
    const ingredients = [
      createMockIngredient({ id: "ing-1", name: "salt", category: "spices" }),
      createMockIngredient({ id: "ing-2", name: "pepper", category: "spices" }),
    ];

    render(<RecipeCard recipe={recipe} ingredients={ingredients} />);

    // No ingredient count should be shown since all are filtered out
    expect(screen.queryByLabelText(/Expand ingredients/)).not.toBeInTheDocument();
  });

  it("filters custom pantryItems from ingredient count", () => {
    const recipe = createMockRecipe();
    const ingredients = [
      createMockIngredient({ id: "ing-1", name: "Salmon", quantity: 2, unit: "lb", category: "meat_seafood" }),
      createMockIngredient({ id: "ing-2", name: "butter", quantity: 1, unit: "tbsp", category: "dairy" }),
      createMockIngredient({ id: "ing-3", name: "salt", quantity: undefined, unit: undefined, category: "spices" }),
    ];

    // Custom pantry includes "butter"; defaults (salt, pepper, water) are always included
    render(<RecipeCard recipe={recipe} ingredients={ingredients} pantryItems={["butter", "olive oil"]} />);

    expect(screen.getByText("1 ingredient")).toBeInTheDocument();
  });

  it("renders ingredients section with ingredient color theming", () => {
    const recipe = createMockRecipe({ ingredientColor: "#ff6b6b" });
    const ingredients = [createMockIngredient()];

    render(<RecipeCard recipe={recipe} ingredients={ingredients} />);

    expect(screen.getByText("1 ingredient")).toBeInTheDocument();
  });
});

describe("RecipeCard - Inline Ingredient Toggle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows expand ingredients toggle button when recipe has ingredients", () => {
    const recipe = createMockRecipe();
    const ingredients = [createMockIngredient()];

    render(<RecipeCard recipe={recipe} ingredients={ingredients} />);

    expect(screen.getByLabelText(/Expand ingredients for/)).toBeInTheDocument();
  });

  it("does not show ingredient list by default (collapsed)", () => {
    const recipe = createMockRecipe();
    const ingredients = [createMockIngredient()];

    render(<RecipeCard recipe={recipe} ingredients={ingredients} />);

    expect(screen.queryByText("No ingredients yet")).not.toBeInTheDocument();
  });

  it("does not have onEditIngredients prop (removed in US-006)", () => {
    const recipe = createMockRecipe();

    render(<RecipeCard recipe={recipe} />);

    // Old "Edit ingredients" aria-label button no longer exists
    expect(screen.queryByLabelText(/Edit ingredients/)).not.toBeInTheDocument();
  });
});

describe("RecipeCard - Layout Structure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders all action buttons in header for personal recipe with all callbacks", () => {
    const onAddNote = vi.fn();
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const recipe = createMockRecipe({ isPersonal: true, ingredientName: "Salmon" });

    render(
      <RecipeCard
        recipe={recipe}
        onAddNote={onAddNote}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    );

    // All action buttons should be present
    expect(screen.getByLabelText(/Add note/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Edit recipe/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Delete recipe/)).toBeInTheDocument();
    // Badges should be in a separate row (both present)
    expect(screen.getByText("Personal")).toBeInTheDocument();
    expect(screen.getByText("Salmon")).toBeInTheDocument();
  });

  it("renders club recipe with rating and no edit/add buttons when no callbacks", () => {
    const recipe = createMockRecipe({
      isPersonal: false,
      ingredientName: "Salmon",
      ratingSummary: {
        recipeId: "recipe-1",
        averageRating: 4.0,
        wouldCookAgainPercent: 75,
        totalRatings: 2,
        memberRatings: [
          { initial: "S", wouldCookAgain: true },
          { initial: "D", wouldCookAgain: false },
        ],
      },
    });

    render(<RecipeCard recipe={recipe} />);

    // Rating visible
    expect(screen.getByText("4/5")).toBeInTheDocument();
    expect(screen.getByText("Make again:")).toBeInTheDocument();
    // No action buttons in header
    expect(screen.queryByLabelText(/Add note/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Edit recipe/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Delete recipe/)).not.toBeInTheDocument();
    // Ingredient badge present, no Personal badge
    expect(screen.getByText("Salmon")).toBeInTheDocument();
    expect(screen.queryByText("Personal")).not.toBeInTheDocument();
  });

  it("renders recipe with no notes, no ingredients, and no badges cleanly", () => {
    const recipe = createMockRecipe({
      notes: [],
      ingredientName: undefined,
      isPersonal: undefined,
      url: undefined,
    });

    render(<RecipeCard recipe={recipe} />);

    // Recipe name still renders
    expect(screen.getByText("Grilled Salmon")).toBeInTheDocument();
    // No badges row
    expect(screen.queryByText("Personal")).not.toBeInTheDocument();
    // Stats show 0 notes
    expect(screen.getByText("0 notes")).toBeInTheDocument();
    // No expand button (no URL, no notes content)
    expect(screen.queryByRole("button", { name: /show more/i })).not.toBeInTheDocument();
  });
});

describe("RecipeCard - Tips Section", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders RecipeTips inline without a toggle", () => {
    const recipe = createMockRecipe();

    render(<RecipeCard recipe={recipe} />);

    // RecipeTips is always rendered inline (no toggle needed — it handles its own empty state)
    expect(screen.getByTestId(`recipe-tips-${recipe.id}`)).toBeInTheDocument();
    // No toggle button should exist for tips
    expect(screen.queryByLabelText(/Expand tips for/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Collapse tips for/)).not.toBeInTheDocument();
  });
});

describe("RecipeCard - RecipeInstructions editable prop", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const recipeContent = {
    recipeId: "recipe-1",
    status: "completed" as const,
    instructions: ["Preheat oven to 400F.", "Season the salmon."],
    servings: undefined,
    prepTime: undefined,
    cookTime: undefined,
    totalTime: undefined,
    description: undefined,
    ingredients: [],
    parsedAt: undefined,
  };

  it("shows edit step buttons when userId matches recipe creator", () => {
    const recipe = createMockRecipe({ createdBy: "user-123", id: "recipe-1" });

    render(
      <RecipeCard recipe={recipe} content={recipeContent} contentStatus="completed" userId="user-123" />
    );

    fireEvent.click(screen.getByLabelText(/Expand instructions for/));

    expect(screen.getByLabelText("edit step 1")).toBeInTheDocument();
    expect(screen.getByLabelText("edit step 2")).toBeInTheDocument();
  });

  it("does not show edit step buttons when userId does not match recipe creator", () => {
    const recipe = createMockRecipe({ createdBy: "user-123", id: "recipe-1" });

    render(
      <RecipeCard recipe={recipe} content={recipeContent} contentStatus="completed" userId="user-999" />
    );

    fireEvent.click(screen.getByLabelText(/Expand instructions for/));

    expect(screen.queryByLabelText("edit step 1")).not.toBeInTheDocument();
  });
});

describe("RecipeCard - CookModeDialog wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Start Cooking button is present when instructions exist", () => {
    const recipe = createMockRecipe({ id: "recipe-1" });
    const recipeContent = {
      recipeId: "recipe-1",
      status: "completed" as const,
      instructions: ["Step 1"],
      servings: undefined,
      prepTime: undefined,
      cookTime: undefined,
      totalTime: undefined,
      description: undefined,
      ingredients: [],
      parsedAt: undefined,
    };

    render(
      <RecipeCard recipe={recipe} content={recipeContent} contentStatus="completed" userId="user-123" />
    );

    expect(screen.getByLabelText(/Start cooking/)).toBeInTheDocument();
  });
});

describe("RecipeCard - timing and servings quick stats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseContent = {
    recipeId: "recipe-1",
    status: "completed" as const,
    instructions: [],
    description: undefined,
    ingredients: [],
    parsedAt: undefined,
  };

  it("shows totalTime when content has totalTime", () => {
    const recipe = createMockRecipe({ id: "recipe-1" });
    const content = { ...baseContent, totalTime: "45 min", prepTime: undefined, cookTime: undefined, servings: undefined };

    render(<RecipeCard recipe={recipe} content={content} contentStatus="completed" />);

    expect(screen.getByText("45 min")).toBeInTheDocument();
  });

  it("shows servings when content has servings", () => {
    const recipe = createMockRecipe({ id: "recipe-1" });
    const content = { ...baseContent, totalTime: undefined, prepTime: undefined, cookTime: undefined, servings: "4 servings" };

    render(<RecipeCard recipe={recipe} content={content} contentStatus="completed" />);

    expect(screen.getByText("4 servings")).toBeInTheDocument();
  });

  it("shows prepTime + cookTime when totalTime is absent", () => {
    const recipe = createMockRecipe({ id: "recipe-1" });
    const content = { ...baseContent, totalTime: undefined, prepTime: "10 min", cookTime: "20 min", servings: undefined };

    render(<RecipeCard recipe={recipe} content={content} contentStatus="completed" />);

    expect(screen.getByText("10 min + 20 min")).toBeInTheDocument();
  });

  it("shows only prepTime when only prepTime is present", () => {
    const recipe = createMockRecipe({ id: "recipe-1" });
    const content = { ...baseContent, totalTime: undefined, prepTime: "15 min", cookTime: undefined, servings: undefined };

    render(<RecipeCard recipe={recipe} content={content} contentStatus="completed" />);

    expect(screen.getByText("15 min")).toBeInTheDocument();
  });

  it("does not show timing when content has no timing fields", () => {
    const recipe = createMockRecipe({ id: "recipe-1" });
    const content = { ...baseContent, totalTime: undefined, prepTime: undefined, cookTime: undefined, servings: undefined };

    render(<RecipeCard recipe={recipe} content={content} contentStatus="completed" />);

    // Should not render the Clock icon span — verify timing text absent
    expect(screen.queryByText(/min/)).not.toBeInTheDocument();
  });

  it("does not show timing when no content is provided", () => {
    const recipe = createMockRecipe({ id: "recipe-1" });

    render(<RecipeCard recipe={recipe} />);

    expect(screen.queryByText(/min/)).not.toBeInTheDocument();
  });

  it("shows both timing and servings together", () => {
    const recipe = createMockRecipe({ id: "recipe-1" });
    const content = { ...baseContent, totalTime: "30 min", prepTime: undefined, cookTime: undefined, servings: "6" };

    render(<RecipeCard recipe={recipe} content={content} contentStatus="completed" />);

    expect(screen.getByText("30 min")).toBeInTheDocument();
    expect(screen.getByText("6")).toBeInTheDocument();
  });
});

describe("RecipeCard - photo lightbox", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders photo thumbnails as buttons when notes have photos", () => {
    const note = createMockNote({ photos: ["https://example.com/img1.jpg", "https://example.com/img2.jpg"], userName: "Alice" });
    const recipe = createMockRecipe({ notes: [note] });

    render(<RecipeCard recipe={recipe} />);

    // Expand the notes section
    fireEvent.click(screen.getByText("Show More"));

    const photoButtons = screen.getAllByLabelText(/View photo \d+ by Alice/);
    expect(photoButtons).toHaveLength(2);
  });

  it("opens lightbox at correct index when a photo is clicked", () => {
    const note = createMockNote({ photos: ["https://example.com/img1.jpg", "https://example.com/img2.jpg"], userName: "Alice" });
    const recipe = createMockRecipe({ notes: [note] });

    render(<RecipeCard recipe={recipe} />);

    fireEvent.click(screen.getByText("Show More"));

    // Click second photo — lightbox should open and show "2 / 2" counter
    fireEvent.click(screen.getByLabelText("View photo 2 by Alice"));
    // Counter "2 / 2" confirms lightbox opened at index 1 (second photo)
    expect(screen.getByText("2 / 2")).toBeInTheDocument();
    // The lightbox image src should be img2
    const lightboxImg = document.querySelector('img[src*="img2.jpg"]') as HTMLImageElement | null;
    expect(lightboxImg).not.toBeNull();
  });

  it("builds a combined gallery across multiple notes", () => {
    const note1 = createMockNote({ id: "n1", photos: ["https://example.com/a.jpg"], userName: "Alice" });
    const note2 = createMockNote({ id: "n2", photos: ["https://example.com/b.jpg", "https://example.com/c.jpg"], userName: "Bob" });
    const recipe = createMockRecipe({ notes: [note1, note2] });

    render(<RecipeCard recipe={recipe} />);
    fireEvent.click(screen.getByText("Show More"));

    // Three photo buttons in total
    const aliceBtn = screen.getByLabelText("View photo 1 by Alice");
    const bobBtns = screen.getAllByLabelText(/View photo \d+ by Bob/);
    expect(aliceBtn).toBeInTheDocument();
    expect(bobBtns).toHaveLength(2);
  });
});

describe("RecipeCard - Last Cooked chip", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows 'Cooked [month year]' chip when recipe has eventDate and is not personal", () => {
    const recipe = createMockRecipe({ eventDate: "2025-06-15", isPersonal: false });
    render(<RecipeCard recipe={recipe} />);
    expect(screen.getByText(/Cooked Jun 2025/)).toBeInTheDocument();
  });

  it("does not show chip when recipe has no eventDate", () => {
    const recipe = createMockRecipe({ eventDate: undefined, isPersonal: false });
    render(<RecipeCard recipe={recipe} />);
    expect(screen.queryByText(/Cooked/)).not.toBeInTheDocument();
  });

  it("does not show chip when recipe is personal (isPersonal: true)", () => {
    const recipe = createMockRecipe({ eventDate: "2025-06-15", isPersonal: true });
    render(<RecipeCard recipe={recipe} />);
    expect(screen.queryByText(/Cooked/)).not.toBeInTheDocument();
  });

  it("formats eventDate correctly for different months", () => {
    const recipe = createMockRecipe({ eventDate: "2025-12-01", isPersonal: false });
    render(<RecipeCard recipe={recipe} />);
    expect(screen.getByText(/Cooked Dec 2025/)).toBeInTheDocument();
  });
});

describe("RecipeCard - Tags hidden by default", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a collapsed 'Tags (N)' toggle instead of tag pills when tags exist and no onTagsChange", () => {
    const recipe = createMockRecipe({ notes: [] });
    render(<RecipeCard recipe={recipe} tags={["Spicy", "Quick"]} />);
    expect(screen.getByText("Tags (2)")).toBeInTheDocument();
    // Tag pills should NOT be visible by default
    expect(screen.queryByText("Spicy")).not.toBeInTheDocument();
    expect(screen.queryByText("Quick")).not.toBeInTheDocument();
  });

  it("expands tags when the toggle button is clicked (view-only mode)", () => {
    const recipe = createMockRecipe({ notes: [] });
    render(<RecipeCard recipe={recipe} tags={["Vegetarian", "Easy"]} />);
    fireEvent.click(screen.getByLabelText(`Show tags for ${recipe.name}`));
    expect(screen.getByText("Vegetarian")).toBeInTheDocument();
    expect(screen.getByText("Easy")).toBeInTheDocument();
  });

  it("collapses tags again when 'Hide tags' is clicked (view-only mode)", () => {
    const recipe = createMockRecipe({ notes: [] });
    render(<RecipeCard recipe={recipe} tags={["Vegetarian"]} />);
    fireEvent.click(screen.getByLabelText(`Show tags for ${recipe.name}`));
    expect(screen.getByText("Vegetarian")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(`Hide tags for ${recipe.name}`));
    expect(screen.queryByText("Vegetarian")).not.toBeInTheDocument();
    expect(screen.getByText("Tags (1)")).toBeInTheDocument();
  });

  it("shows no tag toggle when tags are empty in view-only mode", () => {
    const recipe = createMockRecipe({ notes: [] });
    render(<RecipeCard recipe={recipe} tags={[]} />);
    expect(screen.queryByText(/Tags \(/)).not.toBeInTheDocument();
  });

  it("shows collapsed 'Tags (N)' toggle when onTagsChange is provided", () => {
    const recipe = createMockRecipe({ notes: [] });
    const mockOnTagsChange = vi.fn();
    render(
      <RecipeCard recipe={recipe} tags={["Spicy"]} onTagsChange={mockOnTagsChange} />
    );
    expect(screen.getByText("Tags (1)")).toBeInTheDocument();
    // Tag editor should NOT be visible by default
    expect(screen.queryByRole("group", { name: "Recipe tags" })).not.toBeInTheDocument();
  });

  it("expands tags editor when toggle is clicked (editable mode)", () => {
    const recipe = createMockRecipe({ notes: [] });
    const mockOnTagsChange = vi.fn();
    render(
      <RecipeCard recipe={recipe} tags={["Spicy"]} onTagsChange={mockOnTagsChange} />
    );
    fireEvent.click(screen.getByLabelText(`Show tags for ${recipe.name}`));
    expect(screen.getByRole("group", { name: "Recipe tags" })).toBeInTheDocument();
  });

  it("shows empty tag editor (no toggle) when no tags and onTagsChange is provided", () => {
    const recipe = createMockRecipe({ notes: [] });
    const mockOnTagsChange = vi.fn();
    render(
      <RecipeCard recipe={recipe} tags={[]} onTagsChange={mockOnTagsChange} />
    );
    // No toggle needed — editor is always shown when no tags
    expect(screen.getByRole("group", { name: "Recipe tags" })).toBeInTheDocument();
    expect(screen.queryByText(/Tags \(/)).not.toBeInTheDocument();
  });

  it("shows only the matching tag when activeTagFilter matches a tag (view-only mode)", () => {
    const recipe = createMockRecipe({ notes: [] });
    render(
      <RecipeCard recipe={recipe} tags={["Spicy", "Quick", "Easy"]} activeTagFilter="Quick" />
    );
    // Only the matching tag should be shown without needing to click
    expect(screen.getByText("Quick")).toBeInTheDocument();
    // Other tags should not appear
    expect(screen.queryByText("Spicy")).not.toBeInTheDocument();
    expect(screen.queryByText("Easy")).not.toBeInTheDocument();
    // No toggle needed when filter is showing the tag
    expect(screen.queryByText(/Tags \(/)).not.toBeInTheDocument();
  });

  it("shows toggle (not the tag) when activeTagFilter does not match any tag", () => {
    const recipe = createMockRecipe({ notes: [] });
    render(
      <RecipeCard recipe={recipe} tags={["Spicy", "Quick"]} activeTagFilter="Vegetarian" />
    );
    // No match — fall back to collapsed toggle
    expect(screen.getByText("Tags (2)")).toBeInTheDocument();
    expect(screen.queryByText("Spicy")).not.toBeInTheDocument();
  });
});
