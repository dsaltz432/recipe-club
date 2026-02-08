/**
 * Verification script for US-004: mass noun and alias normalization.
 *
 * Imports TEST_RECIPES, runs combineIngredients + formatGroceryItem on all
 * ingredients, and checks key formatting rules.
 *
 * Usage: node --import tsx/esm --import ./scripts/_mock-env.mjs scripts/verify-parsing.ts
 *   or:  npx tsx --tsconfig tsconfig.app.json --import ./scripts/_mock-env.mjs scripts/verify-parsing.ts
 */

import { TEST_RECIPES } from "../test-combine/src/data/recipes.ts";
import { combineIngredients, formatGroceryItem } from "../src/lib/groceryList.ts";

interface IngredientInput {
  id: string;
  recipeId: string;
  name: string;
  quantity?: number;
  unit?: string;
  category: string;
  rawText?: string;
  sortOrder?: number;
}

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`  FAIL: ${message}`);
  }
}

// Convert TestRecipe ingredients to RecipeIngredient format
function toRecipeIngredients(recipeId: string, ingredients: typeof TEST_RECIPES[0]["ingredients"]): IngredientInput[] {
  return ingredients.map((ing, i) => ({
    id: `${recipeId}-ing-${i}`,
    recipeId,
    name: ing.name,
    quantity: ing.quantity ?? undefined,
    unit: ing.unit ?? undefined,
    category: ing.category,
    rawText: ing.rawText,
    sortOrder: i,
  }));
}

// Build the full ingredient list and recipe name map
const allIngredients: IngredientInput[] = [];
const recipeNameMap: Record<string, string> = {};

for (const recipe of TEST_RECIPES) {
  recipeNameMap[recipe.id] = recipe.name;
  allIngredients.push(...toRecipeIngredients(recipe.id, recipe.ingredients));
}

console.log(`Loaded ${TEST_RECIPES.length} recipes, ${allIngredients.length} total ingredients\n`);

// Run combineIngredients
const combined = combineIngredients(allIngredients as any, recipeNameMap);
const formatted = combined.map((item: any) => ({
  ...item,
  display: formatGroceryItem(item),
}));

console.log("=== Verification Checks ===\n");

// (1) 'all-purpose flour' normalizes to 'flour'
console.log("1. all-purpose flour → flour");
const flourItems = formatted.filter((f: any) => f.name === "flour");
const apFlourItems = formatted.filter((f: any) => f.name.includes("all-purpose"));
assert(flourItems.length > 0, "Should have items named 'flour' (from all-purpose flour normalization)");
assert(apFlourItems.length === 0, "Should NOT have items still named 'all-purpose flour'");
console.log(`   flour items: ${flourItems.length}, all-purpose items: ${apFlourItems.length}`);

// (2) 'red pepper flakes' stays as 'red pepper flakes' (not singularized)
console.log("\n2. red pepper flakes stays intact");
const rpfItems = formatted.filter((f: any) => f.name === "red pepper flakes");
const rpfSingular = formatted.filter((f: any) => f.name === "red pepper flake");
assert(rpfItems.length > 0 || rpfSingular.length === 0, "'red pepper flakes' should not be singularized to 'red pepper flake'");
for (const item of rpfItems) {
  assert(!item.display.includes("red pepper flakess"), `Display should not double-pluralize: ${item.display}`);
}
console.log(`   red pepper flakes items: ${rpfItems.length}`);

// (3) spaghetti/penne/pesto/sage/tarragon are never pluralized in output
console.log("\n3. Mass nouns never pluralized");
const massNounChecks = ["spaghetti", "penne", "pesto", "sage", "tarragon"];
for (const noun of massNounChecks) {
  const items = formatted.filter((f: any) => f.name === noun);
  for (const item of items) {
    assert(
      !item.display.includes(noun + "s"),
      `${noun} should not be pluralized in display: "${item.display}"`
    );
  }
  console.log(`   ${noun}: ${items.length} items, all correctly un-pluralized`);
}

// (4) garlic with no unit displays as 'N garlic cloves'
console.log("\n4. garlic with count unit → 'N garlic cloves'");
const garlicCloveItems = formatted.filter(
  (f: any) => (f.name === "garlic clove" || f.name === "garlic") && f.unit === "clove"
);
const allGarlicItems = formatted.filter((f: any) => f.name.startsWith("garlic"));
for (const item of allGarlicItems) {
  if (item.unit === "clove") {
    assert(
      item.display.includes("garlic") && item.display.includes("clove"),
      `Garlic with clove unit should display name-first: "${item.display}"`
    );
    const parts = item.display.split(" ");
    const garlicIdx = parts.findIndex((p: string) => p === "garlic");
    const cloveIdx = parts.findIndex((p: string) => p.startsWith("clove"));
    if (garlicIdx >= 0 && cloveIdx >= 0) {
      assert(
        garlicIdx < cloveIdx,
        `Name should come before unit: "${item.display}" (garlic@${garlicIdx} vs clove@${cloveIdx})`
      );
    }
  }
}
// Also show all garlic items for visibility
for (const item of allGarlicItems) {
  console.log(`   garlic item: name="${item.name}" unit=${item.unit} qty=${item.totalQuantity} → "${item.display}"`);
}
// Verify at least one garlic item has "clove" in display (from garlic clove entries)
const garlicWithCloveDisplay = allGarlicItems.filter((f: any) => f.display.includes("clove"));
assert(garlicWithCloveDisplay.length > 0, "At least one garlic item should have 'clove' in display");
console.log(`   garlic items with clove in display: ${garlicWithCloveDisplay.length}`);

// (5) name-first unit order: "celery stalks" not "stalks celery"
console.log("\n5. Name-first unit order (celery stalks, not stalks celery)");
const celeryItems = formatted.filter((f: any) => f.name === "celery" && f.unit === "stalk");
for (const item of celeryItems) {
  const parts = item.display.split(" ");
  const celeryIdx = parts.findIndex((p: string) => p === "celery");
  const stalkIdx = parts.findIndex((p: string) => p.startsWith("stalk"));
  if (celeryIdx >= 0 && stalkIdx >= 0) {
    assert(
      celeryIdx < stalkIdx,
      `Name should come before unit: "${item.display}"`
    );
  }
  console.log(`   celery: "${item.display}"`);
}

const baconItems = formatted.filter((f: any) => f.name === "bacon" && f.unit === "strip");
for (const item of baconItems) {
  const parts = item.display.split(" ");
  const baconIdx = parts.findIndex((p: string) => p === "bacon");
  const stripIdx = parts.findIndex((p: string) => p.startsWith("strip"));
  if (baconIdx >= 0 && stripIdx >= 0) {
    assert(
      baconIdx < stripIdx,
      `Name should come before unit: "${item.display}"`
    );
  }
  console.log(`   bacon: "${item.display}"`);
}

// Summary
console.log(`\n${"=".repeat(40)}`);
console.log(`  Passed: ${passed}`);
console.log(`  Failed: ${failed}`);
console.log(`${"=".repeat(40)}`);

if (failed > 0) {
  process.exit(1);
}

console.log("\nAll checks passed!");
