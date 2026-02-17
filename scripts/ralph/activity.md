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
**Tasks Completed:** 1
**Current Task:** US-001 complete

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
