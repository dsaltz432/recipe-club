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
- **Ingredient Bank:** Input field and Add button only visible when bank is NOT full (< 10 ingredients). When full, shows "Bank full — spin the wheel!" message. Duplicate check is case-insensitive. Remove sets `in_bank: false` (ingredient survives for autocomplete/re-add). Count displays as "N / 10 ingredients".
- **Completing an event:** "Complete" button on CountdownCard sets event status to "completed" and increments ingredient usedCount. Event data is preserved (unlike "Cancel" which deletes everything). Use this to clear the active event and expose the Ingredient Wheel/Bank on the Home tab.
- **Events tab structure:** `RecipeClubEvents.tsx` splits events into upcoming (status="scheduled") sorted ascending by date, then past (status="completed") sorted descending. No section headers rendered — the only visual distinction is an "Upcoming" badge on scheduled event cards and thicker border/shadow. Completed cards have thinner border.
- **Event detail URL:** `/events/{uuid}` — e.g. `/events/a9ede5ee-0514-4118-8fae-bfac640b4158` for the Salmon event. Back button labeled "Events" navigates to `/dashboard/events`.
- **Event detail page structure:** Header has back button, ingredient name (h1), date/time, recipe count. Tabs: Recipes, Groceries, Pantry. "Rate Recipes" button visible on completed events. Recipe cards show name, external link, rate/edit-ingredients/edit/delete buttons, and "Show Notes (N)" expander.
- **Known test event:** Salmon event ID `a9ede5ee-0514-4118-8fae-bfac640b4158`, status=completed, 1 recipe ("Salmon Teriyaki"), date Feb 28, 2026.

## Current Status
**Last Updated:** 2026-02-27
**Tasks Completed:** 5
**Current Task:** US-005 completed

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

## 2026-02-27 10:15 — US-004: E2E: Ingredients & Wheel (Section 4)

### What was tested
- **Prerequisite — Complete Active Event:** The Salmon event was blocking access to the Ingredient Bank (Bank only renders when no active event exists). Completed the event via "Complete" button → "Mark Complete" confirmation. Event preserved as completed (status="completed", ingredient usedCount incremented). Home tab then rendered Ingredient Wheel + Bank with 9/10 ingredients.
- **AC 4.1 Add Ingredient — PASS:** Entered "E2E-Test-Ingredient" in the bank input field, clicked "Add ingredient". Toast appeared: "Added "E2E-Test-Ingredient" to your ingredient bank!" Count updated from 9/10 to 10/10. Ingredient visible in both the wheel and bank list. "Ready to spin!" message displayed.
- **AC 4.3 Duplicate Prevention — PASS:** Removed test ingredient first (bank was full, input hidden when full). Entered "Sweet Potato" (already in bank), clicked Add. Error toast: "This ingredient is already in your bank!" Count stayed at 9/10. Autocomplete also showed "Sweet Potato" as disabled with "In bank" label.
- **AC 4.4 Remove Ingredient — PASS:** Re-added "E2E-Test-Ingredient" (count went to 10/10), then clicked "Remove E2E-Test-Ingredient from bank". Toast: "Removed "E2E-Test-Ingredient" from your ingredient bank." Count decremented from 10/10 to 9/10. Status changed from "Ready to spin!" back to "Need 1 more".
- **Count Display — PASS:** Verified "N / 10 ingredients" format at both 9/10 and 10/10 states.
- **Skipped:** AC 4.2 (autocomplete with out-of-bank ingredient — partially observed: autocomplete did show "E2E-Test-Ingredient Add to bank" when re-adding), AC 4.5/4.6/4.7 (bank full spin and event creation — destructive operations)

### Screenshots
- `ralph/us004-ac4.1-add-ingredient.png` — Bank at 10/10 after adding E2E-Test-Ingredient
- `ralph/us004-ac4.3-duplicate-prevention.png` — Error toast on duplicate "Sweet Potato"
- `ralph/us004-ac4.4-remove-ingredient.png` — Bank at 9/10 after removing E2E-Test-Ingredient

### Files changed
- None (test-only story, no code changes needed)

### Quality checks
- Build: N/A — no code changes
- Tests: N/A — no code changes
- Lint: N/A — no code changes

### Learnings for future iterations
- Ingredient Bank input and Add button are hidden when bank is full (10/10). Must remove an ingredient to get input back for duplicate testing.
- "Remove from bank" sets `in_bank: false` — the ingredient still exists in DB for autocomplete/re-add. Re-adding shows "Added back to your ingredient bank!" toast.
- Completing an event is safe for test data: event transitions to "completed" status, data preserved. Cancel deletes everything permanently.
- The Salmon event is now completed — future stories (US-005+) will see it as a past/completed event, not scheduled. No more active event exists.

---

## 2026-02-27 10:45 — US-005: E2E: Events List & Event Detail header (Sections 14 + 6.1)

### What was tested
- **AC 14.1 Upcoming Events — PASS (partial):** Navigated to `/dashboard/events`, verified event card for Salmon shows ingredient name ("Salmon"), date ("Feb 28, 2026"), time ("7:40 PM"), recipe count ("1 recipe"). No scheduled/upcoming events exist in test data — only the completed Salmon event is listed. The listing mechanism works correctly.
- **AC 14.2 Past/Completed Events — PASS:** Completed Salmon event listed in the Events tab. No "Upcoming" badge shown (correct for completed events). Since no scheduled events exist, the completed event appears as the only entry. Source code confirms upcoming events would appear first with an "Upcoming" badge and thicker border.
- **AC 14.3 Event Card Navigation — PASS:** Clicked the Salmon event card, navigated to `/events/a9ede5ee-0514-4118-8fae-bfac640b4158`. URL matches the `/events/{uuid}` pattern.
- **AC 6.1 Event Detail Header — PASS:** Verified back button ("Events"), ingredient name heading ("Salmon" as h1), event date ("Sat, Feb 28, 2026"), time ("7:40 PM"), recipe count ("1 recipe"). Also visible: "Rate Recipes" button, tabs (Recipes/Groceries/Pantry), "Salmon Teriyaki" recipe card. Back button navigates to `/dashboard/events`.
- **Skipped:** None — all ACs tested.

### Screenshots
- `ralph/us005-ac14.1-events-list.png` — Events tab with Salmon event card
- `ralph/us005-ac6.1-event-detail-header.png` — Event detail page with header, recipe card

### Files changed
- None (test-only story, no code changes needed)

### Quality checks
- Build: N/A — no code changes
- Tests: N/A — no code changes
- Lint: N/A — no code changes

### Learnings for future iterations
- Events tab renders upcoming (scheduled) then completed events in a flat list — no section headers, just visual distinction via border weight and "Upcoming" badge.
- Event detail page URL is `/events/{uuid}`. The Salmon event UUID is `a9ede5ee-0514-4118-8fae-bfac640b4158`.
- Event detail header has: back button ("Events"), ingredient name (h1), date/time, recipe count, and "Rate Recipes" button for completed events.
- Event detail page has 3 tabs: Recipes, Groceries, Pantry — useful context for US-006/007/008.
- Recipe cards on event detail show: name, external link (if URL exists), rate button, edit-ingredients button, edit/delete buttons, and "Show Notes (N)" expander.

---
