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

## Current Status
**Last Updated:** 2026-02-27
**Tasks Completed:** 1
**Current Task:** US-001 completed

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
