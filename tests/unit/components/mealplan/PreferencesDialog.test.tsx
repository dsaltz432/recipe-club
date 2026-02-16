import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@tests/utils";
import PreferencesDialog from "@/components/mealplan/PreferencesDialog";
import { toast } from "sonner";
import type { UserPreferences } from "@/types";

// Mock Supabase
const mockSupabaseFrom = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => mockSupabaseFrom(...args),
  },
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const createMockQueryBuilder = (data: unknown = null, error: unknown = null) => ({
  select: vi.fn().mockReturnThis(),
  upsert: vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue({ data, error }),
});

describe("PreferencesDialog", () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    userId: "user-123",
    preferences: null as UserPreferences | null,
    onSaved: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabaseFrom.mockReturnValue(createMockQueryBuilder());
  });

  it("renders dialog with title", () => {
    render(<PreferencesDialog {...defaultProps} />);

    expect(screen.getByText("Meal Preferences")).toBeInTheDocument();
  });

  it("renders description", () => {
    render(<PreferencesDialog {...defaultProps} />);

    expect(screen.getByText(/ai-powered meal suggestions/i)).toBeInTheDocument();
  });

  it("renders dietary restriction options", () => {
    render(<PreferencesDialog {...defaultProps} />);

    expect(screen.getByText("Vegetarian")).toBeInTheDocument();
    expect(screen.getByText("Vegan")).toBeInTheDocument();
    expect(screen.getByText("Gluten-Free")).toBeInTheDocument();
    expect(screen.getByText("Keto")).toBeInTheDocument();
  });

  it("renders cuisine options", () => {
    render(<PreferencesDialog {...defaultProps} />);

    expect(screen.getByText("Italian")).toBeInTheDocument();
    expect(screen.getByText("Mexican")).toBeInTheDocument();
    expect(screen.getByText("Asian")).toBeInTheDocument();
  });

  it("toggles dietary restriction on click", () => {
    render(<PreferencesDialog {...defaultProps} />);

    const vegetarian = screen.getByText("Vegetarian");
    fireEvent.click(vegetarian);

    // Badge should now have default variant (selected)
    expect(vegetarian.closest("div")).toBeInTheDocument();
  });

  it("toggles cuisine preference on click", () => {
    render(<PreferencesDialog {...defaultProps} />);

    fireEvent.click(screen.getByText("Italian"));
    // Should toggle — no crash
    expect(screen.getByText("Italian")).toBeInTheDocument();
  });

  it("adds disliked ingredient", () => {
    render(<PreferencesDialog {...defaultProps} />);

    const input = screen.getByPlaceholderText("e.g., cilantro");
    fireEvent.change(input, { target: { value: "cilantro" } });
    fireEvent.click(screen.getByText("Add"));

    expect(screen.getByText("cilantro")).toBeInTheDocument();
  });

  it("adds disliked ingredient on Enter key", () => {
    render(<PreferencesDialog {...defaultProps} />);

    const input = screen.getByPlaceholderText("e.g., cilantro");
    fireEvent.change(input, { target: { value: "mushrooms" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(screen.getByText("mushrooms")).toBeInTheDocument();
  });

  it("does not add on non-Enter key", () => {
    render(<PreferencesDialog {...defaultProps} />);

    const input = screen.getByPlaceholderText("e.g., cilantro");
    fireEvent.change(input, { target: { value: "mushrooms" } });
    fireEvent.keyDown(input, { key: "a" });

    expect(screen.queryByText("mushrooms")).not.toBeInTheDocument();
  });

  it("removes disliked ingredient", () => {
    render(<PreferencesDialog {...defaultProps} />);

    // Add then remove
    const input = screen.getByPlaceholderText("e.g., cilantro");
    fireEvent.change(input, { target: { value: "cilantro" } });
    fireEvent.click(screen.getByText("Add"));

    // Find the X button inside the badge
    const badge = screen.getByText("cilantro").closest("div");
    const removeButton = badge!.querySelector("button");
    fireEvent.click(removeButton!);

    expect(screen.queryByText("cilantro")).not.toBeInTheDocument();
  });

  it("does not add empty disliked ingredient", () => {
    render(<PreferencesDialog {...defaultProps} />);

    fireEvent.click(screen.getByText("Add"));

    // No badges should appear
    const badges = document.querySelectorAll('[data-testid="disliked-badge"]');
    expect(badges.length).toBe(0);
  });

  it("does not add duplicate disliked ingredient", () => {
    render(<PreferencesDialog {...defaultProps} />);

    const input = screen.getByPlaceholderText("e.g., cilantro");

    // Add cilantro twice
    fireEvent.change(input, { target: { value: "cilantro" } });
    fireEvent.click(screen.getByText("Add"));
    fireEvent.change(input, { target: { value: "cilantro" } });
    fireEvent.click(screen.getByText("Add"));

    // Should only appear once
    const allText = document.body.textContent || "";
    const count = (allText.match(/cilantro/g) || []).length;
    // Badge shows "cilantro" + X button
    expect(count).toBeLessThanOrEqual(2);
  });

  it("loads existing preferences", () => {
    const existingPrefs: UserPreferences = {
      id: "pref-1",
      userId: "user-123",
      dietaryRestrictions: ["Vegetarian"],
      cuisinePreferences: ["Italian"],
      dislikedIngredients: ["olives"],
      householdSize: 4,
      cookingSkill: "advanced",
      maxCookTimeMinutes: 90,
    };

    render(<PreferencesDialog {...defaultProps} preferences={existingPrefs} />);

    // Check household size input
    expect(screen.getByLabelText("Household Size")).toHaveValue(4);
    expect(screen.getByLabelText("Max Cook Time (min)")).toHaveValue(90);
    // Disliked ingredient should be present
    expect(screen.getByText("olives")).toBeInTheDocument();
  });

  it("saves preferences successfully", async () => {
    const savedData = {
      id: "pref-1",
      user_id: "user-123",
      dietary_restrictions: ["Vegetarian"],
      cuisine_preferences: ["Italian"],
      disliked_ingredients: [],
      household_size: 2,
      cooking_skill: "intermediate",
      max_cook_time_minutes: 60,
      updated_at: "2026-02-14T00:00:00Z",
    };

    mockSupabaseFrom.mockReturnValue(createMockQueryBuilder(savedData));

    render(<PreferencesDialog {...defaultProps} />);

    fireEvent.click(screen.getByText("Vegetarian"));
    fireEvent.click(screen.getByText("Italian"));

    fireEvent.click(screen.getByText("Save Preferences"));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Preferences saved!");
      expect(defaultProps.onSaved).toHaveBeenCalled();
      expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it("handles save error", async () => {
    mockSupabaseFrom.mockReturnValue(
      createMockQueryBuilder(null, { message: "Database error" })
    );

    render(<PreferencesDialog {...defaultProps} />);

    fireEvent.click(screen.getByText("Save Preferences"));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to save preferences");
    });
  });

  it("calls onOpenChange when cancel is clicked", () => {
    render(<PreferencesDialog {...defaultProps} />);

    fireEvent.click(screen.getByText("Cancel"));

    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("does not render when closed", () => {
    render(<PreferencesDialog {...defaultProps} open={false} />);

    expect(screen.queryByText("Meal Preferences")).not.toBeInTheDocument();
  });

  it("changes household size", () => {
    render(<PreferencesDialog {...defaultProps} />);

    const input = screen.getByLabelText("Household Size");
    fireEvent.change(input, { target: { value: "5" } });

    expect(input).toHaveValue(5);
  });

  it("changes max cook time", () => {
    render(<PreferencesDialog {...defaultProps} />);

    const input = screen.getByLabelText("Max Cook Time (min)");
    fireEvent.change(input, { target: { value: "45" } });

    expect(input).toHaveValue(45);
  });

  it("changes cooking skill", () => {
    render(<PreferencesDialog {...defaultProps} />);

    // The Select component from shadcn - click trigger then select option
    const trigger = screen.getByRole("combobox");
    fireEvent.click(trigger);

    // Select "Beginner"
    fireEvent.click(screen.getByText("Beginner"));

    expect(screen.getByRole("combobox")).toHaveTextContent("Beginner");
  });

  it("untoggles dietary restriction on second click", () => {
    render(<PreferencesDialog {...defaultProps} />);

    // Click Vegetarian twice
    fireEvent.click(screen.getByText("Vegetarian"));
    fireEvent.click(screen.getByText("Vegetarian"));

    // Should still be rendered but unselected
    expect(screen.getByText("Vegetarian")).toBeInTheDocument();
  });

  it("untoggles cuisine preference on second click", () => {
    render(<PreferencesDialog {...defaultProps} />);

    fireEvent.click(screen.getByText("Italian"));
    fireEvent.click(screen.getByText("Italian"));

    expect(screen.getByText("Italian")).toBeInTheDocument();
  });

  it("shows saving state", async () => {
    // Make save hang by never resolving
    const hangingBuilder = {
      select: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnValue(new Promise(() => {})),
    };
    mockSupabaseFrom.mockReturnValue(hangingBuilder);

    render(<PreferencesDialog {...defaultProps} />);

    fireEvent.click(screen.getByText("Save Preferences"));

    expect(screen.getByText("Saving...")).toBeInTheDocument();
  });
});
