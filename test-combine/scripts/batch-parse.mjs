#!/usr/bin/env node

/**
 * Batch parse recipes through the local parse-recipe edge function.
 *
 * Usage:
 *   node test-combine/scripts/batch-parse.mjs --offset 0 --limit 20   # parse first 20
 *   node test-combine/scripts/batch-parse.mjs --force                  # re-parse all 153
 *   node test-combine/scripts/batch-parse.mjs --limit 0               # no-op (dry run)
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RECIPES_FILE = path.join(__dirname, "../src/data/recipes.ts");

const BASE_URL = "http://127.0.0.1:54321";
const REST_URL = `${BASE_URL}/rest/v1`;
const FUNCTIONS_URL = `${BASE_URL}/functions/v1`;
const API_KEY = "REDACTED";
const AUTH_HEADERS = {
  apikey: API_KEY,
  Authorization: `Bearer ${API_KEY}`,
  "Content-Type": "application/json",
};

const CONCURRENCY = 10;

// ---------- Parse CLI args ----------

function parseArgs() {
  const args = process.argv.slice(2);
  let offset = 0;
  let limit = Infinity;
  let force = false;

  for (const arg of args) {
    if (arg.startsWith("--offset")) {
      const val = arg.includes("=") ? arg.split("=")[1] : args[args.indexOf(arg) + 1];
      offset = parseInt(val, 10);
    } else if (arg.startsWith("--limit")) {
      const val = arg.includes("=") ? arg.split("=")[1] : args[args.indexOf(arg) + 1];
      limit = parseInt(val, 10);
    } else if (arg === "--force") {
      force = true;
    }
  }

  return { offset, limit, force };
}

// ---------- Read TEST_RECIPES from recipes.ts ----------

function readTestRecipes() {
  const source = fs.readFileSync(RECIPES_FILE, "utf-8");

  // Extract recipe objects using regex
  const recipes = [];
  const recipeRegex = /\{\s*\n\s*id:\s*"([^"]+)",\s*\n\s*name:\s*"([^"]+)",\s*\n\s*cuisine:\s*"([^"]+)",\s*\n\s*url:\s*"([^"]+)",/g;
  let match;
  while ((match = recipeRegex.exec(source)) !== null) {
    recipes.push({
      id: match[1],
      name: match[2],
      cuisine: match[3],
      url: match[4],
    });
  }

  return recipes;
}

// ---------- Upsert recipe into DB ----------

async function upsertRecipe(recipe) {
  const getRes = await fetch(
    `${REST_URL}/recipes?name=eq.${encodeURIComponent(recipe.name)}&select=id`,
    { headers: AUTH_HEADERS }
  );

  if (getRes.ok) {
    const existing = await getRes.json();
    if (existing.length > 0) {
      return existing[0].id;
    }
  }

  const insertRes = await fetch(`${REST_URL}/recipes`, {
    method: "POST",
    headers: {
      ...AUTH_HEADERS,
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      name: recipe.name,
      url: recipe.url,
      created_by: null,
      event_id: null,
      ingredient_id: null,
    }),
  });

  if (!insertRes.ok) {
    const upsertRes = await fetch(`${REST_URL}/recipes`, {
      method: "POST",
      headers: {
        ...AUTH_HEADERS,
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify({
        name: recipe.name,
        url: recipe.url,
        created_by: null,
        event_id: null,
        ingredient_id: null,
      }),
    });

    if (!upsertRes.ok) {
      const err = await upsertRes.text();
      throw new Error(`Failed to upsert recipe "${recipe.name}": ${upsertRes.status} ${err}`);
    }

    const rows = await upsertRes.json();
    return rows[0].id;
  }

  const rows = await insertRes.json();
  return rows[0].id;
}

// ---------- Check if recipe is already parsed ----------

async function isAlreadyParsed(recipeId) {
  const res = await fetch(
    `${REST_URL}/recipe_content?recipe_id=eq.${recipeId}&status=eq.completed&select=id`,
    { headers: AUTH_HEADERS }
  );

  if (!res.ok) return false;
  const rows = await res.json();
  return rows.length > 0;
}

// ---------- Call parse-recipe edge function ----------

async function callParseRecipe(recipeId, recipeUrl, recipeName) {
  const res = await fetch(`${FUNCTIONS_URL}/parse-recipe`, {
    method: "POST",
    headers: AUTH_HEADERS,
    body: JSON.stringify({ recipeId, recipeUrl, recipeName }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Edge function error ${res.status}: ${err.slice(0, 200)}`);
  }

  return res.json();
}

// ---------- Process a single recipe ----------

async function processRecipe(recipe, index, total, force) {
  const label = `[${index + 1}/${total}]`;

  try {
    const recipeId = await upsertRecipe(recipe);

    if (!force) {
      const parsed = await isAlreadyParsed(recipeId);
      if (parsed) {
        console.log(`${label} ${recipe.name} — SKIPPED (already parsed)`);
        return { status: "skipped", name: recipe.name };
      }
    }

    const result = await callParseRecipe(recipeId, recipe.url, recipe.name);

    if (result.skipped) {
      console.log(`${label} ${recipe.name} — SKIPPED (AI key not configured)`);
      return { status: "skipped", name: recipe.name };
    }

    console.log(`${label} ${recipe.name} — ${result.ingredientCount} ingredients`);
    return { status: "parsed", name: recipe.name, ingredientCount: result.ingredientCount };
  } catch (err) {
    console.log(`${label} ${recipe.name} — FAILED: ${err.message}`);
    return { status: "failed", name: recipe.name, error: err.message };
  }
}

// ---------- Main ----------

async function main() {
  const { offset, limit, force } = parseArgs();
  const allRecipes = readTestRecipes();

  console.log(`Total recipes in recipes.ts: ${allRecipes.length}`);

  const slice = allRecipes.slice(offset, offset + limit);

  console.log(`Processing ${slice.length} recipes (offset=${offset}, limit=${limit}${force ? ", force" : ""})\n`);

  if (slice.length === 0) {
    console.log("Nothing to process.");
    return;
  }

  const startTime = Date.now();
  const results = { parsed: 0, failed: 0, skipped: 0 };

  const chunkSize = 2;
  const chunks = [];
  for (let i = 0; i < slice.length; i += chunkSize) {
    chunks.push(slice.slice(i, i + chunkSize));
  }

  for (let i = 0; i < chunks.length; i += CONCURRENCY) {
    const batch = chunks.slice(i, i + CONCURRENCY);
    const batchRecipes = batch.flat();

    const promises = batchRecipes.map((recipe, batchIdx) => {
      const globalIdx = offset + chunks.slice(0, i).flat().length + batchIdx;
      return processRecipe(recipe, globalIdx, slice.length, force);
    });

    const batchResults = await Promise.all(promises);

    for (const r of batchResults) {
      results[r.status]++;
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`\n--- Summary ---`);
  console.log(`Parsed:  ${results.parsed}`);
  console.log(`Failed:  ${results.failed}`);
  console.log(`Skipped: ${results.skipped}`);
  console.log(`Elapsed: ${elapsed}s`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
