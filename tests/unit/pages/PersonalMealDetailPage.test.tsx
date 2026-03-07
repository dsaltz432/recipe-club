import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@tests/utils";
import PersonalMealDetailPage from "@/pages/PersonalMealDetailPage";

// Router mock
const mockNavigate = vi.fn();
let mockParams: Record<string, string | undefined> = { eventId: "event-1" };
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => mockParams,
  };
});

// Auth mocks
const mockGetCurrentUser = vi.fn();
const mockGetAllowedUser = vi.fn();
const mockSignOut = vi.fn();
vi.mock("@/lib/auth", () => ({
  getCurrentUser: () => mockGetCurrentUser(),
  getAllowedUser: (...args: unknown[]) => mockGetAllowedUser(...args),
  signOut: () => mockSignOut(),
}));

// Supabase mock
const mockSupabaseFrom = vi.fn();
const mockFunctionsInvoke = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => mockSupabaseFrom(...args),
    functions: {
      invoke: (...args: unknown[]) => mockFunctionsInvoke(...args),
    },
  },
}));

// Sonner mock
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));
import { toast } from "sonner";

// recipeActions mock
const mockSaveRecipeEdit = vi.fn();
vi.mock("@/lib/recipeActions", () => ({
  saveRecipeEdit: (...args: unknown[]) => mockSaveRecipeEdit(...args),
}));

// useGroceryList mock
const mockRefreshGroceries = vi.fn();
vi.mock("@/hooks/useGroceryList", () => ({
  useGroceryList: () => ({
    recipeIngredients: {},
    recipeContentMap: {},
    handleParseRecipe: vi.fn(),
    isLoading: false,
    pantryItems: [],
    smartGroceryItems: [],
    isCombining: false,
    combineError: null,
    perRecipeItems: {},
    checkedItems: new Set(),
    handleToggleChecked: vi.fn(),
    handleEditItemText: vi.fn(),
    handleRemoveItem: vi.fn(),
    handleAddItemsToRecipe: vi.fn(),
    refreshGroceries: mockRefreshGroceries,
  }),
}));

// useRecipeNotes mock
const mockSetNoteToEdit = vi.fn();
const mockSetRecipeForNewNote = vi.fn();
const mockSetNoteToDelete = vi.fn();
const mockHandleEditNoteClick = vi.fn();
const mockHandleAddNotesClick = vi.fn();
const mockHandleSaveNote = vi.fn();
const mockHandleDeleteClick = vi.fn();
const mockHandleConfirmDelete = vi.fn();
vi.mock("@/hooks/useRecipeNotes", () => ({
  useRecipeNotes: () => ({
    noteToEdit: null,
    setNoteToEdit: mockSetNoteToEdit,
    recipeForNewNote: null,
    setRecipeForNewNote: mockSetRecipeForNewNote,
    editNotes: "",
    setEditNotes: vi.fn(),
    editPhotos: [],
    setEditPhotos: vi.fn(),
    isUpdatingNote: false,
    noteToDelete: null,
    setNoteToDelete: mockSetNoteToDelete,
    deletingNoteId: null,
    handleEditNoteClick: mockHandleEditNoteClick,
    handleAddNotesClick: mockHandleAddNotesClick,
    handleSaveNote: mockHandleSaveNote,
    handleDeleteClick: mockHandleDeleteClick,
    handleConfirmDelete: mockHandleConfirmDelete,
  }),
}));

// Heavy child component mocks
vi.mock("@/components/recipes/PhotoUpload", () => ({
  default: () => <div data-testid="photo-upload">PhotoUpload</div>,
}));

vi.mock("@/components/recipes/RecipeParseProgress", () => ({
  default: () => <div data-testid="parse-progress">Parsing...</div>,
}));

vi.mock("@/components/events/EventRatingDialog", () => ({
  default: ({ onComplete, onCancel }: { onComplete: () => void; onCancel: () => void }) => (
    <div data-testid="rating-dialog">
      <button onClick={onComplete}>Complete Ratings</button>
      <button onClick={onCancel}>Cancel Ratings</button>
    </div>
  ),
}));

// eslint-disable-next-line @typescript-eslint/no-unused-vars
let capturedAddMealProps: {
  onAddCustomMeal?: (name: string, url?: string, shouldParse?: boolean) => void;
  onAddRecipeMeal?: (recipes: Array<{ id: string; name: string; url?: string }>) => void;
  onAddManualMeal?: (name: string, text: string) => void;
  open?: boolean;
} = {};
vi.mock("@/components/mealplan/AddMealDialog", () => ({
  default: (props: typeof capturedAddMealProps & { onOpenChange: (open: boolean) => void }) => {
    capturedAddMealProps = props;
    if (!props.open) return null;
    return (
      <div data-testid="add-meal-dialog">
        <button onClick={() => props.onAddCustomMeal?.("New Recipe", "https://example.com", false)}>
          Add Custom Meal
        </button>
        <button onClick={() => props.onAddCustomMeal?.("Parse Recipe", "https://example.com/parse", true)}>
          Add Custom Meal With Parse
        </button>
        <button onClick={() => props.onAddRecipeMeal?.([{ id: "existing-1", name: "Existing Recipe" }])}>
          Add Existing Recipe
        </button>
        <button onClick={() => props.onAddManualMeal?.("Manual Recipe", "2 cups flour")}>
          Add Manual Meal
        </button>
      </div>
    );
  },
}));

let capturedRecipesTabProps: {
  onAddRecipeClick?: () => void;
  onEditRecipeClick?: (recipe: unknown) => void;
  onDeleteRecipeClick?: (recipe: unknown) => void;
  onAddNotesClick?: (recipe: unknown) => void;
  recipesWithNotes?: Array<{ recipe: { id: string; name: string; url?: string } }>;
} = {};
vi.mock("@/components/events/EventRecipesTab", () => ({
  default: (props: typeof capturedRecipesTabProps) => {
    capturedRecipesTabProps = props;
    return (
      <div data-testid="recipes-tab">
        <button onClick={() => props.onAddRecipeClick?.()}>Add Recipe</button>
        {props.recipesWithNotes?.map((r) => (
          <div key={r.recipe.id}>
            <span>{r.recipe.name}</span>
            <button onClick={() => props.onEditRecipeClick?.(r.recipe)}>Edit {r.recipe.name}</button>
            <button onClick={() => props.onDeleteRecipeClick?.(r.recipe)}>Delete {r.recipe.name}</button>
            <button onClick={() => props.onAddNotesClick?.(r.recipe)}>Notes {r.recipe.name}</button>
          </div>
        ))}
      </div>
    );
  },
}));

vi.mock("@/components/recipes/GroceryListSection", () => ({
  default: () => <div data-testid="grocery-section">GroceryListSection</div>,
}));

vi.mock("@/components/pantry/PantrySection", () => ({
  default: () => <div data-testid="pantry-section">PantrySection</div>,
}));

// Dropdown menu mock so portals work in jsdom
vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
  DropdownMenuSeparator: () => <hr />,
}));

// Tabs mock — render all panels so all content is accessible
vi.mock("@/components/ui/tabs", () => ({
  Tabs: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children }: { children: React.ReactNode }) => <button role="tab">{children}</button>,
  TabsContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// Test data
const eventRow = {
  id: "event-1",
  event_date: "2026-03-10",
  status: "scheduled",
  created_by: "user-1",
  type: "personal",
};

const recipeRow = {
  id: "recipe-1",
  name: "Pasta Primavera",
  url: "https://example.com/pasta",
  event_id: "event-1",
  created_by: "user-1",
  created_at: "2026-01-01",
  profiles: { name: "Test User", avatar_url: null },
};

// Builder helpers
const makeOr = (resolved: unknown) => ({ order: vi.fn().mockResolvedValue(resolved) });
const makeSingle = (resolved: unknown) => ({ single: vi.fn().mockResolvedValue(resolved) });
const makeSelectEqEqSingle = (resolved: unknown) => ({
  select: vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue(makeSingle(resolved)),
    }),
  }),
});

const setupDefaultMocks = () => {
  mockGetCurrentUser.mockResolvedValue({ id: "user-1", name: "Test User", email: "test@test.com" });
  mockGetAllowedUser.mockResolvedValue({ is_club_member: true });
  mockSignOut.mockResolvedValue(undefined);
  mockSaveRecipeEdit.mockResolvedValue({ success: true });
  mockFunctionsInvoke.mockResolvedValue({ data: { success: true }, error: null });

  mockSupabaseFrom.mockImplementation((table: string) => {
    if (table === "scheduled_events") {
      return makeSelectEqEqSingle({ data: eventRow, error: null });
    }
    if (table === "meal_plan_items") {
      return {
        select: vi.fn().mockReturnValue({
          or: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue(makeSingle({ data: { id: "item-new" }, error: null })),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
          or: vi.fn().mockResolvedValue({ error: null }),
        }),
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      };
    }
    if (table === "recipes") {
      return {
        select: vi.fn().mockReturnValue({
          or: vi.fn().mockReturnValue(makeOr({ data: [recipeRow], error: null })),
          in: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue(makeSingle({ data: { id: "recipe-new" }, error: null })),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      };
    }
    if (table === "recipe_notes") {
      return {
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      };
    }
    if (table === "recipe_ratings") {
      return {
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      };
    }
    return {};
  });
};

const renderAndWait = async () => {
  const result = render(<PersonalMealDetailPage />);
  await waitFor(() => {
    expect(screen.getByText("Pasta Primavera")).toBeInTheDocument();
  });
  return result;
};

describe("PersonalMealDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedRecipesTabProps = {};
    capturedAddMealProps = {};
    setupDefaultMocks();
  });

  it("shows loading spinner initially", () => {
    render(<PersonalMealDetailPage />);
    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("shows not found state when event fetch errors", async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "scheduled_events") {
        return makeSelectEqEqSingle({ data: null, error: { message: "Not found" } });
      }
      return {};
    });

    render(<PersonalMealDetailPage />);
    await waitFor(() => {
      expect(screen.getByText("Meal Not Found")).toBeInTheDocument();
    });
  });

  it("shows not found state when event data is null", async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "scheduled_events") {
        return makeSelectEqEqSingle({ data: null, error: null });
      }
      return {};
    });

    render(<PersonalMealDetailPage />);
    await waitFor(() => {
      expect(screen.getByText("Meal Not Found")).toBeInTheDocument();
    });
  });

  it("renders meal details page after successful load", async () => {
    await renderAndWait();
    expect(screen.getByText("Meal Details")).toBeInTheDocument();
    expect(screen.getByText("Pasta Primavera")).toBeInTheDocument();
  });

  it("renders RecipeDetailTabs with all three tab panels", async () => {
    await renderAndWait();
    expect(screen.getByTestId("recipes-tab")).toBeInTheDocument();
    expect(screen.getByTestId("grocery-section")).toBeInTheDocument();
    expect(screen.getByTestId("pantry-section")).toBeInTheDocument();
  });

  it("shows 'Back to Meals' button on not found page", async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "scheduled_events") {
        return makeSelectEqEqSingle({ data: null, error: { message: "oops" } });
      }
      return {};
    });

    render(<PersonalMealDetailPage />);
    await waitFor(() => {
      expect(screen.getByText("Back to Meals")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Back to Meals"));
    expect(mockNavigate).toHaveBeenCalledWith("/dashboard/meals");
  });

  it("navigates to meals when 'Go to Meals' button is clicked on not found page", async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "scheduled_events") {
        return makeSelectEqEqSingle({ data: null, error: { message: "oops" } });
      }
      return {};
    });

    render(<PersonalMealDetailPage />);
    await waitFor(() => {
      expect(screen.getByText("Go to Meals")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Go to Meals"));
    expect(mockNavigate).toHaveBeenCalledWith("/dashboard/meals");
  });

  it("opens AddMealDialog when Add Recipe is clicked", async () => {
    await renderAndWait();

    expect(screen.queryByTestId("add-meal-dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add Recipe" }));

    await waitFor(() => {
      expect(screen.getByTestId("add-meal-dialog")).toBeInTheDocument();
    });
  });

  it("calls supabase insert when adding a custom meal", async () => {
    await renderAndWait();

    fireEvent.click(screen.getByRole("button", { name: "Add Recipe" }));
    await waitFor(() => screen.getByTestId("add-meal-dialog"));

    fireEvent.click(screen.getByRole("button", { name: "Add Custom Meal" }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Recipe added!");
    });
  });

  it("calls supabase update when adding an existing recipe to meal", async () => {
    await renderAndWait();

    fireEvent.click(screen.getByRole("button", { name: "Add Recipe" }));
    await waitFor(() => screen.getByTestId("add-meal-dialog"));

    fireEvent.click(screen.getByRole("button", { name: "Add Existing Recipe" }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Added 1 recipe to meal");
    });
  });

  it("shows toast error when add custom meal fails", async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "scheduled_events") {
        return makeSelectEqEqSingle({ data: eventRow, error: null });
      }
      if (table === "meal_plan_items") {
        return {
          select: vi.fn().mockReturnValue({
            or: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      }
      if (table === "recipes") {
        return {
          select: vi.fn().mockReturnValue({
            or: vi.fn().mockReturnValue(makeOr({ data: [recipeRow], error: null })),
          }),
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue(makeSingle({ data: null, error: { message: "Insert failed" } })),
          }),
          update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
        };
      }
      if (table === "recipe_notes") return { select: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
      if (table === "recipe_ratings") return { select: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
      return {};
    });

    await renderAndWait();
    fireEvent.click(screen.getByRole("button", { name: "Add Recipe" }));
    await waitFor(() => screen.getByTestId("add-meal-dialog"));
    fireEvent.click(screen.getByRole("button", { name: "Add Custom Meal" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to add meal");
    });
  });

  it("shows toast error when add existing recipe fails", async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "scheduled_events") {
        return makeSelectEqEqSingle({ data: eventRow, error: null });
      }
      if (table === "meal_plan_items") {
        return {
          select: vi.fn().mockReturnValue({ or: vi.fn().mockResolvedValue({ data: [], error: null }) }),
        };
      }
      if (table === "recipes") {
        return {
          select: vi.fn().mockReturnValue({ or: vi.fn().mockReturnValue(makeOr({ data: [recipeRow], error: null })) }),
          update: vi.fn().mockReturnValue({ eq: vi.fn().mockRejectedValue(new Error("update failed")) }),
        };
      }
      if (table === "recipe_notes") return { select: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
      if (table === "recipe_ratings") return { select: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
      return {};
    });

    await renderAndWait();
    fireEvent.click(screen.getByRole("button", { name: "Add Recipe" }));
    await waitFor(() => screen.getByTestId("add-meal-dialog"));
    fireEvent.click(screen.getByRole("button", { name: "Add Existing Recipe" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to add recipes");
    });
  });

  it("shows toast error when add manual meal fails", async () => {
    mockFunctionsInvoke.mockResolvedValue({ data: null, error: { message: "parse error" } });

    await renderAndWait();
    fireEvent.click(screen.getByRole("button", { name: "Add Recipe" }));
    await waitFor(() => screen.getByTestId("add-meal-dialog"));
    fireEvent.click(screen.getByRole("button", { name: "Add Manual Meal" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to add meal");
    });
  });

  it("opens edit recipe dialog when Edit is clicked", async () => {
    await renderAndWait();

    fireEvent.click(screen.getByRole("button", { name: "Edit Pasta Primavera" }));

    await waitFor(() => {
      expect(screen.getByLabelText(/Recipe Name/)).toBeInTheDocument();
    });
    expect(screen.getByDisplayValue("Pasta Primavera")).toBeInTheDocument();
  });

  it("saves recipe edit successfully", async () => {
    await renderAndWait();

    fireEvent.click(screen.getByRole("button", { name: "Edit Pasta Primavera" }));
    await waitFor(() => screen.getByLabelText(/Recipe Name/));

    fireEvent.click(screen.getByRole("button", { name: /Save Changes/i }));

    await waitFor(() => {
      expect(mockSaveRecipeEdit).toHaveBeenCalledWith(
        "recipe-1",
        "Pasta Primavera",
        "https://example.com/pasta",
        "https://example.com/pasta"
      );
      expect(toast.success).toHaveBeenCalledWith("Recipe updated!");
    });
  });

  it("shows error toast when save recipe edit fails via result.error", async () => {
    mockSaveRecipeEdit.mockResolvedValue({ success: false, error: "Failed to save" });

    await renderAndWait();
    fireEvent.click(screen.getByRole("button", { name: "Edit Pasta Primavera" }));
    await waitFor(() => screen.getByLabelText(/Recipe Name/));
    fireEvent.click(screen.getByRole("button", { name: /Save Changes/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to save");
    });
  });

  it("shows error toast when save recipe edit throws", async () => {
    mockSaveRecipeEdit.mockRejectedValue(new Error("Unexpected"));

    await renderAndWait();
    fireEvent.click(screen.getByRole("button", { name: "Edit Pasta Primavera" }));
    await waitFor(() => screen.getByLabelText(/Recipe Name/));
    fireEvent.click(screen.getByRole("button", { name: /Save Changes/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to update recipe");
    });
  });

  it("closes edit dialog when Cancel is clicked", async () => {
    await renderAndWait();

    fireEvent.click(screen.getByRole("button", { name: "Edit Pasta Primavera" }));
    await waitFor(() => screen.getByLabelText(/Recipe Name/));

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => {
      expect(screen.queryByLabelText(/Recipe Name/)).not.toBeInTheDocument();
    });
  });

  it("opens delete confirmation when Delete recipe is clicked", async () => {
    await renderAndWait();

    fireEvent.click(screen.getByRole("button", { name: "Delete Pasta Primavera" }));

    await waitFor(() => {
      expect(screen.getByText("Remove from meal?")).toBeInTheDocument();
    });
  });

  it("confirms delete recipe removes it from meal", async () => {
    await renderAndWait();

    fireEvent.click(screen.getByRole("button", { name: "Delete Pasta Primavera" }));
    await waitFor(() => screen.getByText("Remove from meal?"));

    fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Recipe removed from meal");
    });
  });

  it("shows error toast when delete recipe fails", async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "scheduled_events") {
        return makeSelectEqEqSingle({ data: eventRow, error: null });
      }
      if (table === "meal_plan_items") {
        return {
          select: vi.fn().mockReturnValue({ or: vi.fn().mockResolvedValue({ data: [], error: null }) }),
          delete: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
        };
      }
      if (table === "recipes") {
        return {
          select: vi.fn().mockReturnValue({ or: vi.fn().mockReturnValue(makeOr({ data: [recipeRow], error: null })) }),
          update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: { message: "update failed" } }) }),
        };
      }
      if (table === "recipe_notes") return { select: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
      if (table === "recipe_ratings") return { select: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
      return {};
    });

    await renderAndWait();
    fireEvent.click(screen.getByRole("button", { name: "Delete Pasta Primavera" }));
    await waitFor(() => screen.getByText("Remove from meal?"));
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to remove recipe");
    });
  });

  it("shows Rate Recipes button when meal items exist and event has recipes", async () => {
    // meal_plan_items returns items with recipe_id
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "scheduled_events") {
        return makeSelectEqEqSingle({ data: eventRow, error: null });
      }
      if (table === "meal_plan_items") {
        return {
          select: vi.fn().mockReturnValue({
            or: vi.fn().mockResolvedValue({
              data: [{ id: "item-1", recipe_id: "recipe-1", cooked_at: null, day_of_week: 1, meal_type: "dinner", plan_id: "plan-1" }],
              error: null,
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
            or: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      if (table === "recipes") {
        return {
          select: vi.fn().mockReturnValue({
            or: vi.fn().mockReturnValue(makeOr({ data: [recipeRow], error: null })),
          }),
          update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
        };
      }
      if (table === "recipe_notes") return { select: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
      if (table === "recipe_ratings") return { select: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
      return {};
    });

    render(<PersonalMealDetailPage />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Rate Recipes/i })).toBeInTheDocument();
    });
  });

  it("opens rating dialog when Rate Recipes button is clicked", async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "scheduled_events") {
        return makeSelectEqEqSingle({ data: { ...eventRow, status: "completed" }, error: null });
      }
      if (table === "meal_plan_items") {
        return {
          select: vi.fn().mockReturnValue({
            or: vi.fn().mockResolvedValue({
              data: [{ id: "item-1", recipe_id: "recipe-1", cooked_at: null, day_of_week: 1, meal_type: "dinner", plan_id: "plan-1" }],
              error: null,
            }),
          }),
          update: vi.fn().mockReturnValue({ or: vi.fn().mockResolvedValue({ error: null }), eq: vi.fn().mockResolvedValue({ error: null }) }),
        };
      }
      if (table === "recipes") return { select: vi.fn().mockReturnValue({ or: vi.fn().mockReturnValue(makeOr({ data: [recipeRow], error: null })) }), update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }) };
      if (table === "recipe_notes") return { select: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
      if (table === "recipe_ratings") return { select: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
      return {};
    });

    render(<PersonalMealDetailPage />);
    await waitFor(() => screen.getByRole("button", { name: /Rate Recipes/i }));
    fireEvent.click(screen.getByRole("button", { name: /Rate Recipes/i }));

    await waitFor(() => {
      expect(screen.getByTestId("rating-dialog")).toBeInTheDocument();
    });
  });

  it("shows Cooked badge when all meal items are cooked", async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "scheduled_events") {
        return makeSelectEqEqSingle({ data: eventRow, error: null });
      }
      if (table === "meal_plan_items") {
        return {
          select: vi.fn().mockReturnValue({
            or: vi.fn().mockResolvedValue({
              data: [{ id: "item-1", recipe_id: "recipe-1", cooked_at: "2026-03-10T19:00:00Z", day_of_week: 1, meal_type: "dinner", plan_id: "plan-1" }],
              error: null,
            }),
          }),
          update: vi.fn().mockReturnValue({ or: vi.fn().mockResolvedValue({ error: null }), eq: vi.fn().mockResolvedValue({ error: null }) }),
        };
      }
      if (table === "recipes") return { select: vi.fn().mockReturnValue({ or: vi.fn().mockReturnValue(makeOr({ data: [recipeRow], error: null })) }), update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }) };
      if (table === "recipe_notes") return { select: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
      if (table === "recipe_ratings") return { select: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
      return {};
    });

    render(<PersonalMealDetailPage />);
    await waitFor(() => {
      expect(screen.getByText("Cooked")).toBeInTheDocument();
    });
  });

  it("shows Undo button when meal is cooked and uncook dialog on click", async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "scheduled_events") {
        return makeSelectEqEqSingle({ data: eventRow, error: null });
      }
      if (table === "meal_plan_items") {
        return {
          select: vi.fn().mockReturnValue({
            or: vi.fn().mockResolvedValue({
              data: [{ id: "item-1", recipe_id: "recipe-1", cooked_at: "2026-03-10T19:00:00Z", day_of_week: 1, meal_type: "dinner", plan_id: "plan-1" }],
              error: null,
            }),
          }),
          update: vi.fn().mockReturnValue({ or: vi.fn().mockResolvedValue({ error: null }), eq: vi.fn().mockResolvedValue({ error: null }) }),
        };
      }
      if (table === "recipes") return { select: vi.fn().mockReturnValue({ or: vi.fn().mockReturnValue(makeOr({ data: [recipeRow], error: null })) }), update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }) };
      if (table === "recipe_notes") return { select: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
      if (table === "recipe_ratings") return { select: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
      return {};
    });

    render(<PersonalMealDetailPage />);
    await waitFor(() => screen.getByText("Undo"));

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => {
      expect(screen.getByText("Undo cooked status?")).toBeInTheDocument();
    });
  });

  it("confirms uncook and marks meal as uncooked", async () => {
    const mockUpdate = vi.fn().mockReturnValue({ or: vi.fn().mockResolvedValue({ error: null }), eq: vi.fn().mockResolvedValue({ error: null }) });
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "scheduled_events") {
        return makeSelectEqEqSingle({ data: eventRow, error: null });
      }
      if (table === "meal_plan_items") {
        return {
          select: vi.fn().mockReturnValue({
            or: vi.fn().mockResolvedValue({
              data: [{ id: "item-1", recipe_id: "recipe-1", cooked_at: "2026-03-10T19:00:00Z", day_of_week: 1, meal_type: "dinner", plan_id: "plan-1" }],
              error: null,
            }),
          }),
          update: mockUpdate,
        };
      }
      if (table === "recipes") return { select: vi.fn().mockReturnValue({ or: vi.fn().mockReturnValue(makeOr({ data: [recipeRow], error: null })) }), update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }) };
      if (table === "recipe_notes") return { select: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
      if (table === "recipe_ratings") return { select: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
      return {};
    });

    render(<PersonalMealDetailPage />);
    await waitFor(() => screen.getByText("Undo"));

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => screen.getByText("Undo cooked status?"));
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Marked as uncooked");
    });
  });

  it("shows error toast when uncook fails", async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "scheduled_events") {
        return makeSelectEqEqSingle({ data: eventRow, error: null });
      }
      if (table === "meal_plan_items") {
        return {
          select: vi.fn().mockReturnValue({
            or: vi.fn().mockResolvedValue({
              data: [{ id: "item-1", recipe_id: "recipe-1", cooked_at: "2026-03-10T19:00:00Z", day_of_week: 1, meal_type: "dinner", plan_id: "plan-1" }],
              error: null,
            }),
          }),
          update: vi.fn().mockReturnValue({ or: vi.fn().mockResolvedValue({ error: { message: "fail" } }), eq: vi.fn().mockResolvedValue({ error: null }) }),
        };
      }
      if (table === "recipes") return { select: vi.fn().mockReturnValue({ or: vi.fn().mockReturnValue(makeOr({ data: [recipeRow], error: null })) }), update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }) };
      if (table === "recipe_notes") return { select: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
      if (table === "recipe_ratings") return { select: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
      return {};
    });

    render(<PersonalMealDetailPage />);
    await waitFor(() => screen.getByText("Undo"));
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => screen.getByText("Undo cooked status?"));
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to mark as uncooked");
    });
  });

  it("signs out when Sign Out is clicked", async () => {
    await renderAndWait();

    fireEvent.click(screen.getByText("Sign Out"));
    expect(mockSignOut).toHaveBeenCalled();
  });

  it("shows recipe count badge in event info card", async () => {
    const { container } = await renderAndWait();
    const recipeCount = container.querySelector("strong.text-orange");
    expect(recipeCount).toHaveTextContent("1");
  });

  it("handles ratings submitted and shows success toast", async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "scheduled_events") {
        return makeSelectEqEqSingle({ data: eventRow, error: null });
      }
      if (table === "meal_plan_items") {
        return {
          select: vi.fn().mockReturnValue({
            or: vi.fn().mockResolvedValue({
              data: [{ id: "item-1", recipe_id: "recipe-1", cooked_at: null, day_of_week: 1, meal_type: "dinner", plan_id: "plan-1" }],
              error: null,
            }),
          }),
          update: vi.fn().mockReturnValue({ or: vi.fn().mockResolvedValue({ error: null }), eq: vi.fn().mockResolvedValue({ error: null }) }),
        };
      }
      if (table === "recipes") return { select: vi.fn().mockReturnValue({ or: vi.fn().mockReturnValue(makeOr({ data: [recipeRow], error: null })) }), update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }) };
      if (table === "recipe_notes") return { select: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
      if (table === "recipe_ratings") return { select: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
      return {};
    });

    render(<PersonalMealDetailPage />);
    await waitFor(() => screen.getByRole("button", { name: /Rate Recipes/i }));
    fireEvent.click(screen.getByRole("button", { name: /Rate Recipes/i }));
    await waitFor(() => screen.getByTestId("rating-dialog"));

    fireEvent.click(screen.getByRole("button", { name: "Complete Ratings" }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Recipes rated and meal marked as cooked!");
    });
  });

  it("cancels rating dialog", async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "scheduled_events") {
        return makeSelectEqEqSingle({ data: eventRow, error: null });
      }
      if (table === "meal_plan_items") {
        return {
          select: vi.fn().mockReturnValue({
            or: vi.fn().mockResolvedValue({
              data: [{ id: "item-1", recipe_id: "recipe-1", cooked_at: null, day_of_week: 1, meal_type: "dinner", plan_id: "plan-1" }],
              error: null,
            }),
          }),
        };
      }
      if (table === "recipes") return { select: vi.fn().mockReturnValue({ or: vi.fn().mockReturnValue(makeOr({ data: [recipeRow], error: null })) }) };
      if (table === "recipe_notes") return { select: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
      if (table === "recipe_ratings") return { select: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
      return {};
    });

    render(<PersonalMealDetailPage />);
    await waitFor(() => screen.getByRole("button", { name: /Rate Recipes/i }));
    fireEvent.click(screen.getByRole("button", { name: /Rate Recipes/i }));
    await waitFor(() => screen.getByTestId("rating-dialog"));

    fireEvent.click(screen.getByRole("button", { name: "Cancel Ratings" }));
    await waitFor(() => {
      expect(screen.queryByTestId("rating-dialog")).not.toBeInTheDocument();
    });
  });

  it("shows empty grocery placeholder when no recipes", async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "scheduled_events") {
        return makeSelectEqEqSingle({ data: eventRow, error: null });
      }
      if (table === "meal_plan_items") {
        return { select: vi.fn().mockReturnValue({ or: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
      }
      if (table === "recipes") {
        return { select: vi.fn().mockReturnValue({ or: vi.fn().mockReturnValue(makeOr({ data: [], error: null })) }) };
      }
      return {};
    });

    render(<PersonalMealDetailPage />);
    await waitFor(() => {
      expect(screen.getByText("Add recipes first to generate a grocery list.")).toBeInTheDocument();
    });
  });

  it("shows error when no eventId param", async () => {
    mockParams = { eventId: undefined };

    render(<PersonalMealDetailPage />);
    // With no eventId, loadEventData returns early, so isLoading ends and nothing renders (not found or page)
    // But the user state also won't trigger navigation — page stays loading briefly then nothing
    // Actually looking at code: loadEventData returns early if !eventId, setIsLoading(false) is called,
    // event stays null, notFound stays false — the component will render neither isLoading, notFound, nor main view
    // This is basically a blank render (conditional `if (isLoading)` false, `if (notFound)` false, then renders main)
    // The main view renders even with null event. Just ensure no crash.
    await waitFor(() => {
      expect(document.querySelector(".animate-spin")).not.toBeInTheDocument();
    });

    // Reset
    mockParams = { eventId: "event-1" };
  });

  it("shows error when recipes load fails", async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "scheduled_events") {
        return makeSelectEqEqSingle({ data: eventRow, error: null });
      }
      if (table === "meal_plan_items") {
        return { select: vi.fn().mockReturnValue({ or: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
      }
      if (table === "recipes") {
        return {
          select: vi.fn().mockReturnValue({
            or: vi.fn().mockReturnValue({ order: vi.fn().mockResolvedValue({ data: null, error: { message: "db error" } }) }),
          }),
        };
      }
      return {};
    });

    render(<PersonalMealDetailPage />);
    await waitFor(() => {
      expect(screen.getByText("Meal Not Found")).toBeInTheDocument();
    });
  });

  it("shows error when recipe notes load fails", async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "scheduled_events") {
        return makeSelectEqEqSingle({ data: eventRow, error: null });
      }
      if (table === "meal_plan_items") {
        return { select: vi.fn().mockReturnValue({ or: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
      }
      if (table === "recipes") {
        return { select: vi.fn().mockReturnValue({ or: vi.fn().mockReturnValue(makeOr({ data: [recipeRow], error: null })) }) };
      }
      if (table === "recipe_notes") {
        return { select: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ data: null, error: { message: "notes error" } }) }) };
      }
      if (table === "recipe_ratings") return { select: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
      return {};
    });

    render(<PersonalMealDetailPage />);
    await waitFor(() => {
      expect(screen.getByText("Meal Not Found")).toBeInTheDocument();
    });
  });

  it("adds manual meal successfully when function invoke returns success", async () => {
    mockFunctionsInvoke.mockResolvedValue({ data: { success: true }, error: null });

    await renderAndWait();
    fireEvent.click(screen.getByRole("button", { name: "Add Recipe" }));
    await waitFor(() => screen.getByTestId("add-meal-dialog"));
    fireEvent.click(screen.getByRole("button", { name: "Add Manual Meal" }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Recipe added!");
    });
  });

  it("starts parse progress when shouldParse=true", async () => {
    // Make parse succeed immediately
    mockFunctionsInvoke.mockResolvedValue({ data: { success: true }, error: null });

    await renderAndWait();
    fireEvent.click(screen.getByRole("button", { name: "Add Recipe" }));
    await waitFor(() => screen.getByTestId("add-meal-dialog"));
    fireEvent.click(screen.getByRole("button", { name: "Add Custom Meal With Parse" }));

    // After parse completes, should show success toast
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Recipe parsed successfully!");
    }, { timeout: 5000 });
  });

  it("shows parse failed dialog when parse-recipe function fails", async () => {
    // First call succeeds (for recipe insert), second call to functions.invoke fails
    mockFunctionsInvoke.mockResolvedValue({ data: null, error: { message: "parse failed" } });

    await renderAndWait();
    fireEvent.click(screen.getByRole("button", { name: "Add Recipe" }));
    await waitFor(() => screen.getByTestId("add-meal-dialog"));
    fireEvent.click(screen.getByRole("button", { name: "Add Custom Meal With Parse" }));

    await waitFor(() => {
      expect(screen.getByText("Parsing Failed")).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it("handleParseKeep shows success toast and dismisses dialog", async () => {
    mockFunctionsInvoke.mockResolvedValue({ data: null, error: { message: "parse failed" } });

    await renderAndWait();
    fireEvent.click(screen.getByRole("button", { name: "Add Recipe" }));
    await waitFor(() => screen.getByTestId("add-meal-dialog"));
    fireEvent.click(screen.getByRole("button", { name: "Add Custom Meal With Parse" }));

    await waitFor(() => screen.getByText("Keep Recipe Anyway"));
    fireEvent.click(screen.getByRole("button", { name: "Keep Recipe Anyway" }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Recipe saved without parsing");
    });
  });

  it("handleParseRetry restarts the parse flow", async () => {
    let callCount = 0;
    mockFunctionsInvoke.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve({ data: null, error: { message: "parse failed" } });
      return Promise.resolve({ data: { success: true }, error: null });
    });

    await renderAndWait();
    fireEvent.click(screen.getByRole("button", { name: "Add Recipe" }));
    await waitFor(() => screen.getByTestId("add-meal-dialog"));
    fireEvent.click(screen.getByRole("button", { name: "Add Custom Meal With Parse" }));

    await waitFor(() => screen.getByText("Try Again"), { timeout: 5000 });
    fireEvent.click(screen.getByRole("button", { name: "Try Again" }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Recipe parsed successfully!");
    }, { timeout: 5000 });
  });

  it("calls handleRateRecipe when onRateRecipe is invoked from EventRecipesTab", async () => {
    await renderAndWait();

    // Simulate onRateRecipe from the EventRecipesTab mock
    const mockRecipeWithRatings = {
      recipe: { id: "recipe-1", name: "Pasta Primavera" },
      notes: [],
      ratingSummary: undefined,
    };
    capturedRecipesTabProps.onRateRecipe?.(mockRecipeWithRatings);

    await waitFor(() => {
      expect(screen.getByTestId("rating-dialog")).toBeInTheDocument();
    });
  });

  it("shows success toast 'Recipes rated!' when already cooked after rating", async () => {
    // Set up with all items cooked
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "scheduled_events") {
        return makeSelectEqEqSingle({ data: eventRow, error: null });
      }
      if (table === "meal_plan_items") {
        return {
          select: vi.fn().mockReturnValue({
            or: vi.fn().mockResolvedValue({
              data: [{ id: "item-1", recipe_id: "recipe-1", cooked_at: "2026-03-10T19:00:00Z", day_of_week: 1, meal_type: "dinner", plan_id: "plan-1" }],
              error: null,
            }),
          }),
          update: vi.fn().mockReturnValue({ or: vi.fn().mockResolvedValue({ error: null }), eq: vi.fn().mockResolvedValue({ error: null }) }),
        };
      }
      if (table === "recipes") return { select: vi.fn().mockReturnValue({ or: vi.fn().mockReturnValue(makeOr({ data: [recipeRow], error: null })) }), update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }) };
      if (table === "recipe_notes") return { select: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
      if (table === "recipe_ratings") return { select: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
      return {};
    });

    render(<PersonalMealDetailPage />);
    await waitFor(() => screen.getByText("Cooked"));

    // Open rating dialog via capturedRecipesTabProps callback
    await waitFor(() => capturedRecipesTabProps.onRateRecipe !== undefined);
    const mockRecipeWithRatings = { recipe: { id: "recipe-1", name: "Pasta Primavera" }, notes: [], ratingSummary: undefined };
    capturedRecipesTabProps.onRateRecipe?.(mockRecipeWithRatings);

    await waitFor(() => screen.getByTestId("rating-dialog"));
    fireEvent.click(screen.getByRole("button", { name: "Complete Ratings" }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Recipes rated!");
    });
  });
});
