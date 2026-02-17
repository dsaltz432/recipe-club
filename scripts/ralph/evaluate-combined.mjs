#!/usr/bin/env node

/**
 * Claude-powered evaluation of combine-ingredients edge function results.
 *
 * Reads combine-results.json (produced by batch-combine.mjs), then for each
 * event group sends the preCombined INPUT and combined OUTPUT to Claude to
 * evaluate whether ingredients were merged correctly.
 *
 * Issue types checked:
 *   1. missed_merge — items that should have been merged but weren't
 *   2. wrong_merge — items incorrectly merged together
 *   3. quantity_error — quantities not summed correctly
 *   4. unit_error — wrong unit choice when merging
 *   5. name_cleaning — output names should be clean base names
 *   6. category_error — wrong category in output
 *   7. source_recipes_error — sourceRecipes not correctly combined/deduplicated
 *
 * Usage:
 *   node scripts/ralph/evaluate-combined.mjs
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RESULTS_FILE = path.join(__dirname, "combine-results.json");
const RESULTS_FILE_ALT = path.join(__dirname, "../../test-combine/combine-results.json");
const REPORT_FILE = path.join(__dirname, "combine-evaluation-report.json");
const REPORT_FILE_ALT = path.join(__dirname, "../../test-combine/combine-evaluation-report.json");

// Get Anthropic API key (same pattern as evaluate-claude.mjs)
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

const BATCH_SIZE = 5; // event groups per Claude API call
const DELAY_BETWEEN_CALLS_MS = 1500;

// ---------- Load results ----------

function loadResults() {
  for (const filePath of [RESULTS_FILE, RESULTS_FILE_ALT]) {
    try {
      const data = fs.readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(data);
      console.log(`Loaded results from ${filePath}`);
      return parsed;
    } catch {
      // Continue to next path
    }
  }
  return [];
}

// ---------- Claude API call ----------

async function callClaude(groupBatch) {
  const systemPrompt = `You are an expert ingredient-combining quality auditor for a recipe app grocery list feature. You evaluate whether a combine-ingredients function correctly merged pre-combined ingredient lists.

## Context
The combine-ingredients function takes a list of pre-combined ingredients (already grouped by exact name+unit match and quantities summed) and performs SEMANTIC merging — combining items that refer to the same ingredient but have different names (e.g. "garlic" and "garlic clove", "scallion" and "green onion").

## Issue types to check

1. **missed_merge** — Items in the output that should have been merged but weren't. Examples:
   - "garlic" and "garlic clove" both appearing in output
   - "scallion" and "green onion" both in output
   - "soy sauce" and "low-sodium soy sauce" both in output (should merge, noting variety)
   - Same ingredient with different casing/spelling appearing separately

2. **wrong_merge** — Items that were incorrectly merged together. Examples:
   - "sesame oil" merged with "olive oil" (different oils)
   - "rice vinegar" merged with "balsamic vinegar" (different vinegars)
   - "chicken breast" merged with "chicken broth" (different products)
   - "fresh ginger" merged with "ground ginger" (can be different forms)

3. **quantity_error** — Quantities not correctly summed or preserved after merge. Examples:
   - Two inputs of quantity 2 and 3 should result in quantity 5
   - Input with null quantity merged with input with quantity 2 — output should be at least 2
   - Quantities lost (became null when inputs had quantities)

4. **unit_error** — Wrong unit choice when merging items with different units. Examples:
   - Merging "tbsp" and "cup" without converting to a common unit
   - Losing the unit entirely when inputs had units
   - Choosing the wrong unit when both inputs had the same unit

5. **name_cleaning** — Output names should be clean base ingredient names. Examples:
   - Output contains prep adjectives that should be removed: "diced tomato" → "tomato"
   - Output contains count-units in name: "garlic clove" → name="garlic", unit="clove"
   - Output uses an unnecessarily verbose name
   EXCEPTIONS: Keep product-form qualifiers like "dried apricot", "crushed red pepper", "roasted red pepper"

6. **category_error** — Wrong category in the output. Check standard categorization:
   - Fresh produce → "produce"
   - Meat/fish/shrimp → "meat_seafood"
   - Butter/cream/cheese/milk → "dairy"
   - Oils/flour/sugar/rice/pasta/canned goods/eggs → "pantry"
   - Spices/dried herbs/seeds → "spices"
   - Sauces/vinegars → "condiments"
   - Water → "other"

7. **source_recipes_error** — sourceRecipes array not correctly combined/deduplicated. Examples:
   - Merged items should have the union of all sourceRecipes from their inputs
   - Duplicate recipe names in sourceRecipes
   - Missing recipe names that were in the input sourceRecipes

## How to evaluate

For each event group, you receive:
- **INPUT (preCombined)**: The ingredients BEFORE semantic merging
- **OUTPUT (combined)**: The ingredients AFTER semantic merging

Check that:
- Every input item maps to exactly one output item
- No information is lost (quantities, sourceRecipes preserved)
- Semantic merges are correct (similar items combined, dissimilar kept separate)
- Output names are clean and categories are correct

## Response format

Return a JSON array of issues found. Each issue must have:
{
  "groupIndex": <number>,
  "recipes": [<recipe names in this group>],
  "issueType": "missed_merge|wrong_merge|quantity_error|unit_error|name_cleaning|category_error|source_recipes_error",
  "description": "clear explanation of the issue",
  "inputItems": ["relevant input item names"],
  "outputItem": "the relevant output item name (or null)",
  "suggestedFix": "what the correct output should be"
}

If no issues are found for a batch, return an empty array: []

IMPORTANT: Only flag genuine issues. Do NOT flag:
- Correct merges of semantically similar ingredients
- Reasonable unit choices
- Minor stylistic differences that don't affect functionality
- Items correctly kept separate because they are genuinely different`;

  const userContent = groupBatch
    .map((group) => {
      const inputList = group.preCombined
        .map(
          (item) =>
            `    - name: "${item.name}", quantity: ${item.quantity === null ? "null" : `"${item.quantity}"`}, unit: ${item.unit === null ? "null" : `"${item.unit}"`}, category: "${item.category}", sourceRecipes: [${item.sourceRecipes.map((r) => `"${r}"`).join(", ")}]`
        )
        .join("\n");

      const outputList = group.combined
        .map(
          (item) =>
            `    - name: "${item.name}", totalQuantity: ${item.totalQuantity === null ? "null" : item.totalQuantity}, unit: ${item.unit === null ? "null" : `"${item.unit}"`}, category: "${item.category}", sourceRecipes: [${item.sourceRecipes.map((r) => `"${r}"`).join(", ")}]`
        )
        .join("\n");

      return `## Group ${group.groupIndex} — Recipes: ${group.recipes.map((r) => r.name).join(", ")}

### INPUT (preCombined) — ${group.preCombinedCount} items
${inputList}

### OUTPUT (combined) — ${group.combinedCount} items
${outputList}`;
    })
    .join("\n\n---\n\n");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 8192,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Evaluate these combine-ingredients results for quality issues. Return ONLY a JSON array of issues (no markdown, no explanation).\n\n${userContent}`,
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

// ---------- Report writing ----------

function writeReport(report) {
  const json = JSON.stringify(report, null, 2);

  // Write to ralph dir first (sandbox-safe)
  fs.writeFileSync(REPORT_FILE, json);

  // Also try to write to test-combine dir
  try {
    const dir = path.dirname(REPORT_FILE_ALT);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(REPORT_FILE_ALT, json);
  } catch {
    console.log(`Note: Could not write to ${REPORT_FILE_ALT}, report saved to ${REPORT_FILE}`);
  }
}

// ---------- Utility ----------

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------- Main ----------

async function main() {
  console.log("=== Claude-Powered Combine-Ingredients Evaluator ===\n");

  // Load combine results
  const results = loadResults();

  if (!Array.isArray(results) || results.length === 0) {
    console.log("No combine results found — nothing to evaluate.");
    const report = {
      summary: {
        totalIssues: 0,
        totalGroups: 0,
        byType: {},
      },
      issues: [],
    };
    writeReport(report);
    console.log("\nEmpty report saved.");
    return;
  }

  // Filter out groups with errors (no combined output)
  const validResults = results.filter(
    (r) => !r.error && Array.isArray(r.combined) && r.combined.length > 0
  );

  console.log(`Loaded ${results.length} groups (${validResults.length} valid, ${results.length - validResults.length} with errors)\n`);

  if (validResults.length === 0) {
    console.log("No valid groups to evaluate.");
    const report = {
      summary: {
        totalIssues: 0,
        totalGroups: results.length,
        byType: {},
      },
      issues: [],
    };
    writeReport(report);
    return;
  }

  // Batch groups for Claude API calls
  const batches = [];
  for (let i = 0; i < validResults.length; i += BATCH_SIZE) {
    batches.push(validResults.slice(i, i + BATCH_SIZE));
  }

  console.log(`Processing ${validResults.length} groups in ${batches.length} batch(es) of up to ${BATCH_SIZE}...\n`);

  const allIssues = [];

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const groupIndices = batch.map((g) => g.groupIndex).join(", ");
    console.log(`Batch ${i + 1}/${batches.length}: groups [${groupIndices}]`);

    try {
      const issues = await callClaude(batch);

      if (Array.isArray(issues)) {
        allIssues.push(...issues);
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
            allIssues.push(...issues);
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
      totalGroups: validResults.length,
      byType,
    },
    issues: allIssues,
  };

  writeReport(report);

  // Print summary
  console.log("\n=== Evaluation Report ===\n");
  console.log(`Total issues: ${allIssues.length}`);
  console.log(`Total groups evaluated: ${validResults.length}`);
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
          `[${issue.issueType}] Group ${issue.groupIndex}: ${issue.description}`
        );
        if (issue.inputItems?.length) {
          console.log(`  Input items: ${issue.inputItems.join(", ")}`);
        }
        if (issue.outputItem) {
          console.log(`  Output item: ${issue.outputItem}`);
        }
        console.log(`  Fix: ${issue.suggestedFix}\n`);
      }
    }
  }

  console.log(`\nReport saved to ${REPORT_FILE}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
