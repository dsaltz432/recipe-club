import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@tests/utils";

const { mockIsAuthenticated, mockNavigate, mockToast, mockOnAuthStateChange, mockUpsert, mockFrom, mockSignInWithGoogle } = vi.hoisted(() => {
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
    mockSignInWithGoogle: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock("@/lib/auth", () => ({
  isAuthenticated: (...args: unknown[]) => mockIsAuthenticated(...args),
  signInWithGoogle: (...args: unknown[]) => mockSignInWithGoogle(...args),
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

/** Build a mockFrom return value that supports the select().eq().eq().maybeSingle() chain. */
function makeSelectChain(maybeSingleResult: { data: unknown }) {
  const mockMaybySingle = vi.fn().mockResolvedValue(maybeSingleResult);
  const mockEq = vi.fn();
  mockEq.mockReturnValue({ eq: mockEq, maybeSingle: mockMaybySingle });
  const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
  return { select: mockSelect, upsert: mockUpsert };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFrom.mockReturnValue({ upsert: mockUpsert });
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

  it("registers onAuthStateChange listener for refresh token capture", () => {
    mockIsAuthenticated.mockReturnValue(new Promise(() => {}));

    render(
      <AuthGuard>
        <div>Protected Content</div>
      </AuthGuard>
    );

    expect(mockOnAuthStateChange).toHaveBeenCalled();
  });

  it("upserts refresh token on SIGNED_IN event with provider_refresh_token", async () => {
    mockIsAuthenticated.mockResolvedValue(true);

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

  it("does not upsert or re-consent when SIGNED_IN without refresh token but token already stored", async () => {
    mockIsAuthenticated.mockResolvedValue(true);
    mockFrom.mockReturnValue(makeSelectChain({ data: { user_id: "user-123" } }));

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
    expect(mockSignInWithGoogle).not.toHaveBeenCalled();
  });

  it("calls signInWithGoogle(true) when SIGNED_IN without refresh token and no stored token", async () => {
    mockIsAuthenticated.mockResolvedValue(true);
    mockFrom.mockReturnValue(makeSelectChain({ data: null }));

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
    expect(mockSignInWithGoogle).toHaveBeenCalledWith(true);
  });

  it("does not check user_tokens when SIGNED_IN with null session", async () => {
    mockIsAuthenticated.mockResolvedValue(true);

    render(
      <AuthGuard>
        <div>Protected Content</div>
      </AuthGuard>
    );

    const callback = mockOnAuthStateChange.mock.calls[0][0];
    await callback("SIGNED_IN", null);

    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockSignInWithGoogle).not.toHaveBeenCalled();
  });

  it("does not upsert on non-SIGNED_IN events", async () => {
    mockIsAuthenticated.mockResolvedValue(true);

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
