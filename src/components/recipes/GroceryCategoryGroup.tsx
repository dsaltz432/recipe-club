import type { SmartGroceryItem, GroceryCategory } from "@/types";
import { GROCERY_CATEGORIES } from "@/lib/groceryList";
import { Badge } from "@/components/ui/badge";
import GroceryItemRow from "./GroceryItemRow";
import type { GroceryItemEdit } from "./GroceryItemRow";

interface GroceryCategoryGroupProps {
  category: GroceryCategory;
  items: SmartGroceryItem[];
  editable?: boolean;
  onEditItem?: (originalName: string, edits: GroceryItemEdit) => void;
  onEditItemText?: (originalName: string, newText: string) => void;
  onRemoveItem?: (itemName: string) => void;
  checkedItems?: Set<string>;
  onToggleChecked?: (itemName: string) => void;
  recipeColorMap?: Record<string, string>;
}

function getItemKey(item: SmartGroceryItem, index: number): string {
  return `${item.name}-${item.unit ?? ""}-${index}`;
}

const GroceryCategoryGroup = ({ category, items, editable, onEditItem, onEditItemText, onRemoveItem, checkedItems, onToggleChecked, recipeColorMap }: GroceryCategoryGroupProps) => {
  const displayName = GROCERY_CATEGORIES[category];

  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 mb-2">
        <Badge variant="outline" className="text-xs font-semibold uppercase tracking-wide">
          {displayName}
        </Badge>
        <span className="text-xs text-gray-400">({items.length})</span>
      </div>
      <div>
        {items.map((item, index) => (
          <GroceryItemRow
            key={getItemKey(item, index)}
            item={item}
            editable={editable}
            onEdit={onEditItem}
            onEditText={onEditItemText}
            onRemove={onRemoveItem}
            isChecked={checkedItems?.has(item.name)}
            onToggleChecked={onToggleChecked ? () => onToggleChecked(item.name) : undefined}
            recipeColorMap={recipeColorMap}
          />
        ))}
      </div>
    </div>
  );
};

export default GroceryCategoryGroup;
