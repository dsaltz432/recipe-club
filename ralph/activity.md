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
**Tasks Completed:** 1
**Current Task:** US-001 complete

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
