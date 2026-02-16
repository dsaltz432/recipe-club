/**
 * sync-to-recipes.mjs
 *
 * Reads parsed ingredient data from local Supabase DB and updates
 * test-combine/src/data/recipes.ts with the latest parsed ingredients.
 *
 * Usage:
 *   node test-combine/scripts/sync-to-recipes.mjs
 *   node test-combine/scripts/sync-to-recipes.mjs --dry-run
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RECIPES_FILE = path.join(__dirname, "../src/data/recipes.ts");

const REST_URL = "http://127.0.0.1:54321/rest/v1";
const API_KEY = "REDACTED";
const HEADERS = {
  apikey: API_KEY,
  Authorization: `Bearer ${API_KEY}`,
  "Content-Type": "application/json",
};

const dryRun = process.argv.includes("--dry-run");

// ---------- Supabase REST helpers ----------

async function fetchAll(table, query = "") {
  const results = [];
  let offset = 0;
  const limit = 1000;
  while (true) {
    const url = `${REST_URL}/${table}?${query}&limit=${limit}&offset=${offset}`;
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) throw new Error(`Failed to fetch ${table}: ${res.status}`);
    const data = await res.json();
    results.push(...data);
    if (data.length < limit) break;
    offset += limit;
  }
  return results;
}

// ---------- Format ingredients for TypeScript ----------

function formatIngredient(ing) {
  const qty = ing.quantity != null ? String(ing.quantity) : "null";
  const unit = ing.unit != null ? `"${ing.unit}"` : "null";
  const rawText = (ing.raw_text || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `      { name: "${ing.name}", quantity: ${qty}, unit: ${unit}, category: "${ing.category}", rawText: "${rawText}" }`;
}

function formatIngredientsArray(ingredients) {
  if (!ingredients || ingredients.length === 0) {
    return "    ingredients: [],";
  }
  const lines = ingredients.map(formatIngredient).join(",\n");
  return `    ingredients: [\n${lines},\n    ],`;
}

// ---------- Replace ingredients in source ----------

function replaceIngredients(source, recipeName, ingredients) {
  // Find the recipe block by name — match the name line and then find the ingredients array
  // We need to escape special chars in recipe name for regex
  const escapedName = recipeName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // Match from `name: "RecipeName"` through the `ingredients: [...]` block
  // The ingredients array can be empty `[]` or contain items across multiple lines
  const pattern = new RegExp(
    `(name:\\s*"${escapedName}",\\s*\\n\\s*cuisine:\\s*"[^"]+",\\s*\\n\\s*url:\\s*"[^"]+",\\s*\\n)\\s*ingredients:\\s*\\[([\\s\\S]*?)\\],?`,
    "m"
  );

  const match = source.match(pattern);
  if (!match) {
    return { source, found: false };
  }

  const prefix = match[1];
  const newIngredients = formatIngredientsArray(ingredients);
  const replacement = prefix + newIngredients;
  const newSource = source.replace(match[0], replacement);
  return { source: newSource, found: true };
}

// ---------- Main ----------

async function main() {
  console.log("=== Sync Parsed Ingredients to recipes.ts ===\n");

  // 1. Read recipes.ts
  let source = fs.readFileSync(RECIPES_FILE, "utf-8");
  console.log(`Read recipes.ts (${source.length} chars)\n`);

  // 2. Extract recipe names from recipes.ts
  const recipeNameRegex = /id:\s*"([^"]+)",\s*\n\s*name:\s*"([^"]+)"/g;
  const tsRecipes = [];
  let m;
  while ((m = recipeNameRegex.exec(source)) !== null) {
    tsRecipes.push({ id: m[1], name: m[2] });
  }
  console.log(`Found ${tsRecipes.length} recipes in recipes.ts\n`);

  // 3. Fetch all recipes from DB
  const dbRecipes = await fetchAll("recipes", "select=id,name");
  console.log(`Found ${dbRecipes.length} recipes in DB\n`);

  // 4. Fetch all ingredients from DB
  const dbIngredients = await fetchAll(
    "recipe_ingredients",
    "select=recipe_id,name,quantity,unit,raw_text,category,sort_order&order=sort_order"
  );
  console.log(`Found ${dbIngredients.length} ingredients in DB\n`);

  // 5. Group ingredients by recipe_id
  const ingredientsByRecipeId = {};
  for (const ing of dbIngredients) {
    if (!ingredientsByRecipeId[ing.recipe_id]) {
      ingredientsByRecipeId[ing.recipe_id] = [];
    }
    ingredientsByRecipeId[ing.recipe_id].push(ing);
  }

  // 6. Build name -> DB recipe mapping
  const dbRecipeByName = {};
  for (const r of dbRecipes) {
    dbRecipeByName[r.name] = r;
  }

  // 7. Sync each recipe
  let synced = 0;
  let noMatch = 0;
  let noIngredients = 0;
  let unchanged = 0;

  for (const tsRecipe of tsRecipes) {
    const dbRecipe = dbRecipeByName[tsRecipe.name];
    if (!dbRecipe) {
      console.log(`  [NO MATCH] ${tsRecipe.name} — not found in DB`);
      noMatch++;
      continue;
    }

    const ingredients = ingredientsByRecipeId[dbRecipe.id] || [];
    if (ingredients.length === 0) {
      console.log(`  [NO INGREDIENTS] ${tsRecipe.name} — 0 ingredients in DB`);
      noIngredients++;
      continue;
    }

    // Sort by sort_order
    ingredients.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

    if (dryRun) {
      console.log(`  [DRY RUN] ${tsRecipe.name} — ${ingredients.length} ingredients`);
      synced++;
      continue;
    }

    const result = replaceIngredients(source, tsRecipe.name, ingredients);
    if (!result.found) {
      console.log(`  [REGEX MISS] ${tsRecipe.name} — could not find recipe block in source`);
      noMatch++;
      continue;
    }

    source = result.source;
    synced++;
  }

  // 8. Write back
  if (!dryRun) {
    fs.writeFileSync(RECIPES_FILE, source);
    console.log(`\nWrote updated recipes.ts (${source.length} chars)`);
  }

  console.log(`\n--- Summary ---`);
  console.log(`Synced:         ${synced}`);
  console.log(`No DB match:    ${noMatch}`);
  console.log(`No ingredients: ${noIngredients}`);
  console.log(`Total:          ${tsRecipes.length}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
