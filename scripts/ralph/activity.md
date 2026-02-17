# Combine-Ingredients Audit - Activity Log

## Codebase Patterns
<!-- Reusable patterns discovered during implementation go here -->

- **Supabase REST API**: http://127.0.0.1:54321/rest/v1/, auth key: REDACTED
- **Edge function URL**: http://127.0.0.1:54321/functions/v1/combine-ingredients
- **Anthropic API key**: from env ANTHROPIC_API_KEY or supabase/functions/.env
- **Existing scripts pattern**: see test-combine/scripts/batch-parse.mjs and evaluate-parsed.mjs for auth, batching, and evaluation patterns
- **DB state**: 154 recipes, 1898 ingredients (148 with ingredients, 6 empty)
- **Edge function input**: `{preCombined: [{name, quantity (string|null), unit (string|null), category, sourceRecipes}]}`
- **Edge function output**: `{success, items: [{name, totalQuantity (number|null), unit, category, sourceRecipes}]}`
- **Deterministic grouping**: cycle through group sizes [3, 4, 5] by group index; recipes ordered by id, filtered to those with ingredients
- **Pre-combine logic**: group by `lowercase(name)||lowercase(unit)`, sum quantities, collect sourceRecipes (deduplicated)
- **Sandbox limitation**: scripts/ralph/ is the only writable dir; script writes results to both ralph/ and test-combine/ (with fallback)

## Current Status
**Last Updated:** 2026-02-16
**Tasks Completed:** 2
**Current Task:** US-002 complete

---

## Session Log

## 2026-02-16 - US-001: Create batch-combine script
- Created `scripts/ralph/batch-combine.mjs` — groups recipes into deterministic events of 3-5, pre-combines ingredients by lowercase name+unit, calls the combine-ingredients edge function, saves results to `combine-results.json`
- Features: `--offset N` and `--limit N` CLI flags, append/merge by groupIndex, progress logging, summary stats (merge ratio)
- Verified `--limit 0` no-op runs successfully
- **Files changed:** `scripts/ralph/batch-combine.mjs` (new), `scripts/ralph/activity.md` (updated)
- **Learnings for future iterations:**
  - Sandbox restricts writes to `scripts/ralph/` only — save outputs there with fallback to `test-combine/`
  - The evaluate-claude.mjs pattern (API key loading, fetch pagination, report writing) is the template for all scripts
  - Recipes ordered by `id` for deterministic grouping; 148 of 154 have ingredients
  - Pre-combine quantity is numeric string (e.g. "2.5"); edge function returns totalQuantity as number
---

## 2026-02-16 - US-002: Create Claude-powered combine evaluator
- Created `scripts/ralph/evaluate-combined.mjs` — reads combine-results.json and uses Claude (sonnet-4-5) to evaluate merge quality
- Evaluates 7 issue types: missed_merge, wrong_merge, quantity_error, unit_error, name_cleaning, category_error, source_recipes_error
- Batches 5 event groups per Claude API call (larger payloads than parse evaluation since both input+output are sent)
- Uses 8192 max_tokens (vs 4096 for parse evaluator) to handle larger combined input/output payloads
- Outputs report to `combine-evaluation-report.json` with `{summary: {totalIssues, totalGroups, byType}, issues: [...]}`
- Rate limit handling: waits 60s and retries once on 429 errors
- Handles empty/missing results file gracefully (writes empty report)
- **Files changed:** `scripts/ralph/evaluate-combined.mjs` (new), `scripts/ralph/activity.md` (updated)
- **Learnings for future iterations:**
  - The evaluate-claude.mjs script is in `scripts/ralph/` (not `test-combine/scripts/` as referenced in the PRD notes)
  - Combine evaluation requires both INPUT (preCombined) and OUTPUT (combined) in the prompt — key difference from parse evaluation
  - BATCH_SIZE=5 is appropriate for combine evaluation (vs 15 for parse) since each group's data is much larger
  - max_tokens=8192 needed since combine evaluation responses can be larger with 5 groups of input+output comparisons
---
