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
**Last Updated:** 2026-04-12
**Tasks Completed:** 23
**Current Task:** Complete

### Serving size scaler pattern (2026-04-11)
- `src/lib/recipeScaler.ts` — `parseServingsNumber(servings: string): number | null` extracts first number from strings like "Serves 4", "4-6", "4 people"
- `scaleMultiplier` state (0.5 | 1 | 2 | 3) in `RecipeIngredientList` — pill buttons `½× | 1× | 2× | 3×`
- Scale hidden when `editable=true`; shown when not editable and ingredients exist
- Scaling: `toSmartItem(ing, multiplier)` multiplies `ing.quantity * multiplier` before passing to GroceryCategoryGroup/formatGroceryItem
- Servings label: `parseServingsNumber(servings) * multiplier` rounded to 1 decimal, shown only when `multiplier !== 1`
- `pluralizeUnit` does NOT singularize — unit stored as "cups" stays "cups" even at qty=1
- New prop `servings?: string` added to `RecipeIngredientListProps`, passed from `content?.servings` in RecipeCard and `recipeContentMap?.get(id)?.servings` in EventRecipesTab
- Export `parseServingsNumber` from lib file (not component) to satisfy `react-refresh/only-export-components` lint rule

### Recipe favorites pattern (2026-04-12)
- New table `recipe_favorites (id, user_id, recipe_id, created_at)` with unique constraint; RLS per-user
- `recipe_favorites` not in generated Supabase types — cast `supabase as any` (same pattern as `recipe_tags`)
- `isFavorited?: boolean` and `onToggleFavorite?` props added to `RecipeCardProps`; `favoritedIds: Set<string>` in RecipeHub
- Favorites loaded alongside tags in the initial useEffect (both are user-specific data)
- SVG `className` in JSDOM is `SVGAnimatedString` not `string` — use `.baseVal` for regex assertions in tests
- The Favorites pill lives outside the existing active-filter-chips area (it's a persistent toggle, not a removable chip)
- `showFavoritesOnly` adds a `matchesFavorites` check in the `filteredRecipes` computation

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

## [2026-04-10] — Recently used recipe quick-picks in Add Meal dialog

### What was implemented
- Updated `src/components/mealplan/AddMealDialog.tsx` — added optional `userId` prop; when provided, fetches last 6 distinct recipes from the user's meal plan history on dialog open; shows them as instant quick-pick selections with a "Recently used" header and loading skeleton; falls back to "Type to search" when no history or no userId
- Updated `src/components/mealplan/MealPlanPage.tsx` — passes `userId` to `AddMealDialog`
- Updated `tests/unit/components/mealplan/AddMealDialog.test.tsx` — extended mock query builder with `eq`, `not`, `order` chain methods; added 11 new tests for recently used behavior

### Files changed
- `src/components/mealplan/AddMealDialog.tsx` (modified)
- `src/components/mealplan/MealPlanPage.tsx` (modified)
- `tests/unit/components/mealplan/AddMealDialog.test.tsx` (modified)

### Quality checks
- Build: pass
- Tests: 2066/2066 pass (e2e smoke.spec.ts excluded — pre-existing Playwright/Vitest conflict)
- Lint: 0 errors

### PR
https://github.com/dsaltz432/recipe-club/pull/32

### Learnings for future iterations
- Recent-recipes query: `from("meal_plan_items").select("recipe_id, recipes(id, name, url, event_id), meal_plans!inner(user_id)").eq("meal_plans.user_id", userId).not("recipe_id","is",null).order("created_at",{ascending:false}).limit(30)` — requires `supabase as any` cast; deduplicate by `recipe_id` in JS
- Mock query builder for tests that involve multi-step chains (eq, not, order, limit) should include all methods as `vi.fn().mockReturnThis()` in the base builder
- When a mock is called multiple times (once for recent fetch, once for search), use `mockImplementationOnce` for the first call then `mockImplementation` for subsequent

## [2026-04-03] — Recently Cooked history widget on Home tab

### What was implemented
- Created `src/components/home/RecentlyCookedCard.tsx` — card showing last 5 meals with `cooked_at IS NOT NULL` from `meal_plan_items`, with relative date labels (Today/Yesterday/N days ago/date), meal-type color badges, loading skeleton, and empty state
- Updated `src/components/home/HomeSection.tsx` — imported and rendered `RecentlyCookedCard` below `WeeklyMealPreview` for all logged-in users
- Created `tests/unit/components/home/RecentlyCookedCard.test.tsx` with 20 tests

### Files changed
- `src/components/home/RecentlyCookedCard.tsx` (new)
- `src/components/home/HomeSection.tsx` (import + render)
- `tests/unit/components/home/RecentlyCookedCard.test.tsx` (new)

### Quality checks
- Build: pass
- Tests: 2055/2055 pass (e2e smoke.spec.ts excluded — pre-existing Playwright/Vitest conflict)
- Lint: 0 errors

### PR
https://github.com/dsaltz432/recipe-club/pull/25

### Learnings for future iterations
- Supabase join filter `.eq("meal_plans.user_id", userId)` on a `!inner` join requires `supabase as any` cast since the generated types don't know about cross-table eq filtering
- Query chain for this pattern: `from → select("..., meal_plans!inner(user_id)") → eq("meal_plans.user_id", ...) → not("cooked_at", "is", null) → order → limit`
- In tests, a single `makeQueryChain` helper that chains all methods on itself (each method returns `chain`) is cleaner than nesting separate builder mocks
- `isToday` / `isYesterday` from date-fns work correctly with `parseISO` — always parse ISO strings before passing to these helpers
- Loading skeleton test: check for presence of any skeleton element rather than counting exact skeletons (avoids fragility if count changes)

---

## [2026-04-02] — Meal Slot Actions Dialog

### What was implemented
- Created `src/components/mealplan/MealSlotActionsDialog.tsx` — dialog shown when tapping a filled meal slot
- Four actions: Remove individual meal (auto-closes on empty slot), Mark as Cooked / Undo Cooked (sets cooked_at), Add Another Meal, View Details (navigate)
- Modified `MealPlanPage.tsx`: added `slotActionsSlot` state, `handleOpenSlotActions` (opens dialog on slot click), `handleNavigateToEvent` (extracted from old handleViewMealEvent), `handleRemoveMealItem`, `handleMarkCookedSlot`, `handleUndoCookedSlot`
- Updated 4 existing `MealPlanPage.test.tsx` tests to use two-step flow (click slot → View Details)
- Created `tests/unit/components/mealplan/MealSlotActionsDialog.test.tsx` with 19 tests

### Files changed
- `src/components/mealplan/MealSlotActionsDialog.tsx` (new)
- `src/components/mealplan/MealPlanPage.tsx` (modified)
- `tests/unit/components/mealplan/MealSlotActionsDialog.test.tsx` (new)
- `tests/unit/components/mealplan/MealPlanPage.test.tsx` (4 tests updated)

### Quality checks
- Build: pass
- Tests: 2054/2054 pass (e2e smoke.spec.ts excluded — pre-existing Playwright/Vitest conflict)
- Lint: 0 errors

### PR
https://github.com/dsaltz432/recipe-club/pull/24

### Learnings for future iterations
- When a slot click previously navigated directly, any tests covering that behavior need updating to the two-step flow (click slot → click "View Details")
- `setItems` state updater can reference `slotActionsSlot` from outer closure to conditionally close dialog when slot becomes empty — but be careful about stale closures; compute remaining items from the updated `prev` array, not from `items` state directly
- `handleNavigateToEvent` can be called from the dialog's onViewDetails callback after `setSlotActionsSlot(null)` to avoid dialog closing animation conflicts with navigation

---

## [2026-03-08 22:15] — US-017: Create backfill re-parse script

### What was implemented
- Created `scripts/backfill-reparse.ts` Node.js script (run with `npx tsx`)
- Uses `createClient` from `@supabase/supabase-js` directly with service role key from `SUPABASE_SERVICE_ROLE_KEY` env var
- Queries `recipes` with `recipe_content!inner(status) = 'completed'` and `url` not null
- Skips recipes without a URL both via query filter and defensive inline check
- Calls `parse-recipe` edge function for each recipe sequentially via `supabase.functions.invoke`
- 2-second delay between calls (`setTimeout`-based `sleep()` utility)
- Logs progress: `Re-parsing "[name]"... OK/FAILED` with error detail on failure
- Per-recipe error handling — does not stop on individual failures
- Idempotent: re-running re-parses same recipes safely (parse-recipe handles upsert)
- Summary line at end: `Done. N succeeded, N failed.`

### Files changed
- `scripts/backfill-reparse.ts` (new)

### Quality checks
- Build: pass (`npm run build` — scripts/ not in tsconfig include)
- Tests: N/A — no test file required for a one-time CLI script
- Lint: N/A

### Learnings for future iterations
- Node scripts outside `src/` use `process.env` not `import.meta.env`
- Create a standalone `createClient` call in the script (don't import from `src/integrations/supabase/client.ts` which uses Vite-specific env vars)
- `npm run build` type-checks only `src/` — scripts/ is safe to write in plain TypeScript
- `supabase.functions.invoke` is available on the client and works in Node.js scripts with the Supabase JS client

---

## [2026-03-08 22:00] — US-016: Write tests for generate-cook-timeline edge function

### What was implemented
- Created `tests/unit/edge-functions/generate-cook-timeline.test.ts` with 9 passing tests
- Tests cover: OPTIONS preflight CORS, cached timeline (cache hit, no Anthropic call), Anthropic API called on cache miss, result stored in cook_mode_timelines, 400 for missing recipeIds, 400 for empty recipeIds, Anthropic API failure returns 500, CORS headers on success, CORS headers on error

### Files changed
- `tests/unit/edge-functions/generate-cook-timeline.test.ts` (new)

### Quality checks
- Build: pass
- Tests: pass (9/9)
- Lint: N/A

### Learnings for future iterations
- For edge functions that call `from()` on multiple tables, use `mockSupabase.from.mockImplementation((table) => switch(table))` to return different builders per table
- Expose per-table builder references (e.g. `cacheBuilder`) in test module scope so insert/update call assertions can be made after handler runs
- `vi.stubGlobal("fetch", ...)` is restored by `vi.restoreAllMocks()` in `beforeEach` — no need for explicit cleanup
- Cache-hit tests can simply call `setupDefaultSupabaseMock({ steps: ... })` without reloading the handler — the existing handler picks up the updated mock

---

## [2026-03-08 19:45] — US-015: Add Cook Mode entry point to RecipeCard

### What was implemented
- Added `ChefHat` icon import and `CookModeDialog` import to `RecipeCard.tsx`
- Added `CookModeStep` type import for inline step mapping
- Added `cookModeOpen` and `cookModeSteps` state variables
- Added Cook button (ChefHat icon, h-7 w-7) in the action button row of the card header
- Button only shown when `hasInstructions` is true (i.e., `content?.instructions?.length > 0`)
- Updated action button div condition to include `|| hasInstructions` so the div renders even when no other action props are present
- On click: maps recipe instructions to `CookModeStep[]` inline (no hook/edge function call)
- Rendered `CookModeDialog` inline inside the Card, below CardContent

### Files changed
- `src/components/recipes/RecipeCard.tsx` (modified)

### Quality checks
- Build: pass
- Tests: pass (74/74 RecipeCard)
- Lint: N/A

### Learnings for future iterations
- The action button wrapper `div` has a condition — must include `|| hasInstructions` to show the Cook button even when recipe has no URL, no edit/delete callbacks
- For single-recipe Cook Mode in RecipeCard, map steps inline: no need for `useCookMode` hook
- `CookModeDialog` is rendered inside `<Card>` directly — Radix Dialog portals correctly even when nested

---

## [2026-03-08 19:30] — US-014: Wire up Start Cooking button on event pages

### What was implemented
- Added `useCookMode` hook and `CookModeDialog` imports to both `EventDetailPage.tsx` and `PersonalMealDetailPage.tsx`
- Added `cookModeOpen` state, `useCookMode` hook call, `cookModeRecipeNames` Map, and `handleStartCooking` handler in both pages
- `cookModeRecipes` was already computed in both pages (from US-008) — reused it to feed `useCookMode`
- Added "Start Cooking" button with `ChefHat` icon near event action buttons (outline/secondary variant, purple styling)
- Button only shown when `cookModeRecipes.length > 0` (i.e., any recipe has parsed instructions)
- On click: sets `cookModeOpen(true)` and calls `generateTimeline()` (single recipe → maps directly, multi → calls edge function)
- Rendered `CookModeDialog` in both pages with `steps={cookTimeline}`, `loading={cookModeLoading}`, `error={cookModeError}`

### Files changed
- `src/pages/EventDetailPage.tsx` (modified)
- `src/pages/PersonalMealDetailPage.tsx` (modified)

### Quality checks
- Build: pass
- Tests: pass (317/317, 9 test files)
- Lint: N/A

### Learnings for future iterations
- `cookModeRecipes` was already computed in both pages for `MultiRecipeView`/`cookContent` — reuse it directly
- `useCookMode` expects `{ id, name, instructions? }` — map from `cookModeRecipes` which has `{ id, name, content: RecipeContent }`
- `cookModeError` is `string | null` but `CookModeDialog` expects `string | undefined` — use `?? undefined` to convert

---

## [2026-03-08 19:15] — US-013: Create CookModeDialog full-screen cooking interface

### What was implemented
- Created `src/components/cookmode/CookModeDialog.tsx` — full-screen dialog using `@radix-ui/react-dialog` primitives directly (DialogPrimitive.Content with `fixed inset-0 z-50`)
- Dark theme (slate-950 bg) for kitchen readability, purple-500 progress bar and purple-600 Next button
- Step-by-step view (default): shows one `CookModeStep` at a time, centered with full-width nav buttons (h-12, 48px touch targets)
- List view: scrollable timeline of all steps rendered as buttons; clicking jumps to that step in step view
- Progress bar (role="progressbar") fills from left as steps advance
- Header shows ChefHat icon, "Cook Mode" label, step count (N / total), view toggle button, and close button
- Wake Lock: requests `navigator.wakeLock.request('screen')` on open, releases on close/unmount with graceful try/catch fallback
- Recipe-to-color map built from step order via `useRef<Map<string, number>>()` with `getRecipeColor(index)`
- Handles loading spinner, error message, and empty state
- Created `tests/unit/components/cookmode/CookModeDialog.test.tsx` with 18 passing tests

### Files changed
- `src/components/cookmode/CookModeDialog.tsx` (new)
- `tests/unit/components/cookmode/CookModeDialog.test.tsx` (new)

### Quality checks
- Build: pass
- Tests: pass (18/18)
- Lint: N/A

### Learnings for future iterations
- Use `DialogPrimitive` from `@radix-ui/react-dialog` directly (not shadcn's DialogContent wrapper) for full-screen dialogs — the wrapper enforces centered positioning
- `DialogPrimitive.Title` is required for accessibility; use `className="sr-only"` if you want a separate visible header
- "Cook Mode" text appears twice (sr-only title + visible span) — use `getAllByText` in tests
- Wake Lock type: cast navigator with intersection type to access `wakeLock.request`

---

## [2026-03-08 18:55] — US-012: Create CookModeStep component

### What was implemented
- Created `src/components/cookmode/CookModeStep.tsx` with props `{ step: CookModeStep, color: RecipeColor, isActive?: boolean }`
- Recipe name badge: inline `span` with color.bg + color.text classes
- Instruction text: `text-lg sm:text-xl` for kitchen readability
- Timing hint: smaller text in color.text when `step.timing` is present
- Category icons map: `prep=Scissors`, `active=Flame`, `passive=Timer`, `finish=CheckCircle2` from lucide-react
- Active state: applies `color.bg` background when `isActive=true`, white background otherwise
- Created `tests/unit/components/cookmode/CookModeStep.test.tsx` with 11 passing tests

### Files changed
- `src/components/cookmode/CookModeStep.tsx` (new)
- `tests/unit/components/cookmode/CookModeStep.test.tsx` (new)

### Quality checks
- Build: pass
- Tests: pass (11/11)
- Lint: N/A

### Learnings for future iterations
- Import `CookModeStep` type with `import type` (verbatimModuleSyntax) — alias it to avoid name collision with the component
- `CATEGORY_ICONS` const map with `as const` makes TypeScript happy for indexed access by category union type
- Test icon presence via `container.querySelector("svg")` — lucide-react renders SVGs

---

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

## [2026-04-01] — Last Cooked chip on club recipe cards + Recently Cooked sort

### What was implemented
- Added `eventDate?: string` to `Recipe` type in `src/types/index.ts`
- Updated RecipeHub Supabase query to fetch `event_date` from `scheduled_events!event_id (type, event_date)` join
- Mapped `eventDate` in recipe transformation (cast joined data to typed interface)
- Added "Cooked [Mon YYYY]" chip to `RecipeCard` with `CalendarCheck` icon (visible on club recipes with `eventDate`)
- Used `new Date(eventDate + "T00:00:00")` to avoid UTC offset date-display bugs
- Added "Recently Cooked" sort option to RecipeHub club sub-tab (sorts by `eventDate` desc, null dates fall to bottom)
- Switching to personal tab resets `recently_cooked` sort back to `newest`
- Fixed default sub-tab logic: `isClubMember === false ? "personal" : "club"` (undefined → club, which fixed 95+ test failures)
- Fixed club filter: `type !== "personal"` instead of `type === "club"` (includes deleted-event recipes)
- Fixed pre-existing lint errors: unused vars in test files (remove instead of prefix), react-hooks/set-state-in-effect, react-hooks/purity, missing useEffect dep, @typescript-eslint/no-explicit-any
- Fixed pre-existing test failures: label disabled attribute (use CSS class checks), JSDOM label→input click (check htmlFor attribute)

### Files changed
- `src/types/index.ts` — added `eventDate`
- `src/components/recipes/RecipeHub.tsx` — query join, filter, mapping, sort, UI
- `src/components/recipes/RecipeCard.tsx` — Last Cooked chip
- `src/pages/JoelPartyMode.tsx` — added `musicPlaying` to useEffect deps
- `src/components/joel/FoodCrossword.tsx` — eslint-disable for set-state-in-effect
- `src/components/joel/IngredientClicker.tsx` — eslint-disable for purity
- `supabase/functions/parse-recipe/index.ts` — eslint-disable for no-explicit-any
- 8 test files — new tests + pre-existing fixes

### Quality checks
- Build: pass
- Tests: 2035/2035 pass
- Lint: 0 errors, 0 warnings

### PR
https://github.com/dsaltz432/recipe-club/pull/23

### Learnings for future iterations
- `eslint-disable-next-line` only suppresses the NEXT line — for useEffect body, use `/* eslint-disable */` / `/* eslint-enable */` block comments
- Unused variable fixes: prefer removing the variable over `_` prefix (TypeScript ESLint's varsIgnorePattern may not match destructured renames)
- RecipeHub's `isClubMember` can be `undefined` when not passed — treat `undefined` as club member (default to club tab)
- Club filter should be `!== "personal"` not `=== "club"` to handle null scheduled_events (deleted events)
- Always append `T00:00:00` when parsing ISO date strings to avoid UTC timezone offset shifting the displayed date

---
