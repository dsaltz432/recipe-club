import type { RecipeIngredient, GroceryCategory, SmartGroceryItem } from "@/types";
import { supabase } from "@/integrations/supabase/client";

export interface SmartCombineResult {
  items: SmartGroceryItem[];
  displayNameMap: Record<string, string>;
}


export const GROCERY_CATEGORIES: Record<GroceryCategory, string> = {
  produce: "Produce",
  meat_seafood: "Protein",
  dairy: "Dairy",
  pantry: "Pantry",
  spices: "Spices",
  frozen: "Frozen",
  bakery: "Bakery",
  beverages: "Beverages",
  condiments: "Condiments",
  other: "Other",
};

export const CATEGORY_ORDER: GroceryCategory[] = [
  "produce",
  "meat_seafood",
  "dairy",
  "pantry",
  "spices",
  "frozen",
  "bakery",
  "beverages",
  "condiments",
  "other",
];

const FRACTION_MAP: [number, string][] = [
  [0.125, "1/8"],
  [0.25, "1/4"],
  [0.333, "1/3"],
  [0.375, "3/8"],
  [0.5, "1/2"],
  [0.625, "5/8"],
  [0.667, "2/3"],
  [0.75, "3/4"],
  [0.875, "7/8"],
];

// Override categories that the AI parser frequently gets wrong
export const CATEGORY_OVERRIDES: Record<string, GroceryCategory> = {
  "olive oil": "pantry",
  "vegetable oil": "pantry",
  "canola oil": "pantry",
  "coconut oil": "pantry",
  "sesame oil": "pantry",
  "avocado oil": "pantry",
  "tofu": "meat_seafood",
  "tempeh": "meat_seafood",
  "seitan": "meat_seafood",
  "egg": "pantry",
  "egg yolk": "pantry",
  "egg white": "pantry",
  "ghee": "pantry",
  "tomato paste": "pantry",
  "sesame seed": "pantry",
  "water": "other",
  "chicken stock": "pantry",
  "low sodium chicken stock": "pantry",
  "beef stock": "pantry",
  "vegetable stock": "pantry",
};

export function decimalToFraction(value: number): string {
  if (Number.isInteger(value)) return value.toString();

  const whole = Math.floor(value);
  const decimal = value - whole;

  for (const [target, fraction] of FRACTION_MAP) {
    if (Math.abs(decimal - target) < 0.02) {
      return whole > 0 ? `${whole} ${fraction}` : fraction;
    }
  }

  const str = value.toFixed(2).replace(/\.?0+$/, "");
  return str;
}

export function groupByCategory<T extends { category: GroceryCategory }>(
  items: T[]
): Map<GroceryCategory, T[]> {
  const map = new Map<GroceryCategory, T[]>();
  for (const category of CATEGORY_ORDER) {
    const categoryItems = items.filter((item) => item.category === category);
    if (categoryItems.length > 0) {
      map.set(category, categoryItems);
    }
  }
  return map;
}

// Abbreviated units that should never be pluralized
const ABBREVIATION_UNITS = new Set(["tsp", "tbsp", "oz", "lb", "g", "kg", "ml"]);

// "Part of ingredient" units where name reads before unit: "5 celery stalks" not "5 stalks celery"
const NAME_FIRST_UNITS = new Set([
  "stalk", "strip", "ear", "clove", "head", "bunch", "sprig", "piece", "slice", "rib",
]);

// Plural forms for count-based units (a small, closed set)
const UNIT_PLURAL_MAP: Record<string, string> = {
  stalk: "stalks",
  strip: "strips",
  ear: "ears",
  clove: "cloves",
  head: "heads",
  bunch: "bunches",
  sprig: "sprigs",
  piece: "pieces",
  slice: "slices",
  rib: "ribs",
  can: "cans",
  bottle: "bottles",
  cup: "cups",
  pinch: "pinches",
  dash: "dashes",
  liter: "liters",
};

function pluralizeUnit(unit: string, quantity: number): string {
  if (quantity <= 1) return unit;
  if (ABBREVIATION_UNITS.has(unit)) return unit;
  return UNIT_PLURAL_MAP[unit] ?? unit;
}

export function formatGroceryItem(item: SmartGroceryItem): string {
  const parts: string[] = [];
  const qty = item.totalQuantity;
  if (qty != null) {
    parts.push(decimalToFraction(qty));
  }

  const nameToDisplay = item.displayName || item.name;

  const isNameFirst = item.unit != null && NAME_FIRST_UNITS.has(item.unit);

  if (isNameFirst) {
    // "5 celery stalks" — name before unit
    parts.push(nameToDisplay);
    parts.push(qty != null ? pluralizeUnit(item.unit!, qty) : item.unit!);
  } else {
    if (item.unit) {
      parts.push(qty != null ? pluralizeUnit(item.unit, qty) : item.unit);
    }
    parts.push(nameToDisplay);
  }

  return parts.join(" ");
}

export function generateCSV(
  groupedItems: Map<GroceryCategory, SmartGroceryItem[]>
): string {
  const rows: string[] = ["Category,Item,Quantity,Unit,Recipes"];
  for (const [category, items] of groupedItems) {
    const categoryName = GROCERY_CATEGORIES[category];
    for (const item of items) {
      const qty = item.totalQuantity != null ? decimalToFraction(item.totalQuantity) : "";
      const unit = item.unit ?? "";
      const recipes = item.sourceRecipes.join("; ");
      const itemName = item.displayName || item.name;
      const escapedName = itemName.includes(",") ? `"${itemName}"` : itemName;
      const escapedRecipes = recipes.includes(",") ? `"${recipes}"` : recipes;
      rows.push(
        `${categoryName},${escapedName},${qty},${unit},${escapedRecipes}`
      );
    }
  }
  return rows.join("\n");
}

export function filterSmartPantryItems(
  items: SmartGroceryItem[],
  pantryItems: string[]
): SmartGroceryItem[] {
  const normalizedPantry = new Set(pantryItems.map(n => n.toLowerCase().trim()));
  return items.filter((item) => !normalizedPantry.has(item.name.toLowerCase().trim()));
}

export async function smartCombineIngredients(
  ingredients: RecipeIngredient[],
  recipeNameMap: Record<string, string>,
  perRecipeNames?: string[]
): Promise<SmartCombineResult> {
  // Map raw ingredients for the AI edge function
  const preCombined = ingredients.map((ing) => ({
    name: ing.name,
    quantity: ing.quantity != null ? decimalToFraction(ing.quantity) : null,
    unit: ing.unit ?? null,
    category: ing.category,
    sourceRecipes: [recipeNameMap[ing.recipeId] ?? "Unknown Recipe"],
  }));

  try {
    const { data, error } = await supabase.functions.invoke("combine-ingredients", {
      body: { preCombined, perRecipeNames },
    });

    if (error) throw error;

    if (data?.skipped || !data?.items) {
      throw new Error("AI returned skipped or no items");
    }

    return {
      items: data.items as SmartGroceryItem[],
      displayNameMap: (data.displayNameMap as Record<string, string>) || {},
    };
  } catch (error) {
    console.error("Smart combine failed:", error);
    throw error;
  }
}

export function generatePlainText(
  groupedItems: Map<GroceryCategory, SmartGroceryItem[]>
): string {
  const lines: string[] = [];
  for (const [category, items] of groupedItems) {
    lines.push(GROCERY_CATEGORIES[category].toUpperCase());
    for (const item of items) {
      lines.push(`  ${formatGroceryItem(item)}`);
    }
    lines.push("");
  }
  return lines.join("\n").trim();
}

export function downloadCSV(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function detectCategory(name: string): GroceryCategory {
  const normalized = name.toLowerCase().trim();
  return CATEGORY_OVERRIDES[normalized] ?? "other";
}

export function parseFractionToDecimal(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  // Pure decimal or integer: "2.5", "3"
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    return parseFloat(trimmed);
  }

  // Pure fraction: "1/2"
  const fractionMatch = trimmed.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (fractionMatch) {
    const num = parseInt(fractionMatch[1]);
    const den = parseInt(fractionMatch[2]);
    return den === 0 ? undefined : num / den;
  }

  // Mixed number: "1 1/2"
  const mixedMatch = trimmed.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
  if (mixedMatch) {
    const whole = parseInt(mixedMatch[1]);
    const num = parseInt(mixedMatch[2]);
    const den = parseInt(mixedMatch[3]);
    return den === 0 ? undefined : whole + num / den;
  }

  return undefined;
}
