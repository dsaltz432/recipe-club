import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@tests/utils";
import PantryDialog from "@/components/pantry/PantryDialog";

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

describe("PantryDialog", () => {
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

  it("renders dialog content when open", async () => {
    render(<PantryDialog open={true} onOpenChange={vi.fn()} userId="user-1" />);

    expect(screen.getByText("My Pantry")).toBeInTheDocument();
    expect(screen.getByText(/Items you already have at home/)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("salt")).toBeInTheDocument();
    });
  });

  it("loads items when dialog opens", async () => {
    render(<PantryDialog open={true} onOpenChange={vi.fn()} userId="user-1" />);

    await waitFor(() => {
      expect(mockEnsureDefaultPantryItems).toHaveBeenCalledWith("user-1");
      expect(mockGetPantryItems).toHaveBeenCalledWith("user-1");
      expect(screen.getByText("salt")).toBeInTheDocument();
      expect(screen.getByText("pepper")).toBeInTheDocument();
    });
  });

  it("shows empty state when no items", async () => {
    mockGetPantryItems.mockResolvedValue([]);
    render(<PantryDialog open={true} onOpenChange={vi.fn()} userId="user-1" />);

    await waitFor(() => {
      expect(screen.getByText(/No pantry items yet/)).toBeInTheDocument();
    });
  });

  it("adds a new item", async () => {
    const onPantryChange = vi.fn();
    render(<PantryDialog open={true} onOpenChange={vi.fn()} userId="user-1" onPantryChange={onPantryChange} />);

    await waitFor(() => {
      expect(screen.getByText("salt")).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText("Add an item...");
    fireEvent.change(input, { target: { value: "olive oil" } });
    const addButton = input.closest("div")!.querySelector("button")!;
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(mockAddPantryItem).toHaveBeenCalledWith("user-1", "olive oil");
      expect(onPantryChange).toHaveBeenCalled();
    });
  });

  it("adds item on Enter key", async () => {
    render(<PantryDialog open={true} onOpenChange={vi.fn()} userId="user-1" />);

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
    render(<PantryDialog open={true} onOpenChange={vi.fn()} userId="user-1" />);

    await waitFor(() => {
      expect(screen.getByText("salt")).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText("Add an item...");
    fireEvent.change(input, { target: { value: "  " } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(mockAddPantryItem).not.toHaveBeenCalled();
  });

  it("does not respond to non-Enter keys", async () => {
    render(<PantryDialog open={true} onOpenChange={vi.fn()} userId="user-1" />);

    await waitFor(() => {
      expect(screen.getByText("salt")).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText("Add an item...");
    fireEvent.change(input, { target: { value: "garlic" } });
    fireEvent.keyDown(input, { key: "Tab" });

    expect(mockAddPantryItem).not.toHaveBeenCalled();
  });

  it("shows error toast when add fails", async () => {
    mockAddPantryItem.mockRejectedValue(new Error("Duplicate"));
    render(<PantryDialog open={true} onOpenChange={vi.fn()} userId="user-1" />);

    await waitFor(() => {
      expect(screen.getByText("salt")).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText("Add an item...");
    fireEvent.change(input, { target: { value: "salt" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to add item. It may already exist.");
    });
  });

  it("removes an item", async () => {
    const onPantryChange = vi.fn();
    render(<PantryDialog open={true} onOpenChange={vi.fn()} userId="user-1" onPantryChange={onPantryChange} />);

    await waitFor(() => {
      expect(screen.getByText("salt")).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByRole("button").filter(
      (btn) => !btn.textContent?.includes("Add") && btn.closest("li")
    );
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(mockRemovePantryItem).toHaveBeenCalledWith("user-1", "1");
      expect(onPantryChange).toHaveBeenCalled();
    });
  });

  it("shows error toast when remove fails", async () => {
    mockRemovePantryItem.mockRejectedValue(new Error("Not found"));
    render(<PantryDialog open={true} onOpenChange={vi.fn()} userId="user-1" />);

    await waitFor(() => {
      expect(screen.getByText("salt")).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByRole("button").filter(
      (btn) => !btn.textContent?.includes("Add") && btn.closest("li")
    );
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to remove item");
    });
  });

  it("shows error toast when loading fails", async () => {
    mockEnsureDefaultPantryItems.mockRejectedValue(new Error("DB error"));
    render(<PantryDialog open={true} onOpenChange={vi.fn()} userId="user-1" />);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to load pantry items");
    });
  });

  it("does not load items when dialog is closed", () => {
    render(<PantryDialog open={false} onOpenChange={vi.fn()} userId="user-1" />);
    expect(mockEnsureDefaultPantryItems).not.toHaveBeenCalled();
  });
});
