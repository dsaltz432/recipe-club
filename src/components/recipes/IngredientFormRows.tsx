import { useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, X } from "lucide-react";
import { GROCERY_CATEGORIES, CATEGORY_ORDER, detectCategory } from "@/lib/groceryList";
import { createBlankRow } from "./ingredientRowTypes";
import type { IngredientRow } from "./ingredientRowTypes";

interface IngredientFormRowsProps {
  rows: IngredientRow[];
  onRowsChange: (rows: IngredientRow[]) => void;
}

const categoryOptions = CATEGORY_ORDER.map((cat) => (
  <SelectItem key={cat} value={cat}>
    {GROCERY_CATEGORIES[cat]}
  </SelectItem>
));

const IngredientFormRows = ({ rows, onRowsChange }: IngredientFormRowsProps) => {
  const updateRow = useCallback(
    (id: string, field: keyof IngredientRow, value: string) => {
      onRowsChange(
        rows.map((row) => {
          if (row.id !== id) return row;
          const updated = { ...row, [field]: value };
          // Auto-detect category when name changes
          if (field === "name" && value.trim()) {
            updated.category = detectCategory(value);
          }
          return updated;
        })
      );
    },
    [rows, onRowsChange]
  );

  const removeRow = useCallback(
    (id: string) => {
      onRowsChange(rows.filter((row) => row.id !== id));
    },
    [rows, onRowsChange]
  );

  const addRow = useCallback(() => {
    onRowsChange([...rows, createBlankRow()]);
  }, [rows, onRowsChange]);

  const handleNameKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === "Enter" && index === rows.length - 1) {
      e.preventDefault();
      addRow();
    }
  };

  const renderCategorySelect = (row: IngredientRow, index: number, className: string) => (
    <Select
      name={`cat-${row.id}`}
      value={row.category}
      onValueChange={(val) => updateRow(row.id, "category", val)}
    >
      <SelectTrigger className={className} aria-label={`Category for row ${index + 1}`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>{categoryOptions}</SelectContent>
    </Select>
  );

  return (
    <div className="space-y-2">
      {/* Header - desktop only */}
      <div className="hidden sm:grid grid-cols-[60px_70px_1fr_120px_32px] gap-1.5 text-xs font-medium text-muted-foreground px-0.5">
        <span>Qty</span>
        <span>Unit</span>
        <span>Name</span>
        <span>Category</span>
        <span></span>
      </div>

      {/* Rows */}
      {rows.map((row, index) => (
        <div key={row.id} className="space-y-1.5 sm:space-y-0">
          <div className="grid grid-cols-[50px_60px_1fr_36px] sm:grid-cols-[60px_70px_1fr_120px_32px] gap-1.5 items-center">
            <Input
              name={`qty-${row.id}`}
              value={row.quantity}
              onChange={(e) => updateRow(row.id, "quantity", e.target.value)}
              placeholder="Qty"
              className="h-9 sm:h-8 text-sm"
              aria-label={`Quantity for row ${index + 1}`}
            />
            <Input
              name={`unit-${row.id}`}
              value={row.unit}
              onChange={(e) => updateRow(row.id, "unit", e.target.value)}
              placeholder="Unit"
              className="h-9 sm:h-8 text-sm"
              aria-label={`Unit for row ${index + 1}`}
            />
            <Input
              name={`name-${row.id}`}
              value={row.name}
              onChange={(e) => updateRow(row.id, "name", e.target.value)}
              onKeyDown={(e) => handleNameKeyDown(e, index)}
              placeholder="Ingredient name"
              className="h-9 sm:h-8 text-sm"
              aria-label={`Name for row ${index + 1}`}
            />
            {/* Category - inline on desktop, hidden on mobile */}
            <div className="hidden sm:block">
              {renderCategorySelect(row, index, "h-8 text-xs")}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-9 w-9 sm:h-8 sm:w-8 p-0"
              onClick={() => removeRow(row.id)}
              aria-label={`Remove row ${index + 1}`}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
          {/* Category - full width on mobile, hidden on desktop */}
          <div className="sm:hidden">
            {renderCategorySelect(row, index, "h-9 text-xs w-full")}
          </div>
        </div>
      ))}

      {/* Add row button */}
      <Button
        variant="outline"
        size="sm"
        className="w-full"
        onClick={addRow}
      >
        <Plus className="h-3.5 w-3.5 mr-1" />
        Add Ingredient
      </Button>
    </div>
  );
};

export default IngredientFormRows;
