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
**Tasks Completed:** 1
**Current Task:** US-001 complete

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
