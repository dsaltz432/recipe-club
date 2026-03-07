import { Check } from "lucide-react";
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
  const visibleItems = checkedItems ? items.filter(i => !checkedItems.has(i.name)) : items;
  const allChecked = checkedItems !== undefined && items.length > 0 && visibleItems.length === 0;

  return (
    <div className={`mb-3 ${allChecked ? "opacity-50" : ""}`}>
      <div className="flex items-center gap-2 mb-1">
        <Badge variant="outline" className="text-xs font-semibold uppercase tracking-wide">
          {displayName}
        </Badge>
        <span className="text-xs text-gray-400">({items.length})</span>
        {allChecked && <Check className="h-3.5 w-3.5 text-green-500" />}
      </div>
      <div>
        {visibleItems.map((item, index) => (
          <GroceryItemRow
            key={getItemKey(item, index)}
            item={item}
            editable={editable}
            onEdit={onEditItem}
            onEditText={onEditItemText}
            onRemove={onRemoveItem}
            isChecked={false}
            onToggleChecked={onToggleChecked ? () => onToggleChecked(item.name) : undefined}
            recipeColorMap={recipeColorMap}
          />
        ))}
      </div>
    </div>
  );
};

export default GroceryCategoryGroup;
