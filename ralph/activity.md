# Recipe Club Hub — Remove Naive Combine Pipeline - Activity Log

## Codebase Patterns
- **Pre-existing lint issues**: 9 problems (1 error in IngredientFormRows.tsx re: react-refresh/only-export-components, 8 warnings in UserManagement, RecipeHub, coverage files). These are NOT introduced by our changes — confirmed by running lint on base commit.
- **Git rm**: Use `git rm` for tracked files; it removes the parent directory automatically if empty.
- **Types file**: `src/types/index.ts` contains all shared interfaces. When removing types, check for blank lines left behind.
- **SmartCombineResult flow**: `smartCombineIngredients()` returns `{ items, perRecipeItems }`. Callers (EventDetailPage, MealPlanPage) pass `result.perRecipeItems` to `saveGroceryCache()`. Cache stores as `per_recipe_items` column (via cast, not in generated Supabase types).

## Current Status
**Last Updated:** 2026-02-26
**Tasks Completed:** 7
**Current Task:** US-007 complete

---

## Session Log

## 2026-02-26 07:34 — US-001: Remove cook mode feature entirely

### What was implemented
- Deleted `src/lib/cookMode.ts` (cook mode utilities)
- Deleted `src/components/recipes/CookModeSection.tsx` (cook mode UI component)
- Deleted `tests/unit/lib/cookMode.test.ts` (cook mode unit tests)
- Deleted `tests/unit/components/recipes/CookModeSection.test.tsx` (cook mode component tests)
- Deleted `supabase/functions/generate-cook-plan/index.ts` (edge function)
- Deleted `tests/unit/edge-functions/generate-cook-plan.test.ts` (edge function tests)
- Removed `CookingStep` and `CombinedCookPlan` interfaces from `src/types/index.ts`
- Removed commented-out cook mode import, TabsTrigger, and TabsContent from `src/pages/EventDetailPage.tsx`
- Removed commented-out `Flame` icon import from EventDetailPage

### Files changed
- `src/lib/cookMode.ts` (deleted)
- `src/components/recipes/CookModeSection.tsx` (deleted)
- `tests/unit/lib/cookMode.test.ts` (deleted)
- `tests/unit/components/recipes/CookModeSection.test.tsx` (deleted)
- `supabase/functions/generate-cook-plan/index.ts` (deleted)
- `tests/unit/edge-functions/generate-cook-plan.test.ts` (deleted)
- `src/types/index.ts` (removed CookingStep, CombinedCookPlan interfaces)
- `src/pages/EventDetailPage.tsx` (removed commented-out cook mode blocks)

### Quality checks
- Build: pass
- Tests: pass (1698 tests, 55 test files, 100% on required directories)
- Lint: pass (pre-existing issues only, 0 new issues)

### Learnings for future iterations
- Cook mode was fully isolated — no runtime dependencies outside its own files
- The commented-out code in EventDetailPage included both import (line 69) and two JSX blocks (TabsTrigger and TabsContent)
- Also had a commented-out Flame icon import that needed cleanup

---

## 2026-02-26 07:42 — US-002: Remove CombinedGroceryItem type and update all consumers

### What was implemented
- Removed `CombinedGroceryItem` interface from `src/types/index.ts`
- Updated `GroceryItemRow.tsx` props from `CombinedGroceryItem | SmartGroceryItem` to `SmartGroceryItem`
- Updated `GroceryCategoryGroup.tsx` props and `getItemKey` helper to use `SmartGroceryItem` only
- Updated `GroceryExportMenu.tsx` props to use `SmartGroceryItem` only
- Updated `formatGroceryItem()` in `groceryList.ts` to accept `SmartGroceryItem` only, simplified displayName logic
- Updated `generateCSV()` and `generatePlainText()` to use `SmartGroceryItem` only
- Updated `filterPantryItems()` return type to `SmartGroceryItem[]`
- Updated `combineIngredients()` return type to `SmartGroceryItem[]` and added `displayName: name` to all result push calls (function will be deleted in US-003)
- Updated all test files: `GroceryItemRow.test.tsx`, `GroceryCategoryGroup.test.tsx`, `GroceryExportMenu.test.tsx`, `groceryList.test.ts` — replaced all `CombinedGroceryItem` fixtures with `SmartGroceryItem` (including `displayName` field)
- Replaced the CombinedGroceryItem-specific test ("uses name as-is for CombinedGroceryItem") with a test for empty displayName fallback

### Files changed
- `src/types/index.ts` (removed CombinedGroceryItem interface)
- `src/components/recipes/GroceryItemRow.tsx` (import and prop type)
- `src/components/recipes/GroceryCategoryGroup.tsx` (import, prop type, helper type)
- `src/components/recipes/GroceryExportMenu.tsx` (import and prop type)
- `src/lib/groceryList.ts` (import, formatGroceryItem, generateCSV, generatePlainText, filterPantryItems, combineIngredients return type)
- `tests/unit/components/recipes/GroceryItemRow.test.tsx` (all fixtures)
- `tests/unit/components/recipes/GroceryCategoryGroup.test.tsx` (all fixtures)
- `tests/unit/components/recipes/GroceryExportMenu.test.tsx` (all fixtures)
- `tests/unit/lib/groceryList.test.ts` (import and all CombinedGroceryItem fixtures)

### Quality checks
- Build: pass
- Tests: pass (1698 tests, 55 test files, 100% on required directories)
- Lint: pass (pre-existing issues only, 0 new issues)

### Learnings for future iterations
- `combineIngredients()` now returns `SmartGroceryItem[]` with `displayName: name` — this is a temporary bridge until US-003 deletes the function entirely
- `groceryEdits.ts` has functions named `loadCombinedGroceryItems`/`saveCombinedGroceryItems` — these are function names (not using the deleted type) and don't need renaming
- The `groupByCategory` function uses a generic `<T extends { category: GroceryCategory }>` so it doesn't reference CombinedGroceryItem at all
- Test fixtures in groceryList.test.ts that were typed as `CombinedGroceryItem` (no displayName) still pass at runtime because Vitest doesn't enforce TS types — but they were updated for correctness

---

## 2026-02-26 08:15 — US-003: Delete naive combine pipeline from groceryList.ts

### What was implemented
- Deleted ~440 lines from `src/lib/groceryList.ts`: all naive combine pipeline code
- Deleted constants: `UNIT_MAP`, `NO_STRIP_S`, `ALWAYS_PLURAL`, `COOKING_ADJECTIVES`, `PRESERVED_COMPOUNDS`, `INGREDIENT_ALIASES`, `UNIT_REMAP`, `PREFERRED_COUNT_UNIT`, `BULK_CONVERSIONS`, `COUNT_TO_CUP`, `COUNT_TO_LB`, `FLUID_OZ_INGREDIENTS`, `SLICE_TO_COUNT`, `CAN_TO_CUP`, `VOLUME_IN_TSP`, `WEIGHT_IN_OZ`, `DENSITY_OZ_PER_CUP`, `METRIC_UNITS`
- Deleted functions: `normalizeIngredientName()`, `normalizeUnit()`, `getConversionFamily()`, `convertToPreferredUnit()`, `combineIngredients()`, `filterPantryItems()`
- Simplified `detectCategory()` to use `name.toLowerCase().trim()` instead of `normalizeIngredientName()`
- Simplified `filterSmartPantryItems()` to use `.toLowerCase().trim()` instead of `normalizeIngredientName()`
- Updated `smartCombineIngredients()` to no longer call `combineIngredients()` — now maps raw ingredients directly for the AI edge function, and throws on failure instead of falling back to naive combine
- Updated `GroceryListSection.tsx`: removed imports of deleted functions (`combineIngredients`, `filterPantryItems`, `normalizeIngredientName`, `normalizeUnit`, `groupByCategory`), removed naive combine variables and fallback rendering block, removed pantry excluded items section, simplified per-recipe tab item construction to use `toLowerCase().trim()`
- Removed unused lucide-react imports (`Info`, `ChevronDown`, `ChevronUp`) and unused state (`showExcluded`, `recipeNameMap`) from GroceryListSection

### Files changed
- `src/lib/groceryList.ts` (deleted ~440 lines of naive combine pipeline, simplified detectCategory and filterSmartPantryItems, updated smartCombineIngredients)
- `src/components/recipes/GroceryListSection.tsx` (removed imports of deleted functions, removed naive fallback rendering, removed pantry excluded section, cleaned up unused state/imports)

### Quality checks
- Build: pass
- Tests: N/A (tests will break — fixed in US-006)
- Lint: pass (pre-existing issues only, 0 new issues)

### Learnings for future iterations
- `smartCombineIngredients` had a dependency on `combineIngredients` (called it internally at line 873), so removing `combineIngredients` required updating `smartCombineIngredients` in the same story
- `GroceryListSection.tsx` imported 4 deleted functions — had to be cleaned up in this story to make build pass, even though full refactor is US-004
- The naive fallback rendering block (`!smartGrouped && !combineError`) and pantry excluded items section both depended on `combineIngredients` output, so both were removed
- File went from 975 lines to ~280 lines — massive reduction
- `CATEGORY_OVERRIDES` is kept because it's used by `detectCategory()` which `IngredientFormRows` depends on

---

## 2026-02-26 08:30 — US-004: Simplify GroceryListSection to use AI results for all tabs

### What was implemented
- Replaced `displayNameMap` prop with `perRecipeItems?: Record<string, SmartGroceryItem[]>` on GroceryListSection
- Per-recipe tabs now render from `perRecipeItems[recipe.name]` instead of constructing items from raw RecipeIngredient[] + displayNameMap lookups
- Per-recipe tabs still apply pantry filtering via `filterSmartPantryItems`
- Combined tab rendering from `smartGroceryItems` is unchanged
- Error state (`combineError`) still renders error message on combined tab
- `recipeIngredients` prop still used for `hasAnyIngredients` check and `ingredientsByRecipe` (tab visibility)
- Removed `displayNameMap` state and all references from EventDetailPage.tsx and MealPlanPage.tsx (dead code since no consumer)
- Removed `displayNameMap` prop passing from both callers

### Files changed
- `src/components/recipes/GroceryListSection.tsx` (replaced displayNameMap prop with perRecipeItems, updated per-recipe tab rendering)
- `src/pages/EventDetailPage.tsx` (removed displayNameMap state, removed setDisplayNameMap calls, removed prop passing)
- `src/components/mealplan/MealPlanPage.tsx` (removed displayNameMap state, removed setDisplayNameMap calls, removed prop passing)

### Quality checks
- Build: pass
- Tests: N/A (test updates in US-006/US-008)
- Lint: pass (pre-existing issues only, 0 new issues)

### Learnings for future iterations
- Several US-004 ACs (imports removed, naive variables removed, naive fallback removed, pantry excluded section removed) were already completed in US-003 to make the build pass
- Removing the `displayNameMap` prop from GroceryListSection required also removing it from callers (EventDetailPage, MealPlanPage) to avoid TS6133 "declared but never read" build errors
- The `result.displayNameMap` references in `saveGroceryCache` calls remain for now — those are passed through to the cache function and will be updated in US-009/US-010
- Per-recipe tabs gracefully fall back to empty array when `perRecipeItems` is not provided (`perRecipeItems?.[recipe.name] ?? []`)

---

## 2026-02-26 09:00 — US-005: Update SmartCombineResult and smartCombineIngredients for unified AI response

### What was implemented
- Changed `SmartCombineResult` type from `{ items, displayNameMap }` to `{ items: SmartGroceryItem[], perRecipeItems: Record<string, SmartGroceryItem[]> }`
- Updated `smartCombineIngredients()`: removed `perRecipeNames` parameter, maps raw `RecipeIngredient[]` to `{ name, quantity, unit, category, recipeName }` format, sends as `rawIngredients` (not `preCombined`), returns `perRecipeItems` instead of `displayNameMap`
- Updated EventDetailPage.tsx: removed `perRecipeNames` collection, passes `result.perRecipeItems` to `saveGroceryCache`
- Updated MealPlanPage.tsx: same changes as EventDetailPage
- Updated `groceryCache.ts`: `GroceryCacheResult` uses `perRecipeItems` instead of `displayNameMap`, `saveGroceryCache` accepts and stores `per_recipe_items`, `loadGroceryCache` returns `perRecipeItems`

### Files changed
- `src/lib/groceryList.ts` (SmartCombineResult type, smartCombineIngredients function)
- `src/pages/EventDetailPage.tsx` (removed perRecipeNames, updated saveGroceryCache call)
- `src/components/mealplan/MealPlanPage.tsx` (removed perRecipeNames, updated saveGroceryCache call)
- `src/lib/groceryCache.ts` (GroceryCacheResult type, loadGroceryCache, saveGroceryCache — updated for perRecipeItems)

### Quality checks
- Build: pass
- Tests: N/A (test updates in US-006/US-008/US-010)
- Lint: N/A (no new lint issues expected — build passed)

### Learnings for future iterations
- Updating `SmartCombineResult` required cascading changes to `groceryCache.ts` (type, save, load) since callers pass the result through to cache — these changes were pulled forward from US-010 to keep the build passing
- The `displayNameMap` was never destructured from cache results by callers (already cleaned up in US-004), so the cache type change was safe
- No `displayNameMap` references remain in `src/` after this story

---

## 2026-02-26 10:00 — US-006: Update groceryList.ts tests for pipeline removal

### What was implemented
- Removed all `combineIngredients` tests (~2400 lines including "real recipe data" sub-describes with ~90+ test cases)
- Removed all `normalizeIngredientName` tests (~170 lines)
- Removed all `normalizeUnit` tests (~50 lines)
- Removed all `filterPantryItems` (non-smart version) tests (~60 lines)
- Removed imports of deleted functions: `normalizeUnit`, `normalizeIngredientName`, `combineIngredients`, `filterPantryItems`
- Updated `filterSmartPantryItems` tests: replaced normalization test ("Onions" matching "onion") with whitespace trimming test (simple toLowerCase matching)
- Updated `detectCategory` tests: replaced normalization test ("eggs" → "egg") with case/whitespace tests ("Olive Oil", "  egg  ", "TOFU")
- Rewrote `smartCombineIngredients` tests: changed from `preCombined`/`displayNameMap`/`perRecipeNames` to `rawIngredients`/`perRecipeItems` format; fallback tests now expect throws instead of naive combine fallback
- `formatGroceryItem`, `generateCSV`, `generatePlainText` tests already used SmartGroceryItem fixtures (done in US-002) — no changes needed

### Files changed
- `tests/unit/lib/groceryList.test.ts` (reduced from 3672 lines to ~640 lines)

### Quality checks
- Build: pass
- Tests: pass (70 tests in groceryList.test.ts, 244 total in src/lib/)
- Coverage: 100% statements/functions/lines on src/lib/ (99.63% branches — uncovered branch is `pluralizeUnit` fallback)
- Lint: N/A (no source changes)

### Learnings for future iterations
- Test file went from 3672 to ~640 lines — the combineIngredients "real recipe data" section alone was ~1600 lines
- `smartCombineIngredients` now throws on error/skipped instead of falling back to naive combine — tests updated from `expect(result.items.length).toBeGreaterThan(0)` to `rejects.toThrow()`
- `detectCategory` with simple `toLowerCase().trim()` means "eggs" ≠ "egg" — the CATEGORY_OVERRIDES map keys are all singular, so only exact lowercase matches work now
- `filterSmartPantryItems` with simple `toLowerCase().trim()` means "Onions" ≠ "onion" — pantry matching is now exact (case-insensitive, trimmed) without normalization
- Other test files (GroceryListSection.test.tsx, MealPlanPage.test.tsx) still fail — those are addressed in US-008 and US-010

---

## 2026-02-26 12:10 — US-007: Rewrite edge function for unified combined + per-recipe response

### What was implemented
- Replaced `PreCombinedInput` interface with `RawIngredientInput` (adds `recipeName` field, removes `sourceRecipes`)
- Changed request parsing from `{ preCombined, perRecipeNames }` to `{ rawIngredients }`
- Rewrote system prompt to instruct AI to produce TWO outputs: `items` (combined across all recipes) and `perRecipeItems` (combined within each recipe, keyed by recipe name)
- System prompt retains all existing rules: must-merge variants, keep-separate rules, unit conversion, displayName generation, contextual unit handling
- Added new rule: per-recipe items should combine duplicate ingredients within a single recipe
- Updated empty input response from `{ items: [], displayNameMap: {} }` to `{ items: [], perRecipeItems: {} }`
- Updated response parsing to extract `perRecipeItems` instead of `displayNameMap`
- Updated validation to use unique ingredient names from raw input (handles duplicates across recipes)
- Added displayName fallback for both `items` and `perRecipeItems` entries
- Updated response format from `{ success, items, displayNameMap }` to `{ success, items, perRecipeItems }`
- Rewrote all 12 existing tests for new input/output format
- Added 4 new tests: duplicate ingredient names across recipes, AI omitting perRecipeItems, displayName fallback for perRecipeItems, AI response items not an array

### Files changed
- `supabase/functions/combine-ingredients/index.ts` (major rewrite — new interface, new system prompt, new response format)
- `tests/unit/edge-functions/combine-ingredients.test.ts` (all tests updated for rawIngredients/perRecipeItems format, 4 new tests added)

### Quality checks
- Build: pass
- Tests: 16/16 edge function tests pass, 100% coverage (statements, branches, functions, lines)
- Lint: pass (pre-existing issues only, 0 new issues)
- Pre-existing failures: GroceryListSection.test.tsx (US-008), MealPlanPage.test.tsx (US-010) — not caused by this story

### Learnings for future iterations
- The validation logic uses `new Set()` on input names, so duplicate ingredient names across recipes (e.g., both recipes have "garlic") are deduplicated before comparison — this correctly handles the raw input format
- The `perRecipeItems` field defaults to `{}` when AI omits it, matching the same pattern used for empty rawIngredients
- Edge function went from 222 lines to ~200 lines — slightly shorter despite the expanded system prompt, because the user message construction is simpler (no conditional perRecipeNames handling)
- The model identifier `claude-sonnet-4-5-20250929` is retained from the original implementation

---
