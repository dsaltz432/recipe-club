import { useState } from "react";
import { Pencil, Trash2, Check, X } from "lucide-react";
import type { SmartGroceryItem } from "@/types";
import { formatGroceryItem } from "@/lib/groceryList";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export interface GroceryItemEdit {
  name: string;
  totalQuantity?: number;
  unit?: string;
}

interface GroceryItemRowProps {
  item: SmartGroceryItem;
  editable?: boolean;
  onEdit?: (originalName: string, edits: GroceryItemEdit) => void;
  onRemove?: (itemName: string) => void;
}

const GroceryItemRow = ({ item, editable, onEdit, onRemove }: GroceryItemRowProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(item.name);
  const [editQuantity, setEditQuantity] = useState(
    item.totalQuantity != null ? String(item.totalQuantity) : ""
  );
  const [editUnit, setEditUnit] = useState(item.unit ?? "");

  const displayText = formatGroceryItem(item);

  const handleStartEdit = () => {
    setEditName(item.name);
    setEditQuantity(item.totalQuantity != null ? String(item.totalQuantity) : "");
    setEditUnit(item.unit ?? "");
    setIsEditing(true);
  };

  const handleSave = () => {
    const trimmedName = editName.trim();
    if (!trimmedName) {
      setIsEditing(false);
      return;
    }
    const parsedQty = editQuantity.trim() ? Number(editQuantity.trim()) : undefined;
    const trimmedUnit = editUnit.trim() || undefined;
    onEdit?.(item.name, {
      name: trimmedName,
      totalQuantity: parsedQty,
      unit: trimmedUnit,
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-2 py-1.5 px-2 bg-gray-50 rounded">
        <Input
          name="edit-grocery-qty"
          value={editQuantity}
          onChange={(e) => setEditQuantity(e.target.value)}
          placeholder="Qty"
          className="w-16 h-7 text-sm"
          onKeyDown={handleKeyDown}
          aria-label="Quantity"
        />
        <Input
          name="edit-grocery-unit"
          value={editUnit}
          onChange={(e) => setEditUnit(e.target.value)}
          placeholder="Unit"
          className="w-20 h-7 text-sm"
          onKeyDown={handleKeyDown}
          aria-label="Unit"
        />
        <Input
          name="edit-grocery-name"
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          placeholder="Item name"
          className="flex-1 h-7 text-sm"
          onKeyDown={handleKeyDown}
          aria-label="Item name"
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSave}
          className="h-7 w-7 p-0"
          aria-label="Save edit"
        >
          <Check className="h-3.5 w-3.5 text-green-600" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCancel}
          className="h-7 w-7 p-0"
          aria-label="Cancel edit"
        >
          <X className="h-3.5 w-3.5 text-gray-500" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between py-1.5 px-2 hover:bg-gray-50 rounded group">
      <span className="text-sm">{displayText}</span>
      <div className="flex gap-1 ml-2 shrink-0 items-center">
        {item.sourceRecipes.map((recipe) => (
          <Badge
            key={recipe}
            variant="secondary"
            className="text-xs px-1.5 py-0"
          >
            {recipe}
          </Badge>
        ))}
        {editable && (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleStartEdit}
              className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Edit item"
            >
              <Pencil className="h-3 w-3 text-gray-500" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRemove?.(item.name)}
              className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Remove item"
            >
              <Trash2 className="h-3 w-3 text-red-500" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export default GroceryItemRow;
