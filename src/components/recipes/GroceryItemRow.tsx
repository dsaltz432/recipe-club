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
  onEditText?: (originalName: string, newText: string) => void;
  onRemove?: (itemName: string) => void;
  isChecked?: boolean;
  onToggleChecked?: () => void;
  recipeColorMap?: Record<string, string>;
}

const GroceryItemRow = ({ item, editable, onEdit, onEditText, onRemove, isChecked, onToggleChecked, recipeColorMap }: GroceryItemRowProps) => {
  const useSingleField = !!onEditText;
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(item.name);
  const [editQuantity, setEditQuantity] = useState(
    item.totalQuantity != null ? String(item.totalQuantity) : ""
  );
  const [editUnit, setEditUnit] = useState(item.unit ?? "");
  const [editText, setEditText] = useState("");

  const displayText = formatGroceryItem(item);

  const handleStartEdit = () => {
    if (useSingleField) {
      setEditText(formatGroceryItem(item));
    } else {
      setEditName(item.name);
      setEditQuantity(item.totalQuantity != null ? String(item.totalQuantity) : "");
      setEditUnit(item.unit ?? "");
    }
    setIsEditing(true);
  };

  const handleSave = () => {
    if (useSingleField) {
      const trimmed = editText.trim();
      if (!trimmed) {
        setIsEditing(false);
        return;
      }
      onEditText(item.name, trimmed);
      setIsEditing(false);
      return;
    }
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
        {useSingleField ? (
          <Input
            name="edit-grocery-text"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            placeholder="e.g. 3 tbsp olive oil"
            className="flex-1 h-9 sm:h-7 text-sm"
            onKeyDown={handleKeyDown}
            aria-label="Edit item text"
            autoFocus
          />
        ) : (
          <>
            <Input
              name="edit-grocery-qty"
              value={editQuantity}
              onChange={(e) => setEditQuantity(e.target.value)}
              placeholder="Qty"
              className="w-16 h-9 sm:h-7 text-sm"
              onKeyDown={handleKeyDown}
              aria-label="Quantity"
            />
            <Input
              name="edit-grocery-unit"
              value={editUnit}
              onChange={(e) => setEditUnit(e.target.value)}
              placeholder="Unit"
              className="w-20 h-9 sm:h-7 text-sm"
              onKeyDown={handleKeyDown}
              aria-label="Unit"
            />
            <Input
              name="edit-grocery-name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Item name"
              className="flex-1 h-9 sm:h-7 text-sm"
              onKeyDown={handleKeyDown}
              aria-label="Item name"
            />
          </>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSave}
          className="h-9 w-9 sm:h-7 sm:w-7 p-0"
          aria-label="Save edit"
        >
          <Check className="h-3.5 w-3.5 text-green-600" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCancel}
          className="h-9 w-9 sm:h-7 sm:w-7 p-0"
          aria-label="Cancel edit"
        >
          <X className="h-3.5 w-3.5 text-gray-500" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between py-0.5 px-2 hover:bg-gray-50 rounded group">
      <div className="flex items-center gap-1.5 min-w-0">
        {onToggleChecked && (
          <button
            type="button"
            onClick={onToggleChecked}
            style={{ minHeight: 0, minWidth: 0 }}
            className={`h-5 w-5 shrink-0 self-center appearance-none rounded inline-flex items-center justify-center border transition-colors cursor-pointer ${
              isChecked
                ? "bg-purple border-purple"
                : "border-gray-300 hover:border-gray-400"
            }`}
            aria-label={isChecked ? "Uncheck item" : "Check item"}
          >
            {isChecked && <Check className="h-3 w-3 text-white" />}
          </button>
        )}
        <span className={`text-sm ${isChecked ? "line-through opacity-50" : ""}`}>{displayText}</span>
      </div>
      <div className="flex gap-1 ml-2 shrink-0 items-center">
        {item.sourceRecipes.map((recipe) =>
          recipeColorMap ? (
            <span
              key={recipe}
              className={`inline-block h-2.5 w-2.5 rounded-full shrink-0 ${recipeColorMap[recipe] ?? "bg-gray-400"}`}
              title={recipe}
            />
          ) : (
            <Badge
              key={recipe}
              variant="secondary"
              className="text-xs px-1.5 py-0"
            >
              {recipe}
            </Badge>
          )
        )}
        {(editable || onEditText || onRemove) && (
          <>
            {(editable || onEditText) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleStartEdit}
                className="h-5 w-5 p-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                aria-label="Edit item"
              >
                <Pencil className="h-3 w-3 text-gray-500" />
              </Button>
            )}
            {(editable || onRemove) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRemove?.(item.name)}
                className="h-5 w-5 p-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                aria-label="Remove item"
              >
                <Trash2 className="h-3 w-3 text-red-500" />
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default GroceryItemRow;
