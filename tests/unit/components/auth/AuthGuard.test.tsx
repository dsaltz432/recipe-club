import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@tests/utils";

const { mockIsAuthenticated, mockNavigate, mockToast } = vi.hoisted(() => ({
  mockIsAuthenticated: vi.fn(),
  mockNavigate: vi.fn(),
  mockToast: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock("@/lib/auth", () => ({
  isAuthenticated: (...args: unknown[]) => mockIsAuthenticated(...args),
}));

vi.mock("sonner", () => ({
  toast: mockToast,
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

import AuthGuard from "@/components/auth/AuthGuard";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AuthGuard", () => {
  it("shows loading spinner while checking auth", () => {
    mockIsAuthenticated.mockReturnValue(new Promise(() => {}));

    render(
      <AuthGuard>
        <div>Protected Content</div>
      </AuthGuard>
    );

    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("renders children when authenticated", async () => {
    mockIsAuthenticated.mockResolvedValue(true);

    render(
      <AuthGuard>
        <div>Protected Content</div>
      </AuthGuard>
    );

    await waitFor(() => {
      expect(screen.getByText("Protected Content")).toBeInTheDocument();
    });
  });

  it("shows toast and navigates to / when not authenticated", async () => {
    mockIsAuthenticated.mockResolvedValue(false);

    render(
      <AuthGuard>
        <div>Protected Content</div>
      </AuthGuard>
    );

    await waitFor(() => {
      expect(mockToast.info).toHaveBeenCalledWith(
        "Your session has expired. Please sign in again."
      );
      expect(mockNavigate).toHaveBeenCalledWith("/");
    });

    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
  });

  it("does not update state after unmount (mounted flag)", async () => {
    let resolveAuth: (value: boolean) => void;
    mockIsAuthenticated.mockReturnValue(
      new Promise<boolean>((resolve) => {
        resolveAuth = resolve;
      })
    );

    const { unmount } = render(
      <AuthGuard>
        <div>Protected Content</div>
      </AuthGuard>
    );

    // Unmount before auth resolves
    unmount();

    // Resolve auth after unmount — should not cause state updates
    resolveAuth!(true);

    // Give it a tick to process
    await new Promise((resolve) => setTimeout(resolve, 0));

    // No navigation should have occurred since component was unmounted
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("renders null when not authed and checking complete", async () => {
    mockIsAuthenticated.mockResolvedValue(false);

    render(
      <AuthGuard>
        <div>Protected Content</div>
      </AuthGuard>
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/");
    });

    // After checking completes with !authenticated, renders null (not spinner, not children)
    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
    expect(document.querySelector(".animate-spin")).not.toBeInTheDocument();
  });
});
