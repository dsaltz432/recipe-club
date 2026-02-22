import { describe, it, expect } from "vitest";
import { render, screen } from "@tests/utils";
import NotFound from "@/pages/NotFound";

describe("NotFound", () => {
  it("renders 404 heading", () => {
    render(<NotFound />);
    expect(screen.getByText("404")).toBeInTheDocument();
  });

  it("renders helpful message", () => {
    render(<NotFound />);
    expect(screen.getByText("Oops! This page doesn't exist.")).toBeInTheDocument();
  });

  it("renders Go Home link", () => {
    render(<NotFound />);
    const link = screen.getByRole("link", { name: /go home/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/");
  });
});
