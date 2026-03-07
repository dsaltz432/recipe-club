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
    expect(screen.getByText("Coming Soon")).toBeInTheDocument();
  });

  it("Instacart button is disabled", () => {
    render(
      <GroceryExportMenu items={items} eventName="Test Event" />
    );

    expect(screen.getByRole("button", { name: /instacart/i })).toBeDisabled();
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

});
