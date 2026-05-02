# AnyList Integration — Feature Plan

## Context

Recipe Club generates aggregated grocery lists for Meals, Personal Events, and Club Events. Users want a one-click handoff to Instacart for fulfillment. We previously explored:

- **Direct Instacart Developer Platform** — application submitted, no response after a month. Removed.
- **Claude.ai Instacart connector handoff** — built and working, but does not have access to the user's Instacart purchase history (verified manually). Loses the "pick the same lettuce as last time" personalization. Removed.

We're now using **AnyList** as the intermediary. AnyList is a personal grocery-list app the user already uses, with its own native Instacart integration that knows the user's preferred products and store. The unofficial reverse-engineered [`anylist` npm package](https://github.com/codetheweb/anylist) is the integration surface.

**Why this approach is acceptable for this project:**
- Personal/family-scale project — only two users will use this feature.
- Both users share one AnyList account → one set of credentials, no per-user OAuth needed.
- The "shop" surface (Instacart with personalized product picks) is owned by AnyList; we just push items in.

## Goals

1. Allowlisted "Send to AnyList" button on the grocery list export menu, visible **only** to `dsaltz190@gmail.com` and `sarahgsaltz@gmail.com`. All other users see no button at all.
2. Click syncs current grocery list to a configured AnyList list using shared credentials stored as **Vercel environment variables** (server-side only — credentials never leave the function).
3. After a successful sync, attempt to deep-link into the AnyList app via `anylist://`.
4. Removed both prior approaches (direct Instacart, Claude handoff).

## Architecture

```
[GroceryExportMenu (client)]
        │
        │  POST /api/anylist-sync     (only invoked for allowlisted emails)
        │  Authorization: Bearer <Supabase access token>
        ▼
[Vercel Serverless Function: api/anylist-sync.ts (Node)]
        │  1. Verifies Supabase JWT via supabase.auth.getUser(token)
        │  2. Re-checks allowlist server-side (defense in depth)
        │  3. Reads ANYLIST_EMAIL / ANYLIST_PASSWORD / ANYLIST_TARGET_LIST from process.env
        │  4. Uses `anylist` npm package to log in and addItem(...)
        ▼
[AnyList servers]   ←  items appear in user's AnyList app within seconds
        ▲
[Client opens anylist:// deep link]
```

**Why Vercel Serverless (Node), not Supabase Edge (Deno):** The `anylist` package depends on Node-only HTTP behavior (`got`, `ws`, `protobufjs`). Supabase Edge runs on Deno's npm-compat layer; we verified locally that the package loads but **hangs at the login HTTP call** in that runtime. Vercel Functions are real Node, so the package works exactly as it does in the standalone test script.

**Why server-side at all:** The reverse-engineered API requires the AnyList account email + password. Browser-shipped JS would expose them. The function reads them from Vercel env vars — never reach the client.

## Key risks (residual after spike)

1. ~~Deno / npm compatibility of `anylist`~~ — confirmed broken; switched to Vercel Node Functions.

2. **Reverse-engineered API drift.** AnyList can change their internal API at any time and break the package. **Mitigation:** non-blocking — the button fails gracefully with a toast, and the rest of the app keeps working. Keep the integration narrow (only `addItem`).

3. **AnyList URL scheme is undocumented.** The deep-link target (`anylist://`) is not officially published. **Mitigation:** best-effort — if the scheme isn't registered, the browser does nothing and the user opens the app manually. Items already landed regardless.

4. **Shared account model.** Both allowed users push into the same AnyList list. If they hit the button at the same time, items pile up — fine for two-person family use, would not scale.

5. **Vercel cold start + execution time.** Login takes ~1–2s, addItem ~200ms each. For a typical grocery list (10–20 items), total is well within the 10s Hobby-tier limit. If we ever need more, upgrade to Pro (60s) or batch optimisations.

## Implementation steps

1. **Cleanup unused integrations.** Done — `src/lib/instacart.ts`, `tests/unit/lib/instacart.test.ts`, `supabase/functions/instacart-recipe/`, `src/lib/claudeShop.ts`, `tests/unit/lib/claudeShop.test.ts`, and the broken `supabase/functions/anylist-sync/` are all removed. `instacart-recipe` removed from `deploy:functions`. Unset `INSTACART_API_KEY` from Supabase secrets manually.

2. **Dependencies.** Done — `anylist@0.8.4` added to `dependencies` (must be installed in production for the Vercel function); `@vercel/node` added to `devDependencies` for handler types.

3. **Vercel function: `api/anylist-sync.ts`.** Done.
   - Verifies `Authorization: Bearer <jwt>` via `supabase.auth.getUser(token)`.
   - Re-checks email against `ALLOWED_EMAILS` server-side.
   - Reads `ANYLIST_EMAIL`, `ANYLIST_PASSWORD`, `ANYLIST_TARGET_LIST`, plus Supabase URL/anon key (falls back to `VITE_*` names for local dev).
   - Logs in, finds target list, adds each item formatted as `"<qty> <unit> <name>"`.
   - Returns `{ success, itemsAdded, listName }` or a structured error.
   - Calls `any.teardown()` in `finally`.

4. **Client lib: `src/lib/anylist.ts`.** Done.
   - `ANYLIST_ALLOWED_EMAILS` constant — frontend allowlist.
   - `isAnyListEnabledForUser(email)` — pure check.
   - `sendToAnyList({ items, eventName, checkedItems })` — fetches `/api/anylist-sync` with Bearer token, throws on failure.
   - `openAnyList()` — best-effort `anylist://` deep link.

5. **UI: `src/components/recipes/GroceryExportMenu.tsx`.** Done.
   - Loads current user via `getCurrentUser()` in a `useEffect`.
   - Renders the AnyList button only when `isAnyListEnabledForUser(userEmail)`.
   - On click: `sendToAnyList` → success toast with count → `openAnyList()`. Error toast on failure.
   - Disabled when no unchecked items or while a sync is in flight.

6. **Local dev workflow.** Done — `dev:local` now runs `vercel dev` instead of `vite` so the `/api/*` functions are served alongside the SPA on `localhost:3000`. Supabase local stack still served separately on its usual port.

7. **Tests.** Done.
   - `tests/unit/lib/anylist.test.ts`: allowlist, payload shape, auth check, error propagation.
   - `tests/unit/components/recipes/GroceryExportMenu.test.tsx`: button visibility based on allowlist; click invokes `sendToAnyList` + `openAnyList`; failure path; disabled state.

8. **Manual end-to-end verification (TODO):**
   - Set Vercel env vars in Project Settings → Environment Variables: `ANYLIST_EMAIL`, `ANYLIST_PASSWORD`, `ANYLIST_TARGET_LIST`. (Pull locally with `vercel env pull .env.local` if you've run `vercel link`.)
   - Run `npm run dev:local`.
   - Sign in as `dsaltz190@gmail.com`, open a meal/event with grocery items, click the AnyList button.
   - Confirm: items appear in AnyList app within ~5 seconds; toast shows item count; `anylist://` opens the app on a device that has it installed.
   - Sign in as `member@example.com` (non-allowlisted) → confirm button is absent.
   - Deploy to Vercel and repeat against production.

## Files

| Action | Path |
|---|---|
| **Add** | `api/anylist-sync.ts` |
| **Add** | `src/lib/anylist.ts` |
| **Add** | `tests/unit/lib/anylist.test.ts` |
| **Modify** | `src/components/recipes/GroceryExportMenu.tsx` |
| **Modify** | `tests/unit/components/recipes/GroceryExportMenu.test.tsx` |
| **Modify** | `package.json` (`anylist` dep, `@vercel/node` devDep, `dev:local` swap) |
| **Removed** | `src/lib/claudeShop.ts`, `tests/unit/lib/claudeShop.test.ts` |
| **Removed** | `src/lib/instacart.ts`, `tests/unit/lib/instacart.test.ts` |
| **Removed** | `supabase/functions/instacart-recipe/` |
| **Removed** | `supabase/functions/anylist-sync/` (broken Deno spike) |

## Things explicitly NOT in scope

- Per-user AnyList account linking (one shared account by design).
- Database-driven feature flag — hardcoded constant is fine for two emails.
- Multi-list selection from the UI — single configured target list (`ANYLIST_TARGET_LIST` env).
- Two-way sync, item removal, recipe creation in AnyList — push only.
- Re-implementing the direct Instacart Developer Platform code path. (If access is ever granted later, re-add fresh against the then-current API.)

## Open / verify-on-device

- **Deep link confirmation** — `anylist://` versus a longer path. Test on user's device; if no scheme works, simply skip the open-app step (items still landed).
- **`getListByName` casing** — confirm whether `"Groceries"` matches `"groceries"`. Caller controls the env var, so no real risk.
- **Vercel env var names** — function reads `SUPABASE_URL` / `SUPABASE_ANON_KEY` first, falls back to `VITE_*`. Set whichever is convenient in Vercel; both work.
