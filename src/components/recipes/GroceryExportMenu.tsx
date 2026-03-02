import { Download, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SmartGroceryItem } from "@/types";
import { generateCSV, generatePlainText, downloadCSV, groupByCategory } from "@/lib/groceryList";
import { toast } from "sonner";

interface GroceryExportMenuProps {
  items: SmartGroceryItem[];
  eventName: string;
  checkedItems?: Set<string>;
}

const GroceryExportMenu = ({ items, eventName, checkedItems }: GroceryExportMenuProps) => {
  const uncheckedItems = checkedItems?.size
    ? items.filter((item) => !checkedItems.has(item.name))
    : items;

  const handleDownloadCSV = () => {
    const grouped = groupByCategory(uncheckedItems);
    const csv = generateCSV(grouped);
    const filename = `grocery-list-${eventName.toLowerCase().replace(/\s+/g, "-")}.csv`;
    downloadCSV(csv, filename);
  };

  const handleCopyToClipboard = async () => {
    const grouped = groupByCategory(uncheckedItems);
    const text = generatePlainText(grouped);
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard!");
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  };

  return (
    <div className="flex gap-1">
      <Button variant="outline" size="sm" onClick={handleCopyToClipboard} className="px-2 sm:px-3">
        <Copy className="h-4 w-4 sm:mr-1" />
        <span className="hidden sm:inline">Copy</span>
      </Button>
      <Button variant="outline" size="sm" onClick={handleDownloadCSV} className="px-2 sm:px-3">
        <Download className="h-4 w-4 sm:mr-1" />
        <span className="hidden sm:inline">CSV</span>
      </Button>
    </div>
  );
};

export default GroceryExportMenu;
