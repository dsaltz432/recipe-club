import type { CombinedGroceryItem, SmartGroceryItem, GroceryCategory } from "@/types";
import { GROCERY_CATEGORIES } from "@/lib/groceryList";
import { Badge } from "@/components/ui/badge";
import GroceryItemRow from "./GroceryItemRow";

interface GroceryCategoryGroupProps {
  category: GroceryCategory;
  items: (CombinedGroceryItem | SmartGroceryItem)[];
}

function getItemKey(item: CombinedGroceryItem | SmartGroceryItem, index: number): string {
  return `${item.name}-${item.unit ?? ""}-${index}`;
}

const GroceryCategoryGroup = ({ category, items }: GroceryCategoryGroupProps) => {
  const displayName = GROCERY_CATEGORIES[category];

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        <Badge variant="outline" className="text-xs font-semibold uppercase tracking-wide">
          {displayName}
        </Badge>
        <span className="text-xs text-gray-400">({items.length})</span>
      </div>
      <div className="space-y-0.5">
        {items.map((item, index) => (
          <GroceryItemRow key={getItemKey(item, index)} item={item} />
        ))}
      </div>
    </div>
  );
};

export default GroceryCategoryGroup;
