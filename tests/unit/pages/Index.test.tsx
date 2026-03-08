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

const wheelColorsRef = vi.hoisted(() => ({
  colors: [
    "#9b87f5",
    "#F97316",
    "#4CAF50",
    "#3B82F6",
    "#EC4899",
    "#FACC15",
    "#14B8A6",
    "#EF4444",
    "#F6A000",
    "#22D3EE",
  ],
}));

vi.mock("@/lib/constants", () => ({
  get WHEEL_COLORS() {
    return wheelColorsRef.colors;
  },
}));

const DEFAULT_COLORS = [
  "#9b87f5",
  "#F97316",
  "#4CAF50",
  "#3B82F6",
  "#EC4899",
  "#FACC15",
  "#14B8A6",
  "#EF4444",
  "#F6A000",
  "#22D3EE",
];

describe("Index", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    wheelColorsRef.colors = [...DEFAULT_COLORS];
  });

  it("shows loading spinner initially", () => {
    mockIsAuthenticated.mockReturnValue(new Promise(() => {}));
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
      expect(screen.getByTestId("google-sign-in")).toBeInTheDocument();
    });

    expect(screen.getByText("Everything You Need")).toBeInTheDocument();
    expect(screen.getByText(/Share recipes, plan meals/)).toBeInTheDocument();
  });

  it("renders feature cards", async () => {
    mockIsAuthenticated.mockResolvedValue(false);
    render(<Index />);

    await waitFor(() => {
      expect(screen.getByTestId("google-sign-in")).toBeInTheDocument();
    });

    expect(screen.getByText("Meal Planning")).toBeInTheDocument();
    expect(screen.getByText("Grocery Lists")).toBeInTheDocument();
    expect(screen.getByText("Recipe Library")).toBeInTheDocument();
    expect(screen.getByText("Ratings & Notes")).toBeInTheDocument();
  });

  it("does not navigate when component unmounts before auth resolves", async () => {
    let resolveAuth!: (value: boolean) => void;
    mockIsAuthenticated.mockReturnValue(
      new Promise<boolean>((resolve) => {
        resolveAuth = resolve;
      })
    );

    const { unmount } = render(<Index />);
    unmount();

    resolveAuth(true);
    await new Promise((r) => setTimeout(r, 0));

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("renders a privacy policy link", async () => {
    mockIsAuthenticated.mockResolvedValue(false);
    render(<Index />);

    await waitFor(() => {
      expect(screen.getByTestId("google-sign-in")).toBeInTheDocument();
    });

    const link = screen.getByRole("link", { name: /privacy policy/i });
    expect(link).toHaveAttribute("href", "/privacy");
  });
});
