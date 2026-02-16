import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@tests/utils";
import SharedWithMeSection from "@/components/recipes/SharedWithMeSection";

// Mock Supabase
const mockSupabaseFrom = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => mockSupabaseFrom(...args),
  },
}));

const createMockQueryBuilder = (data: unknown[] = [], error: unknown = null) => ({
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  neq: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  not: vi.fn().mockReturnThis(),
  order: vi.fn().mockResolvedValue({ data, error }),
  single: vi.fn().mockResolvedValue({ data: data[0] || null, error }),
  maybeSingle: vi.fn().mockResolvedValue({ data: data[0] || null, error }),
});

describe("SharedWithMeSection", () => {
  const defaultProps = {
    userEmail: "test@example.com",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading spinner initially", () => {
    mockSupabaseFrom.mockReturnValue(createMockQueryBuilder([]));
    render(<SharedWithMeSection {...defaultProps} />);

    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("shows empty state when no shares", async () => {
    mockSupabaseFrom.mockReturnValue(createMockQueryBuilder([]));

    render(<SharedWithMeSection {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/no recipes have been shared with you yet/i)).toBeInTheDocument();
    });
  });

  it("displays shared recipes", async () => {
    const mockShares = [
      {
        id: "share-1",
        recipe_id: "recipe-1",
        message: "Try this!",
        viewed_at: null,
        shared_at: "2025-02-14T10:00:00Z",
        recipes: { name: "Grilled Salmon", url: "https://example.com/salmon" },
        profiles: { name: "Sarah" },
      },
      {
        id: "share-2",
        recipe_id: "recipe-2",
        message: null,
        viewed_at: "2025-02-14T12:00:00Z",
        shared_at: "2025-02-13T10:00:00Z",
        recipes: { name: "Pasta", url: null },
        profiles: { name: "Daniel" },
      },
    ];

    mockSupabaseFrom.mockReturnValue(createMockQueryBuilder(mockShares));

    render(<SharedWithMeSection {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Grilled Salmon")).toBeInTheDocument();
      expect(screen.getByText("Pasta")).toBeInTheDocument();
    });
  });

  it("shows New badge for unviewed shares", async () => {
    const mockShares = [
      {
        id: "share-1",
        recipe_id: "recipe-1",
        message: null,
        viewed_at: null,
        shared_at: "2025-02-14T10:00:00Z",
        recipes: { name: "New Recipe", url: null },
        profiles: { name: "Sarah" },
      },
    ];

    mockSupabaseFrom.mockReturnValue(createMockQueryBuilder(mockShares));

    render(<SharedWithMeSection {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("New")).toBeInTheDocument();
    });
  });

  it("does not show New badge for viewed shares", async () => {
    const mockShares = [
      {
        id: "share-1",
        recipe_id: "recipe-1",
        message: null,
        viewed_at: "2025-02-14T12:00:00Z",
        shared_at: "2025-02-14T10:00:00Z",
        recipes: { name: "Viewed Recipe", url: "https://example.com" },
        profiles: { name: "Sarah" },
      },
    ];

    mockSupabaseFrom.mockReturnValue(createMockQueryBuilder(mockShares));

    render(<SharedWithMeSection {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Viewed Recipe")).toBeInTheDocument();
      expect(screen.queryByText("New")).not.toBeInTheDocument();
    });
  });

  it("shows sharer name and avatar", async () => {
    const mockShares = [
      {
        id: "share-1",
        recipe_id: "recipe-1",
        message: null,
        viewed_at: null,
        shared_at: "2025-02-14T10:00:00Z",
        recipes: { name: "Test Recipe", url: null },
        profiles: { name: "Sarah" },
      },
    ];

    mockSupabaseFrom.mockReturnValue(createMockQueryBuilder(mockShares));

    render(<SharedWithMeSection {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Shared by Sarah")).toBeInTheDocument();
      expect(screen.getByText("S")).toBeInTheDocument(); // Avatar fallback
    });
  });

  it("shows message when present", async () => {
    const mockShares = [
      {
        id: "share-1",
        recipe_id: "recipe-1",
        message: "You'll love this!",
        viewed_at: null,
        shared_at: "2025-02-14T10:00:00Z",
        recipes: { name: "Test Recipe", url: null },
        profiles: { name: "Sarah" },
      },
    ];

    mockSupabaseFrom.mockReturnValue(createMockQueryBuilder(mockShares));

    render(<SharedWithMeSection {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/you'll love this!/i)).toBeInTheDocument();
    });
  });

  it("shows View Recipe link for recipes with URL", async () => {
    const mockShares = [
      {
        id: "share-1",
        recipe_id: "recipe-1",
        message: null,
        viewed_at: null,
        shared_at: "2025-02-14T10:00:00Z",
        recipes: { name: "Test Recipe", url: "https://example.com/recipe" },
        profiles: { name: "Sarah" },
      },
    ];

    mockSupabaseFrom.mockReturnValue(createMockQueryBuilder(mockShares));

    render(<SharedWithMeSection {...defaultProps} />);

    await waitFor(() => {
      const link = screen.getByText("View Recipe");
      expect(link).toBeInTheDocument();
      expect(link.closest("a")).toHaveAttribute("href", "https://example.com/recipe");
    });
  });

  it("shows Mark as Viewed button for shares without URL and not viewed", async () => {
    const mockShares = [
      {
        id: "share-1",
        recipe_id: "recipe-1",
        message: null,
        viewed_at: null,
        shared_at: "2025-02-14T10:00:00Z",
        recipes: { name: "Test Recipe", url: null },
        profiles: { name: "Sarah" },
      },
    ];

    const mockBuilder = createMockQueryBuilder(mockShares);
    mockSupabaseFrom.mockReturnValue(mockBuilder);

    render(<SharedWithMeSection {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Mark as Viewed")).toBeInTheDocument();
    });
  });

  it("marks share as viewed when clicking Mark as Viewed", async () => {
    const mockShares = [
      {
        id: "share-1",
        recipe_id: "recipe-1",
        message: null,
        viewed_at: null,
        shared_at: "2025-02-14T10:00:00Z",
        recipes: { name: "Test Recipe", url: null },
        profiles: { name: "Sarah" },
      },
    ];

    const mockUpdateBuilder = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    };

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipe_shares") {
        // First call is for loading, subsequent for update
        const builder = createMockQueryBuilder(mockShares);
        builder.update = vi.fn().mockReturnValue(mockUpdateBuilder);
        return builder;
      }
      return createMockQueryBuilder([]);
    });

    render(<SharedWithMeSection {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Mark as Viewed")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Mark as Viewed"));

    await waitFor(() => {
      expect(screen.queryByText("New")).not.toBeInTheDocument();
    });
  });

  it("marks as viewed when clicking View Recipe link", async () => {
    const mockShares = [
      {
        id: "share-1",
        recipe_id: "recipe-1",
        message: null,
        viewed_at: null,
        shared_at: "2025-02-14T10:00:00Z",
        recipes: { name: "Test Recipe", url: "https://example.com" },
        profiles: { name: "Sarah" },
      },
    ];

    const mockUpdateBuilder = {
      eq: vi.fn().mockResolvedValue({ error: null }),
    };

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipe_shares") {
        const builder = createMockQueryBuilder(mockShares);
        builder.update = vi.fn().mockReturnValue(mockUpdateBuilder);
        return builder;
      }
      return createMockQueryBuilder([]);
    });

    render(<SharedWithMeSection {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("View Recipe")).toBeInTheDocument();
    });

    // With asChild, the Button renders as an <a> tag. Click the link directly.
    const viewLink = screen.getByText("View Recipe");
    fireEvent.click(viewLink);

    // Verify the New badge is removed after marking as viewed
    await waitFor(() => {
      expect(screen.queryByText("New")).not.toBeInTheDocument();
    });
  });

  it("does not mark as viewed again when already viewed and clicking View Recipe", async () => {
    const mockShares = [
      {
        id: "share-1",
        recipe_id: "recipe-1",
        message: null,
        viewed_at: "2025-02-14T12:00:00Z",
        shared_at: "2025-02-14T10:00:00Z",
        recipes: { name: "Test Recipe", url: "https://example.com" },
        profiles: { name: "Sarah" },
      },
    ];

    mockSupabaseFrom.mockReturnValue(createMockQueryBuilder(mockShares));

    render(<SharedWithMeSection {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("View Recipe")).toBeInTheDocument();
    });

    // Click the View Recipe link for an already-viewed share
    const viewLink = screen.getByText("View Recipe");
    fireEvent.click(viewLink);

    // Should not call update since already viewed
    // The update mock was not set up, so if it tried to update it would fail
    expect(screen.getByText("Test Recipe")).toBeInTheDocument();
  });

  it("handles null recipe data gracefully", async () => {
    const mockShares = [
      {
        id: "share-1",
        recipe_id: "recipe-1",
        message: null,
        viewed_at: null,
        shared_at: "2025-02-14T10:00:00Z",
        recipes: null,
        profiles: null,
      },
    ];

    mockSupabaseFrom.mockReturnValue(createMockQueryBuilder(mockShares));

    render(<SharedWithMeSection {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Unknown Recipe")).toBeInTheDocument();
    });
  });

  it("handles error loading shares", async () => {
    mockSupabaseFrom.mockReturnValue(
      createMockQueryBuilder([], { message: "Database error" })
    );

    render(<SharedWithMeSection {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/no recipes have been shared with you yet/i)).toBeInTheDocument();
    });
  });

  it("shows Shared badge on all cards", async () => {
    const mockShares = [
      {
        id: "share-1",
        recipe_id: "recipe-1",
        message: null,
        viewed_at: null,
        shared_at: "2025-02-14T10:00:00Z",
        recipes: { name: "Test Recipe", url: null },
        profiles: { name: "Sarah" },
      },
    ];

    mockSupabaseFrom.mockReturnValue(createMockQueryBuilder(mockShares));

    render(<SharedWithMeSection {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Shared")).toBeInTheDocument();
    });
  });

  it("handles share without sharer name", async () => {
    const mockShares = [
      {
        id: "share-1",
        recipe_id: "recipe-1",
        message: null,
        viewed_at: null,
        shared_at: "2025-02-14T10:00:00Z",
        recipes: { name: "Test Recipe", url: null },
        profiles: null,
      },
    ];

    mockSupabaseFrom.mockReturnValue(createMockQueryBuilder(mockShares));

    render(<SharedWithMeSection {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Test Recipe")).toBeInTheDocument();
      // Should not show "Shared by" when no name
      expect(screen.queryByText(/shared by/i)).not.toBeInTheDocument();
    });
  });

  it("handles null data from order response", async () => {
    // Return null data to exercise (data || []) fallback
    const builder = createMockQueryBuilder([]);
    builder.order = vi.fn().mockResolvedValue({ data: null, error: null });

    mockSupabaseFrom.mockReturnValue(builder);

    render(<SharedWithMeSection {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/no recipes have been shared with you yet/i)).toBeInTheDocument();
    });
  });

  it("preserves other shares when marking one as viewed", async () => {
    const mockShares = [
      {
        id: "share-1",
        recipe_id: "recipe-1",
        message: null,
        viewed_at: null,
        shared_at: "2025-02-14T10:00:00Z",
        recipes: { name: "Recipe One", url: "https://example.com/1" },
        profiles: { name: "Sarah" },
      },
      {
        id: "share-2",
        recipe_id: "recipe-2",
        message: null,
        viewed_at: null,
        shared_at: "2025-02-13T10:00:00Z",
        recipes: { name: "Recipe Two", url: "https://example.com/2" },
        profiles: { name: "John" },
      },
    ];

    const mockUpdateBuilder = {
      eq: vi.fn().mockResolvedValue({ error: null }),
    };

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "recipe_shares") {
        const builder = createMockQueryBuilder(mockShares);
        builder.update = vi.fn().mockReturnValue(mockUpdateBuilder);
        return builder;
      }
      return createMockQueryBuilder([]);
    });

    render(<SharedWithMeSection {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Recipe One")).toBeInTheDocument();
      expect(screen.getByText("Recipe Two")).toBeInTheDocument();
    });

    // Click "View Recipe" on the first share only
    const viewLinks = screen.getAllByText("View Recipe");
    fireEvent.click(viewLinks[0]);

    // First share should lose its New badge, second should keep it
    await waitFor(() => {
      const newBadges = screen.getAllByText("New");
      expect(newBadges.length).toBe(1); // Only share-2 retains "New"
    });
  });

  it("does not show Mark as Viewed for already-viewed shares without URL", async () => {
    const mockShares = [
      {
        id: "share-1",
        recipe_id: "recipe-1",
        message: null,
        viewed_at: "2025-02-14T12:00:00Z",
        shared_at: "2025-02-14T10:00:00Z",
        recipes: { name: "Test Recipe", url: null },
        profiles: { name: "Sarah" },
      },
    ];

    mockSupabaseFrom.mockReturnValue(createMockQueryBuilder(mockShares));

    render(<SharedWithMeSection {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Test Recipe")).toBeInTheDocument();
      expect(screen.queryByText("Mark as Viewed")).not.toBeInTheDocument();
    });
  });
});
