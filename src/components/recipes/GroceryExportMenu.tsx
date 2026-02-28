import { useState } from "react";
import { Download, Copy, ShoppingCart, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SmartGroceryItem } from "@/types";
import { generateCSV, generatePlainText, downloadCSV, groupByCategory } from "@/lib/groceryList";
import { sendToInstacart } from "@/lib/instacart";
import { toast } from "sonner";

interface GroceryExportMenuProps {
  items: SmartGroceryItem[];
  eventName: string;
}

const GroceryExportMenu = ({ items, eventName }: GroceryExportMenuProps) => {
  const [isInstacartLoading, setIsInstacartLoading] = useState(false);

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

  const handleInstacart = async () => {
    setIsInstacartLoading(true);
    try {
      const url = await sendToInstacart(items, eventName);
      window.open(url, "_blank");
    } catch {
      toast.error("Failed to send to Instacart. Please try again.");
    } finally {
      setIsInstacartLoading(false);
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
      <Button
        variant="outline"
        size="sm"
        onClick={handleInstacart}
        disabled={isInstacartLoading || items.length === 0}
        className="px-2 sm:px-3"
      >
        {isInstacartLoading ? (
          <Loader2 className="h-4 w-4 sm:mr-1 animate-spin" />
        ) : (
          <ShoppingCart className="h-4 w-4 sm:mr-1" />
        )}
        <span className="hidden sm:inline">Instacart</span>
      </Button>
    </div>
  );
};

export default GroceryExportMenu;
