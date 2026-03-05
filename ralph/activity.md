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
**Tasks Completed:** 1
**Current Task:** US-001 complete

---

## Session Log

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
