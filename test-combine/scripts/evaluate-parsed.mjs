#!/usr/bin/env node

/**
 * Evaluate the quality of parsed recipe ingredients from the local Supabase DB.
 *
 * Checks for:
 * 1. Pluralization — names ending in s/es/ies that should be singular
 * 2. Count units in names — clove/head/bunch/stalk/sprig/piece in name field
 * 3. Prep adjectives — fresh/minced/diced/chopped/crushed/cold/hot in names
 * 4. Typos — known misspellings
 * 5. Category inconsistency — same name different categories + hardcoded rules
 * 6. Non-standard units — units not in the accepted set
 * 7. Quantity issues — more than 3 decimal places
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

// ---------- Constants ----------

const VALID_UNITS = new Set([
  "tsp", "tbsp", "cup", "oz", "lb",
  "quart", "gallon", "head", "bunch",
  "stalk", "clove", "sprig", "piece",
  "slice", "strip", "can", "ear",
  null,
]);

const COUNT_UNIT_WORDS = [
  "clove", "cloves",
  "head", "heads",
  "bunch", "bunches",
  "stalk", "stalks",
  "sprig", "sprigs",
  "piece", "pieces",
  "ear", "ears",
  "strip", "strips",
  "slice", "slices",
];

const PREP_ADJECTIVES = [
  "fresh", "freshly",
  "minced", "diced", "chopped", "crushed",
  "sliced", "grated", "shredded", "julienned",
  "cold", "hot", "warm", "room temperature",
  "frozen", "thawed",
  "toasted", "roasted",
  "dried", "dry",
  "melted", "softened",
  "cooked", "uncooked",
  "peeled", "deveined",
  "trimmed", "halved", "quartered",
  "thinly", "finely", "roughly", "coarsely",
];

// Words that legitimately end in s/es/ies — not plural
const PLURAL_WHITELIST = new Set([
  "hummus", "couscous", "molasses", "lemongrass",
  "aioli", "tzatziki", "sumac",
  "asparagus", "arugula",
  "chickpeas",
  "grits", "oats", "rolled oats",
  "capers",
  "artichoke hearts",
  "brussels sprouts",
  "swiss", "peas",
  "panko breadcrumbs",
  "breadcrumbs",
  "noodles", "sprouts",
  "greens",
  // Compound product names where plural is standard
  "red pepper flakes", "chili flakes", "chilli flakes",
  "rice noodles", "lo mein noodles", "egg noodles", "ramen noodles", "udon noodles", "soba noodles",
  "foie gras",
]);

// Category rules — specific ingredients must be in specific categories
const CATEGORY_RULES = {
  water: "other",
  egg: "pantry",
  eggs: "pantry",
  "olive oil": "pantry",
  "vegetable oil": "pantry",
  "canola oil": "pantry",
  "sesame oil": "pantry",
  "coconut oil": "pantry",
  "avocado oil": "pantry",
  "cooking oil": "pantry",
  oil: "pantry",
  "soy sauce": "condiments",
  "fish sauce": "condiments",
  "hot sauce": "condiments",
  "worcestershire sauce": "condiments",
  vinegar: "condiments",
  "rice vinegar": "condiments",
  "balsamic vinegar": "condiments",
  "white vinegar": "condiments",
  "apple cider vinegar": "condiments",
  "red wine vinegar": "condiments",
  "lemon juice": "produce",
  "lime juice": "produce",
  ketchup: "condiments",
  mustard: "condiments",
  mayonnaise: "condiments",
  "crushed tomato": "pantry",
  "tomato paste": "pantry",
  "diced tomato": "pantry",
  "tomato sauce": "pantry",
};

const KNOWN_TYPOS = {
  tumeric: "turmeric",
  tumerik: "turmeric",
  cinamon: "cinnamon",
  cinnmon: "cinnamon",
  parsely: "parsley",
  parsly: "parsley",
  oregnao: "oregano",
  cilanrto: "cilantro",
  cilnatro: "cilantro",
  brocoli: "broccoli",
  brocolli: "broccoli",
  zuchini: "zucchini",
  zuccini: "zucchini",
  jalapeno: "jalapeño",
  habanero: "habanero pepper",
  avacado: "avocado",
  portabella: "portobello",
  cummin: "cumin",
  worchestershire: "worcestershire",
  worchestshire: "worcestershire",
  worchesteshire: "worcestershire",
};

// ---------- Fetch data from DB ----------

async function fetchAllIngredients() {
  const rows = [];
  let offset = 0;
  const limit = 1000;

  while (true) {
    const url = `${REST_URL}/recipe_ingredients?select=name,quantity,unit,raw_text,category,recipe_id&offset=${offset}&limit=${limit}`;
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
  const res = await fetch(`${REST_URL}/recipes?select=id,name`, { headers: AUTH_HEADERS });
  if (!res.ok) {
    throw new Error(`Failed to fetch recipes: ${res.status}`);
  }
  return res.json();
}

// ---------- Evaluation checks ----------

function checkPluralization(ingredient, recipeName) {
  const issues = [];
  const name = ingredient.name.toLowerCase().trim();

  // Skip whitelisted words
  if (PLURAL_WHITELIST.has(name)) return issues;

  // Skip words ending in -ss, -us, -is (not plural forms)
  if (/ss$/.test(name) || /us$/.test(name) || /is$/.test(name)) return issues;

  // Check for plural endings
  if (/ies$/.test(name) && name.length > 4) {
    issues.push({
      recipeId: ingredient.recipe_id,
      recipeName,
      ingredientName: ingredient.name,
      issueType: "pluralization",
      description: `Name "${ingredient.name}" appears to be plural (ends in -ies). Should be singular: "${name.replace(/ies$/, "y")}"`,
      suggestedFix: name.replace(/ies$/, "y"),
    });
  } else if (/[^s]es$/.test(name) && !/[cxzs]hes$/.test(name) && !/(ss|[aeiou])es$/.test(name)) {
    issues.push({
      recipeId: ingredient.recipe_id,
      recipeName,
      ingredientName: ingredient.name,
      issueType: "pluralization",
      description: `Name "${ingredient.name}" appears to be plural (ends in -es). Should be singular: "${name.replace(/es$/, "")}"`,
      suggestedFix: name.replace(/es$/, ""),
    });
  } else if (/[^su]s$/.test(name) && !/ss$/.test(name)) {
    const words = name.split(" ");
    const lastWord = words[words.length - 1];
    if (PLURAL_WHITELIST.has(lastWord)) return issues;
    if (/ss$/.test(lastWord) || /us$/.test(lastWord) || /is$/.test(lastWord)) return issues;

    if (lastWord.length > 2 && /[^su]s$/.test(lastWord)) {
      issues.push({
        recipeId: ingredient.recipe_id,
        recipeName,
        ingredientName: ingredient.name,
        issueType: "pluralization",
        description: `Name "${ingredient.name}" appears to be plural (ends in -s). Should be singular: "${name.replace(/s$/, "")}"`,
        suggestedFix: name.replace(/s$/, ""),
      });
    }
  }

  return issues;
}

function checkCountUnitsInName(ingredient, recipeName) {
  const issues = [];
  const nameLower = ingredient.name.toLowerCase();
  const nameWords = nameLower.split(/\s+/);

  for (const unitWord of COUNT_UNIT_WORDS) {
    if (nameWords.includes(unitWord)) {
      issues.push({
        recipeId: ingredient.recipe_id,
        recipeName,
        ingredientName: ingredient.name,
        issueType: "count_unit_in_name",
        description: `Name "${ingredient.name}" contains count unit "${unitWord}" which should be in the unit field instead`,
        suggestedFix: `Move "${unitWord}" to unit field, name should be "${nameWords.filter((w) => w !== unitWord).join(" ")}"`,
      });
    }
  }

  return issues;
}

function checkPrepAdjectives(ingredient, recipeName) {
  const issues = [];
  const nameLower = ingredient.name.toLowerCase();
  const nameWords = nameLower.split(/\s+/);

  if (nameWords.length < 2) return issues;

  for (const adj of PREP_ADJECTIVES) {
    if (nameWords.includes(adj)) {
      const remaining = nameWords.filter((w) => w !== adj).join(" ");

      if (remaining.length < 2) continue;

      if (adj === "dried" && (isHerbOrSpice(remaining) || isDriedProduct(remaining))) continue;
      if (adj === "roasted" && isDistinctRoastedProduct(remaining)) continue;
      if (adj === "dry" && isWineOrAlcohol(remaining)) continue;
      if (adj === "hot" && isHotProduct(remaining)) continue;
      if (adj === "crushed" && isCrushedProduct(remaining)) continue;

      issues.push({
        recipeId: ingredient.recipe_id,
        recipeName,
        ingredientName: ingredient.name,
        issueType: "prep_adjective",
        description: `Name "${ingredient.name}" contains preparation adjective "${adj}". Should be just "${remaining}"`,
        suggestedFix: remaining,
      });
    }
  }

  return issues;
}

function isHerbOrSpice(name) {
  const herbs = [
    "oregano", "basil", "thyme", "rosemary", "parsley",
    "dill", "chili", "chiles", "chile", "pepper",
    "bay leaf", "bay leaves",
  ];
  return herbs.some((h) => name.includes(h));
}

function isDistinctRoastedProduct(name) {
  const products = ["red pepper", "red peppers", "garlic", "peanut", "peanuts", "sesame", "chili oil"];
  return products.some((p) => name.includes(p));
}

function isDriedProduct(name) {
  // Dried fruits and other products where "dried" changes the identity
  const products = ["apricot", "cranberry", "cherry", "fig", "date", "mango", "pineapple", "tomato", "mushroom", "shrimp", "pasta"];
  return products.some((p) => name.includes(p));
}

function checkTypos(ingredient, recipeName) {
  const issues = [];
  const nameLower = ingredient.name.toLowerCase().trim();

  if (KNOWN_TYPOS[nameLower] && KNOWN_TYPOS[nameLower] !== nameLower) {
    issues.push({
      recipeId: ingredient.recipe_id,
      recipeName,
      ingredientName: ingredient.name,
      issueType: "typo",
      description: `Name "${ingredient.name}" appears to be a typo. Should be "${KNOWN_TYPOS[nameLower]}"`,
      suggestedFix: KNOWN_TYPOS[nameLower],
    });
  }

  const words = nameLower.split(/\s+/);
  for (const word of words) {
    if (KNOWN_TYPOS[word] && KNOWN_TYPOS[word] !== word) {
      issues.push({
        recipeId: ingredient.recipe_id,
        recipeName,
        ingredientName: ingredient.name,
        issueType: "typo",
        description: `Name "${ingredient.name}" contains possible typo "${word}". Should be "${KNOWN_TYPOS[word]}"`,
        suggestedFix: ingredient.name.replace(new RegExp(word, "i"), KNOWN_TYPOS[word]),
      });
    }
  }

  return issues;
}

function checkCategoryInconsistency(ingredient, recipeName, categoryMap) {
  const issues = [];
  const nameLower = ingredient.name.toLowerCase().trim();
  const category = ingredient.category;

  if (CATEGORY_RULES[nameLower] && category !== CATEGORY_RULES[nameLower]) {
    issues.push({
      recipeId: ingredient.recipe_id,
      recipeName,
      ingredientName: ingredient.name,
      issueType: "category_inconsistency",
      description: `"${ingredient.name}" is categorized as "${category}" but should be "${CATEGORY_RULES[nameLower]}"`,
      suggestedFix: `Change category to "${CATEGORY_RULES[nameLower]}"`,
    });
  }

  if (categoryMap.has(nameLower)) {
    const existingCategory = categoryMap.get(nameLower);
    if (existingCategory !== category) {
      issues.push({
        recipeId: ingredient.recipe_id,
        recipeName,
        ingredientName: ingredient.name,
        issueType: "category_inconsistency",
        description: `"${ingredient.name}" has category "${category}" here but "${existingCategory}" in other recipes`,
        suggestedFix: `Standardize category (most common: "${existingCategory}")`,
      });
    }
  } else {
    categoryMap.set(nameLower, category);
  }

  return issues;
}

function checkNonStandardUnit(ingredient, recipeName) {
  const issues = [];
  const unit = ingredient.unit;

  if (unit !== null && !VALID_UNITS.has(unit.toLowerCase())) {
    issues.push({
      recipeId: ingredient.recipe_id,
      recipeName,
      ingredientName: ingredient.name,
      issueType: "non_standard_unit",
      description: `Unit "${unit}" is not in the standard set. Standard units: tsp, tbsp, cup, oz, lb, quart, gallon, head, bunch, stalk, clove, sprig, piece, slice, strip, can, ear, or null`,
      suggestedFix: `Convert to a standard unit or null`,
    });
  }

  return issues;
}

function checkQuantityIssues(ingredient, recipeName) {
  const issues = [];
  const qty = ingredient.quantity;

  if (qty === null || qty === undefined) return issues;

  const qtyStr = String(qty);
  const decimalMatch = qtyStr.match(/\.(\d+)/);
  if (decimalMatch && decimalMatch[1].length > 3) {
    issues.push({
      recipeId: ingredient.recipe_id,
      recipeName,
      ingredientName: ingredient.name,
      issueType: "quantity_precision",
      description: `Quantity ${qty} has more than 3 decimal places. Should be rounded: ${parseFloat(qty.toFixed(3))}`,
      suggestedFix: `Round to ${parseFloat(qty.toFixed(3))}`,
    });
  }

  return issues;
}

function isWineOrAlcohol(name) {
  const terms = ["wine", "vermouth", "sherry", "marsala"];
  return terms.some((t) => name.includes(t));
}

function isHotProduct(name) {
  const terms = ["sauce", "paste", "pepper", "chili", "chile"];
  return terms.some((t) => name.includes(t));
}

function isCrushedProduct(name) {
  const terms = ["tomato", "red pepper", "pepper flakes"];
  return terms.some((t) => name.includes(t));
}

// ---------- Main ----------

async function main() {
  console.log("Fetching data from local Supabase...\n");

  const [ingredients, recipes] = await Promise.all([
    fetchAllIngredients(),
    fetchAllRecipes(),
  ]);

  console.log(`Found ${recipes.length} recipes, ${ingredients.length} ingredients\n`);

  if (ingredients.length === 0) {
    console.log("No ingredients to evaluate — 0 issues found.");
    const report = {
      summary: { totalIssues: 0, totalRecipes: recipes.length, totalIngredients: 0, byType: {} },
      issues: [],
    };
    fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2));
    console.log(`Report saved to ${REPORT_FILE}`);
    return;
  }

  const recipeNames = new Map();
  for (const r of recipes) {
    recipeNames.set(r.id, r.name);
  }

  const categoryMap = new Map();
  const allIssues = [];

  for (const ing of ingredients) {
    const recipeName = recipeNames.get(ing.recipe_id) || "Unknown recipe";

    allIssues.push(...checkPluralization(ing, recipeName));
    allIssues.push(...checkCountUnitsInName(ing, recipeName));
    allIssues.push(...checkPrepAdjectives(ing, recipeName));
    allIssues.push(...checkTypos(ing, recipeName));
    allIssues.push(...checkCategoryInconsistency(ing, recipeName, categoryMap));
    allIssues.push(...checkNonStandardUnit(ing, recipeName));
    allIssues.push(...checkQuantityIssues(ing, recipeName));
  }

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

  fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2));

  console.log("=== Evaluation Report ===\n");
  console.log(`Total issues: ${allIssues.length}`);
  console.log(`Total recipes: ${recipes.length}`);
  console.log(`Total ingredients: ${ingredients.length}`);
  console.log("\nIssues by type:");
  for (const [type, count] of Object.entries(byType).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${type}: ${count}`);
  }

  console.log("\n--- Sample issues by type ---\n");
  const seenTypes = new Set();
  for (const issue of allIssues) {
    if (!seenTypes.has(issue.issueType)) {
      seenTypes.add(issue.issueType);
      console.log(`[${issue.issueType}] ${issue.ingredientName} in "${issue.recipeName}"`);
      console.log(`  -> ${issue.description}`);
      console.log(`  -> Fix: ${issue.suggestedFix}\n`);
    }
  }

  console.log(`\nReport saved to ${REPORT_FILE}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
