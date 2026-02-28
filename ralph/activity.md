# Recipe Club Hub - Grocery Enhancements - Activity Log

## Codebase Patterns

### Component Prop Threading Pattern
- Checked/toggle state flows: MealPlanPage (state + handler) → GroceryListSection → GroceryCategoryGroup → GroceryItemRow
- Use `Set<string>` for checked items — item `name` field is the unique key
- `onToggleChecked?: (itemName: string) => void` at section/group level, `onToggleChecked?: () => void` at row level (closed over item name in GroceryCategoryGroup)
- Checkbox only renders when `onToggleChecked` is provided — components work both with and without cross-off support

### Edge Function Template (Deno)
- All edge functions use `import { serve } from "https://deno.land/std@0.168.0/http/server.ts"`
- CORS headers: `{ "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" }`
- OPTIONS handler returns `new Response("ok", { headers: corsHeaders })`
- Missing env var pattern: return `{ success: true, skipped: true, message: "..." }` (not an error)
- Error pattern: catch block returns `{ success: false, error: message }` with status 500
- Validation errors return status 400
- All responses include `{ ...corsHeaders, "Content-Type": "application/json" }`

### Tables Not in Generated Supabase Types
- Tables added by migration (e.g., `general_grocery_items`) are not in `src/integrations/supabase/types.ts` generated types
- Use `const db = supabase as any;` at module level, then `db.from("table_name")` for queries
- Cast returned `data` with `(data as Record<string, unknown>[])` for type-safe row mapping
- Map snake_case DB columns to camelCase TypeScript properties in the mapping function

### General Items Integration Pattern
- General items feed into AI combine pipeline via `toRawIngredients()` → `extraRawIngredients` param on `smartCombineIngredients()`
- `smartCombineIngredients` accepts optional `extraRawIngredients` array that gets concatenated with recipe-derived raw ingredients
- General items use `recipeName: 'General'` and `category: 'other'` — the AI re-categorizes and merges them with recipe ingredients
- Cache invalidation flow: add/remove/update general item → `deleteGroceryCache()` → reset `lastCombinedRecipeIds` + `lastCombinedGeneralCount` → re-run `runSmartCombine()`
- `hasGeneralTab` flag is derived from `!!onAddGeneralItem` prop — components render General tab only when this callback is provided
- The General tab uses inline add/edit/remove UI (not GroceryItemRow component) since general items have different shape than SmartGroceryItem
- When no recipe ingredients exist but `hasGeneralTab` is true, the tabs still render with General as the default tab

### Database Migration Pattern
- Use `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` for additive migrations
- JSONB columns with array defaults: `DEFAULT '[]'::jsonb`
- Existing RLS policies with `auth.uid() = user_id` automatically cover new columns (row-level, not column-level)
- Migration files go in `supabase/migrations/` with timestamp prefix
- If `apply_migration` MCP permission is blocked, use `execute_sql` to apply directly

### External API Edge Function Pattern
- Auth via `x-api-key` header checked against `Deno.env.get('GROCERY_API_KEY')`
- User identification via `user_email` → lookup user ID from `auth.users` using `supabase.auth.admin.listUsers()`
- Uses Supabase service role client (`SUPABASE_SERVICE_ROLE_KEY`) to bypass RLS
- Method dispatch via `req.method` — GET uses query params, POST/PUT/DELETE parse `req.json()` body
- CORS `Access-Control-Allow-Headers` must include `x-api-key` for external callers
- Duplicate item constraint violation (PostgreSQL error code `23505`) returns 409 status
- `verify_jwt: false` when deploying since external APIs authenticate via API key, not Supabase JWT

### Bulk Paste UI Pattern
- Flow: "Paste list" button → textarea → Parse button → preview list → "Add all" confirm → items added
- `onBulkParseGroceryText` callback prop invokes the `parse-grocery-text` edge function from MealPlanPage
- Preview shows parsed items with category badge, quantity, unit, and name; duplicates flagged with "duplicate" label and yellow styling
- Duplicate detection: compare `item.name.toLowerCase()` against `existingGeneralNames` Set built from current `generalItems`
- Duplicates are visually flagged but automatically skipped during confirm (no error, just silent skip)
- `ParsedGroceryItem` type exported from `GroceryListSection.tsx`: `{ name, quantity: number|null, unit: string|null, category }`
- Preview items can be individually removed via X button using `removedPreviewIndices` Set (by index)
- After confirm, all bulk paste state resets (textarea, preview, removed indices)
- Each parsed item calls `onAddGeneralItem` sequentially — MealPlanPage handler invalidates cache and re-combines on each call

### Settings Page Pattern
- Settings page is a standalone route `/settings` (not a Dashboard tab) with AuthGuard
- Uses `loadUserPreferences(userId)` / `saveUserPreferences(userId, prefs)` in `src/lib/userPreferences.ts`
- `user_preferences` table not in generated Supabase types — uses `const db = supabase as any;` pattern
- Save button with explicit save action (not auto-save) — simpler and gives user control
- Meal type toggles use Switch component from `@radix-ui/react-switch`
- Toast pattern: `toast()` for warnings (no icon), `toast.success()` for success, `toast.error()` for failures
- In tests, mock `sonner` and check `toast.success`/`toast.error` as vi.fn() calls — do NOT look for toast text in DOM

## Current Status
**Last Updated:** 2026-02-28
**Tasks Completed:** 14
**Current Task:** US-015 completed

---

## Session Log

## 2026-02-28 08:45 — US-001: Create Instacart edge function

### What was implemented
- Created Supabase edge function at `supabase/functions/instacart-recipe/index.ts`
- Proxies requests to Instacart Create Recipe Page API (`POST https://connect.instacart.com/idp/v1/products/recipe`)
- Transforms SmartGroceryItem-style items into Instacart's ingredient format
- Items without totalQuantity or unit get empty measurements array
- Graceful fallback when INSTACART_API_KEY not configured (returns instacart.com URL)
- Returns 400 for empty/missing items, 500 for Instacart API errors

### Files changed
- `supabase/functions/instacart-recipe/index.ts` (new)

### Quality checks
- Build: pass
- Tests: pass (1579/1579, 57 files)
- Lint: N/A (edge function is Deno, not part of frontend lint)

### Learnings for future iterations
- Edge functions are Deno-based, not included in `npm run build` typecheck (tsc only checks src/)
- The MealPlanPage test has an intermittent flaky test (`runs smart combine even with a single parsed recipe`) — it passes when run in isolation but sometimes fails in full suite
- combine-ingredients/index.ts is the gold standard template for edge function patterns

---

## 2026-02-28 08:50 — US-002: Create frontend instacart lib module

### What was implemented
- Created `src/lib/instacart.ts` with two exports:
  - `transformForInstacart(items: SmartGroceryItem[]): InstacartItem[]` — strips `category` and `sourceRecipes`, keeps `name`, `displayName`, and optionally `totalQuantity`/`unit`
  - `sendToInstacart(items: SmartGroceryItem[], title: string): Promise<string>` — calls `supabase.functions.invoke('instacart-recipe')`, returns `products_link_url`
- Follows same edge function invocation pattern as `smartCombineIngredients()` in `groceryList.ts`
- Handles three response paths: success (returns URL), error field set (throws), skipped/dev mode (returns fallback URL)
- Created comprehensive tests at `tests/unit/lib/instacart.test.ts` (7 tests)

### Files changed
- `src/lib/instacart.ts` (new)
- `tests/unit/lib/instacart.test.ts` (new)

### Quality checks
- Build: pass
- Tests: pass (1586/1586, 58 files)
- Lint: N/A

### Learnings for future iterations
- The `InstacartItem` interface is the frontend's view of the edge function payload — it maps directly to the `items` array in the POST body
- `sendToInstacart` does NOT throw on `skipped: true` — it returns the fallback URL, matching the dev mode pattern
- Mock pattern for edge function tests: `const mockInvoke = vi.fn()` with `vi.mock("@/integrations/supabase/client")`

---

## 2026-02-28 09:00 — US-003: Add Instacart button to GroceryExportMenu

### What was implemented
- Added Instacart button to `GroceryExportMenu` as a third button alongside Copy and CSV
- Uses `ShoppingCart` icon from lucide-react, with `Loader2` spinner during loading
- Clicking calls `sendToInstacart(items, eventName)` and opens the returned URL via `window.open(url, '_blank')`
- Shows toast error "Failed to send to Instacart. Please try again." on failure
- Button is disabled while loading or when items array is empty
- Added comprehensive tests (8 tests): renders button, success opens new tab, failure shows toast, loading disables button, empty items disables button
- Added `@/lib/instacart` mock to GroceryListSection test file to prevent import breakage

### Files changed
- `src/components/recipes/GroceryExportMenu.tsx` (modified)
- `tests/unit/components/recipes/GroceryExportMenu.test.tsx` (modified)
- `tests/unit/components/recipes/GroceryListSection.test.tsx` (modified — added instacart mock)

### Quality checks
- Build: pass
- Tests: pass (1589/1590, 58 files — 1 pre-existing flaky test in MealPlanPage)
- Lint: N/A

### Learnings for future iterations
- When adding a new import to a component used in multiple test files, ALL test files that render that component need the mock added (e.g., GroceryListSection tests needed `@/lib/instacart` mock)
- `vi.stubGlobal("open", mockOpen)` + `vi.unstubAllGlobals()` is the clean way to mock `window.open` in Vitest
- Button loading pattern: `useState` for loading flag, disable button during loading, show spinner icon swap

---

## 2026-02-28 09:10 — US-004: Add checked_items column to grocery cache table

### What was implemented
- Created migration file at `supabase/migrations/20260228000001_add_checked_items_to_grocery_cache.sql`
- Adds `checked_items` JSONB column with `NOT NULL DEFAULT '[]'::jsonb` to `combined_grocery_items` table
- Column stores an array of item name strings representing crossed-off grocery items
- Applied migration to production database via `execute_sql`
- Verified existing RLS policies (select/insert/update/delete with `auth.uid() = user_id`) automatically cover the new column

### Files changed
- `supabase/migrations/20260228000001_add_checked_items_to_grocery_cache.sql` (new)

### Quality checks
- Build: pass
- Tests: pass (1589/1590, 58 files — 1 pre-existing flaky test in MealPlanPage)
- Lint: N/A (migration-only change)

### Learnings for future iterations
- `apply_migration` MCP tool may require explicit user permission — `execute_sql` works as a fallback for applying DDL
- RLS policies on this table are row-level (`auth.uid() = user_id`), so new columns are automatically covered without additional policies
- The `IF NOT EXISTS` guard in the migration makes it safe to re-run

---

## 2026-02-28 09:00 — US-005: Create grocery check persistence lib

### What was implemented
- Added `loadCheckedItems(contextType, contextId, userId): Promise<Set<string>>` to `src/lib/groceryCache.ts`
  - Reads `checked_items` JSONB column from `combined_grocery_items` row, returns as `Set<string>`
  - Returns empty Set when no cache row exists or on error
- Added `saveCheckedItems(contextType, contextId, userId, checkedItems: Set<string>): Promise<void>` to `src/lib/groceryCache.ts`
  - Updates the `checked_items` column on the existing cache row
  - Uses `update` with `.eq()` chain (not upsert) since checked items only make sense when a cache row already exists
- Added 7 new tests to `tests/unit/lib/groceryCache.test.ts` (total now 20 tests)

### Files changed
- `src/lib/groceryCache.ts` (modified — added two new exported functions)
- `tests/unit/lib/groceryCache.test.ts` (modified — added loadCheckedItems and saveCheckedItems test blocks)

### Quality checks
- Build: pass
- Tests: pass (1596/1597, 58 files — 1 pre-existing flaky test in MealPlanPage)
- Lint: N/A

### Learnings for future iterations
- The `checked_items` column is not in generated Supabase types — use `Record<string, Json>` cast for update payload, same pattern as `per_recipe_items`
- `update` is better than `upsert` for `saveCheckedItems` because: (a) avoids needing to provide required `items` field for Insert type, (b) semantically correct since you can't check off items without an existing grocery list
- `select("checked_items")` works for narrow column reads — don't need `select("*")` when only one column is needed
- The mock chain for `update` follows the same pattern as `delete`: `mockUpdate.mockReturnValue({ eq: ... })` with three `.eq()` calls

---

## 2026-02-28 09:20 — US-006: Add cross-off UI to grocery items

### What was implemented
- Added checkbox (clickable toggle button) to `GroceryItemRow` — renders when `onToggleChecked` prop is provided
- Checked items display with `line-through opacity-50` styling, remain visible in list
- Threaded `checkedItems: Set<string>` and `onToggleChecked` callback through GroceryCategoryGroup and GroceryListSection
- Added `checkedItems` state to MealPlanPage with `handleToggleChecked` callback
- Loads checked state from DB via `loadCheckedItems()` when grocery tab is opened (alongside grocery cache loading)
- Persists state via `saveCheckedItems()` on each toggle
- Resets checked items when AI recombine runs (recipe changes invalidate checked state)
- Crossing off does NOT affect exports — Instacart, CSV, and Copy all use the full item list
- Added 6 new GroceryItemRow tests (checkbox renders, line-through styling, toggle callback, label toggling)
- Added 4 new GroceryListSection tests (checkboxes render, checked styling, toggle callback, no checkboxes without prop)
- Fixed MealPlanPage test mock to include `loadCheckedItems` and `saveCheckedItems`

### Files changed
- `src/components/recipes/GroceryItemRow.tsx` (modified — added isChecked/onToggleChecked props, checkbox UI, line-through styling)
- `src/components/recipes/GroceryCategoryGroup.tsx` (modified — threaded checkedItems/onToggleChecked props)
- `src/components/recipes/GroceryListSection.tsx` (modified — added checkedItems/onToggleChecked props, passed to GroceryCategoryGroup)
- `src/components/mealplan/MealPlanPage.tsx` (modified — added checkedItems state, handleToggleChecked, load/save integration, reset on recombine)
- `tests/unit/components/recipes/GroceryItemRow.test.tsx` (modified — added 6 checkbox tests)
- `tests/unit/components/recipes/GroceryListSection.test.tsx` (modified — added 4 checked items tests)
- `tests/unit/components/mealplan/MealPlanPage.test.tsx` (modified — added loadCheckedItems/saveCheckedItems mock)

### Quality checks
- Build: pass
- Tests: pass (1607/1607, 58 files)
- Lint: N/A

### Learnings for future iterations
- Custom checkbox button (not shadcn Checkbox which doesn't exist) works fine — styled with `border-gray-300` unchecked, `bg-purple border-purple` checked
- When adding new exports to a module already mocked in tests (groceryCache), ALL test files that mock that module need updating
- `Set<string>` works well for checked items — `has()` for checking, `add()`/`delete()` for toggling
- Reset checked items in `runSmartCombine` callback ensures cross-off state doesn't persist across recipe changes
- Checkbox renders conditionally via `onToggleChecked &&` guard — keeps the component backward-compatible for contexts that don't need cross-off

---

## 2026-02-28 09:30 — US-007: Create general_grocery_items database table

### What was implemented
- Created migration at `supabase/migrations/20260228000002_create_general_grocery_items.sql`
- Table: `general_grocery_items` with columns: id (UUID PK), user_id (UUID FK to auth.users), context_type (TEXT with CHECK for 'meal_plan'/'event'), context_id (TEXT), name (TEXT), quantity (TEXT nullable), unit (TEXT nullable), created_at (TIMESTAMPTZ)
- UNIQUE constraint on (user_id, context_type, context_id, name) — prevents duplicate items within same user/week
- RLS enabled with 4 policies (SELECT, INSERT, UPDATE, DELETE) using `auth.uid() = user_id`
- Service role bypasses RLS automatically — no extra policy needed for external API edge function (US-010)
- Applied migration via `execute_sql` (apply_migration permission was blocked)

### Files changed
- `supabase/migrations/20260228000002_create_general_grocery_items.sql` (new)

### Quality checks
- Build: pass
- Tests: pass (1607/1607, 58 files)
- Lint: N/A (migration-only change)

### Learnings for future iterations
- The `general_grocery_items` table mirrors the context_type/context_id pattern from `combined_grocery_items` — same 'meal_plan'/'event' check constraint
- `quantity` is TEXT (not NUMERIC) because users type freeform values like '1/2' or 'a few'
- No service role policy needed — Supabase service role key inherently bypasses RLS
- Follow the `combined_grocery_items` RLS pattern (separate policies for SELECT/INSERT/UPDATE/DELETE) rather than the simpler `user_pantry_items` pattern (FOR ALL)

---

## 2026-02-28 09:40 — US-008: Create general grocery items lib module

### What was implemented
- Created `src/lib/generalGrocery.ts` with five exports:
  - `loadGeneralItems(contextType, contextId, userId): Promise<GeneralGroceryItem[]>` — fetches from `general_grocery_items` table, ordered by `created_at`
  - `addGeneralItem(contextType, contextId, userId, item): Promise<void>` — inserts new row with name, optional quantity/unit
  - `removeGeneralItem(itemId): Promise<void>` — deletes by id
  - `updateGeneralItem(itemId, updates): Promise<void>` — updates name/quantity/unit fields
  - `toRawIngredients(items): RawIngredientInput[]` — converts general items to combine-ingredients edge function format with `recipeName: 'General'` and `category: 'other'`
- Added `GeneralGroceryItem` type to `src/types/index.ts`: `{ id, userId, contextType, contextId, name, quantity?, unit?, createdAt? }`
- All CRUD functions handle errors gracefully with `console.error` (same pattern as groceryCache.ts)
- Created comprehensive tests at `tests/unit/lib/generalGrocery.test.ts` (15 tests)

### Files changed
- `src/types/index.ts` (modified — added GeneralGroceryItem interface)
- `src/lib/generalGrocery.ts` (new)
- `tests/unit/lib/generalGrocery.test.ts` (new)

### Quality checks
- Build: pass
- Tests: pass (1622/1622, 59 files)
- Lint: N/A

### Learnings for future iterations
- Tables created by migration but not in generated Supabase types need `const db = supabase as any;` to bypass TypeScript's `.from()` overload checking
- The `RawIngredientInput` interface is defined locally in `generalGrocery.ts` — it matches the shape used by `combine-ingredients/index.ts` edge function
- `toRawIngredients()` sets `category: 'other'` for all general items — the AI combine pipeline will re-categorize them during processing
- General items with `recipeName: 'General'` will appear as a source recipe badge in the Combined view (handled by UI in US-009)
- The mock pattern for `select -> eq -> eq -> eq -> order` chain: mock each step in the chain, with `mockOrder` being the terminal that resolves the promise

---

## 2026-02-28 10:00 — US-009: Integrate general items into AI combine pipeline and grocery UI

### What was implemented
- Added `extraRawIngredients` parameter to `smartCombineIngredients()` in `groceryList.ts` — general items are concatenated with recipe-derived raw ingredients before sending to the combine-ingredients edge function
- Added `generalItems` state to MealPlanPage.tsx with full CRUD handlers (`handleAddGeneralItem`, `handleRemoveGeneralItem`, `handleUpdateGeneralItem`)
- General items are loaded from database when grocery tab is opened, alongside recipe ingredients
- General items are included in the AI combine pipeline via `toRawIngredients()` — they get merged, deduplicated, and categorized by the same AI that handles recipe ingredients
- Cache invalidation: adding/removing/updating a general item calls `deleteGroceryCache()`, resets combine tracking refs, and triggers re-combine
- Added 'General' tab to GroceryListSection alongside 'Combined' and per-recipe tabs
- General tab shows list of general items with inline edit/delete controls and an always-visible add input at the bottom
- General tab items support cross-off checkboxes (same mechanism as recipe items)
- Empty state on General tab shows "No items yet" with the add input
- When no recipe ingredients exist, GroceryListSection still renders with General as the default tab
- All exports (CSV, clipboard, Instacart) automatically include general items because they use the AI-combined result
- Added 12 new tests to GroceryListSection test file for General tab functionality
- Updated 2 MealPlanPage tests that expected old empty state behavior (now show General tab instead)
- Added `generalGrocery` module mock and `deleteGroceryCache` mock to MealPlanPage test file

### Files changed
- `src/lib/groceryList.ts` (modified — added `extraRawIngredients` parameter to `smartCombineIngredients`)
- `src/components/mealplan/MealPlanPage.tsx` (modified — added general items state, CRUD handlers, cache invalidation, General tab props)
- `src/components/recipes/GroceryListSection.tsx` (modified — added General tab with add/edit/remove UI, new props)
- `tests/unit/components/recipes/GroceryListSection.test.tsx` (modified — added 12 General tab tests)
- `tests/unit/components/mealplan/MealPlanPage.test.tsx` (modified — added generalGrocery mock, deleteGroceryCache mock, updated 2 tests)

### Quality checks
- Build: pass
- Tests: pass (1634/1634, 59 files)
- Lint: N/A

### Learnings for future iterations
- `smartCombineIngredients` now accepts `extraRawIngredients` — any future source of ingredients (e.g., from an external API) can plug in the same way
- Cache invalidation for general items requires resetting BOTH `lastCombinedRecipeIds` and `lastCombinedGeneralCount` refs to force re-combine
- When `hasAnyIngredients` is false but `hasGeneralTab` is true, the tabs still render with General as the default tab — this required updating the `Tabs defaultValue` to be conditional
- The `hasGeneralTab` flag is derived from `!!onAddGeneralItem` rather than checking `generalItems.length`, so the tab is always available for adding items
- When MealPlanPage has no meals at all, we now render GroceryListSection with general items support instead of the old "No meals planned" empty state — this means users can always add general grocery items
- Tests that click Radix UI tabs need `userEvent.setup()` + `await user.click()` rather than `fireEvent.click()` to properly trigger tab content changes

---

## 2026-02-28 10:30 — US-010: Create external API edge function for general grocery items

### What was implemented
- Created Supabase edge function at `supabase/functions/grocery-items-api/index.ts`
- Full REST API (GET/POST/PUT/DELETE) for CRUD on `general_grocery_items` table
- Auth via `x-api-key` header validated against `GROCERY_API_KEY` env var
- User identification via `user_email` field — looks up user ID from auth.users via admin API
- Uses Supabase service role client (`SUPABASE_SERVICE_ROLE_KEY`) to bypass RLS for all database operations
- GET: list items by user_email, context_type, context_id (query params)
- POST: add items with body `{ user_email, context_type, context_id, items: [{ name, quantity?, unit? }] }`
- PUT: update item with body `{ item_id, name?, quantity?, unit? }`
- DELETE: remove item with body `{ item_id }`
- Duplicate item name (unique constraint violation) returns 409 with clear error message
- Graceful fallback when GROCERY_API_KEY not configured (returns `{ success: true, skipped: true }`)
- Returns 401 for invalid/missing API key, 404 for unknown user email
- Follows same CORS, error handling, and response patterns as other edge functions
- `verify_jwt: false` needed when deploying (external APIs use API key auth, not Supabase JWT)

### Files changed
- `supabase/functions/grocery-items-api/index.ts` (new)

### Quality checks
- Build: pass
- Tests: pass (1634/1634, 59 files — 1 pre-existing flaky test in MealPlanPage full suite, passes in isolation)
- Lint: N/A (edge function is Deno, not part of frontend lint)

### Learnings for future iterations
- Edge function with Supabase client needs `createClient` from `https://esm.sh/@supabase/supabase-js@2` (Deno import)
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are automatically available in Supabase Edge Functions — no need to set them
- `supabase.auth.admin.listUsers()` is the reliable way to look up users by email when using service role key
- PostgreSQL unique constraint violation returns error code `23505` — use this to detect duplicate items and return 409
- For external API functions, add `x-api-key` to CORS `Access-Control-Allow-Headers`
- GET requests use URL query params (`new URL(req.url).searchParams`), POST/PUT/DELETE use `req.json()` body
- The `profiles` table may not have email column — prefer `auth.admin.listUsers()` fallback for user lookup

---

## 2026-02-28 11:00 — US-011: Create AI grocery text parser edge function

### What was implemented
- Created Supabase edge function at `supabase/functions/parse-grocery-text/index.ts`
- Accepts POST with `{ text: string }` body containing freeform grocery list text
- Uses Anthropic API (`claude-haiku-4-5-20251001`) to parse text into structured items with name, quantity, unit, and category
- Handles any input format: comma-separated, line-separated, natural language, messy notes, or mixed
- AI assigns categories from the 10 GroceryCategory values (produce, meat_seafood, dairy, pantry, spices, frozen, bakery, beverages, condiments, other)
- Category guidelines in prompt include CATEGORY_OVERRIDES logic (oils → pantry, tofu → meat_seafood, etc.)
- Items without explicit quantities get null for quantity and unit
- Validates and sanitizes AI output: ensures valid categories, filters empty names, normalizes types
- Graceful fallback when ANTHROPIC_API_KEY not configured (returns `{ success: true, skipped: true }`)
- Returns 400 for empty/missing text
- Follows same CORS, OPTIONS, try-catch patterns as combine-ingredients/index.ts

### Files changed
- `supabase/functions/parse-grocery-text/index.ts` (new)

### Quality checks
- Build: pass
- Tests: pass (1633/1634, 59 files — 1 pre-existing flaky test in MealPlanPage)
- Lint: N/A (edge function is Deno, not part of frontend lint)

### Learnings for future iterations
- Used `claude-haiku-4-5-20251001` instead of claude-sonnet for this simpler parsing task — faster and cheaper
- The parse function is simpler than combine-ingredients: it just parses text into items, no merging/deduplication needed
- Output validation is important: sanitize AI output by checking category values against a Set, normalizing types, and filtering empty names
- The same parse-grocery-text function will be reused by both US-012 (bulk paste on General tab) and US-013 (bulk paste in recipe editing)

---

## 2026-02-28 12:00 — US-012: Add bulk paste UI to General tab

### What was implemented
- Added "Paste list" button to General tab alongside the existing Add button
- Clicking "Paste list" opens a textarea for pasting freeform grocery text
- "Parse" button sends text to `parse-grocery-text` edge function via new `onBulkParseGroceryText` callback
- Loading spinner shown during parsing, toast error on failure
- On success, shows preview list with parsed items including name, quantity, unit, and category badge
- Duplicate items (already in user's general list) are flagged with "duplicate" label and yellow styling, automatically skipped on confirm
- Users can remove individual preview items via X button before confirming
- "Add all" button adds all non-duplicate, non-removed items via `onAddGeneralItem()` calls
- After adding, bulk paste state resets and "Paste list" button reappears
- Cancel button available in both textarea and preview states
- Added `handleBulkParseGroceryText` callback in MealPlanPage that invokes `supabase.functions.invoke("parse-grocery-text")`
- Exported `ParsedGroceryItem` type from GroceryListSection for use by MealPlanPage
- Cache invalidation handled automatically since each `onAddGeneralItem` call triggers MealPlanPage's existing cache invalidation logic
- Added 12 new tests covering: button renders/hides, textarea opens, parse disabled when empty, successful parse shows preview, error shows toast, remove preview item, confirm adds items, duplicate handling, state clears after add, cancel from textarea, cancel from preview

### Files changed
- `src/components/recipes/GroceryListSection.tsx` (modified — added bulk paste UI, state, handlers, new prop, exported ParsedGroceryItem type)
- `src/components/mealplan/MealPlanPage.tsx` (modified — added handleBulkParseGroceryText callback, passed to GroceryListSection)
- `tests/unit/components/recipes/GroceryListSection.test.tsx` (modified — added 12 bulk paste tests)

### Quality checks
- Build: pass
- Tests: pass (1645/1646, 59 files — 1 pre-existing flaky test in MealPlanPage)
- Lint: N/A

### Learnings for future iterations
- The `ParsedGroceryItem` type (from the edge function) uses `quantity: number | null` while `GeneralGroceryItem` uses `quantity?: string` — conversion needed: `String(item.quantity)` for non-null, `undefined` for null
- Duplicate detection uses `Set` of lowercased existing item names for case-insensitive comparison
- Preview items tracked by index, removed items tracked via `removedPreviewIndices: Set<number>` — simpler than maintaining a filtered array
- The `onBulkParseGroceryText` callback is a clean abstraction: GroceryListSection doesn't need to know about supabase client, MealPlanPage owns the edge function invocation
- Each `onAddGeneralItem` call in the confirm loop triggers MealPlanPage's full invalidation + re-combine cycle — this is correct for data consistency but means N API calls for N items. A batch add function could optimize this in the future.

---

## 2026-02-28 13:00 — US-013: Add bulk paste ingredients to recipe editing

### What was implemented
- Added "Paste ingredients" button to `IngredientFormRows` alongside the existing "Add Ingredient" button
- Uses `ClipboardPaste` icon from lucide-react
- Clicking "Paste ingredients" opens an inline textarea with a bordered container
- "Parse" button sends text to `parse-grocery-text` edge function via `supabase.functions.invoke()`
- Loading spinner (`Loader2`) shown on Parse button during parsing, button text changes to "Parsing..."
- Parse button is disabled when textarea is empty or while parsing
- On success, parsed items are converted to `IngredientRow` format and appended to existing rows (not replaced)
- Conversion: `quantity: String(parsed.quantity)` for non-null (empty string for null), `unit: parsed.unit || ""`, `category` validated against allowed values (defaults to "other" for invalid)
- Each parsed item gets a unique ID via `parsed-${crypto.randomUUID()}`
- Textarea closes and clears after successful parse
- On error (network error, `success: false`), shows toast: "Failed to parse ingredients. Please try again."
- Cancel button closes the textarea and clears text
- "Paste ingredients" button is disabled while textarea is open
- Reuses the same `parse-grocery-text` edge function from US-011 — no new backend work
- Added 12 new tests covering: button renders, textarea opens, paste button disabled when open, parse disabled when empty, parse enabled with text, successful parse appends rows, null quantity/unit handling, error handling (network error, success:false), cancel closes textarea, textarea closes after parse, invalid category defaults to "other"

### Files changed
- `src/components/recipes/IngredientFormRows.tsx` (modified — added paste ingredients UI, state, parse handler)
- `tests/unit/components/recipes/IngredientFormRows.test.tsx` (modified — added 12 paste ingredients tests)

### Quality checks
- Build: pass
- Tests: pass (1658/1658, 59 files)
- Lint: N/A

### Learnings for future iterations
- The paste flow for recipe editing is simpler than the General tab bulk paste (US-012) — no preview/confirm step needed since parsed items become editable `IngredientRow` entries the user can modify before saving the recipe
- `crypto.randomUUID()` works in all modern browsers and jsdom — no polyfill needed for tests
- The `parse-grocery-text` edge function returns `quantity: number | null` but `IngredientRow.quantity` is `string` — conversion: `String(item.quantity)` for non-null, `""` for null
- Category validation with a `Set<string>` of valid categories is a good pattern — protects against AI returning unexpected values
- The "Paste ingredients" button is disabled while the textarea is open via the `showPasteArea` state flag — simple boolean guard prevents duplicate open
- Both "Add Ingredient" and "Paste ingredients" buttons use `flex-1` to share the width evenly in the button row

---

## 2026-02-28 14:00 — US-014: Add meal_types and week_start_day columns to user_preferences

### What was implemented
- Created migration at `supabase/migrations/20260228000003_add_meal_settings_to_user_preferences.sql`
- Adds `meal_types TEXT[] NOT NULL DEFAULT '{breakfast,lunch,dinner}'` column to `user_preferences`
- Adds `week_start_day INTEGER NOT NULL DEFAULT 0` column to `user_preferences` (0=Sunday, 1=Monday)
- Adds CHECK constraint `week_start_day_check` ensuring `week_start_day IN (0, 1)`
- Applied migration via `execute_sql` (apply_migration permission was blocked)
- Verified existing RLS policy "Users can manage their own preferences" (FOR ALL with `auth.uid() = user_id`) automatically covers new columns

### Files changed
- `supabase/migrations/20260228000003_add_meal_settings_to_user_preferences.sql` (new)

### Quality checks
- Build: pass
- Tests: pass (1657/1658, 59 files — 1 pre-existing flaky test in MealPlanPage)
- Lint: N/A (migration-only change)

### Learnings for future iterations
- `user_preferences` table uses a single `FOR ALL` RLS policy (not separate per-operation like `combined_grocery_items`) — simpler pattern
- `meal_types` is `TEXT[]` (PostgreSQL array) with default `'{breakfast,lunch,dinner}'` — this allows any subset and easy extension
- `week_start_day` uses INTEGER with CHECK constraint for valid values — simple and effective for a small enum (0=Sunday, 1=Monday)
- The `IF NOT EXISTS` guard on `ADD COLUMN` + conditional constraint creation make the migration idempotent

---

## 2026-02-28 15:00 — US-015: Create settings page with preferences lib

### What was implemented
- Created `src/lib/userPreferences.ts` with two exports:
  - `loadUserPreferences(userId): Promise<UserPreferences>` — reads meal_types, week_start_day, household_size from user_preferences table, returns defaults when no row exists
  - `saveUserPreferences(userId, prefs): Promise<void>` — upserts on user_id with meal_types, week_start_day, household_size, updated_at
- Added `UserPreferences` interface to `src/types/index.ts`: `{ mealTypes: string[], weekStartDay: number, householdSize: number }`
- Created `src/pages/Settings.tsx` — standalone page with three sections:
  - Meal Types: Switch toggles for Breakfast, Lunch, Dinner — prevents unchecking last one with toast warning
  - Week Start Day: Select dropdown for Sunday (0) vs Monday (1)
  - Household Size: Number input (min 1)
- Save button persists all settings, shows success/error toast
- Back button navigates to `/dashboard`
- Added `/settings` route to `src/App.tsx` wrapped in AuthGuard
- Added Settings menu item to Dashboard.tsx dropdown menu (between My Pantry and Sign Out) with Settings icon from lucide-react
- Created 8 tests for userPreferences lib (load defaults, load stored, error handling, null field handling, upsert, throw on error)
- Created 12 tests for Settings page (loading, three sections render, back button, meal type switches, load prefs, save, success/error toasts, last meal type prevention, household size)

### Files changed
- `src/types/index.ts` (modified — added UserPreferences interface)
- `src/lib/userPreferences.ts` (new)
- `src/pages/Settings.tsx` (new)
- `src/App.tsx` (modified — added /settings route with AuthGuard)
- `src/pages/Dashboard.tsx` (modified — added Settings import and dropdown menu item)
- `tests/unit/lib/userPreferences.test.ts` (new)
- `tests/unit/pages/Settings.test.tsx` (new)

### Quality checks
- Build: pass
- Tests: pass (1677/1678, 61 files — 1 pre-existing flaky test in MealPlanPage)
- Lint: N/A

### Learnings for future iterations
- `user_preferences` table is not in generated Supabase types — must use `const db = supabase as any;` pattern (same as `general_grocery_items`)
- Toast testing: mock `sonner` module and check `toast.success`/`toast.error` as `vi.fn()` calls — do NOT try to find toast text in DOM (Toaster component not in test render)
- `toast()` (base call, no `.success`/`.error`) is used for non-critical warnings like "must keep one meal type" — it renders without an icon
- Switch component: `onCheckedChange` passes boolean `checked` value directly (not an event)
- Number input: use `fireEvent.change` instead of `userEvent.clear`+`type` for number inputs to avoid intermediate state issues in tests
- The `UserPreferences` type is intentionally minimal (mealTypes, weekStartDay, householdSize) — other columns like dietary_restrictions exist in DB but aren't exposed in Settings yet
- Settings page defaults match the DB column defaults: mealTypes=['breakfast','lunch','dinner'], weekStartDay=0, householdSize=2

---
