#!/usr/bin/env node

/**
 * Batch combine-ingredients testing script.
 *
 * Groups recipes into simulated events (3-5 recipes each), pre-combines their
 * ingredients (group by lowercase name + unit, sum quantities), calls the
 * combine-ingredients edge function, and saves results for evaluation.
 *
 * Usage:
 *   node scripts/ralph/batch-combine.mjs                    # process all groups
 *   node scripts/ralph/batch-combine.mjs --offset 0 --limit 10  # first 10 groups
 *   node scripts/ralph/batch-combine.mjs --limit 0          # no-op dry run
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RESULTS_FILE = path.join(__dirname, "../../test-combine/combine-results.json");
const RESULTS_FILE_RALPH = path.join(__dirname, "combine-results.json");

const BASE_URL = "http://127.0.0.1:54321";
const REST_URL = `${BASE_URL}/rest/v1`;
const EDGE_FN_URL = `${BASE_URL}/functions/v1/combine-ingredients`;
const API_KEY = "REDACTED";
const AUTH_HEADERS = {
  apikey: API_KEY,
  Authorization: `Bearer ${API_KEY}`,
  "Content-Type": "application/json",
};

// Deterministic group sizes: cycle through 3, 4, 5 based on group index
const GROUP_SIZES = [3, 4, 5];

// ---------- CLI Args ----------

function parseArgs() {
  const args = process.argv.slice(2);
  let offset = 0;
  let limit = Infinity;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--offset" && i + 1 < args.length) {
      offset = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === "--limit" && i + 1 < args.length) {
      limit = parseInt(args[i + 1], 10);
      i++;
    }
  }

  return { offset, limit };
}

// ---------- Fetch data from DB ----------

async function fetchAllRecipes() {
  const rows = [];
  let offset = 0;
  const limit = 1000;

  while (true) {
    const url = `${REST_URL}/recipes?select=id,name&order=id&offset=${offset}&limit=${limit}`;
    const res = await fetch(url, { headers: AUTH_HEADERS });
    if (!res.ok) throw new Error(`Failed to fetch recipes: ${res.status}`);
    const batch = await res.json();
    rows.push(...batch);
    if (batch.length < limit) break;
    offset += limit;
  }

  return rows;
}

async function fetchAllIngredients() {
  const rows = [];
  let offset = 0;
  const limit = 1000;

  while (true) {
    const url = `${REST_URL}/recipe_ingredients?select=id,recipe_id,name,quantity,unit,category&order=recipe_id,sort_order&offset=${offset}&limit=${limit}`;
    const res = await fetch(url, { headers: AUTH_HEADERS });
    if (!res.ok) throw new Error(`Failed to fetch recipe_ingredients: ${res.status}`);
    const batch = await res.json();
    rows.push(...batch);
    if (batch.length < limit) break;
    offset += limit;
  }

  return rows;
}

// ---------- Group recipes into events ----------

function groupRecipesIntoEvents(recipes, ingredientsByRecipe) {
  // Filter out recipes with 0 ingredients
  const recipesWithIngredients = recipes.filter(
    (r) => ingredientsByRecipe.has(r.id) && ingredientsByRecipe.get(r.id).length > 0
  );

  const groups = [];
  let i = 0;
  let groupIndex = 0;

  while (i < recipesWithIngredients.length) {
    const groupSize = GROUP_SIZES[groupIndex % GROUP_SIZES.length];
    const groupRecipes = recipesWithIngredients.slice(i, i + groupSize);
    if (groupRecipes.length === 0) break;

    groups.push({
      groupIndex,
      recipes: groupRecipes,
    });

    i += groupSize;
    groupIndex++;
  }

  return groups;
}

// ---------- Pre-combine ingredients ----------

function preCombine(recipes, ingredientsByRecipe) {
  // Collect all ingredients from these recipes
  const allIngredients = [];
  for (const recipe of recipes) {
    const ings = ingredientsByRecipe.get(recipe.id) || [];
    for (const ing of ings) {
      allIngredients.push({
        ...ing,
        recipeName: recipe.name,
      });
    }
  }

  // Group by lowercase name + unit
  const grouped = new Map();
  for (const ing of allIngredients) {
    const key = `${(ing.name || "").toLowerCase()}||${(ing.unit || "").toLowerCase()}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        name: ing.name,
        quantity: 0,
        hasQuantity: false,
        unit: ing.unit || null,
        category: ing.category || "other",
        sourceRecipes: [],
      });
    }
    const group = grouped.get(key);

    // Sum quantities
    if (ing.quantity !== null && ing.quantity !== undefined) {
      group.quantity += Number(ing.quantity);
      group.hasQuantity = true;
    }

    // Collect source recipes (deduplicated)
    if (!group.sourceRecipes.includes(ing.recipeName)) {
      group.sourceRecipes.push(ing.recipeName);
    }
  }

  // Convert to PreCombinedInput[] format
  const preCombined = [];
  for (const group of grouped.values()) {
    preCombined.push({
      name: group.name,
      quantity: group.hasQuantity ? String(group.quantity) : null,
      unit: group.unit || null,
      category: group.category,
      sourceRecipes: group.sourceRecipes,
    });
  }

  return preCombined;
}

// ---------- Call combine-ingredients edge function ----------

async function callCombineFunction(preCombined) {
  const response = await fetch(EDGE_FN_URL, {
    method: "POST",
    headers: AUTH_HEADERS,
    body: JSON.stringify({ preCombined }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Edge function error ${response.status}: ${errText}`);
  }

  const result = await response.json();
  if (!result.success) {
    throw new Error(`Edge function returned success=false: ${JSON.stringify(result)}`);
  }

  return result.items;
}

// ---------- Results file management ----------

function loadExistingResults() {
  // Try test-combine dir first, then ralph dir
  for (const filePath of [RESULTS_FILE, RESULTS_FILE_RALPH]) {
    try {
      const data = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(data);
    } catch {
      // File doesn't exist or invalid JSON, continue
    }
  }
  return [];
}

function saveResults(results) {
  const json = JSON.stringify(results, null, 2);

  // Write to ralph dir (always accessible)
  fs.writeFileSync(RESULTS_FILE_RALPH, json);

  // Also try to write to test-combine dir
  try {
    const dir = path.dirname(RESULTS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(RESULTS_FILE, json);
  } catch {
    console.log(`Note: Could not write to ${RESULTS_FILE}, results saved to ${RESULTS_FILE_RALPH}`);
  }
}

function mergeResults(existing, newResults) {
  // Create a map keyed by groupIndex from existing results
  const map = new Map();
  for (const r of existing) {
    map.set(r.groupIndex, r);
  }
  // Overwrite/add new results
  for (const r of newResults) {
    map.set(r.groupIndex, r);
  }
  // Return sorted by groupIndex
  return Array.from(map.values()).sort((a, b) => a.groupIndex - b.groupIndex);
}

// ---------- Main ----------

async function main() {
  const { offset, limit } = parseArgs();

  console.log("=== Batch Combine-Ingredients Testing ===\n");
  console.log(`Offset: ${offset}, Limit: ${limit === Infinity ? "all" : limit}\n`);

  if (limit === 0) {
    console.log("Limit is 0 — no-op. Exiting.");
    return;
  }

  console.log("Fetching data from local Supabase...\n");

  const [recipes, ingredients] = await Promise.all([
    fetchAllRecipes(),
    fetchAllIngredients(),
  ]);

  console.log(`Found ${recipes.length} recipes, ${ingredients.length} ingredients\n`);

  // Build ingredient map by recipe_id
  const ingredientsByRecipe = new Map();
  for (const ing of ingredients) {
    if (!ingredientsByRecipe.has(ing.recipe_id)) {
      ingredientsByRecipe.set(ing.recipe_id, []);
    }
    ingredientsByRecipe.get(ing.recipe_id).push(ing);
  }

  // Group recipes into events
  const allGroups = groupRecipesIntoEvents(recipes, ingredientsByRecipe);
  console.log(`Total event groups: ${allGroups.length} (from ${recipes.length} recipes, ${allGroups.reduce((s, g) => s + g.recipes.length, 0)} with ingredients)\n`);

  // Apply offset and limit
  const groupsToProcess = allGroups.slice(offset, offset + limit);
  console.log(`Processing groups ${offset} to ${offset + groupsToProcess.length - 1} (${groupsToProcess.length} groups)\n`);

  if (groupsToProcess.length === 0) {
    console.log("No groups to process. Exiting.");
    return;
  }

  // Load existing results for merging
  const existingResults = loadExistingResults();
  const newResults = [];

  let totalPreCombined = 0;
  let totalCombined = 0;

  for (const group of groupsToProcess) {
    const recipeNames = group.recipes.map((r) => r.name);
    console.log(`Group ${group.groupIndex}: ${recipeNames.length} recipes — ${recipeNames.join(", ").substring(0, 80)}${recipeNames.join(", ").length > 80 ? "..." : ""}`);

    // Pre-combine ingredients
    const preCombined = preCombine(group.recipes, ingredientsByRecipe);
    console.log(`  Pre-combined: ${preCombined.length} items`);

    try {
      // Call edge function
      const combined = await callCombineFunction(preCombined);
      console.log(`  Combined: ${combined.length} items (merge ratio: ${preCombined.length}→${combined.length})`);

      totalPreCombined += preCombined.length;
      totalCombined += combined.length;

      newResults.push({
        groupIndex: group.groupIndex,
        recipes: recipeNames.map((name) => ({ name })),
        preCombinedCount: preCombined.length,
        combinedCount: combined.length,
        preCombined,
        combined,
      });
    } catch (err) {
      console.error(`  ERROR: ${err.message}`);
      // Save what we have so far, but mark this group as failed
      newResults.push({
        groupIndex: group.groupIndex,
        recipes: recipeNames.map((name) => ({ name })),
        preCombinedCount: preCombined.length,
        combinedCount: 0,
        preCombined,
        combined: [],
        error: err.message,
      });
    }

    console.log("");
  }

  // Merge with existing results and save
  const mergedResults = mergeResults(existingResults, newResults);
  saveResults(mergedResults);

  // Print summary
  console.log("=== Summary ===\n");
  console.log(`Groups processed: ${groupsToProcess.length}`);
  console.log(`Total pre-combined items: ${totalPreCombined}`);
  console.log(`Total combined items: ${totalCombined}`);
  if (totalPreCombined > 0) {
    console.log(`Overall merge ratio: ${totalPreCombined} → ${totalCombined} (${((1 - totalCombined / totalPreCombined) * 100).toFixed(1)}% reduction)`);
  }
  console.log(`\nResults saved to ${RESULTS_FILE_RALPH}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
