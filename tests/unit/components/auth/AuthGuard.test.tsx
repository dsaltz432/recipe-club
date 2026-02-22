import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@tests/utils";
import AuthGuard from "@/components/auth/AuthGuard";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockIsAuthenticated = vi.fn();
vi.mock("@/lib/auth", () => ({
  isAuthenticated: () => mockIsAuthenticated(),
}));

describe("AuthGuard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading spinner while checking auth", () => {
    mockIsAuthenticated.mockReturnValue(new Promise(() => {})); // Never resolves
    const { container } = render(
      <AuthGuard>
        <div>Protected Content</div>
      </AuthGuard>
    );
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
  });

  it("redirects to / when not authenticated", async () => {
    mockIsAuthenticated.mockResolvedValue(false);
    render(
      <AuthGuard>
        <div>Protected Content</div>
      </AuthGuard>
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/");
    });

    // After redirect, children should not render
    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
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
});
