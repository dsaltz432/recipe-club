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
**Tasks Completed:** 4
**Current Task:** US-004 complete

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
