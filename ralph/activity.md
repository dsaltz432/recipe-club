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
- `vi.hoisted()` is required when mock variables are referenced inside `vi.mock()` factories — avoids "Cannot access before initialization" errors
- Tables added via migration but not yet in Supabase generated types need `const db = supabase as any` cast (see `userPreferences.ts` pattern)

### recipe_content table
- Columns: id, recipe_id, description, servings, prep_time, cook_time, total_time, instructions (JSONB), source_title, parsed_at, status, error_message, created_at
- instructions stored as JSONB string[] — use Array.isArray() check when reading (see useGroceryList.ts lines 189-210)
- Currently only id, recipe_id, status are fetched in RecipeHub (line ~441)

### Edge function patterns
- CORS handling at top of file
- Supabase client with service role key
- Anthropic API call with model selection from request body
- parse-recipe system prompt is lines 333-395

### cookModeColors pattern
- `src/lib/cookModeColors.ts` — `getRecipeColor(index: number): RecipeColor` wraps 8-color palette with `% length`
- Colors: purple, blue, emerald, orange, rose, teal, amber, indigo — all in `-50`/`-700`/`-200` variants
- `RecipeColor` interface exported: `{ bg: string, text: string, border: string }`

### MultiRecipeView layout pattern
- Mobile: `md:hidden` wrapper with shadcn Tabs; tab trigger color class applied inline (Tailwind purge-safe via static class strings)
- Desktop: `hidden md:grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3` side-by-side panels
- Color-coded header strip: `rounded-t-lg px-4 py-3 border-b` + color.bg + color.border
- `cn()` utility concatenates conditional color classes from `getRecipeColor`

## Current Status
**Last Updated:** 2026-03-08
**Tasks Completed:** 11
**Current Task:** US-012

### generate-cook-timeline edge function pattern
- Accepts `{ eventId, recipeIds, model? }` — recipeIds is required and non-empty
- Hash: `[...recipeIds].sort().join(",")` — deterministic, no SHA needed
- Cache check: `supabase.from("cook_mode_timelines").select("steps").eq("event_id", ...).eq("recipe_ids_hash", ...).maybeSingle()`
- Fetches recipe names from `recipes` table + instructions/times from `recipe_content` table separately
- AI prompt returns JSON array of CookModeStep objects
- JSON parsing: tries regex for ```json blocks first, falls back to raw text
- Stores with `insert` (not upsert) since UNIQUE constraint handles duplicates via cache check
- Returns `{ success: true, steps: CookModeStep[] }` on success

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

## [2026-03-08 18:45] — US-011: Create useCookMode hook

### What was implemented
- Created `src/hooks/useCookMode.ts` with `useCookMode({ eventId?, recipes })` hook
- Single recipe path: maps instructions directly to `CookModeStep[]` without calling edge function
- Multi-recipe path: checks `cook_mode_timelines` DB cache first (using sorted recipeIds hash), then calls `generate-cook-timeline` edge function on cache miss
- Skips cache check when `eventId` is undefined
- Exposes `timeline`, `loading`, `error`, `generateTimeline` states/function
- Uses `getCachedAiModel()` for model preference
- Bypasses Supabase TypeScript types for `cook_mode_timelines` using `const db = supabase as any` (table not yet in generated types)
- Created `tests/unit/hooks/useCookMode.test.ts` with 8 passing tests using `vi.hoisted()` pattern

### Files changed
- `src/hooks/useCookMode.ts` (new)
- `tests/unit/hooks/useCookMode.test.ts` (new)

### Quality checks
- Build: pass
- Tests: pass (8/8)
- Lint: N/A

### Learnings for future iterations
- `vi.hoisted()` is required when mock variables are used inside `vi.mock()` factories — avoids "Cannot access before initialization" errors
- Tables added via migration but not regenerated in Supabase types need `const db = supabase as any` cast (same pattern as `userPreferences.ts`)

---

## [2026-03-08 18:35] — US-010: Create generate-cook-timeline edge function

### What was implemented
- Created `supabase/functions/generate-cook-timeline/index.ts`
- Accepts `{ eventId, recipeIds, model? }` (model defaults to `claude-sonnet-4-6`)
- Returns 400 when recipeIds is missing or empty
- Hash = sorted recipeIds joined with comma (deterministic, no SHA needed)
- Cache check via `cook_mode_timelines` table with `event_id` + `recipe_ids_hash`
- Fetches recipe names from `recipes` table and instructions/times from `recipe_content` table
- Builds per-recipe summaries for AI prompt with instructions numbered
- Calls Anthropic API with interleaved timeline prompt; AI returns JSON array of CookModeStep
- Parses response: tries ````json` block first, falls back to raw text
- Stores result in `cook_mode_timelines` with `insert`
- Returns `{ success: true, steps: CookModeStep[] }`
- Full error handling with try/catch; all errors return JSON with CORS headers

### Files changed
- `supabase/functions/generate-cook-timeline/index.ts` (new)

### Quality checks
- Build: pass
- Tests: N/A (tests covered by US-016)
- Lint: N/A

### Learnings for future iterations
- Edge functions don't need TypeScript checking from the npm build — `npm run build` only checks `src/`
- Use `[...recipeIds].sort().join(",")` for deterministic hash without crypto
- Insert (not upsert) into cook_mode_timelines: cache check happens before insert, so duplicates won't occur
- AI response parsing: always try regex for markdown code blocks first

---

## [2026-03-08 18:20] — US-009: Create cook_mode_timelines migration and types

### What was implemented
- Created `supabase/migrations/20260308000001_create_cook_mode_timelines.sql` with `cook_mode_timelines` table
- Table columns: id (UUID PK), event_id (FK → scheduled_events ON DELETE CASCADE), recipe_ids_hash (TEXT), steps (JSONB), model (TEXT), created_at (TIMESTAMPTZ)
- UNIQUE constraint on (event_id, recipe_ids_hash)
- RLS enabled: authenticated users can SELECT, service_role can ALL
- Added `CookModeStep` and `CookModeTimeline` types to `src/types/index.ts` after RecipeContent interface
- Applied migration via `npx supabase db reset`

### Files changed
- `supabase/migrations/20260308000001_create_cook_mode_timelines.sql` (new)
- `src/types/index.ts` (modified — added CookModeStep and CookModeTimeline interfaces)

### Quality checks
- Build: pass
- Tests: N/A (no code logic changes)
- Lint: N/A

### Learnings for future iterations
- `npx supabase db push` fails when remote migration history doesn't match local — use `npx supabase db reset` for local dev instead
- CookModeStep: { recipeId, recipeName, instruction, timing?, category?: 'prep'|'active'|'passive'|'finish' }
- CookModeTimeline: { id, eventId, recipeIdsHash, steps: CookModeStep[], model?, createdAt }

---

## [2026-03-08 18:02] — US-008: Add Cook tab to RecipeDetailTabs

### What was implemented
- Added optional `cookContent?: React.ReactNode` prop to `RecipeDetailTabs`
- When `cookContent` is provided, a 4th "Cook" tab appears with `ChefHat` icon from lucide-react
- Grid adjusts dynamically: `grid-cols-3` without Cook tab, `grid-cols-4` with it (using template literal string in className)
- Added `cookModeRecipes` useMemo in both `EventDetailPage` and `PersonalMealDetailPage` that filters recipes with instructions from `recipeContentMap`
- Both pages pass `<MultiRecipeView recipes={cookModeRecipes} />` as `cookContent` when 2+ recipes have instructions
- Added 3 new tests to RecipeDetailTabs test file (Cook tab hidden without prop, shown with prop, content renders on click)

### Files changed
- `src/components/shared/RecipeDetailTabs.tsx` (modified)
- `src/pages/EventDetailPage.tsx` (modified — import MultiRecipeView, add cookModeRecipes useMemo, pass cookContent)
- `src/pages/PersonalMealDetailPage.tsx` (modified — same pattern)
- `tests/unit/components/shared/RecipeDetailTabs.test.tsx` (modified — 3 new tests)

### Quality checks
- Build: pass
- Tests: pass (8/8 RecipeDetailTabs)
- Lint: N/A

### Learnings for future iterations
- Template literal in className (`grid-cols-${...}`) works fine with Tailwind when values are known static strings — Tailwind can see `grid-cols-4` in the template literal
- Cook tab only appears for 2+ recipes with instructions — single recipe inline expansion still works via EventRecipesTab

---

## [2026-03-08 18:00] — US-007: Create color utility and MultiRecipeView component

### What was implemented
- Created `src/lib/cookModeColors.ts` with `getRecipeColor(index)` returning `{ bg, text, border }` Tailwind classes
- 8-color palette: purple, blue, emerald, orange, rose, teal, amber, indigo (wraps with modulo)
- Created `src/components/cookmode/MultiRecipeView.tsx` with responsive dual layout:
  - Mobile (`md:hidden`): shadcn Tabs, one tab per recipe, color-coded tab triggers
  - Desktop (`hidden md:grid`): CSS grid with `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`
- Each panel has a color-coded header strip using recipe's bg/text/border color classes
- Each panel renders `RecipeInstructions` with full recipe content
- Created `tests/unit/components/cookmode/MultiRecipeView.test.tsx` with 10 passing tests

### Files changed
- `src/lib/cookModeColors.ts` (new)
- `src/components/cookmode/MultiRecipeView.tsx` (new)
- `tests/unit/components/cookmode/MultiRecipeView.test.tsx` (new)

### Quality checks
- Build: pass
- Tests: pass (10/10)
- Lint: N/A

### Learnings for future iterations
- Tailwind JIT purges dynamic class strings — but since classes come from a static palette array, all classes are present at build time
- shadcn Tabs renders tab triggers in the DOM regardless of mobile/desktop CSS visibility, so `getAllByRole("tab")` works in tests
- `cn()` with `"data-[state=active]:" + color.bg` produces valid Tailwind arbitrary variant strings

---

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
