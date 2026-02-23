# Recipe Club Hub - Bug Fixes & Polish - Activity Log

## Codebase Patterns
<!-- Reusable patterns discovered during implementation go here -->
- All tests mock `@/integrations/supabase/client` — the real module never executes
- Coverage must be 100% on all files except `IngredientWheel.tsx` (~55% OK)
- Required 100% directories: events, ingredients, mealplan, recipes, lib
- `src/pages/` is NOT in required coverage directories
- Use `@tests/utils` for rendering with providers
- Mock factories: `createMockUser`, `createMockIngredient`, `createMockRecipe`, `createMockNote`, `createMockEvent`
- `vi.clearAllMocks()` does NOT clear `mockImplementationOnce` queues; use `mockReset()` instead
- Supabase mock pattern: `createMockQueryBuilder` with chainable `.mockReturnThis()`
- DEFAULT_PANTRY_ITEMS in src/lib/pantry.ts: ["salt", "pepper", "water"] (exported)
- Edge functions are Deno-based in supabase/functions/
- Grocery cache: combined_grocery_items table with context_type (meal_plan/event), context_id, recipe_ids for cache validation
- Google Calendar calls are in src/lib/googleCalendar.ts — currently client-side direct API calls
- Grocery useEffect pattern: use a `groceryDirtyRef` (useRef) to gate re-fetching; set dirty=true when items change (add/remove/parse); reset to false at start of useEffect execution
- Edge function storage URL detection: match on path `/storage/v1/object/public/` not hostname (local dev uses 127.0.0.1, not supabase hostname)
- MealPlanPage viewTab type: `"plan" | "groceries" | "pantry"` — three-tab structure
- EventDetailPage tabs mock: uses `<button role="tab">{children}</button>` — accessible name comes from all child text including hidden spans (JSDOM ignores CSS)
- AuthGuard.tsx uses a module-level `refreshTokenListenerRegistered` flag to prevent duplicate onAuthStateChange listeners (multiple AuthGuard instances mount per-route)
- user_tokens table type definition added to src/integrations/supabase/types.ts (migration created in US-009, types manually added)
- Edge function auth pattern: use SUPABASE_ANON_KEY + user's Authorization header to get user identity, then SUPABASE_SERVICE_ROLE_KEY to read privileged data (user_tokens)
- Google OAuth token refresh: POST to https://oauth2.googleapis.com/token with client_id, client_secret, refresh_token, grant_type=refresh_token
- google-calendar edge function supports actions: create, update, delete — all via the same endpoint
- Client-side calendar functions are thin wrappers around `supabase.functions.invoke('google-calendar', { body })` — no direct Google API calls from the client

## Current Status
**Last Updated:** 2026-02-22
**Tasks Completed:** 14
**Current Task:** US-014 complete — ALL STORIES DONE

---

## Session Log

## 2026-02-22 18:30 — US-001: Remove 'Added X to plan' toast from MealPlanPage

### What was implemented
- Removed `toast.success(`Added "${name}" to plan`)` from `addItemToPlan` in MealPlanPage.tsx (line 503)
- Updated 4 test assertions that relied on that toast as a completion signal — replaced with `mockSupabaseFrom` call checks or `waitFor` on insert mock

### Files changed
- src/components/mealplan/MealPlanPage.tsx (removed line 503)
- tests/unit/components/mealplan/MealPlanPage.test.tsx (updated 4 assertions)

### Quality checks
- Build: pass
- Tests: pass (53/53 MealPlanPage tests, 1636 total)
- Lint: pass (0 errors, 17 warnings — pre-existing)
- Coverage: 100% on all required directories

### Learnings for future iterations
- Tests often use `toast.success` as a signal for async completion — when removing a toast, need to find all tests using it as a waitFor trigger and replace with a different completion signal
- `mockSupabaseFrom` called with table name is a reliable alternative signal for "insert completed"

---

## 2026-02-22 18:35 — US-002: Capitalize pantry items in grocery exclusion message

### What was implemented
- Changed `{item.name}` to `{item.name.charAt(0).toUpperCase() + item.name.slice(1)}` in the excluded pantry items list in GroceryListSection.tsx (line 377)
- Updated test assertions to expect capitalized names ('Salt', 'Pepper' instead of 'salt', 'pepper')

### Files changed
- src/components/recipes/GroceryListSection.tsx (line 377 — capitalization transform)
- tests/unit/components/recipes/GroceryListSection.test.tsx (updated 2 tests: expand/collapse assertions)

### Quality checks
- Build: pass
- Tests: pass (41/41 GroceryListSection tests, all suites passing)
- Lint: pass (0 errors, 17 warnings — pre-existing)
- Coverage: 100% on all required directories

### Learnings for future iterations
- Simple inline string transform is sufficient for capitalization — no utility function needed
- When changing display format, search all test files for the old format string to find all assertions that need updating

---

## 2026-02-22 18:40 — US-003: RecipeCard — exclude pantry items from ingredient display

### What was implemented
- Imported `DEFAULT_PANTRY_ITEMS` from `@/lib/pantry` in RecipeCard.tsx
- Added `filteredIngredients` computed from `ingredients?.filter()` that excludes pantry items (case-insensitive)
- Updated `hasIngredients` to use `filteredIngredients` instead of `ingredients`
- Updated ingredient count display and expanded list to use `filteredIngredients`
- Updated existing test that included "Salt" as an ingredient — changed to "Garlic" since Salt is now filtered
- Added 2 new tests: one verifying pantry items are excluded from count/list, one verifying section hides when all ingredients are pantry items

### Files changed
- src/components/recipes/RecipeCard.tsx (import + filtering logic)
- tests/unit/components/recipes/RecipeCard.test.tsx (updated 1 test, added 2 tests)

### Quality checks
- Build: pass
- Tests: pass (67/67 RecipeCard tests, all suites passing)
- Lint: pass (0 errors, 17 warnings — pre-existing)
- Coverage: 100% on all required directories

### Learnings for future iterations
- When filtering ingredients, use `filteredIngredients` everywhere the original `ingredients` was referenced — count, expanded list, and category filtering all need updating
- The filter is case-insensitive via `.toLowerCase()` to handle both "Salt" and "salt" variants
- When tests reference ingredients by name that become pantry items (like "Salt"), update the test data to use non-pantry names

---

## 2026-02-22 19:00 — US-004: Remove Add Recipe button from Recipes tab

### What was implemented
- Removed the "Add Recipe" button from the personal sub-tab in RecipeHub.tsx
- Removed `showAddPersonal` state variable (dead code after button removal)
- Removed `AddPersonalRecipeDialog` import and JSX (dead code after button removal)
- Removed `Plus` from lucide-react import (dead code)
- Updated empty state message from "Add one using the button above!" to "Add recipes from events or meal plans."
- Removed 4 tests: "shows Add Recipe button in personal tab", "does not show Add Recipe button without userId", "opens add personal recipe dialog", "triggers onRecipeAdded callback"
- Updated 4 test assertions referencing old empty state text

### Files changed
- src/components/recipes/RecipeHub.tsx (removed button, state, dialog, imports)
- tests/unit/components/recipes/RecipeHub.test.tsx (removed 4 tests, updated 4 assertions)

### Quality checks
- Build: pass
- Tests: pass (RecipeHub 100% coverage, all suites passing)
- Lint: pass (0 errors, 17 warnings — pre-existing)
- Coverage: 100% on all required directories

### Learnings for future iterations
- When removing a UI element, trace all related state variables, imports, and JSX to find dead code — `showAddPersonal`, `AddPersonalRecipeDialog`, `Plus` all became dead
- Empty state messages that reference removed UI ("button above") must be updated
- `replace_all` in the Edit tool is effective for updating repeated test patterns

---

## 2026-02-22 19:15 — US-005: Block deletion of club event recipes from Recipes tab

### What was implemented
- Changed `onDelete` prop passed to RecipeCard in RecipeHub.tsx from always passing `handleDeleteRecipe` to conditionally passing `undefined` for club event recipes: `onDelete={recipe.eventId && !recipe.isPersonal ? undefined : handleDeleteRecipe}`
- Club event recipes (have eventId, isPersonal=false) no longer show a delete button
- Personal recipes (no eventId, or personal event type) still show the delete button
- No changes needed to RecipeCard.tsx — it already handles `onDelete={undefined}` correctly by hiding the delete button

### Files changed
- src/components/recipes/RecipeHub.tsx (line 731 — conditional onDelete prop)
- tests/unit/components/recipes/RecipeHub.test.tsx (updated 3 tests: "shows delete but not edit button on club tab" → "does not show edit or delete buttons on club event recipe cards", removed "deletes club recipe from club tab when not linked to meal plan" and "shows guard dialog when club recipe is linked to a meal plan", replaced with "does not show delete button on club event recipes")

### Quality checks
- Build: pass
- Tests: pass (109/109 RecipeHub tests, 67/67 RecipeCard tests, 1633 total)
- Lint: pass (0 errors, 17 warnings — pre-existing)
- Coverage: 100% on all required directories

### Learnings for future iterations
- `recipe.isPersonal` distinguishes personal meal recipes (which have eventId from personal events) from club event recipes — checking just `recipe.eventId` would break personal meal recipe deletion
- Option A approach (pass `undefined` for onDelete) is cleaner than adding guard logic in the handler — the delete button simply doesn't render
- RecipeCard didn't need changes — the conditional was entirely in RecipeHub's mapping over recipes

---

## 2026-02-22 19:30 — US-006: Fix recipe image upload URL — use production Supabase URL in parse-recipe

### What was implemented
- Updated `isStorageUrl` detection in parse-recipe edge function to also match URLs containing `/storage/v1/object/public/` path pattern (not just URLs with "supabase" in hostname)
- Local dev URLs like `http://127.0.0.1:54321/storage/v1/object/public/recipe-images/...` now correctly route through the Supabase storage client (`supabase.storage.from(bucket).download(filePath)`) instead of attempting a raw `fetch()` to localhost
- Production URLs continue to work unchanged (they match both the original and new conditions)

### Files changed
- supabase/functions/parse-recipe/index.ts (line 154-157 — expanded isStorageUrl detection)

### Quality checks
- Build: pass
- Tests: pass (1633/1633, all suites passing)
- Lint: pass (0 errors, 17 warnings — pre-existing)
- Coverage: not affected (edge functions not in required coverage directories)

### Learnings for future iterations
- Local dev Supabase URLs use `127.0.0.1:54321` or `localhost:54321` — they do NOT contain "supabase" in the hostname, so hostname-based detection misses them
- The Supabase storage path pattern `/storage/v1/object/public/` is the same across local and production — matching on path is more reliable than matching on hostname
- Edge functions run in Docker where localhost refers to the container itself, not the host machine — always use Supabase client (which uses SUPABASE_URL env var) for storage access

---

## 2026-02-22 19:00 — US-007: Grocery combining — only re-combine when recipes change, not on tab visit

### What was implemented
- Added `groceryDirtyRef` (useRef<boolean>) initialized to `true` — gates the Groceries tab useEffect so it only loads grocery data + runs smart combine when the flag is set
- The useEffect at line 300 now checks `groceryDirtyRef.current` before proceeding; if false, it returns early (no data fetching, no combining)
- `groceryDirtyRef.current` is set to `true` in 5 places:
  1. `loadPlan` → when existing plan items are loaded (covers week navigation)
  2. `loadPlan` → when a new plan is created (covers first load)
  3. `addItemToPlan` → when a meal is successfully added
  4. `doParse` → after parse completes successfully
  5. `handleParseRecipe` → after parse-from-grocery-tab completes
- The flag is reset to `false` at the start of the useEffect execution, ensuring only one load per dirty cycle
- Removed unnecessary `eslint-disable-next-line` directive that was no longer needed

### Files changed
- src/components/mealplan/MealPlanPage.tsx (added groceryDirtyRef, gated useEffect, set dirty in 5 locations, removed eslint-disable)
- tests/unit/components/mealplan/MealPlanPage.test.tsx (added 1 new test for runSmartCombine skip after non-URL meal, enhanced "skips re-combine" test to verify loadGroceryData is NOT called on second tab visit)

### Quality checks
- Build: pass
- Tests: pass (54/54 MealPlanPage tests, 1634 total)
- Lint: pass (0 errors, 17 warnings — pre-existing, down from 18 after removing unused eslint-disable)
- Coverage: 100% on all required directories

### Learnings for future iterations
- Using `useRef` instead of `useState` for the dirty flag avoids extra re-renders — the flag only needs to be read inside the useEffect, not trigger rendering
- The `loadGroceryData` callback depends on `items` state (via closure), making its reference unstable — adding it to a useEffect dependency array causes the effect to re-fire on every items change. The dirty ref pattern breaks this cycle
- When adding a dirty flag, trace ALL paths that modify the underlying data (add, remove, parse, week change, initial load) to ensure they all set dirty=true
- The `lastCombinedRecipeIds` ref in `runSmartCombine` provides a second layer of protection — even if the dirty flag triggers a reload, if the parsed recipe IDs haven't changed, the AI combine call is skipped

---

## 2026-02-22 19:05 — US-008: Standardize pantry as tab and rename 'Grocery' to 'Groceries'

### What was implemented
- Added 'Pantry' tab to MealPlanPage (3-tab structure: Meal Plan, Groceries, Pantry)
- Updated viewTab type from `"plan" | "groceries"` to `"plan" | "groceries" | "pantry"`
- Removed 'Manage Pantry' button and PantryDialog from MealPlanPage Groceries tab
- Added PantrySection component render when viewTab === 'pantry'
- Replaced PantryDialog import with PantrySection import in MealPlanPage
- Removed `showPantryDialog` state variable (dead code)
- Renamed 'Grocery' tab text to 'Groceries' in EventDetailPage (line 1266)
- Removed 'My Pantry' dropdown menu entry from Dashboard hamburger menu
- Removed PantryDialog import and `showPantryDialog` state from Dashboard.tsx
- Removed unused `UtensilsCrossed` import from Dashboard.tsx
- Updated MealPlanPage tests: replaced PantryDialog mock with PantrySection mock, updated "Manage Pantry" test to "Pantry tab" test, updated tab switching test
- Updated Dashboard tests: removed PantryDialog mock, changed 3 tests from PantryDialog assertions to "My Pantry not present" assertions
- Updated EventDetailPage tests: changed `/grocery/i` to `/groceries/i` in 3 tab role assertions

### Files changed
- src/components/mealplan/MealPlanPage.tsx (Pantry tab, remove Manage Pantry button/dialog)
- src/pages/EventDetailPage.tsx (rename Grocery → Groceries)
- src/pages/Dashboard.tsx (remove My Pantry menu, PantryDialog)
- tests/unit/components/mealplan/MealPlanPage.test.tsx (PantrySection mock, Pantry tab tests)
- tests/unit/pages/Dashboard.test.tsx (remove PantryDialog mock, update 3 tests)
- tests/unit/pages/EventDetailPage.test.tsx (update 3 tab name assertions)

### Quality checks
- Build: pass
- Tests: pass (1634/1634, 55 test files)
- Lint: pass (0 errors, 17 warnings — pre-existing)
- Coverage: 100% on all required directories

### Learnings for future iterations
- `/grocery/i` regex does NOT match "groceries" — "grocery" ends with "y" while "groceries" has "ies". Use `/groceries/i` instead
- When removing a dialog component, trace all related state (`showPantryDialog`), imports (`PantryDialog`), and icon imports (`UtensilsCrossed`) that become dead code
- EventDetailPage tabs mock renders `<button role="tab">{children}</button>` — the accessible name includes text from hidden spans because JSDOM doesn't apply CSS `display:none`
- PantrySection already exists as a standalone component (`src/components/pantry/PantrySection.tsx`) that renders PantryContent with a card wrapper — no need to create a new component

---

## 2026-02-22 19:15 — US-009: Migration — create user_tokens table for Google OAuth refresh tokens

### What was implemented
- Created migration `supabase/migrations/20260223000001_create_user_tokens.sql`
- Table schema: `id` (UUID PK), `user_id` (FK to auth.users with CASCADE delete), `provider` (TEXT, default 'google'), `refresh_token` (TEXT), `updated_at` (TIMESTAMPTZ)
- UNIQUE constraint on `(user_id, provider)` for upsert support
- RLS enabled with `FOR ALL` policy scoped to `auth.uid() = user_id`
- Service role access is implicit (Supabase service role bypasses RLS by default)

### Files changed
- supabase/migrations/20260223000001_create_user_tokens.sql (new file)

### Quality checks
- Build: pass
- Tests: pass (1634/1634, 55 test files)
- Lint: pass (0 errors, 17 warnings — pre-existing)
- Coverage: not affected (migration-only, no TypeScript changes)

### Learnings for future iterations
- Migration-only stories don't require TypeScript test changes — just verify build/test/lint still pass
- Supabase service role bypasses RLS by default — no explicit policy needed for edge function access
- The `FOR ALL` policy with both `USING` and `WITH CHECK` covers SELECT, INSERT, UPDATE, DELETE for the user's own rows
- `UNIQUE (user_id, provider)` enables `ON CONFLICT` upserts from the auth flow (US-010)

---

## 2026-02-22 19:20 — US-010: Auth flow — request offline access and store Google refresh token

### What was implemented
- Added `queryParams: { access_type: "offline", prompt: "consent" }` to signInWithOAuth options in auth.ts
- Added onAuthStateChange listener in AuthGuard.tsx that captures `provider_refresh_token` on `SIGNED_IN` events
- The listener upserts the refresh token into `user_tokens` table with `{ onConflict: "user_id,provider" }`
- Used module-level `refreshTokenListenerRegistered` flag to prevent duplicate listeners (AuthGuard mounts per-route)
- No upsert is attempted when `provider_refresh_token` is null/undefined (e.g., email login)
- Added `user_tokens` table type definition to Supabase generated types file

### Files changed
- src/lib/auth.ts (added queryParams to signInWithGoogle)
- src/components/auth/AuthGuard.tsx (added onAuthStateChange listener with refresh token capture)
- src/integrations/supabase/types.ts (added user_tokens table type definition)
- tests/unit/lib/auth.test.ts (updated signInWithGoogle test for new queryParams)
- tests/unit/components/auth/AuthGuard.test.tsx (added supabase mock, 3 new tests for refresh token capture)

### Quality checks
- Build: pass
- Tests: pass (1638/1638, 55 test files)
- Lint: pass (0 errors, 17 warnings — pre-existing)
- Coverage: 100% on all required directories

### Learnings for future iterations
- When a migration creates a new table (US-009), the Supabase generated types file must be updated manually to include the new table definition — otherwise TypeScript compilation fails with "not assignable to parameter" errors
- Module-level flags in React components prevent duplicate side effects when multiple instances mount — useful for singleton listeners like onAuthStateChange
- `prompt: 'consent'` forces Google to re-show consent screen, which is the only way to get a refresh_token after first OAuth — subsequent logins without this param don't return a refresh token
- AuthGuard tests need to mock `@/integrations/supabase/client` after adding the import — use `vi.hoisted()` for mock factories and `vi.mock()` for the module

---

## 2026-02-22 19:30 — US-011: Edge function — google-calendar for create/update/delete with token refresh

### What was implemented
- Created new edge function `supabase/functions/google-calendar/index.ts` with `deno.json`
- Accepts `{ action, calendarEventId?, date, time, ingredientName, attendeeEmails? }` request body
- Reads user's refresh_token from `user_tokens` table using JWT user ID (extracted via SUPABASE_ANON_KEY + Authorization header, then service role for token lookup)
- Exchanges refresh_token for fresh access_token via Google's `https://oauth2.googleapis.com/token` endpoint
- Supports three actions:
  - `create`: Creates calendar event with attendees, Google Meet conference, and reminders (24hr email, 1hr popup)
  - `update`: PATCH event with new date/time/title
  - `delete`: DELETE event (treats 404 as success — already deleted)
- Returns `{ success, eventId?, error? }` for all actions
- Uses GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET from env (Supabase secrets)
- Gracefully handles missing refresh token with clear error message
- Gracefully handles missing Google credentials with console.warn and error response
- verify_jwt enforced by checking Authorization header and validating user via supabase.auth.getUser()

### Files changed
- supabase/functions/google-calendar/index.ts (new — 284 lines)
- supabase/functions/google-calendar/deno.json (new — 5 lines)

### Quality checks
- Build: pass
- Tests: pass (1638/1638, 55 test files)
- Lint: pass (0 errors, 17 warnings — pre-existing)
- Coverage: not affected (edge functions not in required coverage directories)

### Learnings for future iterations
- Edge function auth pattern: create a Supabase client with ANON_KEY + forwarded Authorization header to identify the user, then a separate admin client with SERVICE_ROLE_KEY to access privileged tables
- Google OAuth token refresh endpoint returns `{ access_token, expires_in, token_type }` — only need the access_token
- For calendar events, use `America/New_York` timezone server-side (consistent with the app's user base) rather than `Intl.DateTimeFormat().resolvedOptions().timeZone` which varies by runtime
- The `conferenceDataVersion=1` query param on the Calendar API create endpoint is required to enable Google Meet link generation
- Delete returning 404 should be treated as success (event already deleted) — same pattern as the client-side implementation

---

## 2026-02-22 19:35 — US-012: Update googleCalendar.ts to call edge function instead of direct API

### What was implemented
- Rewrote `createCalendarEvent` to call `supabase.functions.invoke('google-calendar', { body: { action: 'create', ... } })` instead of direct Google Calendar API fetch
- Rewrote `updateCalendarEvent` to call edge function with `action: 'update'`
- Rewrote `deleteCalendarEvent` to call edge function with `action: 'delete'`
- Removed all `supabase.auth.getSession()` / `provider_token` checks — tokens are now managed server-side by the edge function
- Removed direct `fetch()` calls to `googleapis.com` — all Google API interaction is now through the edge function
- `getClubMemberEmails()` is still called client-side and passed to the edge function for 'create' action
- Dev mode guards (`isDevMode()`) preserved at top of each function
- Return type signatures remain unchanged: `{ success, eventId?, error? }`
- Completely rewrote test file to mock `supabase.functions.invoke` instead of `global.fetch` and `supabase.auth.getSession`
- 21 tests covering: successful calls, edge function errors, data-level errors, network errors, non-Error exceptions, dev mode guards, default time values

### Files changed
- src/lib/googleCalendar.ts (complete rewrite — 266 lines → 113 lines)
- tests/unit/lib/googleCalendar.test.ts (complete rewrite — 569 lines → 287 lines)

### Quality checks
- Build: pass
- Tests: pass (1630/1630, 55 test files)
- Lint: pass (0 errors, 17 warnings — pre-existing)
- Coverage: 100% on all required directories

### Learnings for future iterations
- When replacing direct API calls with edge function calls, the functions become dramatically simpler — all auth, token refresh, and API logic moves server-side
- The `supabase.functions.invoke` mock pattern: `const mockInvoke = vi.fn(); vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: (...args) => mockInvoke(...args) } } }))`
- Callers (EventDetailPage, IngredientWheel, RecipeClubEvents, CountdownCard) don't need any changes because the function signatures and return types are preserved
- The edge function invoke returns `{ data, error }` — check `error` first (transport-level failure), then inspect `data.success` and `data.error` for application-level results

---

## 2026-02-22 20:00 — US-013: PersonalMealDetailPage — rename 'Mark as Cooked' to 'Rate Recipes' and trigger rating flow

### What was implemented
- Renamed 'Mark as Cooked' button to 'Rate Recipes' with Star icon and purple styling
- Changed button onClick to open EventRatingDialog instead of directly marking as cooked
- Updated `handleRatingsSubmitted` to auto-mark meal as cooked after rating completes (calls supabase update on meal_plan_items.cooked_at)
- After rating + mark-cooked, UI shows green 'Cooked' badge with 'Undo' button (unchanged flow)
- Removed 'Rate Recipes' dropdown menu item from hamburger menu (was redundant with new button)
- Removed dead code: `handleRateRecipesClick` function, `handleMarkCooked` function, `DropdownMenuSeparator` import
- Button hidden when meal has no recipes (`totalRecipes > 0` guard added to existing `mealItems.length > 0` condition)
- Toast shows "Recipes rated and meal marked as cooked!" on success, falls back to "Recipes rated!" if mark-cooked fails or meal already cooked

### Files changed
- src/pages/PersonalMealDetailPage.tsx (button rename, handler changes, dead code removal)

### Quality checks
- Build: pass
- Tests: pass (1630/1630, 55 test files)
- Lint: pass (0 errors, 17 warnings — pre-existing)
- Coverage: 100% on all required directories (PersonalMealDetailPage is in src/pages/, not in required coverage directories)

### Learnings for future iterations
- When renaming a button and changing its onClick handler, trace all related code paths: the old handler (`handleMarkCooked`) becomes dead code, the dropdown menu item that served the same function becomes redundant
- `handleRatingsSubmitted` is the natural place to add post-rating side effects — it's the onComplete callback from EventRatingDialog
- The `isCooked` derived state (`mealItems.every(item => item.cooked_at)`) auto-updates when `setMealItems` updates cooked_at, triggering the UI to show the 'Cooked' badge
- Removing a DropdownMenuSeparator requires checking if its import becomes unused too

---

## 2026-02-22 20:15 — US-014: Final verification — coverage, build, lint

### What was implemented
- Ran `npm run test:coverage` — all required directories show 100% Stmts, Branch, Funcs, Lines
- IngredientWheel.tsx is the only exception at ~56.6% (acceptable)
- Ran `npm run build` — clean TypeScript compilation, no errors
- Ran `npm run lint` — 0 errors, 17 warnings (all pre-existing: coverage file warnings, React hooks dependency warnings)
- Ran `npx tsc --noEmit` — no orphaned imports or unused variables

### Coverage summary for required directories
- `src/components/events/` — 100% all metrics
- `src/components/ingredients/` — 100% all metrics
- `src/components/mealplan/` — 100% all metrics
- `src/components/recipes/` — 100% all metrics
- `src/lib/` — 100% all metrics
- `src/components/wheel/IngredientWheel.tsx` — ~56.6% (exempt)

### Files changed
- No source files changed (verification-only story)

### Quality checks
- Build: pass
- Tests: pass (1630/1630, 55 test files)
- Lint: pass (0 errors, 17 warnings — pre-existing)
- Coverage: 100% on all required directories

### Learnings for future iterations
- The 17 lint warnings are all pre-existing: 6 from coverage report HTML files (unused eslint-disable), 5 from React hooks dependency arrays in UserManagement.tsx and RecipeHub.tsx, 6 from coverage js files
- All 14 user stories in this PRD branch are now complete and passing

---
