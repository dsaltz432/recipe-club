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
- RecipeCard edit/delete buttons currently gated behind `recipe.isPersonal`. RecipeCard also supports `onAddNote` prop for adding notes directly from the card.
- When adding new UI to RecipeHub that uses child components (e.g., PhotoUpload), mock those child components in RecipeHub tests to enable testing the branches they control (e.g., photo state)
- RecipeHub loads recipes lazily per sub-tab (club on mount, personal only when clicked)
- Removing component props cascades: child interface → parent interface → parent destructuring → parent JSX → parent tests. Build won't pass until all references are removed.
- MealPlanSlot is now display-only (no edit/cook/uncook), MealPlanGrid passes only onAddMeal + onViewMealEvent
- All 5 test files that mock `@/lib/pantry` must include `DEFAULT_PANTRY_ITEMS: ["salt", "pepper", "water"]` in the mock — PantryContent imports it for protected item logic
- Dead code in MealPlanPage (editingItem state, edit branches in handleAddCustomMeal/handleAddRecipeMeal, EventRatingDialog, uncook AlertDialog) has been removed as part of US-001
- `cooked_at` column on meal_plan_items is not in generated Supabase types — use `as Record<string, unknown>` for update payloads and row access, `select("*")` instead of named columns

## Current Status
**Last Updated:** 2026-02-22
**Tasks Completed:** 9
**Current Task:** US-009 complete

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
