import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@tests/utils";
import PantryContent from "@/components/pantry/PantryContent";

// Mock pantry lib
const mockGetPantryItems = vi.fn();
const mockAddPantryItem = vi.fn();
const mockRemovePantryItem = vi.fn();
const mockEnsureDefaultPantryItems = vi.fn();

vi.mock("@/lib/pantry", () => ({
  getPantryItems: (...args: unknown[]) => mockGetPantryItems(...args),
  addPantryItem: (...args: unknown[]) => mockAddPantryItem(...args),
  removePantryItem: (...args: unknown[]) => mockRemovePantryItem(...args),
  ensureDefaultPantryItems: (...args: unknown[]) => mockEnsureDefaultPantryItems(...args),
  DEFAULT_PANTRY_ITEMS: ["salt", "pepper", "water"],
}));

// Mock sonner
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { toast } from "sonner";

describe("PantryContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnsureDefaultPantryItems.mockResolvedValue(undefined);
    mockGetPantryItems.mockResolvedValue([
      { id: "1", name: "salt" },
      { id: "2", name: "pepper" },
      { id: "3", name: "water" },
      { id: "4", name: "olive oil" },
    ]);
    mockAddPantryItem.mockResolvedValue(undefined);
    mockRemovePantryItem.mockResolvedValue(undefined);
  });

  it("does NOT load items when active=false", () => {
    render(<PantryContent userId="user-1" active={false} />);
    expect(mockEnsureDefaultPantryItems).not.toHaveBeenCalled();
    expect(mockGetPantryItems).not.toHaveBeenCalled();
  });

  it("loads and displays items when active=true", async () => {
    render(<PantryContent userId="user-1" active={true} />);

    await waitFor(() => {
      expect(mockEnsureDefaultPantryItems).toHaveBeenCalledWith("user-1");
      expect(mockGetPantryItems).toHaveBeenCalledWith("user-1");
      expect(screen.getByText("salt")).toBeInTheDocument();
      expect(screen.getByText("pepper")).toBeInTheDocument();
      expect(screen.getByText("water")).toBeInTheDocument();
      expect(screen.getByText("olive oil")).toBeInTheDocument();
    });
  });

  it("shows empty state when no items", async () => {
    mockGetPantryItems.mockResolvedValue([]);
    render(<PantryContent userId="user-1" active={true} />);

    await waitFor(() => {
      expect(screen.getByText(/No pantry items yet/)).toBeInTheDocument();
    });
  });

  it("shows error toast when loading fails", async () => {
    mockEnsureDefaultPantryItems.mockRejectedValue(new Error("DB error"));
    render(<PantryContent userId="user-1" active={true} />);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to load pantry items");
    });
  });

  it("adds a new item and calls onPantryChange", async () => {
    const onPantryChange = vi.fn();
    render(<PantryContent userId="user-1" active={true} onPantryChange={onPantryChange} />);

    await waitFor(() => {
      expect(screen.getByText("salt")).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText("Add an item...");
    fireEvent.change(input, { target: { value: "garlic" } });
    const addButton = input.closest("div")!.querySelector("button")!;
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(mockAddPantryItem).toHaveBeenCalledWith("user-1", "garlic");
      expect(toast.success).toHaveBeenCalledWith("Added 'garlic' to pantry");
      expect(onPantryChange).toHaveBeenCalled();
    });
  });

  it("adds item without onPantryChange callback", async () => {
    render(<PantryContent userId="user-1" active={true} />);

    await waitFor(() => {
      expect(screen.getByText("salt")).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText("Add an item...");
    fireEvent.change(input, { target: { value: "garlic" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(mockAddPantryItem).toHaveBeenCalledWith("user-1", "garlic");
    });
  });

  it("does not add empty item", async () => {
    render(<PantryContent userId="user-1" active={true} />);

    await waitFor(() => {
      expect(screen.getByText("salt")).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText("Add an item...");
    fireEvent.change(input, { target: { value: "  " } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(mockAddPantryItem).not.toHaveBeenCalled();
  });

  it("does not respond to non-Enter keys", async () => {
    render(<PantryContent userId="user-1" active={true} />);

    await waitFor(() => {
      expect(screen.getByText("salt")).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText("Add an item...");
    fireEvent.change(input, { target: { value: "garlic" } });
    fireEvent.keyDown(input, { key: "Tab" });

    expect(mockAddPantryItem).not.toHaveBeenCalled();
  });

  it("shows duplicate error toast for code 23505", async () => {
    mockAddPantryItem.mockRejectedValue({ code: "23505" });
    render(<PantryContent userId="user-1" active={true} />);

    await waitFor(() => {
      expect(screen.getByText("salt")).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText("Add an item...");
    fireEvent.change(input, { target: { value: "salt" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("This item is already in your pantry");
    });
  });

  it("shows generic error toast for non-duplicate add failure", async () => {
    mockAddPantryItem.mockRejectedValue(new Error("Network error"));
    render(<PantryContent userId="user-1" active={true} />);

    await waitFor(() => {
      expect(screen.getByText("salt")).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText("Add an item...");
    fireEvent.change(input, { target: { value: "oil" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to add item");
    });
  });

  it("hides delete button for protected default items (salt, pepper, water)", async () => {
    render(<PantryContent userId="user-1" active={true} />);

    await waitFor(() => {
      expect(screen.getByText("salt")).toBeInTheDocument();
    });

    // Protected items should NOT have a Remove button
    expect(screen.queryByLabelText("Remove salt")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Remove pepper")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Remove water")).not.toBeInTheDocument();

    // Protected items should show "Default" label
    const defaultLabels = screen.getAllByText("Default");
    expect(defaultLabels).toHaveLength(3);
  });

  it("shows delete button for non-protected items", async () => {
    render(<PantryContent userId="user-1" active={true} />);

    await waitFor(() => {
      expect(screen.getByText("olive oil")).toBeInTheDocument();
    });

    expect(screen.getByLabelText("Remove olive oil")).toBeInTheDocument();
  });

  it("removes a non-protected item via confirmation dialog and calls onPantryChange", async () => {
    const onPantryChange = vi.fn();
    render(<PantryContent userId="user-1" active={true} onPantryChange={onPantryChange} />);

    await waitFor(() => {
      expect(screen.getByText("olive oil")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText("Remove olive oil"));

    await waitFor(() => {
      expect(screen.getByText("Remove from pantry?")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Remove"));

    await waitFor(() => {
      expect(mockRemovePantryItem).toHaveBeenCalledWith("user-1", "4");
      expect(onPantryChange).toHaveBeenCalled();
    });
  });

  it("removes item without onPantryChange callback", async () => {
    render(<PantryContent userId="user-1" active={true} />);

    await waitFor(() => {
      expect(screen.getByText("olive oil")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText("Remove olive oil"));

    await waitFor(() => {
      expect(screen.getByText("Remove from pantry?")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Remove"));

    await waitFor(() => {
      expect(mockRemovePantryItem).toHaveBeenCalledWith("user-1", "4");
    });
  });

  it("shows error toast when remove fails", async () => {
    mockRemovePantryItem.mockRejectedValue(new Error("Not found"));
    render(<PantryContent userId="user-1" active={true} />);

    await waitFor(() => {
      expect(screen.getByText("olive oil")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText("Remove olive oil"));

    await waitFor(() => {
      expect(screen.getByText("Remove from pantry?")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Remove"));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to remove item");
    });
  });

  it("cancels remove via dialog Cancel button", async () => {
    render(<PantryContent userId="user-1" active={true} />);

    await waitFor(() => {
      expect(screen.getByText("olive oil")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText("Remove olive oil"));

    await waitFor(() => {
      expect(screen.getByText("Remove from pantry?")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Cancel"));

    expect(mockRemovePantryItem).not.toHaveBeenCalled();
  });
});
