import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@tests/utils";
import GroceryExportMenu from "@/components/recipes/GroceryExportMenu";
import type { CombinedGroceryItem } from "@/types";

// Mock supabase client
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {},
}));

// Mock groceryList utilities
const mockDownloadCSV = vi.fn();
vi.mock("@/lib/groceryList", () => ({
  generateCSV: () => "mock-csv-content",
  downloadCSV: (...args: unknown[]) => mockDownloadCSV(...args),
  groupByCategory: () => new Map(),
}));

const items: CombinedGroceryItem[] = [
  { name: "flour", totalQuantity: 2, unit: "cup", category: "pantry", sourceRecipes: ["Pasta"] },
];

describe("GroceryExportMenu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders CSV button", () => {
    render(
      <GroceryExportMenu items={items} eventName="Test Event" />
    );

    expect(screen.getByText("CSV")).toBeInTheDocument();
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
});
