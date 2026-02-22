import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@tests/utils";
import GoogleSignIn from "@/components/auth/GoogleSignIn";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockSignInWithGoogle = vi.fn();
const mockSignInWithEmail = vi.fn();
const mockIsDevMode = vi.fn();

vi.mock("@/lib/auth", () => ({
  signInWithGoogle: (...args: unknown[]) => mockSignInWithGoogle(...args),
  signInWithEmail: (...args: unknown[]) => mockSignInWithEmail(...args),
}));

vi.mock("@/lib/devMode", () => ({
  isDevMode: () => mockIsDevMode(),
}));

describe("GoogleSignIn", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsDevMode.mockReturnValue(false);
    mockSignInWithGoogle.mockResolvedValue(undefined);
    mockSignInWithEmail.mockResolvedValue(undefined);
  });

  describe("Production mode (Google sign-in)", () => {
    it("renders Google sign-in button", () => {
      render(<GoogleSignIn />);
      expect(screen.getByText("Sign in with Google")).toBeInTheDocument();
    });

    it("calls signInWithGoogle on click", async () => {
      render(<GoogleSignIn />);
      fireEvent.click(screen.getByText("Sign in with Google"));

      await waitFor(() => {
        expect(mockSignInWithGoogle).toHaveBeenCalled();
      });
    });

    it("shows loading state during sign-in", async () => {
      mockSignInWithGoogle.mockReturnValue(new Promise(() => {})); // Never resolves
      render(<GoogleSignIn />);

      fireEvent.click(screen.getByText("Sign in with Google"));

      await waitFor(() => {
        expect(screen.getByText("Signing in...")).toBeInTheDocument();
      });
    });

    it("handles sign-in error gracefully", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      mockSignInWithGoogle.mockRejectedValue(new Error("Auth error"));

      render(<GoogleSignIn />);
      fireEvent.click(screen.getByText("Sign in with Google"));

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalled();
      });

      // Button should be re-enabled after error
      await waitFor(() => {
        expect(screen.getByText("Sign in with Google")).not.toBeDisabled();
      });

      consoleSpy.mockRestore();
    });
  });

  describe("Dev mode (email sign-in)", () => {
    beforeEach(() => {
      mockIsDevMode.mockReturnValue(true);
    });

    it("renders email and password fields", () => {
      render(<GoogleSignIn />);
      expect(screen.getByLabelText("Email")).toBeInTheDocument();
      expect(screen.getByLabelText("Password")).toBeInTheDocument();
      expect(screen.getByText("Sign in (Dev Mode)")).toBeInTheDocument();
    });

    it("disables button when fields are empty", () => {
      render(<GoogleSignIn />);
      const button = screen.getByText("Sign in (Dev Mode)");
      expect(button).toBeDisabled();
    });

    it("enables button when both fields are filled", () => {
      render(<GoogleSignIn />);
      fireEvent.change(screen.getByLabelText("Email"), {
        target: { value: "dev@test.com" },
      });
      fireEvent.change(screen.getByLabelText("Password"), {
        target: { value: "password" },
      });
      expect(screen.getByText("Sign in (Dev Mode)")).not.toBeDisabled();
    });

    it("calls signInWithEmail and navigates on success", async () => {
      render(<GoogleSignIn />);

      fireEvent.change(screen.getByLabelText("Email"), {
        target: { value: "dev@test.com" },
      });
      fireEvent.change(screen.getByLabelText("Password"), {
        target: { value: "password" },
      });

      fireEvent.click(screen.getByText("Sign in (Dev Mode)"));

      await waitFor(() => {
        expect(mockSignInWithEmail).toHaveBeenCalledWith("dev@test.com", "password");
        expect(mockNavigate).toHaveBeenCalledWith("/dashboard");
      });
    });

    it("does not call signInWithEmail when fields are empty", () => {
      render(<GoogleSignIn />);
      // Button is disabled, but let's test the handler guard
      fireEvent.click(screen.getByText("Sign in (Dev Mode)"));
      expect(mockSignInWithEmail).not.toHaveBeenCalled();
    });

    it("does not call signInWithEmail when only email is filled", async () => {
      render(<GoogleSignIn />);
      fireEvent.change(screen.getByLabelText("Email"), {
        target: { value: "dev@test.com" },
      });
      // Password is still empty, so the guard at line 29 should fire
      const button = screen.getByText("Sign in (Dev Mode)");
      // Force-click even if disabled to exercise the handler guard
      button.removeAttribute("disabled");
      fireEvent.click(button);
      expect(mockSignInWithEmail).not.toHaveBeenCalled();
    });

    it("does not call signInWithEmail when only password is filled", async () => {
      render(<GoogleSignIn />);
      fireEvent.change(screen.getByLabelText("Password"), {
        target: { value: "password" },
      });
      const button = screen.getByText("Sign in (Dev Mode)");
      button.removeAttribute("disabled");
      fireEvent.click(button);
      expect(mockSignInWithEmail).not.toHaveBeenCalled();
    });

    it("handles email sign-in error gracefully", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      mockSignInWithEmail.mockRejectedValue(new Error("Auth error"));

      render(<GoogleSignIn />);

      fireEvent.change(screen.getByLabelText("Email"), {
        target: { value: "dev@test.com" },
      });
      fireEvent.change(screen.getByLabelText("Password"), {
        target: { value: "password" },
      });

      fireEvent.click(screen.getByText("Sign in (Dev Mode)"));

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalled();
      });

      // Button should be re-enabled after error
      await waitFor(() => {
        expect(screen.getByText("Sign in (Dev Mode)")).not.toBeDisabled();
      });

      consoleSpy.mockRestore();
    });
  });
});
