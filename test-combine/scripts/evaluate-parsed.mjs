#!/usr/bin/env node

/**
 * Claude-powered evaluation of parsed recipe ingredients from the local Supabase DB.
 *
 * Uses the Anthropic API (claude-sonnet-4-5-20250929) to evaluate ingredient quality
 * instead of brittle regex rules. Claude naturally understands:
 *   - Pluralization (tomatoes → tomato, but "red pepper flakes" stays plural)
 *   - Prep adjectives vs product-form qualifiers (remove "toasted" from sesame seed, keep "dried" in dried apricot)
 *   - Category correctness (water → other, canned tomato → pantry, fresh produce → produce)
 *   - Unit standardization (tsp/tbsp/cup/oz/lb/quart/gallon/head/bunch/stalk/clove/sprig/piece/slice/strip/can/ear/null)
 *   - Typos and misspellings
 *   - Quantity reasonableness
 *   - Count units embedded in names (garlic clove → name=garlic, unit=clove)
 *
 * Usage:
 *   node test-combine/scripts/evaluate-parsed.mjs
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPORT_FILE = path.join(__dirname, "../evaluation-report.json");

const BASE_URL = "http://127.0.0.1:54321";
const REST_URL = `${BASE_URL}/rest/v1`;
const API_KEY = "REDACTED";
const AUTH_HEADERS = {
  apikey: API_KEY,
  Authorization: `Bearer ${API_KEY}`,
  "Content-Type": "application/json",
};

// Get Anthropic API key (same pattern as parse-recipes.mjs)
const ANTHROPIC_API_KEY =
  process.env.ANTHROPIC_API_KEY ||
  (() => {
    try {
      return fs
        .readFileSync(path.join(__dirname, "../../supabase/functions/.env"), "utf-8")
        .match(/ANTHROPIC_API_KEY=(.*)/)?.[1]
        ?.trim();
    } catch {
      return null;
    }
  })();

if (!ANTHROPIC_API_KEY) {
  console.error("No ANTHROPIC_API_KEY found. Set ANTHROPIC_API_KEY env var or add it to supabase/functions/.env");
  process.exit(1);
}

const VALID_UNITS = [
  "tsp", "tbsp", "cup", "oz", "lb",
  "quart", "gallon", "head", "bunch",
  "stalk", "clove", "sprig", "piece",
  "slice", "strip", "can", "ear",
  "null (no unit)",
];

const VALID_CATEGORIES = [
  "produce", "meat_seafood", "dairy", "pantry",
  "spices", "frozen", "bakery", "beverages",
  "condiments", "other",
];

const BATCH_SIZE = 15; // recipes per Claude API call
const DELAY_BETWEEN_CALLS_MS = 1500;

// ---------- Fetch data from DB ----------

async function fetchAllIngredients() {
  const rows = [];
  let offset = 0;
  const limit = 1000;

  while (true) {
    const url = `${REST_URL}/recipe_ingredients?select=name,quantity,unit,raw_text,category,recipe_id,sort_order&order=recipe_id,sort_order&offset=${offset}&limit=${limit}`;
    const res = await fetch(url, { headers: AUTH_HEADERS });
    if (!res.ok) {
      throw new Error(`Failed to fetch recipe_ingredients: ${res.status}`);
    }
    const batch = await res.json();
    rows.push(...batch);
    if (batch.length < limit) break;
    offset += limit;
  }

  return rows;
}

async function fetchAllRecipes() {
  const res = await fetch(`${REST_URL}/recipes?select=id,name`, {
    headers: AUTH_HEADERS,
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch recipes: ${res.status}`);
  }
  return res.json();
}

// ---------- Group ingredients by recipe ----------

function groupByRecipe(ingredients, recipeNames) {
  const groups = new Map();
  for (const ing of ingredients) {
    const recipeName = recipeNames.get(ing.recipe_id) || "Unknown recipe";
    if (!groups.has(ing.recipe_id)) {
      groups.set(ing.recipe_id, { recipeName, ingredients: [] });
    }
    groups.get(ing.recipe_id).ingredients.push(ing);
  }
  return groups;
}

// ---------- Claude API call ----------

async function callClaude(recipeBatch) {
  const systemPrompt = `You are an expert ingredient quality auditor for a recipe app. You evaluate parsed recipe ingredients for data quality issues.

## Valid units
${VALID_UNITS.join(", ")}

## Valid categories
${VALID_CATEGORIES.join(", ")}

## Issue types to check for

1. **pluralization** — Ingredient names should be SINGULAR (e.g. "tomato" not "tomatoes", "onion" not "onions").
   EXCEPTIONS that stay plural: compound product names like "red pepper flakes", "rice noodles", "breadcrumbs", "brussels sprouts", "chickpeas", "oats", "capers", "greens", "peas", "sprouts", "grits". Words ending in -ss/-us/-is are not plural.

2. **prep_adjective** — Names should NOT contain preparation adjectives (minced, diced, chopped, sliced, grated, toasted, melted, softened, peeled, etc.).
   EXCEPTIONS to keep: "dried" for dried fruits/products (dried apricot, dried cranberry), "dry" for wines (dry white wine), "fresh" when it identifies a distinct product (fresh mozzarella, fresh pasta), "roasted" for distinct products (roasted red pepper, roasted garlic), "hot" for product names (hot sauce, hot chile paste), "crushed" for products (crushed tomato, crushed red pepper, red pepper flakes).

3. **category_inconsistency** — Check that the category makes sense:
   - Water → "other" (NEVER "beverages")
   - Eggs → "pantry"
   - All cooking oils → "pantry"
   - Sauces/vinegars/condiments → "condiments"
   - Lemon juice, lime juice → "produce"
   - Seeds (sesame, poppy, etc.) → "spices"
   - Canned/processed tomato products (crushed tomato, tomato paste, diced tomato, tomato sauce) → "pantry"
   - Fresh tomatoes → "produce"
   - Fresh fruits/vegetables → "produce"
   - Dried spices/herbs → "spices"
   - Flour, sugar, rice, pasta, canned goods → "pantry"
   - Butter, cream, cheese, milk, yogurt → "dairy"
   - Chicken, beef, pork, fish, shrimp → "meat_seafood"
   - Bread, tortillas, buns → "bakery"

4. **non_standard_unit** — Unit must be one of the valid units listed above, or null. Flag any other unit (e.g. "dash", "pinch", "g", "ml", "handful").

5. **typo** — Misspelled ingredient names (e.g. "tumeric" → "turmeric", "parsely" → "parsley").

6. **quantity_precision** — Quantities with more than 3 decimal places should be rounded.

7. **count_unit_in_name** — Count units like "clove", "head", "bunch", "stalk", "sprig", "piece", "ear", "strip", "slice" should be in the unit field, not embedded in the name. E.g. "garlic clove" should be name="garlic" unit="clove".

## Response format

Return a JSON array of issues found. Each issue must have:
{
  "recipeName": "...",
  "ingredientName": "the original name from the data",
  "issueType": "one of: pluralization, prep_adjective, category_inconsistency, non_standard_unit, typo, quantity_precision, count_unit_in_name",
  "description": "clear explanation of the issue",
  "suggestedFix": "what the corrected value should be"
}

If no issues are found for a batch, return an empty array: []

IMPORTANT: Only flag genuine issues. Do NOT flag:
- Correctly singular names
- Product-form qualifiers that should be kept (dried apricot, crushed tomato, red pepper flakes, dry white wine)
- Standard plural exceptions (breadcrumbs, chickpeas, oats, noodles, etc.)
- Correct categories
- Valid units including null`;

  const userContent = recipeBatch
    .map(({ recipeName, ingredients }) => {
      const ingList = ingredients
        .map(
          (ing) =>
            `  - name: "${ing.name}", quantity: ${ing.quantity}, unit: ${ing.unit === null ? "null" : `"${ing.unit}"`}, category: "${ing.category}", raw_text: "${ing.raw_text || ""}"`
        )
        .join("\n");
      return `### ${recipeName}\n${ingList}`;
    })
    .join("\n\n");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Evaluate these recipe ingredients for quality issues. Return ONLY a JSON array of issues (no markdown, no explanation).\n\n${userContent}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${errText}`);
  }

  const result = await response.json();
  const text = result.content[0].text.trim();

  // Parse JSON from the response (handle potential markdown wrapping)
  let jsonStr = text;
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }

  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error("Failed to parse Claude response as JSON:", text.substring(0, 200));
    return [];
  }
}

// ---------- Main ----------

async function main() {
  console.log("=== Claude-Powered Ingredient Quality Evaluator ===\n");
  console.log("Fetching data from local Supabase...\n");

  const [ingredients, recipes] = await Promise.all([
    fetchAllIngredients(),
    fetchAllRecipes(),
  ]);

  console.log(`Found ${recipes.length} recipes, ${ingredients.length} ingredients\n`);

  if (ingredients.length === 0) {
    console.log("No ingredients to evaluate — 0 issues found.");
    const report = {
      summary: {
        totalIssues: 0,
        totalRecipes: recipes.length,
        totalIngredients: 0,
        byType: {},
      },
      issues: [],
    };
    writeReport(report);
    return;
  }

  // Build recipe name map
  const recipeNames = new Map();
  for (const r of recipes) {
    recipeNames.set(r.id, r.name);
  }

  // Group ingredients by recipe
  const recipeGroups = groupByRecipe(ingredients, recipeNames);
  const recipeEntries = Array.from(recipeGroups.values());

  // Batch recipes for Claude API calls
  const batches = [];
  for (let i = 0; i < recipeEntries.length; i += BATCH_SIZE) {
    batches.push(recipeEntries.slice(i, i + BATCH_SIZE));
  }

  console.log(`Processing ${recipeEntries.length} recipes in ${batches.length} batch(es) of up to ${BATCH_SIZE}...\n`);

  const allIssues = [];

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const recipeNamesList = batch.map((b) => b.recipeName).join(", ");
    console.log(`Batch ${i + 1}/${batches.length}: ${batch.length} recipes (${recipeNamesList.substring(0, 80)}${recipeNamesList.length > 80 ? "..." : ""})`);

    try {
      const issues = await callClaude(batch);

      if (Array.isArray(issues)) {
        // Add recipe IDs back to issues
        for (const issue of issues) {
          // Find the recipe_id from the batch
          const recipeEntry = batch.find(
            (b) => b.recipeName === issue.recipeName
          );
          if (recipeEntry) {
            // Find the recipe_id from the ingredients
            issue.recipeId = recipeEntry.ingredients[0]?.recipe_id || null;
          } else {
            issue.recipeId = null;
          }
          allIssues.push(issue);
        }
        console.log(`  → Found ${issues.length} issue(s)\n`);
      } else {
        console.log(`  → Unexpected response format, skipping\n`);
      }
    } catch (err) {
      console.error(`  → Error: ${err.message}\n`);
      // If rate limited, wait longer and retry once
      if (err.message.includes("429")) {
        console.log("  → Rate limited, waiting 60s before retry...");
        await sleep(60000);
        try {
          const issues = await callClaude(batch);
          if (Array.isArray(issues)) {
            for (const issue of issues) {
              const recipeEntry = batch.find(
                (b) => b.recipeName === issue.recipeName
              );
              issue.recipeId = recipeEntry?.ingredients[0]?.recipe_id || null;
              allIssues.push(issue);
            }
            console.log(`  → Retry found ${issues.length} issue(s)\n`);
          }
        } catch (retryErr) {
          console.error(`  → Retry also failed: ${retryErr.message}\n`);
        }
      }
    }

    // Delay between API calls (skip after last batch)
    if (i < batches.length - 1) {
      await sleep(DELAY_BETWEEN_CALLS_MS);
    }
  }

  // Build report
  const byType = {};
  for (const issue of allIssues) {
    byType[issue.issueType] = (byType[issue.issueType] || 0) + 1;
  }

  const report = {
    summary: {
      totalIssues: allIssues.length,
      totalRecipes: recipes.length,
      totalIngredients: ingredients.length,
      byType,
    },
    issues: allIssues,
  };

  writeReport(report);

  // Print summary
  console.log("\n=== Evaluation Report ===\n");
  console.log(`Total issues: ${allIssues.length}`);
  console.log(`Total recipes: ${recipes.length}`);
  console.log(`Total ingredients: ${ingredients.length}`);
  console.log("\nIssues by type:");
  for (const [type, count] of Object.entries(byType).sort(
    (a, b) => b[1] - a[1]
  )) {
    console.log(`  ${type}: ${count}`);
  }

  if (allIssues.length > 0) {
    console.log("\n--- Sample issues by type ---\n");
    const seenTypes = new Set();
    for (const issue of allIssues) {
      if (!seenTypes.has(issue.issueType)) {
        seenTypes.add(issue.issueType);
        console.log(
          `[${issue.issueType}] ${issue.ingredientName} in "${issue.recipeName}"`
        );
        console.log(`  -> ${issue.description}`);
        console.log(`  -> Fix: ${issue.suggestedFix}\n`);
      }
    }
  }

  console.log(`\nReport saved to ${REPORT_FILE}`);
}

function writeReport(report) {
  fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
