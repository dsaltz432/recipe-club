# Recipe Club Hub - Meals Simplification & Enhancements - Activity Log

## Codebase Patterns

### Testing
- All tests mock `@/integrations/supabase/client` via `vi.mock("@/integrations/supabase/client")`
- Mock factories in `@tests/utils`: `createMockUser`, `createMockIngredient`, `createMockRecipe`, `createMockNote`, `createMockEvent`
- Coverage must be 100% on all files except `IngredientWheel.tsx` (~55% OK)
- Required 100% directories: events, ingredients, mealplan, recipes, lib
- Use `vi.resetModules()` + `vi.doMock()` + dynamic `import()` for auth tests

### Supabase Mocking Pattern
```typescript
const mockSupabaseFrom = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args) => mockSupabaseFrom(...args),
    functions: { invoke: vi.fn() },
    auth: { getUser: vi.fn() },
  },
}));
```

### Component Patterns
- Toast: `import { toast } from "sonner"`
- Routing: `react-router-dom` with `useNavigate`, `useParams`
- UI components from `@/components/ui/` (shadcn/ui)
- Edge functions are Deno-based in `supabase/functions/`

### File Deletion Pattern
When deleting components, also delete:
1. The component file
2. Its test file in `tests/unit/`
3. All imports/references in parent components
4. All related test assertions in parent test files

### Grocery Data Loading Pattern
When adding grocery list to a page, load data via: query items → extract recipe_ids → Promise.all(recipe_ingredients, recipe_content, recipes). Map DB rows to TypeScript types (snake_case → camelCase, null → undefined). Pass to GroceryListSection which handles combining, filtering, and display.

### Reusing EventRatingDialog for Meals
EventRatingDialog requires a valid `event_id` for recipe_ratings FK. When using from MealPlanPage: check if items have an `eventId`; if not, create a personal event first (same as handleViewMealEvent). Use `mode="rating"` (at least one rating required, not all). Build `EventRecipeWithNotes[]` from slot items: `{ recipe: { id, name, url }, notes: [] }`.

### Mocking Complex Dialogs in Parent Tests
When testing a parent component that renders a complex dialog (like EventRatingDialog), mock the dialog itself rather than its internal Supabase calls. Use `vi.mock()` with a simple component that exposes `onComplete`/`onCancel` buttons. This keeps parent tests focused on state management, not dialog internals.

### Unreachable Guards Kill Coverage
Defensive `if (!x) return` guards in callbacks that can only fire when `x` is truthy (e.g., dialog onComplete when dialog only renders if state is set) are unreachable and cause branch coverage gaps. Remove them or use non-null assertion (`x!`) since the guard can never be hit.

### Supabase Mock — No AI
When AI features are removed, the supabase mock no longer needs `functions: { invoke: vi.fn() }`. Only mock what the component actually uses.

### Removing Features — Cascading Cleanup
When removing a feature (sharing/saving), changes cascade across:
1. Component files (delete)
2. Edge function files (delete)
3. Parent components that imported/used the feature (RecipeHub, RecipeCard, Dashboard)
4. Type definitions (auth.ts access_type union)
5. Test files for deleted components (delete)
6. Test files for parent components (remove related tests)
7. Test mocks (remove mocks for deleted dependencies like `functions.invoke`, `devMode`)

## Current Status
**Last Updated:** 2026-02-19
**Tasks Completed:** 6
**Current Task:** US-006 complete

---

## Session Log

## 2026-02-19 08:00 — US-001: Remove AI features from Meals tab

### What was implemented
- Deleted 4 AI component files: PreferencesDialog.tsx, AISuggestionPanel.tsx, AIChatPanel.tsx, SuggestionCard.tsx
- Deleted 4 corresponding test files + 1 edge function test (generate-meal-suggestions.test.ts)
- Deleted generate-meal-suggestions edge function directory (index.ts + deno.json)
- Cleaned MealPlanPage.tsx: removed AI imports, AI state (preferences, suggestions, chatMessages, isLoadingSuggestions, showPreferences), AI functions (loadPreferences, handleGetSuggestions, handleChatMessage, handleAddSuggestionToPlan), and AI JSX (Preferences button, Get Suggestions button, AISuggestionPanel, AIChatPanel, PreferencesDialog)
- Removed unused imports: Settings, Sparkles, isDevMode, Button
- Removed ChatMessage interface from MealPlanPage.tsx
- Removed UserPreferences and MealSuggestion interfaces from src/types/index.ts
- Updated MealPlanPage.test.tsx: removed ~20 AI-related tests, removed mockInvoke/isDevMode mocks, rewrote "no planId" test to use dialog instead of suggestions
- Rewrote "does nothing when adding to plan with no planId" test to exercise the early return via the Add Meal dialog flow instead of Get Suggestions

### Files changed
- src/components/mealplan/PreferencesDialog.tsx (deleted)
- src/components/mealplan/AISuggestionPanel.tsx (deleted)
- src/components/mealplan/AIChatPanel.tsx (deleted)
- src/components/mealplan/SuggestionCard.tsx (deleted)
- tests/unit/components/mealplan/PreferencesDialog.test.tsx (deleted)
- tests/unit/components/mealplan/AISuggestionPanel.test.tsx (deleted)
- tests/unit/components/mealplan/AIChatPanel.test.tsx (deleted)
- tests/unit/components/mealplan/SuggestionCard.test.tsx (deleted)
- tests/unit/edge-functions/generate-meal-suggestions.test.ts (deleted)
- supabase/functions/generate-meal-suggestions/index.ts (deleted)
- supabase/functions/generate-meal-suggestions/deno.json (deleted)
- src/components/mealplan/MealPlanPage.tsx (modified — removed AI code)
- tests/unit/components/mealplan/MealPlanPage.test.tsx (modified — removed AI tests)
- src/types/index.ts (modified — removed UserPreferences & MealSuggestion)

### Quality checks
- Build: pass
- Tests: pass (1019 tests, 100% coverage on all required directories)
- Lint: pass (0 errors)

### Learnings for future iterations
- When removing features, the test rewrite is the biggest effort — ~20 tests were AI-specific
- The "no planId" test needed creative rework since it originally relied on AI suggestions to trigger addItemToPlan; rewrote to use the Add Meal dialog flow instead
- Supabase mock can be simplified when removing features that use `functions.invoke`

---

## 2026-02-19 09:00 — US-002: Remove recipe sharing and saving features

### What was implemented
- Deleted 3 sharing/saving component files: SharedWithMeSection.tsx, ShareRecipeDialog.tsx, SaveRecipeButton.tsx
- Deleted 3 corresponding test files
- Deleted send-recipe-share edge function directory (index.ts + deno.json) and test
- Cleaned RecipeHub.tsx: removed SharedWithMeSection import, `isSaved`/`savedRecipeIds`/`loadSavedRecipeIds()`/`handleSaveToggle()` state/functions, `"shared"` sub-tab, `accessType`/`share_only` prop, saved_recipes queries from loadPersonalRecipes (dedup/merge logic)
- Cleaned RecipeCard.tsx: removed Share2/SaveRecipeButton/ShareRecipeDialog imports, share button, save button, `isSaved`/`onSaveToggle` props, `showShareDialog` state
- Cleaned Dashboard.tsx: removed `isShareOnly` const, share_only TabsList branch, `!isShareOnly` guards, `accessType` prop on RecipeHub, unused `allowedUserData` state and `AllowedUser` type import
- Updated auth.ts: changed `access_type` union from `"club" | "share_only"` to just `"club"`
- Updated RecipeHub.test.tsx: removed entire "Shared with Me tab" describe (7 tests), removed 11 saved-recipe tests from "Sub-tabs" describe, removed `saved_recipes` mock handling, added 2 coverage tests
- Updated RecipeCard.test.tsx: removed "Share button" describe (3 tests), removed Supabase/devMode mocks (no longer needed)
- Updated auth.test.ts: changed `share_only` references to `"club"`

### Files changed
- src/components/recipes/SharedWithMeSection.tsx (deleted)
- src/components/recipes/ShareRecipeDialog.tsx (deleted)
- src/components/recipes/SaveRecipeButton.tsx (deleted)
- tests/unit/components/recipes/SharedWithMeSection.test.tsx (deleted)
- tests/unit/components/recipes/ShareRecipeDialog.test.tsx (deleted)
- tests/unit/components/recipes/SaveRecipeButton.test.tsx (deleted)
- tests/unit/edge-functions/send-recipe-share.test.ts (deleted)
- supabase/functions/send-recipe-share/index.ts (deleted)
- supabase/functions/send-recipe-share/deno.json (deleted)
- src/components/recipes/RecipeHub.tsx (modified — removed sharing/saving code)
- src/components/recipes/RecipeCard.tsx (modified — removed share/save UI)
- src/pages/Dashboard.tsx (modified — removed share_only logic)
- src/lib/auth.ts (modified — removed share_only from access_type)
- tests/unit/components/recipes/RecipeHub.test.tsx (modified — removed 18 tests, added 2)
- tests/unit/components/recipes/RecipeCard.test.tsx (modified — removed 3 tests, simplified mocks)
- tests/unit/lib/auth.test.ts (modified — updated share_only references)

### Quality checks
- Build: pass
- Tests: pass (941 tests, 100% coverage on all required directories)
- Lint: pass (0 errors)

### Learnings for future iterations
- Removing saved_recipes from loadPersonalRecipes simplified the function significantly — from a Promise.all with dedup/merge to a simple single query
- Dashboard had cascading cleanup: removing share_only made `allowedUserData` state unused, which also made the `AllowedUser` type import unused
- RecipeCard test no longer needs Supabase mock at all since ShareRecipeDialog was the only reason for it

---

## 2026-02-19 10:00 — US-003: Fix recipe filtering - personal vs club

### What was implemented
- **No code changes required.** All 8 acceptance criteria were already satisfied by the US-002 implementation:
  - `loadPersonalRecipes()` already queries `created_by=userId AND event_id IS NULL` (lines 165-166)
  - No `saved_recipes` table query exists
  - No `savedRecipes` array or merge logic exists
  - `setRecipes(personalRecipes)` called directly (line 227)
  - `loadClubRecipes()` queries `event_id IS NOT NULL` (line 68)
  - Tests have no saved recipe dedup tests
  - `isSaved` removed from `RecipeWithNotes` interface

### Files changed
- ralph/prd.json (updated — US-003 passes: true)
- ralph/activity.md (updated — session log)

### Quality checks
- Build: pass
- Tests: pass (941 tests, 100% coverage on all required directories)
- Lint: pass (0 errors)

### Learnings for future iterations
- When user stories overlap in scope, the earlier story may fully satisfy later ones — always verify before writing new code

---

## 2026-02-19 11:00 — US-004: Apply pantry filtering to per-recipe ingredient views

### What was implemented
- Applied `filterPantryItems()` to per-recipe tab ingredient lists in GroceryListSection.tsx
- Before this fix, per-recipe tabs displayed raw ingredients without pantry filtering, while the combined view already filtered them
- Added 3 lines: create `filteredRecipeItems` by applying `filterPantryItems()` when `pantryItems.length > 0`, then pass to `groupByCategory()`
- Added 2 test cases: one verifying pantry items are excluded from per-recipe tabs, one verifying all items show when no pantry items provided

### Files changed
- src/components/recipes/GroceryListSection.tsx (modified — added pantry filtering to per-recipe tab rendering)
- tests/unit/components/recipes/GroceryListSection.test.tsx (modified — added 2 pantry filtering tests for per-recipe tabs)

### Quality checks
- Build: pass
- Tests: pass (943 tests, 100% coverage on all required directories)
- Lint: pass (0 errors)

### Learnings for future iterations
- GroceryListSection is reused in both EventDetailPage (club events) and will be reused in MealPlanPage (US-005) — fixes here apply to both contexts automatically
- The `filterPantryItems()` function works on `CombinedGroceryItem[]` — the per-recipe tab builds this same type, so the function applies directly with no adaptation needed

---

## 2026-02-19 12:00 — US-005: Add Groceries tab to Meals page

### What was implemented
- Added a tab switcher ('Meal Plan' / 'Groceries') to MealPlanPage header
- Added `viewTab` state to toggle between meal grid and grocery views
- Added `loadGroceryData()` that queries recipe_ingredients, recipe_content, and recipes for the current week's meal plan items
- Added `loadPantryItems()` that loads user pantry items via `ensureDefaultPantryItems()` + `getPantryItems()`
- Grocery data loads when switching to Groceries tab and reloads when items change (e.g., week change)
- Reused existing `GroceryListSection` component for combined + per-recipe grocery views
- Added `handleParseRecipe()` for recipe parsing from the Groceries tab
- WeekNavigation remains visible in both Meal Plan and Groceries views
- Empty state shown when no meals have recipe IDs (custom meals without URLs)
- Header text changed from "Meal Plan" to "Meals" to avoid duplication with tab button text
- Added 12 new tests covering: tab switching, grocery data loading, empty states, error handling, null data fields, parse recipe flow, week navigation while on groceries
- Mocked `@/lib/pantry`, `@/lib/constants` (SHOW_PARSE_BUTTONS), and `supabase.functions.invoke` in test file

### Files changed
- src/components/mealplan/MealPlanPage.tsx (modified — added Groceries tab with grocery data loading)
- tests/unit/components/mealplan/MealPlanPage.test.tsx (modified — added 12 grocery tests, updated header text references, added pantry/constants/invoke mocks)

### Quality checks
- Build: pass
- Tests: pass (957 tests, 100% coverage on all required directories)
- Lint: pass (0 errors)

### Learnings for future iterations
- Reusing GroceryListSection across both EventDetailPage and MealPlanPage works cleanly — the component accepts generic Recipe/RecipeIngredient arrays
- The `loadGroceryData` pattern: query meal_plan_items → extract recipe_ids → Promise.all(recipe_ingredients, recipe_content, recipes) — mirrors EventDetailPage's `loadGroceryData`
- When adding tab/view state, watch for duplicate text between header and tab buttons — rename the heading to avoid test selector conflicts
- `SHOW_PARSE_BUTTONS` constant is currently `false` in production; mock it to `true` in tests to cover parse button interactions
- Removing defensive early returns (`if (!recipe?.url) return`) in favor of try/catch eliminates unreachable branches that are difficult to test

---

## 2026-02-19 14:00 — US-006: Add meal completion with optional rating

### What was implemented
- Added `cooked_at TIMESTAMPTZ` column to `meal_plan_items` via migration
- Added `cookedAt?: string` field to `MealPlanItem` type
- Updated MealPlanSlot with cooked visual indicator (green background, checkmark icons), "Mark as Cooked" button, and "Undo Cook" button
- Updated MealPlanGrid to pass through `onMarkCooked` and `onUncook` callbacks
- Updated MealPlanPage with full cooked/rating flow:
  - Maps `cooked_at` from DB to items
  - `markSlotAsCooked()` updates `cooked_at` via Supabase and local state
  - `handleMarkCooked()` — if slot has no recipes, marks cooked directly; if has recipes, creates a personal event (if needed) then opens EventRatingDialog in 'rating' mode
  - `handleRatingComplete()` — marks slot as cooked after rating submission
  - `handleRatingCancel()` — closes dialog without marking cooked
  - `handleUncook()` — resets `cooked_at` to null
- Added 10 new tests for MealPlanSlot (cooked styling, checkmarks, mark/uncook buttons, conditional rendering)
- Added 2 new tests for MealPlanGrid (onMarkCooked/onUncook passthrough)
- Added 12 new tests for MealPlanPage (cooked_at mapping, direct mark, rating dialog with/without event, rating completion, cancel, uncook, error handling, name fallbacks, multi-slot scenarios)
- Mocked EventRatingDialog in MealPlanPage tests for isolated testing

### Files changed
- supabase/migrations/20260219000000_add_meal_cooked_at.sql (created)
- src/types/index.ts (modified — added cookedAt to MealPlanItem)
- src/components/mealplan/MealPlanSlot.tsx (modified — cooked visual state + Mark as Cooked/Undo Cook buttons)
- src/components/mealplan/MealPlanGrid.tsx (modified — pass through onMarkCooked/onUncook)
- src/components/mealplan/MealPlanPage.tsx (modified — rating dialog integration, cooked state management)
- tests/unit/components/mealplan/MealPlanSlot.test.tsx (modified — 10 new tests)
- tests/unit/components/mealplan/MealPlanGrid.test.tsx (modified — 2 new tests)
- tests/unit/components/mealplan/MealPlanPage.test.tsx (modified — 12 new tests, EventRatingDialog mock)

### Quality checks
- Build: pass
- Tests: pass (983 tests, 100% coverage on all required directories)
- Lint: pass (0 errors)

### Learnings for future iterations
- EventRatingDialog requires a valid event_id (FK to scheduled_events), so events must be created before opening the dialog for meals
- Mocking complex child dialogs in parent component tests is much simpler than mocking all their internal Supabase calls
- Unreachable `if (!state) return` guards in callbacks gated by conditional rendering cause branch coverage gaps — use non-null assertion instead
- Multi-slot tests (items in different slots) are needed to cover `else` branches in `setItems` map callbacks where some items match and others don't

---
