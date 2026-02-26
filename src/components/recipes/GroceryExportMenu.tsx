import { Download, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CombinedGroceryItem, SmartGroceryItem } from "@/types";
import { generateCSV, generatePlainText, downloadCSV, groupByCategory } from "@/lib/groceryList";
import { toast } from "sonner";

interface GroceryExportMenuProps {
  items: (CombinedGroceryItem | SmartGroceryItem)[];
  eventName: string;
}

const GroceryExportMenu = ({ items, eventName }: GroceryExportMenuProps) => {
  const handleDownloadCSV = () => {
    const grouped = groupByCategory(items);
    const csv = generateCSV(grouped);
    const filename = `grocery-list-${eventName.toLowerCase().replace(/\s+/g, "-")}.csv`;
    downloadCSV(csv, filename);
  };

  const handleCopyToClipboard = async () => {
    const grouped = groupByCategory(items);
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
      <Button variant="outline" size="sm" onClick={handleCopyToClipboard}>
        <Copy className="h-4 w-4 mr-1" />
        Copy
      </Button>
      <Button variant="outline" size="sm" onClick={handleDownloadCSV}>
        <Download className="h-4 w-4 mr-1" />
        CSV
      </Button>
    </div>
  );
};

export default GroceryExportMenu;
