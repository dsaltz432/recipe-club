import { useState, useRef } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Ingredient } from "@/types";

interface IngredientComboboxProps {
  ingredients: Ingredient[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

const IngredientCombobox = ({ ingredients, value, onChange, className }: IngredientComboboxProps) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedIngredient = ingredients.find((i) => i.id === value);

  const filtered = search.trim()
    ? ingredients.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()))
    : ingredients;

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setSearch("");
      setTimeout(() => inputRef.current?.focus(), 0);
    }
    setOpen(newOpen);
  };

  const handleSelect = (ingredientId: string) => {
    onChange(ingredientId === value ? "all" : ingredientId);
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("all");
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Filter by ingredient"
          className={cn(
            "justify-between font-normal text-sm",
            value === "all" ? "text-muted-foreground" : "text-foreground",
            className
          )}
        >
          <span className="truncate">
            {selectedIngredient ? selectedIngredient.name : "All Ingredients"}
          </span>
          <span className="ml-1 flex items-center shrink-0">
            {value !== "all" ? (
              <X
                className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground transition-colors"
                onClick={handleClear}
                aria-label="Clear ingredient filter"
              />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0" style={{ width: "var(--radix-popover-trigger-width)" }}>
        <div className="p-2 border-b">
          <Input
            ref={inputRef}
            placeholder="Search ingredients..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-sm"
          />
        </div>
        <ul
          className="max-h-56 overflow-y-auto py-1"
          role="listbox"
          aria-label="Ingredients"
        >
          <li>
            <button
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-purple-50 transition-colors text-left",
                value === "all" && "font-medium text-purple-700"
              )}
              role="option"
              aria-selected={value === "all"}
              onClick={() => { onChange("all"); setOpen(false); }}
            >
              <Check className={cn("h-3.5 w-3.5 shrink-0", value === "all" ? "opacity-100 text-purple-600" : "opacity-0")} />
              All Ingredients
            </button>
          </li>
          {filtered.length === 0 ? (
            <li className="px-3 py-4 text-sm text-muted-foreground text-center">No ingredients found</li>
          ) : (
            filtered.map((ingredient) => (
              <li key={ingredient.id}>
                <button
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-purple-50 transition-colors text-left",
                    value === ingredient.id && "font-medium text-purple-700"
                  )}
                  role="option"
                  aria-selected={value === ingredient.id}
                  onClick={() => handleSelect(ingredient.id)}
                >
                  <Check
                    className={cn(
                      "h-3.5 w-3.5 shrink-0",
                      value === ingredient.id ? "opacity-100 text-purple-600" : "opacity-0"
                    )}
                  />
                  {ingredient.name}
                </button>
              </li>
            ))
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
};

export default IngredientCombobox;
