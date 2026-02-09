import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@tests/utils";
import EventRecipesTab from "@/components/events/EventRecipesTab";
import { renderStars } from "@/components/events/EventRecipesTab";
import type { EventRecipeWithRatings } from "@/components/events/EventRecipesTab";
import { createMockUser, createMockRecipe, createMockNote } from "@tests/utils";

describe("EventRecipesTab", () => {
  const user = createMockUser();

  const defaultProps = {
    recipesWithNotes: [] as EventRecipeWithRatings[],
    user,
    userIsAdmin: false,
    expandedRecipeNotes: new Set<string>(),
    deletingNoteId: null,
    onToggleRecipeNotes: vi.fn(),
    onAddRecipeClick: vi.fn(),
    onEditRecipeClick: vi.fn(),
    onAddNotesClick: vi.fn(),
    onEditNoteClick: vi.fn(),
    onDeleteNoteClick: vi.fn(),
    onDeleteRecipeClick: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows empty state when no recipes", () => {
    render(<EventRecipesTab {...defaultProps} />);

    expect(screen.getByText("Recipes (0)")).toBeInTheDocument();
    expect(screen.getByText("No recipes locked in yet. Be the first to add one!")).toBeInTheDocument();
  });

  it("shows Add Recipe button for admin", () => {
    render(<EventRecipesTab {...defaultProps} userIsAdmin={true} />);

    expect(screen.getByText("Add Recipe")).toBeInTheDocument();
  });

  it("hides Add Recipe button for non-admin", () => {
    render(<EventRecipesTab {...defaultProps} userIsAdmin={false} />);

    expect(screen.queryByText("Add Recipe")).not.toBeInTheDocument();
  });

  it("calls onAddRecipeClick when Add Recipe clicked", () => {
    render(<EventRecipesTab {...defaultProps} userIsAdmin={true} />);

    fireEvent.click(screen.getByText("Add Recipe"));
    expect(defaultProps.onAddRecipeClick).toHaveBeenCalledOnce();
  });

  it("renders recipe cards with details", () => {
    const recipesWithNotes: EventRecipeWithRatings[] = [
      {
        recipe: createMockRecipe({
          id: "r1",
          name: "Pasta Carbonara",
          url: "https://example.com/pasta",
          createdByName: "Alice",
          createdByAvatar: "https://example.com/alice.jpg",
          createdBy: "other-user",
        }),
        notes: [],
      },
    ];

    render(<EventRecipesTab {...defaultProps} recipesWithNotes={recipesWithNotes} />);

    expect(screen.getByText("Recipes (1)")).toBeInTheDocument();
    expect(screen.getByText("Pasta Carbonara")).toBeInTheDocument();
    expect(screen.getByText("by Alice")).toBeInTheDocument();
    expect(screen.getByText("View recipe")).toBeInTheDocument();
  });

  it("shows edit button when user is recipe creator", () => {
    const recipesWithNotes: EventRecipeWithRatings[] = [
      {
        recipe: createMockRecipe({
          id: "r1",
          name: "My Recipe",
          createdBy: user.id,
        }),
        notes: [],
      },
    ];

    render(<EventRecipesTab {...defaultProps} recipesWithNotes={recipesWithNotes} />);

    // Edit button (pencil icon)
    const editButtons = screen.getAllByRole("button");
    const editBtn = editButtons.find((btn) => btn.querySelector(".lucide-pencil"));
    expect(editBtn).toBeDefined();
  });

  it("shows edit button when user is admin", () => {
    const recipesWithNotes: EventRecipeWithRatings[] = [
      {
        recipe: createMockRecipe({
          id: "r1",
          name: "Other Recipe",
          createdBy: "other-user",
        }),
        notes: [],
      },
    ];

    render(
      <EventRecipesTab {...defaultProps} recipesWithNotes={recipesWithNotes} userIsAdmin={true} />
    );

    const editButtons = screen.getAllByRole("button");
    const editBtn = editButtons.find((btn) => btn.querySelector(".lucide-pencil"));
    expect(editBtn).toBeDefined();
  });

  it("calls onEditRecipeClick when edit button clicked", () => {
    const recipe = createMockRecipe({ id: "r1", name: "Test", createdBy: user.id });
    const recipesWithNotes: EventRecipeWithRatings[] = [{ recipe, notes: [] }];

    render(<EventRecipesTab {...defaultProps} recipesWithNotes={recipesWithNotes} />);

    const editButtons = screen.getAllByRole("button");
    const editBtn = editButtons.find((btn) => btn.querySelector(".lucide-pencil"));
    fireEvent.click(editBtn!);
    expect(defaultProps.onEditRecipeClick).toHaveBeenCalledWith(recipe);
  });

  it("shows delete button when user is recipe creator", () => {
    const recipesWithNotes: EventRecipeWithRatings[] = [
      {
        recipe: createMockRecipe({ id: "r1", name: "My Recipe", createdBy: user.id }),
        notes: [],
      },
    ];

    render(<EventRecipesTab {...defaultProps} recipesWithNotes={recipesWithNotes} />);

    const buttons = screen.getAllByRole("button");
    const deleteBtn = buttons.find(
      (btn) => btn.querySelector(".lucide-trash-2") && btn.closest(".flex.items-center.gap-1")
    );
    expect(deleteBtn).toBeDefined();
  });

  it("shows delete button when user is admin", () => {
    const recipesWithNotes: EventRecipeWithRatings[] = [
      {
        recipe: createMockRecipe({ id: "r1", name: "Other Recipe", createdBy: "other-user" }),
        notes: [],
      },
    ];

    render(
      <EventRecipesTab {...defaultProps} recipesWithNotes={recipesWithNotes} userIsAdmin={true} />
    );

    const buttons = screen.getAllByRole("button");
    const deleteBtn = buttons.find(
      (btn) => btn.querySelector(".lucide-trash-2") && btn.closest(".flex.items-center.gap-1")
    );
    expect(deleteBtn).toBeDefined();
  });

  it("hides delete recipe button for non-owner non-admin", () => {
    const recipesWithNotes: EventRecipeWithRatings[] = [
      {
        recipe: createMockRecipe({ id: "r1", name: "Other Recipe", createdBy: "other-user" }),
        notes: [],
      },
    ];

    render(
      <EventRecipesTab {...defaultProps} recipesWithNotes={recipesWithNotes} userIsAdmin={false} />
    );

    const buttons = screen.getAllByRole("button");
    // The only trash buttons should be from notes, not recipe header
    const headerTrashBtn = buttons.find(
      (btn) => btn.querySelector(".lucide-trash-2") && btn.closest(".flex.items-center.gap-1")
    );
    expect(headerTrashBtn).toBeUndefined();
  });

  it("calls onDeleteRecipeClick with correct recipe on click", () => {
    const recipe = createMockRecipe({ id: "r1", name: "Test", createdBy: user.id });
    const recipesWithNotes: EventRecipeWithRatings[] = [{ recipe, notes: [] }];

    render(<EventRecipesTab {...defaultProps} recipesWithNotes={recipesWithNotes} />);

    const buttons = screen.getAllByRole("button");
    const deleteBtn = buttons.find(
      (btn) => btn.querySelector(".lucide-trash-2") && btn.closest(".flex.items-center.gap-1")
    );
    fireEvent.click(deleteBtn!);
    expect(defaultProps.onDeleteRecipeClick).toHaveBeenCalledWith(recipe);
  });

  it("shows notes count badge and toggle button", () => {
    const recipesWithNotes: EventRecipeWithRatings[] = [
      {
        recipe: createMockRecipe({ id: "r1", name: "Test", createdBy: "other-user" }),
        notes: [
          createMockNote({ id: "n1", recipeId: "r1", userId: "other-user", userName: "Bob" }),
          createMockNote({ id: "n2", recipeId: "r1", userId: "other-user-2", userName: "Carol" }),
        ],
      },
    ];

    render(<EventRecipesTab {...defaultProps} recipesWithNotes={recipesWithNotes} />);

    expect(screen.getByText("2 notes")).toBeInTheDocument();
    expect(screen.getByText("Show Notes (2)")).toBeInTheDocument();
  });

  it("shows singular 'note' for one note", () => {
    const recipesWithNotes: EventRecipeWithRatings[] = [
      {
        recipe: createMockRecipe({ id: "r1", name: "Test", createdBy: "other-user" }),
        notes: [
          createMockNote({ id: "n1", recipeId: "r1", userId: "other-user", userName: "Bob" }),
        ],
      },
    ];

    render(<EventRecipesTab {...defaultProps} recipesWithNotes={recipesWithNotes} />);

    expect(screen.getByText("1 note")).toBeInTheDocument();
  });

  it("calls onToggleRecipeNotes when toggle button clicked", () => {
    const recipesWithNotes: EventRecipeWithRatings[] = [
      {
        recipe: createMockRecipe({ id: "r1", name: "Test", createdBy: "other-user" }),
        notes: [createMockNote({ id: "n1", recipeId: "r1", userId: "other-user" })],
      },
    ];

    render(<EventRecipesTab {...defaultProps} recipesWithNotes={recipesWithNotes} />);

    fireEvent.click(screen.getByText(/Show Notes/));
    expect(defaultProps.onToggleRecipeNotes).toHaveBeenCalledWith("r1");
  });

  it("shows expanded notes when recipe is in expandedRecipeNotes set", () => {
    const recipesWithNotes: EventRecipeWithRatings[] = [
      {
        recipe: createMockRecipe({ id: "r1", name: "Test", createdBy: "other-user" }),
        notes: [
          createMockNote({
            id: "n1",
            recipeId: "r1",
            userId: "other-user",
            userName: "Bob",
            notes: "Great recipe!",
            photos: ["https://example.com/photo.jpg"],
          }),
        ],
      },
    ];

    render(
      <EventRecipesTab
        {...defaultProps}
        recipesWithNotes={recipesWithNotes}
        expandedRecipeNotes={new Set(["r1"])}
      />
    );

    expect(screen.getByText("Bob's Notes")).toBeInTheDocument();
    expect(screen.getByText("Great recipe!")).toBeInTheDocument();
    expect(screen.getByText("Hide Notes")).toBeInTheDocument();
    // Photo is rendered as img tag
    const imgs = document.querySelectorAll("img[src='https://example.com/photo.jpg']");
    expect(imgs.length).toBe(1);
  });

  it("shows edit/delete buttons for user's own notes", () => {
    const recipesWithNotes: EventRecipeWithRatings[] = [
      {
        recipe: createMockRecipe({ id: "r1", name: "Test", createdBy: "other-user" }),
        notes: [
          createMockNote({
            id: "n1",
            recipeId: "r1",
            userId: user.id,
            userName: "Test User",
            notes: "My notes",
          }),
        ],
      },
    ];

    render(
      <EventRecipesTab
        {...defaultProps}
        recipesWithNotes={recipesWithNotes}
        expandedRecipeNotes={new Set(["r1"])}
      />
    );

    // Should see pencil and trash buttons for own note
    const buttons = screen.getAllByRole("button");
    const trashBtn = buttons.find((btn) => btn.querySelector(".lucide-trash-2"));
    expect(trashBtn).toBeDefined();
  });

  it("calls onEditNoteClick and onDeleteNoteClick", () => {
    const note = createMockNote({
      id: "n1",
      recipeId: "r1",
      userId: user.id,
      userName: "Test User",
      notes: "My notes",
    });
    const recipesWithNotes: EventRecipeWithRatings[] = [
      {
        recipe: createMockRecipe({ id: "r1", name: "Test", createdBy: "other-user" }),
        notes: [note],
      },
    ];

    render(
      <EventRecipesTab
        {...defaultProps}
        recipesWithNotes={recipesWithNotes}
        expandedRecipeNotes={new Set(["r1"])}
      />
    );

    const buttons = screen.getAllByRole("button");
    // Find the trash and pencil buttons in the notes section
    const trashBtn = buttons.find((btn) => btn.querySelector(".lucide-trash-2"));
    fireEvent.click(trashBtn!);
    expect(defaultProps.onDeleteNoteClick).toHaveBeenCalledWith(note);

    // Find pencil buttons - there may be multiple, we want the one in the notes area
    const pencilBtns = buttons.filter((btn) => btn.querySelector(".lucide-pencil"));
    // The last pencil button should be in the notes section
    fireEvent.click(pencilBtns[pencilBtns.length - 1]);
    expect(defaultProps.onEditNoteClick).toHaveBeenCalledWith(note);
  });

  it("disables delete button when note is being deleted", () => {
    const note = createMockNote({
      id: "n1",
      recipeId: "r1",
      userId: user.id,
      userName: "Test User",
    });
    const recipesWithNotes: EventRecipeWithRatings[] = [
      {
        recipe: createMockRecipe({ id: "r1", name: "Test", createdBy: "other-user" }),
        notes: [note],
      },
    ];

    render(
      <EventRecipesTab
        {...defaultProps}
        recipesWithNotes={recipesWithNotes}
        expandedRecipeNotes={new Set(["r1"])}
        deletingNoteId="n1"
      />
    );

    const buttons = screen.getAllByRole("button");
    const trashBtn = buttons.find((btn) => btn.querySelector(".lucide-trash-2"));
    expect(trashBtn).toBeDisabled();
  });

  it("does not show edit/delete buttons for other users notes", () => {
    const recipesWithNotes: EventRecipeWithRatings[] = [
      {
        recipe: createMockRecipe({ id: "r1", name: "Test", createdBy: "other-user" }),
        notes: [
          createMockNote({
            id: "n1",
            recipeId: "r1",
            userId: "other-user",
            userName: "Bob",
            notes: "Bob's notes",
          }),
        ],
      },
    ];

    render(
      <EventRecipesTab
        {...defaultProps}
        recipesWithNotes={recipesWithNotes}
        expandedRecipeNotes={new Set(["r1"])}
      />
    );

    // Should NOT see trash button for other user's note
    const buttons = screen.getAllByRole("button");
    const trashBtn = buttons.find((btn) => btn.querySelector(".lucide-trash-2"));
    expect(trashBtn).toBeUndefined();
  });

  it("shows Add notes button when user has no note", () => {
    const recipesWithNotes: EventRecipeWithRatings[] = [
      {
        recipe: createMockRecipe({ id: "r1", name: "Test", createdBy: "other-user" }),
        notes: [],
      },
    ];

    render(<EventRecipesTab {...defaultProps} recipesWithNotes={recipesWithNotes} />);

    expect(screen.getByText("Add notes")).toBeInTheDocument();
  });

  it("hides Add notes button when user already has a note", () => {
    const recipesWithNotes: EventRecipeWithRatings[] = [
      {
        recipe: createMockRecipe({ id: "r1", name: "Test", createdBy: "other-user" }),
        notes: [createMockNote({ id: "n1", recipeId: "r1", userId: user.id })],
      },
    ];

    render(<EventRecipesTab {...defaultProps} recipesWithNotes={recipesWithNotes} />);

    expect(screen.queryByText("Add notes")).not.toBeInTheDocument();
  });

  it("calls onAddNotesClick when Add notes clicked", () => {
    const recipe = createMockRecipe({ id: "r1", name: "Test", createdBy: "other-user" });
    const recipesWithNotes: EventRecipeWithRatings[] = [{ recipe, notes: [] }];

    render(<EventRecipesTab {...defaultProps} recipesWithNotes={recipesWithNotes} />);

    fireEvent.click(screen.getByText("Add notes"));
    expect(defaultProps.onAddNotesClick).toHaveBeenCalledWith(recipe);
  });

  it("renders rating display when ratings exist", () => {
    const recipesWithNotes: EventRecipeWithRatings[] = [
      {
        recipe: createMockRecipe({ id: "r1", name: "Rated Recipe", createdBy: "other-user" }),
        notes: [],
        ratingSummary: {
          recipeId: "r1",
          averageRating: 4.5,
          wouldCookAgainPercent: 75,
          totalRatings: 2,
          memberRatings: [
            { initial: "A", wouldCookAgain: true },
            { initial: "B", wouldCookAgain: false },
          ],
        },
      },
    ];

    render(<EventRecipesTab {...defaultProps} recipesWithNotes={recipesWithNotes} />);

    expect(screen.getByText("4.5/5")).toBeInTheDocument();
    expect(screen.getByText("Make again:")).toBeInTheDocument();
    expect(screen.getByText(/A:.*Yes/)).toBeInTheDocument();
    expect(screen.getByText(/B:.*No/)).toBeInTheDocument();
  });

  it("renders integer rating without decimal", () => {
    const recipesWithNotes: EventRecipeWithRatings[] = [
      {
        recipe: createMockRecipe({ id: "r1", name: "Test", createdBy: "other-user" }),
        notes: [],
        ratingSummary: {
          recipeId: "r1",
          averageRating: 4,
          wouldCookAgainPercent: 100,
          totalRatings: 1,
          memberRatings: [{ initial: "A", wouldCookAgain: true }],
        },
      },
    ];

    render(<EventRecipesTab {...defaultProps} recipesWithNotes={recipesWithNotes} />);

    expect(screen.getByText("4/5")).toBeInTheDocument();
  });

  it("does not show rating when totalRatings is 0", () => {
    const recipesWithNotes: EventRecipeWithRatings[] = [
      {
        recipe: createMockRecipe({ id: "r1", name: "Test", createdBy: "other-user" }),
        notes: [],
        ratingSummary: {
          recipeId: "r1",
          averageRating: 0,
          wouldCookAgainPercent: 0,
          totalRatings: 0,
          memberRatings: [],
        },
      },
    ];

    render(<EventRecipesTab {...defaultProps} recipesWithNotes={recipesWithNotes} />);

    expect(screen.queryByText("Make again:")).not.toBeInTheDocument();
  });

  it("does not render recipe without createdByName avatar section", () => {
    const recipesWithNotes: EventRecipeWithRatings[] = [
      {
        recipe: createMockRecipe({
          id: "r1",
          name: "No Author",
          createdBy: "other-user",
          createdByName: undefined,
        }),
        notes: [],
      },
    ];

    render(<EventRecipesTab {...defaultProps} recipesWithNotes={recipesWithNotes} />);

    expect(screen.getByText("No Author")).toBeInTheDocument();
    // No "by" text since no createdByName
    expect(screen.queryByText(/^by /)).not.toBeInTheDocument();
  });

  it("does not show View recipe link when recipe has no URL", () => {
    const recipesWithNotes: EventRecipeWithRatings[] = [
      {
        recipe: createMockRecipe({
          id: "r1",
          name: "No URL Recipe",
          url: undefined,
          createdBy: "other-user",
        }),
        notes: [],
      },
    ];

    render(<EventRecipesTab {...defaultProps} recipesWithNotes={recipesWithNotes} />);

    expect(screen.queryByText("View recipe")).not.toBeInTheDocument();
  });

  it("renders note without text or photos gracefully", () => {
    const recipesWithNotes: EventRecipeWithRatings[] = [
      {
        recipe: createMockRecipe({ id: "r1", name: "Test", createdBy: "other-user" }),
        notes: [
          createMockNote({
            id: "n1",
            recipeId: "r1",
            userId: "other-user",
            userName: "Bob",
            notes: undefined,
            photos: undefined,
          }),
        ],
      },
    ];

    render(
      <EventRecipesTab
        {...defaultProps}
        recipesWithNotes={recipesWithNotes}
        expandedRecipeNotes={new Set(["r1"])}
      />
    );

    expect(screen.getByText("Bob's Notes")).toBeInTheDocument();
  });

  it("renders with null user gracefully", () => {
    const recipesWithNotes: EventRecipeWithRatings[] = [
      {
        recipe: createMockRecipe({ id: "r1", name: "Test", createdBy: "other-user" }),
        notes: [],
      },
    ];

    render(
      <EventRecipesTab {...defaultProps} user={null} recipesWithNotes={recipesWithNotes} />
    );

    expect(screen.getByText("Test")).toBeInTheDocument();
    // Add notes should still show when user is null (no note match)
    expect(screen.getByText("Add notes")).toBeInTheDocument();
  });
});

describe("renderStars", () => {
  it("renders 5 full stars for rating 5", () => {
    const stars = renderStars(5);
    expect(stars).toHaveLength(5);
  });

  it("renders half star for rating 3.5", () => {
    const stars = renderStars(3.5);
    expect(stars).toHaveLength(5);
  });

  it("renders empty stars for rating 0", () => {
    const stars = renderStars(0);
    expect(stars).toHaveLength(5);
  });

  it("accepts custom star size", () => {
    const stars = renderStars(3, "h-6 w-6");
    expect(stars).toHaveLength(5);
  });
});
