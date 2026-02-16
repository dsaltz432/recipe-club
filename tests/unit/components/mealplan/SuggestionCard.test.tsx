import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@tests/utils";
import SuggestionCard from "@/components/mealplan/SuggestionCard";
import type { MealSuggestion } from "@/types";

describe("SuggestionCard", () => {
  const mockSuggestion: MealSuggestion = {
    id: "sug-1",
    name: "Mediterranean Quinoa Bowl",
    cuisine: "Mediterranean",
    timeEstimate: "25 min",
    reason: "Quick, healthy, and fits your preferences.",
  };

  const defaultProps = {
    suggestion: mockSuggestion,
    onAddToPlan: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders suggestion name", () => {
    render(<SuggestionCard {...defaultProps} />);

    expect(screen.getByText("Mediterranean Quinoa Bowl")).toBeInTheDocument();
  });

  it("renders cuisine badge", () => {
    render(<SuggestionCard {...defaultProps} />);

    expect(screen.getByText("Mediterranean")).toBeInTheDocument();
  });

  it("renders time estimate", () => {
    render(<SuggestionCard {...defaultProps} />);

    expect(screen.getByText("25 min")).toBeInTheDocument();
  });

  it("renders reason", () => {
    render(<SuggestionCard {...defaultProps} />);

    expect(screen.getByText("Quick, healthy, and fits your preferences.")).toBeInTheDocument();
  });

  it("calls onAddToPlan when Add to Plan is clicked", () => {
    render(<SuggestionCard {...defaultProps} />);

    fireEvent.click(screen.getByText("Add to Plan"));

    expect(defaultProps.onAddToPlan).toHaveBeenCalledWith(mockSuggestion);
  });

  it("shows link when suggestion has URL", () => {
    const suggestionWithUrl: MealSuggestion = {
      ...mockSuggestion,
      url: "https://example.com/recipe",
    };

    render(<SuggestionCard {...defaultProps} suggestion={suggestionWithUrl} />);

    const link = document.querySelector('a[href="https://example.com/recipe"]');
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("does not show link when suggestion has no URL", () => {
    render(<SuggestionCard {...defaultProps} />);

    const links = document.querySelectorAll("a[target='_blank']");
    expect(links.length).toBe(0);
  });
});
