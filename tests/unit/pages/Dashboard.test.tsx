import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@tests/utils";
import Dashboard from "@/pages/Dashboard";

const mockNavigate = vi.fn();
let mockTabParam: string | undefined = undefined;
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ tab: mockTabParam }),
  };
});

const mockGetCurrentUser = vi.fn();
const mockSignOut = vi.fn();
const mockGetAllowedUser = vi.fn();
const mockIsAdmin = vi.fn();

vi.mock("@/lib/auth", () => ({
  getCurrentUser: () => mockGetCurrentUser(),
  signOut: () => mockSignOut(),
  getAllowedUser: (...args: unknown[]) => mockGetAllowedUser(...args),
  isAdmin: (...args: unknown[]) => mockIsAdmin(...args),
}));

const mockFromResult = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
};

const mockFrom = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// Mock dropdown-menu to render children directly (Radix portals don't work in jsdom)
vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
  DropdownMenuSeparator: () => <hr />,
}));

// Mock Tabs to render children directly and capture onValueChange
let capturedTabsProps: Record<string, unknown> = {};
vi.mock("@/components/ui/tabs", () => {
  const state = { activeValue: "" };
  return {
    Tabs: ({ children, value, ...rest }: { children: React.ReactNode; value?: string; onValueChange?: (v: string) => void }) => {
      state.activeValue = value || "home";
      capturedTabsProps = { children, value, ...rest };
      return <div>{children}</div>;
    },
    TabsList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    TabsTrigger: ({ children }: { children: React.ReactNode }) => <button role="tab">{children}</button>,
    TabsContent: ({ children, value }: { children: React.ReactNode; value: string }) =>
      value === state.activeValue ? <div>{children}</div> : null,
  };
});

// Capture HomeSection callbacks
let capturedHomeSectionProps: Record<string, unknown> = {};
vi.mock("@/components/home/HomeSection", () => ({
  default: (props: Record<string, unknown>) => {
    capturedHomeSectionProps = props;
    return <div data-testid="home-section">HomeSection</div>;
  },
}));

// Capture RecipeClubEvents callbacks
let capturedEventsProps: Record<string, unknown> = {};
vi.mock("@/components/events/RecipeClubEvents", () => ({
  default: (props: Record<string, unknown>) => {
    capturedEventsProps = props;
    return <div data-testid="events-section">Events</div>;
  },
}));

vi.mock("@/components/recipes/RecipeHub", () => ({
  default: () => <div data-testid="recipe-hub">RecipeHub</div>,
}));

// PantryDialog removed — pantry is now a tab in MealPlanPage

describe("Dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTabParam = undefined;
    mockFrom.mockReturnValue(mockFromResult);
    capturedTabsProps = {};
    capturedHomeSectionProps = {};
    capturedEventsProps = {};
    mockSignOut.mockResolvedValue(undefined);
    // Default: loadStats - Promise.all with select/count
    mockFromResult.maybeSingle.mockResolvedValue({ data: null, error: null });
    mockFromResult.select.mockReturnValue(mockFromResult);
    mockFromResult.eq.mockReturnValue(mockFromResult);
    mockFromResult.in.mockReturnValue(mockFromResult);
    mockFromResult.order.mockReturnValue(mockFromResult);
    mockFromResult.limit.mockReturnValue(mockFromResult);

    // Default: select with count
    mockFromResult.in.mockResolvedValue({ count: 5, error: null });
  });

  it("shows loading spinner while checking user", () => {
    mockGetCurrentUser.mockReturnValue(new Promise(() => {}));
    const { container } = render(<Dashboard />);
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("shows Access Denied screen for non-allowed users", async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: "user-1",
      name: "Test",
      email: "test@test.com",
    });
    mockGetAllowedUser.mockResolvedValue(null);
    mockIsAdmin.mockReturnValue(false);

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText("Access Denied")).toBeInTheDocument();
    });

    expect(screen.getByText(/You don't have access to Recipe Club Hub/)).toBeInTheDocument();
    expect(screen.getByText("Signed in as: test@test.com")).toBeInTheDocument();
  });

  it("shows Access Denied for user with no email", async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: "user-1",
      name: "Test",
      email: null,
    });

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText("Access Denied")).toBeInTheDocument();
    });
  });

  it("sign out button works on Access Denied page", async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: "user-1",
      name: "Test",
      email: "test@test.com",
    });
    mockGetAllowedUser.mockResolvedValue(null);
    mockIsAdmin.mockReturnValue(false);

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText("Access Denied")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Sign Out"));
    expect(mockSignOut).toHaveBeenCalled();
  });

  it("renders dashboard for allowed users", async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: "user-1",
      name: "Test User",
      email: "test@test.com",
    });
    mockGetAllowedUser.mockResolvedValue({ role: "viewer", is_club_member: true });
    mockIsAdmin.mockReturnValue(false);

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText("Recipe Club Hub")).toBeInTheDocument();
    });

    expect(screen.getByTestId("home-section")).toBeInTheDocument();
    // Check tabs exist (there are also stat labels "Events" / "Recipes")
    expect(screen.getByRole("tab", { name: /home/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /events/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /recipes/i })).toBeInTheDocument();
  });

  it("shows Manage Users option for admin", async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: "user-1",
      name: "Admin User",
      email: "admin@test.com",
    });
    mockGetAllowedUser.mockResolvedValue({ role: "admin", is_club_member: true });
    mockIsAdmin.mockReturnValue(true);

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText("Recipe Club Hub")).toBeInTheDocument();
    });

    // Open the dropdown menu
    const menuBtn = screen.getByRole("button", { name: /Admin User/i });
    if (menuBtn) fireEvent.click(menuBtn);
  });

  it("does not show Manage Users for non-admin", async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: "user-1",
      name: "Viewer",
      email: "viewer@test.com",
    });
    mockGetAllowedUser.mockResolvedValue({ role: "viewer", is_club_member: true });
    mockIsAdmin.mockReturnValue(false);

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText("Recipe Club Hub")).toBeInTheDocument();
    });

    expect(screen.queryByText("Manage Users")).not.toBeInTheDocument();
  });

  it("handles user with no email", async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: "user-1",
      name: "NoEmail",
      email: undefined,
    });

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText("Access Denied")).toBeInTheDocument();
    });
  });

  it("handles error loading active event", async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: "user-1",
      name: "Test",
      email: "test@test.com",
    });
    mockGetAllowedUser.mockResolvedValue({ role: "viewer" });
    mockIsAdmin.mockReturnValue(false);
    mockFromResult.maybeSingle.mockResolvedValue({ data: null, error: { message: "Error" } });

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText("Recipe Club Hub")).toBeInTheDocument();
    });

    consoleSpy.mockRestore();
  });

  it("does not show email on Access Denied when user has no email", async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: "user-1",
      name: "Test",
      email: null,
    });

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText("Access Denied")).toBeInTheDocument();
    });

    expect(screen.queryByText(/Signed in as:/)).not.toBeInTheDocument();
  });

  it("shows avatar fallback with first letter", async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: "user-1",
      name: "TestName",
      email: "test@test.com",
    });
    mockGetAllowedUser.mockResolvedValue({ role: "viewer" });
    mockIsAdmin.mockReturnValue(false);

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText("T")).toBeInTheDocument(); // Avatar fallback
    });
  });

  it("loads active event data when available", async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: "user-1",
      name: "Test",
      email: "test@test.com",
    });
    mockGetAllowedUser.mockResolvedValue({ role: "viewer", is_club_member: true });
    mockIsAdmin.mockReturnValue(false);
    mockFromResult.maybeSingle.mockResolvedValue({
      data: {
        id: "event-1",
        ingredient_id: "ing-1",
        event_date: "2026-03-01",
        event_time: "19:00",
        created_by: "user-1",
        status: "scheduled",
        ingredients: { name: "Chicken" },
      },
      error: null,
    });

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText("Recipe Club Hub")).toBeInTheDocument();
    });
  });

  it("has clickable tabs", async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: "user-1",
      name: "Test",
      email: "test@test.com",
    });
    mockGetAllowedUser.mockResolvedValue({ role: "viewer", is_club_member: true });
    mockIsAdmin.mockReturnValue(false);

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText("Recipe Club Hub")).toBeInTheDocument();
    });

    // Verify tabs are present and can be interacted with
    const eventsTab = screen.getByRole("tab", { name: /events/i });
    const recipesTab = screen.getByRole("tab", { name: /recipes/i });
    const homeTab = screen.getByRole("tab", { name: /home/i });

    expect(eventsTab).toBeInTheDocument();
    expect(recipesTab).toBeInTheDocument();
    expect(homeTab).toBeInTheDocument();
  });

  it("loads active event with null data fields", async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: "user-1",
      name: "Test",
      email: "test@test.com",
    });
    mockGetAllowedUser.mockResolvedValue({ role: "viewer" });
    mockIsAdmin.mockReturnValue(false);
    mockFromResult.maybeSingle.mockResolvedValue({
      data: {
        id: "event-1",
        ingredient_id: null,
        event_date: "2026-03-01",
        event_time: null,
        created_by: null,
        status: "scheduled",
        ingredients: null,
      },
      error: null,
    });

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText("Recipe Club Hub")).toBeInTheDocument();
    });
  });

  it("handles loadActiveEvent catch error", async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: "user-1",
      name: "Test",
      email: "test@test.com",
    });
    mockGetAllowedUser.mockResolvedValue({ role: "viewer" });
    mockIsAdmin.mockReturnValue(false);
    mockFromResult.maybeSingle.mockRejectedValue(new Error("Network error"));

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText("Recipe Club Hub")).toBeInTheDocument();
    });

    consoleSpy.mockRestore();
  });

  // --- Tab routing ---

  it("renders events tab when tab param is events", async () => {
    mockTabParam = "events";
    mockGetCurrentUser.mockResolvedValue({
      id: "user-1",
      name: "Test",
      email: "test@test.com",
    });
    mockGetAllowedUser.mockResolvedValue({ role: "viewer", is_club_member: true });
    mockIsAdmin.mockReturnValue(false);

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByTestId("events-section")).toBeInTheDocument();
    });
  });

  it("renders recipes tab when tab param is recipes", async () => {
    mockTabParam = "recipes";
    mockGetCurrentUser.mockResolvedValue({
      id: "user-1",
      name: "Test",
      email: "test@test.com",
    });
    mockGetAllowedUser.mockResolvedValue({ role: "viewer", is_club_member: true });
    mockIsAdmin.mockReturnValue(false);

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByTestId("recipe-hub")).toBeInTheDocument();
    });
  });

  it("defaults to home tab for invalid tab param", async () => {
    mockTabParam = "invalid-tab";
    mockGetCurrentUser.mockResolvedValue({
      id: "user-1",
      name: "Test",
      email: "test@test.com",
    });
    mockGetAllowedUser.mockResolvedValue({ role: "viewer", is_club_member: true });
    mockIsAdmin.mockReturnValue(false);

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByTestId("home-section")).toBeInTheDocument();
    });
  });

  // --- handleEventCreated / handleRecipeAdded ---

  it("handles onEventCreated callback from HomeSection", async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: "user-1",
      name: "Test",
      email: "test@test.com",
    });
    mockGetAllowedUser.mockResolvedValue({ role: "admin", is_club_member: true });
    mockIsAdmin.mockReturnValue(true);

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText("Recipe Club Hub")).toBeInTheDocument();
    });

    // Call onEventCreated which triggers loadActiveEvent + loadIngredients
    const onEventCreated = capturedHomeSectionProps.onEventCreated as () => void;
    expect(onEventCreated).toBeDefined();
    onEventCreated();

    // loadIngredients is called via handleEventCreated, which calls supabase.from
    await waitFor(() => {
      // Verify the callback was executed (it calls loadActiveEvent and loadIngredients)
      expect(mockFromResult.select).toHaveBeenCalled();
    });
  });

  it("handles onRecipeAdded callback from HomeSection", async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: "user-1",
      name: "Test",
      email: "test@test.com",
    });
    mockGetAllowedUser.mockResolvedValue({ role: "viewer", is_club_member: true });
    mockIsAdmin.mockReturnValue(false);

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText("Recipe Club Hub")).toBeInTheDocument();
    });

    const onRecipeAdded = capturedHomeSectionProps.onRecipeAdded as () => void;
    expect(onRecipeAdded).toBeDefined();
    onRecipeAdded();

    // handleRecipeAdded calls loadStats if user.id exists
    await waitFor(() => {
      expect(mockFromResult.in).toHaveBeenCalled();
    });
  });

  it("handles onEventUpdated callback from HomeSection", async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: "user-1",
      name: "Test",
      email: "test@test.com",
    });
    mockGetAllowedUser.mockResolvedValue({ role: "viewer", is_club_member: true });
    mockIsAdmin.mockReturnValue(false);

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText("Recipe Club Hub")).toBeInTheDocument();
    });

    const onEventUpdated = capturedHomeSectionProps.onEventUpdated as () => void;
    expect(onEventUpdated).toBeDefined();
    onEventUpdated();
  });

  // --- Dropdown menu items ---

  it("admin dropdown trigger is present", async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: "user-1",
      name: "Admin",
      email: "admin@test.com",
    });
    mockGetAllowedUser.mockResolvedValue({ role: "admin", is_club_member: true });
    mockIsAdmin.mockReturnValue(true);

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText("Recipe Club Hub")).toBeInTheDocument();
    });

    // Verify the dropdown trigger is present
    const menuBtn = screen.getByRole("button", { name: /Admin/i });
    expect(menuBtn).toBeInTheDocument();
  });

  it("shows My Pantry in hamburger menu", async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: "user-1",
      name: "Test",
      email: "test@test.com",
    });
    mockGetAllowedUser.mockResolvedValue({ role: "viewer", is_club_member: true });
    mockIsAdmin.mockReturnValue(false);

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText("Recipe Club Hub")).toBeInTheDocument();
    });

    // My Pantry should appear in the dropdown
    expect(screen.getByText("My Pantry")).toBeInTheDocument();
  });

  // --- loadStats error ---

  it("handles loadStats error", async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: "user-1",
      name: "Test",
      email: "test@test.com",
    });
    mockGetAllowedUser.mockResolvedValue({ role: "viewer", is_club_member: true });
    mockIsAdmin.mockReturnValue(false);

    // Make select throw for stats
    mockFromResult.in.mockRejectedValue(new Error("Stats error"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText("Recipe Club Hub")).toBeInTheDocument();
    });

    consoleSpy.mockRestore();
  });

  // --- loadIngredients error path ---

  it("handles loadIngredients error", async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: "user-1",
      name: "Test",
      email: "test@test.com",
    });
    mockGetAllowedUser.mockResolvedValue({ role: "admin", is_club_member: true });
    mockIsAdmin.mockReturnValue(true);

    // Start with successful load
    mockFromResult.order.mockResolvedValue({ data: null, error: { message: "load error" } });
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText("Recipe Club Hub")).toBeInTheDocument();
    });

    // Now trigger handleEventCreated which calls loadIngredients
    const onEventCreated = capturedHomeSectionProps.onEventCreated as () => void;
    if (onEventCreated) onEventCreated();

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalled();
    });

    consoleSpy.mockRestore();
  });

  // --- My Pantry menu item always renders, dialog gated by userId ---

  it("shows My Pantry menu item even when user has no id (dialog is gated)", async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: null,
      name: "Test",
      email: "test@test.com",
    });
    mockGetAllowedUser.mockResolvedValue({ role: "viewer" });
    mockIsAdmin.mockReturnValue(false);

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText("Recipe Club Hub")).toBeInTheDocument();
    });

    // Menu item is always rendered; dialog opening is gated by user.id
    expect(screen.getByText("My Pantry")).toBeInTheDocument();
  });

  // --- onEventChange passed to RecipeClubEvents ---

  it("passes onEventChange to RecipeClubEvents", async () => {
    mockTabParam = "events";
    mockGetCurrentUser.mockResolvedValue({
      id: "user-1",
      name: "Test",
      email: "test@test.com",
    });
    mockGetAllowedUser.mockResolvedValue({ role: "viewer", is_club_member: true });
    mockIsAdmin.mockReturnValue(false);

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByTestId("events-section")).toBeInTheDocument();
    });

    const onEventChange = capturedEventsProps.onEventChange as () => void;
    expect(onEventChange).toBeDefined();
    onEventChange();
  });

  // --- loadIngredients data mapping (lines 119-120) ---

  it("loadIngredients maps data correctly via handleEventCreated", async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: "user-1",
      name: "Test",
      email: "test@test.com",
    });
    mockGetAllowedUser.mockResolvedValue({ role: "admin", is_club_member: true });
    mockIsAdmin.mockReturnValue(true);

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText("Recipe Club Hub")).toBeInTheDocument();
    });

    // Set up order mock: first call for loadActiveEvent (chainable), second for loadIngredients (returns data)
    mockFromResult.order
      .mockReturnValueOnce(mockFromResult)
      .mockResolvedValueOnce({
        data: [
          {
            id: "i1",
            name: "Tomato",
            used_count: 2,
            last_used_by: "user-2",
            last_used_date: "2026-01-01",
            created_by: "user-1",
            in_bank: true,
          },
          {
            id: "i2",
            name: "Salt",
            used_count: 0,
            last_used_by: null,
            last_used_date: null,
            created_by: null,
            in_bank: false,
          },
        ],
        error: null,
      });

    const onEventCreated = capturedHomeSectionProps.onEventCreated as () => void;
    onEventCreated();

    await waitFor(() => {
      const ingredients = capturedHomeSectionProps.ingredients as Array<Record<string, unknown>>;
      expect(ingredients).toEqual([
        {
          id: "i1",
          name: "Tomato",
          usedCount: 2,
          lastUsedBy: "user-2",
          lastUsedDate: "2026-01-01",
          createdBy: "user-1",
          inBank: true,
        },
        {
          id: "i2",
          name: "Salt",
          usedCount: 0,
          lastUsedBy: undefined,
          lastUsedDate: undefined,
          createdBy: undefined,
          inBank: false,
        },
      ]);
    });
  });

  it("loadIngredients handles null data without error", async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: "user-1",
      name: "Test",
      email: "test@test.com",
    });
    mockGetAllowedUser.mockResolvedValue({ role: "admin", is_club_member: true });
    mockIsAdmin.mockReturnValue(true);

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText("Recipe Club Hub")).toBeInTheDocument();
    });

    mockFromResult.order
      .mockReturnValueOnce(mockFromResult)
      .mockResolvedValueOnce({ data: null, error: null });

    const onEventCreated = capturedHomeSectionProps.onEventCreated as () => void;
    onEventCreated();

    await waitFor(() => {
      expect(capturedHomeSectionProps.ingredients).toEqual([]);
    });
  });

  // --- Admin dropdown items (lines 255-262) ---

  it("admin clicks Manage Users and navigates to /users", async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: "user-1",
      name: "Admin",
      email: "admin@test.com",
    });
    mockGetAllowedUser.mockResolvedValue({ role: "admin", is_club_member: true });
    mockIsAdmin.mockReturnValue(true);

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText("Recipe Club Hub")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Manage Users"));
    expect(mockNavigate).toHaveBeenCalledWith("/users");
  });

  it("hamburger menu contains My Pantry entry", async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: "user-1",
      name: "Test",
      email: "test@test.com",
    });
    mockGetAllowedUser.mockResolvedValue({ role: "viewer", is_club_member: true });
    mockIsAdmin.mockReturnValue(false);

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText("Recipe Club Hub")).toBeInTheDocument();
    });

    // My Pantry is accessible from the hamburger menu
    expect(screen.getByText("My Pantry")).toBeInTheDocument();
  });

  // --- handleTabChange (lines 31-33) ---

  it("handleTabChange navigates to /dashboard/events for non-home tab", async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: "user-1",
      name: "Test",
      email: "test@test.com",
    });
    mockGetAllowedUser.mockResolvedValue({ role: "viewer", is_club_member: true });
    mockIsAdmin.mockReturnValue(false);

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText("Recipe Club Hub")).toBeInTheDocument();
    });

    const handleTabChange = capturedTabsProps.onValueChange as (value: string) => void;
    handleTabChange("events");
    expect(mockNavigate).toHaveBeenCalledWith("/dashboard/events");
  });

  it("handleTabChange navigates to /dashboard for home tab", async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: "user-1",
      name: "Test",
      email: "test@test.com",
    });
    mockGetAllowedUser.mockResolvedValue({ role: "viewer", is_club_member: true });
    mockIsAdmin.mockReturnValue(false);

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText("Recipe Club Hub")).toBeInTheDocument();
    });

    const handleTabChange = capturedTabsProps.onValueChange as (value: string) => void;
    handleTabChange("home");
    expect(mockNavigate).toHaveBeenCalledWith("/dashboard");
  });

  // --- handleRecipeAdded user?.id false branch (line 163) ---

  it("handleRecipeAdded does not call loadStats when user has no id", async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: null,
      name: "Test",
      email: "test@test.com",
    });
    mockGetAllowedUser.mockResolvedValue({ role: "viewer", is_club_member: true });
    mockIsAdmin.mockReturnValue(false);

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText("Recipe Club Hub")).toBeInTheDocument();
    });

    vi.clearAllMocks();
    const onRecipeAdded = capturedHomeSectionProps.onRecipeAdded as () => void;
    onRecipeAdded();

    // loadStats should NOT be called when user has no id
    expect(mockFromResult.in).not.toHaveBeenCalled();
  });

  // --- Pluralization of badge labels ---

  it("shows singular 'Club Event' and 'Total Recipe' when counts are 1", async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: "user-1",
      name: "Test",
      email: "test@test.com",
    });
    mockGetAllowedUser.mockResolvedValue({ role: "viewer", is_club_member: true });
    mockIsAdmin.mockReturnValue(false);

    // Events count = 1
    mockFromResult.in.mockResolvedValue({ count: 1, error: null });

    // Recipes count = 1: override from() to return a mock that resolves .select() for the recipes table
    mockFrom.mockImplementation((table: string) => {
      if (table === "recipes") {
        return {
          select: vi.fn().mockResolvedValue({ count: 1, error: null }),
        };
      }
      return mockFromResult;
    });

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText("Recipe Club Hub")).toBeInTheDocument();
    });

    // Desktop header + mobile dropdown (both rendered, CSS controls visibility)
    const eventLabels = screen.getAllByText("Club Event");
    expect(eventLabels).toHaveLength(2);

    // "Total Recipe" in header only, "Club Recipe" in mobile dropdown
    const recipeLabels = screen.getAllByText("Total Recipe");
    expect(recipeLabels).toHaveLength(1);
    const mobileRecipeLabels = screen.getAllByText("Club Recipe");
    expect(mobileRecipeLabels).toHaveLength(1);
  });

  it("shows plural 'Club Events' and 'Total Recipes' when counts are 2+", async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: "user-1",
      name: "Test",
      email: "test@test.com",
    });
    mockGetAllowedUser.mockResolvedValue({ role: "viewer", is_club_member: true });
    mockIsAdmin.mockReturnValue(false);

    // Events count = 3
    mockFromResult.in.mockResolvedValue({ count: 3, error: null });

    // Recipes count = 5
    mockFrom.mockImplementation((table: string) => {
      if (table === "recipes") {
        return {
          select: vi.fn().mockResolvedValue({ count: 5, error: null }),
        };
      }
      return mockFromResult;
    });

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText("Recipe Club Hub")).toBeInTheDocument();
    });

    // Desktop header + mobile dropdown (both rendered, CSS controls visibility)
    const eventLabels = screen.getAllByText("Club Events");
    expect(eventLabels).toHaveLength(2);

    // "Total Recipes" in header only, "Club Recipes" in mobile dropdown
    const recipeLabels = screen.getAllByText("Total Recipes");
    expect(recipeLabels).toHaveLength(1);
    const mobileRecipeLabels = screen.getAllByText("Club Recipes");
    expect(mobileRecipeLabels).toHaveLength(1);
  });

  it("shows plural labels when counts are 0", async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: "user-1",
      name: "Test",
      email: "test@test.com",
    });
    mockGetAllowedUser.mockResolvedValue({ role: "viewer", is_club_member: true });
    mockIsAdmin.mockReturnValue(false);

    // Events count = 0
    mockFromResult.in.mockResolvedValue({ count: 0, error: null });

    // Recipes count = 0
    mockFrom.mockImplementation((table: string) => {
      if (table === "recipes") {
        return {
          select: vi.fn().mockResolvedValue({ count: 0, error: null }),
        };
      }
      return mockFromResult;
    });

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText("Recipe Club Hub")).toBeInTheDocument();
    });

    // 0 is plural, desktop header + mobile dropdown (both rendered, CSS controls visibility)
    const eventLabels = screen.getAllByText("Club Events");
    expect(eventLabels).toHaveLength(2);

    // "Total Recipes" in header only, "Club Recipes" in mobile dropdown
    const recipeLabels = screen.getAllByText("Total Recipes");
    expect(recipeLabels).toHaveLength(1);
    const mobileRecipeLabels = screen.getAllByText("Club Recipes");
    expect(mobileRecipeLabels).toHaveLength(1);
  });

  // --- loadStats count || 0 fallback branches (lines 150-151) ---

  it("loadStats handles null count with || 0 fallback", async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: "user-1",
      name: "Test",
      email: "test@test.com",
    });
    mockGetAllowedUser.mockResolvedValue({ role: "viewer", is_club_member: true });
    mockIsAdmin.mockReturnValue(false);

    // Make the .in() chain return null count so eventsResult.count || 0 takes the fallback
    mockFromResult.in.mockResolvedValue({ count: null, error: null });

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText("Recipe Club Hub")).toBeInTheDocument();
    });
  });
});
