import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CombinedGroceryItem } from "@/types";
import { generateCSV, downloadCSV, groupByCategory } from "@/lib/groceryList";

interface GroceryExportMenuProps {
  items: CombinedGroceryItem[];
  eventName: string;
}

const GroceryExportMenu = ({ items, eventName }: GroceryExportMenuProps) => {
  const handleDownloadCSV = () => {
    const grouped = groupByCategory(items);
    const csv = generateCSV(grouped);
    const filename = `grocery-list-${eventName.toLowerCase().replace(/\s+/g, "-")}.csv`;
    downloadCSV(csv, filename);
  };

  return (
    <Button variant="outline" size="sm" onClick={handleDownloadCSV}>
      <Download className="h-4 w-4 mr-1" />
      CSV
    </Button>
  );
};

export default GroceryExportMenu;
