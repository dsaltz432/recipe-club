import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@tests/utils";

const {
  mockSignInWithGoogle,
  mockSignInWithEmail,
  mockNavigate,
  mockToast,
} = vi.hoisted(() => ({
  mockSignInWithGoogle: vi.fn(),
  mockSignInWithEmail: vi.fn(),
  mockNavigate: vi.fn(),
  mockToast: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock("@/lib/auth", () => ({
  signInWithGoogle: (...args: unknown[]) => mockSignInWithGoogle(...args),
  signInWithEmail: (...args: unknown[]) => mockSignInWithEmail(...args),
}));

vi.mock("@/lib/devMode", () => ({
  isDevMode: vi.fn(),
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

import GoogleSignIn from "@/components/auth/GoogleSignIn";
import { isDevMode } from "@/lib/devMode";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(isDevMode).mockReturnValue(false);
});

describe("GoogleSignIn - Production mode (Google OAuth)", () => {
  it("renders Google sign-in button", () => {
    render(<GoogleSignIn />);
    expect(screen.getByText("Sign in with Google")).toBeInTheDocument();
  });

  it("calls signInWithGoogle on click", async () => {
    mockSignInWithGoogle.mockResolvedValue(undefined);
    render(<GoogleSignIn />);

    fireEvent.click(screen.getByText("Sign in with Google"));

    await waitFor(() => {
      expect(mockSignInWithGoogle).toHaveBeenCalled();
    });
  });

  it("shows 'Signing in...' while loading", async () => {
    let resolveSignIn: () => void;
    mockSignInWithGoogle.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveSignIn = resolve;
      })
    );

    render(<GoogleSignIn />);
    fireEvent.click(screen.getByText("Sign in with Google"));

    await waitFor(() => {
      expect(screen.getByText("Signing in...")).toBeInTheDocument();
    });

    expect(screen.getByRole("button")).toBeDisabled();

    resolveSignIn!();
  });

  it("shows toast.error and resets loading on Google sign-in failure", async () => {
    const consoleSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    mockSignInWithGoogle.mockRejectedValue(new Error("OAuth error"));

    render(<GoogleSignIn />);
    fireEvent.click(screen.getByText("Sign in with Google"));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith(
        "Sign in failed. Please try again."
      );
    });

    expect(screen.getByRole("button")).not.toBeDisabled();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

describe("GoogleSignIn - Dev mode (email auth)", () => {
  beforeEach(() => {
    vi.mocked(isDevMode).mockReturnValue(true);
  });

  it("renders email form in dev mode", () => {
    render(<GoogleSignIn />);
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByText("Sign in (Dev Mode)")).toBeInTheDocument();
  });

  it("has 'Password' placeholder on password field", () => {
    render(<GoogleSignIn />);
    expect(screen.getByPlaceholderText("Password")).toBeInTheDocument();
  });

  it("has 'dev@example.com' placeholder on email field", () => {
    render(<GoogleSignIn />);
    expect(
      screen.getByPlaceholderText("dev@example.com")
    ).toBeInTheDocument();
  });

  it("updates email input value", () => {
    render(<GoogleSignIn />);
    const emailInput = screen.getByLabelText("Email");
    fireEvent.change(emailInput, { target: { value: "test@test.com" } });
    expect(emailInput).toHaveValue("test@test.com");
  });

  it("updates password input value", () => {
    render(<GoogleSignIn />);
    const passwordInput = screen.getByLabelText("Password");
    fireEvent.change(passwordInput, { target: { value: "mypassword" } });
    expect(passwordInput).toHaveValue("mypassword");
  });

  it("disables button when email is empty", () => {
    render(<GoogleSignIn />);
    const passwordInput = screen.getByLabelText("Password");
    fireEvent.change(passwordInput, { target: { value: "password" } });
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("disables button when password is empty", () => {
    render(<GoogleSignIn />);
    const emailInput = screen.getByLabelText("Email");
    fireEvent.change(emailInput, { target: { value: "test@test.com" } });
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("enables button when both email and password are provided", () => {
    render(<GoogleSignIn />);
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "test@test.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password" },
    });
    expect(screen.getByRole("button")).not.toBeDisabled();
  });

  it("navigates to /dashboard on successful email sign-in", async () => {
    mockSignInWithEmail.mockResolvedValue(undefined);
    render(<GoogleSignIn />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "dev@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByText("Sign in (Dev Mode)"));

    await waitFor(() => {
      expect(mockSignInWithEmail).toHaveBeenCalledWith(
        "dev@example.com",
        "password123"
      );
      expect(mockNavigate).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("shows 'Signing in...' while email sign-in is loading", async () => {
    let resolveSignIn: () => void;
    mockSignInWithEmail.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveSignIn = resolve;
      })
    );

    render(<GoogleSignIn />);
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "dev@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "pass" },
    });
    fireEvent.click(screen.getByText("Sign in (Dev Mode)"));

    await waitFor(() => {
      expect(screen.getByText("Signing in...")).toBeInTheDocument();
    });

    expect(screen.getByRole("button")).toBeDisabled();
    resolveSignIn!();
  });

  it("shows toast.error and resets loading on email sign-in failure", async () => {
    const consoleSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    mockSignInWithEmail.mockRejectedValue(new Error("Auth error"));

    render(<GoogleSignIn />);
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "dev@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByText("Sign in (Dev Mode)"));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith(
        "Sign in failed. Please try again."
      );
    });

    expect(screen.getByRole("button")).not.toBeDisabled();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("does not call signInWithEmail when email is empty", () => {
    render(<GoogleSignIn />);
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password" },
    });
    expect(mockSignInWithEmail).not.toHaveBeenCalled();
  });

  it("does not call signInWithEmail when password is empty", () => {
    render(<GoogleSignIn />);
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "test@test.com" },
    });
    expect(mockSignInWithEmail).not.toHaveBeenCalled();
  });
});
