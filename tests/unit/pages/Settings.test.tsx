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
const mockGetAllowedUser = vi.fn();
vi.mock("@/lib/auth", () => ({
  getCurrentUser: () => mockGetCurrentUser(),
  getAllowedUser: (...args: unknown[]) => mockGetAllowedUser(...args),
  isAdmin: (user: { role: string } | null) => user?.role === "admin",
}));

const mockLoadUserPreferences = vi.fn();
const mockSaveUserPreferences = vi.fn();
vi.mock("@/lib/userPreferences", () => ({
  loadUserPreferences: (...args: unknown[]) =>
    mockLoadUserPreferences(...args),
  saveUserPreferences: (...args: unknown[]) =>
    mockSaveUserPreferences(...args),
}));

// Mock Select to make it testable in jsdom
vi.mock("@/components/ui/select", () => ({
  Select: ({ value, onValueChange, children }: { value: string; onValueChange: (v: string) => void; children: React.ReactNode }) => (
    <div data-testid="select-mock">
      <select value={value} onChange={(e) => onValueChange(e.target.value)}>
        <option value="0">Sunday</option>
        <option value="1">Monday</option>
      </select>
      {children}
    </div>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: () => null,
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
  aiModelParse: "claude-sonnet-4-6",
  aiModelCombine: "claude-sonnet-4-6",
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
    mockGetAllowedUser.mockResolvedValue(null);
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
        aiModelParse: "claude-sonnet-4-6",
        aiModelCombine: "claude-sonnet-4-6",
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

  it("shows Saving... state while saving", async () => {
    // Make save hang so we can observe the intermediate state
    mockSaveUserPreferences.mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    render(<Settings />);

    await waitFor(() => {
      expect(screen.getByText("Save Settings")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Save Settings"));

    await waitFor(() => {
      expect(screen.getByText("Saving...")).toBeInTheDocument();
    });
  });

  it("does not save when user has no id", async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: null,
      name: "Test",
      email: "test@test.com",
    });
    const user = userEvent.setup();
    render(<Settings />);

    await waitFor(() => {
      expect(screen.getByText("Save Settings")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Save Settings"));

    expect(mockSaveUserPreferences).not.toHaveBeenCalled();
  });

  it("toggles a meal type on", async () => {
    mockLoadUserPreferences.mockResolvedValue({
      ...defaultPrefs,
      mealTypes: ["dinner"],
    });

    const user = userEvent.setup();
    render(<Settings />);

    await waitFor(() => {
      expect(screen.getByText("Breakfast")).toBeInTheDocument();
    });

    // Enable breakfast
    const breakfastSwitch = screen.getByRole("switch", { name: "Breakfast" });
    await user.click(breakfastSwitch);

    await user.click(screen.getByText("Save Settings"));

    await waitFor(() => {
      expect(mockSaveUserPreferences).toHaveBeenCalledWith(
        "user-1",
        expect.objectContaining({
          mealTypes: expect.arrayContaining(["dinner", "breakfast"]),
        })
      );
    });
  });

  it("changes week start day via select", async () => {
    render(<Settings />);

    await waitFor(() => {
      expect(screen.getByText("Week Start Day")).toBeInTheDocument();
    });

    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "1" } });

    const user = userEvent.setup();
    await user.click(screen.getByText("Save Settings"));

    await waitFor(() => {
      expect(mockSaveUserPreferences).toHaveBeenCalledWith(
        "user-1",
        expect.objectContaining({ weekStartDay: 1 })
      );
    });
  });

  it("loads preferences when no user id (skips loadUserPreferences)", async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: null,
      name: "Test",
      email: null,
    });

    render(<Settings />);

    await waitFor(() => {
      expect(screen.getByText("Settings")).toBeInTheDocument();
    });

    expect(mockLoadUserPreferences).not.toHaveBeenCalled();
  });

  it("disables a meal type when more than one is selected", async () => {
    const user = userEvent.setup();
    render(<Settings />);

    await waitFor(() => {
      expect(screen.getByText("Breakfast")).toBeInTheDocument();
    });

    // Default has all 3 types, so disabling one should work
    const breakfastSwitch = screen.getByRole("switch", { name: "Breakfast" });
    await user.click(breakfastSwitch);

    await user.click(screen.getByText("Save Settings"));

    await waitFor(() => {
      expect(mockSaveUserPreferences).toHaveBeenCalledWith(
        "user-1",
        expect.objectContaining({
          mealTypes: ["lunch", "dinner"],
        })
      );
    });
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

  it("does not show AI Models section for non-admin users", async () => {
    mockGetAllowedUser.mockResolvedValue({ role: "member" });
    render(<Settings />);

    await waitFor(() => {
      expect(screen.getByText("Meal Types")).toBeInTheDocument();
    });

    expect(screen.queryByText("AI Models")).not.toBeInTheDocument();
  });

  it("shows AI Models section for admin users", async () => {
    mockGetAllowedUser.mockResolvedValue({ role: "admin" });
    render(<Settings />);

    await waitFor(() => {
      expect(screen.getByText("AI Models")).toBeInTheDocument();
    });

    expect(screen.getByText("Recipe Parsing")).toBeInTheDocument();
    expect(screen.getByText("Grocery Processing")).toBeInTheDocument();
  });
});
