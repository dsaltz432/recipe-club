# Recipe Club Hub - Codebase Cleanup - Activity Log

## Codebase Patterns

### SHOW_PARSE_BUTTONS removal (2026-03-08)
- `SHOW_PARSE_BUTTONS = false` was a dead feature flag in `src/lib/constants.ts`
- Removed it along with: parse button JSX block in `GroceryListSection`, `handleParseRecipe` from `useGroceryList`, `onParseRecipe` prop from `GroceryListSection`, `recipeContentMap` from `UseGroceryListReturn`, `recipes` from `UseGroceryListOptions`
- Tests that mocked the flag needed updating: `GroceryListSection.test.tsx`, `MealPlanPage.test.tsx`, `useGroceryList.test.ts`
- `onParseRecipe` still exists in `RecipeCard.tsx` + `RecipeHub.tsx` — those are LIVE features, not dead

### Test infrastructure
- `tests/utils.tsx` — shared mock factories and providers
- TypeScript build (`npm run build`) only type-checks `src/` not `tests/`
- Vitest does NOT type-check tests — extra/wrong props passed to components won't fail test runs

## Current Status
**Last Updated:** 2026-03-08
**Tasks Completed:** 3
**Current Task:** US-003 complete

### Test field name drift pattern
- When production code renames a field (e.g., `aiModelParse`+`aiModelCombine` → `aiModel`), tests that assert on exact object shapes break with field-name mismatches
- Also: when a component imports a new export from a mocked module (e.g., `getCachedAiModel`), every test in that file fails with "No X export is defined on the mock"
- Fix: add the missing export to the `vi.mock()` factory

### Dev mode affects module-level constants in tests
- `isDevMode()` is called at module load time in some files (e.g., `DEFAULT_AI_MODEL` in `userPreferences.ts`)
- Test env has `VITE_DEV_MODE=true`, so defaults differ from production
- Fix: add `vi.mock("@/lib/devMode", () => ({ isDevMode: () => false }))` when testing production defaults

---

## Session Log

## 2026-03-08 — US-001: Remove all unused code, variables, functions, and flows

### What was implemented
- Removed dead feature flag `SHOW_PARSE_BUTTONS = false` from `src/lib/constants.ts`
- Removed all code gated behind the always-false flag in `GroceryListSection.tsx`: parse button JSX block, `handleParse` function, `parsingRecipeId` state, `onParseRecipe` prop, `recipeContentMap` prop, `recipesWithUrl` variable, `SHOW_PARSE_BUTTONS` import, `RecipeContent` import
- Removed `handleParseRecipe` from `useGroceryList.ts`: function, interface return type, return object
- Removed `recipes` from `UseGroceryListOptions` interface (was only used by `handleParseRecipe`)
- Removed `recipeContentMap` from `UseGroceryListReturn` (no longer consumed by any caller)
- Updated callers to not pass removed props: `MealPlanPage.tsx`, `EventDetailPage.tsx`, `PersonalMealDetailPage.tsx`
- Updated tests: removed SHOW_PARSE_BUTTONS mocks and all parse button test cases

### Files changed
- `src/lib/constants.ts`
- `src/components/recipes/GroceryListSection.tsx`
- `src/hooks/useGroceryList.ts`
- `src/components/mealplan/MealPlanPage.tsx`
- `src/pages/EventDetailPage.tsx`
- `src/pages/PersonalMealDetailPage.tsx`
- `tests/unit/components/recipes/GroceryListSection.test.tsx`
- `tests/unit/components/mealplan/MealPlanPage.test.tsx`
- `tests/unit/hooks/useGroceryList.test.ts`

### Quality checks
- Build: pass
- Lint: pass
- Typecheck: pass

### Learnings for future iterations
- `onParseRecipe` in RecipeCard.tsx + RecipeHub.tsx is a SEPARATE live feature — don't confuse with the removed GroceryListSection parse buttons
- Removing a prop cascades: prop → callers → state → functions → dependent state
- TypeScript build only checks `src/` — test files can have TS errors without failing build

---

## 2026-03-08 — US-003: Fix userPreferences and Settings tests

### What was implemented
- Updated `userPreferences.test.ts` to use single `aiModel` field (replacing `aiModelParse`/`aiModelCombine`)
- Added `vi.mock("@/lib/devMode", () => ({ isDevMode: () => false }))` to get production defaults in tests
- Updated `saveUserPreferences` test expectation: `aiModel` maps to both `ai_model_parse` and `ai_model_combine` in DB upsert
- Added `getCachedAiModel: vi.fn().mockReturnValue("claude-sonnet-4-6")` to Settings test userPreferences mock
- Added `isMemberOrAdmin` to Settings test auth mock (was missing, would crash on call)
- Updated `defaultPrefs` in Settings test to use `aiModel` instead of `aiModelParse`/`aiModelCombine`
- Updated Settings save expectation to use `aiModel`
- Updated "shows AI Models section for admin users" test: checks for "AI Model" label instead of old "Recipe Parsing"/"Grocery Processing" labels
- Updated "renders back to dashboard button" test: button label is "Back" not "Back to dashboard"

### Files changed
- `tests/unit/lib/userPreferences.test.ts`
- `tests/unit/pages/Settings.test.tsx`

### Quality checks
- Build: pass
- Tests: pass (userPreferences: 8/8, Settings: 20/20)
- Lint: N/A

### Learnings for future iterations
- Test env has `VITE_DEV_MODE=true`, causing `isDevMode()` to return true at module load; mock devMode when testing production defaults
- Missing exports in `vi.mock()` factory cause ALL tests in that file to crash (not just the tests that use the export)
- AppHeader back button label from Settings.tsx is "Back" (short), not "Back to dashboard"

---

## 2026-03-08 — US-002: Fix shared test mock infrastructure

### What was implemented
- `createMockQueryBuilder` in `tests/mocks/supabase.ts` already had `limit()` — no change needed
- Added `rpc: vi.fn().mockResolvedValue({ data: [], error: null })` to `createMockSupabase` in `tests/mocks/supabase.ts`
- Added `rpc` to inline supabase mock in `HomeSection.test.tsx`
- Exported `invalidatePantryCache` from `src/lib/pantry.ts` (was private) to allow test reset
- Updated `pantry.test.ts` `beforeEach` to call `invalidatePantryCache()` — fixes module-level cache pollution between tests

### Files changed
- `tests/mocks/supabase.ts`
- `tests/unit/components/home/HomeSection.test.tsx`
- `src/lib/pantry.ts`
- `tests/unit/lib/pantry.test.ts`

### Quality checks
- Build: pass
- Tests: pass (pantry: 9/9, HomeSection: 14/14)
- Lint: N/A

### Learnings for future iterations
- PRD notes said pantry fails due to missing `limit()` — actual root cause was module-level cache (`pantryCache`) persisting between test cases
- Always check for module-level state in lib files when tests share a module; `vi.clearAllMocks()` doesn't reset module state
- Fix: export cache-clear function from production code and call in `beforeEach`

---
