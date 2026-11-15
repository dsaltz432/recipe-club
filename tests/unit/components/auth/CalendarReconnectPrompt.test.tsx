import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@tests/utils";
import userEvent from "@testing-library/user-event";

const { mockGetUser, mockGetAllowedUser, mockSignInWithGoogle, mockCheck, mockIsDevMode } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockGetAllowedUser: vi.fn(),
  mockSignInWithGoogle: vi.fn(),
  mockCheck: vi.fn(),
  mockIsDevMode: vi.fn(() => false),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getUser: (...a: unknown[]) => mockGetUser(...a) } },
}));

vi.mock("@/lib/auth", () => ({
  getAllowedUser: (...a: unknown[]) => mockGetAllowedUser(...a),
  isMemberOrAdmin: (u: { role?: string } | null) => u?.role === "member" || u?.role === "admin",
  signInWithGoogle: (...a: unknown[]) => mockSignInWithGoogle(...a),
}));

vi.mock("@/lib/devMode", () => ({ isDevMode: () => mockIsDevMode() }));

vi.mock("@/lib/googleCalendar", () => ({
  CALENDAR_RECONNECT_EVENT: "google-calendar-reconnect",
  checkCalendarConnection: (...a: unknown[]) => mockCheck(...a),
}));

import CalendarReconnectPrompt, {
  CHECKED_KEY,
  DISMISSED_KEY,
} from "@/components/auth/CalendarReconnectPrompt";

const googleMember = {
  data: {
    user: { email: "hannah@example.com", app_metadata: { provider: "google", providers: ["google"] } },
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  mockIsDevMode.mockReturnValue(false);
  mockGetUser.mockResolvedValue(googleMember);
  mockGetAllowedUser.mockResolvedValue({ role: "member" });
  mockSignInWithGoogle.mockResolvedValue(undefined);
});

describe("CalendarReconnectPrompt", () => {
  it("asks a member to reconnect when their Google connection is disconnected", async () => {
    mockCheck.mockResolvedValue({ status: "disconnected", needsReconnect: true });

    render(<CalendarReconnectPrompt />);

    expect(await screen.findByText("Reconnect Google Calendar")).toBeInTheDocument();
    expect(screen.getByText(/connection has expired/)).toBeInTheDocument();
    expect(sessionStorage.getItem(CHECKED_KEY)).toBe("1");
  });

  it("explains missing calendar permission differently", async () => {
    mockCheck.mockResolvedValue({ status: "missing_scope", needsReconnect: true });

    render(<CalendarReconnectPrompt />);

    expect(await screen.findByText(/doesn't have permission/)).toBeInTheDocument();
  });

  it("stays hidden when the connection works", async () => {
    mockCheck.mockResolvedValue({ status: "connected", needsReconnect: false });

    render(<CalendarReconnectPrompt />);

    await waitFor(() => expect(mockCheck).toHaveBeenCalled());
    expect(screen.queryByText("Reconnect Google Calendar")).not.toBeInTheDocument();
  });

  it("only checks once per browser session", async () => {
    sessionStorage.setItem(CHECKED_KEY, "1");

    render(<CalendarReconnectPrompt />);

    await new Promise((r) => setTimeout(r, 0));
    expect(mockCheck).not.toHaveBeenCalled();
  });

  it("re-checks right after a new token is saved, even if already checked", async () => {
    sessionStorage.setItem(CHECKED_KEY, "1");
    mockCheck.mockResolvedValue({ status: "connected", needsReconnect: false });

    render(<CalendarReconnectPrompt tokenSavedAt={123} />);

    await waitFor(() => expect(mockCheck).toHaveBeenCalledTimes(1));
  });

  it("skips non-members and email sign-ins", async () => {
    mockGetAllowedUser.mockResolvedValue({ role: "viewer" });
    const { unmount } = render(<CalendarReconnectPrompt />);
    await waitFor(() => expect(mockGetAllowedUser).toHaveBeenCalled());
    expect(mockCheck).not.toHaveBeenCalled();
    unmount();

    mockGetUser.mockResolvedValue({
      data: { user: { email: "member@example.com", app_metadata: { provider: "email", providers: ["email"] } } },
    });
    render(<CalendarReconnectPrompt />);
    await new Promise((r) => setTimeout(r, 0));
    expect(mockCheck).not.toHaveBeenCalled();
  });

  it("does not mark the session checked on transient errors", async () => {
    mockCheck.mockResolvedValue({ status: "error", needsReconnect: false });

    render(<CalendarReconnectPrompt />);

    await waitFor(() => expect(mockCheck).toHaveBeenCalled());
    expect(sessionStorage.getItem(CHECKED_KEY)).toBeNull();
    expect(screen.queryByText("Reconnect Google Calendar")).not.toBeInTheDocument();
  });

  it("Reconnect sends the user through Google consent and back to this page", async () => {
    mockCheck.mockResolvedValue({ status: "disconnected", needsReconnect: true });
    const user = userEvent.setup();

    render(<CalendarReconnectPrompt />);
    await user.click(await screen.findByRole("button", { name: "Reconnect" }));

    expect(mockSignInWithGoogle).toHaveBeenCalledWith(true, window.location.href);
  });

  it("Not now hides the prompt for the rest of the session", async () => {
    mockCheck.mockResolvedValue({ status: "disconnected", needsReconnect: true });
    const user = userEvent.setup();

    render(<CalendarReconnectPrompt />);
    await user.click(await screen.findByRole("button", { name: "Not now" }));

    await waitFor(() =>
      expect(screen.queryByText("Reconnect Google Calendar")).not.toBeInTheDocument()
    );
    expect(sessionStorage.getItem(DISMISSED_KEY)).toBe("1");
  });

  it("opens when an invite fails, even after being dismissed", async () => {
    sessionStorage.setItem(CHECKED_KEY, "1");
    sessionStorage.setItem(DISMISSED_KEY, "1");

    render(<CalendarReconnectPrompt />);
    act(() => {
      window.dispatchEvent(new CustomEvent("google-calendar-reconnect"));
    });

    expect(await screen.findByText("Reconnect Google Calendar")).toBeInTheDocument();
  });
});
