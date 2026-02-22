# Recipe Club Hub - Bug Fixes & Polish - Activity Log

## Codebase Patterns
<!-- Reusable patterns discovered during implementation go here -->
- All tests mock `@/integrations/supabase/client` — the real module never executes
- Coverage must be 100% on all files except `IngredientWheel.tsx` (~55% OK)
- Required 100% directories: events, ingredients, mealplan, recipes, lib
- `src/pages/` is NOT in required coverage directories
- Use `@tests/utils` for rendering with providers
- Mock factories: `createMockUser`, `createMockIngredient`, `createMockRecipe`, `createMockNote`, `createMockEvent`
- `vi.clearAllMocks()` does NOT clear `mockImplementationOnce` queues; use `mockReset()` instead
- Supabase mock pattern: `createMockQueryBuilder` with chainable `.mockReturnThis()`
- DEFAULT_PANTRY_ITEMS in src/lib/pantry.ts: ["salt", "pepper", "water"] (exported)
- Edge functions are Deno-based in supabase/functions/
- Grocery cache: combined_grocery_items table with context_type (meal_plan/event), context_id, recipe_ids for cache validation
- Google Calendar calls are in src/lib/googleCalendar.ts — currently client-side direct API calls

## Current Status
**Last Updated:** 2026-02-22
**Tasks Completed:** 2
**Current Task:** US-002 complete

---

## Session Log

## 2026-02-22 18:30 — US-001: Remove 'Added X to plan' toast from MealPlanPage

### What was implemented
- Removed `toast.success(`Added "${name}" to plan`)` from `addItemToPlan` in MealPlanPage.tsx (line 503)
- Updated 4 test assertions that relied on that toast as a completion signal — replaced with `mockSupabaseFrom` call checks or `waitFor` on insert mock

### Files changed
- src/components/mealplan/MealPlanPage.tsx (removed line 503)
- tests/unit/components/mealplan/MealPlanPage.test.tsx (updated 4 assertions)

### Quality checks
- Build: pass
- Tests: pass (53/53 MealPlanPage tests, 1636 total)
- Lint: pass (0 errors, 17 warnings — pre-existing)
- Coverage: 100% on all required directories

### Learnings for future iterations
- Tests often use `toast.success` as a signal for async completion — when removing a toast, need to find all tests using it as a waitFor trigger and replace with a different completion signal
- `mockSupabaseFrom` called with table name is a reliable alternative signal for "insert completed"

---

## 2026-02-22 18:35 — US-002: Capitalize pantry items in grocery exclusion message

### What was implemented
- Changed `{item.name}` to `{item.name.charAt(0).toUpperCase() + item.name.slice(1)}` in the excluded pantry items list in GroceryListSection.tsx (line 377)
- Updated test assertions to expect capitalized names ('Salt', 'Pepper' instead of 'salt', 'pepper')

### Files changed
- src/components/recipes/GroceryListSection.tsx (line 377 — capitalization transform)
- tests/unit/components/recipes/GroceryListSection.test.tsx (updated 2 tests: expand/collapse assertions)

### Quality checks
- Build: pass
- Tests: pass (41/41 GroceryListSection tests, all suites passing)
- Lint: pass (0 errors, 17 warnings — pre-existing)
- Coverage: 100% on all required directories

### Learnings for future iterations
- Simple inline string transform is sufficient for capitalization — no utility function needed
- When changing display format, search all test files for the old format string to find all assertions that need updating

---
