# Recipe Club Hub - End-to-End Test Flows

Manual E2E testing flows for the Recipe Club Hub application. Run against `http://localhost:5173`.

## Prerequisites

- Local dev server running (`npm run dev:local`)
- Test user credentials: `dev@example.com` / `test123`
- Browser at minimum 1280x800 viewport (to avoid responsive breakpoint issues)

---

## 1. Authentication

### 1.1 Login
1. Navigate to `http://localhost:5173/dashboard`
2. Should redirect to login page
3. Enter email and password
4. Click "Sign In"
5. **Verify:** Redirected to `/dashboard`, user avatar and name visible in header

### 1.2 Already Authenticated Redirect
1. While logged in, navigate to `http://localhost:5173/` (landing page)
2. **Verify:** Auto-redirects to `/dashboard`

### 1.3 Access Denied (Non-allowed user)
1. Log in with an email not in the `allowed_users` table
2. **Verify:** "Access Denied" screen with ShieldX icon, message to contact admin, Sign Out button

### 1.4 Sign Out
1. Click user avatar/menu in header
2. Click "Sign Out"
3. **Verify:** Redirected to login page

---

## 2. Landing Page

### 2.1 Landing Page Content
1. Navigate to `http://localhost:5173/` (while logged out)
2. **Verify:** Hero section with app title and description
3. **Verify:** Decorative wheel visualization displayed
4. **Verify:** "How it Works" section with 3-step explanation
5. **Verify:** Sign-in button visible

### 2.2 404 Page
1. Navigate to an invalid route (e.g., `http://localhost:5173/nonexistent`)
2. **Verify:** 404 / Not Found page displayed

---

## 3. Dashboard & Navigation

### 3.1 Header Stats
1. Log in and land on dashboard
2. **Verify:** Header shows correct event count (scheduled + completed) and recipe count
3. **Verify:** Stats badges visible at desktop width (768px+), hidden on mobile (in dropdown menu instead)

### 3.2 Tab Navigation
1. Click "Home", "Events", "Recipes" tabs
2. **Verify:** URL updates (`/dashboard`, `/dashboard/events`, `/dashboard/recipes`)
3. **Verify:** Correct content loads for each tab
4. **Verify:** Active tab is highlighted with purple background

### 3.3 Deep Link to Tab
1. Navigate directly to `http://localhost:5173/dashboard/events`
2. **Verify:** Events tab is active on load
3. Navigate directly to `http://localhost:5173/dashboard/recipes`
4. **Verify:** Recipes tab is active on load

### 3.4 Mobile Menu Stats
1. Resize viewport below 768px width
2. Click user avatar/menu dropdown
3. **Verify:** Event and recipe counts appear inside the dropdown menu

### 3.5 Home Tab - Member vs Admin View
1. Log in as admin
2. **Verify:** Home tab shows Ingredient Wheel + Ingredient Bank
3. Log in as non-admin member
4. **Verify:** Home tab shows active event countdown OR "No Event Scheduled" message
5. **Verify:** Personalized greeting based on user role

---

## 4. Ingredients & Wheel

### 4.1 Add Ingredient
1. Navigate to Home tab (as admin)
2. Find the ingredient bank section
3. Enter a new ingredient name
4. Click Add
5. **Verify:** Ingredient appears in the bank list
6. **Verify:** Ingredient count updates (e.g., "10/10")

### 4.2 Add Ingredient - Autocomplete
1. Start typing an ingredient name that already exists (but is out of bank)
2. **Verify:** Autocomplete suggests existing ingredients
3. Click a suggestion
4. **Verify:** Ingredient re-added to bank (sets `in_bank: true`)

### 4.3 Add Ingredient - Duplicate Prevention
1. Try adding an ingredient that's already in the bank
2. **Verify:** Validation prevents duplicate (case-insensitive)

### 4.4 Remove Ingredient from Bank
1. Find an ingredient in the bank
2. Click the remove/toggle button
3. **Verify:** Ingredient removed from bank (sets `in_bank: false`)
4. **Verify:** Ingredient count decrements

### 4.5 Spin the Wheel - Minimum Ingredient Check
1. Ensure fewer than 10 ingredients are in the bank
2. **Verify:** Spin button is disabled
3. **Verify:** Progress bar shows "X/10 ingredients in bank"

### 4.6 Spin the Wheel
1. Ensure 10+ ingredients in the bank
2. Click "Spin the Wheel"
3. **Verify:** Wheel animation plays (~6 seconds, 5-8 rotations)
4. **Verify:** Confetti animation on landing
5. **Verify:** A random ingredient is selected and highlighted
6. **Verify:** Date picker dialog appears after spin

---

## 5. Event Lifecycle

### 5.1 Create Event (Schedule from Wheel)
1. Spin the wheel to select an ingredient
2. Choose a date from the calendar picker
3. Set event time (default 7:00 PM)
4. Click to lock in / create the event
5. **Verify:** Event created successfully, toast shown
6. **Verify:** Selected ingredient removed from bank (`in_bank: false`)
7. **Verify:** Countdown card appears on Home tab with correct ingredient, date, and time
8. **Verify:** Header event count increments
9. **Verify:** Google Calendar event created (or graceful skip in dev mode)

### 5.2 View Event Countdown
1. With an active scheduled event, go to Home tab
2. **Verify:** Countdown card shows ingredient name, date, time
3. **Verify:** Countdown timer ticks (days, hours, minutes, seconds)
4. **Verify:** Styling changes when event is today (orange) vs future (purple)
5. **Verify:** Shows "It's Time!" when countdown reaches zero
6. **Verify:** "View Event Details" button navigates to `/events/{id}`

### 5.3 Edit Event (Admin only)
1. As admin, click "Edit" on the countdown card
2. **Verify:** Edit dialog opens with current date/time pre-populated
3. **Verify:** Past dates are disabled in the calendar
4. Change date and/or time
5. Click "Save Changes"
6. **Verify:** Event updated, countdown reflects new date/time
7. **Verify:** Google Calendar event updated (if applicable)

### 5.4 Cancel Event (Admin only)
1. As admin, click "Cancel" on the countdown card
2. **Verify:** Confirmation dialog: "Cancel Event? This will cancel the [ingredient] event and remove all associated recipes."
3. Click "Keep Event" - **Verify:** Event still exists
4. Click "Cancel Event" again, confirm with "Cancel Event"
5. **Verify:** Event deleted, toast "Event canceled"
6. **Verify:** Associated recipes cascade-deleted
7. **Verify:** Google Calendar event deleted (if applicable)
8. **Verify:** Countdown card disappears, header event count decrements

### 5.5 Complete Event
1. Navigate to event detail page for a scheduled event with recipes
2. Click "Complete" button
3. **Verify:** Rating dialog opens for all recipes (mode: "completing")
4. **Verify:** All recipes must be rated before submit is enabled
5. Rate each recipe (thumbs up/down + 1-5 star rating)
6. Click "Submit Ratings & Complete Event"
7. **Verify:** No errors (especially no 400 upsert error)
8. **Verify:** Event status changes to completed
9. **Verify:** Ingredient `used_count` incremented
10. **Verify:** Ratings displayed on recipe cards (stars + "Make again: Yes/No")

### 5.6 Rate Completed Event (Member)
1. Navigate to an already-completed event
2. Click "Rate Recipes" (if available)
3. **Verify:** Rating dialog opens in "rating" mode
4. **Verify:** Existing ratings pre-loaded (if previously rated)
5. Rate at least one recipe (minimum to submit)
6. Submit ratings
7. **Verify:** Ratings saved/updated successfully (upsert)

---

## 6. Event Detail Page

### 6.1 Navigation & Header
1. Navigate to `/events/{id}`
2. **Verify:** Back button ("Events") returns to events list
3. **Verify:** Ingredient name displayed as heading
4. **Verify:** Event date, time, and recipe count shown
5. **Verify:** User menu dropdown accessible

### 6.2 Recipes Tab
1. **Verify:** Recipes tab shows recipe count in heading ("Recipes (N)")
2. **Verify:** Each recipe card shows: name, author email, link, rating (if rated), note count
3. **Verify:** "Add Recipe" button visible

### 6.3 Grocery Tab - Combined List
1. Click "Grocery" tab on event detail
2. **Verify:** Combined grocery list shown (ingredients merged from all recipes)
3. **Verify:** Items grouped by category (produce, meat, dairy, etc.)
4. **Verify:** Each item shows quantity, unit, and source recipe(s)

### 6.4 Grocery Tab - Smart Combined List
1. Ensure 2+ recipes are parsed for this event
2. Click "Grocery" tab
3. **Verify:** "Smart Combined" sub-tab available
4. Click "Smart Combined"
5. **Verify:** AI-deduplicated list shown (e.g., "broccoli floret" + "broccoli" merged)
6. **Verify:** Quantities summed across recipes

### 6.5 Grocery Tab - Pantry Filtering
1. On Grocery tab, note items that are in your pantry
2. **Verify:** Pantry items excluded from the grocery list
3. **Verify:** Excluded item count shown (e.g., "3 pantry items excluded")

### 6.6 Grocery Tab - Export
1. On Grocery tab, find the export menu
2. Test "Copy to Clipboard" - **Verify:** Markdown table copied
3. Test "Download CSV" - **Verify:** CSV file downloads
4. Test "Open in Google Keep" - **Verify:** Opens Google Keep link

### 6.7 Pantry Tab
1. Click "Pantry" tab on event detail
2. **Verify:** Pantry items displayed
3. Add a new item via text input
4. **Verify:** Item added to pantry list
5. Remove an item
6. **Verify:** Item removed from pantry

---

## 7. Recipes

### 7.1 Add Recipe via URL (with Parsing)
1. On event detail page, click "Add Recipe"
2. Enter recipe name and a valid recipe URL
3. Click "Add Recipe"
4. **Verify:** Multi-step progress stepper appears:
   - Step 1: Saving recipe to database
   - Step 2: Parsing ingredients & instructions (via edge function)
   - Step 3: Loading recipe data
   - Step 4: Combining with other recipes (if 2+ parsed)
   - Step 5: Notifying club members (via email edge function)
5. **Verify:** All steps complete successfully
6. **Verify:** Recipe appears in the list with parsed ingredients
7. **Verify:** Grocery tab updated with new ingredients
8. **Verify:** Header recipe count increments

### 7.2 Add Recipe - Parse Failure
1. Add a recipe with an invalid or unsupported URL
2. **Verify:** Parse step fails with error message
3. **Verify:** Options shown: "Keep Recipe Anyway" or "Try Different URL"
4. Click "Keep Recipe Anyway"
5. **Verify:** Recipe saved without parsed ingredients

### 7.3 Add Recipe Manually
1. Click "Add Recipe"
2. Enter recipe name only (no URL)
3. **Verify:** Recipe created with manually entered data

### 7.4 Edit Recipe
1. Find an existing recipe on event detail page
2. Click the edit button
3. **Verify:** Edit dialog opens with current name and URL pre-populated
4. Change name and/or URL
5. Save changes
6. **Verify:** Recipe updated
7. **Verify:** If URL changed, notification sent to club members

### 7.5 Delete Recipe
1. Find an existing recipe on event detail page
2. Click the delete button
3. **Verify:** Confirmation dialog shown
4. Confirm deletion
5. **Verify:** Recipe removed from list
6. **Verify:** Associated notes and ratings cascade-deleted
7. **Verify:** Grocery list updated (ingredients removed)

### 7.6 View Recipe (External Link)
1. Click "View recipe" link on a recipe card
2. **Verify:** Opens original recipe URL in new tab

### 7.7 Recipe Hub (Dashboard Recipes Tab)
1. Navigate to Recipes tab on dashboard
2. **Verify:** All recipes across all events are listed
3. **Verify:** Search by recipe name works
4. **Verify:** Filter by ingredient works
5. **Verify:** Recipe cards show: name, creator, ingredient tag, rating, notes count

---

## 8. Recipe Notes (CRUD)

### 8.1 Add Notes
1. On event detail page, find a recipe card
2. Click "Add notes" button
3. **Verify:** Dialog opens with text area and file upload (max 5 files, 5MB each)
4. Enter note text
5. Click "Add Notes"
6. **Verify:** Toast "Notes added!", dialog closes
7. **Verify:** Recipe card shows "1 note" count and "Show Notes (1)" button

### 8.2 View Notes
1. Click "Show Notes (1)" on a recipe card
2. **Verify:** Notes section expands showing author name and note text
3. **Verify:** Button changes to "Hide Notes"
4. Click "Hide Notes"
5. **Verify:** Notes section collapses

### 8.3 View Notes - Multiple Users
1. Have multiple users add notes to the same recipe
2. Expand notes
3. **Verify:** Each user's notes shown separately with their name/avatar

### 8.4 Edit Notes
1. Expand notes, click the edit button (pencil icon)
2. **Verify:** Edit dialog opens with existing note text pre-populated
3. Modify the text
4. Click "Save Changes"
5. **Verify:** Toast "Notes updated!", updated text visible

### 8.5 Delete Notes - Cancel
1. Expand notes, click the delete button (trash icon)
2. **Verify:** Confirmation dialog: "Delete Notes? Are you sure you want to delete your notes? This action cannot be undone."
3. Click "Cancel"
4. **Verify:** Note still exists unchanged

### 8.6 Delete Notes - Confirm
1. Click delete button again
2. Click "Delete" in confirmation dialog
3. **Verify:** Toast "Notes removed"
4. **Verify:** Note count removed from card, button reverts to "Add notes"

### 8.7 File Upload with Notes
1. Click "Add notes" or "Edit notes"
2. Click "Upload Files"
3. Upload an image (under 5MB)
4. **Verify:** File appears in the upload section with thumbnail preview
5. **Verify:** File count updates (e.g., "Files (1/5)")
6. Save notes
7. **Verify:** File persisted and visible when viewing notes

### 8.8 File Upload - PDF
1. Upload a PDF file (under 5MB)
2. **Verify:** PDF shown with icon (not image thumbnail)
3. Save and verify PDF persists

### 8.9 File Upload - Validation
1. Try uploading more than 5 files
2. **Verify:** Upload prevented or excess files rejected
3. Try uploading a file larger than 5MB
4. **Verify:** Error message shown, file rejected

### 8.10 File Upload - Remove File
1. Upload a file, then click the remove button on it
2. **Verify:** File removed from upload list
3. **Verify:** File count decrements

---

## 9. Pantry

### 9.1 My Pantry Dialog (Header)
1. Click user menu in header
2. Click "My Pantry"
3. **Verify:** Pantry dialog opens showing saved pantry items
4. Add/remove items
5. **Verify:** Changes persist after closing and reopening

### 9.2 Pantry - Default Items
1. Open pantry for first time (new user)
2. **Verify:** Default pantry items are pre-populated

### 9.3 Pantry - Add Item
1. Open pantry dialog
2. Type item name and press Enter (or click Add)
3. **Verify:** Item added to pantry list

### 9.4 Pantry - Remove Item
1. Click remove button on a pantry item
2. **Verify:** Item removed from pantry

### 9.5 Pantry - Grocery List Integration
1. Add an item to your pantry that appears in a grocery list
2. Navigate to event detail > Grocery tab
3. **Verify:** That item is excluded from the grocery list
4. Remove the item from your pantry
5. **Verify:** Item reappears in the grocery list

---

## 10. Admin Features

### 10.1 Manage Users - View
1. Log in as admin user
2. Click user menu > "Manage Users"
3. **Verify:** Navigates to `/users`
4. **Verify:** User list displayed with email, role, and club member status

### 10.2 Manage Users - Add User
1. On Users page, find the add user form
2. Enter email address
3. Select role (admin or viewer)
4. Toggle club member status
5. Submit
6. **Verify:** New user appears in the list

### 10.3 Manage Users - Change Role
1. Find an existing user (not yourself)
2. Change their role (admin ↔ viewer)
3. **Verify:** Role updated

### 10.4 Manage Users - Toggle Club Member
1. Find an existing user
2. Toggle club member status
3. **Verify:** Status updated (club members can rate recipes)

### 10.5 Manage Users - Delete User
1. Find an existing user (not yourself)
2. Click delete
3. **Verify:** Confirmation dialog shown
4. Confirm deletion
5. **Verify:** User removed from list

### 10.6 Manage Users - Self-Protection
1. Try to change your own role
2. **Verify:** Action prevented / control disabled
3. Try to delete yourself
4. **Verify:** Action prevented

### 10.7 Admin-Only UI Elements
1. Log in as non-admin
2. **Verify:** "Manage Users" not in dropdown menu
3. **Verify:** Edit/Cancel/Complete buttons not shown on events
4. **Verify:** `/users` route redirected or shows access denied

---

## 11. Events List (Events Tab)

### 11.1 Upcoming Events
1. Navigate to Events tab on dashboard
2. **Verify:** Scheduled events listed in ascending date order
3. **Verify:** Each event card shows: ingredient name, date, time, recipe count

### 11.2 Past/Completed Events
1. **Verify:** Completed events listed below upcoming, in descending date order
2. **Verify:** Completed events show without admin action buttons (edit/cancel/complete)
3. **Verify:** Completed events still navigable to detail page

### 11.3 Event Card Navigation
1. Click on an event card
2. **Verify:** Navigates to `/events/{id}` detail page

---

## 12. Responsive Design

### 12.1 Desktop (1280px+)
- Header stats badges visible inline
- Full tab labels with icons
- Countdown card side-by-side layout (info left, countdown right)

### 12.2 Tablet (768px - 1279px)
- Header stats badges still visible (md breakpoint)
- Content may stack slightly

### 12.3 Mobile (<768px)
- Header stats badges hidden (moved to dropdown menu)
- Tab labels still visible but more compact
- Countdown card stacks vertically
- All dialogs use full-width on small screens

---

## 13. Email Notifications

### 13.1 Recipe Added Notification
1. Add a recipe to an event (with `RESEND_API_KEY` configured)
2. **Verify:** All club members (except you) receive email notification
3. **Verify:** Email includes recipe name, URL, ingredient, and event date

### 13.2 Recipe URL Updated Notification
1. Edit a recipe and change its URL
2. **Verify:** Club members notified of the update

### 13.3 Dev Mode - Notifications Skipped
1. In dev mode (without `RESEND_API_KEY`)
2. Add a recipe
3. **Verify:** No error; notification step silently succeeds

---

## 14. Google Calendar Integration

### 14.1 Calendar Event Created
1. Create a new event via wheel spin (with Google Calendar configured)
2. **Verify:** Google Calendar event created with correct date, time, and ingredient name

### 14.2 Calendar Event Updated
1. Edit an event's date/time
2. **Verify:** Google Calendar event updated to match

### 14.3 Calendar Event Deleted
1. Cancel an event
2. **Verify:** Google Calendar event removed

### 14.4 Dev Mode - Calendar Mocked
1. In dev mode, create/edit/cancel events
2. **Verify:** Mock calendar data returned; no errors

---

## Known Issues & Edge Cases

| Issue | Status | Notes |
|-------|--------|-------|
| Edit Event dialog may flash open on initial login redirect | Intermittent | Could not reliably reproduce; likely race condition |
| Rating upsert requires 3-column onConflict | Fixed | Must match `UNIQUE(recipe_id, user_id, event_id)` constraint |
| Header event count must include scheduled events | Fixed | Query uses `.in("status", ["scheduled", "completed"])` |
| Responsive badges disappear below 768px | By design | Uses Tailwind `hidden md:flex`; stats in mobile dropdown |

---

## Test Environment Notes

- **Auth**: In dev mode, uses email/password auth (not Google OAuth)
- **Google Calendar**: Returns mock data in dev mode
- **Email notifications**: Skipped in dev mode when `RESEND_API_KEY` is missing
- **Edge functions**: Gracefully skip when API keys are missing
- **Feature flag**: `SHOW_PARSE_BUTTONS` in `src/lib/constants.ts` - currently `false` (hides per-recipe parse/re-parse buttons)
- **Disabled feature**: Cook Mode tab is commented out in EventDetailPage (would show combined cooking timeline)
