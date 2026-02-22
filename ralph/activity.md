# Recipe Club Hub - UX Polish & Tile Simplification - Activity Log

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
- DEFAULT_PANTRY_ITEMS in src/lib/pantry.ts: ["salt", "pepper", "water"]
- RecipeCard edit button gated behind `recipe.isPersonal && onEdit`. Delete button shows for ANY recipe when `onDelete` is provided (club and personal). RecipeCard also supports `onAddNote` prop for adding notes directly from the card.
- When adding new UI to RecipeHub that uses child components (e.g., PhotoUpload), mock those child components in RecipeHub tests to enable testing the branches they control (e.g., photo state)
- RecipeHub loads recipes lazily per sub-tab (club on mount, personal only when clicked)
- Removing component props cascades: child interface → parent interface → parent destructuring → parent JSX → parent tests. Build won't pass until all references are removed.
- MealPlanSlot is now display-only (no edit/cook/uncook), MealPlanGrid passes only onAddMeal + onViewMealEvent
- All 5 test files that mock `@/lib/pantry` must include `DEFAULT_PANTRY_ITEMS: ["salt", "pepper", "water"]` in the mock — PantryContent imports it for protected item logic
- Dead code in MealPlanPage (editingItem state, edit branches in handleAddCustomMeal/handleAddRecipeMeal, EventRatingDialog, uncook AlertDialog) has been removed as part of US-001
- `cooked_at` column on meal_plan_items is not in generated Supabase types — use `as Record<string, unknown>` for update payloads and row access, `select("*")` instead of named columns
- RecipeHub eagerly loads both club and personal recipe counts on mount. Club count comes from the default tab load (loadClubRecipes). Personal count is loaded via an inline async IIFE in the userId useEffect to avoid lint warnings about missing deps.
- When changing behavior that affects text content of buttons used in tests (e.g., adding counts), update test selectors from `getByText("exact text")` to `getByRole("button", { name: /regex/ })` for robustness
- `mockFunctionsInvoke` (supabase.functions.invoke mock) returns `undefined` by default after `vi.clearAllMocks()`. Any code that calls `.then()` on the result will throw. Tests that trigger code paths calling `functions.invoke().then()` MUST set `mockFunctionsInvoke.mockResolvedValue({ data: null, error: null })` first.
- RecipeHub loads `recipe_ingredients` and `recipe_content` alongside recipe metadata via `loadRecipeDetails()`. Maps are keyed by `recipe_id` and stored as `recipeIngredientsMap` and `recipeContentMap` state.
- RecipeCard accepts optional `ingredients`, `contentStatus`, and `onParseRecipe` props for inline ingredient display and parse triggers. Ingredients are grouped by CATEGORY_ORDER from groceryList.ts.
- When mocking sonner's `toast` in tests where `toast()` is called as a function (not just `.error`/`.success`), the mock must be a callable fn with `.error`/`.success` properties. Use `Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() })` inside the `vi.mock` factory.
- Supabase query chains ending with `.in()` (no `.order()`) resolve via the builder's `.then()` method — `createMockQueryBuilder`'s `then` property handles this.

## Current Status
**Last Updated:** 2026-02-22
**Tasks Completed:** 15
**Current Task:** US-015 complete

---

## Session Log

## 2026-02-22 09:30 — US-001: Simplify MealPlanSlot — remove Done, Undo, and Edit from tiles

### What was implemented
- Removed `onEditMeal`, `onMarkCooked`, `onUncook` props from MealPlanSlot interface
- Replaced clickable `<button>` wrapping meal names with plain `<div>` (display-only)
- Removed Done button and Undo button from filled tiles
- Removed `RotateCcw` from lucide-react imports (kept `Check` for cooked icon)
- Cascading cleanup in MealPlanGrid: removed same 3 props from interface, destructuring, and MealPlanSlot JSX
- Cascading cleanup in MealPlanPage: removed props from MealPlanGrid JSX, removed dead functions (handleEditMeal, handleMarkCooked, handleUncook, markSlotAsCooked, handleConfirmUncook, handleRatingComplete, handleRatingCancel), removed dead state (editingItem, ratingDialogOpen, selectedSlotForRating, uncookConfirmSlot, RatingSlotData), removed edit branches from handleAddCustomMeal/handleAddRecipeMeal, removed EventRatingDialog JSX and uncook AlertDialog, removed unused imports (EventRatingDialog, AlertDialog*, DAY_NAMES, mealTypeLabels, EventRecipeWithNotes)
- Updated MealPlanSlot.test.tsx: removed all edit/cook/uncook tests, added test verifying meal name is not a button
- Updated MealPlanGrid.test.tsx: removed onEditMeal from defaultProps, removed pass-through tests
- Updated MealPlanPage.test.tsx: removed 28 dead tests (edit flow, cooked/uncook/rating), added combine-step-during-parse coverage test

### Files changed
- src/components/mealplan/MealPlanSlot.tsx
- src/components/mealplan/MealPlanGrid.tsx
- src/components/mealplan/MealPlanPage.tsx
- tests/unit/components/mealplan/MealPlanSlot.test.tsx
- tests/unit/components/mealplan/MealPlanGrid.test.tsx
- tests/unit/components/mealplan/MealPlanPage.test.tsx

### Quality checks
- Build: pass
- Tests: pass (1576 tests, 55 files)
- Lint: pass (0 errors, 17 pre-existing warnings)
- Coverage: 100% on all required directories

### Learnings for future iterations
- Removing props from a child component cascades up through parent components and their tests. US-002 and US-003 are now partially done since MealPlanGrid and MealPlanPage cleanup was needed for typecheck to pass.
- When removing functions, follow the entire dependency chain: functions → state → imports → JSX. Each removed function may reference state that becomes unused.
- The parse combine step (lines 358-362 in MealPlanPage) requires a specific test with 2+ recipes on groceries tab.

---

## 2026-02-22 10:00 — US-002: Simplify MealPlanGrid — remove pass-through props

### What was implemented
- No code changes needed — all US-002 ACs were already satisfied by US-001's cascading cleanup
- Verified: MealPlanGrid interface only has `items`, `weekStart`, `onAddMeal`, `onViewMealEvent`
- Verified: MealPlanSlot receives only `items`, `dayOfWeek`, `mealType`, `onAddMeal`, `onViewMealEvent`
- Verified: MealPlanGrid.test.tsx has no references to onEditMeal, onMarkCooked, or onUncook

### Files changed
- (none — already clean from US-001)

### Quality checks
- Build: pass
- Tests: pass (9 MealPlanGrid tests)
- Coverage: MealPlanGrid.tsx 100% Stmts/Branch/Funcs/Lines
- Typecheck: pass

### Learnings for future iterations
- When cascading cleanup in US-001 is thorough, downstream stories may already be complete. Always verify before writing code.

---

## 2026-02-22 10:15 — US-003: Remove dead code from MealPlanPage — editing and cooked handlers

### What was implemented
- No source code changes needed — all US-003 ACs were already satisfied by US-001's cascading cleanup
- Removed unused `EventRatingDialog` mock from MealPlanPage.test.tsx (was defined but never referenced in any test)
- Verified all 13 acceptance criteria: functions removed, state removed, interface removed, edit branches removed, imports removed, JSX props removed, AlertDialog removed

### Files changed
- tests/unit/components/mealplan/MealPlanPage.test.tsx (removed unused EventRatingDialog mock)

### Quality checks
- Build: pass
- Tests: pass (1576 tests, 55 files)
- Lint: pass (0 errors, 17 pre-existing warnings)
- Coverage: MealPlanPage.tsx 100% Stmts/Branch/Funcs/Lines

### Learnings for future iterations
- When a large cascading cleanup happens in an earlier story, verify downstream stories before writing code. US-001 cleaned up MealPlanPage so thoroughly that US-002 and US-003 were both already complete.
- Unused test mocks for removed components should be cleaned up even if they don't cause test failures — they add confusion for future developers.

---

## 2026-02-22 10:30 — US-004: Clean up AddMealDialog — remove editing props and logic

### What was implemented
- Removed `editingItemName` and `editingItemUrl` from AddMealDialogProps interface and component destructuring
- Changed `resetForm` to use empty strings instead of referencing removed props
- Removed the `useEffect` that pre-filled name/url on dialog open (lines 75-80)
- Made dialog title always "Add Meal" (removed conditional for "Edit Meal")
- Made dialog description always the add text (removed conditional for Replace text)
- Made submit button always "Add to Meal" (removed conditional for "Save Changes")
- Updated AddMealDialog.test.tsx: merged "Edit Meal" title test and "Add Meal" title test into single test, removed editingItemName prop usage

### Files changed
- src/components/mealplan/AddMealDialog.tsx
- tests/unit/components/mealplan/AddMealDialog.test.tsx

### Quality checks
- Build: pass
- Tests: pass (1575 tests, 55 files)
- Lint: pass (0 errors, 17 pre-existing warnings)
- Coverage: AddMealDialog.tsx 100% Stmts/Branch/Funcs/Lines

### Learnings for future iterations
- This was a straightforward prop removal since MealPlanPage's edit branches (which passed these props) were already removed in US-001. No other callers existed.
- The `useEffect` for pre-filling was only needed for editing — safe to remove entirely since add mode always starts with empty fields.

---

## 2026-02-22 11:00 — US-005: Add Mark as Cooked / Undo Cook to PersonalMealDetailPage

### What was implemented
- Updated meal_plan_items query from `.select("recipe_id")` to `.select("*")` to get id, recipe_id, and cooked_at columns
- Added `mealItems` state array to store meal_plan_items rows, `uncookConfirmOpen` boolean state
- Derived `isCooked` from mealItems: true when all items have cooked_at set
- Added `Check` and `RotateCcw` to lucide-react imports
- Added `handleMarkCooked` function: updates cooked_at on all meal_plan_items for the event, updates local state, shows toast
- Added `handleConfirmUncook` function: sets cooked_at to null on all meal_plan_items, updates local state, shows toast
- Added cooked UI to Event Info card: green 'Cooked' badge + 'Undo' button when cooked, 'Mark as Cooked' button when not cooked and items exist
- Added AlertDialog for uncook confirmation
- Used `as Record<string, unknown>` pattern to bypass generated Supabase types for cooked_at column (same pattern as MealPlanPage uses for event_id/cooked_at)

### Files changed
- src/pages/PersonalMealDetailPage.tsx

### Quality checks
- Build: pass
- Tests: pass (1575 tests, 55 files)
- Lint: pass (0 errors, 17 pre-existing warnings)
- Coverage: 100% on all required directories (PersonalMealDetailPage is in src/pages/ — not in required 100% coverage)

### Learnings for future iterations
- The `cooked_at` column on meal_plan_items is not in the generated Supabase types. Use `as Record<string, unknown>` for update payloads and row access, and `select("*")` instead of naming columns that don't exist in types.
- PersonalMealDetailPage is in src/pages/ which does NOT require 100% coverage, so no new tests were needed for this story.
- The mealItems state is populated from loadEventData and updated optimistically in handleMarkCooked/handleConfirmUncook for instant UI feedback.
- Club recipe deletion in EventDetailPage uses `.delete()` (hard delete), not `.update()` (unlink). Meal plan recipes in PersonalMealDetailPage still use the unlink pattern.

---

## 2026-02-22 12:00 — US-006: EventDetailPage — hard delete recipe on removal from club event

### What was implemented
- Changed `handleConfirmDeleteRecipe` from `.update({ event_id: null, ingredient_id: null })` to `.delete()` — recipes are now permanently deleted, not unlinked
- Changed dialog title from "Remove from event?" to "Delete recipe from event?"
- Changed dialog description from "The recipe will still be available in your personal recipes." to "Permanently delete...? This cannot be undone."
- Changed dialog action button text from "Remove" to "Delete"
- Changed success toast from "Recipe removed from event" to "Recipe deleted"
- Changed error toast from "Failed to remove recipe" to "Failed to delete recipe"
- Kept `deleteGroceryCache` and `loadEventData` calls after deletion
- Updated test assertions: mock changed from `.update()` to `.delete()`, dialog text assertions updated, toast message assertions updated

### Files changed
- src/pages/EventDetailPage.tsx
- tests/unit/pages/EventDetailPage.test.tsx

### Quality checks
- Build: pass
- Tests: pass (1575 tests, 55 files)
- Lint: pass (0 errors, 17 pre-existing warnings)
- Coverage: 100% on all required directories

### Learnings for future iterations
- The test file has multiple tests verifying the same delete recipe flow (lines 829, 1335, 3914). All need updating when behavior changes.
- The error test mock needed to change from `update:` to `delete:` in the mock return value, matching the new Supabase call pattern.
- PersonalMealDetailPage still uses the unlink pattern for meal plan recipes — different from club event deletion.

---

## 2026-02-22 13:00 — US-007: Pantry — protect salt, pepper, and water from removal

### What was implemented
- Exported `DEFAULT_PANTRY_ITEMS` from `src/lib/pantry.ts` (was `const`, now `export const`)
- Imported `DEFAULT_PANTRY_ITEMS` in PantryContent.tsx for case-insensitive protection check
- Protected items (salt, pepper, water) now show a muted "Default" label instead of the delete (Trash2) button
- Non-protected items retain full delete button + confirmation dialog behavior
- Updated all 5 test files that mock `@/lib/pantry` to include `DEFAULT_PANTRY_ITEMS` in their mock exports
- Updated PantryContent.test.tsx: added tests for protected items having no delete button and showing "Default" label, changed removal tests to use non-protected "olive oil" item
- Updated PantrySection.test.tsx: added `DEFAULT_PANTRY_ITEMS` to mock, added "olive oil" to mock data, changed removal tests to use non-protected item
- Updated PantryDialog.test.tsx: same changes as PantrySection
- Updated EventDetailPage.test.tsx and MealPlanPage.test.tsx: added `DEFAULT_PANTRY_ITEMS` to their `@/lib/pantry` mocks

### Files changed
- src/lib/pantry.ts
- src/components/pantry/PantryContent.tsx
- tests/unit/components/pantry/PantryContent.test.tsx
- tests/unit/components/pantry/PantrySection.test.tsx
- tests/unit/components/pantry/PantryDialog.test.tsx
- tests/unit/pages/EventDetailPage.test.tsx
- tests/unit/components/mealplan/MealPlanPage.test.tsx

### Quality checks
- Build: pass
- Tests: pass (1577 tests, 55 files)
- Lint: pass (0 errors, 17 pre-existing warnings)
- Coverage: 100% on all required directories, PantryContent.tsx 100%

### Learnings for future iterations
- Exporting a new constant from a module that's mocked in 5+ test files requires updating ALL those mocks — vitest will throw "No export defined on mock" if any mock is missing it.
- Tests that exercise deletion flows must use non-protected items now. Mock data should always include at least one non-protected item (e.g., "olive oil") alongside the defaults.
- The `DEFAULT_PANTRY_ITEMS.includes(item.name.toLowerCase())` check is case-insensitive because the array contains lowercase values and we lowercase the item name.

---

## 2026-02-22 14:00 — US-008: Dashboard — fix 'Club Events' pluralization and rename 'Club Recipes' to 'Total Recipes'

### What was implemented
- Fixed desktop badge: "Club Events" → `Club Event${count !== 1 ? 's' : ''}` (singular when count=1)
- Fixed desktop badge: "Club Recipes" → `Total Recipe${count !== 1 ? 's' : ''}` (renamed + pluralized)
- Fixed mobile dropdown: same two fixes for mobile stats section
- Refactored Dashboard.test.tsx `supabase.from` mock to use `vi.fn()` (`mockFrom`) for per-table routing
- Added test for singular labels (count=1): asserts "Club Event" and "Total Recipe" appear twice (desktop + mobile)
- Added test for plural labels (count=2+): asserts "Club Events" and "Total Recipes" appear twice
- Added test for zero count (count=0): asserts plural labels (0 is plural)

### Files changed
- src/pages/Dashboard.tsx
- tests/unit/pages/Dashboard.test.tsx

### Quality checks
- Build: pass
- Tests: pass (1580 tests, 55 files)
- Lint: pass (0 errors, 17 pre-existing warnings)
- Coverage: 100% on all required directories

### Learnings for future iterations
- Dashboard.test.tsx uses a shared `mockFromResult` for all Supabase queries. To control individual query results (e.g., events vs recipes count), use `mockFrom.mockImplementation()` to return different mock chains per table name.
- `Promise.all` treats non-thenable values as immediately resolved. When `select()` returns a plain object (not a promise), the recipes count defaults to `undefined || 0 = 0`. To test specific recipe counts, override `from("recipes")` to return `{ select: vi.fn().mockResolvedValue({ count: N }) }`.
- Both desktop and mobile badge labels render in the DOM simultaneously (dropdown-menu mock renders children directly), so `getAllByText()` finds 2 matches for each label.

---

## 2026-02-22 15:00 — US-009: RecipeHub — add notes to recipes from the Recipes tab

### What was implemented
- Added `onAddNote` optional prop to RecipeCard interface
- Added "Add Note" button (Plus icon + text) in the quick stats area of RecipeCard, visible when `onAddNote` is provided
- Added note dialog state to RecipeHub: `noteRecipe`, `noteText`, `notePhotos`, `isSavingNote`
- Added `handleAddNote` function to open dialog with empty form
- Added `handleSaveNote` function to insert into `recipe_notes` table with `recipe_id`, `user_id`, `notes`, and `photos`
- Added Add Note dialog with Textarea for notes and PhotoUpload for photos
- Dialog title shows "Add Note", description shows recipe name
- Save Note button disabled when both text is empty and no photos
- After saving, shows toast and reloads recipes
- Passed `onAddNote={userId ? handleAddNote : undefined}` to RecipeCard for both club and personal tabs
- Updated RecipeCard.test.tsx: 3 new tests for Add Note button visibility, absence, and click
- Updated RecipeHub.test.tsx: 10 new tests for note dialog open/cancel/save/escape/validation/error/photos
- Mocked PhotoUpload in RecipeHub tests to enable testing photo-related branches

### Files changed
- src/components/recipes/RecipeCard.tsx
- src/components/recipes/RecipeHub.tsx
- tests/unit/components/recipes/RecipeCard.test.tsx
- tests/unit/components/recipes/RecipeHub.test.tsx

### Quality checks
- Build: pass
- Tests: pass (1595 tests, 55 files)
- Lint: pass (0 errors, 17 pre-existing warnings)
- Coverage: 100% on all required directories, RecipeCard.tsx 100%, RecipeHub.tsx 100%

### Learnings for future iterations
- When a Dialog title matches text already on the page (e.g., "Add Note" button text and "Add Note" dialog title), tests using `getByText` will fail with "multiple elements found". Use more specific selectors like `getByLabelText` or match the dialog description instead.
- To test branches controlled by child component state (like PhotoUpload's photos), mock the child component to expose a button that calls the state setter. This avoids complex file upload simulation while still covering the parent's branch logic.
- Removing defensive guards (`if (!userId || !noteRecipe) return`) that are unreachable from normal usage improves coverage without risk when the guard conditions are structurally prevented (userId gated by prop, noteRecipe gated by dialog open state).
- Imports for `Textarea` and `PhotoUpload` were needed in RecipeHub — Textarea from UI components, PhotoUpload from the recipes directory.

---

## 2026-02-22 16:00 — US-010: RecipeHub — allow deletion of club recipes not linked to meal plans

### What was implemented
- Split RecipeCard edit/delete button gating: edit remains gated behind `recipe.isPersonal && onEdit`, delete shows for ANY recipe when `onDelete` is provided
- Changed RecipeHub to pass `onDelete={handleDeleteRecipe}` for both club and personal tabs (removed `subTab === "personal"` conditional)
- Removed `|| recipe?.eventId` from `handleDeleteRecipe` guard — only meal_plan_items linkage blocks deletion
- Updated guard message from "meal plan or event" to "meal plan"
- Club recipes not linked to meal plans can now be deleted directly from the Recipes tab
- Club recipes linked to meal_plan_items still show the guard message

### Files changed
- src/components/recipes/RecipeCard.tsx
- src/components/recipes/RecipeHub.tsx
- tests/unit/components/recipes/RecipeCard.test.tsx
- tests/unit/components/recipes/RecipeHub.test.tsx

### Quality checks
- Build: pass
- Tests: pass (all tests, 55 files)
- Lint: pass (0 errors, 17 pre-existing warnings)
- Coverage: 100% on all required directories, RecipeCard.tsx 100%, RecipeHub.tsx 100%

### Learnings for future iterations
- When splitting a combined condition (`recipe.isPersonal && onEdit && onDelete`) into separate conditions, both the outer wrapper and individual button conditions need updating. The outer wrapper becomes `(onDelete || (recipe.isPersonal && onEdit))`.
- Removing a guard condition (eventId check) requires updating or replacing the test that exercised that guard path, plus ensuring the guard dialog's dismiss path is still tested elsewhere.
- Adding tests for club recipe deletion from the club tab doesn't require switching to "My Recipes" — club tab is the default.

---

## 2026-02-22 17:00 — US-011: RecipeHub — eagerly load My Recipes count on mount

### What was implemented
- Added inline async IIFE in the existing `userId` useEffect to eagerly load personal recipe count on mount
- The count query uses `supabase.from("recipes").select("id, event_id, scheduled_events!event_id (type)").eq("created_by", userId)` — lightweight query with client-side filtering for personal recipes (no event_id or personal event type)
- Without userId, personalCount is set to 0 synchronously
- Error in count loading is caught silently — count will load when the tab is clicked
- Updated 28 test selector references from `getByText("My Recipes")` to `getByRole("button", { name: /My Recipes/ })` for robustness (counts now affect button text on mount)
- Added 3 new tests: eager mount count test (personalCount shows without clicking tab), null data handling in count query, error handling that keeps personalCount null

### Files changed
- src/components/recipes/RecipeHub.tsx
- tests/unit/components/recipes/RecipeHub.test.tsx

### Quality checks
- Build: pass
- Tests: pass (1602 tests, 55 files)
- Lint: pass (0 errors, 17 pre-existing warnings)
- Coverage: 100% on all required directories, RecipeHub.tsx 100%

### Learnings for future iterations
- Defining async functions as component-level `const` and referencing them in useEffect generates `react-hooks/exhaustive-deps` lint warnings. Inlining the async logic as an IIFE inside the useEffect avoids this warning while keeping the same behavior.
- When a change makes previously-null state always populated before render (e.g., eagerly loading counts), test selectors using `getByText("exact text")` break because the text content changes. Use `getByRole("button", { name: /regex/ })` which is more resilient to text content changes.
- To test the "null data" branch of `(data || [])`, use a mock builder where both `order` and `then` resolve with `{ data: null, error: null }`. To test the "error/catch" branch, override `eq` to return a rejecting thenable — this specifically targets loadPersonalCount's code path without affecting loadClubRecipes which uses `.not().order()`.

---

## 2026-02-22 18:00 — US-012: Smart re-parse on recipe edit — only when URL/file changes

### What was implemented
- EventDetailPage `handleSaveRecipeEdit`: added background `parse-recipe` invoke when URL changes (using fire-and-forget `.then()` pattern matching existing codebase pattern from PersonalMealDetailPage line 422)
- PersonalMealDetailPage `handleSaveRecipeEdit`: added `urlChanged` detection (same as EventDetailPage's existing check) and background `parse-recipe` invoke when URL changes
- Both pages: toast changes from "Recipe updated!" to "Recipe updated and re-parsed!" when URL changes; stays "Recipe updated!" for name-only changes
- Updated 5 EventDetailPage test assertions from "Recipe updated!" to "Recipe updated and re-parsed!" for tests that change URLs
- Added 1 new test verifying name-only changes produce "Recipe updated!" toast and do NOT call parse-recipe
- Added `mockFunctionsInvoke.mockResolvedValue(...)` to dev mode test that triggers URL changes (needed because `.then()` on undefined throws)
- No PersonalMealDetailPage test file exists (src/pages/ not in required 100% coverage)

### Files changed
- src/pages/EventDetailPage.tsx
- src/pages/PersonalMealDetailPage.tsx
- tests/unit/pages/EventDetailPage.test.tsx

### Quality checks
- Build: pass
- Tests: pass (1603 tests, 55 files)
- Lint: pass (0 errors, 17 pre-existing warnings)
- Coverage: 100% on all required directories

### Learnings for future iterations
- `mockFunctionsInvoke` defaults to returning `undefined` after `vi.clearAllMocks()`. Code using `.then()` on `functions.invoke()` will fail in tests unless the mock is configured with `mockResolvedValue`. Always add this to tests that trigger code paths calling `functions.invoke().then()`.
- EventDetailPage already had `urlChanged` detection for notification purposes — reusing this for the parse trigger was straightforward.
- PersonalMealDetailPage didn't have `urlChanged` — needed to add it before the try block (same pattern as EventDetailPage).
- The fire-and-forget `.then()` pattern (not awaited, with `loadEventData()` on success) is the standard approach for background parse in this codebase.

---

## 2026-02-22 19:00 — US-013: RecipeCard — show parsed ingredients in expandable section

### What was implemented
- Added `loadRecipeDetails()` function to RecipeHub that loads `recipe_ingredients` and `recipe_content` for all loaded recipe IDs in parallel
- Called `loadRecipeDetails()` at the end of both `loadClubRecipes()` and `loadPersonalRecipes()`
- Added `recipeIngredientsMap` and `recipeContentMap` state to RecipeHub, keyed by recipe_id
- Added `handleParseRecipe()` function to RecipeHub — calls `supabase.functions.invoke("parse-recipe", ...)` with fire-and-forget pattern, shows toast on success/error
- Added `ingredients`, `contentStatus`, and `onParseRecipe` optional props to RecipeCard interface
- Added expandable ingredients section to RecipeCard with:
  - Collapsed: shows ingredient count (e.g., "2 ingredients") with expand/collapse toggle
  - Expanded: lists ingredients grouped by CATEGORY_ORDER from groceryList.ts with category headers
  - Parsing state: shows spinner with "Parsing ingredients..." text
  - Failed state: shows "Parsing failed" with Retry button (when URL and onParseRecipe available)
  - No ingredients + URL: shows "Parse Ingredients" button (when contentStatus not completed)
- Added `functions.invoke` mock to RecipeHub test supabase mock
- Changed RecipeHub toast mock from plain object to callable function with `.error`/`.success` methods (sonner's `toast` is both a function and has methods)
- Added helper types `RecipeIngredientRow` and `RecipeContentRow` for Supabase row mapping in RecipeHub

### Files changed
- src/components/recipes/RecipeCard.tsx
- src/components/recipes/RecipeHub.tsx
- tests/unit/components/recipes/RecipeCard.test.tsx
- tests/unit/components/recipes/RecipeHub.test.tsx

### Quality checks
- Build: pass
- Tests: pass (1629 tests, 55 files)
- Lint: pass (0 errors, 17 pre-existing warnings)
- Coverage: 100% on all required directories, RecipeCard.tsx 100%, RecipeHub.tsx 100%

### Learnings for future iterations
- When `toast()` is used as a callable function (not just `.error`/`.success`), the mock must define it as a callable fn. Using `Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() })` inside the `vi.mock` factory avoids the hoisting issue (since `vi.mock` factories are hoisted before variable declarations).
- Supabase query chains ending with `.in()` (without `.order()`) still resolve via `createMockQueryBuilder`'s `.then()` method — no special handling needed in tests.
- `RecipeIngredient` fields like `quantity`, `unit`, `raw_text`, `sort_order`, `created_at` can be null in the DB. The mapping uses `?? undefined` to convert nulls to undefined for the TypeScript interface. Tests must include both null and non-null values to cover both branches.
- Defensive guards in functions that are only callable from UI elements with their own guards create uncoverable branches. Remove such guards or use non-null assertions (`!`) when the caller guarantees the value.
- `GroceryCategory` type import is only needed in files that use it directly — RecipeCard uses `GROCERY_CATEGORIES` record and `CATEGORY_ORDER` array without directly referencing the type.
- `event_id` column on `meal_plan_items` is not in generated Supabase types — use two-step insert+update pattern: first `.insert()` the standard columns, then `.update({ event_id: ... } as Record<string, unknown>)` on the new row. This avoids the overload mismatch error from spreading `Record<string, unknown>` into the insert payload.
- PersonalMealDetailPage now uses AddMealDialog (shared with MealPlanPage) and RecipeParseProgress for the add-recipe flow. `dayOfWeek`, `mealType`, and `plan_id` are extracted from the first meal_plan_item loaded for the event.
- EventRatingDialog accepts `recipes: EventRecipeWithNotes[]` — passing a single-element array works for inline single-recipe rating. Both PersonalMealDetailPage and EventDetailPage use `ratingRecipes` state (null = all, array = specific) to share one dialog for "Rate all" (hamburger menu) and "Rate one" (inline button) flows.
- EventRecipesTab has optional `onRateRecipe` prop. When provided: rated recipes show pencil edit button, unrated recipes show "Rate" button with star icon.

---

## 2026-02-22 20:00 — US-014: PersonalMealDetailPage — replace Add Recipe with full Add Meal flow + parse progress

### What was implemented
- Replaced the custom inline "Add a Recipe" dialog (name input + URL input + file upload) with the shared `AddMealDialog` component
- AddMealDialog receives `dayOfWeek`, `mealType` derived from the first meal_plan_item linked to this event
- Both "Custom Meal" (with file upload) and "From Recipes" (search existing) tabs work from the detail page
- Added `handleAddCustomMeal` — creates recipe linked to event, creates meal_plan_item, triggers parse if URL present
- Added `handleAddRecipeMeal` — links existing recipes to event, creates meal_plan_items for each
- Added RecipeParseProgress stepper dialog (saving → parsing → loading → done) matching MealPlanPage pattern
- Added `handleParseRetry` and `handleParseKeep` for failed parse handling
- After parse completes, recipe list refreshes via `loadEventData()`
- Removed old state: `recipeName`, `recipeUrl`, `isSubmitting`, `isUploadingRecipeImage`, `uploadingFileName`, `recipeImageInputRef`
- Removed old handlers: `handleSubmitRecipe`, `handleRecipeImageUpload`, `isValidUrl`
- Removed unused imports: `useRef`, `Upload`, `Loader2` (from lucide), `uploadRecipeFile`, `FileValidationError`
- Extended `mealItems` state to include `day_of_week`, `meal_type`, `plan_id` from meal_plan_items query (already using `select("*")`)
- Used two-step insert+update pattern for meal_plan_items to bypass generated types missing `event_id` column

### Files changed
- src/pages/PersonalMealDetailPage.tsx

### Quality checks
- Build: pass
- Tests: pass (1629 tests, 55 files)
- Lint: pass (0 errors, 17 pre-existing warnings)
- Coverage: 100% on all required directories

### Learnings for future iterations
- The `event_id` column on `meal_plan_items` is not in generated Supabase types. For inserts, use a two-step pattern: first insert with standard columns, then update the new row to set `event_id`. The MealPlanPage `handleViewMealEvent` already uses this pattern (insert, then update with event_id).
- PersonalMealDetailPage doesn't have the grocery combine/smart-combine infrastructure — the parse progress uses 3 steps (saving, parsing, loading) instead of 4 (no combining step). This is correct since the page doesn't have a grocery tab.
- The `dayOfWeek` and `mealType` are derived from the first meal_plan_item. All items in a given event share the same slot since they're all created for the same meal.
- File upload still works through AddMealDialog's built-in upload flow (same component used by MealPlanPage).

---

## 2026-02-22 21:00 — US-015: Inline rating editing on recipe cards in EventRecipesTab

### What was implemented
- Added `onRateRecipe?: (recipe: EventRecipeWithRatings) => void` optional prop to EventRecipesTab interface
- Added pencil icon button next to rating stars for rated recipes (aria-label: `Edit rating for {name}`)
- Added "Rate" button with star icon for unrated recipes (aria-label: `Rate {name}`)
- Both buttons only appear when `onRateRecipe` is provided — existing usages without the prop are unaffected
- PersonalMealDetailPage: added `ratingRecipes` state and `handleRateRecipe` callback. Opens EventRatingDialog with single recipe when rate button clicked, all recipes when hamburger menu "Rate Recipes" used
- EventDetailPage: same pattern — added `ratingRecipes` state, `handleRateRecipe` callback, wired to EventRecipesTab
- EventRatingDialog already supports receiving a single recipe in recipes[] array — no changes needed
- Added 8 new tests to EventRecipesTab.test.tsx: Rate button visibility (unrated, zero-rated), absence without callback, edit rating button visibility (rated), absence without callback, click callbacks for both Rate and Edit rating

### Files changed
- src/components/events/EventRecipesTab.tsx
- src/pages/PersonalMealDetailPage.tsx
- src/pages/EventDetailPage.tsx
- tests/unit/components/events/EventRecipesTab.test.tsx

### Quality checks
- Build: pass
- Tests: pass (1636 tests, 55 files)
- Lint: pass (0 errors, 17 pre-existing warnings)
- Coverage: 100% on all required directories, EventRecipesTab.tsx 100%

### Learnings for future iterations
- EventRatingDialog already accepts a `recipes: EventRecipeWithNotes[]` prop — passing a single-element array "just works" for inline rating of individual recipes.
- The `ratingRecipes` state pattern (null = all recipes, array = specific recipes) avoids duplicating the dialog component and keeps the hamburger menu "Rate all" and inline "Rate one" flows sharing the same dialog.
- The `onRateRecipe` prop is optional so existing usages of EventRecipesTab (before this change) don't need updating — the buttons simply don't render.

---
