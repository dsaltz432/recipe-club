import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@tests/utils";
import Index from "@/pages/Index";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockIsAuthenticated = vi.fn();
vi.mock("@/lib/auth", () => ({
  isAuthenticated: () => mockIsAuthenticated(),
}));

vi.mock("@/components/auth/GoogleSignIn", () => ({
  default: () => <div data-testid="google-sign-in">GoogleSignIn</div>,
}));

describe("Index", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading spinner initially", () => {
    mockIsAuthenticated.mockReturnValue(new Promise(() => {})); // Never resolves
    const { container } = render(<Index />);
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("redirects authenticated users to dashboard", async () => {
    mockIsAuthenticated.mockResolvedValue(true);
    render(<Index />);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("shows landing page for unauthenticated users", async () => {
    mockIsAuthenticated.mockResolvedValue(false);
    render(<Index />);

    await waitFor(() => {
      expect(screen.getByText("Recipe Club Hub")).toBeInTheDocument();
    });

    expect(screen.getByText(/Spin the wheel/)).toBeInTheDocument();
    expect(screen.getByText("How It Works")).toBeInTheDocument();
    expect(screen.getByTestId("google-sign-in")).toBeInTheDocument();
  });

  it("renders wheel SVG and step cards", async () => {
    mockIsAuthenticated.mockResolvedValue(false);
    render(<Index />);

    await waitFor(() => {
      expect(screen.getByText("Recipe Club Hub")).toBeInTheDocument();
    });

    expect(screen.getByText("Spin the Wheel")).toBeInTheDocument();
    expect(screen.getByText("Pick a Date")).toBeInTheDocument();
    expect(screen.getByText("Lock In Your Recipe")).toBeInTheDocument();
  });
});
