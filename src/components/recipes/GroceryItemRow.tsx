import type { CombinedGroceryItem, SmartGroceryItem } from "@/types";
import { formatGroceryItem } from "@/lib/groceryList";
import { Badge } from "@/components/ui/badge";

interface GroceryItemRowProps {
  item: CombinedGroceryItem | SmartGroceryItem;
}

const GroceryItemRow = ({ item }: GroceryItemRowProps) => {
  const displayText = formatGroceryItem(item);

  return (
    <div className="flex items-center justify-between py-1.5 px-2 hover:bg-gray-50 rounded">
      <span className="text-sm">{displayText}</span>
      <div className="flex gap-1 ml-2 shrink-0">
        {item.sourceRecipes.map((recipe) => (
          <Badge
            key={recipe}
            variant="secondary"
            className="text-xs px-1.5 py-0"
          >
            {recipe}
          </Badge>
        ))}
      </div>
    </div>
  );
};

export default GroceryItemRow;
