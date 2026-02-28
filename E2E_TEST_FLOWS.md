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

### 1.2 Login Failure
1. Enter invalid credentials (wrong password or non-existent email)
2. Click "Sign In"
3. **Verify:** Toast error "Sign in failed. Please try again." appears
4. **Verify:** User stays on login page, can retry

### 1.3 Already Authenticated Redirect
1. While logged in, navigate to `http://localhost:5173/` (landing page)
2. **Verify:** Auto-redirects to `/dashboard`

### 1.4 Session Expiry
1. Log in, then wait for session to expire (or manually clear auth cookies)
2. Attempt to navigate to a protected page
3. **Verify:** Toast "Your session has expired. Please sign in again." appears
4. **Verify:** Redirected to login page

### 1.5 Access Denied (Non-allowed user)
1. Log in with an email not in the `allowed_users` table
2. **Verify:** "Access Denied" screen with ShieldX icon, message to contact admin, Sign Out button

### 1.6 Sign Out
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
2. **Verify:** Header shows "N Club Events" and "N Club Recipes" (community-wide counts)
3. **Verify:** Stats badges visible at desktop width (768px+), hidden on mobile (in dropdown menu instead)

### 3.2 Tab Navigation
1. Click "Home", "Events", "Recipes", "Meals" tabs
2. **Verify:** URL updates (`/dashboard`, `/dashboard/events`, `/dashboard/recipes`, `/dashboard/meals`)
3. **Verify:** Correct content loads for each tab
4. **Verify:** Active tab is highlighted with purple background

### 3.3 Mobile Tab Labels
1. Resize viewport below 640px
2. **Verify:** Tab bar shows short text labels below icons ("Home", "Events", "Recipes", "Meals")
3. **Verify:** Labels are readable (not hidden)

### 3.4 Deep Link to Tab
1. Navigate directly to `http://localhost:5173/dashboard/events`
2. **Verify:** Events tab is active on load
3. Navigate directly to `http://localhost:5173/dashboard/recipes`
4. **Verify:** Recipes tab is active on load
5. Navigate directly to `http://localhost:5173/dashboard/meals`
6. **Verify:** Meals tab is active on load

### 3.5 Mobile Menu Stats
1. Resize viewport below 768px width
2. Click user avatar/menu dropdown
3. **Verify:** "Club Events" and "Club Recipes" counts appear inside the dropdown menu

### 3.6 Home Tab - Admin View
1. Log in as admin
2. **Verify:** Home tab shows Ingredient Wheel + Ingredient Bank
3. **Verify:** Personalized greeting based on user role

### 3.7 Home Tab - Non-Admin View
1. Log in as non-admin member
2. With active event: **Verify:** Countdown card displayed with ingredient, date, time
3. Without active event: **Verify:** "No Event Scheduled" message with "Browse Recipes" button
4. Click "Browse Recipes" button
5. **Verify:** Navigates to Recipes tab (`/dashboard/recipes`)

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

### 4.5 Bank Full Message
1. Add ingredients until the bank reaches capacity (10)
2. **Verify:** "Bank full — spin the wheel!" message appears
3. **Verify:** Add ingredient input is hidden

### 4.6 Spin the Wheel - Minimum Ingredient Check
1. Ensure fewer than 10 ingredients are in the bank
2. **Verify:** Spin button is disabled
3. **Verify:** Progress bar shows "X/10 ingredients in bank"

### 4.7 Spin the Wheel
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
3. **Verify:** Today's date is selectable (not disabled)
4. Set event time (default 7:00 PM)
5. Click to lock in / create the event
6. **Verify:** Event created successfully, toast shown
7. **Verify:** Selected ingredient removed from bank (`in_bank: false`)
8. **Verify:** Countdown card appears on Home tab with correct ingredient, date, and time
9. **Verify:** Header "Club Events" count increments
10. **Verify:** Google Calendar event created (or graceful skip in dev mode)

### 5.2 View Event Countdown
1. With an active scheduled event, go to Home tab
2. **Verify:** Countdown card shows ingredient name, date, time
3. **Verify:** Countdown timer ticks (days, hours, minutes, seconds)
4. **Verify:** Styling changes when event is today (orange) vs future (purple)
5. **Verify:** Shows "It's Time!" when countdown reaches zero
6. **Verify:** "It's Time!" state includes guidance link: "Head to the event for recipes and cooking!"
7. **Verify:** Clicking the guidance link navigates to `/events/{id}`
8. **Verify:** "View Event Details" button navigates to `/events/{id}`

### 5.3 Edit Event (Admin only)
1. As admin, click "Edit" on the countdown card
2. **Verify:** Edit dialog opens with current date/time pre-populated
3. **Verify:** Past dates are disabled but today is selectable
4. Change date and/or time
5. Click "Save Changes"
6. **Verify:** Event updated, countdown reflects new date/time
7. **Verify:** Google Calendar event updated (if applicable)
8. If calendar sync fails: **Verify:** Toast warning "Calendar sync failed. The event date was updated but your Google Calendar may be out of sync."

### 5.4 Cancel Event (Admin only)
1. As admin, click "Cancel" on the countdown card
2. **Verify:** Confirmation dialog warns: "This will permanently delete the event and all associated recipes, notes, ratings, meal plan references, and Google Calendar event. This cannot be undone."
3. Click "Keep Event" - **Verify:** Event still exists
4. Click "Cancel Event" again, confirm
5. **Verify:** Event deleted, toast "Event canceled"
6. **Verify:** Associated recipes cascade-deleted
7. **Verify:** Google Calendar event deleted (if applicable)
8. **Verify:** Countdown card disappears, header "Club Events" count decrements

### 5.5 Complete Event
1. Navigate to event detail page for a scheduled event with recipes
2. Click "Complete" button
3. **Verify:** Rating dialog opens for all recipes (mode: "completing")
4. **Verify:** All recipes must be rated before submit is enabled
5. Rate each recipe (thumbs up/down + 1-5 star rating)
6. Click "Submit Ratings & Complete Event"
7. **Verify:** No errors (especially no 400 upsert error)
8. **Verify:** Event status changes to completed
9. **Verify:** Ingredient `used_count` incremented (atomic — no race condition)
10. **Verify:** Ratings displayed on recipe cards — average stars (with half-star support) + "Make again:" with member initials in green/red

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
2. **Verify:** Back button returns to previous page (browser history) or falls back to `/dashboard/events` for deep links
3. **Verify:** Ingredient name displayed as heading
4. **Verify:** Event date, time, and recipe count shown

### 6.2 Recipes Tab
1. **Verify:** Recipes tab shows recipe count in heading ("Recipes (N)")
2. **Verify:** Each recipe card shows: name, author email, link, rating (if rated), note count
3. **Verify:** Rating display shows average stars (with half-star support) and "Make again:" with member initials in green (Yes) or red (No)
4. **Verify:** "Add Recipe" button visible
5. **Verify:** Recipe cards with parsed ingredients show expandable ingredient list grouped by category
6. **Verify:** Edit Ingredients button (ListChecks icon) visible on recipe cards you created

### 6.3 Add Recipe via URL (with Parsing)
1. Click "Add Recipe"
2. Enter recipe name and a valid recipe URL
3. Click "Add Recipe"
4. **Verify:** Multi-step progress stepper appears:
   - Step 1: Saving recipe to database
   - Step 2: Parsing ingredients & instructions (via edge function)
   - Step 3: Loading recipe data
   - Step 4: Notifying club members (via email edge function)
   - Note: Combining runs in the background (Groceries tab shows spinner if still in progress)
5. **Verify:** All steps complete successfully
6. **Verify:** Recipe appears in the list with parsed ingredients
7. **Verify:** Grocery tab updated with new ingredients
8. **Verify:** Header "Club Recipes" count increments

### 6.4 Add Recipe - Dismiss During Parsing
1. Add a recipe and while parsing is in progress, try to close the dialog
2. **Verify:** Confirmation prompt: "Parsing is in progress. The recipe has been saved. Close anyway?"
3. Click Cancel - **Verify:** Dialog stays open, parsing continues
4. Click OK - **Verify:** Dialog closes, recipe is saved (may not have parsed ingredients)

### 6.5 Add Recipe - Parse Failure
1. Add a recipe with an invalid or unsupported URL
2. **Verify:** Green success message: "Your recipe has been saved!"
3. **Verify:** Error message explaining ingredients couldn't be extracted automatically
4. **Verify:** Two options: "Continue without ingredients" and "Try parsing again"
5. Click "Try parsing again" - **Verify:** Parse retries on the same saved recipe
6. Click "Continue without ingredients" - **Verify:** Dialog closes, recipe saved without ingredients

### 6.6 Add Recipe via Photo/PDF Upload
1. Click "Add Recipe"
2. Click the "Upload" button (has visible text label)
3. Select an image file (JPG, PNG, WebP, HEIC) or PDF
4. **Verify:** Filename shown during upload with spinner
5. **Verify:** URL field auto-populated with storage URL
6. **Verify:** Recipe name auto-filled from filename (if name field was empty)
7. Complete the add recipe flow
8. **Verify:** Parse-recipe triggered with correct media type detection

### 6.7 Add Recipe Manually (No URL)
1. Click "Add Recipe"
2. Enter recipe name only (no URL, no upload)
3. **Verify:** Recipe created without parsed ingredients

### 6.7a Add Recipe Manually with Ingredients
1. Click "Add Recipe"
2. Click "Enter Manually" input mode button
3. Enter recipe name
4. **Verify:** Ingredient entry grid appears with columns: Qty, Unit, Name, Category
5. Enter ingredient details (e.g., "2", "cup", "flour")
6. **Verify:** Category auto-detects based on ingredient name (e.g., "olive oil" → Pantry, "tofu" → Protein)
7. Press Enter on last row's Name field
8. **Verify:** New blank row auto-added
9. Click "Add Ingredient" button to add more rows manually
10. Click X button on a row to remove it
11. Click "Add Recipe"
12. **Verify:** Recipe created with manually entered ingredients (visible in grocery tab)

### 6.7b Recipe Parse Status Indicators
1. Add a recipe with a URL
2. **Verify:** While parsing, recipe card shows animated spinner with "Parsing ingredients..." text
3. If parsing fails: **Verify:** Card shows "Parsing failed" with alert icon and "Retry" button
4. Click "Retry" - **Verify:** Parsing restarts
5. For recipes without parsed content: **Verify:** "Parse Ingredients" button visible on card (when `SHOW_PARSE_BUTTONS` feature flag is enabled)

### 6.8 Edit Recipe
1. Find an existing recipe on event detail page
2. Click the edit button
3. **Verify:** Edit dialog opens with current name and URL pre-populated
4. **Verify:** URL field is optional (label says "Recipe URL", not required)
5. Change name and/or URL
6. Save changes
7. **Verify:** Recipe updated
8. If URL changed: **Verify:** Recipe re-parsed in background (new ingredients fetched)
9. Save with empty URL - **Verify:** Saves successfully (URL cleared)

### 6.9 Delete Recipe
1. Find an existing recipe on event detail page
2. Click the delete button
3. **Verify:** Confirmation dialog shown
4. Confirm deletion
5. **Verify:** Recipe removed from list
6. **Verify:** Associated notes and ratings cascade-deleted
7. **Verify:** Grocery list updated (ingredients removed)
8. **Verify:** Club members notified of recipe removal (via email edge function)

### 6.9a Edit Recipe Ingredients
1. Find a recipe you created on the event detail page
2. Click the Edit Ingredients button (ListChecks icon) on the recipe card
3. **Verify:** Edit Ingredients dialog opens with existing ingredients pre-loaded in grid
4. **Verify:** Grid shows columns: Qty, Unit, Name, Category, Delete
5. Modify an ingredient (change quantity, unit, or name)
6. Add a new ingredient row via "Add Ingredient" button
7. Remove an ingredient row via X button
8. **Verify:** Category auto-detects when changing ingredient name
9. Click "Save"
10. **Verify:** Spinner shown while saving
11. **Verify:** Ingredients updated (calls `replace_recipe_ingredients` RPC)
12. **Verify:** Grocery cache invalidated — grocery tab refreshes with updated ingredients

### 6.10 View Recipe (External Link)
1. Find a recipe card with a URL
2. **Verify:** External link icon (ExternalLink) visible in the header icon row (top right of card)
3. Click the external link icon
4. **Verify:** Opens original recipe URL in new tab
5. **Verify:** Icon has aria-label "Open recipe URL"

### 6.11 Grocery Tab - Combined List
1. Click "Grocery" tab on event detail
2. **Verify:** "Combined" sub-tab is active by default
3. **Verify:** Combined grocery list shown (ingredients merged from all recipes)
4. **Verify:** Items grouped by category (Produce, Protein, Dairy, Pantry, Spices, Frozen, Bakery, Beverages, Condiments, Other)
5. **Verify:** Each item shows quantity, unit, and source recipe(s)
6. **Verify:** Per-recipe sub-tabs shown (one tab per recipe with parsed ingredients)
7. Click a per-recipe tab - **Verify:** Only that recipe's ingredients shown, still grouped by category
8. **Verify:** Pantry filtering applies to both combined view AND per-recipe tabs

### 6.12 Grocery Tab - Smart Combined List
1. Ensure 2+ recipes are parsed for this event
2. Click "Grocery" tab
3. **Verify:** "Smart Combined" sub-tab available
4. Click "Smart Combined"
5. **Verify:** AI-deduplicated list shown (e.g., "broccoli floret" + "broccoli" merged)
6. **Verify:** Quantities summed across recipes
7. **Verify:** Results cached — subsequent visits load from cache without re-combining

### 6.12a Grocery Tab - Editable Items
1. On Grocery tab (when editable mode is enabled)
2. **Verify:** Each grocery item has edit and remove buttons
3. Click remove (X) on an item - **Verify:** Item removed from the list
4. Find the "Add item" form at the bottom of a category group
5. Enter quantity, unit, and item name
6. Press Enter or click Add - **Verify:** New item added to the list under the correct category

### 6.13 Grocery Tab - Pantry Filtering
1. On Grocery tab, note items that are in your pantry
2. **Verify:** Pantry items excluded from the grocery list
3. **Verify:** Prominent info banner: "N pantry items excluded from this list" (purple background with icon)
4. **Verify:** Pantry filtering applies to both combined view AND per-recipe tabs

### 6.14 Grocery Tab - Export
1. On Grocery tab, find the export menu
2. Test "Copy to Clipboard" - **Verify:** Markdown table copied
3. Test "Download CSV" - **Verify:** CSV file downloads
4. Test "Open in Google Keep" - **Verify:** Opens Google Keep link

### 6.15 Pantry Tab
1. Click "Pantry" tab on event detail
2. **Verify:** Pantry items displayed
3. Add a new item via text input
4. **Verify:** Item added, success toast shown ("Added '[item]' to pantry")
5. Click remove (trash icon) on an item
6. **Verify:** Confirmation dialog: "Remove '[item]' from your pantry?"
7. Confirm removal
8. **Verify:** Item removed from pantry

---

## 7. Recipe Hub (Dashboard Recipes Tab)

### 7.1 Club Recipes Tab
1. Navigate to Recipes tab on dashboard
2. **Verify:** "Club (N)" tab shows recipe count
3. **Verify:** Recipes from club events listed
4. **Verify:** Recipe cards show: name, creator, ingredient tag, rating (stars + member initials), notes count
5. **Verify:** Recipe cards with parsed ingredients show expandable ingredient list (pantry items filtered out)

### 7.2 Personal Recipes Tab
1. Click "My Recipes (N)" tab
2. **Verify:** Shows personal recipes (created by you, not tied to events)
3. **Verify:** Each personal recipe card shows "Personal" badge
4. **Verify:** Edit (pencil) and Delete (trash) icon buttons visible on all recipe cards (both club and personal)

### 7.3 Search - By Recipe Name
1. Type a recipe name in the search bar
2. **Verify:** Results filtered to matching recipes

### 7.4 Search - By Ingredient Name
1. Type an ingredient name (e.g., "Salmon") in the search bar
2. **Verify:** Club recipes associated with that ingredient appear in results

### 7.5 Search - By Note Text
1. Type text that appears in a recipe note
2. **Verify:** Recipes with matching notes appear

### 7.6 Filter by Ingredient (Club Tab)
1. On Club tab, click the ingredient filter dropdown
2. Select an ingredient
3. **Verify:** Only recipes from events with that ingredient shown

### 7.7 Sort Options
1. Click the sort dropdown (default: "Newest First")
2. Select "Alphabetical (A-Z)" - **Verify:** Recipes sorted by name
3. Select "Highest Rated" - **Verify:** Recipes sorted by average rating (highest first)
4. Select "Newest First" - **Verify:** Recipes sorted by creation date (newest first)

### 7.8 Add Personal Recipe
1. On "My Recipes" tab, click "Add Recipe" button
2. Enter recipe name and optional URL
3. **Verify:** Recipe added and appears in personal recipes list

### 7.9 Edit Recipe (from Hub)
1. Click the edit (pencil) button on any recipe card (club or personal)
2. **Verify:** Edit dialog opens with current name and URL pre-filled
3. Change name and/or URL (URL is optional)
4. Click "Save Changes"
5. **Verify:** Recipe updated, toast shown, list refreshed
6. If URL changed: **Verify:** Recipe re-parsed in background (new ingredients fetched)

### 7.10 Delete Recipe (from Hub)
1. Click the delete (trash) button on any recipe card
2. If the recipe is used in a meal plan: **Verify:** Error toast "This recipe is used in a meal plan. Remove it from the meal plan first." and deletion is blocked
3. If the recipe is not in a meal plan: **Verify:** Confirmation dialog shown
4. Confirm deletion
5. **Verify:** Recipe removed, toast shown, list refreshed

### 7.11 Edit Recipe Ingredients (from Hub)
1. On a recipe card you created, click the Edit Ingredients button (ListChecks icon)
2. **Verify:** Only visible on recipes where you are the creator (`createdBy === userId`)
3. **Verify:** EditRecipeIngredientsDialog opens with current ingredients
4. Edit, add, or remove ingredient rows
5. Click "Save"
6. **Verify:** Ingredients updated via RPC, recipe card refreshes

### 7.12 Empty States
1. With no personal recipes: **Verify:** Message says "No personal recipes yet. Add one using the button above!" (no mention of "save a club recipe")
2. With no club recipes: **Verify:** Appropriate empty state message

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
2. **Verify:** Edit button has aria-label (e.g., "Edit note")
3. **Verify:** Edit dialog opens with existing note text pre-populated
4. Modify the text
5. Click "Save Changes"
6. **Verify:** Toast "Notes updated!", updated text visible

### 8.5 Delete Notes - Cancel
1. Expand notes, click the delete button (trash icon)
2. **Verify:** Delete button has aria-label (e.g., "Delete note")
3. **Verify:** Confirmation dialog: "Delete Notes? Are you sure you want to delete your notes? This action cannot be undone."
4. Click "Cancel"
5. **Verify:** Note still exists unchanged

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
5. **Verify:** Photo has descriptive alt text (e.g., "Photo for [recipe name]")
6. **Verify:** File count updates (e.g., "Files (1/5)")
7. Save notes
8. **Verify:** File persisted and visible when viewing notes

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
2. **Verify:** Remove button has aria-label
3. **Verify:** File removed from upload list
4. **Verify:** File count decrements

---

## 9. Meal Planning

### 9.1 Meal Plan Grid
1. Navigate to Meals tab on dashboard
2. **Verify:** "Meal Plan" tab is active by default
3. **Verify:** Weekly grid shows 7 days x 3 meal types (Breakfast, Lunch, Dinner)
4. **Verify:** Current week displayed with day names and dates
5. **Verify:** Date labels are readable (text-sm, not tiny)

### 9.2 Week Navigation
1. Click "Next" arrow
2. **Verify:** Grid shows next week's dates
3. Click "Previous" arrow
4. **Verify:** Grid shows previous week's dates
5. Click "Today" button
6. **Verify:** Grid returns to current week
7. **Verify:** Navigation buttons have aria-labels ("Previous week", "Next week")

### 9.3 Add Meal - Custom
1. Click the "+" button on an empty meal slot
2. **Verify:** Add Meal dialog opens
3. On "Custom" tab, enter a meal name
4. Optionally enter a recipe URL
5. Click "Add Meal"
6. **Verify:** Meal appears in the slot with name displayed

### 9.3a Add Meal - Custom with Manual Ingredients
1. Click "+" on an empty meal slot
2. On "Custom" tab, click "Enter Manually" input mode button
3. Enter a meal name
4. **Verify:** Ingredient entry grid appears (Qty, Unit, Name, Category columns)
5. Enter ingredient details for the meal
6. **Verify:** Category auto-detects from ingredient name
7. Press Enter on last row to auto-add new rows
8. Click "Add Meal"
9. **Verify:** Meal created with linked recipe and manually entered ingredients
10. **Verify:** Ingredients appear in the Groceries tab for this week

### 9.4 Add Meal - From Recipes
1. Click "+" on an empty slot
2. Click "Recipes" tab in the dialog
3. Search for an existing recipe
4. Select one or more recipes
5. Click "Add"
6. **Verify:** Selected recipes appear in the meal slot

### 9.5 Add Meal - Upload Photo/PDF
1. Click "+" on an empty slot
2. On "Custom" tab, click "Upload" button (has text label)
3. Select a recipe photo or PDF
4. **Verify:** Filename shown during upload with spinner
5. **Verify:** URL field auto-populated with storage URL
6. **Verify:** Meal name auto-filled from filename
7. Click "Add Meal"
8. **Verify:** Meal added and parse-recipe triggered in background

### 9.6 Edit Meal
1. Hover over a filled meal slot
2. Click the edit button
3. **Verify:** Edit dialog opens with current meal data pre-filled
4. Change name or URL
5. Save changes
6. **Verify:** Meal updated in place (cooked status preserved if previously cooked)

### 9.7 Remove Meal
1. Hover over a filled meal slot
2. Click the remove button
3. **Verify:** Meal removed from slot

### 9.8 Meal Slot Action Buttons
1. View a filled meal slot
2. **Verify:** Action buttons have visible text labels: "View", "Done" (or "Undo" if cooked), "+"
3. **Verify:** All buttons have aria-labels for accessibility

### 9.9 View Meal Details
1. Click "View" on a meal slot with a recipe
2. **Verify:** Navigates to personal meal detail page (`/meals/{eventId}`)
3. **Verify:** Back button returns to previous page or falls back to `/dashboard/meals`

---

## 10. Meal Completion & Rating

### 10.1 Mark Meal as Cooked (No Recipes)
1. Add a custom meal without a recipe URL
2. Click "Done" on the meal slot
3. **Verify:** Meal immediately marked as cooked (green background, checkmark)
4. **Verify:** "Cooked" text available for screen readers

### 10.2 Mark Meal as Cooked (With Recipes)
1. Add a meal with a recipe URL
2. Click "Done" on the meal slot
3. **Verify:** Rating dialog opens in "rating" mode
4. Rate at least one recipe (star rating + "Would cook again?")
5. Submit ratings
6. **Verify:** Meal marked as cooked (green background, checkmark)
7. **Verify:** Ratings saved to database

### 10.3 Undo Cook
1. On a cooked meal, click "Undo"
2. **Verify:** Confirmation dialog: "Undo cook? This will mark the meal as uncooked. Ratings will be preserved."
3. Click "Cancel" - **Verify:** Meal stays cooked
4. Click "Continue" - **Verify:** Cooked status removed, ratings preserved

### 10.4 Rate from Meal Detail Page
1. Navigate to a personal meal detail page
2. Click "Rate Recipes" in dropdown (if meal has recipes)
3. **Verify:** Rating dialog opens
4. Submit ratings
5. **Verify:** Ratings saved

### 10.5 Edit Recipe Ingredients (from Meal Detail)
1. Navigate to a personal meal detail page (`/meals/{eventId}`)
2. Find a recipe you created with parsed ingredients
3. Click the Edit Ingredients button (ListChecks icon)
4. **Verify:** EditRecipeIngredientsDialog opens with current ingredients
5. Modify ingredients
6. Click "Save"
7. **Verify:** Ingredients updated, grocery cache invalidated (meal_plan context)
8. **Verify:** Grocery list reflects changes

### 10.6 Edit Recipe Name/URL (from Meal Detail)
1. On a personal meal detail page, find a recipe you created
2. Click the edit (pencil) button
3. **Verify:** Edit dialog opens with current name and URL pre-filled
4. Change name and/or URL
5. Save changes
6. **Verify:** Recipe updated; if URL changed, re-parse triggered in background

---

## 11. Meal Groceries

### 11.1 Groceries Tab
1. On Meals page, click "Groceries" tab
2. **Verify:** Week navigation still visible
3. **Verify:** Grocery list shows ingredients from all meals in the current week that have parsed recipes

### 11.2 Groceries - Combined View
1. With multiple meals that have parsed recipes
2. **Verify:** Combined grocery list merges ingredients across recipes
3. **Verify:** Items grouped by category

### 11.3 Groceries - Per-Recipe View
1. Click on individual recipe tabs
2. **Verify:** Each recipe's ingredients shown separately
3. **Verify:** Pantry items filtered from per-recipe views too

### 11.4 Groceries - Pantry Filtering
1. **Verify:** Pantry items excluded from grocery list
2. **Verify:** Prominent banner: "N pantry items excluded from this list"

### 11.5 Groceries - Manage Pantry
1. On Groceries tab, click "Manage Pantry" button
2. **Verify:** Pantry dialog opens
3. Add/remove pantry items
4. Close dialog
5. **Verify:** Grocery list refreshes with updated pantry exclusions

### 11.6 Groceries - Empty States
1. With no meals planned: **Verify:** Message "No meals planned this week. Add meals to see a grocery list."
2. With custom meals but no recipes: **Verify:** Message "Your planned meals don't have linked recipes. Add a recipe URL to see ingredients here."

### 11.7 Groceries - Export
1. Click export menu on grocery list
2. **Verify:** CSV download works
3. **Verify:** Copy to clipboard works

### 11.8 Groceries - Week Navigation
1. Switch to a different week while on Groceries tab
2. **Verify:** Grocery data reloads for the new week

---

## 12. Pantry

### 12.1 My Pantry Dialog (Header)
1. Click user menu in header
2. Click "My Pantry"
3. **Verify:** Pantry dialog opens showing saved pantry items
4. Add/remove items
5. **Verify:** Changes persist after closing and reopening

### 12.2 Pantry - Default Items
1. Open pantry for first time (new user)
2. **Verify:** Default pantry items are pre-populated (salt, pepper, water)

### 12.3 Pantry - Add Item
1. Open pantry dialog
2. Type item name and press Enter (or click Add)
3. **Verify:** Item added to pantry list
4. **Verify:** Success toast: "Added '[item]' to pantry"

### 12.4 Pantry - Add Duplicate Item
1. Try adding an item that's already in the pantry
2. **Verify:** Error toast: "This item is already in your pantry" (specific message, not generic)

### 12.5 Pantry - Remove Item
1. Click remove button (trash icon) on a pantry item
2. **Verify:** Confirmation dialog: "Remove '[item]' from your pantry?"
3. Click "Cancel" - **Verify:** Item still exists
4. Click "Remove" - **Verify:** Item removed from pantry

### 12.6 Pantry - Grocery List Integration
1. Add an item to your pantry that appears in a grocery list
2. Navigate to event detail > Grocery tab
3. **Verify:** That item is excluded from the grocery list
4. **Verify:** Prominent banner shows excluded count
5. Remove the item from your pantry
6. **Verify:** Item reappears in the grocery list

---

## 13. Admin Features

### 13.1 Manage Users - View
1. Log in as admin user
2. Click user menu > "Manage Users"
3. **Verify:** Navigates to `/users`
4. **Verify:** User list displayed with email, role, and club member status

### 13.2 Manage Users - Add User
1. On Users page, find the add user form
2. Enter email address
3. Select role (admin or viewer)
4. Toggle "Include in Club" switch (description: "Club members participate in events and receive calendar invites")
5. Submit
6. **Verify:** New user appears in the list with correct role and club member status

### 13.3 Manage Users - Add User (Expired Session)
1. If session has expired, try adding a user
2. **Verify:** Error toast: "Session expired. Please sign in again."
3. **Verify:** User not added

### 13.4 Manage Users - Change Role
1. Find an existing user (not yourself)
2. Change their role (admin ↔ viewer)
3. **Verify:** Role updated

### 13.5 Manage Users - Toggle Club Member
1. Find an existing user
2. Toggle the "In Club" switch on their row
3. **Verify:** Status updated
4. **Verify:** "Club Member" badge with ChefHat icon appears/disappears on the user row
5. **Verify:** Club members participate in events and receive calendar invites

### 13.6 Manage Users - Delete User
1. Find an existing user (not yourself)
2. Click delete
3. **Verify:** Confirmation dialog shown
4. Confirm deletion
5. **Verify:** User removed from list

### 13.7 Manage Users - Self-Protection
1. Try to change your own role
2. **Verify:** Action prevented / control disabled
3. Try to delete yourself
4. **Verify:** Action prevented

### 13.8 Admin-Only UI Elements
1. Log in as non-admin
2. **Verify:** "Manage Users" not in dropdown menu
3. **Verify:** Edit/Cancel/Complete buttons not shown on events
4. **Verify:** `/users` route redirected or shows access denied

---

## 14. Events List (Events Tab)

### 14.1 Upcoming Events
1. Navigate to Events tab on dashboard
2. **Verify:** Scheduled events listed in ascending date order
3. **Verify:** Each event card shows: ingredient name, date, time, recipe count

### 14.2 Past/Completed Events
1. **Verify:** Completed events listed below upcoming, in descending date order
2. **Verify:** Completed events show without admin action buttons (edit/cancel/complete)
3. **Verify:** Completed events still navigable to detail page

### 14.3 Event Card Navigation
1. Click on an event card
2. **Verify:** Navigates to `/events/{id}` detail page

---

## 15. Responsive Design

### 15.1 Desktop (1280px+)
- Header stats badges visible inline ("Club Events", "Club Recipes")
- Tab labels with icons side-by-side
- Countdown card side-by-side layout (info left, countdown right)
- Meal plan grid shows full 7-day view

### 15.2 Tablet (768px - 1279px)
- Header stats badges still visible (md breakpoint)
- Content may stack slightly

### 15.3 Mobile (<768px)
- Header stats badges hidden (moved to dropdown menu)
- Tab labels shown below icons in compact layout
- Countdown card stacks vertically
- All dialogs use full-width on small screens
- Meal plan grid has horizontal scroll (min-w-[700px])
- Meal slot action buttons have text labels (View, Done, Undo)

---

## 16. Accessibility

### 16.1 Icon Button Labels
1. Tab through the interface using keyboard
2. **Verify:** All icon-only buttons have descriptive aria-labels (e.g., "Edit recipe [name]", "Delete note", "Previous week", "Rate 4 out of 5 stars")
3. **Verify:** Screen reader announces button purposes

### 16.2 Color-Only Indicators
1. View a cooked meal in the meal plan
2. **Verify:** Green cooked state has screen-reader-only "Cooked" text (not just color)

### 16.3 Touch Targets
1. On mobile, verify interactive elements are at least 32x32px (ideally 44x44px)
2. **Verify:** Meal slot action buttons, photo remove buttons, and navigation buttons have adequate padding

### 16.4 Photo Alt Text
1. View recipe notes with photos
2. Inspect photo elements
3. **Verify:** Images have descriptive alt text (e.g., "Photo for [recipe name]")

### 16.5 Star Rating Accessibility
1. Open a rating dialog
2. **Verify:** Each star button has aria-label (e.g., "Rate 3 out of 5 stars")

---

## 17. Email Notifications

### 17.1 Recipe Added Notification
1. Add a recipe to an event (with `RESEND_API_KEY` configured)
2. **Verify:** All club members (except you) receive email notification
3. **Verify:** Email includes recipe name, URL, ingredient, and event date

### 17.2 Recipe URL Updated Notification
1. Edit a recipe and change its URL
2. **Verify:** Club members notified of the update

### 17.3 Recipe Deleted Notification
1. Delete a recipe from a club event (via event detail page)
2. **Verify:** All club members (except you) receive email notification
3. **Verify:** Email subject: "Recipe removed from [ingredient] event"
4. **Verify:** Email includes recipe name, ingredient, and event date
5. **Verify:** Email CTA: "Head to the event to see the latest lineup."

### 17.4 Dev Mode - Notifications Skipped
1. In dev mode (without `RESEND_API_KEY`)
2. Add a recipe
3. **Verify:** No error; notification step silently succeeds

---

## 18. Google Calendar Integration

### 18.1 Calendar Event Created
1. Create a new event via wheel spin (with Google Calendar configured)
2. **Verify:** Google Calendar event created with correct date, time, and ingredient name

### 18.2 Calendar Event Updated
1. Edit an event's date/time
2. **Verify:** Google Calendar event updated to match
3. If sync fails: **Verify:** Toast warning about calendar being out of sync

### 18.3 Calendar Event Deleted
1. Cancel an event
2. **Verify:** Google Calendar event removed

### 18.4 Dev Mode - Calendar Mocked
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
| Meal plan grid requires horizontal scroll on mobile | Known | Grid has `min-w-[700px]`; future improvement to add day/list view |
| PantryContent branch coverage at 94.44% | Accepted | `if (active)` false branch uncovered; not in required coverage directory |
| Grocery cache not invalidated when pantry items change | Known | Pantry changes update filter display but cached combined items remain stale until next combine |
| Edit Ingredients only visible to recipe creator | By design | `createdBy === userId` check determines button visibility |
| Editing a club recipe from RecipeHub or personal meal plan does not notify club members | Known | Notification only fires from EventDetailPage; RecipeHub and PersonalMealDetailPage edits are silent |

---

## Test Environment Notes

- **Auth**: In dev mode, uses email/password auth (not Google OAuth)
- **Google Calendar**: Returns mock data in dev mode
- **Email notifications**: Skipped in dev mode when `RESEND_API_KEY` is missing
- **Edge functions**: Gracefully skip when API keys are missing
- **Feature flag**: `SHOW_PARSE_BUTTONS` in `src/lib/constants.ts` - currently `false` (hides per-recipe parse/re-parse buttons on grocery list; recipe card parse status indicators still visible)
- **File uploads**: Max 5MB, accepts images (JPG, PNG, WebP, HEIC) and PDF. Uploaded to `recipe-images` Supabase storage bucket.
- **Parse-recipe**: Detects file type from URL extension/Content-Type header. PDFs use `type: "document"` in Claude API. Files over 10MB rejected with 413 error.
- **Grocery cache**: Combined grocery lists are cached per context (event or meal_plan). Cache is invalidated when recipe ingredients are edited via `EditRecipeIngredientsDialog`. Smart combine results are stored with per-recipe breakdowns.
- **Category overrides**: AI parser category corrections applied via `CATEGORY_OVERRIDES` map (e.g., olive oil → pantry, tofu → protein).
- **Pantry matching**: Matches items via exact match, plural handling ("olive" ↔ "olives"), name+unit combos ("garlic" + "clove" ↔ "garlic cloves"), and qualifier prefixes ("kosher salt" matches pantry "salt").
