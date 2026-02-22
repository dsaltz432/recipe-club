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
- Grocery useEffect pattern: use a `groceryDirtyRef` (useRef) to gate re-fetching; set dirty=true when items change (add/remove/parse); reset to false at start of useEffect execution
- Edge function storage URL detection: match on path `/storage/v1/object/public/` not hostname (local dev uses 127.0.0.1, not supabase hostname)

## Current Status
**Last Updated:** 2026-02-22
**Tasks Completed:** 7
**Current Task:** US-007 complete

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

## 2026-02-22 18:40 — US-003: RecipeCard — exclude pantry items from ingredient display

### What was implemented
- Imported `DEFAULT_PANTRY_ITEMS` from `@/lib/pantry` in RecipeCard.tsx
- Added `filteredIngredients` computed from `ingredients?.filter()` that excludes pantry items (case-insensitive)
- Updated `hasIngredients` to use `filteredIngredients` instead of `ingredients`
- Updated ingredient count display and expanded list to use `filteredIngredients`
- Updated existing test that included "Salt" as an ingredient — changed to "Garlic" since Salt is now filtered
- Added 2 new tests: one verifying pantry items are excluded from count/list, one verifying section hides when all ingredients are pantry items

### Files changed
- src/components/recipes/RecipeCard.tsx (import + filtering logic)
- tests/unit/components/recipes/RecipeCard.test.tsx (updated 1 test, added 2 tests)

### Quality checks
- Build: pass
- Tests: pass (67/67 RecipeCard tests, all suites passing)
- Lint: pass (0 errors, 17 warnings — pre-existing)
- Coverage: 100% on all required directories

### Learnings for future iterations
- When filtering ingredients, use `filteredIngredients` everywhere the original `ingredients` was referenced — count, expanded list, and category filtering all need updating
- The filter is case-insensitive via `.toLowerCase()` to handle both "Salt" and "salt" variants
- When tests reference ingredients by name that become pantry items (like "Salt"), update the test data to use non-pantry names

---

## 2026-02-22 19:00 — US-004: Remove Add Recipe button from Recipes tab

### What was implemented
- Removed the "Add Recipe" button from the personal sub-tab in RecipeHub.tsx
- Removed `showAddPersonal` state variable (dead code after button removal)
- Removed `AddPersonalRecipeDialog` import and JSX (dead code after button removal)
- Removed `Plus` from lucide-react import (dead code)
- Updated empty state message from "Add one using the button above!" to "Add recipes from events or meal plans."
- Removed 4 tests: "shows Add Recipe button in personal tab", "does not show Add Recipe button without userId", "opens add personal recipe dialog", "triggers onRecipeAdded callback"
- Updated 4 test assertions referencing old empty state text

### Files changed
- src/components/recipes/RecipeHub.tsx (removed button, state, dialog, imports)
- tests/unit/components/recipes/RecipeHub.test.tsx (removed 4 tests, updated 4 assertions)

### Quality checks
- Build: pass
- Tests: pass (RecipeHub 100% coverage, all suites passing)
- Lint: pass (0 errors, 17 warnings — pre-existing)
- Coverage: 100% on all required directories

### Learnings for future iterations
- When removing a UI element, trace all related state variables, imports, and JSX to find dead code — `showAddPersonal`, `AddPersonalRecipeDialog`, `Plus` all became dead
- Empty state messages that reference removed UI ("button above") must be updated
- `replace_all` in the Edit tool is effective for updating repeated test patterns

---

## 2026-02-22 19:15 — US-005: Block deletion of club event recipes from Recipes tab

### What was implemented
- Changed `onDelete` prop passed to RecipeCard in RecipeHub.tsx from always passing `handleDeleteRecipe` to conditionally passing `undefined` for club event recipes: `onDelete={recipe.eventId && !recipe.isPersonal ? undefined : handleDeleteRecipe}`
- Club event recipes (have eventId, isPersonal=false) no longer show a delete button
- Personal recipes (no eventId, or personal event type) still show the delete button
- No changes needed to RecipeCard.tsx — it already handles `onDelete={undefined}` correctly by hiding the delete button

### Files changed
- src/components/recipes/RecipeHub.tsx (line 731 — conditional onDelete prop)
- tests/unit/components/recipes/RecipeHub.test.tsx (updated 3 tests: "shows delete but not edit button on club tab" → "does not show edit or delete buttons on club event recipe cards", removed "deletes club recipe from club tab when not linked to meal plan" and "shows guard dialog when club recipe is linked to a meal plan", replaced with "does not show delete button on club event recipes")

### Quality checks
- Build: pass
- Tests: pass (109/109 RecipeHub tests, 67/67 RecipeCard tests, 1633 total)
- Lint: pass (0 errors, 17 warnings — pre-existing)
- Coverage: 100% on all required directories

### Learnings for future iterations
- `recipe.isPersonal` distinguishes personal meal recipes (which have eventId from personal events) from club event recipes — checking just `recipe.eventId` would break personal meal recipe deletion
- Option A approach (pass `undefined` for onDelete) is cleaner than adding guard logic in the handler — the delete button simply doesn't render
- RecipeCard didn't need changes — the conditional was entirely in RecipeHub's mapping over recipes

---

## 2026-02-22 19:30 — US-006: Fix recipe image upload URL — use production Supabase URL in parse-recipe

### What was implemented
- Updated `isStorageUrl` detection in parse-recipe edge function to also match URLs containing `/storage/v1/object/public/` path pattern (not just URLs with "supabase" in hostname)
- Local dev URLs like `http://127.0.0.1:54321/storage/v1/object/public/recipe-images/...` now correctly route through the Supabase storage client (`supabase.storage.from(bucket).download(filePath)`) instead of attempting a raw `fetch()` to localhost
- Production URLs continue to work unchanged (they match both the original and new conditions)

### Files changed
- supabase/functions/parse-recipe/index.ts (line 154-157 — expanded isStorageUrl detection)

### Quality checks
- Build: pass
- Tests: pass (1633/1633, all suites passing)
- Lint: pass (0 errors, 17 warnings — pre-existing)
- Coverage: not affected (edge functions not in required coverage directories)

### Learnings for future iterations
- Local dev Supabase URLs use `127.0.0.1:54321` or `localhost:54321` — they do NOT contain "supabase" in the hostname, so hostname-based detection misses them
- The Supabase storage path pattern `/storage/v1/object/public/` is the same across local and production — matching on path is more reliable than matching on hostname
- Edge functions run in Docker where localhost refers to the container itself, not the host machine — always use Supabase client (which uses SUPABASE_URL env var) for storage access

---

## 2026-02-22 19:00 — US-007: Grocery combining — only re-combine when recipes change, not on tab visit

### What was implemented
- Added `groceryDirtyRef` (useRef<boolean>) initialized to `true` — gates the Groceries tab useEffect so it only loads grocery data + runs smart combine when the flag is set
- The useEffect at line 300 now checks `groceryDirtyRef.current` before proceeding; if false, it returns early (no data fetching, no combining)
- `groceryDirtyRef.current` is set to `true` in 5 places:
  1. `loadPlan` → when existing plan items are loaded (covers week navigation)
  2. `loadPlan` → when a new plan is created (covers first load)
  3. `addItemToPlan` → when a meal is successfully added
  4. `doParse` → after parse completes successfully
  5. `handleParseRecipe` → after parse-from-grocery-tab completes
- The flag is reset to `false` at the start of the useEffect execution, ensuring only one load per dirty cycle
- Removed unnecessary `eslint-disable-next-line` directive that was no longer needed

### Files changed
- src/components/mealplan/MealPlanPage.tsx (added groceryDirtyRef, gated useEffect, set dirty in 5 locations, removed eslint-disable)
- tests/unit/components/mealplan/MealPlanPage.test.tsx (added 1 new test for runSmartCombine skip after non-URL meal, enhanced "skips re-combine" test to verify loadGroceryData is NOT called on second tab visit)

### Quality checks
- Build: pass
- Tests: pass (54/54 MealPlanPage tests, 1634 total)
- Lint: pass (0 errors, 17 warnings — pre-existing, down from 18 after removing unused eslint-disable)
- Coverage: 100% on all required directories

### Learnings for future iterations
- Using `useRef` instead of `useState` for the dirty flag avoids extra re-renders — the flag only needs to be read inside the useEffect, not trigger rendering
- The `loadGroceryData` callback depends on `items` state (via closure), making its reference unstable — adding it to a useEffect dependency array causes the effect to re-fire on every items change. The dirty ref pattern breaks this cycle
- When adding a dirty flag, trace ALL paths that modify the underlying data (add, remove, parse, week change, initial load) to ensure they all set dirty=true
- The `lastCombinedRecipeIds` ref in `runSmartCombine` provides a second layer of protection — even if the dirty flag triggers a reload, if the parsed recipe IDs haven't changed, the AI combine call is skipped

---
