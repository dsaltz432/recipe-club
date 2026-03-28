# Recipe Club Hub - Claude Code Instructions

## Testing

Write tests for new features and bug fixes. Focus on meaningful coverage — test user-facing behavior, not branch coverage for defensive code.

---

## Project Structure

- `src/components/` - React components (auth, events, ingredients, recipes, ui, wheel)
- `src/hooks/` - Custom React hooks
- `src/lib/` - Utilities and constants
- `src/integrations/` - Supabase client
- `tests/unit/` - Unit tests mirroring src/ structure
- `tests/integration/` - Data flow tests
- `tests/utils.tsx` - Mock factories (`createMockUser`, `createMockIngredient`, `createMockNote`, `createMockEvent`, etc.)

## Key Concepts

**Event lifecycle:** `scheduled` → `completed` (increments ingredient usedCount) or `canceled` (no count change)

**Recipe vs Notes:** Recipes are canonical definitions with `event_id` and `ingredient_id`. RecipeNotes are user-specific notes/photos linked to recipes.

**Ingredient.inBank:** Whether ingredient is currently in the wheel bank.

## Testing

- Mock Supabase: `vi.mock("@/integrations/supabase/client")`
- Mock toast: Uses `sonner` library
- Use `@tests/utils` for rendering with providers
- Use `@/` imports for source code
- Mock factories available: `createMockUser`, `createMockIngredient`, `createMockRecipe`, `createMockNote`, `createMockEvent`

## Local Development

Requires Docker Desktop running. Local Supabase provides a full Postgres + Auth + Storage + Edge Functions stack for browser testing.

| Command | Use |
|---------|-----|
| `npm run dev:local` | Start local Supabase + edge functions + Vite dev server |
| `npm run dev:reset` | Reset local DB (re-run all migrations + seed) |

- Studio UI: `http://127.0.0.1:54323` — browse/edit local DB
- Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in `.env.local` to local values (use `supabase status` to get keys).

## Browser Testing

Use Playwright headless Chromium to verify UI changes against the local dev server. Run `npx playwright test` or use `npx playwright test --headed` to watch the browser.

- **Local Mac:** Base URL is `http://localhost:5173`
- **NanoClaw container:** Base URL is `http://host.docker.internal:5173` (and `http://host.docker.internal:54321` for Supabase)

**Local test users** (seeded by `npm run dev:reset`):

| Email | Password | Role | Club Member |
|-------|----------|------|-------------|
| `member@example.com` | `test123` | viewer | yes |
| `viewer@example.com` | `test123` | viewer | no |
| `dev@example.com` | created via dev auth flow | admin | yes |

## Commands

| Command | Use |
|---------|-----|
| `npm run test:coverage` | Run tests with coverage report |
| `npm run test:run` | Run all tests once |
| `npx playwright test` | Run e2e tests (headless Chromium) |
| `npm run build` | TypeScript compilation |
| `npm run lint` | Code style check |
