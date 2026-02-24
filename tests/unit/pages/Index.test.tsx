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

  it("renders largeArc=1 when a single segment spans more than 180 degrees", async () => {
    wheelColorsRef.colors = ["#FF0000"];
    mockIsAuthenticated.mockResolvedValue(false);

    const { container } = render(<Index />);

    await waitFor(() => {
      expect(screen.getByText("Recipe Club Hub")).toBeInTheDocument();
    });

    const paths = container.querySelectorAll("path");
    expect(paths.length).toBe(1);
    const d = paths[0].getAttribute("d");
    expect(d).toContain(" 1 1 ");
  });
});
