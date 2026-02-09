import type { RecipeIngredient, GroceryCategory, CombinedGroceryItem, SmartGroceryItem } from "@/types";
import { supabase } from "@/integrations/supabase/client";


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

const UNIT_MAP: Record<string, string> = {
  cups: "cup",
  tablespoons: "tbsp",
  tablespoon: "tbsp",
  teaspoons: "tsp",
  teaspoon: "tsp",
  ounces: "oz",
  ounce: "oz",
  pounds: "lb",
  pound: "lb",
  cloves: "clove",
  slices: "slice",
  pieces: "piece",
  cans: "can",
  bottles: "bottle",
  bunches: "bunch",
  heads: "head",
  stalks: "stalk",
  ribs: "rib",
  strips: "strip",
  ears: "ear",
  sprigs: "sprig",
  pinches: "pinch",
  dashes: "dash",
  liters: "liter",
  milliliters: "ml",
  grams: "g",
  kilograms: "kg",
};

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

const COOKING_ADJECTIVES = [
  "fresh", "dried", "minced", "diced", "chopped", "sliced", "grated",
  "shredded", "crushed", "ground", "toasted", "roasted", "raw", "cooked",
  "frozen", "canned", "organic", "boneless", "skinless", "thinly",
  "finely", "roughly", "cold", "hot", "warm", "large", "small", "medium",
  "whole", "halved", "quartered", "peeled", "deseeded", "trimmed",
  "unsalted", "unsweetened", "reduced-sodium", "low-sodium",
];

// Compound names where a modifier identifies a distinct product
const PRESERVED_COMPOUNDS = new Set([
  "crushed tomato",
  "crushed tomatoes",
  "peeled whole tomato",
  "peeled whole tomatoes",
  "ground beef",
  "ground turkey",
  "ground pork",
  "ground lamb",
  "ground chicken",
  "whole chicken",
]);

const INGREDIENT_ALIASES: Record<string, string> = {
  "corn starch": "cornstarch",
  "soy bean": "soybean",
  "green onion": "scallion",
  "spring onion": "scallion",
  "sea salt": "salt",
  "kosher salt": "salt",
  "table salt": "salt",
  "extra virgin olive oil": "olive oil",
  "bread crumb": "breadcrumbs",
  "breadcrumb": "breadcrumbs",
  "black pepper": "pepper",
  "white pepper": "pepper",
  "boston lettuce": "butter lettuce",
  "garlic clove": "garlic",
  "red pepper flake": "red pepper flakes",
  "all-purpose flour": "flour",
  "all purpose flour": "flour",
  "yellow onion": "onion",
  "sweet corn": "corn",
  "extra-virgin olive oil": "olive oil",
  "heavy whipping cream": "heavy cream",
  "yoghurt": "yogurt",
  "cilantro leaf": "cilantro",
  "coriander leaf": "cilantro",
  "flat-leaf parsley": "parsley",
  "white sugar": "sugar",
  "granulated sugar": "sugar",
  "tumeric": "turmeric",
  "beef mince": "ground beef",
  "lamb mince": "ground lamb",
  "tahini paste": "tahini",
  "dark brown sugar": "brown sugar",
  "scallion green": "scallion",
  "green onion top": "scallion",
  "jalapeno pepper": "jalapeno",
  "star anise pod": "star anise",
  "chicken breast half": "chicken breast",
  "white rice": "rice",
  "confectioners sugar": "powdered sugar",
  "confectioners' sugar": "powdered sugar",
  "chicken broth": "chicken stock",
  "low sodium chicken broth": "low sodium chicken stock",
  "beef broth": "beef stock",
  "vegetable broth": "vegetable stock",
  "chilli": "chili",
  "chile": "chili",
  "chilli powder": "chili powder",
  "chile powder": "chili powder",
  "chilli oil": "chili oil",
  "chile oil": "chili oil",
  "chilli flake": "chili flake",
  "chile flake": "chili flake",
  "dry white wine": "white wine",
};

// Override categories that the AI parser frequently gets wrong
const CATEGORY_OVERRIDES: Record<string, GroceryCategory> = {
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

// Unit aliases for combining (rib → stalk, slice → strip)
const UNIT_REMAP: Record<string, string> = {
  "rib": "stalk",
  "slice": "strip",
};

// Preferred count unit for volume-to-count merging
const PREFERRED_COUNT_UNIT: Record<string, string> = {
  "celery": "stalk",
  "bacon": "strip",
  "garlic": "clove",
  "corn": "ear",
  "broccoli": "head",
};

// Bulk unit conversion: when a count unit exceeds a threshold, convert to a larger unit
const BULK_CONVERSIONS: Record<string, { fromUnit: string; toUnit: string; ratio: number; threshold: number }> = {
  "garlic": { fromUnit: "clove", toUnit: "head", ratio: 10, threshold: 10 },
};

// How many cups equal 1 whole unit of a count-based ingredient
// Used to merge "1 cup chopped onion" with "2 onions" into a single count
const COUNT_TO_CUP: Record<string, number> = {
  "onion": 1,         // 1 medium onion ≈ 1 cup chopped
  "bell pepper": 1,   // 1 bell pepper ≈ 1 cup chopped
  "carrot": 0.5,      // 1 medium carrot ≈ 1/2 cup chopped
  "celery": 0.5,      // 1 stalk celery ≈ 1/2 cup chopped
  "zucchini": 1.25,   // 1 medium zucchini ≈ 1 1/4 cup chopped
  "garlic": 1/48,     // 1 clove garlic ≈ 1 tsp ≈ 1/48 cup
};

// How many lb equal 1 whole unit of a count-based ingredient
// Used to merge "1.25 lb potatoes" with "5 potatoes" into a single count
const COUNT_TO_LB: Record<string, number> = {
  "potato": 0.5,      // 1 medium potato ≈ 0.5 lb (8 oz)
  "broccoli": 1.25,   // 1 medium head broccoli ≈ 1.25 lb (20 oz)
};

// How many cups equal 1 can of a specific ingredient
// Used to merge "4 cans chicken broth" with "3 cups chicken broth" into volume
const CAN_TO_CUP: Record<string, number> = {
  "chicken broth": 1.8125,    // 1 can (14.5 oz) ≈ 1.8125 cups
  "chicken stock": 1.8125,
  "beef broth": 1.8125,
  "beef stock": 1.8125,
  "vegetable broth": 1.8125,
  "vegetable stock": 1.8125,
  "coconut milk": 1.75,       // 1 can (13.5 oz) ≈ 1.75 cups
};

// Volume conversions (everything relative to tsp)
const VOLUME_IN_TSP: Record<string, number> = {
  tsp: 1,
  tbsp: 3,
  cup: 48,
};

// Weight conversions (everything relative to oz)
const WEIGHT_IN_OZ: Record<string, number> = {
  g: 1 / 28.35,
  oz: 1,
  lb: 16,
  kg: 1000 / 28.35,
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

export function normalizeUnit(unit: string | undefined | null): string {
  if (!unit) return "";
  const lower = unit.toLowerCase().trim();
  return UNIT_MAP[lower] ?? lower;
}

export function normalizeIngredientName(name: string): string {
  let normalized = name.toLowerCase().trim();

  // Apply aliases (before adjective stripping)
  for (const [alias, canonical] of Object.entries(INGREDIENT_ALIASES)) {
    if (normalized === alias || normalized.endsWith(` ${alias}`)) {
      normalized = normalized.replace(alias, canonical);
    }
  }

  // Strip cooking adjectives from the beginning (unless it's a preserved compound)
  if (!PRESERVED_COMPOUNDS.has(normalized)) {
    let changed = true;
    while (changed) {
      changed = false;
      for (const adj of COOKING_ADJECTIVES) {
        if (normalized.startsWith(adj + " ")) {
          normalized = normalized.slice(adj.length + 1);
          changed = true;
        }
      }
    }
  }

  // Basic singularization
  if (normalized.endsWith("leaves")) {
    normalized = normalized.slice(0, -6) + "leaf";
  } else if (
    normalized.endsWith("ies") &&
    normalized.length > 4
  ) {
    normalized = normalized.slice(0, -3) + "y";
  } else if (
    normalized.endsWith("es") &&
    !normalized.endsWith("ses") &&
    !normalized.endsWith("ches") &&
    !normalized.endsWith("shes") &&
    !normalized.endsWith("kes") &&
    !normalized.endsWith("ves") &&
    normalized.length > 4
  ) {
    normalized = normalized.slice(0, -2);
  } else if (
    normalized.endsWith("s") &&
    !normalized.endsWith("ss") &&
    !normalized.endsWith("us") &&
    normalized.length > 3
  ) {
    normalized = normalized.slice(0, -1);
  }

  // Second alias pass (after singularization, e.g. "green onions" → "green onion" → "scallion")
  for (const [alias, canonical] of Object.entries(INGREDIENT_ALIASES)) {
    if (normalized === alias || normalized.endsWith(` ${alias}`)) {
      normalized = normalized.replace(alias, canonical);
    }
  }

  // Strip trailing count-unit words that belong in the unit field, not the name
  // e.g. "broccoli head" → "broccoli", "garlic clove" → "garlic"
  const COUNT_UNIT_WORDS = ["head", "bunch", "stalk", "clove", "sprig", "ear", "strip", "slice", "piece", "rib"];
  for (const word of COUNT_UNIT_WORDS) {
    if (normalized.endsWith(` ${word}`)) {
      normalized = normalized.slice(0, -(word.length + 1));
      break;
    }
  }

  // Untyped oil defaults to vegetable oil (exact match only — don't affect "olive oil", "sesame oil", etc.)
  if (normalized === "oil" || normalized === "cooking oil" || normalized === "neutral oil") {
    normalized = "vegetable oil";
  }

  return normalized;
}

function getConversionFamily(unit: string): { family: Record<string, number>; baseUnit: string } | null {
  if (unit in VOLUME_IN_TSP) return { family: VOLUME_IN_TSP, baseUnit: "tsp" };
  if (unit in WEIGHT_IN_OZ) return { family: WEIGHT_IN_OZ, baseUnit: "oz" };
  return null;
}

function convertToPreferredUnit(totalBase: number, family: Record<string, number>, minQuantity = 1): { quantity: number; unit: string } {
  const sorted = Object.entries(family).sort((a, b) => b[1] - a[1]); // largest first
  // Prefer the largest unit if it gives a reasonable amount (≥ 0.5)
  // e.g. 14 tbsp → ~7/8 cup rather than staying as tbsp
  const [largestUnit, largestFactor] = sorted[0];
  if (totalBase / largestFactor >= 0.5) return { quantity: totalBase / largestFactor, unit: largestUnit };
  for (const [unit, factor] of sorted) {
    const converted = totalBase / factor;
    if (converted >= minQuantity) return { quantity: converted, unit };
  }
  const smallest = sorted[sorted.length - 1];
  return { quantity: totalBase / smallest[1], unit: smallest[0] };
}

export function combineIngredients(
  ingredients: RecipeIngredient[],
  recipeNameMap: Record<string, string>
): CombinedGroceryItem[] {
  // Group by normalized name only (not name + unit)
  const grouped = new Map<string, {
    items: Array<{ quantity?: number; unit: string; recipeName: string }>;
    category: GroceryCategory;
  }>();

  for (const ing of ingredients) {
    const normalizedName = normalizeIngredientName(ing.name);
    const normalizedUnit = normalizeUnit(ing.unit);
    const recipeName = recipeNameMap[ing.recipeId] ?? "Unknown Recipe";

    const category = CATEGORY_OVERRIDES[normalizedName] ?? ing.category;
    const existing = grouped.get(normalizedName);
    if (existing) {
      existing.items.push({ quantity: ing.quantity ?? undefined, unit: normalizedUnit, recipeName });
    } else {
      grouped.set(normalizedName, {
        items: [{ quantity: ing.quantity ?? undefined, unit: normalizedUnit, recipeName }],
        category,
      });
    }
  }

  const results: CombinedGroceryItem[] = [];

  for (const [name, group] of grouped) {
    const sourceRecipes = [...new Set(group.items.map((i) => i.recipeName))];

    // Separate items by convertibility
    // Track: base amounts for each conversion family, and non-convertible items by unit
    const familyTotals = new Map<string, { totalBase: number; family: Record<string, number>; originalUnits: Set<string> }>();
    const plainTotals = new Map<string, { total: number | undefined; hasQuantity: boolean }>();

    for (const item of group.items) {
      const conv = item.unit ? getConversionFamily(item.unit) : null;

      if (conv && item.quantity != null) {
        const familyKey = conv.baseUnit;
        const baseAmount = item.quantity * conv.family[item.unit];
        const existing = familyTotals.get(familyKey);
        if (existing) {
          existing.totalBase += baseAmount;
          existing.originalUnits.add(item.unit);
        } else {
          familyTotals.set(familyKey, { totalBase: baseAmount, family: conv.family, originalUnits: new Set([item.unit]) });
        }
      } else {
        // Non-convertible: group by unit (apply remaps)
        const remappedUnit = item.unit ? (UNIT_REMAP[item.unit] ?? item.unit) : item.unit;
        let unitKey = remappedUnit || "";
        // Apply preferred count unit for bare counts (e.g. "3 celery" → "3 stalks celery")
        if (!unitKey && PREFERRED_COUNT_UNIT[name]) {
          unitKey = PREFERRED_COUNT_UNIT[name];
        }
        const existing = plainTotals.get(unitKey);
        if (existing) {
          if (item.quantity != null && existing.total != null) {
            existing.total += item.quantity;
          } else if (item.quantity != null) {
            existing.total = item.quantity;
            existing.hasQuantity = true;
          }
        } else {
          plainTotals.set(unitKey, { total: item.quantity, hasQuantity: item.quantity != null });
        }
      }
    }

    // Convert "can" entries to volume for ingredients with known can-to-cup ratio
    const canCupRatio = CAN_TO_CUP[name];
    if (canCupRatio != null && plainTotals.has("can")) {
      const canEntry = plainTotals.get("can")!;
      if (canEntry.hasQuantity && canEntry.total != null) {
        const tspFromCans = canEntry.total * canCupRatio * VOLUME_IN_TSP.cup;
        const existing = familyTotals.get("tsp");
        if (existing) {
          existing.totalBase += tspFromCans;
          existing.originalUnits.add("cup");
        } else {
          familyTotals.set("tsp", { totalBase: tspFromCans, family: VOLUME_IN_TSP, originalUnits: new Set(["cup"]) });
        }
        plainTotals.delete("can");
      }
    }

    // Merge volume into count for ingredients with known count-to-cup equivalence
    const cupRatio = COUNT_TO_CUP[name];
    const countKey = PREFERRED_COUNT_UNIT[name] ?? "";
    if (cupRatio != null && familyTotals.has("tsp")) {
      const volumeEntry = familyTotals.get("tsp")!;
      // Convert volume (in tsp) to count: tsp → cups → whole units
      const cupsTotal = volumeEntry.totalBase / VOLUME_IN_TSP.cup;
      const countFromVolume = cupsTotal / cupRatio;
      // Merge into existing count entry, or create one
      const countEntry = plainTotals.get(countKey);
      if (countEntry) {
        if (countEntry.hasQuantity && countEntry.total != null) {
          countEntry.total += countFromVolume;
        } else {
          countEntry.total = countFromVolume;
          countEntry.hasQuantity = true;
        }
      } else {
        plainTotals.set(countKey, { total: countFromVolume, hasQuantity: true });
      }
      // Remove the volume entry so it's not emitted separately
      familyTotals.delete("tsp");
    }

    // Merge weight into count for ingredients with known count-to-lb equivalence
    const lbRatio = COUNT_TO_LB[name];
    const weightCountKey = PREFERRED_COUNT_UNIT[name] ?? "";
    if (lbRatio != null && familyTotals.has("oz") && plainTotals.has(weightCountKey)) {
      const weightEntry = familyTotals.get("oz")!;
      const countEntry = plainTotals.get(weightCountKey)!;
      // Convert weight (in oz) to count: oz → lb → whole units
      const lbTotal = weightEntry.totalBase / WEIGHT_IN_OZ.lb;
      const countFromWeight = lbTotal / lbRatio;
      if (countEntry.hasQuantity && countEntry.total != null) {
        countEntry.total += countFromWeight;
      } else {
        countEntry.total = countFromWeight;
        countEntry.hasQuantity = true;
      }
      familyTotals.delete("oz");
    }

    // Emit results for each conversion family
    for (const [, { totalBase, family, originalUnits }] of familyTotals) {
      // Always filter out metric units when imperial alternatives exist
      const usableFamily = Object.fromEntries(Object.entries(family).filter(([u]) => !METRIC_UNITS.has(u)));
      const hasMetricUnit = [...originalUnits].some((u) => METRIC_UNITS.has(u));
      if (originalUnits.size === 1 && !hasMetricUnit) {
        const originalUnit = [...originalUnits][0];
        const originalFactor = usableFamily[originalUnit];
        const quantity = totalBase / originalFactor;
        // Check if a larger unit in the family would be cleaner (e.g. 14 tbsp → ~1 cup)
        const largestFactor = Math.max(...Object.values(usableFamily));
        if (originalFactor < largestFactor && totalBase / largestFactor >= 0.5) {
          const preferred = convertToPreferredUnit(totalBase, usableFamily, 0.5);
          results.push({
            name,
            totalQuantity: preferred.quantity,
            unit: preferred.unit,
            category: group.category,
            sourceRecipes,
          });
        } else {
          results.push({
            name,
            totalQuantity: quantity,
            unit: originalUnit,
            category: group.category,
            sourceRecipes,
          });
        }
      } else {
        const preferred = convertToPreferredUnit(totalBase, usableFamily);
        results.push({
          name,
          totalQuantity: preferred.quantity,
          unit: preferred.unit,
          category: group.category,
          sourceRecipes,
        });
      }
    }

    // Apply bulk conversions (e.g. >10 garlic cloves → garlic heads)
    const bulk = BULK_CONVERSIONS[name];
    if (bulk) {
      const entry = plainTotals.get(bulk.fromUnit);
      if (entry && entry.hasQuantity && entry.total != null && entry.total > bulk.threshold) {
        entry.total = Math.round(entry.total / bulk.ratio);
        plainTotals.delete(bulk.fromUnit);
        plainTotals.set(bulk.toUnit, entry);
      }
    }

    // Emit results for non-convertible groups
    for (const [unit, { total, hasQuantity }] of plainTotals) {
      results.push({
        name,
        totalQuantity: hasQuantity ? total : undefined,
        unit: unit || undefined,
        category: group.category,
        sourceRecipes,
      });
    }
  }

  return results;
}

export function groupByCategory(
  items: CombinedGroceryItem[]
): Map<GroceryCategory, CombinedGroceryItem[]> {
  const map = new Map<GroceryCategory, CombinedGroceryItem[]>();
  for (const category of CATEGORY_ORDER) {
    const categoryItems = items.filter((item) => item.category === category);
    if (categoryItems.length > 0) {
      map.set(category, categoryItems);
    }
  }
  return map;
}

function simplePluralize(name: string): string {
  if (name.endsWith("leaf")) {
    return name.slice(0, -4) + "leaves";
  }
  if (name.endsWith("s") || name.endsWith("sh") || name.endsWith("ch")) {
    return name + "es";
  }
  if (name.endsWith("y") && !"aeiou".includes(name[name.length - 2])) {
    return name.slice(0, -1) + "ies";
  }
  const O_ES_WORDS = new Set(["potato", "tomato", "hero"]);
  if (name.endsWith("o")) {
    const lastWord = name.split(" ").pop()!;
    return O_ES_WORDS.has(lastWord) ? name + "es" : name + "s";
  }
  return name + "s";
}

// Metric units that should be converted to imperial when possible
const METRIC_UNITS = new Set(["g", "kg", "ml"]);

// Mass/uncountable nouns that should never be pluralized in display
const MASS_NOUNS = new Set([
  "flour", "sugar", "salt", "rice", "water", "milk", "butter", "oil",
  "garlic", "ginger", "chicken", "beef", "pork", "lamb", "turkey", "fish",
  "salmon", "tuna", "shrimp", "pasta", "spaghetti", "penne", "macaroni", "bread", "cheese", "cream", "honey",
  "mustard", "vinegar", "broth", "stock", "cornstarch", "cornmeal", "cilantro", "parsley",
  "basil", "oregano", "thyme", "rosemary", "dill", "cinnamon", "paprika",
  "cumin", "turmeric", "nutmeg", "lettuce", "spinach", "kale", "cabbage",
  "celery", "broccoli", "cauliflower", "corn", "bacon", "sausage", "ham",
  "chocolate", "cocoa", "coffee", "tea", "juice", "wine", "beer",
  "mayonnaise", "ketchup", "sriracha", "tahini", "hummus", "pesto", "couscous",
  "quinoa", "oatmeal", "granola", "yogurt", "tofu", "tempeh", "seitan",
  "coriander", "sage", "tarragon", "powder", "sauce", "paste", "soy",
  "mint", "wheat", "sumac", "breadcrumbs", "flakes", "half", "cayenne", "buttermilk",
  "soda", "extract", "vanilla", "ghee",
  "allspice", "arugula", "watercress", "asparagus", "paneer", "pancetta",
  "gelatin", "margarine", "seaweed", "molasses", "steak", "noodle",
]);

// Full ingredient names that are mass nouns (checked against entire name)
const MASS_NOUN_NAMES = new Set([
  "cayenne pepper", "pepper",
  "half and half",
  "garam masala", "tandoori masala", "italian seasoning", "kasuri methi",
  "gochujang", "pomegranate molasses", "urad dal", "white hominy",
]);

// Abbreviated units that should never be pluralized
const ABBREVIATION_UNITS = new Set(["tsp", "tbsp", "oz", "lb", "g", "kg", "ml"]);

// "Part of ingredient" units where name reads before unit: "5 celery stalks" not "5 stalks celery"
const NAME_FIRST_UNITS = new Set([
  "stalk", "strip", "ear", "clove", "head", "bunch", "sprig", "piece", "slice", "rib",
]);

function pluralizeUnit(unit: string, quantity: number): string {
  if (quantity <= 1) return unit;
  if (ABBREVIATION_UNITS.has(unit)) return unit;
  return simplePluralize(unit);
}

export function formatGroceryItem(item: CombinedGroceryItem): string {
  const parts: string[] = [];
  const qty = item.totalQuantity;
  if (qty != null) {
    parts.push(decimalToFraction(qty));
  }

  const isNameFirst = item.unit != null && NAME_FIRST_UNITS.has(item.unit);

  if (isNameFirst) {
    // "5 celery stalks" — name stays singular, unit carries the count
    parts.push(item.name);
    parts.push(qty != null ? pluralizeUnit(item.unit!, qty) : item.unit!);
  } else {
    if (item.unit) {
      parts.push(qty != null ? pluralizeUnit(item.unit, qty) : item.unit);
    }
    // Pluralize name when it's a countable noun and either:
    // - quantity > 1 (e.g. "4 eggs"), or
    // - there's a unit (e.g. "1 cup blueberries", not "1 cup blueberry")
    const baseName = item.name.split(" ").pop()!;
    const isMassNoun = MASS_NOUNS.has(baseName) || MASS_NOUN_NAMES.has(item.name);
    const shouldPluralize = !isMassNoun && qty != null && (qty > 1 || !!item.unit);
    const displayName = shouldPluralize
      ? simplePluralize(item.name)
      : item.name;
    parts.push(displayName);
  }

  return parts.join(" ");
}

export function generateCSV(
  groupedItems: Map<GroceryCategory, CombinedGroceryItem[]>
): string {
  const rows: string[] = ["Category,Item,Quantity,Unit,Recipes"];
  for (const [category, items] of groupedItems) {
    const categoryName = GROCERY_CATEGORIES[category];
    for (const item of items) {
      const qty = item.totalQuantity != null ? decimalToFraction(item.totalQuantity) : "";
      const unit = item.unit ?? "";
      const recipes = item.sourceRecipes.join("; ");
      const escapedName = item.name.includes(",") ? `"${item.name}"` : item.name;
      const escapedRecipes = recipes.includes(",") ? `"${recipes}"` : recipes;
      rows.push(
        `${categoryName},${escapedName},${qty},${unit},${escapedRecipes}`
      );
    }
  }
  return rows.join("\n");
}

export function filterPantryItems(
  items: CombinedGroceryItem[],
  pantryItems: string[]
): CombinedGroceryItem[] {
  const normalizedPantry = new Set(pantryItems.map(normalizeIngredientName));
  return items.filter((item) => !normalizedPantry.has(normalizeIngredientName(item.name)));
}

export function filterSmartPantryItems(
  items: SmartGroceryItem[],
  pantryItems: string[]
): SmartGroceryItem[] {
  const normalizedPantry = new Set(pantryItems.map(normalizeIngredientName));
  return items.filter((item) => !normalizedPantry.has(normalizeIngredientName(item.name)));
}

export async function smartCombineIngredients(
  ingredients: RecipeIngredient[],
  recipeNameMap: Record<string, string>
): Promise<SmartGroceryItem[] | null> {
  try {
    // Step 1: Naive combine first (handles unit conversion, normalization)
    const naiveCombined = combineIngredients(ingredients, recipeNameMap);

    // Step 2: Format for AI — send pre-combined results for semantic-only merging
    const preCombined = naiveCombined.map((item) => ({
      name: item.name,
      quantity: item.totalQuantity != null ? decimalToFraction(item.totalQuantity) : null,
      unit: item.unit ?? null,
      category: item.category,
      sourceRecipes: item.sourceRecipes,
    }));

    const { data, error } = await supabase.functions.invoke("combine-ingredients", {
      body: { preCombined },
    });

    if (error) throw error;

    if (data?.skipped) {
      return null;
    }

    if (data?.items) {
      return data.items as SmartGroceryItem[];
    }

    return null;
  } catch (error) {
    console.error("Smart combine failed, falling back to naive combine:", error);
    return null;
  }
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
