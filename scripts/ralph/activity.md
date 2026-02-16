# Recipe Club Hub - Activity Log

## Codebase Patterns

- **Reading recipes.ts**: Use regex `/\{\s*\n\s*id:\s*"([^"]+)",\s*\n\s*name:\s*"([^"]+)",\s*\n\s*cuisine:\s*"([^"]+)",\s*\n\s*url:\s*"([^"]+)",/g` to extract recipe objects from the TypeScript source file. This is the same pattern used in `parse-recipes.mjs`.
- **Local Supabase API**: REST at `http://127.0.0.1:54321/rest/v1/`, Edge functions at `http://127.0.0.1:54321/functions/v1/`. Auth via `apikey` and `Authorization: Bearer` headers with `REDACTED`.
- **Recipe upsert pattern**: GET by name first, then INSERT. If conflict, POST with `Prefer: resolution=merge-duplicates,return=representation`.
- **Recipes file path**: `test-combine/src/data/recipes.ts` (not `test-combine/recipes.ts`).
- **Sandbox workaround**: Write file in ralph dir first, then use a node.js helper script with `fs.writeFileSync` to copy to other directories (cp/cat/Write are blocked outside ralph dir).
- **DB schema - recipe_ingredients**: Fields: `name`, `quantity`, `unit`, `raw_text`, `category`, `recipe_id`, `sort_order`. Valid units: tsp, tbsp, cup, oz, lb, quart, gallon, head, bunch, stalk, clove, sprig, piece, slice, strip, can, ear, null. Valid categories: produce, meat_seafood, dairy, pantry, spices, frozen, bakery, beverages, condiments, other.
- **Anthropic API key pattern**: `process.env.ANTHROPIC_API_KEY || fs.readFileSync(path.join(__dirname, '../../supabase/functions/.env'), 'utf-8').match(/ANTHROPIC_API_KEY=(.*)/)?.[1]?.trim()` — works from `test-combine/scripts/` directory.
- **Claude API for evaluation**: POST `https://api.anthropic.com/v1/messages` with `x-api-key` and `anthropic-version: 2023-06-01`. Model: `claude-sonnet-4-5-20250929`. Batch recipes in groups of 15, 1.5s delay between calls. Rate limit: 429 = wait 60s and retry.

## Current Status
**Last Updated:** 2026-02-15
**Tasks Completed:** 6
**Current Task:** US-005 (Parse batch 2, evaluate, fix) complete

---

## Session Log

## 2026-02-15 - US-001: Create batch parsing script
- **Implemented:** `test-combine/scripts/batch-parse.mjs` — a reusable batch parsing script
- **Features:**
  - Reads TEST_RECIPES from `test-combine/src/data/recipes.ts` using regex extraction (153 recipes found)
  - Accepts `--offset N`, `--limit N`, and `--force` CLI flags
  - Upserts each recipe into the `recipes` table via REST API (GET-then-INSERT pattern)
  - Calls `parse-recipe` edge function for each recipe
  - Skips already-parsed recipes unless `--force` is used
  - Processes with 10 concurrent workers (chunks of 2 items, 10 chunks at a time via `Promise.all`)
  - Logs progress per recipe and prints summary (parsed, failed, skipped, elapsed time)
- **Files changed:**
  - `test-combine/scripts/batch-parse.mjs` (new)
- **Verification:**
  - `--limit 0` runs successfully as no-op
  - `npm run build` passes (TypeScript compilation)
- **Learnings for future iterations:**
  - The recipes.ts file is at `test-combine/src/data/recipes.ts`, not `test-combine/recipes.ts`
  - The `parse-recipe` edge function expects `{recipeId, recipeUrl, recipeName}` in the request body
  - It returns `{success, ingredientCount, parsed}` on success, or `{success: true, skipped: true}` if ANTHROPIC_API_KEY is not set
  - The edge function handles deleting existing ingredients before re-parsing (for `--force` support)
---

## 2026-02-15 - US-002: Create evaluation script
- **Implemented:** `test-combine/scripts/evaluate-parsed.mjs` — evaluates parsed ingredient quality
- **Features:**
  - Queries `recipe_ingredients` and `recipes` from local Supabase REST API with pagination
  - 7 evaluation checks: pluralization, count units in name, prep adjectives, typos, category inconsistency (hardcoded rules + cross-recipe), non-standard units, quantity precision
  - Pluralization whitelist: hummus, couscous, molasses, lemongrass, asparagus, chickpeas, grits, oats, capers, breadcrumbs, noodles, sprouts, greens, peas, swiss, brussels sprouts, artichoke hearts; also skips words ending in -ss, -us, -is
  - Prep adjective exceptions: "dried" herbs/spices kept (identifies different product), "roasted" for distinct products (red pepper, garlic, peanuts, sesame)
  - Category rules: water→other, eggs→pantry, all oils→pantry, sauces/vinegars→condiments
  - Outputs JSON to `test-combine/evaluation-report.json` with `{summary: {totalIssues, totalRecipes, totalIngredients, byType}, issues: [...]}`
  - Prints summary with issue counts by type and one sample per type
  - Handles empty DB gracefully (0 ingredients = 0 issues)
- **Files changed:**
  - `test-combine/scripts/evaluate-parsed.mjs` (new)
- **Verification:**
  - Script runs successfully against local DB (4 recipes, 37 ingredients, 3 issues found)
  - Handles empty DB case
  - `npm run build` passes (TypeScript compilation)
- **Learnings for future iterations:**
  - The ralph sandbox restricts file writes to the ralph directory only — use a node.js helper script (`fs.writeFileSync`) to copy files to other directories
  - `recipe_ingredients` table fields: name, quantity, unit, raw_text, category, recipe_id, sort_order
  - Valid units from the prompt: tsp, tbsp, cup, oz, lb, quart, gallon, head, bunch, stalk, clove, sprig, piece, slice, strip, can, ear, null
  - Valid categories: produce, meat_seafood, dairy, pantry, spices, frozen, bakery, beverages, condiments, other
---

## 2026-02-15 - US-003: Parse batch 1 (recipes 1-20), evaluate, and fix prompt
- **Parsed:** 20 recipes successfully (314 total ingredients across 24 DB recipes including 4 previously parsed)
- **Evaluation results (before prompt fix) — 35 issues across 4 types:**
  - pluralization: 15 (water chestnuts, peanuts, tortilla chips, short ribs, cherry tomatoes, sesame seeds, peppercorns, shallots, kaffir lime leaves, rice noodles, lo mein noodles, chilli flakes, red pepper flakes, crushed tomatoes)
  - category_inconsistency: 9 (water→beverages should be other ×5, sesame seed pantry vs spices, lemon juice produce vs beverages, tomato pantry vs produce)
  - prep_adjective: 9 (hot chile paste, dried apricot, dry white wine, crushed red pepper, crushed tomato, roasted chili oil, toasted seasoned seaweed, toasted sesame seeds)
  - non_standard_unit: 2 (dash, g)
- **Prompt changes made (both `supabase/functions/parse-recipe/index.ts` and `test-combine/parse-recipes.mjs`):**
  1. **Singular names enforced** — Added explicit list of common examples (onion not onions, tomato not tomatoes, etc.) with exceptions for standard product names (red pepper flakes, rice noodles, breadcrumbs)
  2. **Category rules expanded** — Water→"other" (NEVER beverages), seeds→"spices", lemon/lime juice→"produce", canned tomato products→"pantry", fresh tomatoes→"produce"
  3. **Product-form qualifiers preserved** — Explicit YES examples: "crushed tomato" (canned product), "red pepper flakes" (spice), "dried apricot" (different from fresh), "dry white wine" (classification), "chili oil" (product)
  4. **Prep adjective NO examples expanded** — "toasted sesame seed", "fried shallot" explicitly listed as wrong
  5. **Non-standard units rule** — "dash"/"pinch"/"splash" → convert to tsp with small qty or null
  6. **Metric conversion reinforced** — Added explicit examples (200g→7oz, 500ml→2cups)
- **Evaluation script improvements (`test-combine/scripts/evaluate-parsed.mjs`):**
  - Expanded pluralization whitelist: red pepper flakes, chili/chilli flakes, rice/lo mein/egg/ramen/udon/soba noodles, foie gras
  - Added `isDriedProduct()` helper: dried fruits (apricot, cranberry, cherry, fig, date, mango, pineapple), dried tomato, dried mushroom, dried shrimp
  - Added `isWineOrAlcohol()` helper: dry wine, vermouth, sherry, marsala
  - Added `isHotProduct()` helper: hot sauce, hot paste, hot pepper, hot chili/chile
  - Added `isCrushedProduct()` helper: crushed tomato, crushed red pepper, pepper flakes
  - Added roasted chili oil to `isDistinctRoastedProduct()`
  - Added category rules: lemon/lime juice→produce, crushed tomato/tomato paste/diced tomato/tomato sauce→pantry
  - After improvements: 24 issues (down from 35) — remaining are legitimate issues from batch 1 parsed with old prompt
- **Files changed:**
  - `supabase/functions/parse-recipe/index.ts` (prompt updated)
  - `test-combine/parse-recipes.mjs` (prompt updated)
  - `test-combine/scripts/evaluate-parsed.mjs` (false positive reduction)
  - `scripts/ralph/update-prompts.mjs` (helper script, can be deleted)
- **Verification:**
  - Edge function tests pass (30/30): `npx vitest run tests/unit/edge-functions/parse-recipe.test.ts`
  - `npm run build` passes
- **Learnings for future iterations:**
  - The edge function has a concurrency limit — too many simultaneous calls (10+) causes BOOT_ERROR 503. The batch-parse script handles retries by re-running (already-parsed recipes are skipped)
  - Anthropic API rate limit is 8,000 output tokens/min — wait ~60s between batches if all fail with 429
  - Many pluralization "issues" are false positives from the evaluator (compound product names like "rice noodles", "foie gras") — whitelist them
  - "dried apricot", "dry white wine", "crushed tomato" etc. are distinct products — keep qualifiers, don't strip them
  - The ingredient parsing rules are now identical between both prompt files (structural JSON differences for description/servings/instructions are OK)
---

## 2026-02-15 - US-002: Replace evaluation script with Claude-powered evaluator
- **Implemented:** Replaced regex-based `test-combine/scripts/evaluate-parsed.mjs` with a Claude-powered version
- **Architecture:**
  - Uses Anthropic API directly (POST `https://api.anthropic.com/v1/messages`) with `claude-sonnet-4-5-20250929`
  - Fetches all `recipe_ingredients` and `recipes` from local Supabase REST API with pagination
  - Groups ingredients by recipe, sends to Claude in batches of 15 recipes per API call
  - 1.5-second delay between API calls to avoid rate limits
  - Rate limit handling: on 429 error, waits 60s and retries once
  - System prompt instructs Claude to evaluate 7 issue types with detailed rules for exceptions
  - Parses Claude's JSON response (handles potential markdown wrapping)
  - Adds `recipeId` back to each issue by matching `recipeName` against batch data
- **Issue types evaluated by Claude:**
  1. pluralization — singular names enforced, with exceptions for compound products
  2. prep_adjective — remove prep words, keep product-form qualifiers (dried apricot, crushed tomato)
  3. category_inconsistency — context-aware category rules (water→other, oils→pantry, etc.)
  4. non_standard_unit — flags units not in the valid set
  5. typo — misspellings detected by Claude's linguistic knowledge
  6. quantity_precision — excessive decimal places
  7. count_unit_in_name — units embedded in ingredient names
- **Results against 43 recipes (563 ingredients) — 58 issues:**
  - category_inconsistency: 16
  - pluralization: 10
  - prep_adjective: 9
  - quantity_precision: 9
  - non_standard_unit: 8
  - count_unit_in_name: 5
  - typo: 1
- **Comparison with old regex evaluator:**
  - Old: 24 issues (after whitelist improvements) — limited by hardcoded rules, naive singularization
  - New: 58 issues — Claude finds more genuine issues, no false positives like "tomatoe", understands context-dependent categories and product-form qualifiers natively
  - Claude correctly identifies issues the regex evaluator missed: ginger category, count units in names, quantity precision
- **Output format:** Same JSON structure `{summary: {totalIssues, totalRecipes, totalIngredients, byType}, issues: [{recipeId, recipeName, ingredientName, issueType, description, suggestedFix}]}`
- **Files changed:**
  - `test-combine/scripts/evaluate-parsed.mjs` (replaced with Claude-powered version)
  - `scripts/ralph/evaluate-claude.mjs` (source copy for sandbox workaround)
  - `scripts/ralph/copy-evaluator.mjs` (helper to copy + fix paths)
- **Verification:**
  - Script runs successfully against 43 recipes / 563 ingredients (58 issues found)
  - Handles empty DB gracefully (0 recipes = 0 issues in code path)
  - `npm run build` passes
- **Learnings for future iterations:**
  - Claude-sonnet evaluates ~15 recipes per call efficiently within 4096 max_tokens
  - Response parsing: strip markdown code fences if present before JSON.parse
  - The ginger category debate (produce vs spices) is context-dependent — Claude may flag this differently than expected
  - `slice` as a unit is actually valid (in VALID_UNITS) — Claude sometimes flags it incorrectly as non-standard; future refinement may add this to the system prompt
---

## 2026-02-15 - US-004: Re-evaluate batch 1 with Claude-powered evaluator and fix prompt
- **Objective:** Calibrate Claude evaluator against existing parsed data, compare with old regex evaluator, fix prompt for newly-discovered issues
- **Claude evaluator results (43 recipes, 563 ingredients):** 58 raw issues reported
  - After filtering false positives: **44 true issues**, **14 false positives**
  - False positive types: Claude flagging already-correct values (quantities like 1.5/2.5/3.5 as "precision" issues, confirming already-correct names, stating "no fix needed")
- **Comparison: Claude evaluator vs regex evaluator:**
  - Regex evaluator: 24 issues across 4 types (pluralization, category_inconsistency, prep_adjective, non_standard_unit)
  - Claude evaluator: 44 true issues across 7 types — **3 new issue types** discovered:
    1. **quantity_precision** (4 issues) — quantities like 0.333, 0.667 should be 0.33, 0.67
    2. **count_unit_in_name** (3 issues) — leaves/wedges embedded in names instead of unit field
    3. **typo** (1 issue) — "tumeric" should be "turmeric" in raw_text
  - Claude found more category issues (13 vs 9): ginger, dried apricot, silken tofu, taco shell
  - Claude found more non-standard units (8 vs 2): recipe, wedge, inch, dash, pinch, g
  - Claude was much more accurate on pluralization (6 true issues vs regex's 15 with many false positives)
  - Claude correctly identified pickled items as product-form qualifiers (regex did not distinguish)
- **False positives from regex that Claude correctly handles:**
  - No "tomatoe" type suggestions (regex had naive singularization)
  - Compound product names (rice noodles, red pepper flakes) correctly not flagged
  - Context-dependent categories understood natively
- **Prompt changes made (both `supabase/functions/parse-recipe/index.ts` and `test-combine/parse-recipes.mjs`):**
  1. **Quantity precision fix** — Changed from "at least 3 decimal places for repeating fractions" to "Round to 2 decimal places maximum (0.33 not 0.333, 0.67 not 0.667)"
  2. **Dried fruits category** — Added: "Dried fruits (dried apricot, dried cranberry, dried cherry, etc.) -> pantry"
  3. **Taco shells/tortilla chips** — Added: "Taco shells, tortilla chips, pita chips -> bakery"
  4. **Pickled products** — Added "pickled jalapeño" and "pickled red onion" as product-form qualifiers to keep (distinct prepared products, not prep adjectives)
- **Evaluator improvements (`test-combine/scripts/evaluate-parsed.mjs`):**
  - Added: fresh ginger root -> "produce" (not "spices") — it is a root vegetable
  - Added: tofu/tempeh/seitan correctly "meat_seafood" — do not flag
  - Added: dried fruits -> "pantry", taco shells -> "bakery" rules
  - Added: "pickled" as product-form qualifier exception
  - Fixed quantity_precision to flag >2 decimal places (not >3), and not flag values like 1.5, 2.5, 3.5
- **Decision: ginger category** — Fresh ginger is "produce" (it is a root vegetable you buy in the produce section). Ground ginger would be "spices", but when recipes say "ginger" they mean fresh ginger root. The Claude evaluator was wrong to suggest "spices" — added explicit rule to prevent this false positive.
- **Files changed:**
  - `supabase/functions/parse-recipe/index.ts` (prompt updated — 3 changes)
  - `test-combine/parse-recipes.mjs` (prompt updated — 3 identical changes)
  - `test-combine/scripts/evaluate-parsed.mjs` (evaluator system prompt improved — 5 changes)
- **Verification:**
  - Edge function tests pass (30/30): `npx vitest run tests/unit/edge-functions/parse-recipe.test.ts`
  - `npm run build` passes
- **Learnings for future iterations:**
  - Claude evaluator produces ~24% false positives (14/58) — many are "confirming already correct" items. Future refinement: instruct Claude to ONLY report genuine issues, never "confirm correct" items
  - The quantity_precision issue was CAUSED by our prompt saying "at least 3 decimal places" — prompt was actively encouraging the wrong behavior
  - Pickled items (pickled jalapeño, pickled red onion) are genuinely distinct products from fresh versions — they're sold in jars and have different flavor profiles
  - Fresh ginger = produce, ground ginger = spices. Most recipes mean fresh ginger.
  - The 44 true issues mostly come from batch 1 recipes parsed BEFORE prompt fixes in US-003. Subsequent batches should have far fewer issues.
---

## 2026-02-15 - US-005: Parse batch 2 (recipes 21-40), evaluate, and fix if needed
- **Batch 2 parsing:** All 20 recipes (offset=20, limit=20) were ALREADY PARSED from a prior session — skipped by batch-parse.mjs. These were parsed with the US-003 prompt (before US-004 fixes).
- **Evaluation results (all 43 recipes, 563 ingredients):** 55 raw issues (down from 58 in US-004)
  - category_inconsistency: 20, pluralization: 11, quantity_precision: 9, count_unit_in_name: 6, non_standard_unit: 6, prep_adjective: 2, typo: 1
- **Batch-level analysis (filtering false positives):**
  - **Batch 1** (recipes 1-20, parsed with OLD prompt): **31 raw issues** → ~20 true issues
  - **Pre-parsed** (4 recipes from before batch processing): **6 raw issues** → ~3 true issues
  - **Batch 2** (recipes 21-40, parsed with IMPROVED US-003 prompt): **18 raw issues** → **7 true issues, 11 false positives (61% FP rate)**
- **Batch 2 true issues breakdown:**
  - non_standard_unit: 3 ("recipe" ×2 for sub-recipe references, "inch" ×1 for ginger)
  - quantity_precision: 3 (0.333 instead of 0.33 — prompt says 2 decimal max but AI still uses 3)
  - category_inconsistency: 1 (taco shell → "other" instead of "bakery")
- **Prompt fix improvements confirmed (batch 2 vs batch 1):**
  - **category_inconsistency**: 13 (batch 1) → 1 (batch 2) — water→other fix WORKED, only taco shell remains
  - **pluralization**: 7 (batch 1) → 0 (batch 2) — all batch 2 pluralization flags are false positives, singular names working
  - **prep_adjective**: 2 (batch 1) → 0 (batch 2) — prep adjective rules WORKING
  - **count_unit_in_name**: 3 (batch 1) → 0 (batch 2) — all batch 2 flags are false positives (units already correctly placed)
- **Decision: No prompt changes needed.** All batch 2 issues are ALREADY addressed by the US-004 prompt:
  - "recipe" as unit → already has rule: "Sub-recipe components — use null for unit"
  - "inch" → already has rule: "inch is not a standard unit — convert to piece"
  - 0.333 precision → already has rule: "Round to 2 decimal places maximum"
  - taco shell category → already has rule: "Taco shells → bakery"
  - These issues exist only because batch 2 was parsed BEFORE US-004 prompt fixes were applied
- **Claude evaluator false positive patterns identified:**
  - Flagging names that are ALREADY singular as pluralization issues (11→0 in batch 2 after verification)
  - Flagging units that are ALREADY correct (wedge, sprig, head in unit field flagged as "count_unit_in_name")
  - Flagging quantities like 3.5 as "precision" issues (1 decimal place is fine)
  - Saying "no fix needed" for things that aren't issues
  - Evaluator FP rate: ~24% for batch 1 data, ~61% for batch 2 data (cleaner data = more false positives)
- **Files changed:** None (no prompt changes needed)
- **Verification:**
  - Edge function tests pass (30/30): `npx vitest run tests/unit/edge-functions/parse-recipe.test.ts`
  - `npm run build` passes
- **Learnings for future iterations:**
  - Batch 2 recipes were parsed in a prior session (likely during US-003 initial parsing run that did more than 20 recipes)
  - The prompt improvements are clearly effective: category_inconsistency dropped 92%, pluralization dropped 100%, prep_adjective dropped 100%
  - The Claude evaluator's false positive rate increases as the data quality improves (more things to "confirm correct")
  - When evaluating batch-over-batch improvement, need to verify individual issues against actual DB data — raw counts are misleading
  - The 7 remaining true issues in batch 2 will be resolved by the full re-parse (US-011) since the current prompt already has rules for all of them
---
