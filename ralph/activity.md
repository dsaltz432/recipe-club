# Recipe Club Hub - UX & Bug Remediation - Activity Log

## Codebase Patterns

### Testing
- All tests mock `@/integrations/supabase/client` via `vi.mock("@/integrations/supabase/client")`
- Mock factories in `@tests/utils`: `createMockUser`, `createMockIngredient`, `createMockRecipe`, `createMockNote`, `createMockEvent`
- Coverage must be 100% on all files except `IngredientWheel.tsx` (~55% OK)
- Required 100% directories: events, ingredients, mealplan, recipes, lib
- Use `vi.resetModules()` + `vi.doMock()` + dynamic `import()` for auth tests

### Supabase Mocking Pattern
```typescript
const mockSupabaseFrom = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args) => mockSupabaseFrom(...args),
    functions: { invoke: vi.fn() },
    auth: { getUser: vi.fn() },
  },
}));
```

### Component Patterns
- Toast: `import { toast } from "sonner"`
- Routing: `react-router-dom` with `useNavigate`, `useParams`
- UI components from `@/components/ui/` (shadcn/ui)
- Edge functions are Deno-based in `supabase/functions/`

### Grocery Data Loading Pattern
When adding grocery list to a page, load data via: query items → extract recipe_ids → Promise.all(recipe_ingredients, recipe_content, recipes). Map DB rows to TypeScript types (snake_case → camelCase, null → undefined). Pass to GroceryListSection which handles combining, filtering, and display.

### Reusing EventRatingDialog for Meals
EventRatingDialog requires a valid `event_id` for recipe_ratings FK. When using from MealPlanPage: check if items have an `eventId`; if not, create a personal event first. Use `mode="rating"` (at least one rating required, not all). Build `EventRecipeWithNotes[]` from slot items.

### Mocking Complex Dialogs in Parent Tests
When testing a parent component that renders a complex dialog (like EventRatingDialog), mock the dialog itself rather than its internal Supabase calls. Use `vi.mock()` with a simple component that exposes `onComplete`/`onCancel` buttons.

### Unreachable Guards Kill Coverage
Defensive `if (!x) return` guards in callbacks that can only fire when `x` is truthy are unreachable and cause branch coverage gaps. Remove them or use non-null assertion (`x!`).

### Vitest Worker Config
`vitest.config.ts` uses `pool: "forks"` with `maxForks: 4` and `testTimeout: 15000` to prevent resource-contention timeouts in the 38-file test suite.

### File Upload to Storage Pattern
When uploading files to Supabase storage in a dialog:
1. Add `supabase.storage` mock alongside `supabase.from` mock
2. Mock `uuid` with `vi.mock("uuid", () => ({ v4: () => "mock-uuid-123" }))`
3. Access file input via `document.querySelector('input[type="file"]')` (hidden inputs aren't accessible by label)
4. Trigger upload with `fireEvent.change(fileInput, { target: { files: [file] } })`

### Edge Function Testing with RPC
When edge functions use `supabase.rpc()`, add `rpc` to `MockSupabaseClient` interface and implementation in `tests/helpers/edge-function-setup.ts`. Mock as `vi.fn().mockResolvedValue({ data: null, error: null })`. Override in individual tests with `mockSupabase.rpc.mockResolvedValue(...)`.

## Current Status
**Last Updated:** 2026-02-19
**Tasks Completed:** 2
**Current Task:** US-002 complete

---

## Session Log

## 2026-02-19 23:25 — US-001: Fix critical RLS security vulnerabilities

### What was implemented
- Created migration `20260219000001_fix_rls_security.sql` that fixes two critical RLS bugs:
  - **BUG-002**: Dropped the overly permissive "Allowed users can manage club events" policy (FOR ALL with no admin check). Replaced with three granular policies: INSERT, UPDATE, DELETE — all requiring `current_user_is_admin()`. The existing "Anyone can view club events" SELECT policy from migration 20260218000002 was left intact.
  - **BUG-009**: Dropped the four `USING (true)` policies on `event_grocery_cache`. Replaced with four policies that verify the user can access the referenced event (club events are accessible to all authenticated users; personal events only to their creator).

### Files changed
- `supabase/migrations/20260219000001_fix_rls_security.sql` (new)

### Quality checks
- Build: pass
- Tests: pass (998 tests, 100% coverage on all required directories)
- Lint: pass (0 errors)

### Learnings for future iterations
- `current_user_is_admin()` function already exists in baseline schema — reuse it for admin checks
- The migration chain for scheduled_events policies: baseline → 20260218000002 (dropped old, added personal) → 20260218000004 (added permissive club fix) → this migration (replaced with admin-only)
- SQL-only migrations don't affect frontend tests or build

---

## 2026-02-19 23:51 — US-002: Fix parse-recipe edge function bugs

### What was implemented
Five bugs fixed in `supabase/functions/parse-recipe/index.ts`:

- **BUG-001**: Media type detection — added `detectMediaType()` helper that maps URL extensions (.pdf, .png, .webp, .heic, .jpg, .jpeg) to correct MIME types, falls back to Content-Type header, defaults to `image/jpeg`. PDFs now use `type: "document"` instead of `type: "image"` in Anthropic API calls.
- **BUG-010**: File size validation — checks Content-Length header AND actual buffer size against 10MB limit. Returns 413 with clear error message. Also improved base64 encoding with chunked approach (32KB chunks via `String.fromCharCode(...subarray)` instead of per-byte concatenation).
- **BUG-014**: Transactional ingredient replacement — created RPC function `replace_recipe_ingredients(p_recipe_id, p_ingredients)` that atomically DELETEs old + INSERTs new ingredients in a single transaction. Edge function calls `supabase.rpc()` when ingredients are present, falls back to `supabase.from().delete()` when no ingredients.
- **BUG-015**: Early body parsing — `req.json()` wrapped in its own try-catch returning 400 for malformed bodies. `recipeId` extracted immediately after parsing so the catch block can use it directly (no more `req.clone().json()` re-parsing).
- **BUG-020**: JSON extraction validation — regex-extracted JSON is validated with `JSON.parse()`. If invalid, falls back to parsing the full response text. Both failures produce a clear error.

Also: missing fields (recipeId/recipeUrl) now return 400 instead of 500. Added .heic to the file extension regex.

### Files changed
- `supabase/functions/parse-recipe/index.ts` (rewritten with all 5 bug fixes)
- `supabase/migrations/20260219000002_replace_recipe_ingredients_rpc.sql` (new)
- `tests/unit/edge-functions/parse-recipe.test.ts` (rewritten: 43 tests, covers all new paths)
- `tests/helpers/edge-function-setup.ts` (added `rpc` to MockSupabaseClient)

### Quality checks
- Build: pass
- Tests: pass (1011 tests, 100% coverage on all required directories)
- Lint: pass (0 errors)

### Learnings for future iterations
- `supabase.rpc()` returns `{ data, error }` just like `supabase.from()` — mock as `vi.fn().mockResolvedValue()`
- Anthropic API uses `type: "document"` for PDFs, `type: "image"` for images — different content block types
- `response.headers.get("content-length")` returns null when header is absent — always check both header and actual buffer size
- The edge function `catch` block's `if (recipeId)` false branch is unreachable in practice (body parse failures return 400 before throw) — this is a defensive guard

---
