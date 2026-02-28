import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@tests/utils";
import userEvent from "@testing-library/user-event";
import Settings from "@/pages/Settings";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockGetCurrentUser = vi.fn();
vi.mock("@/lib/auth", () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

const mockLoadUserPreferences = vi.fn();
const mockSaveUserPreferences = vi.fn();
vi.mock("@/lib/userPreferences", () => ({
  loadUserPreferences: (...args: unknown[]) =>
    mockLoadUserPreferences(...args),
  saveUserPreferences: (...args: unknown[]) =>
    mockSaveUserPreferences(...args),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

import { toast } from "sonner";

const defaultPrefs = {
  mealTypes: ["breakfast", "lunch", "dinner"],
  weekStartDay: 0,
  householdSize: 2,
};

describe("Settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue({
      id: "user-1",
      name: "Test User",
      email: "test@test.com",
    });
    mockLoadUserPreferences.mockResolvedValue({ ...defaultPrefs });
    mockSaveUserPreferences.mockResolvedValue(undefined);
  });

  it("shows loading spinner initially", () => {
    mockGetCurrentUser.mockReturnValue(new Promise(() => {}));
    const { container } = render(<Settings />);
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("renders all three sections after loading", async () => {
    render(<Settings />);

    await waitFor(() => {
      expect(screen.getByText("Meal Types")).toBeInTheDocument();
    });

    expect(screen.getByText("Week Start Day")).toBeInTheDocument();
    expect(screen.getByText("Household Size")).toBeInTheDocument();
  });

  it("renders Settings heading", async () => {
    render(<Settings />);

    await waitFor(() => {
      expect(screen.getByText("Settings")).toBeInTheDocument();
    });
  });

  it("renders back to dashboard button", async () => {
    render(<Settings />);

    await waitFor(() => {
      expect(screen.getByText("Settings")).toBeInTheDocument();
    });

    const backButton = screen.getByRole("button", {
      name: /back to dashboard/i,
    });
    expect(backButton).toBeInTheDocument();
    fireEvent.click(backButton);
    expect(mockNavigate).toHaveBeenCalledWith("/dashboard");
  });

  it("renders meal type switches for breakfast, lunch, dinner", async () => {
    render(<Settings />);

    await waitFor(() => {
      expect(screen.getByText("Breakfast")).toBeInTheDocument();
    });

    expect(screen.getByText("Lunch")).toBeInTheDocument();
    expect(screen.getByText("Dinner")).toBeInTheDocument();
  });

  it("loads user preferences on mount", async () => {
    render(<Settings />);

    await waitFor(() => {
      expect(mockLoadUserPreferences).toHaveBeenCalledWith("user-1");
    });
  });

  it("renders household size input with loaded value", async () => {
    mockLoadUserPreferences.mockResolvedValue({
      ...defaultPrefs,
      householdSize: 5,
    });

    render(<Settings />);

    await waitFor(() => {
      const input = screen.getByRole("spinbutton");
      expect(input).toHaveValue(5);
    });
  });

  it("saves preferences when Save button is clicked", async () => {
    const user = userEvent.setup();
    render(<Settings />);

    await waitFor(() => {
      expect(screen.getByText("Save Settings")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Save Settings"));

    await waitFor(() => {
      expect(mockSaveUserPreferences).toHaveBeenCalledWith("user-1", {
        mealTypes: ["breakfast", "lunch", "dinner"],
        weekStartDay: 0,
        householdSize: 2,
      });
    });
  });

  it("shows success toast on save", async () => {
    const user = userEvent.setup();
    render(<Settings />);

    await waitFor(() => {
      expect(screen.getByText("Save Settings")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Save Settings"));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Settings saved successfully");
    });
  });

  it("shows error toast on save failure", async () => {
    mockSaveUserPreferences.mockRejectedValue(new Error("fail"));
    const user = userEvent.setup();
    render(<Settings />);

    await waitFor(() => {
      expect(screen.getByText("Save Settings")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Save Settings"));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to save settings");
    });
  });

  it("prevents unchecking last meal type with toast warning", async () => {
    mockLoadUserPreferences.mockResolvedValue({
      ...defaultPrefs,
      mealTypes: ["dinner"],
    });

    const user = userEvent.setup();
    render(<Settings />);

    await waitFor(() => {
      expect(screen.getByText("Dinner")).toBeInTheDocument();
    });

    const dinnerSwitch = screen.getByRole("switch", { name: "Dinner" });
    await user.click(dinnerSwitch);

    expect(toast).toHaveBeenCalledWith(
      "You must keep at least one meal type selected"
    );
  });

  it("updates household size when input changes", async () => {
    const user = userEvent.setup();
    render(<Settings />);

    await waitFor(() => {
      expect(screen.getByRole("spinbutton")).toBeInTheDocument();
    });

    const input = screen.getByRole("spinbutton");
    // Use fireEvent.change for number inputs to avoid intermediate state issues
    fireEvent.change(input, { target: { value: "6" } });

    await user.click(screen.getByText("Save Settings"));

    await waitFor(() => {
      expect(mockSaveUserPreferences).toHaveBeenCalledWith(
        "user-1",
        expect.objectContaining({ householdSize: 6 })
      );
    });
  });
});
