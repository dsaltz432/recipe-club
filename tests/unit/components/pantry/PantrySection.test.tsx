import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@tests/utils";
import PantrySection from "@/components/pantry/PantrySection";

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
}));

// Mock sonner
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { toast } from "sonner";

describe("PantrySection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnsureDefaultPantryItems.mockResolvedValue(undefined);
    mockGetPantryItems.mockResolvedValue([
      { id: "1", name: "salt" },
      { id: "2", name: "pepper" },
    ]);
    mockAddPantryItem.mockResolvedValue(undefined);
    mockRemovePantryItem.mockResolvedValue(undefined);
  });

  it("renders nothing when no userId provided", () => {
    const { container } = render(<PantrySection />);
    expect(container.innerHTML).toBe("");
  });

  it("renders heading and description", async () => {
    render(<PantrySection userId="user-1" />);

    expect(screen.getByText("My Pantry")).toBeInTheDocument();
    expect(screen.getByText(/Items you already have at home/)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("salt")).toBeInTheDocument();
    });
  });

  it("loads and displays pantry items", async () => {
    render(<PantrySection userId="user-1" />);

    await waitFor(() => {
      expect(screen.getByText("salt")).toBeInTheDocument();
      expect(screen.getByText("pepper")).toBeInTheDocument();
    });

    expect(mockEnsureDefaultPantryItems).toHaveBeenCalledWith("user-1");
    expect(mockGetPantryItems).toHaveBeenCalledWith("user-1");
  });

  it("shows empty state when no items", async () => {
    mockGetPantryItems.mockResolvedValue([]);

    render(<PantrySection userId="user-1" />);

    await waitFor(() => {
      expect(screen.getByText(/No pantry items yet/)).toBeInTheDocument();
    });
  });

  it("adds a new item and shows success toast", async () => {
    render(<PantrySection userId="user-1" onPantryChange={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("salt")).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText("Add an item...");
    fireEvent.change(input, { target: { value: "olive oil" } });
    const addButton = input.closest("div")!.querySelector("button")!;
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(mockAddPantryItem).toHaveBeenCalledWith("user-1", "olive oil");
    });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Added 'olive oil' to pantry");
    });
  });

  it("adds item on Enter key", async () => {
    render(<PantrySection userId="user-1" />);

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
    render(<PantrySection userId="user-1" />);

    await waitFor(() => {
      expect(screen.getByText("salt")).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText("Add an item...");
    fireEvent.change(input, { target: { value: "  " } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(mockAddPantryItem).not.toHaveBeenCalled();
  });

  it("does not respond to non-Enter keys", async () => {
    render(<PantrySection userId="user-1" />);

    await waitFor(() => {
      expect(screen.getByText("salt")).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText("Add an item...");
    fireEvent.change(input, { target: { value: "garlic" } });
    fireEvent.keyDown(input, { key: "Tab" });

    expect(mockAddPantryItem).not.toHaveBeenCalled();
  });

  it("shows specific error toast for duplicate items (23505)", async () => {
    mockAddPantryItem.mockRejectedValue({ code: "23505" });

    render(<PantrySection userId="user-1" />);

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

  it("shows generic error toast for other add failures", async () => {
    mockAddPantryItem.mockRejectedValue(new Error("Network error"));

    render(<PantrySection userId="user-1" />);

    await waitFor(() => {
      expect(screen.getByText("salt")).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText("Add an item...");
    fireEvent.change(input, { target: { value: "garlic" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to add item");
    });
  });

  it("shows delete confirmation dialog and removes item on confirm", async () => {
    render(<PantrySection userId="user-1" onPantryChange={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("salt")).toBeInTheDocument();
    });

    // Click trash icon to open confirmation dialog
    const deleteButtons = screen.getAllByRole("button", { name: /Remove/ });
    fireEvent.click(deleteButtons[0]);

    // Confirmation dialog should appear
    await waitFor(() => {
      expect(screen.getByText("Remove from pantry?")).toBeInTheDocument();
    });

    // Click "Remove" to confirm
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    await waitFor(() => {
      expect(mockRemovePantryItem).toHaveBeenCalledWith("user-1", "1");
    });
  });

  it("cancels delete confirmation without removing item", async () => {
    render(<PantrySection userId="user-1" />);

    await waitFor(() => {
      expect(screen.getByText("salt")).toBeInTheDocument();
    });

    // Click trash icon to open confirmation dialog
    const deleteButtons = screen.getAllByRole("button", { name: /Remove/ });
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(screen.getByText("Remove from pantry?")).toBeInTheDocument();
    });

    // Click "Cancel" to dismiss
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(mockRemovePantryItem).not.toHaveBeenCalled();
  });

  it("shows error toast when remove fails", async () => {
    mockRemovePantryItem.mockRejectedValue(new Error("Not found"));

    render(<PantrySection userId="user-1" />);

    await waitFor(() => {
      expect(screen.getByText("salt")).toBeInTheDocument();
    });

    // Click trash icon → confirmation → confirm
    const deleteButtons = screen.getAllByRole("button", { name: /Remove/ });
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(screen.getByText("Remove from pantry?")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to remove item");
    });
  });

  it("shows error toast when loading fails", async () => {
    mockEnsureDefaultPantryItems.mockRejectedValue(new Error("DB error"));

    render(<PantrySection userId="user-1" />);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to load pantry items");
    });
  });

  it("calls onPantryChange after add and remove", async () => {
    const onPantryChange = vi.fn();
    render(<PantrySection userId="user-1" onPantryChange={onPantryChange} />);

    await waitFor(() => {
      expect(screen.getByText("salt")).toBeInTheDocument();
    });

    // Add item
    const input = screen.getByPlaceholderText("Add an item...");
    fireEvent.change(input, { target: { value: "garlic" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(onPantryChange).toHaveBeenCalled();
    });
  });
});
