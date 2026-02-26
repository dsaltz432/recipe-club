import type { RecipeIngredient, GroceryCategory, CombinedGroceryItem, SmartGroceryItem } from "@/types";
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

// Words whose trailing "s" is NOT a plural marker (foreign words, etc.)
const NO_STRIP_S = new Set([
  "foie gras", "hummus", "couscous", "jus", "bourguignons", "molasses",
]);

// Naturally plural ingredient names — display as plural even with no quantity
const ALWAYS_PLURAL = new Set([
  "tortilla chips", "pita chips", "potato chips", "breadcrumbs",
  "red pepper flakes", "chili flakes", "oats", "grits",
]);

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
  "diced tomato",
  "diced tomatoes",
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

// Unit aliases for combining (rib → stalk, slice → strip)
const UNIT_REMAP: Record<string, string> = {
  "rib": "stalk",
  "slice": "strip",
  "piece": "",
};

// Preferred count unit for volume-to-count merging
const PREFERRED_COUNT_UNIT: Record<string, string> = {
  "celery": "stalk",
  "bacon": "strip",
  "garlic": "clove",
  "corn": "ear",
  "broccoli": "head",
  "cauliflower": "head",
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
  "scallion": 0.125,  // 1 scallion ≈ 2 tbsp ≈ 1/8 cup sliced
  "cauliflower": 4,   // 1 medium head ≈ 4 cups florets
};

// How many lb equal 1 whole unit of a count-based ingredient
// Used to merge "1.25 lb potatoes" with "5 potatoes" into a single count
const COUNT_TO_LB: Record<string, number> = {
  "potato": 0.5,      // 1 medium potato ≈ 0.5 lb (8 oz)
  "broccoli": 1.25,   // 1 medium head broccoli ≈ 1.25 lb (20 oz)
};

// Ingredients where "oz" means fluid ounces (volume), not weight
// For these, "oz" is converted to tbsp (1 fl oz = 2 tbsp) before family lookup
const FLUID_OZ_INGREDIENTS = new Set([
  "chicken stock", "beef stock", "vegetable stock",
  "low sodium chicken stock",
  "cream", "heavy cream", "sour cream",
  "milk", "buttermilk", "coconut milk",
  "juice", "lemon juice", "lime juice", "orange juice",
  "water",
  "wine", "red wine", "white wine",
  "coconut cream", "half and half",
]);

// How many slices make 1 whole unit — used to merge "1 slice onion" into count
const SLICE_TO_COUNT: Record<string, number> = {
  "onion": 8,       // 1 medium onion ≈ 8 slices/rings
  "tomato": 6,      // 1 medium tomato ≈ 6 slices
  "lemon": 8,       // 1 lemon ≈ 8 slices
  "bread": 1,       // 1 slice bread = 1 count
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

// Approximate weight of 1 cup in oz — used to merge volume + weight for the same ingredient
// e.g. "6 cups spinach" + "5 oz spinach" → convert oz→cups via density, then combine
const DENSITY_OZ_PER_CUP: Record<string, number> = {
  // Fresh greens / herbs (very light per cup)
  "spinach": 1,
  "arugula": 0.7,
  "kale": 2.4,
  "lettuce": 2,
  "butter lettuce": 2,
  "basil": 0.85,
  "cilantro": 0.85,
  "parsley": 1,
  "mint": 0.85,
  "dill": 0.5,
  // Chopped / diced vegetables
  "onion": 5.3,
  "bell pepper": 5.3,
  "carrot": 5,
  "celery": 4,
  "tomato": 6.3,
  "mushroom": 2.5,
  "broccoli": 3,
  "cauliflower": 3.5,
  "zucchini": 4.4,
  "potato": 5.3,
  "sweet potato": 5,
  "corn": 5.8,
  "cabbage": 3,
  "cucumber": 4.5,
  "pea": 5.3,
  "green bean": 4,
  // Dairy / fats
  "cheddar": 4,
  "mozzarella": 4,
  "parmesan": 3,
  "cream cheese": 8,
  "butter": 8,
  "heavy cream": 8.4,
  "yogurt": 8.6,
  "sour cream": 8,
  // Dry goods
  "flour": 4.4,
  "sugar": 7,
  "brown sugar": 7.7,
  "powdered sugar": 4.4,
  "rice": 6.5,
  "oats": 3.2,
  "breadcrumbs": 4,
  "cornstarch": 4.5,
  "cocoa": 3,
  "coconut": 3,
  // Nuts / seeds
  "almond": 5,
  "walnut": 4,
  "pecan": 3.5,
  "peanut": 5,
  "cashew": 5,
  "pistachio": 4.3,
  "sesame seed": 5,
  // Proteins
  "chicken": 5,
  "ground beef": 8,
  "ground turkey": 8,
  "ground pork": 8,
  "ground lamb": 8,
  "ground chicken": 8,
  "bacon": 5.3,
  "shrimp": 4,
  "tofu": 9,
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

  // Basic singularization — skip words whose trailing "s" isn't a plural marker
  if (ALWAYS_PLURAL.has(normalized) || NO_STRIP_S.has(normalized)) {
    // foreign words etc. — leave as-is
  } else if (normalized.endsWith("leaves")) {
    normalized = normalized.slice(0, -6) + "leaf";
  } else if (
    normalized.endsWith("ies") &&
    normalized.length > 4
  ) {
    normalized = normalized.slice(0, -3) + "y";
  } else if (
    normalized.length > 4 &&
    (normalized.endsWith("shes") ||
     normalized.endsWith("ches") ||
     normalized.endsWith("xes") ||
     normalized.endsWith("zes") ||
     normalized.endsWith("sses") ||
     normalized.endsWith("oes"))
  ) {
    // Sibilant / -oes endings: strip "es" (dishes→dish, peaches→peach, tomatoes→tomato)
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
    const familyTotals = new Map<string, { totalBase: number; family: Record<string, number>; originalUnits: Set<string>; itemCount: number }>();
    const plainTotals = new Map<string, { total: number | undefined; hasQuantity: boolean }>();

    for (const item of group.items) {
      // For liquid ingredients, treat "oz" as fluid ounces (volume) not weight
      let effectiveUnit = item.unit;
      let effectiveQuantity = item.quantity;
      if (effectiveUnit === "oz" && FLUID_OZ_INGREDIENTS.has(name) && effectiveQuantity != null) {
        effectiveUnit = "tbsp";
        effectiveQuantity = effectiveQuantity * 2; // 1 fl oz = 2 tbsp
      }

      const conv = effectiveUnit ? getConversionFamily(effectiveUnit) : null;

      if (conv && effectiveQuantity != null) {
        const familyKey = conv.baseUnit;
        const baseAmount = effectiveQuantity * conv.family[effectiveUnit];
        const existing = familyTotals.get(familyKey);
        if (existing) {
          existing.totalBase += baseAmount;
          existing.originalUnits.add(effectiveUnit);
          existing.itemCount += 1;
        } else {
          familyTotals.set(familyKey, { totalBase: baseAmount, family: conv.family, originalUnits: new Set([effectiveUnit]), itemCount: 1 });
        }
      } else {
        // Non-convertible: group by unit (apply remaps)
        // Only remap "slice" → "strip" for ingredients that prefer "strip" unit (e.g. bacon)
        const unit = item.unit;
        const remappedUnit = unit ? (
          unit === "slice"
            ? (PREFERRED_COUNT_UNIT[name] === "strip" ? "strip" : unit)
            : (UNIT_REMAP[unit] ?? unit)
        ) : unit;
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

    // Merge volume + weight families when both exist for the same ingredient
    if (familyTotals.has("tsp") && familyTotals.has("oz")) {
      const volEntry = familyTotals.get("tsp")!;
      const wtEntry = familyTotals.get("oz")!;
      const density = DENSITY_OZ_PER_CUP[name];
      // For light ingredients (density ≤ 2 oz/cup — greens, herbs), prefer weight
      // because cups give unreasonably large numbers (e.g. "11 cups spinach")
      const preferVolume = density != null && density <= 2
        ? false
        : volEntry.itemCount >= wtEntry.itemCount;

      if (density != null) {
        // Convert one family into the other using density, then combine
        if (preferVolume) {
          // weight → volume: oz → cups → tsp
          const cupsFromWeight = wtEntry.totalBase / density;
          volEntry.totalBase += cupsFromWeight * VOLUME_IN_TSP.cup;
          volEntry.originalUnits.add("cup");
          familyTotals.delete("oz");
        } else {
          // volume → weight: tsp → cups → oz
          const cupsFromVolume = volEntry.totalBase / VOLUME_IN_TSP.cup;
          wtEntry.totalBase += cupsFromVolume * density;
          wtEntry.originalUnits.add("oz");
          familyTotals.delete("tsp");
        }
      } else {
        // No density data — keep both families as separate line items
        // rather than silently dropping one (never lose ingredient data)
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
          familyTotals.set("tsp", { totalBase: tspFromCans, family: VOLUME_IN_TSP, originalUnits: new Set(["cup"]), itemCount: 1 });
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
        // For weight (oz→lb), only upscale when ≥ 1 lb — "11 oz" is clearer than "0.69 lb"
        const largestFactor = Math.max(...Object.values(usableFamily));
        const isWeightFamily = "lb" in usableFamily;
        const upscaleThreshold = isWeightFamily ? 1 : 0.5;
        if (originalFactor < largestFactor && totalBase / largestFactor >= upscaleThreshold) {
          const preferred = convertToPreferredUnit(totalBase, usableFamily, upscaleThreshold);
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
        entry.total = Math.ceil(entry.total / bulk.ratio);
        plainTotals.delete(bulk.fromUnit);
        plainTotals.set(bulk.toUnit, entry);
      }
    }

    // Merge slices into count for ingredients with known slice-to-count ratio
    const sliceRatio = SLICE_TO_COUNT[name];
    if (sliceRatio != null && plainTotals.has("slice")) {
      const sliceEntry = plainTotals.get("slice")!;
      if (sliceEntry.hasQuantity && sliceEntry.total != null) {
        const countFromSlices = sliceEntry.total / sliceRatio;
        const sliceCountKey = PREFERRED_COUNT_UNIT[name] ?? "";
        const countEntry = plainTotals.get(sliceCountKey);
        if (countEntry && countEntry.hasQuantity && countEntry.total != null) {
          countEntry.total += countFromSlices;
          plainTotals.delete("slice");
        }
      }
    }

    // Absorb no-quantity ("to taste") entries when a quantified entry exists
    const hasQuantifiedEntry =
      familyTotals.size > 0 ||
      [...plainTotals.values()].some(v => v.hasQuantity);
    if (hasQuantifiedEntry) {
      for (const [unit, entry] of plainTotals) {
        if (!entry.hasQuantity) {
          plainTotals.delete(unit);
        }
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

// Metric units that should be converted to imperial when possible
const METRIC_UNITS = new Set(["g", "kg", "ml"]);

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

export function formatGroceryItem(item: CombinedGroceryItem | SmartGroceryItem): string {
  const parts: string[] = [];
  const qty = item.totalQuantity;
  if (qty != null) {
    parts.push(decimalToFraction(qty));
  }

  // Use AI-provided displayName when available (SmartGroceryItem), otherwise fall back to name
  const nameToDisplay = "displayName" in item && item.displayName ? item.displayName : item.name;

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
  groupedItems: Map<GroceryCategory, (CombinedGroceryItem | SmartGroceryItem)[]>
): string {
  const rows: string[] = ["Category,Item,Quantity,Unit,Recipes"];
  for (const [category, items] of groupedItems) {
    const categoryName = GROCERY_CATEGORIES[category];
    for (const item of items) {
      const qty = item.totalQuantity != null ? decimalToFraction(item.totalQuantity) : "";
      const unit = item.unit ?? "";
      const recipes = item.sourceRecipes.join("; ");
      const itemName = "displayName" in item && item.displayName ? item.displayName : item.name;
      const escapedName = itemName.includes(",") ? `"${itemName}"` : itemName;
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
  recipeNameMap: Record<string, string>,
  perRecipeNames?: string[]
): Promise<SmartCombineResult> {
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

  // Fallback: convert naive combine to SmartGroceryItem format
  const fallbackItems: SmartGroceryItem[] = naiveCombined.map((item) => ({
    name: item.name,
    displayName: item.name,
    totalQuantity: item.totalQuantity,
    unit: item.unit,
    category: item.category,
    sourceRecipes: item.sourceRecipes,
  }));
  const fallbackResult: SmartCombineResult = { items: fallbackItems, displayNameMap: {} };

  try {
    const { data, error } = await supabase.functions.invoke("combine-ingredients", {
      body: { preCombined, perRecipeNames },
    });

    if (error) throw error;

    if (data?.skipped || !data?.items) {
      return fallbackResult;
    }

    return {
      items: data.items as SmartGroceryItem[],
      displayNameMap: (data.displayNameMap as Record<string, string>) || {},
    };
  } catch (error) {
    console.error("Smart combine failed, falling back to naive combine:", error);
    return fallbackResult;
  }
}

export function generatePlainText(
  groupedItems: Map<GroceryCategory, (CombinedGroceryItem | SmartGroceryItem)[]>
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
  const normalized = normalizeIngredientName(name);
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
