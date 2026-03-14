import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@tests/utils";
import CookModeComplete from "@/components/cookmode/CookModeComplete";

// Mock canvas-confetti to prevent actual canvas/animation-frame usage in jsdom
vi.mock("canvas-confetti", () => ({ default: vi.fn().mockResolvedValue(undefined) }));

describe("CookModeComplete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the success message", () => {
    render(
      <CookModeComplete
        recipeNames={new Map([["r1", "Pasta"]])}
        onClose={() => {}}
      />
    );
    expect(screen.getByText("You did it!")).toBeInTheDocument();
    expect(screen.getByText("Pasta")).toBeInTheDocument();
  });

  it("calls onClose when Close button clicked", () => {
    const onClose = vi.fn();
    render(
      <CookModeComplete
        recipeNames={new Map()}
        onClose={onClose}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /close cook mode/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("shows Rate button when onRate is provided", () => {
    const onRate = vi.fn();
    render(
      <CookModeComplete
        recipeNames={new Map([["r1", "Pasta"]])}
        onRate={onRate}
        onClose={() => {}}
      />
    );
    expect(screen.getByRole("button", { name: /rate this recipe/i })).toBeInTheDocument();
  });

  it("calls onRate when Rate button clicked", () => {
    const onRate = vi.fn();
    render(
      <CookModeComplete
        recipeNames={new Map([["r1", "Pasta"]])}
        onRate={onRate}
        onClose={() => {}}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /rate this recipe/i }));
    expect(onRate).toHaveBeenCalledOnce();
  });

  it("does not show Rate button when onRate is not provided", () => {
    render(
      <CookModeComplete
        recipeNames={new Map([["r1", "Pasta"]])}
        onClose={() => {}}
      />
    );
    expect(screen.queryByRole("button", { name: /rate this recipe/i })).not.toBeInTheDocument();
  });

  it("fires confetti on mount", async () => {
    const confettiModule = await import("canvas-confetti");
    const confetti = confettiModule.default as ReturnType<typeof vi.fn>;
    await act(async () => {
      render(<CookModeComplete recipeNames={new Map()} onClose={() => {}} />);
      // Flush microtasks: dynamic import resolves, then .then() callback runs
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(confetti).toHaveBeenCalled();
  });

  it("shows multiple recipe names joined", () => {
    render(
      <CookModeComplete
        recipeNames={new Map([["r1", "Pasta"], ["r2", "Salad"]])}
        onClose={() => {}}
      />
    );
    expect(screen.getByText("Pasta & Salad")).toBeInTheDocument();
  });
});
