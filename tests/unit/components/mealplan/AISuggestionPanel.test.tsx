import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@tests/utils";
import AISuggestionPanel from "@/components/mealplan/AISuggestionPanel";
import type { MealSuggestion } from "@/types";

describe("AISuggestionPanel", () => {
  const mockSuggestions: MealSuggestion[] = [
    {
      id: "sug-1",
      name: "Mediterranean Quinoa Bowl",
      cuisine: "Mediterranean",
      timeEstimate: "25 min",
      reason: "Quick and healthy.",
    },
    {
      id: "sug-2",
      name: "Honey Garlic Salmon",
      cuisine: "Asian Fusion",
      timeEstimate: "30 min",
      reason: "Easy to prepare.",
    },
  ];

  const defaultProps = {
    suggestions: mockSuggestions,
    onAddToPlan: vi.fn(),
    isLoading: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders AI Suggestions header", () => {
    render(<AISuggestionPanel {...defaultProps} />);

    expect(screen.getByText("AI Suggestions")).toBeInTheDocument();
  });

  it("renders suggestion cards", () => {
    render(<AISuggestionPanel {...defaultProps} />);

    expect(screen.getByText("Mediterranean Quinoa Bowl")).toBeInTheDocument();
    expect(screen.getByText("Honey Garlic Salmon")).toBeInTheDocument();
  });

  it("shows loading spinner when loading", () => {
    render(<AISuggestionPanel {...defaultProps} isLoading={true} />);

    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("shows empty state when no suggestions", () => {
    render(<AISuggestionPanel {...defaultProps} suggestions={[]} />);

    expect(screen.getByText(/get suggestions/i)).toBeInTheDocument();
  });

  it("passes onAddToPlan to suggestion cards", () => {
    render(<AISuggestionPanel {...defaultProps} />);

    // Click Add to Plan on first suggestion
    const addButtons = screen.getAllByText("Add to Plan");
    fireEvent.click(addButtons[0]);

    expect(defaultProps.onAddToPlan).toHaveBeenCalledWith(mockSuggestions[0]);
  });
});
