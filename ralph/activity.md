# Recipe Club Hub - Ingredient Sync & Cleanup - Activity Log

## Codebase Patterns
- **GroceryListSection** at `src/components/recipes/GroceryListSection.tsx` — accepts `hasPendingChanges`, `onRecombine`, `generalItems`, `onAddGeneralItemDirect`, `onBulkParseGroceryText`, `isAddingGeneral`, `onAddingGeneralChange`; `hasGeneralTab = !!onBulkParseGroceryText`
- **useGroceryList** at `src/hooks/useGroceryList.ts` — returns `hasPendingChanges`, `triggerRecombine`, `generalItems`, `handleAddGeneralItemDirect`, `handleBulkParseGroceryText`, `isAddingGeneral`, `setIsAddingGeneral`, `refreshGroceries`, `invalidateCache`; accepts `supportsGeneralItems?: boolean` (default false)
- **RecipeIngredientList** at `src/components/recipes/RecipeIngredientList.tsx` — props: `recipeId`, `userId`, `editable?`, `onIngredientsChange?`, `cacheContext?`; handleAdd guards with `if (!userId) return` then calls deleteGroceryCache when cacheContext set; handleEditItemText and handleRemoveItem also call deleteGroceryCache when cacheContext set
- **EventRecipesTab** at `src/components/events/EventRecipesTab.tsx` — renders RecipeIngredientList at ~line 282; currently passes `userId ?? ''`; does NOT pass cacheContext
- **RecipeDetailTabs** at `src/components/shared/RecipeDetailTabs.tsx` — recipes TabsContent has `forceMount className="data-[state=inactive]:hidden"`; grocery and pantry tabs are standard
- **isPantryItem + DEFAULT_PANTRY_ITEMS** pattern: `import { isPantryItem } from '@/lib/groceryList'` and `import { DEFAULT_PANTRY_ITEMS } from '@/lib/pantry'`; merge with `[...new Set([...DEFAULT_PANTRY_ITEMS, ...pantryItems])]` then filter
- **npm run build** runs `tsc -b && vite build` — use for typecheck verification
- **parseIngredientText** at `src/lib/parseIngredientText.ts` — throws 'Not authenticated' when userId is falsy

## Current Status
**Last Updated:** 2026-03-05
**Tasks Completed:** 7
**Current Task:** Awaiting next iteration

---

## Session Log

## [2026-03-05 07:00] — US-008: Remove Rate Recipes button from PersonalMealDetailPage header card

### What was implemented
- Removed the `mealItems.length > 0 && totalRecipes > 0 ?` else branch (lines ~830-844) from the isCooked ternary in PersonalMealDetailPage — replaced with `: null`
- Removed unused `Star` import from lucide-react in PersonalMealDetailPage

### Files changed
- `src/pages/PersonalMealDetailPage.tsx`

### Quality checks
- Build: pass
- Tests: N/A
- Lint: N/A

### Learnings for future iterations
- When removing a button that uses a lucide icon, also check if the icon import becomes unused — TypeScript will catch it as TS6133
- The ternary `isCooked ? ... : mealItems.length > 0 && totalRecipes > 0 ? ... : null` simplifies to `isCooked ? ... : null` when removing the middle branch

---

## [2026-03-05 06:00] — US-007: Add pantry filtering to RecipeIngredientList

### What was implemented
- Added `isPantryItem` to `@/lib/groceryList` import and `DEFAULT_PANTRY_ITEMS` from `@/lib/pantry` import in RecipeIngredientList
- Added `pantryItems?: string[]` to `RecipeIngredientListProps`
- Added `pantryItems` to RecipeIngredientList destructure
- Filter applied before `groupByCategory`: merges `DEFAULT_PANTRY_ITEMS` with prop using same pattern as RecipeCard lines 64-69
- Empty check now uses `displayedIngredients.length === 0` instead of `ingredients.length === 0`
- Added `pantryItems?: string[]` to `EventRecipesTabProps`
- EventRecipesTab destructures and passes `pantryItems` to RecipeIngredientList
- EventDetailPage passes `pantryItems={grocery.pantryItems}` to EventRecipesTab
- PersonalMealDetailPage passes `pantryItems={grocery.pantryItems}` to EventRecipesTab

### Files changed
- `src/components/recipes/RecipeIngredientList.tsx`
- `src/components/events/EventRecipesTab.tsx`
- `src/pages/EventDetailPage.tsx`
- `src/pages/PersonalMealDetailPage.tsx`

### Quality checks
- Build: pass
- Tests: N/A
- Lint: N/A

### Learnings for future iterations
- RecipeCard pantry pattern: `allPantryItems = pantryItems?.length > 0 ? [...new Set([...DEFAULT_PANTRY_ITEMS, ...pantryItems])] : DEFAULT_PANTRY_ITEMS`; then filter with `isPantryItem(name, allPantryItems, unit)`
- Filter must be applied before `groupByCategory` and the empty check must use the filtered array

---

## [2026-03-05 05:00] — US-006: Add General Items support to EventDetailPage and PersonalMealDetailPage

### What was implemented
- Added `supportsGeneralItems: true` to `useGroceryList` in EventDetailPage
- Added `supportsGeneralItems: true` to `useGroceryList` in PersonalMealDetailPage
- Added `generalItems`, `onAddGeneralItemDirect`, `onBulkParseGroceryText`, `isAddingGeneral`, `onAddingGeneralChange` to GroceryListSection in EventDetailPage
- Added same 5 General props to GroceryListSection in PersonalMealDetailPage

### Files changed
- `src/pages/EventDetailPage.tsx`
- `src/pages/PersonalMealDetailPage.tsx`

### Quality checks
- Build: pass
- Tests: N/A
- Lint: N/A

### Learnings for future iterations
- Pattern: add `supportsGeneralItems: true` to useGroceryList options, then pass the 5 General props (generalItems, onAddGeneralItemDirect, onBulkParseGroceryText, isAddingGeneral, onAddingGeneralChange) to GroceryListSection
- Reference: MealPlanPage lines 77 and 516-526

---

## [2026-03-05 04:00] — US-005: Fix AddIngredientInput error when userId is empty

### What was implemented
- Added `if (!userId) return;` guard at the top of `handleAdd` in RecipeIngredientList

### Files changed
- `src/components/recipes/RecipeIngredientList.tsx`

### Quality checks
- Build: pass
- Tests: N/A
- Lint: N/A

### Learnings for future iterations
- EventRecipesTab passes `userId ?? ''` so an empty string reaches handleAdd when user is not loaded; early return prevents the `parseIngredientText` 'Not authenticated' throw

---

## [2026-03-05 03:00] — US-004: Consistent grocery refresh on recipe add/delete across all pages

### What was implemented
- Added `grocery.refreshGroceries()` after `loadEventData()` in `handleAddCustomMeal` in PersonalMealDetailPage
- Added `grocery.refreshGroceries()` after `loadEventData()` in `handleAddRecipeMeal` in PersonalMealDetailPage
- Added `grocery.refreshGroceries()` after `loadEventData()` in `handleAddManualMeal` in PersonalMealDetailPage
- Added `grocery.refreshGroceries()` after `loadEventData()` in parse-completion useEffect success path in PersonalMealDetailPage
- Added `grocery.refreshGroceries()` after `loadEventData()` in `handleKeepRecipeAnyway` in EventDetailPage
- Added `grocery.refreshGroceries()` after `loadEventData()` in `handleRetryParse` success path in EventDetailPage

### Files changed
- `src/pages/PersonalMealDetailPage.tsx`
- `src/pages/EventDetailPage.tsx`

### Quality checks
- Build: pass
- Tests: N/A
- Lint: N/A

### Learnings for future iterations
- Pattern: follow EventDetailPage handleSubmitRecipe which already calls grocery.refreshGroceries() after loadEventData() on line 476

---

## [2026-03-05 02:00] — US-003: Wire onIngredientsChange to grocery.refreshGroceries and remove forceMount

### What was implemented
- Removed `forceMount` and `data-[state=inactive]:hidden` from recipes TabsContent in RecipeDetailTabs
- Replaced `onIngredientsChange={() => {}}` with `onIngredientsChange={() => grocery.refreshGroceries()}` in EventDetailPage (~line 954)
- Replaced `onIngredientsChange={() => {}}` with `onIngredientsChange={() => grocery.refreshGroceries()}` in PersonalMealDetailPage (~line 863)
- Updated RecipeDetailTabs.test.tsx: changed forceMount test to assert recipes content is NOT in DOM after switching tabs

### Files changed
- `src/components/shared/RecipeDetailTabs.tsx`
- `src/pages/EventDetailPage.tsx`
- `src/pages/PersonalMealDetailPage.tsx`
- `tests/unit/components/shared/RecipeDetailTabs.test.tsx`

### Quality checks
- Build: pass
- Tests: N/A
- Lint: N/A

### Learnings for future iterations
- Removing forceMount means RecipeIngredientList remounts on tab switch, which will re-fetch fresh data
- Test for forceMount needed inversion: `queryByText(...).not.toBeInTheDocument()` instead of `getByText(...).toBeInTheDocument()`

---

## [2026-03-05 01:00] — US-002: Add cache invalidation to RecipeIngredientList edit/delete and pass cacheContext

### What was implemented
- Added `deleteGroceryCache(cacheContext...)` call in `handleEditItemText` in RecipeIngredientList (same pattern as handleAdd)
- Added `deleteGroceryCache(cacheContext...)` call in `handleRemoveItem` in RecipeIngredientList
- Added `cacheContext?: { type: "event" | "meal_plan"; id: string; userId: string }` to `EventRecipesTabProps`
- Added `cacheContext` to EventRecipesTab destructure and pass-through to RecipeIngredientList
- EventDetailPage passes `cacheContext={{ type: "event", id: eventId ?? "", userId: user?.id ?? "" }}` to EventRecipesTab
- PersonalMealDetailPage passes `cacheContext={{ type: "event", id: eventId ?? "", userId: user?.id ?? "" }}` to EventRecipesTab

### Files changed
- `src/components/recipes/RecipeIngredientList.tsx`
- `src/components/events/EventRecipesTab.tsx`
- `src/pages/EventDetailPage.tsx`
- `src/pages/PersonalMealDetailPage.tsx`

### Quality checks
- Build: pass
- Tests: N/A
- Lint: N/A

### Learnings for future iterations
- `eventId` from `useParams` is `string | undefined` — always use `eventId ?? ""` when passing to typed string fields
- handleEditItemText and handleRemoveItem needed `cacheContext` added to their useCallback dependency arrays

---

## [2026-03-05 00:00] — US-001: Wire hasPendingChanges and onRecombine to GroceryListSection

### What was implemented
- Added `hasPendingChanges={grocery.hasPendingChanges}` and `onRecombine={grocery.triggerRecombine}` to GroceryListSection in EventDetailPage (~line 975-976)
- Added same two props to GroceryListSection in PersonalMealDetailPage (~line 884-885)

### Files changed
- `src/pages/EventDetailPage.tsx`
- `src/pages/PersonalMealDetailPage.tsx`

### Quality checks
- Build: pass
- Tests: N/A
- Lint: N/A

### Learnings for future iterations
- Both detail pages use `grocery.hasPendingChanges` and `grocery.triggerRecombine` from `useGroceryList` hook
- The GroceryListSection block in both pages ends at the `onAddItemsToRecipe` line before the empty-state Card

---
