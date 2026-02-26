# Recipe Club Hub - Activity Log

## Codebase Patterns

- **runSmartCombine two-layer guard**: Both EventDetailPage and MealPlanPage have two layers of gating for smart combine: (1) inside `runSmartCombine` itself (`parsedRecipes.length < N`), and (2) in the parse flow (`willCombine`/`shouldCombine` variables). Both layers must be updated together.
- **showCombineStep vs actual combine logic**: The `showCombineStep` state controls only the UI progress label ("Combining with other recipes"). It should remain gated on 2+ recipes for good UX. The actual `runSmartCombine` call should happen for 1+ recipes.
- **EventDetailPage location**: Lives at `src/pages/EventDetailPage.tsx`, NOT `src/components/events/`.
- **Test pattern for smart combine**: Tests mock `smartCombineIngredients` from `@/lib/groceryList` and assert on `toHaveBeenCalled()` / `toHaveBeenCalledTimes()`. Use `waitFor` when asserting async calls.

## Current Status
**Last Updated:** 2026-02-26
**Tasks Completed:** 1
**Current Task:** US-001 completed

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
