# E2E Test Results - 2026-02-09

Test run against `http://localhost:5173` in dev mode (`npm run dev:local`).

**Browser:** Chrome via DevTools MCP
**Viewport:** 1280x800 (desktop), 375x812 (mobile responsive test)
**Auth:** `dev@example.com` / `test123` (admin user)

---

## Results Summary

| Section | Flows Tested | Passed | Not Tested | Notes |
|---------|-------------|--------|------------|-------|
| 1. Authentication | 3/4 | 3 | 1 | 1.3 Access Denied requires non-allowed user |
| 2. Landing Page | 2/2 | 2 | 0 | |
| 3. Dashboard & Navigation | 5/5 | 5 | 0 | Mobile stats confirmed via source code |
| 4. Ingredients & Wheel | 5/6 | 5 | 1 | 4.3 Duplicate prevention not tested |
| 5. Event Lifecycle | 6/6 | 6 | 0 | |
| 6. Event Detail Page | 5/7 | 5 | 2 | 6.4 Smart Combined, 6.6 Export partially tested |
| 7. Recipes | 6/7 | 6 | 1 | 7.3 Manual recipe not tested separately |
| 8. Recipe Notes | 4/10 | 4 | 6 | File upload flows not tested |
| 9. Pantry | 3/5 | 3 | 2 | Default items, grocery integration not tested |
| 10. Admin Features | 6/7 | 6 | 1 | 10.7 Non-admin view not tested |
| 11. Events List | 3/3 | 3 | 0 | |
| 12. Responsive Design | 2/3 | 2 | 1 | Tablet breakpoint not tested |
| 13. Email Notifications | 0/3 | 0 | 3 | Requires RESEND_API_KEY |
| 14. Google Calendar | 1/4 | 1 | 3 | Only dev mode mock tested |

**Totals: 51/72 flows tested, 51 passed, 0 failed, 21 not tested**

---

## Detailed Results

### 1. Authentication

| Flow | Status | Notes |
|------|--------|-------|
| 1.1 Login | PASS | Redirected to `/dashboard`, avatar and name visible |
| 1.2 Already Authenticated Redirect | PASS | `/` redirects to `/dashboard` when logged in |
| 1.3 Access Denied | NOT TESTED | Requires a user not in `allowed_users` table |
| 1.4 Sign Out | PASS | Redirected to landing page with sign-in form |

### 2. Landing Page

| Flow | Status | Notes |
|------|--------|-------|
| 2.1 Landing Page Content | PASS | Hero, description, "How It Works" section, sign-in form (email/password in dev mode, not Google OAuth) |
| 2.2 404 Page | PASS | Shows "Oops! Page not found" with 404 heading and "Go Home" button |

### 3. Dashboard & Navigation

| Flow | Status | Notes |
|------|--------|-------|
| 3.1 Header Stats | PASS | Shows correct counts (e.g., "1 Events", "1 Recipes") |
| 3.2 Tab Navigation | PASS | All 3 tabs work, URLs update correctly, active tab highlighted purple |
| 3.3 Deep Link to Tab | PASS | `/dashboard/events` loads Events tab directly |
| 3.4 Mobile Menu Stats | PASS | Confirmed via source code: `md:hidden` div in dropdown contains stats. Not visible in a11y tree at desktop width but present in DOM |
| 3.5 Home Tab - Admin View | PASS | Shows greeting, ingredient wheel, ingredient bank |

### 4. Ingredients & Wheel

| Flow | Status | Notes |
|------|--------|-------|
| 4.1 Add Ingredient | PASS | Added "Broccoli", count updated. Add input disappears at 10/10 capacity |
| 4.2 Autocomplete | PASS | Shows usage history (e.g., "Broccoli Used 1x · Add to bank") |
| 4.3 Duplicate Prevention | NOT TESTED | |
| 4.4 Remove from Bank | PASS | Removed ingredient, count decremented |
| 4.5 Minimum Ingredient Check | PASS | Spin disabled at < 10, progress shows "X/10 ingredients in bank" |
| 4.6 Spin the Wheel | PASS | Animation played, confetti shown, date picker dialog appeared |

**Finding:** There is a "Suggest Ingredients" button that auto-fills the bank. Not documented in flows.

### 5. Event Lifecycle

| Flow | Status | Notes |
|------|--------|-------|
| 5.1 Create Event | PASS | Created Broccoli event for Feb 15, toast shown, countdown card appeared |
| 5.2 View Event Countdown | PASS | Countdown ticks, correct ingredient/date/time displayed |
| 5.3 Edit Event | PASS | Changed date from Feb 15 to Feb 16, countdown updated |
| 5.4 Cancel Event | PASS | Tested both "Keep Event" (event preserved) and "Cancel Event" (event deleted, toast shown) |
| 5.5 Complete Event | PASS | Rated all recipes, submitted successfully, event marked completed |
| 5.6 Rate Completed Event | PASS | Existing ratings pre-loaded in dialog, upsert works correctly |

**Finding:** Today's date is disabled in the calendar picker (not just past dates). This means you cannot schedule an event for today.

### 6. Event Detail Page

| Flow | Status | Notes |
|------|--------|-------|
| 6.1 Navigation & Header | PASS | Back button, heading, date/time, recipe count all correct |
| 6.2 Recipes Tab | PASS | Recipe cards with name, author, link, rating display |
| 6.3 Grocery Tab - Combined List | PASS | Items grouped by category (produce, meat, dairy, etc.) |
| 6.4 Smart Combined List | NOT TESTED | Requires 2+ successfully parsed recipes; edge function parsing unreliable in dev mode |
| 6.5 Pantry Filtering | PASS | Pantry items excluded from grocery list, exclusion count shown |
| 6.6 Export | PARTIAL | Only a "CSV" button exists (not a dropdown with Copy/Google Keep). CSV export not clicked |
| 6.7 Pantry Tab | PASS | Add and remove items works |

**Finding:** Export is just a single "CSV" button, not a dropdown with multiple export options. The flow doc (6.6) should be simplified.

### 7. Recipes

| Flow | Status | Notes |
|------|--------|-------|
| 7.1 Add Recipe via URL | PASS | Multi-step progress shown. Some steps skip in dev mode (notifications) |
| 7.2 Parse Failure | PASS | Parse failed, "Keep Recipe Anyway" button worked |
| 7.3 Manual Recipe | NOT TESTED | (All recipes added with URLs) |
| 7.4 Edit Recipe | PASS | Renamed recipe successfully |
| 7.5 Delete Recipe | PASS | Confirmation dialog shown, recipe removed |
| 7.6 View Recipe Link | PASS | External link opens in new tab |
| 7.7 Recipe Hub | PASS | Search by name works, filter by ingredient works, "Show More" button on long cards |

**Finding:** Recipe Hub cards have a "Show More" button for recipes with long content. Not documented.

### 8. Recipe Notes

| Flow | Status | Notes |
|------|--------|-------|
| 8.1 Add Notes | PASS | Toast "Notes added!", note count updated |
| 8.2 View Notes | PASS | Expand/collapse works |
| 8.3 Multiple Users | NOT TESTED | Only one user available |
| 8.4 Edit Notes | PASS | Updated text, toast "Notes updated!" |
| 8.5 Delete - Cancel | PASS | Confirmation dialog, note preserved on cancel |
| 8.6 Delete - Confirm | PASS | Toast "Notes removed", card reverted to "Add notes" |
| 8.7-8.10 File Upload | NOT TESTED | File upload flows not exercised |

### 9. Pantry

| Flow | Status | Notes |
|------|--------|-------|
| 9.1 My Pantry Dialog | PASS | Opened from header menu, same items as event pantry tab |
| 9.2 Default Items | NOT TESTED | Would need fresh user |
| 9.3 Add Item | PASS | Item added to pantry |
| 9.4 Remove Item | PASS | Item removed (no confirmation dialog) |
| 9.5 Grocery Integration | NOT TESTED | Not verified round-trip (add pantry item → check grocery exclusion → remove → check reappearance) |

**Finding:** Pantry remove has no confirmation dialog (unlike notes delete).

### 10. Admin Features

| Flow | Status | Notes |
|------|--------|-------|
| 10.1 View Users | PASS | User list with email, role, stats |
| 10.2 Add User | PASS | Invited `testuser@example.com` |
| 10.3 Change Role | PASS | Changed role admin ↔ viewer |
| 10.4 Toggle Club Member | PASS | Toggled on/off |
| 10.5 Delete User | PASS | Confirmation shown, user removed |
| 10.6 Self-Protection | PASS | Own controls disabled (role dropdown, delete button) |
| 10.7 Non-Admin View | NOT TESTED | Only admin user available |

### 11. Events List

| Flow | Status | Notes |
|------|--------|-------|
| 11.1 Upcoming Events | PASS | Scheduled events listed |
| 11.2 Past/Completed Events | PASS | Completed events shown, navigable |
| 11.3 Event Card Navigation | PASS | Click navigates to `/events/{id}` |

**Finding:** No section headers or visual status badges on the events list (no "Upcoming" / "Completed" labels).

### 12. Responsive Design

| Flow | Status | Notes |
|------|--------|-------|
| 12.1 Desktop (1280px+) | PASS | Full layout, inline stats, side-by-side countdown |
| 12.2 Tablet (768-1279px) | NOT TESTED | |
| 12.3 Mobile (<768px) | PASS | Tested at 375x812. Tabs compact, countdown stacks, dialogs full-width |

### 13. Email Notifications

| Flow | Status | Notes |
|------|--------|-------|
| 13.1 Recipe Added | NOT TESTED | Requires `RESEND_API_KEY` |
| 13.2 Recipe URL Updated | NOT TESTED | Requires `RESEND_API_KEY` |
| 13.3 Dev Mode Skipped | PASS (implicit) | No errors during recipe add flow; notification step completes silently |

### 14. Google Calendar

| Flow | Status | Notes |
|------|--------|-------|
| 14.1 Calendar Created | NOT TESTED | Requires Google Calendar config |
| 14.2 Calendar Updated | NOT TESTED | Requires Google Calendar config |
| 14.3 Calendar Deleted | NOT TESTED | Requires Google Calendar config |
| 14.4 Dev Mode Mocked | PASS (implicit) | No errors during event create/edit/cancel; mock data returned |

---

## Bugs Found

| Bug | Severity | Details |
|-----|----------|---------|
| Header stats don't live-update | Low | After creating/canceling events, the header event count doesn't update until page navigation or refresh. The `loadStats()` function runs on initial load but isn't re-triggered by event mutations on the Home tab. |

---

## Suggested Flow Doc Updates

Based on testing, consider these updates to `E2E_TEST_FLOWS.md`:

1. **4.1 Add Ingredient**: Note that the add input disappears when bank is at 10/10 capacity
2. **4.2 Autocomplete**: Mention usage count display (e.g., "Used 1x")
3. **6.6 Export**: Simplify to just "CSV" button (not a dropdown with multiple options)
4. **New flow - Suggest Ingredients**: Document the "Suggest Ingredients" button
5. **7.7 Recipe Hub**: Add "Show More" button on long recipe cards
6. **9.4 Remove Item**: Note there is no confirmation dialog (instant removal)
7. **Calendar picker**: Today's date is disabled, not just past dates
