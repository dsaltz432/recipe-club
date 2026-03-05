# Recipe Club Hub - Ingredient Editing & Shared Tabs - Activity Log

## Codebase Patterns
- **ParsedGroceryItem** is exported from `src/components/recipes/GroceryListSection.tsx` (line 16-21)
- **supabase client** imported from `@/integrations/supabase/client`
- **useCallback** with deps array is the standard pattern for hook callbacks in useGroceryList
- **npm run build** runs `tsc -b && vite build` — use this for typecheck verification

## Current Status
**Last Updated:** 2026-03-04
**Tasks Completed:** 1
**Current Task:** US-001 complete

---

## Session Log

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
