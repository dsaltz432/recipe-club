import type { GroceryCategory } from "@/types";

export interface IngredientRow {
  id: string;
  quantity: string;
  unit: string;
  name: string;
  category: GroceryCategory;
}

let nextId = 1;
export function createBlankRow(): IngredientRow {
  return {
    id: `new-${nextId++}`,
    quantity: "",
    unit: "",
    name: "",
    category: "other",
  };
}
