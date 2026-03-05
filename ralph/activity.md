# Recipe Club Hub - Ingredient Editing & Shared Tabs - Activity Log

## Codebase Patterns
- **ParsedGroceryItem** is exported from `src/components/recipes/GroceryListSection.tsx` (line 16-21)
- **supabase client** imported from `@/integrations/supabase/client`
- **useCallback** with deps array is the standard pattern for hook callbacks in useGroceryList
- **npm run build** runs `tsc -b && vite build` — use this for typecheck verification
- **AddIngredientInput** at `src/components/recipes/AddIngredientInput.tsx` — reusable textarea+button; manages its own text/loading state; `onSubmit(text: string): Promise<void>`
- **GroceryListSection** `handleBulkAdd` now takes `text: string` as param (not from state); loading overlay still uses component-level `isParsing`

## Current Status
**Last Updated:** 2026-03-04
**Tasks Completed:** 7
**Current Task:** US-007 complete

- **RecipeIngredientList** at `src/components/recipes/RecipeIngredientList.tsx` — loads recipe ingredients, groups by category with GroceryCategoryGroup, inline edit/delete/add; manages its own state

---

## Session Log

## [2026-03-04] — US-007: Replace EditRecipeIngredientsDialog in EventRecipesTab with inline RecipeIngredientList

### What was implemented
- Removed `onEditIngredients` prop and `ListChecks` button from `EventRecipesTab`
- Added `userId?: string` and `onIngredientsChange?: (recipeId: string) => void` to `EventRecipesTabProps`
- Added local `expandedIngredients: Set<string>` state with `toggleIngredients` handler
- Added Ingredients toggle button (ChevronDown/Up) in each recipe card header
- When expanded, renders `<RecipeIngredientList recipeId userId editable onIngredientsChange />` with Separator
- Removed `ListChecks` import from lucide-react; added `useState` import
- Imported `RecipeIngredientList` from `@/components/recipes/RecipeIngredientList`
- In `EventDetailPage.tsx`: removed `editIngredientsRecipe` state, `EditRecipeIngredientsDialog` import and dialog JSX, `onEditIngredients` prop; added `userId` and `onIngredientsChange` to EventRecipesTab
- In `PersonalMealDetailPage.tsx`: removed `editIngredientsRecipe` state, `editIngredientsItems` state, `weekStart` state, week_start load block, `handleEditIngredientsClick`, `EditRecipeIngredientsDialog` import and dialog JSX, `onEditIngredients` prop; added `userId` and `onIngredientsChange` to EventRecipesTab; removed unused `RecipeIngredient` type import

### Files changed
- `src/components/events/EventRecipesTab.tsx`
- `src/pages/EventDetailPage.tsx`
- `src/pages/PersonalMealDetailPage.tsx`

### Quality checks
- Build: pass
- Tests: N/A
- Lint: N/A

### Learnings for future iterations
- `weekStart` state in PersonalMealDetailPage was only used for the dialog cacheContext — remove the load block too when removing the state
- EventRecipesTab is a pure display component; local state for `expandedIngredients` is appropriate here
- `onIngredientsChange` in parent pages can be a no-op `() => {}` since RecipeIngredientList owns its own data

---

## [2026-03-04] — US-006: Replace EditRecipeIngredientsDialog in RecipeCard with inline RecipeIngredientList

### What was implemented
- Removed `onEditIngredients` prop and `ListChecks` button from `RecipeCard`
- Added `userId?: string` and `onIngredientsChange?: () => void` to `RecipeCardProps`
- Replaced expanded `<div>` ingredient list with `<RecipeIngredientList recipeId userId editable onIngredientsChange />`
- Removed `GROCERY_CATEGORIES`, `CATEGORY_ORDER`, `ListChecks` imports from RecipeCard (no longer needed for rendering)
- Kept `ingredients` and `pantryItems` props for toggle visibility (`hasIngredients` check)
- In `RecipeHub.tsx`: removed `editIngredientsRecipe` state, `handleEditIngredients`, `handleIngredientsSaved`, `EditRecipeIngredientsDialog` import and JSX
- Added `handleIngredientsChange(recipeId)` in RecipeHub that reloads that recipe's `recipe_ingredients` and updates `recipeIngredientsMap`
- `RecipeCard` now receives `userId={userId}` and `onIngredientsChange={() => handleIngredientsChange(recipe.id)}`

### Files changed
- `src/components/recipes/RecipeCard.tsx`
- `src/components/recipes/RecipeHub.tsx`

### Quality checks
- Build: pass
- Tests: N/A
- Lint: N/A

### Learnings for future iterations
- `isPantryItem` and `DEFAULT_PANTRY_ITEMS` are still imported in RecipeCard because `filteredIngredients`/`hasIngredients` still uses them for toggle visibility
- The `import("@/types").GroceryCategory` inline import type works fine in function bodies in RecipeHub
- RecipeIngredientList is self-managed — parent just needs to trigger data reload via callback

---

## [2026-03-04] — US-005: Add AddIngredientInput to per-recipe grocery tabs

### What was implemented
- Added `onAddItemsToRecipe?: (recipeId: string, text: string) => Promise<void>` to `GroceryListSectionProps`
- Added `onAddItemsToRecipe` to destructured props in `GroceryListSection`
- In the per-recipe `.map()` tab block, added `{onAddItemsToRecipe && <AddIngredientInput ... />}` after the ingredient group list — only on per-recipe tabs, not Combined or General
- Wired `onAddItemsToRecipe={grocery.handleAddItemsToRecipe}` in `EventDetailPage.tsx`
- Wired `onAddItemsToRecipe={grocery.handleAddItemsToRecipe}` in `MealPlanPage.tsx`

### Files changed
- `src/components/recipes/GroceryListSection.tsx` (prop added, per-recipe tab content updated)
- `src/pages/EventDetailPage.tsx` (prop wired)
- `src/components/mealplan/MealPlanPage.tsx` (prop wired)

### Quality checks
- Build: pass
- Tests: N/A
- Lint: N/A

### Learnings for future iterations
- Per-recipe tab content is in the `.map()` block at line ~326 of GroceryListSection; Combined tab is separate at line ~294
- The conditional `{onAddItemsToRecipe && ...}` pattern correctly gates the input — not shown when prop is absent

---

## [2026-03-04] — US-004: Add handleAddItemsToRecipe to useGroceryList

### What was implemented
- Added `handleAddItemsToRecipe: (recipeId: string, text: string) => Promise<void>` to `UseGroceryListReturn` interface
- Implemented `handleAddItemsToRecipe` callback: calls `parseIngredientText`, inserts rows to `recipe_ingredients` with `sort_order` based on existing count for that recipe, updates `recipeIngredients` state with returned rows, then calls `invalidateCacheAndResetRefs()` and `startRecombineTimer()`
- Added `handleAddItemsToRecipe` to the hook's return value

### Files changed
- `src/hooks/useGroceryList.ts` (interface + implementation + return)

### Quality checks
- Build: pass
- Tests: N/A
- Lint: N/A

### Learnings for future iterations
- `invalidateCacheAndResetRefs` and `startRecombineTimer` are defined before the `handleBulkParseGroceryText` callback, so they're available for the new callback's deps array
- `recipeIngredients` state is available in scope; filtering by `recipeId` gives existing count for sort_order

---

## [2026-03-04] — US-003: Create RecipeIngredientList component

### What was implemented
- Created `src/components/recipes/RecipeIngredientList.tsx`
- Props: `recipeId`, `userId`, `editable?`, `onIngredientsChange?`, `cacheContext?`
- Loads ingredients from `recipe_ingredients` table on mount, ordered by `sort_order`
- Shows `Loader2` spinner while fetching; empty state "No ingredients yet"
- Groups ingredients by category using `groupByCategory` helper (mirrors `groupSmartByCategory` from GroceryListSection)
- Converts `RecipeIngredient[]` → `SmartGroceryItem[]` via `toSmartItem` for `GroceryCategoryGroup`
- When `editable=true`: passes `onEditItemText`/`onRemoveItem` to each group; renders `AddIngredientInput` below list
- Edit: updates `name` in `recipe_ingredients` by matched id; reloads; calls `onIngredientsChange`
- Delete: deletes row by matched id; reloads; calls `onIngredientsChange`
- Add: calls `parseIngredientText`, inserts parsed items with `sort_order`, reloads, invalidates `cacheContext` via `deleteGroceryCache`, calls `onIngredientsChange`

### Files changed
- `src/components/recipes/RecipeIngredientList.tsx` (new file)

### Quality checks
- Build: pass
- Tests: N/A (no test changes)
- Lint: N/A

### Learnings for future iterations
- `SmartGroceryItem.displayName` is required as `string` — use `ing.name` (not `undefined`)
- `groupByCategory` local helper mirrors `groupSmartByCategory` in GroceryListSection — operates on raw `RecipeIngredient[]` then maps to `SmartGroceryItem[]` per render
- `cacheContext` typed separately from `GroceryCacheContextType` to keep component self-contained; passes through to `deleteGroceryCache(type, id, userId)`

---

## [2026-03-04] — US-002: Create AddIngredientInput component

### What was implemented
- Created `src/components/recipes/AddIngredientInput.tsx` with props: `onSubmit(text): Promise<void>`, `placeholder?`, `className?`
- Component manages its own `text` and `isSubmitting` state internally
- Shows Loader2 spinner on button while submitting; disables button+textarea during submit; clears on success
- Updated `GroceryListSection.tsx` General tab to use `<AddIngredientInput onSubmit={handleBulkAdd} />` replacing the inline textarea+button block
- Changed `handleBulkAdd` signature to accept `text: string` (no longer reads from `bulkPasteText` state)
- Removed `bulkPasteText`/`setBulkPasteText` state from GroceryListSection
- Removed unused `Textarea` import from GroceryListSection
- Added `AddIngredientInput` import to GroceryListSection

### Files changed
- `src/components/recipes/AddIngredientInput.tsx` (new file)
- `src/components/recipes/GroceryListSection.tsx` (import added, handleBulkAdd refactored, inline block replaced)

### Quality checks
- Build: pass
- Tests: N/A (no test changes)
- Lint: N/A

### Learnings for future iterations
- `handleBulkAdd` still calls `setIsParsing` for the loading overlay (lines ~365-396) — the overlay remains functional
- `Textarea` was only used by the inline block, so removing it was safe after extracting to AddIngredientInput
- `isParsing` in GroceryListSection is a composite of `externalIsAdding ?? localIsParsing` — used broadly in the General tab, not just the add input

---

## [2026-03-04] — US-001: Extract parseIngredientText shared utility

### What was implemented
- Created `src/lib/parseIngredientText.ts` with `parseIngredientText(text, userId)` function
- Extracted the temp-recipe → supabase.functions.invoke('parse-recipe') → cleanup pattern verbatim from `useGroceryList.handleBulkParseGroceryText`
- Updated `useGroceryList.handleBulkParseGroceryText` to be a thin wrapper calling `parseIngredientText(text, userId)`
- Added import of `parseIngredientText` to `useGroceryList.ts`

### Files changed
- `src/lib/parseIngredientText.ts` (new file)
- `src/hooks/useGroceryList.ts` (import added, handleBulkParseGroceryText simplified)

### Quality checks
- Build: pass
- Tests: N/A (no test changes)
- Lint: N/A

### Learnings for future iterations
- `handleBulkParseGroceryText` was at lines ~598-632 in useGroceryList.ts; now at ~598-602 (thin wrapper)
- The temp-recipe pattern: insert → invoke parse-recipe → fire-and-forget delete → return parsed ingredients
- `data.skipped` check returns [] when edge function skips (dev mode without RESEND_API_KEY)

---
