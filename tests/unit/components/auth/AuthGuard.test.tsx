import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@tests/utils";

const { mockIsAuthenticated, mockNavigate, mockToast, mockOnAuthStateChange, mockUpsert, mockFrom } = vi.hoisted(() => {
  const mockUnsubscribe = vi.fn();
  return {
    mockIsAuthenticated: vi.fn(),
    mockNavigate: vi.fn(),
    mockToast: {
      error: vi.fn(),
      info: vi.fn(),
      success: vi.fn(),
      warning: vi.fn(),
    },
    mockOnAuthStateChange: vi.fn().mockReturnValue({
      data: { subscription: { unsubscribe: mockUnsubscribe } },
    }),
    mockUpsert: vi.fn().mockResolvedValue({ error: null }),
    mockFrom: vi.fn(),
  };
});

vi.mock("@/lib/auth", () => ({
  isAuthenticated: (...args: unknown[]) => mockIsAuthenticated(...args),
}));

vi.mock("sonner", () => ({
  toast: mockToast,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      onAuthStateChange: (...args: unknown[]) => mockOnAuthStateChange(...args),
    },
    from: (...args: unknown[]) => mockFrom(...args),
  },
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
  mockFrom.mockReturnValue({ upsert: mockUpsert });
});

describe("AuthGuard", () => {
  it("shows loading spinner while checking auth", () => {
    // onAuthStateChange never calls callback → stays loading
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });

    render(
      <AuthGuard>
        <div>Protected Content</div>
      </AuthGuard>
    );

    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("renders children when authenticated", async () => {
    mockOnAuthStateChange.mockImplementation((callback: (event: string, session: unknown) => void) => {
      // Immediately invoke callback with a valid session
      callback("INITIAL_SESSION", { user: { id: "user-123" } });
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });

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
    mockOnAuthStateChange.mockImplementation((callback: (event: string, session: unknown) => void) => {
      // Immediately invoke callback with no session (INITIAL_SESSION + null)
      callback("INITIAL_SESSION", null);
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });

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
    let triggerCallback: ((event: string, session: unknown) => void) | null = null;
    mockOnAuthStateChange.mockImplementation((callback: (event: string, session: unknown) => void) => {
      triggerCallback = callback;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });

    const { unmount } = render(
      <AuthGuard>
        <div>Protected Content</div>
      </AuthGuard>
    );

    // Unmount before auth state resolves
    unmount();

    // Trigger callback after unmount — should not cause state updates
    triggerCallback!("INITIAL_SESSION", { user: { id: "user-123" } });

    // Give it a tick to process
    await new Promise((resolve) => setTimeout(resolve, 0));

    // No navigation should have occurred since component was unmounted
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("renders null when not authed and checking complete", async () => {
    mockOnAuthStateChange.mockImplementation((callback: (event: string, session: unknown) => void) => {
      callback("SIGNED_OUT", null);
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });

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

  it("registers onAuthStateChange listener for refresh token capture", () => {
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });

    render(
      <AuthGuard>
        <div>Protected Content</div>
      </AuthGuard>
    );

    expect(mockOnAuthStateChange).toHaveBeenCalled();
  });

  it("upserts refresh token on SIGNED_IN event with provider_refresh_token", async () => {
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });

    render(
      <AuthGuard>
        <div>Protected Content</div>
      </AuthGuard>
    );

    // Get the callback passed to onAuthStateChange
    const callback = mockOnAuthStateChange.mock.calls[0][0];

    // Simulate SIGNED_IN event with provider_refresh_token
    await callback("SIGNED_IN", {
      user: { id: "user-123" },
      provider_refresh_token: "mock-refresh-token",
    });

    expect(mockFrom).toHaveBeenCalledWith("user_tokens");
    expect(mockUpsert).toHaveBeenCalledWith(
      {
        user_id: "user-123",
        provider: "google",
        refresh_token: "mock-refresh-token",
        updated_at: expect.any(String),
      },
      { onConflict: "user_id,provider" }
    );
  });

  it("does not upsert when SIGNED_IN event has no provider_refresh_token", async () => {
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });

    render(
      <AuthGuard>
        <div>Protected Content</div>
      </AuthGuard>
    );

    const callback = mockOnAuthStateChange.mock.calls[0][0];
    await callback("SIGNED_IN", {
      user: { id: "user-123" },
      provider_refresh_token: null,
    });

    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("does not upsert on non-SIGNED_IN events", async () => {
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });

    render(
      <AuthGuard>
        <div>Protected Content</div>
      </AuthGuard>
    );

    // Get the callback passed to onAuthStateChange
    const callback = mockOnAuthStateChange.mock.calls[0][0];

    // Simulate TOKEN_REFRESHED event
    await callback("TOKEN_REFRESHED", {
      user: { id: "user-123" },
      provider_refresh_token: "mock-refresh-token",
    });

    expect(mockUpsert).not.toHaveBeenCalled();
  });
});
