# Recipe Club Hub — Cook Mode — Activity Log

## Codebase Patterns

### From previous cleanup run (reusable patterns)
- `tests/utils.tsx` — shared mock factories and providers
- TypeScript build (`npm run build`) only type-checks `src/` not `tests/`
- Vitest does NOT type-check tests — extra/wrong props passed to components won't fail test runs
- Many UI components render duplicate buttons for mobile and desktop — always use `getAllBy*()[0]` when selecting them
- Module-level cache in `pantry.ts` persists across describe blocks — add `invalidatePantryCache()` to every nested describe's `beforeEach`
- `getCachedAiModel` from `src/lib/userPreferences.ts` must be included in mocks for any test that imports modules using it
- Use `expect.objectContaining` for edge function body assertions to avoid fragility when fields change
- Test env has `VITE_DEV_MODE=true` — mock devMode when testing production defaults

### recipe_content table
- Columns: id, recipe_id, description, servings, prep_time, cook_time, total_time, instructions (JSONB), source_title, parsed_at, status, error_message, created_at
- instructions stored as JSONB string[] — use Array.isArray() check when reading (see useGroceryList.ts lines 189-210)
- Currently only id, recipe_id, status are fetched in RecipeHub (line ~441)

### Edge function patterns
- CORS handling at top of file
- Supabase client with service role key
- Anthropic API call with model selection from request body
- parse-recipe system prompt is lines 333-395

## Current Status
**Last Updated:** 2026-03-08
**Tasks Completed:** 6
**Current Task:** US-007

### useRecipeContent hook pattern
- Hook accepts `string[]` of recipeIds, returns `{ contentMap: Map<string, RecipeContent>, loading, error }`
- Uses `recipeIds.join(",")` as useEffect dependency to avoid infinite loops with array refs
- Cancellation pattern: `let cancelled = true` + cleanup function sets it to true
- Import `RecipeContent` as `type` (verbatimModuleSyntax requires type-only imports)

### cookmode component patterns
- `src/components/cookmode/` — new directory for cook mode components
- RecipeInstructions uses `Card` + `CardContent` from shadcn, `Clock` + `Users` from lucide-react
- Metadata header uses purple-50 bg, purple-700 text, purple-500 icons
- Step numbers are purple-600 rounded-full circles (w-7 h-7)
- Empty state: `<p className="text-sm text-muted-foreground">No instructions available</p>`

### EventRecipesTab instructions pattern
- Added `recipeContentMap?: Map<string, RecipeContent>` optional prop to `EventRecipesTab`
- Added `expandedInstructions` state (Set<string>) + `toggleInstructions` function — same toggle pattern as `expandedIngredients`
- Instructions button uses `ListOrdered` icon from lucide-react
- `RecipeInstructions` rendered inline below ingredients section when expanded
- Pages reuse `groceryRecipeIds` (already computed via useMemo) as input to `useRecipeContent`

### RecipeHub content mapping pattern
- `RecipeContentRow` interface in RecipeHub.tsx includes all snake_case DB columns
- `select("*")` on recipe_content fetches all fields; map snake_case to camelCase in contentMap build loop
- Use `Array.isArray(row.instructions) ? (row.instructions as string[]) : undefined` for JSONB instructions
- Pass `content={recipeContentMap[recipe.id]}` to RecipeCard alongside existing `contentStatus` prop

---

## Session Log

## [2026-03-08 18:10] — US-006: Add instructions to SharedRecipePage

### What was implemented
- Added `recipeContent` state (`RecipeContent | null`) to `SharedRecipePage`
- Added `useEffect` to fetch recipe_content via `supabase.from("recipe_content").select("*").eq("recipe_id", recipeId).maybeSingle()`
- Maps snake_case DB columns to camelCase RecipeContent fields (including casting `status` to the union type)
- Renders `RecipeInstructions` component below the Ingredients section only when `recipeContent` is non-null
- Imported `RecipeContent` type and `RecipeInstructions` component
- Public RLS policy for `recipe_content` already existed (migration `20260307000001_allow_public_recipe_ingredients.sql`)

### Files changed
- `src/pages/SharedRecipePage.tsx` (modified)

### Quality checks
- Build: pass
- Tests: N/A (no existing tests for SharedRecipePage)
- Lint: N/A

### Learnings for future iterations
- `RecipeContent` type has required `id` and `recipeId` fields — always include when constructing the object
- `data.status` from Supabase comes back as `string`, must cast to the union type
- Public anon RLS policy for recipe_content was already added in migration `20260307000001`

---

## [2026-03-08 17:54] — US-005: Add inline instructions to RecipeCard and RecipeHub

### What was implemented
- Updated `RecipeContentRow` interface in RecipeHub.tsx to include all DB columns (description, servings, prep_time, cook_time, total_time, instructions, source_title, etc.)
- Changed `select("id, recipe_id, status")` to `select("*")` for recipe_content fetching
- Extended contentMap building to map all camelCase RecipeContent fields
- Added `content?: RecipeContent` prop to RecipeCard
- Added `instructionsExpanded` state and `ListOrdered` icon toggle button
- Renders `RecipeInstructions` component when instructions toggle is expanded
- Passed `content={recipeContentMap[recipe.id]}` from RecipeHub to RecipeCard

### Files changed
- `src/components/recipes/RecipeHub.tsx` (modified)
- `src/components/recipes/RecipeCard.tsx` (modified)

### Quality checks
- Build: pass
- Tests: pass (195/195 — RecipeHub 121, RecipeCard 74)
- Lint: N/A

### Learnings for future iterations
- Test mocks only return `{ id, recipe_id, status }` for recipe_content — adding more fields to the query doesn't break tests since mock returns what was defined
- `content` and `contentStatus` are separate props in RecipeCard — contentStatus is used for parsing state display, content for instructions

---

## [2026-03-08 17:52] — US-004: Add inline instructions to EventRecipesTab

### What was implemented
- Added `recipeContentMap?: Map<string, RecipeContent>` optional prop to `EventRecipesTab`
- Added `expandedInstructions` state (Set<string>) and `toggleInstructions` function using same toggle pattern as ingredients
- Added Instructions toggle button (ListOrdered icon) next to existing Ingredients button
- Expandable `RecipeInstructions` section renders below ingredients when toggled open
- `EventDetailPage` imports and calls `useRecipeContent(groceryRecipeIds)`, passes `recipeContentMap` to `EventRecipesTab`
- `PersonalMealDetailPage` does the same

### Files changed
- `src/components/events/EventRecipesTab.tsx` (modified)
- `src/pages/EventDetailPage.tsx` (modified)
- `src/pages/PersonalMealDetailPage.tsx` (modified)

### Quality checks
- Build: pass
- Tests: pass (50/50 EventRecipesTab tests)
- Lint: N/A

### Learnings for future iterations
- Pages already had `groceryRecipeIds` (via useMemo) — reuse it as input to `useRecipeContent`, no duplication needed
- Optional prop pattern keeps component backward-compatible; existing tests pass without changes

---

## [2026-03-08 17:49] — US-003: Create RecipeInstructions component

### What was implemented
- Created `src/components/cookmode/RecipeInstructions.tsx` with numbered instruction list
- Props: `{ instructions?, servings?, prepTime?, cookTime?, totalTime?, description? }`
- Metadata header with purple-50 background, Clock (times) + Users (servings) icons from lucide-react
- Step numbers as purple-600 circular badges for visual hierarchy
- 'No instructions available' empty state for null/empty instructions
- Created `tests/unit/components/cookmode/RecipeInstructions.test.tsx` with 7 passing tests

### Files changed
- `src/components/cookmode/RecipeInstructions.tsx` (new)
- `tests/unit/components/cookmode/RecipeInstructions.test.tsx` (new)

### Quality checks
- Build: pass
- Tests: pass (7/7)
- Lint: N/A

### Learnings for future iterations
- Write tool creates parent directories automatically when writing new files
- The `mkdir` Bash command is blocked by session security; use Write tool to create new files instead
- Invoke /frontend-design skill per notes before building UI components

---

## [2026-03-08 17:46] — US-002: Create useRecipeContent hook

### What was implemented
- Created `src/hooks/useRecipeContent.ts` with `useRecipeContent(recipeIds: string[])` hook
- Returns `{ contentMap: Map<string, RecipeContent>, loading, error }`
- Fetches from `recipe_content` table with `select('*').in('recipe_id', recipeIds)`
- Maps snake_case DB columns to camelCase RecipeContent type fields
- Handles JSONB `instructions` field with `Array.isArray()` check
- Uses cancellation pattern to avoid state updates after unmount
- Created `tests/unit/hooks/useRecipeContent.test.ts` with 6 passing tests

### Files changed
- `src/hooks/useRecipeContent.ts` (new)
- `tests/unit/hooks/useRecipeContent.test.ts` (new)

### Quality checks
- Build: pass
- Tests: pass (6/6)
- Lint: N/A

### Learnings for future iterations
- `verbatimModuleSyntax` requires `import type` for type-only imports — use `import type { RecipeContent }` not `import { RecipeContent }`
- Use `recipeIds.join(",")` as the useEffect dep array value to stabilize array identity

---

## [2026-03-08 17:45] — US-001: Enhance parse-recipe prompt for cleaner instructions

### What was implemented
- Added 3-line instruction quality guidance block to the system prompt in `parse-recipe/index.ts`
- Guidance placed after the JSON schema closing `}`, before the "Categories" section
- Covers: clarity rewriting, specific timing durations, self-contained actionable steps, splitting compound steps

### Files changed
- `supabase/functions/parse-recipe/index.ts` (lines ~354-357 — added instruction guidance paragraph)

### Quality checks
- Build: pass
- Tests: pass (48/48 parse-recipe tests)
- Lint: N/A

### Learnings for future iterations
- The Edit tool may fail when the old_string contains template literal quotes — use node -e with fs.readFileSync/writeFileSync as fallback
- Guidance belongs AFTER the JSON schema block (after the closing `}`), not inside the schema example

---
