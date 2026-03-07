import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@tests/utils";
import GroceryExportMenu from "@/components/recipes/GroceryExportMenu";
import type { SmartGroceryItem } from "@/types";
import { toast } from "sonner";

// Mock supabase client
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {},
}));

// Mock groceryList utilities
const mockDownloadCSV = vi.fn();
vi.mock("@/lib/groceryList", () => ({
  generateCSV: () => "mock-csv-content",
  generatePlainText: () => "PRODUCE\n  2 cup flour",
  downloadCSV: (...args: unknown[]) => mockDownloadCSV(...args),
  groupByCategory: () => new Map(),
}));

// Mock instacart
const mockSendToInstacart = vi.fn();
vi.mock("@/lib/instacart", () => ({
  sendToInstacart: (...args: unknown[]) => mockSendToInstacart(...args),
}));

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
  });

  it("renders CSV, Copy, and Instacart buttons", () => {
    render(
      <GroceryExportMenu items={items} eventName="Test Event" />
    );

    expect(screen.getByText("CSV")).toBeInTheDocument();
    expect(screen.getByText("Copy")).toBeInTheDocument();
    expect(screen.getByText("Instacart")).toBeInTheDocument();
  });

  it("calls downloadCSV when CSV button is clicked", () => {
    render(
      <GroceryExportMenu items={items} eventName="Test Event" />
    );

    fireEvent.click(screen.getByText("CSV"));

    expect(mockDownloadCSV).toHaveBeenCalledWith(
      "mock-csv-content",
      "grocery-list-test-event.csv"
    );
  });

  it("copies plain text to clipboard when Copy button is clicked", async () => {
    const mockWriteText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText: mockWriteText },
    });

    render(
      <GroceryExportMenu items={items} eventName="Test Event" />
    );

    fireEvent.click(screen.getByText("Copy"));

    await vi.waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledWith("PRODUCE\n  2 cup flour");
      expect(toast.success).toHaveBeenCalledWith("Copied to clipboard!");
    });
  });

  it("shows error toast when clipboard copy fails", async () => {
    const mockWriteText = vi.fn().mockRejectedValue(new Error("Clipboard denied"));
    Object.assign(navigator, {
      clipboard: { writeText: mockWriteText },
    });

    render(
      <GroceryExportMenu items={items} eventName="Test Event" />
    );

    fireEvent.click(screen.getByText("Copy"));

    await vi.waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to copy to clipboard");
    });
  });

  it("calls sendToInstacart and opens the returned URL on success", async () => {
    const mockOpen = vi.fn();
    vi.stubGlobal("open", mockOpen);
    mockSendToInstacart.mockResolvedValue("https://instacart.com/products_link");

    render(
      <GroceryExportMenu items={items} eventName="Dinner Party" />
    );

    fireEvent.click(screen.getByText("Instacart"));

    await vi.waitFor(() => {
      expect(mockSendToInstacart).toHaveBeenCalledWith(items, "Dinner Party");
      expect(mockOpen).toHaveBeenCalledWith(
        "https://instacart.com/products_link",
        "_blank",
        "noopener,noreferrer"
      );
    });
  });

  it("shows error toast when sendToInstacart fails", async () => {
    mockSendToInstacart.mockRejectedValue(new Error("Network error"));

    render(
      <GroceryExportMenu items={items} eventName="Test Event" />
    );

    fireEvent.click(screen.getByText("Instacart"));

    await vi.waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to send to Instacart");
    });
  });

  it("sends only unchecked items to Instacart", async () => {
    const mockOpen = vi.fn();
    vi.stubGlobal("open", mockOpen);
    mockSendToInstacart.mockResolvedValue("https://instacart.com/products_link");

    const checkedItems = new Set(["flour"]);

    render(
      <GroceryExportMenu items={items} eventName="Test Event" checkedItems={checkedItems} />
    );

    fireEvent.click(screen.getByText("Instacart"));

    await vi.waitFor(() => {
      expect(mockSendToInstacart).toHaveBeenCalledWith(
        [items[1]], // only eggs, flour is checked
        "Test Event"
      );
    });
  });

  it("disables button and shows Sending... while loading", async () => {
    let resolve!: (url: string) => void;
    mockSendToInstacart.mockReturnValue(new Promise<string>((res) => { resolve = res; }));

    render(
      <GroceryExportMenu items={items} eventName="Test Event" />
    );

    const button = screen.getByRole("button", { name: /instacart/i });
    fireEvent.click(button);

    await vi.waitFor(() => {
      expect(screen.getByText("Sending...")).toBeInTheDocument();
      expect(button).toBeDisabled();
    });

    resolve("https://instacart.com/products_link");

    await vi.waitFor(() => {
      expect(screen.getByText("Instacart")).toBeInTheDocument();
      expect(button).not.toBeDisabled();
    });
  });
});
