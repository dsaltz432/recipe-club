import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@tests/utils";
import GroceryExportMenu from "@/components/recipes/GroceryExportMenu";
import type { SmartGroceryItem } from "@/types";
import { toast } from "sonner";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {},
}));

const mockDownloadCSV = vi.fn();
vi.mock("@/lib/groceryList", () => ({
  generateCSV: () => "mock-csv-content",
  generatePlainText: () => "PRODUCE\n  2 cup flour",
  downloadCSV: (...args: unknown[]) => mockDownloadCSV(...args),
  groupByCategory: () => new Map(),
}));

const mockGetCurrentUser = vi.fn();
vi.mock("@/lib/auth", () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

const mockSendToAnyList = vi.fn();
const mockOpenAnyList = vi.fn();
vi.mock("@/lib/anylist", async () => {
  const actual = await vi.importActual<typeof import("@/lib/anylist")>("@/lib/anylist");
  return {
    ...actual,
    sendToAnyList: (...args: unknown[]) => mockSendToAnyList(...args),
    openAnyList: () => mockOpenAnyList(),
  };
});

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const items: SmartGroceryItem[] = [
  { name: "flour", displayName: "flour", totalQuantity: 2, unit: "cup", category: "pantry", sourceRecipes: ["Pasta"] },
  { name: "eggs", displayName: "eggs", totalQuantity: 3, unit: undefined, category: "dairy", sourceRecipes: ["Cake"] },
];

describe("GroceryExportMenu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue({ id: "1", name: "Test", email: "stranger@example.com" });
  });

  it("renders Download CSV and Copy buttons", async () => {
    render(<GroceryExportMenu items={items} eventName="Test Event" />);

    expect(screen.getByRole("button", { name: "Download CSV" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy to clipboard" })).toBeInTheDocument();
  });

  it("calls downloadCSV when CSV button is clicked", () => {
    render(<GroceryExportMenu items={items} eventName="Test Event" />);

    fireEvent.click(screen.getByRole("button", { name: "Download CSV" }));

    expect(mockDownloadCSV).toHaveBeenCalledWith("mock-csv-content", "grocery-list-test-event.csv");
  });

  it("copies plain text to clipboard when Copy button is clicked", async () => {
    const mockWriteText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText: mockWriteText } });

    render(<GroceryExportMenu items={items} eventName="Test Event" />);

    fireEvent.click(screen.getByRole("button", { name: "Copy to clipboard" }));

    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledWith("PRODUCE\n  2 cup flour");
      expect(toast.success).toHaveBeenCalledWith("Copied to clipboard!");
    });
  });

  it("shows error toast when clipboard copy fails", async () => {
    const mockWriteText = vi.fn().mockRejectedValue(new Error("Clipboard denied"));
    Object.assign(navigator, { clipboard: { writeText: mockWriteText } });

    render(<GroceryExportMenu items={items} eventName="Test Event" />);

    fireEvent.click(screen.getByRole("button", { name: "Copy to clipboard" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to copy to clipboard");
    });
  });

  describe("AnyList button visibility", () => {
    it("hides the AnyList button for non-allowlisted users", async () => {
      mockGetCurrentUser.mockResolvedValue({ id: "1", name: "Test", email: "stranger@example.com" });
      render(<GroceryExportMenu items={items} eventName="Test Event" />);

      // wait for the email-load effect to settle
      await waitFor(() => {
        expect(mockGetCurrentUser).toHaveBeenCalled();
      });
      expect(screen.queryByRole("button", { name: /anylist/i })).not.toBeInTheDocument();
    });

    it("shows the AnyList button for allowlisted users", async () => {
      mockGetCurrentUser.mockResolvedValue({ id: "1", name: "Daniel", email: "dsaltz190@gmail.com" });
      render(<GroceryExportMenu items={items} eventName="Test Event" />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /anylist/i })).toBeInTheDocument();
      });
    });

    it("hides the AnyList button when user is not signed in", async () => {
      mockGetCurrentUser.mockResolvedValue(null);
      render(<GroceryExportMenu items={items} eventName="Test Event" />);

      await waitFor(() => {
        expect(mockGetCurrentUser).toHaveBeenCalled();
      });
      expect(screen.queryByRole("button", { name: /anylist/i })).not.toBeInTheDocument();
    });
  });

  describe("AnyList button click", () => {
    beforeEach(() => {
      mockGetCurrentUser.mockResolvedValue({ id: "1", name: "Daniel", email: "dsaltz190@gmail.com" });
    });

    it("calls sendToAnyList and openAnyList on success", async () => {
      mockSendToAnyList.mockResolvedValue({ itemsAdded: 2, itemsRemoved: 0, listName: "Groceries" });

      render(<GroceryExportMenu items={items} eventName="Italian Night" />);

      const button = await screen.findByRole("button", { name: /anylist/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockSendToAnyList).toHaveBeenCalledWith({
          items,
          eventName: "Italian Night",
          checkedItems: undefined,
        });
        expect(mockOpenAnyList).toHaveBeenCalled();
        expect(toast.success).toHaveBeenCalledWith(expect.stringMatching(/synced 2 items/i));
      });
    });

    it("shows error toast on failure and does not open AnyList", async () => {
      mockSendToAnyList.mockRejectedValue(new Error("Network down"));

      render(<GroceryExportMenu items={items} eventName="Test" />);

      const button = await screen.findByRole("button", { name: /anylist/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Network down");
        expect(mockOpenAnyList).not.toHaveBeenCalled();
      });
    });

    it("disables the button when there are no unchecked items", async () => {
      const allChecked = new Set(items.map((i) => i.name));
      render(<GroceryExportMenu items={items} eventName="Test" checkedItems={allChecked} />);

      const button = await screen.findByRole("button", { name: /anylist/i });
      expect(button).toBeDisabled();
    });
  });
});
