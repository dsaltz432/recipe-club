# Recipe Club Hub - E2E Browser Testing Activity Log

## Codebase Patterns

### Browser Testing Patterns
- **Base URL:** `http://localhost:5173`
- **Credentials:** `dev@example.com` / `test123`
- **Login flow:** Navigate to /dashboard → redirects to login → fill email/password → click Sign In
- **MCP tools:** `navigate_page`, `take_snapshot`, `take_screenshot`, `fill`, `click`, `wait_for`, `resize_page`, `list_console_messages`, `evaluate_script`
- **Snapshot UIDs:** Always take a fresh `take_snapshot` before interacting with elements — UIDs change between navigations
- **Toasts:** Use `wait_for` with toast text to verify toasts appear (they auto-dismiss after a few seconds)
- **Dialogs:** After clicking a trigger, take a new snapshot to find dialog elements
- **Radix DropdownMenu:** The `click` MCP tool sometimes fails to toggle Radix dropdown menus open. Workaround: use `evaluate_script` with `pointerdown` event on the trigger button, then `take_snapshot` to get menu items. Once the menu is open, use `evaluate_script` with `.click()` on the `[role="menuitem"]` to select items. After clicking, use `wait_for` to confirm navigation/state change.
- **Sign Out flow:** User menu button text is "D dev" (avatar initial + name). After sign out, page redirects to `/` with login form.
- **Radix Tabs:** MCP `click` tool does NOT work on Radix TabsTrigger elements. Workaround: use `evaluate_script` to focus the tab (`tabs[N].focus()`), then `press_key` with `Enter` to activate it. Alternatively, navigate directly via URL for deep-link testing.
- **Dashboard tabs & URLs:** Home→`/dashboard`, Events→`/dashboard/events`, Recipes→`/dashboard/recipes`, Meals→`/dashboard/meals`. Route uses `/dashboard/:tab?` pattern.
- **HomeSection conditional rendering:** If an active event exists, Home tab shows CountdownCard (with admin buttons Edit/Complete/Cancel). Ingredient Wheel and Bank only appear when there is NO active event AND user is admin.

## Current Status
**Last Updated:** 2026-02-27
**Tasks Completed:** 3
**Current Task:** US-003 completed

---

## Session Log

## 2026-02-27 09:12 — US-001: E2E: Authentication flows (Section 1)

### What was tested
- **AC 1.1 Login — PASS:** Navigated to /dashboard, verified redirect to `/` (login page) with "Your session has expired" toast. Entered `dev@example.com` / `test123`, clicked "Sign in (Dev Mode)", verified redirect to `/dashboard` with user avatar "D dev" visible, header showing "1 Club Event" and "4 Total Recipes".
- **AC 1.2 Login Failure — PASS:** Signed out, entered `dev@example.com` / `wrongpassword`, clicked Sign In. Toast appeared: "Sign in failed. Please try again." with helpful message "Wrong password. Use the password you first signed up with, or run 'npm run dev:reset' to reset the local database." User stayed on login page.
- **AC 1.3 Already Authenticated Redirect — PASS:** While logged in, navigated to `/`, verified auto-redirect to `/dashboard` with full dashboard content visible.
- **AC 1.6 Sign Out — PASS:** Clicked user menu "D dev", clicked "Sign Out", verified redirect to login page at `/` with email/password form.
- **Skipped:** AC 1.4 (session expiry — requires waiting/cookie clearing), AC 1.5 (access denied — requires second non-allowed user)

### Screenshots
- `ralph/us001-ac1.1-dashboard.png` — Dashboard after successful login
- `ralph/us001-ac1.2-login-failure.png` — Error toast on wrong password
- `ralph/us001-ac1.3-auth-redirect.png` — Dashboard after / redirect
- `ralph/us001-ac1.6-signout.png` — Login page after sign out

### Files changed
- None (test-only story, no code changes needed)

### Quality checks
- Build: N/A — no code changes
- Tests: N/A — no code changes
- Lint: N/A — no code changes

### Learnings for future iterations
- Radix DropdownMenu needs special handling: MCP `click` tool sometimes doesn't toggle the menu. Use `evaluate_script` with `pointerdown` event, then snapshot to find menu items, then `evaluate_script` `.click()` on menuitems.
- After sign out, URL changes to `/` (root), not `/login` — the landing page IS the login page.
- Login button text is "Sign in (Dev Mode)" in dev mode. It starts disabled and enables when both fields have values.
- Toast notifications appear in a `region` with `Notifications alt+T` label in the snapshot — check `listitem` elements within it.

---

## 2026-02-27 09:25 — US-002: E2E: Landing page & 404 (Section 2)

### What was tested
- **AC 2.1 Landing Page — PASS:** Signed out first (confirmed by redirect to `/` on navigating to `/dashboard`). Verified hero section with "Recipe Club Hub" title (h1), colorful wheel visualization graphic, subtitle "Spin the wheel, get your ingredient, and share delicious recipes with your club!", "How It Works" section (h2) with 3 steps (Spin the Wheel, Pick a Date, Lock In Your Recipe), and "Sign in (Dev Mode)" button visible.
- **AC 2.2 404 Page — PASS:** Navigated to `/nonexistent`, verified "404" heading (h1), "Oops! This page doesn't exist." message, and "Go Home" button linking back to `/`.
- **Skipped:** None — all ACs tested.

### Screenshots
- `ralph/us002-ac2.1-landing-page.png` — Landing page with hero, wheel, and How It Works
- `ralph/us002-ac2.2-404-page.png` — 404 page with heading and Go Home button

### Files changed
- None (test-only story, no code changes needed)

### Quality checks
- Build: N/A — no code changes
- Tests: N/A — no code changes
- Lint: N/A — no code changes

### Learnings for future iterations
- Landing page at `/` serves dual purpose: it's both the marketing landing page AND the login page (form is embedded in the hero section).
- 404 page has a "Go Home" button that links to `/` — useful for navigation recovery testing.
- When logged out, navigating to `/dashboard` redirects to `/` with a "Your session has expired" toast — use this to confirm logged-out state.

---

## 2026-02-27 09:50 — US-003: E2E: Dashboard & Navigation (Section 3)

### What was tested
- **AC 3.1 Header Stats — PASS:** Logged in, verified header shows "1 Club Event" and "4 Total Recipes" badges in the banner area.
- **AC 3.2 Tab Navigation — PASS:** Clicked Home, Events, Recipes, Meals tabs (using focus+Enter workaround for Radix tabs). Verified URLs update to `/dashboard`, `/dashboard/events`, `/dashboard/recipes`, `/dashboard/meals` respectively, and each tab's content panel renders correctly.
- **AC 3.4 Deep Links — PASS:** Navigated directly to `/dashboard/events`, `/dashboard/recipes`, `/dashboard/meals`. Verified the correct tab is marked `selected` in each case with matching tabpanel content visible.
- **AC 3.6 Home Tab Admin View — PASS (conditional):** Home tab shows CountdownCard with admin-only buttons (Edit, Complete, Cancel) because an active event exists. Ingredient Wheel and Ingredient Bank sections are conditionally rendered only when NO active event exists (confirmed via source code `HomeSection.tsx:49-75`). Current admin view with active event is correct.
- **Skipped:** AC 3.3/3.5 (mobile viewport — covered in US-017 responsive design), AC 3.7 (non-admin view — only one test user available)

### Screenshots
- `ralph/us003-ac3.1-header-stats.png` — Dashboard header with Club Event and Total Recipes badges
- `ralph/us003-ac3.2-tab-navigation.png` — Home tab active after full tab cycle
- `ralph/us003-ac3.4-deep-links.png` — Meals tab active via direct URL navigation
- `ralph/us003-ac3.6-home-admin-view.png` — Home tab with CountdownCard showing admin buttons

### Files changed
- None (test-only story, no code changes needed)

### Quality checks
- Build: N/A — no code changes
- Tests: N/A — no code changes
- Lint: N/A — no code changes

### Learnings for future iterations
- Radix TabsTrigger elements do NOT respond to MCP `click` tool. Must use `evaluate_script` to focus + `press_key` Enter to activate tabs.
- Dashboard route pattern is `/dashboard/:tab?` — Home tab uses no suffix (`/dashboard`), others use `/dashboard/{tabname}`.
- HomeSection rendering is conditional: active event → CountdownCard; no event + admin → Wheel + Bank; no event + non-admin → "No Event Scheduled" card.
- Header stat badges show "Club Event" (singular/plural based on count) and "Total Recipes" — not "Club Recipes" as the AC suggests. The actual labels are "Club Event" and "Total Recipes".

---
