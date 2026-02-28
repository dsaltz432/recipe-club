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

// Mock instacart module
const mockSendToInstacart = vi.fn();
vi.mock("@/lib/instacart", () => ({
  sendToInstacart: (...args: unknown[]) => mockSendToInstacart(...args),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const items: SmartGroceryItem[] = [
  { name: "flour", displayName: "flour", totalQuantity: 2, unit: "cup", category: "pantry", sourceRecipes: ["Pasta"] },
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

  it("opens Instacart URL in new tab on success", async () => {
    mockSendToInstacart.mockResolvedValue("https://instacart.com/store/recipe/123");
    const mockOpen = vi.fn();
    vi.stubGlobal("open", mockOpen);

    render(
      <GroceryExportMenu items={items} eventName="Test Event" />
    );

    fireEvent.click(screen.getByText("Instacart"));

    await vi.waitFor(() => {
      expect(mockSendToInstacart).toHaveBeenCalledWith(items, "Test Event");
      expect(mockOpen).toHaveBeenCalledWith("https://instacart.com/store/recipe/123", "_blank");
    });

    vi.unstubAllGlobals();
  });

  it("shows toast error when Instacart fails", async () => {
    mockSendToInstacart.mockRejectedValue(new Error("Network error"));

    render(
      <GroceryExportMenu items={items} eventName="Test Event" />
    );

    fireEvent.click(screen.getByText("Instacart"));

    await vi.waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to send to Instacart. Please try again.");
    });
  });

  it("disables Instacart button while loading", async () => {
    let resolvePromise: (value: string) => void;
    mockSendToInstacart.mockReturnValue(
      new Promise<string>((resolve) => {
        resolvePromise = resolve;
      })
    );

    render(
      <GroceryExportMenu items={items} eventName="Test Event" />
    );

    fireEvent.click(screen.getByText("Instacart"));

    await vi.waitFor(() => {
      const instacartButton = screen.getByText("Instacart").closest("button");
      expect(instacartButton).toBeDisabled();
    });

    // Resolve to clean up
    resolvePromise!("https://instacart.com");
  });

  it("disables Instacart button when items array is empty", () => {
    render(
      <GroceryExportMenu items={[]} eventName="Test Event" />
    );

    const instacartButton = screen.getByText("Instacart").closest("button");
    expect(instacartButton).toBeDisabled();
  });
});
