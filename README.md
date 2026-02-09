# Recipe Club Hub

Spin the wheel, get your ingredient, and share delicious recipes with your club.

Built with React, TypeScript, Vite, and Supabase.

## Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Docker Desktop](https://docs.docker.com/desktop/) (for local development only)
- [Supabase CLI](https://supabase.com/docs/guides/cli/getting-started) (for local development only)
  ```bash
  brew install supabase/tap/supabase
  ```

## Local Development

Local dev uses Supabase's Docker stack so you never touch production data, send real emails, or create real Google Calendar events.

### First-time setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Make sure Docker Desktop is running.

3. Create your local environment file:
   ```bash
   cp .env.example .env.local
   ```

4. Start local Supabase and the dev server:
   ```bash
   npm run dev:local
   ```

5. The first time `supabase start` runs, it prints local credentials. Copy the **API URL** and **anon key** into `.env.local`:
   ```
   VITE_SUPABASE_URL=http://127.0.0.1:54321
   VITE_SUPABASE_PUBLISHABLE_KEY=<anon key from supabase start output>
   VITE_DEV_MODE=true
   ```

6. Restart the dev server (`Ctrl+C`, then `npm run dev`) to pick up the new env values.

7. Open http://localhost:5173 and sign in with one of the seeded test accounts.

### Test accounts

The seed data (`supabase/seed.sql`) creates these entries in the `allowed_users` table:

| Email | Role | Club Member |
|-------|------|-------------|
| `dev@example.com` | admin | yes |
| `member@example.com` | viewer | yes |
| `viewer@example.com` | viewer | no |

Use any of these emails with **any password** (e.g. `password`). The first login auto-creates the auth account.

### What dev mode disables

When `VITE_DEV_MODE=true`:

- **Google Calendar** -- API calls are skipped. You'll see `[DEV MODE]` messages in the browser console instead.
- **Email notifications** -- The edge function invocation is skipped entirely. If edge functions are running locally, they also gracefully skip sending when `RESEND_API_KEY` is not set.
- **Auth** -- The login page shows an email/password form instead of Google Sign-In.

### Dev scripts

| Command | What it does |
|---------|-------------|
| `npm run dev:local` | Start local Supabase + Vite dev server |
| `npm run dev` | Start Vite only (assumes Supabase is already running) |
| `npm run dev:reset` | Wipe the local database and re-run all migrations + seed |
| `npm run dev:stop` | Stop the local Supabase Docker containers |

### Resetting the database

If your local data gets into a bad state, reset it:

```bash
npm run dev:reset
```

This drops the local database, re-applies all migrations in order, and runs the seed file. You'll need to sign in again (accounts are recreated on login).

### Local Supabase dashboard

After `supabase start`, a local Studio dashboard is available at http://127.0.0.1:54323. You can use it to browse tables, run SQL, and inspect auth users.

## Production

Production uses the hosted Supabase project. No local Docker is needed.

### Environment

Production credentials are in `.env.production` (committed -- these are publishable keys, not secrets). Vite automatically loads this file during `npm run build`.

`VITE_DEV_MODE` is **not set** in production, so all features (Google Calendar, email notifications, Google Sign-In) work normally.

### Build and deploy

```bash
npm run build
```

This runs TypeScript compilation and Vite's production build. Output goes to `dist/`.

## Database Migrations

Migrations live in `supabase/migrations/` and are applied in timestamp order:

| File | Description |
|------|-------------|
| `20260117000000_baseline_schema.sql` | Full baseline schema (tables, functions, RLS policies, triggers, storage) |
| `20260118073400_recipe_event_link.sql` | Links recipes directly to events, renames contributions to notes |
| `20260118194700_ingredient_colors.sql` | Adds color column to ingredients |

### Adding a new migration

1. Create a new file in `supabase/migrations/` with a timestamp prefix:
   ```
   supabase/migrations/YYYYMMDDHHMMSS_description.sql
   ```

2. Write your DDL statements.

3. Apply it locally:
   ```bash
   npm run dev:reset
   ```

4. To push to production:
   ```bash
   supabase db push
   ```

## Testing

```bash
npm run test:run        # Run all tests once
npm run test:coverage   # Run with coverage report
npm run test            # Run in watch mode
```

All files in `src/components/events/`, `src/components/ingredients/`, `src/components/recipes/`, and `src/lib/` must have **100% test coverage**. The only exception is `src/components/wheel/IngredientWheel.tsx` (~55% is acceptable).

## Project Structure

```
src/
  components/     React components (auth, events, ingredients, recipes, ui, wheel)
  hooks/          Custom React hooks
  integrations/   Supabase client and generated types
  lib/            Utilities, constants, auth, Google Calendar
  pages/          Route-level page components
tests/
  unit/           Unit tests (mirrors src/ structure)
  integration/    Data flow tests
  utils.tsx       Mock factories
supabase/
  functions/      Deno edge functions (email notifications, reminders)
  migrations/     SQL migrations
  seed.sql        Local dev seed data
  config.toml     Local Supabase config
```
