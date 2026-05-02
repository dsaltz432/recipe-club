import { useEffect, useState } from "react";
import { Download, Copy, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SmartGroceryItem } from "@/types";
import { generateCSV, generatePlainText, downloadCSV, groupByCategory } from "@/lib/groceryList";
import { getCurrentUser } from "@/lib/auth";
import { isAnyListEnabledForUser, sendToAnyList, openAnyList } from "@/lib/anylist";
import { toast } from "sonner";

interface GroceryExportMenuProps {
  items: SmartGroceryItem[];
  eventName: string;
  checkedItems?: Set<string>;
}

const GroceryExportMenu = ({ items, eventName, checkedItems }: GroceryExportMenuProps) => {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isSendingToAnyList, setIsSendingToAnyList] = useState(false);

  useEffect(() => {
    getCurrentUser().then((user) => setUserEmail(user?.email ?? null));
  }, []);

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

  const handleSendToAnyList = async () => {
    setIsSendingToAnyList(true);
    try {
      const result = await sendToAnyList({ items, eventName, checkedItems });
      toast.success(`Synced ${result.itemsAdded} item${result.itemsAdded === 1 ? "" : "s"} to AnyList`);
      openAnyList();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to sync to AnyList");
    } finally {
      setIsSendingToAnyList(false);
    }
  };

  const showAnyListButton = isAnyListEnabledForUser(userEmail);

  return (
    <div className="flex gap-0.5">
      <Button variant="ghost" size="sm" onClick={handleCopyToClipboard} className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground" title="Copy to clipboard">
        <Copy className="h-3.5 w-3.5" />
      </Button>
      <Button variant="ghost" size="sm" onClick={handleDownloadCSV} className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground" title="Download CSV">
        <Download className="h-3.5 w-3.5" />
      </Button>
      {showAnyListButton && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSendToAnyList}
          disabled={uncheckedItems.length === 0 || isSendingToAnyList}
          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
          title={isSendingToAnyList ? "Syncing to AnyList..." : "Sync to AnyList (replaces existing items in the list)"}
        >
          {isSendingToAnyList ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
        </Button>
      )}
    </div>
  );
};

export default GroceryExportMenu;
