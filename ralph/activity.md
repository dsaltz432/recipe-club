# Recipe Club Hub — Remove Naive Combine Pipeline - Activity Log

## Codebase Patterns
- **Pre-existing lint issues**: 9 problems (1 error in IngredientFormRows.tsx re: react-refresh/only-export-components, 8 warnings in UserManagement, RecipeHub, coverage files). These are NOT introduced by our changes — confirmed by running lint on base commit.
- **Git rm**: Use `git rm` for tracked files; it removes the parent directory automatically if empty.
- **Types file**: `src/types/index.ts` contains all shared interfaces. When removing types, check for blank lines left behind.

## Current Status
**Last Updated:** 2026-02-26
**Tasks Completed:** 4
**Current Task:** US-004 complete

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
