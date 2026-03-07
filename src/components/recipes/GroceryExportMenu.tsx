import { Download, Copy, ShoppingCart } from "lucide-react";
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
    <div className="flex gap-0.5">
      <Button variant="ghost" size="sm" onClick={handleCopyToClipboard} className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground" title="Copy to clipboard">
        <Copy className="h-3.5 w-3.5" />
      </Button>
      <Button variant="ghost" size="sm" onClick={handleDownloadCSV} className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground" title="Download CSV">
        <Download className="h-3.5 w-3.5" />
      </Button>
      <Button variant="ghost" size="sm" disabled className="h-7 w-7 p-0 text-muted-foreground/40" title="Instacart (Coming Soon)">
        <ShoppingCart className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
};

export default GroceryExportMenu;
