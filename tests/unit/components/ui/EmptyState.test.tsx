import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@tests/utils";
import EmptyState from "@/components/ui/empty-state";
import { BookOpen, Plus, CalendarDays } from "lucide-react";

describe("EmptyState", () => {
  it("renders the title", () => {
    render(<EmptyState icon={BookOpen} title="No recipes yet" />);
    expect(screen.getByText("No recipes yet")).toBeInTheDocument();
  });

  it("renders the description when provided", () => {
    render(
      <EmptyState
        icon={BookOpen}
        title="No recipes yet"
        description="Add your first recipe to get started."
      />
    );
    expect(screen.getByText("Add your first recipe to get started.")).toBeInTheDocument();
  });

  it("does not render a description element when not provided", () => {
    render(<EmptyState icon={BookOpen} title="No recipes yet" />);
    expect(screen.queryByText(/get started/i)).not.toBeInTheDocument();
  });

  it("renders an action button when action is provided", () => {
    const handleClick = vi.fn();
    render(
      <EmptyState
        icon={CalendarDays}
        title="No events yet"
        action={{ label: "Create Event", onClick: handleClick }}
      />
    );
    expect(screen.getByRole("button", { name: "Create Event" })).toBeInTheDocument();
  });

  it("does not render an action button when action is not provided", () => {
    render(<EmptyState icon={BookOpen} title="No recipes yet" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("calls onClick when the action button is clicked", () => {
    const handleClick = vi.fn();
    render(
      <EmptyState
        icon={BookOpen}
        title="No recipes yet"
        action={{ label: "Add Recipe", onClick: handleClick, icon: Plus }}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /add recipe/i }));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("applies custom className to the card", () => {
    const { container } = render(
      <EmptyState icon={BookOpen} title="No recipes yet" className="custom-class" />
    );
    expect(container.firstChild).toHaveClass("custom-class");
  });
});
