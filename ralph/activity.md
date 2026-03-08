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
**Tasks Completed:** 3
**Current Task:** US-004

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

---

## Session Log

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
