import { useCallback, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, X, ClipboardPaste, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { GROCERY_CATEGORIES, CATEGORY_ORDER, detectCategory } from "@/lib/groceryList";
import { supabase } from "@/integrations/supabase/client";
import { createBlankRow } from "./ingredientRowTypes";
import type { IngredientRow } from "./ingredientRowTypes";
import type { GroceryCategory } from "@/types";

interface IngredientFormRowsProps {
  rows: IngredientRow[];
  onRowsChange: (rows: IngredientRow[]) => void;
}

const categoryOptions = CATEGORY_ORDER.map((cat) => (
  <SelectItem key={cat} value={cat}>
    {GROCERY_CATEGORIES[cat]}
  </SelectItem>
));

const VALID_CATEGORIES = new Set<string>([
  "produce", "meat_seafood", "dairy", "pantry", "spices",
  "frozen", "bakery", "beverages", "condiments", "other",
]);

const IngredientFormRows = ({ rows, onRowsChange }: IngredientFormRowsProps) => {
  const [showPasteArea, setShowPasteArea] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [isParsing, setIsParsing] = useState(false);

  const handleParse = useCallback(async () => {
    if (!pasteText.trim()) return;
    setIsParsing(true);
    try {
      const { data, error } = await supabase.functions.invoke("parse-grocery-text", {
        body: { text: pasteText },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error ?? "Failed to parse ingredients");
      if (data.skipped) {
        toast.error("Ingredient parsing is not available in dev mode.");
        return;
      }
      const parsedItems: IngredientRow[] = (data.items as Array<{ name: string; quantity: number | null; unit: string | null; category: string }>).map(
        (item) => ({
          id: `parsed-${crypto.randomUUID()}`,
          name: item.name || "",
          quantity: item.quantity != null ? String(item.quantity) : "",
          unit: item.unit || "",
          category: (VALID_CATEGORIES.has(item.category) ? item.category : "other") as GroceryCategory,
        })
      );
      onRowsChange([...rows, ...parsedItems]);
      setPasteText("");
      setShowPasteArea(false);
    } catch {
      toast.error("Failed to parse ingredients. Please try again.");
    } finally {
      setIsParsing(false);
    }
  }, [pasteText, rows, onRowsChange]);

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

      {/* Paste ingredients area */}
      {showPasteArea && (
        <div className="space-y-2 border rounded-md p-3">
          <Textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder="Paste your ingredients here (e.g., 2 cups flour, 1 lb chicken, olive oil...)"
            className="min-h-[80px] text-sm"
            aria-label="Paste ingredients text"
          />
          <div className="flex gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={handleParse}
              disabled={isParsing || !pasteText.trim()}
            >
              {isParsing ? (
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
              ) : null}
              {isParsing ? "Parsing..." : "Parse"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setShowPasteArea(false); setPasteText(""); }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Add row and paste buttons */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={addRow}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add Ingredient
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={() => setShowPasteArea(true)}
          disabled={showPasteArea}
        >
          <ClipboardPaste className="h-3.5 w-3.5 mr-1" />
          Paste ingredients
        </Button>
      </div>
    </div>
  );
};

export default IngredientFormRows;
