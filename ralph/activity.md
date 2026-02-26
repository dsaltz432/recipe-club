# Recipe Club Hub - Activity Log

## Codebase Patterns

- **runSmartCombine two-layer guard**: Both EventDetailPage and MealPlanPage have two layers of gating for smart combine: (1) inside `runSmartCombine` itself (`parsedRecipes.length < N`), and (2) in the parse flow (`willCombine`/`shouldCombine` variables). Both layers must be updated together.
- **showCombineStep vs actual combine logic**: The `showCombineStep` state controls only the UI progress label ("Combining with other recipes"). It should remain gated on 2+ recipes for good UX. The actual `runSmartCombine` call should happen for 1+ recipes.
- **EventDetailPage location**: Lives at `src/pages/EventDetailPage.tsx`, NOT `src/components/events/`.
- **Test pattern for smart combine**: Tests mock `smartCombineIngredients` from `@/lib/groceryList` and assert on `toHaveBeenCalled()` / `toHaveBeenCalledTimes()`. Use `waitFor` when asserting async calls.

## Current Status
**Last Updated:** 2026-02-26
**Tasks Completed:** 2
**Current Task:** US-002 completed

---

## Session Log

## 2026-02-26 09:29 — US-001: Fix single-recipe grocery list not displaying

### What was implemented
- Changed `runSmartCombine` guard in EventDetailPage.tsx from `parsedRecipes.length < 2` to `< 1`
- Changed `runSmartCombine` guard in MealPlanPage.tsx from `parsedRecipes.length < 2` to `< 1`
- Split `willCombine` from `showCombineStep` in EventDetailPage.tsx parse flow: `willCombine = existingParsedCount >= 0` (always combine), `setShowCombineStep(existingParsedCount >= 1)` (UI label for 2+)
- Split `shouldCombine` from `showCombineStep` in MealPlanPage.tsx parse flow: `shouldCombine = recipesWithUrls.length >= 1` (combine for 1+), `setShowCombineStep(recipesWithUrls.length >= 2)` (UI label for 2+)
- Updated MealPlanPage test "uses cached smart combine results when recipe IDs match" to expect combine IS called for 1 recipe
- Renamed and updated test "skips smart combine when fewer than 2 parsed recipes" → "runs smart combine even with a single parsed recipe"

### Files changed
- `src/pages/EventDetailPage.tsx` (lines 421, 594-599)
- `src/components/mealplan/MealPlanPage.tsx` (lines 272, 348-351)
- `tests/unit/components/mealplan/MealPlanPage.test.tsx` (lines 2571-2572, 2575, 2639-2640)

### Quality checks
- Build: pass
- Tests: pass (1513/1513 all green)
- Lint: pass (all warnings/errors pre-existing, none from changed files)

### Learnings for future iterations
- EventDetailPage is in `src/pages/`, not `src/components/events/` — the PRD notes reference line numbers that are accurate
- The two-layer guard pattern means fixing the bug requires changes in 4 locations across 2 files
- Tests that assert old buggy behavior need updating — look for `not.toHaveBeenCalled` assertions on `mockSmartCombineIngredients`

---

## 2026-02-26 09:35 — US-002: Update tests for single-recipe grocery behavior

### What was implemented
- Added new EventDetailPage test "runs smart combine on cache miss with 1 parsed recipe" — verifies smartCombineIngredients IS called with a single parsed recipe and cache is saved
- Added new MealPlanPage test "runs combine step during parse for a single URL recipe on groceries tab" — verifies the parse flow triggers smart combine even when there's only 1 recipe with a URL
- Verified existing tests from US-001 still pass: "runs smart combine even with a single parsed recipe" (MealPlanPage), "runs smart combine on cache miss with 2+ parsed recipes" (EventDetailPage)
- Note: AC3/AC4 were already completed as part of US-001 (test renamed from "skips smart combine when fewer than 2 parsed recipes" → "runs smart combine even with a single parsed recipe")

### Files changed
- `tests/unit/pages/EventDetailPage.test.tsx` (added test after line ~5072)
- `tests/unit/components/mealplan/MealPlanPage.test.tsx` (added test after line ~3649)

### Quality checks
- Build: pass
- Tests: pass (1515/1515 all green)
- Lint: pass (all warnings/errors pre-existing, none from changed files)

### Learnings for future iterations
- US-001 already covered AC3/AC4 by updating MealPlanPage tests — future PRDs should check if prior stories already satisfy downstream test ACs
- The EventDetailPage smart combine test pattern uses `mockSupabaseFrom.mockImplementation` with table-specific return values, including `recipe_content` with `status: "completed"` which is required for `parsedRecipes` filtering
- MealPlanPage parse flow tests use a delayed invoke mock (`mockInvoke.mockImplementationOnce(() => new Promise(...))`) to allow tab switching during parse

---
