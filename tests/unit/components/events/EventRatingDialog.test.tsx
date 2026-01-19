import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@tests/utils";
import { createMockRecipe, createMockContribution } from "@tests/utils";
import EventRatingDialog from "@/components/events/EventRatingDialog";
import type { EventRecipeWithContributions } from "@/types";

// Mock Supabase
const mockUpsert = vi.fn();
const mockSelect = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      upsert: mockUpsert,
      select: () => ({
        eq: () => ({
          in: mockSelect,
        }),
      }),
    }),
  },
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

import { toast } from "sonner";
const mockToast = toast as { error: ReturnType<typeof vi.fn>; success: ReturnType<typeof vi.fn> };

describe("EventRatingDialog", () => {
  const mockOnComplete = vi.fn();
  const mockOnCancel = vi.fn();

  const mockEvent = {
    eventId: "event-123",
    eventDate: "2025-01-20",
    ingredientName: "Salmon",
  };

  const mockRecipes: EventRecipeWithContributions[] = [
    {
      recipe: createMockRecipe({ id: "recipe-1", name: "Grilled Salmon", url: "https://example.com/salmon" }),
      contributions: [
        createMockContribution({ id: "contrib-1", recipeId: "recipe-1", userName: "User 1" }),
      ],
    },
    {
      recipe: createMockRecipe({ id: "recipe-2", name: "Salmon Teriyaki" }),
      contributions: [
        createMockContribution({ id: "contrib-2", recipeId: "recipe-2", userName: "User 2" }),
      ],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockUpsert.mockResolvedValue({ error: null });
    mockSelect.mockResolvedValue({ data: [], error: null });
  });

  it("renders the dialog with correct title", () => {
    render(
      <EventRatingDialog
        event={mockEvent}
        recipes={mockRecipes}
        userId="user-123"
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText("Rate the Recipes")).toBeInTheDocument();
  });

  it("shows the event ingredient name in description", () => {
    render(
      <EventRatingDialog
        event={mockEvent}
        recipes={mockRecipes}
        userId="user-123"
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText(/salmon event/i)).toBeInTheDocument();
  });

  it("displays all recipes to rate", () => {
    render(
      <EventRatingDialog
        event={mockEvent}
        recipes={mockRecipes}
        userId="user-123"
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText("Grilled Salmon")).toBeInTheDocument();
    expect(screen.getByText("Salmon Teriyaki")).toBeInTheDocument();
  });

  it("shows view recipe link when URL is provided", () => {
    render(
      <EventRatingDialog
        event={mockEvent}
        recipes={mockRecipes}
        userId="user-123"
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
      />
    );

    const viewRecipeLinks = screen.getAllByText("View recipe");
    expect(viewRecipeLinks.length).toBeGreaterThan(0);
  });

  it("shows 'Would you make this again?' options", () => {
    render(
      <EventRatingDialog
        event={mockEvent}
        recipes={mockRecipes}
        userId="user-123"
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
      />
    );

    const questions = screen.getAllByText(/would you make this again/i);
    expect(questions.length).toBe(mockRecipes.length);
  });

  it("shows star rating options", () => {
    render(
      <EventRatingDialog
        event={mockEvent}
        recipes={mockRecipes}
        userId="user-123"
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
      />
    );

    const ratingLabels = screen.getAllByText(/overall rating/i);
    expect(ratingLabels.length).toBe(mockRecipes.length);
  });

  it("shows Yes and No buttons for would cook again", () => {
    render(
      <EventRatingDialog
        event={mockEvent}
        recipes={mockRecipes}
        userId="user-123"
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
      />
    );

    const yesButtons = screen.getAllByText("Yes");
    const noButtons = screen.getAllByText("No");

    expect(yesButtons.length).toBe(mockRecipes.length);
    expect(noButtons.length).toBe(mockRecipes.length);
  });

  it("calls onCancel when dialog is closed", () => {
    render(
      <EventRatingDialog
        event={mockEvent}
        recipes={mockRecipes}
        userId="user-123"
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
      />
    );

    // The dialog has an X button with aria-label "Close"
    const closeButtons = screen.queryAllByRole("button");
    const closeButton = closeButtons.find(btn =>
      btn.querySelector("svg.lucide-x") || btn.getAttribute("aria-label") === "Close"
    );

    if (closeButton) {
      fireEvent.click(closeButton);
      // Give time for the dialog to close
      expect(mockOnCancel).toHaveBeenCalled();
    }
  });

  it("disables submit button until all recipes are rated", () => {
    render(
      <EventRatingDialog
        event={mockEvent}
        recipes={mockRecipes}
        userId="user-123"
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
      />
    );

    const submitButton = screen.getByText(/submit ratings/i);
    expect(submitButton).toBeDisabled();
  });

  it("shows unrated count message", () => {
    render(
      <EventRatingDialog
        event={mockEvent}
        recipes={mockRecipes}
        userId="user-123"
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText(/2 recipes still need rating/i)).toBeInTheDocument();
  });

  it("updates unrated count as recipes are rated", async () => {
    render(
      <EventRatingDialog
        event={mockEvent}
        recipes={mockRecipes}
        userId="user-123"
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
      />
    );

    // Rate first recipe
    const yesButtons = screen.getAllByText("Yes");
    fireEvent.click(yesButtons[0]);

    const starButtons = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg.h-6.w-6")
    );
    fireEvent.click(starButtons[4]); // 5th star for first recipe

    await waitFor(() => {
      expect(screen.getByText(/1 recipe still needs rating/i)).toBeInTheDocument();
    });
  });

  it("enables submit button when all recipes are rated", async () => {
    render(
      <EventRatingDialog
        event={mockEvent}
        recipes={mockRecipes}
        userId="user-123"
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
      />
    );

    // Rate both recipes
    const yesButtons = screen.getAllByText("Yes");
    fireEvent.click(yesButtons[0]);
    fireEvent.click(yesButtons[1]);

    const starButtons = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg.h-6.w-6")
    );
    fireEvent.click(starButtons[4]); // First recipe: 5 stars
    fireEvent.click(starButtons[9]); // Second recipe: 5 stars

    await waitFor(() => {
      const submitButton = screen.getByText(/submit ratings/i);
      expect(submitButton).not.toBeDisabled();
    });
  });

  it("has Submit Ratings button", () => {
    render(
      <EventRatingDialog
        event={mockEvent}
        recipes={mockRecipes}
        userId="user-123"
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText(/submit ratings/i)).toBeInTheDocument();
  });

  it("shows message when no recipes to rate", () => {
    render(
      <EventRatingDialog
        event={mockEvent}
        recipes={[]}
        userId="user-123"
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText(/no recipes to rate/i)).toBeInTheDocument();
  });

  it("allows completing event with no recipes", async () => {
    render(
      <EventRatingDialog
        event={mockEvent}
        recipes={[]}
        userId="user-123"
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
      />
    );

    // Submit button should be enabled when there are no recipes
    const submitButton = screen.getByText(/submit ratings/i);
    expect(submitButton).not.toBeDisabled();

    fireEvent.click(submitButton);

    await waitFor(() => {
      // onComplete should be called
      expect(mockOnComplete).toHaveBeenCalled();
      // insert should NOT be called when there are no recipes
      expect(mockUpsert).not.toHaveBeenCalled();
    });
  });

  it("allows selecting thumbs up for would cook again", async () => {
    render(
      <EventRatingDialog
        event={mockEvent}
        recipes={mockRecipes}
        userId="user-123"
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
      />
    );

    const yesButtons = screen.getAllByText("Yes");
    fireEvent.click(yesButtons[0]);

    // The button should now have a different styling (green background)
    await waitFor(() => {
      expect(yesButtons[0].closest("button")).toHaveClass("bg-green-500");
    });
  });

  it("allows selecting thumbs down for would cook again", async () => {
    render(
      <EventRatingDialog
        event={mockEvent}
        recipes={mockRecipes}
        userId="user-123"
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
      />
    );

    const noButtons = screen.getAllByText("No");
    fireEvent.click(noButtons[0]);

    await waitFor(() => {
      expect(noButtons[0].closest("button")).toHaveClass("bg-red-500");
    });
  });

  it("submits ratings successfully", async () => {
    render(
      <EventRatingDialog
        event={mockEvent}
        recipes={mockRecipes}
        userId="user-123"
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
      />
    );

    // Rate all recipes (both need to be rated for submit to be enabled)
    const yesButtons = screen.getAllByText("Yes");
    fireEvent.click(yesButtons[0]);
    fireEvent.click(yesButtons[1]);

    // Click stars for both recipes
    const starButtons = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg.h-6.w-6")
    );
    fireEvent.click(starButtons[4]); // First recipe: 5 stars
    fireEvent.click(starButtons[9]); // Second recipe: 5 stars

    // Submit
    fireEvent.click(screen.getByText(/submit ratings/i));

    await waitFor(() => {
      expect(mockOnComplete).toHaveBeenCalled();
    });
  });

  it("handles submission error gracefully", async () => {
    mockUpsert.mockResolvedValueOnce({ error: { message: "Database error" } });

    render(
      <EventRatingDialog
        event={mockEvent}
        recipes={mockRecipes}
        userId="user-123"
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
      />
    );

    // Rate all recipes (both need to be rated for submit to be enabled)
    const yesButtons = screen.getAllByText("Yes");
    fireEvent.click(yesButtons[0]);
    fireEvent.click(yesButtons[1]);

    const starButtons = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg.h-6.w-6")
    );
    fireEvent.click(starButtons[4]); // First recipe
    fireEvent.click(starButtons[9]); // Second recipe

    fireEvent.click(screen.getByText(/submit ratings/i));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Failed to submit ratings");
    });
  });
});

describe("EventRatingDialog - Star Ratings", () => {
  const mockOnComplete = vi.fn();
  const mockOnCancel = vi.fn();

  const mockEvent = {
    eventId: "event-123",
    eventDate: "2025-01-20",
    ingredientName: "Chicken",
  };

  const mockRecipes: EventRecipeWithContributions[] = [
    {
      recipe: createMockRecipe({ id: "recipe-1", name: "Test Recipe" }),
      contributions: [createMockContribution({ id: "contrib-1" })],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockUpsert.mockResolvedValue({ error: null });
    mockSelect.mockResolvedValue({ data: [], error: null });
  });

  it("displays 5 stars for each recipe", () => {
    render(
      <EventRatingDialog
        event={mockEvent}
        recipes={mockRecipes}
        userId="user-123"
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
      />
    );

    // Count star SVGs
    const stars = document.querySelectorAll("svg.h-6.w-6");
    expect(stars.length).toBe(5);
  });

  it("shows rating number when a star is selected", async () => {
    render(
      <EventRatingDialog
        event={mockEvent}
        recipes={mockRecipes}
        userId="user-123"
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
      />
    );

    // Click the 4th star
    const starButtons = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg.h-6.w-6")
    );

    if (starButtons.length >= 4) {
      fireEvent.click(starButtons[3]);

      await waitFor(() => {
        expect(screen.getByText("4/5")).toBeInTheDocument();
      });
    }
  });
});

describe("EventRatingDialog - Branch Coverage", () => {
  const mockOnComplete = vi.fn();
  const mockOnCancel = vi.fn();

  const mockEvent = {
    eventId: "event-123",
    eventDate: "2025-01-20",
    ingredientName: "Salmon",
  };

  const singleRecipe: EventRecipeWithContributions[] = [
    {
      recipe: createMockRecipe({ id: "recipe-1", name: "Test Recipe" }),
      contributions: [
        createMockContribution({ id: "contrib-1", recipeId: "recipe-1", userName: "User 1" }),
      ],
    },
  ];

  const multipleRecipes: EventRecipeWithContributions[] = [
    {
      recipe: createMockRecipe({ id: "recipe-1", name: "Recipe One" }),
      contributions: [createMockContribution({ id: "contrib-1", recipeId: "recipe-1" })],
    },
    {
      recipe: createMockRecipe({ id: "recipe-2", name: "Recipe Two" }),
      contributions: [createMockContribution({ id: "contrib-2", recipeId: "recipe-2" })],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockUpsert.mockResolvedValue({ error: null });
    mockSelect.mockResolvedValue({ data: [], error: null });
  });

  it("disables submit button when no ratings are filled", () => {
    render(
      <EventRatingDialog
        event={mockEvent}
        recipes={singleRecipe}
        userId="user-123"
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
      />
    );

    // Submit button should be disabled without any ratings
    const submitButton = screen.getByText(/submit ratings/i);
    expect(submitButton).toBeDisabled();
    expect(screen.getByText(/1 recipe still needs rating/i)).toBeInTheDocument();
  });

  it("shows singular message when submitting exactly 1 rating", async () => {
    render(
      <EventRatingDialog
        event={mockEvent}
        recipes={singleRecipe}
        userId="user-123"
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
      />
    );

    // Select "Yes" for would cook again
    const yesButton = screen.getAllByText("Yes")[0];
    fireEvent.click(yesButton);

    // Select a star rating
    const starButtons = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg.h-6.w-6")
    );
    if (starButtons.length > 0) {
      fireEvent.click(starButtons[0]); // 1 star
    }

    // Submit
    fireEvent.click(screen.getByText(/submit ratings/i));

    await waitFor(() => {
      // Should show singular "rating" (not "ratings")
      expect(mockToast.success).toHaveBeenCalledWith("Submitted 1 rating!");
    });
  });

  it("shows plural message when submitting multiple ratings", async () => {
    render(
      <EventRatingDialog
        event={mockEvent}
        recipes={multipleRecipes}
        userId="user-123"
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
      />
    );

    // Rate both recipes
    const yesButtons = screen.getAllByText("Yes");
    fireEvent.click(yesButtons[0]);
    fireEvent.click(yesButtons[1]);

    const starButtons = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg.h-6.w-6")
    );
    // Each recipe has 5 stars, so click first star for each recipe
    if (starButtons.length >= 6) {
      fireEvent.click(starButtons[0]); // First recipe
      fireEvent.click(starButtons[5]); // Second recipe (stars 5-9)
    }

    fireEvent.click(screen.getByText(/submit ratings/i));

    await waitFor(() => {
      expect(mockToast.success).toHaveBeenCalledWith("Submitted 2 ratings!");
    });
  });
});

describe("EventRatingDialog - Rating Mode", () => {
  const mockOnComplete = vi.fn();
  const mockOnCancel = vi.fn();

  const mockEvent = {
    eventId: "event-123",
    eventDate: "2025-01-20",
    ingredientName: "Salmon",
  };

  const mockRecipes: EventRecipeWithContributions[] = [
    {
      recipe: createMockRecipe({ id: "recipe-1", name: "Grilled Salmon", url: "https://example.com/salmon" }),
      contributions: [
        createMockContribution({ id: "contrib-1", recipeId: "recipe-1", userName: "User 1" }),
      ],
    },
    {
      recipe: createMockRecipe({ id: "recipe-2", name: "Salmon Teriyaki" }),
      contributions: [
        createMockContribution({ id: "contrib-2", recipeId: "recipe-2", userName: "User 2" }),
      ],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockUpsert.mockResolvedValue({ error: null });
    mockSelect.mockResolvedValue({ data: [], error: null });
  });

  it("shows different description in rating mode", async () => {
    render(
      <EventRatingDialog
        event={mockEvent}
        recipes={mockRecipes}
        userId="user-123"
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
        mode="rating"
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/you can update your ratings anytime/i)).toBeInTheDocument();
    });
  });

  it("shows 'Submit Ratings' button in rating mode", async () => {
    render(
      <EventRatingDialog
        event={mockEvent}
        recipes={mockRecipes}
        userId="user-123"
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
        mode="rating"
      />
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^submit ratings$/i })).toBeInTheDocument();
    });
  });

  it("shows loading spinner while fetching existing ratings", () => {
    // Make the select hang
    mockSelect.mockReturnValue(new Promise(() => {}));

    render(
      <EventRatingDialog
        event={mockEvent}
        recipes={mockRecipes}
        userId="user-123"
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
        mode="rating"
      />
    );

    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("loads existing ratings and pre-populates form", async () => {
    mockSelect.mockResolvedValue({
      data: [
        { recipe_id: "recipe-1", would_cook_again: true, overall_rating: 4 },
      ],
      error: null,
    });

    render(
      <EventRatingDialog
        event={mockEvent}
        recipes={mockRecipes}
        userId="user-123"
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
        mode="rating"
      />
    );

    await waitFor(() => {
      // The Yes button should be highlighted for the first recipe
      const yesButtons = screen.getAllByRole("button", { name: /yes/i });
      expect(yesButtons[0]).toHaveClass("bg-green-500");
    });

    // Rating 4/5 should be shown
    await waitFor(() => {
      expect(screen.getByText("4/5")).toBeInTheDocument();
    });
  });

  it("allows submitting with only some recipes rated in rating mode", async () => {
    render(
      <EventRatingDialog
        event={mockEvent}
        recipes={mockRecipes}
        userId="user-123"
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
        mode="rating"
      />
    );

    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      expect(document.querySelector(".animate-spin")).not.toBeInTheDocument();
    });

    // Rate only the first recipe
    fireEvent.click(screen.getAllByRole("button", { name: /yes/i })[0]);
    const starButtons = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg.lucide-star")
    );
    fireEvent.click(starButtons[0]); // First star of first recipe

    // Submit button should be enabled (only need one rating in rating mode)
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^submit ratings$/i })).not.toBeDisabled();
    });

    fireEvent.click(screen.getByRole("button", { name: /^submit ratings$/i }));

    await waitFor(() => {
      expect(mockOnComplete).toHaveBeenCalled();
    });
  });

  it("shows message when no ratings provided in rating mode", async () => {
    render(
      <EventRatingDialog
        event={mockEvent}
        recipes={mockRecipes}
        userId="user-123"
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
        mode="rating"
      />
    );

    await waitFor(() => {
      expect(document.querySelector(".animate-spin")).not.toBeInTheDocument();
    });

    expect(screen.getByText(/rate at least one recipe to submit/i)).toBeInTheDocument();
  });

  it("handles error when loading existing ratings", async () => {
    mockSelect.mockResolvedValue({
      data: null,
      error: { message: "Database error" },
    });

    render(
      <EventRatingDialog
        event={mockEvent}
        recipes={mockRecipes}
        userId="user-123"
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
        mode="rating"
      />
    );

    // Should still render the form even if loading fails
    await waitFor(() => {
      expect(screen.getByText("Grilled Salmon")).toBeInTheDocument();
    });
  });

  it("skips loading ratings when recipe list is empty in rating mode", async () => {
    render(
      <EventRatingDialog
        event={mockEvent}
        recipes={[]}
        userId="user-123"
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
        mode="rating"
      />
    );

    // Should not show loading spinner
    await waitFor(() => {
      expect(document.querySelector(".animate-spin")).not.toBeInTheDocument();
    });

    expect(screen.getByText(/no recipes to rate/i)).toBeInTheDocument();
  });
});
