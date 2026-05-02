import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@tests/utils";
import ErrorBoundary from "@/components/shared/ErrorBoundary";

// A component that can be toggled to throw
const BrokenChild = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) throw new Error("Test render error");
  return <div>Content loaded fine</div>;
};

// Suppress console.error noise from React's error boundary machinery
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  consoleErrorSpy.mockRestore();
});

describe("ErrorBoundary", () => {
  it("renders children normally when there is no error", () => {
    render(
      <ErrorBoundary>
        <BrokenChild shouldThrow={false} />
      </ErrorBoundary>
    );
    expect(screen.getByText("Content loaded fine")).toBeInTheDocument();
  });

  it("renders the fallback UI when a child throws", () => {
    render(
      <ErrorBoundary>
        <BrokenChild shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText(/unexpected error/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reload page/i })).toBeInTheDocument();
  });

  it("shows the section name in the fallback heading when provided", () => {
    render(
      <ErrorBoundary section="Recipes">
        <BrokenChild shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(screen.getByText("Recipes failed to load")).toBeInTheDocument();
  });

  it("logs the error to console", () => {
    render(
      <ErrorBoundary>
        <BrokenChild shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it("resets and re-renders children when Try Again is clicked", () => {
    // Render with a broken child, then simulate the parent fixing the problem
    // by using a wrapper that tracks the reset cycle
    let shouldThrow = true;
    const { rerender } = render(
      <ErrorBoundary>
        <BrokenChild shouldThrow={shouldThrow} />
      </ErrorBoundary>
    );

    // Error UI should be visible
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();

    // Fix the child, then click Try Again — boundary should reset
    shouldThrow = false;
    rerender(
      <ErrorBoundary>
        <BrokenChild shouldThrow={shouldThrow} />
      </ErrorBoundary>
    );
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));

    expect(screen.getByText("Content loaded fine")).toBeInTheDocument();
  });
});
