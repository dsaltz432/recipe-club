# Recipe Club Hub - UX Audit

**Date:** 2026-02-19
**Scope:** All user flows in the app post-simplification (US-001 through US-008)
**Method:** Systematic code review of all pages, components, routing, and lib utilities

---

## Table of Contents

1. [Authentication & Onboarding](#1-authentication--onboarding)
2. [Dashboard & Navigation](#2-dashboard--navigation)
3. [Home Tab - Ingredient Wheel & Event Creation](#3-home-tab---ingredient-wheel--event-creation)
4. [Club Events](#4-club-events)
5. [Event Detail Page](#5-event-detail-page)
6. [Recipe Hub](#6-recipe-hub)
7. [Meal Planning](#7-meal-planning)
8. [Grocery Lists](#8-grocery-lists)
9. [Meal Completion & Rating](#9-meal-completion--rating)
10. [Pantry Management](#10-pantry-management)
11. [Recipe Photo/PDF Upload](#11-recipe-photopdf-upload)
12. [Cross-Cutting Concerns](#12-cross-cutting-concerns)
13. [Top 10 Prioritized Improvements](#13-top-10-prioritized-improvements)

---

## 1. Authentication & Onboarding

### Flow
1. User lands on Index.tsx (landing page)
2. If already authenticated, auto-redirects to /dashboard
3. Google Sign-In button (or email form in dev mode)
4. After auth, AuthGuard checks allowed_users table
5. If not in allowed_users, shows "Access Denied" card with Sign Out button
6. If allowed, Dashboard renders

### Findings

| Severity | Issue | Location |
|----------|-------|----------|
| **High** | **No error feedback on sign-in failure.** If Google OAuth or email auth fails, the error is only logged to console. User sees no toast or error message. | `GoogleSignIn.tsx:23-24` |
| **Medium** | **Silent redirect from AuthGuard.** If session expires mid-use, user sees a spinner then gets silently redirected to `/` with no explanation of what happened. | `AuthGuard.tsx:20-25` |
| **Medium** | **No onboarding flow for new users.** After first sign-in, user lands directly on Dashboard with no tour, tips, or explanation of what the app does. The landing page "How It Works" steps are only visible pre-auth. | `Index.tsx`, `Dashboard.tsx` |
| **Low** | **Dev mode password placeholder says "any password"** which is misleading (only correct if user already exists or auto-signup succeeds). | `GoogleSignIn.tsx:54` |

---

## 2. Dashboard & Navigation

### Flow
1. Dashboard has 4 tabs: Home, Events, Recipes, Meals
2. Tabs are URL-driven (/dashboard, /dashboard/events, etc.)
3. Header shows user avatar, event/recipe counts, and dropdown menu
4. Pantry dialog accessible from dropdown menu

### Findings

| Severity | Issue | Location |
|----------|-------|----------|
| **High** | **No way to navigate back to Dashboard from detail pages on mobile.** EventDetailPage and PersonalMealDetailPage have back buttons, but they go to specific tabs (/dashboard/events, /dashboard/meals). If user arrived via a deep link, they may not know about the full Dashboard. | `EventDetailPage.tsx:1156`, `PersonalMealDetailPage.tsx:575` |
| **Medium** | **Tab labels hidden on mobile.** The 4-tab bar shows only icons on mobile (Home, Calendar, BookOpen, CalendarDays). New users may not know what each icon means without labels. | `Dashboard.tsx:280-295` |
| **Medium** | **Pantry is buried in dropdown menu.** Pantry management is a key feature for grocery filtering, but it's hidden behind the user avatar dropdown. Users may never discover it. | `Dashboard.tsx:262-265` |
| **Medium** | **Event/Recipe counts in header are global, not personal.** "N Events" and "N Recipes" count all items, not the user's. This could mislead users about their personal activity. | `Dashboard.tsx:136-155` |
| **Low** | **Stats badges hidden on mobile.** Event/recipe counts only show in a small section within the dropdown on mobile, easy to miss. | `Dashboard.tsx:241-252` |

---

## 3. Home Tab - Ingredient Wheel & Event Creation

### Flow
1. Admin sees: greeting, Ingredient Wheel + Ingredient Bank (side-by-side on desktop)
2. Non-admin sees: greeting + either CountdownCard (if active event) or "No Event Scheduled" empty state
3. Admin spins wheel -> ingredient selected -> date picker dialog -> "Lock In Ingredient" -> event created -> navigates to event detail
4. Ingredient Bank: add/remove/suggest ingredients (admin only)

### Findings

| Severity | Issue | Location |
|----------|-------|----------|
| **High** | **Non-admin dead end.** When no event is scheduled, non-admins see a card saying "No events scheduled yet" with a suggestion to browse Recipes tab. There's no call-to-action button - just text. They can't create events or do anything useful on the Home tab. | `HomeSection.tsx:67-79` |
| **Medium** | **Wheel shows for non-admins but is disabled.** The entire wheel renders but just says "Only admins can spin the wheel." Better to hide the wheel entirely and show a more informative state. | `IngredientWheel.tsx` (disabled state) |
| **Medium** | **No explanation when ingredient bank is full.** When bank reaches MIN_INGREDIENTS_TO_SPIN, the add section silently disappears. Admin gets no message explaining the bank is at capacity. | `IngredientBank.tsx` (conditional render) |
| **Medium** | **Countdown "It's Time!" state has no next step.** When countdown reaches zero, it shows pulsing "It's Time!" text but provides no guidance on what to do next (go to event detail, complete event, etc.). | `CountdownCard.tsx` |
| **Low** | **Time format inconsistency.** CountdownCard formats time as "7:00 PM" while IngredientWheel uses "7:00 pm" (case difference). | `CountdownCard.tsx:53-59` vs `IngredientWheel.tsx:51-55` |

---

## 4. Club Events

### Flow
1. Events tab shows all events (upcoming first ascending, then past descending)
2. Event cards show ingredient name, date/time, recipe count, colored by ingredient
3. Click card -> navigate to event detail
4. Admin controls: Edit (date/time), Complete (opens rating dialog), Cancel (deletes event + recipes)

### Findings

| Severity | Issue | Location |
|----------|-------|----------|
| **Medium** | **No pagination or grouping.** All events load at once. As the club accumulates events over months/years, this list will grow unbounded. No "Past Events" / "Upcoming Events" sections or lazy loading. | `RecipeClubEvents.tsx:140-175` |
| **Medium** | **Cancel event is destructive with no undo.** Cancel permanently deletes the event and all associated recipes (CASCADE). The confirmation dialog warns about recipes but doesn't mention meal plans, Google Calendar events (which are separately deleted), or ratings. | `RecipeClubEvents.tsx:385-413`, `EventDetailPage.tsx:978-1017` |
| **Low** | **Event card click vs action button confusion.** The entire card is clickable (navigates to detail), but action buttons (Edit, Complete, Cancel) also sit on the card with `stopPropagation`. On mobile, it's easy to accidentally navigate when trying to hit a small button. | `RecipeClubEvents.tsx:467-510` |
| **Low** | **No search or filter on events list.** Can't search events by ingredient name, date, or recipe. Must scroll through entire list. | `RecipeClubEvents.tsx` |

---

## 5. Event Detail Page

### Flow
1. Header with back button, ingredient name, "Upcoming" badge
2. Event info card (date, time, recipe count)
3. Three tabs: Recipes, Grocery, Pantry
4. Recipes tab: list of recipes with notes, ratings, photos; add/edit/delete recipes and notes
5. Grocery tab: combined + per-recipe ingredient lists with parse buttons and pantry filtering
6. Pantry tab: manage pantry items inline
7. Admin dropdown: Edit Event, Complete Event, Cancel Event (scheduled); Rate Recipes (completed)

### Findings

| Severity | Issue | Location |
|----------|-------|----------|
| **High** | **Adding a recipe is blocking with no escape.** When adding a recipe, the parse flow shows a progress stepper (saving -> parsing -> loading -> combining -> notifying). During "parsing" state, the dialog cannot be dismissed (onOpenChange checks `parseStatus !== "parsing"`). If the parse-recipe edge function hangs or is slow, the user is stuck. | `EventDetailPage.tsx:1371` |
| **High** | **Parse failure recovery is confusing.** When recipe parsing fails, user gets two buttons: "Keep Recipe Anyway" and "Try Different URL". "Keep Recipe Anyway" adds the recipe without parsed data. "Try Different URL" deletes the recipe and lets user re-enter. The mental model of "recipe was already saved but parsing failed" is non-obvious. | `EventDetailPage.tsx:1433-1448` |
| **Medium** | **Tab default is "recipes" but grocery tab is equally important.** Users adding recipes may not discover the Grocery tab. No visual indicator when grocery data is available. | `EventDetailPage.tsx:1275` |
| **Medium** | **Editing a recipe requires URL.** The edit dialog validates URL as required (`!isValidUrl(editRecipeUrl)`), but recipes can be added without URLs in the personal meal flow. Inconsistency. | `EventDetailPage.tsx:1585` |
| **Medium** | **No recipe reordering.** Recipes are shown in creation order. Users can't drag-to-reorder or sort by name/rating. | `EventRecipesTab.tsx` |
| **Low** | **Photo thumbnails are small.** Note photos are h-20 w-20 (80x80px). Recipe photos from real cameras need larger preview. No lightbox or zoom. | `EventRecipesTab.tsx:251` |

---

## 6. Recipe Hub

### Flow
1. Two sub-tabs: Club Recipes / My Recipes
2. Search bar (filters by recipe name and note text)
3. Ingredient filter dropdown (club tab only)
4. RecipeCard with expandable details (notes, photos, ratings)
5. "Add Recipe" button on personal tab opens AddPersonalRecipeDialog
6. Personal recipes: recipes where created_by = user AND event_id IS NULL

### Findings

| Severity | Issue | Location |
|----------|-------|----------|
| **High** | **No way to edit or delete personal recipes from Recipe Hub.** RecipeCard has no edit/delete buttons. Users must go to the Meal Detail page to manage personal recipes. But personal recipes without meal plan items have no detail page at all. | `RecipeCard.tsx` |
| **High** | **Search doesn't search by ingredient name or recipe creator.** Only matches recipe name and note text. A user searching "chicken" won't find club event recipes tagged with the Chicken ingredient. | `RecipeHub.tsx:112-127` |
| **Medium** | **No recipe count per tab.** Users can't tell how many Club vs Personal recipes they have without counting cards visually. | `RecipeHub.tsx` |
| **Medium** | **No sort options.** Recipes show in creation order only. Can't sort by rating, date, name, or "would cook again" percentage. | `RecipeHub.tsx` |
| **Medium** | **Empty state for personal recipes says "Save a club recipe"** but recipe saving was removed in US-002. The message may be outdated or confusing. | `RecipeHub.tsx` (empty state text) |
| **Low** | **Ingredient filter only on club tab.** Personal recipes also have ingredients (from meals), but no filter is available. | `RecipeHub.tsx:77-93` |
| **Low** | **RecipeCard rating display could be richer.** Shows average stars and "would cook again" percentage, but no breakdown by member or comparison to other recipes. | `RecipeCard.tsx:100-150` |

---

## 7. Meal Planning

### Flow
1. Meals tab in Dashboard shows weekly grid (7 days x 3 meal types)
2. Tab switcher: "Meal Plan" and "Groceries"
3. Week navigation: Previous / Next / Today
4. Click empty slot -> AddMealDialog
5. AddMealDialog has Custom tab (name + URL + file upload) and Recipes tab (search existing recipes)
6. Filled slots show meal names with hover actions (edit, remove, view details, mark cooked)

### Findings

| Severity | Issue | Location |
|----------|-------|----------|
| **High** | **Meal plan grid is not mobile-friendly.** Grid has `min-w-[700px]` forcing horizontal scroll on mobile. A 7-column grid is fundamentally too wide for phone screens. No list/day view alternative. | `MealPlanGrid.tsx:21` |
| **High** | **Icon-only action bar on meal slots.** The bottom bar of a filled MealPlanSlot uses ChefHat, RotateCcw, Check, Plus icons with no labels. Users must hover for tooltip text. On mobile (touch), there are no tooltips at all. | `MealPlanSlot.tsx:90-125` |
| **Medium** | **Edit meal deletes and recreates.** Editing a meal item deletes the old record and inserts a new one. If the insert fails after delete, the meal is lost with no recovery. Also loses `cooked_at` status. | `MealPlanPage.tsx:277-296` |
| **Medium** | **No drag-and-drop for moving meals.** Can't drag a meal from Monday Lunch to Wednesday Dinner. Must delete and recreate. | `MealPlanGrid.tsx` |
| **Medium** | **Week navigation doesn't persist.** If user navigates to a different week, switches tabs (e.g., to Recipes), and comes back to Meals, the week resets to current week. | `MealPlanPage.tsx` (state reset) |
| **Medium** | **"Groceries" tab empty state is misleading.** Shows "Add meals to your plan..." even when meals exist but are custom (no recipe_id). Users with custom-name-only meals see an empty grocery tab despite having meals planned. | `MealPlanPage.tsx:228-236` |
| **Low** | **Date labels in grid are tiny.** Day-of-week abbreviation and M/D date use text-xs (12px). Hard to read on smaller screens. | `MealPlanGrid.tsx:31-36` |
| **Low** | **No meal copy/template feature.** Users planning similar weeks can't copy last week's plan or create meal templates. | `MealPlanPage.tsx` |

---

## 8. Grocery Lists

### Flow
1. Available in two places: Event Detail (Grocery tab) and Meals (Groceries tab)
2. GroceryListSection shows combined view + per-recipe tabs
3. Combined view: smart AI-combined list (if 2+ parsed recipes) or basic combine
4. Per-recipe tabs: individual recipe ingredients with pantry filtering
5. Export as CSV
6. Parse buttons trigger recipe parsing to extract ingredients

### Findings

| Severity | Issue | Location |
|----------|-------|----------|
| **Medium** | **"Smart" vs "Basic" combining is opaque.** Users don't know whether they're seeing AI-combined or basic-combined ingredients. No toggle to switch between views. The combined list silently uses whichever is available. | `GroceryListSection.tsx:55-100` |
| **Medium** | **Grocery items are not interactive.** Can't check off items while shopping, adjust quantities, or add custom items. The list is read-only display. | `GroceryItemRow.tsx` |
| **Medium** | **Pantry exclusion feedback is subtle.** A small text at the bottom says "X items excluded (in pantry)" but it's easy to miss. Users might wonder why items are missing from the list. | `GroceryListSection.tsx:245` |
| **Medium** | **SHOW_PARSE_BUTTONS is false in production.** The parse-recipe button is behind a feature flag set to `false`. Users have no way to trigger recipe parsing manually. Recipes are only parsed on add in EventDetailPage. | `constants.ts:4` |
| **Low** | **CSV export has no format options.** Only CSV available - no print-friendly view, no sharing, no copy-to-clipboard. | `GroceryExportMenu.tsx` |
| **Low** | **Per-recipe tabs overflow with many recipes.** Tab bar has `overflow-x-auto` but no visual scroll indicator. Users may not realize more tabs exist off-screen. | `GroceryListSection.tsx` |

### Consistency between Events and Meals grocery views

| Aspect | Club Events | Meals |
|--------|------------|-------|
| Smart combining (AI) | Yes (with caching) | No |
| Pantry filtering | Yes (combined + per-recipe) | Yes (combined + per-recipe) |
| Parse buttons | Available (behind flag) | Available (behind flag) |
| Export CSV | Yes | Yes |
| Loading states | Yes | Yes |
| Pantry tab alongside | Yes (separate tab) | No (pantry only in dropdown) |

**Key inconsistency:** Club events have a dedicated Pantry tab alongside Grocery and Recipes. Meals have no inline Pantry management - users must go to the Dashboard dropdown. This makes it harder to manage pantry items while viewing the meal grocery list.

---

## 9. Meal Completion & Rating

### Flow
1. MealPlanSlot shows Check icon to mark meals as cooked
2. If slot has recipes with URLs, clicking Check creates a personal event (if needed) then opens EventRatingDialog
3. EventRatingDialog shows each recipe with star rating (1-5) and "Would cook again?" (Yes/No)
4. After rating, meal_plan_items.cooked_at is set
5. Cooked meals show green background with checkmark
6. "Undo Cook" button (RotateCcw icon) resets cooked_at to null
7. PersonalMealDetailPage shows "Rate Recipes" in dropdown for meals with recipes

### Findings

| Severity | Issue | Location |
|----------|-------|----------|
| **High** | **Rating flow creates a hidden "personal event".** When marking a meal as cooked with recipes, the system creates a `scheduled_events` record (type=personal) behind the scenes. This is an implementation detail that leaks into UX - the PersonalMealDetailPage URL is `/meals/{eventId}` but users never explicitly created an "event." | `MealPlanPage.tsx:490-530` |
| **Medium** | **Partially cooked slots aren't indicated.** If a slot has 3 meals and 2 are cooked, the slot shows as "not cooked" (checks `items.every(i => i.cookedAt)`). No partial progress indicator. | `MealPlanSlot.tsx:35` |
| **Medium** | **"Undo Cook" has no confirmation.** Clicking the RotateCcw icon immediately resets cooked_at. No "Are you sure?" dialog. Ratings are preserved but the visual cooked state is lost. | `MealPlanPage.tsx` (handleUncook) |
| **Medium** | **Rating is optional but context is unclear.** When marking a meal as cooked that has recipes, the rating dialog opens. Users may not realize they can skip individual recipe ratings. The dialog says "Rate at least one recipe to submit." | `EventRatingDialog.tsx:144` |
| **Low** | **Cooked meals can't be rated again later.** Once marked as cooked and rated, there's no way to update ratings from the meal plan grid. Must navigate to PersonalMealDetailPage. | `MealPlanSlot.tsx` |

---

## 10. Pantry Management

### Flow
1. Two access points: Dashboard dropdown menu (PantryDialog) and EventDetailPage Pantry tab (PantrySection)
2. Add items via text input + button (or Enter key)
3. Remove items via trash icon (immediate, no confirmation)
4. Default items seeded on first load: salt, pepper, water
5. Pantry items filter out matching ingredients from grocery lists

### Findings

| Severity | Issue | Location |
|----------|-------|----------|
| **Medium** | **No delete confirmation for pantry items.** Clicking trash immediately deletes the item with no confirmation. Unlike recipe/note deletion which shows an AlertDialog. | `PantryDialog.tsx:80-97`, `PantrySection.tsx:78-95` |
| **Medium** | **Duplicate code.** PantryDialog.tsx and PantrySection.tsx are nearly identical (~156 lines each) with minor differences (Dialog wrapper vs Card wrapper, max-height). Should be a single component with variant prop. | Both pantry files |
| **Low** | **No success feedback on add.** Adding a pantry item clears the input but shows no toast or visual confirmation. Error toast appears only on failure. | `PantryDialog.tsx:55-63` |
| **Low** | **Generic error message.** Error toast says "Failed to add item. It may already exist." regardless of actual error. Could be a network error, permission issue, etc. | `PantryDialog.tsx:61` |
| **Low** | **Pantry not accessible from Meals grocery view.** When viewing the Meals Groceries tab, there's no link to manage pantry items. Must navigate away to the Dashboard dropdown. | `MealPlanPage.tsx` |

---

## 11. Recipe Photo/PDF Upload

### Flow
1. EventDetailPage "Add Recipe" dialog has upload button alongside URL input
2. AddMealDialog Custom tab has upload button alongside URL input
3. Upload goes to Supabase 'recipe-images' bucket
4. File type validation: images + PDF, max 5MB
5. After upload, public URL is set as recipe URL
6. parse-recipe edge function handles images/PDFs via Claude vision API

### Findings

| Severity | Issue | Location |
|----------|-------|----------|
| **Medium** | **Upload button has no label.** Just an Upload icon. Users may not understand what it does without hovering. No tooltip on mobile. | `EventDetailPage.tsx:1474-1486`, `AddMealDialog.tsx:226-240` |
| **Medium** | **No upload progress indicator.** Only a spinner replaces the upload icon. No percentage, no file name shown. For large images on slow connections, user has no idea of progress. | Both upload flows |
| **Medium** | **PersonalMealDetailPage upload doesn't trigger parsing.** EventDetailPage has a full parse-on-add flow with progress stepper. PersonalMealDetailPage's "Add Recipe" just saves the recipe with the storage URL but doesn't invoke parse-recipe. Inconsistent behavior. | `PersonalMealDetailPage.tsx:341-372` |
| **Low** | **HEIC support mentioned in PRD but not in accept attribute.** The file input accepts `image/*,.pdf` which should include HEIC on iOS, but explicit HEIC handling isn't verified. | `EventDetailPage.tsx:1490` |
| **Low** | **File upload clears name auto-fill logic inconsistency.** In AddMealDialog, uploading a file auto-fills the meal name from filename. But in EventDetailPage, it only fills the URL. Different behaviors in similar flows. | `AddMealDialog.tsx:107-111` vs `EventDetailPage.tsx:588-632` |

---

## 12. Cross-Cutting Concerns

### Error Handling Patterns
| Pattern | Used In | Assessment |
|---------|---------|------------|
| Toast on error | Most components | Good - consistent use of sonner |
| Console.error | All async operations | Good for debugging |
| Try/catch | All Supabase calls | Good coverage |
| Error state UI | Only EventDetailPage parse flow | Most components have no inline error display |
| Retry mechanism | Only EventDetailPage ("Try Different URL") | No retry buttons elsewhere |

### Loading State Patterns
| Pattern | Used In | Assessment |
|---------|---------|------------|
| Full-page spinner | Dashboard, EventDetailPage, PersonalMealDetailPage | Good |
| Button spinner | Most submit buttons | Good |
| Inline loading | GroceryListSection (isLoading prop) | Inconsistent |
| Skeleton loading | Not used anywhere | Missing |

### Empty State Patterns
| Component | Empty State | Quality |
|-----------|------------|---------|
| RecipeClubEvents | "No events yet. Spin the wheel!" | Good - actionable |
| RecipeHub (club) | "No recipes yet" | Medium - no action guidance |
| RecipeHub (personal) | "Add one or save a club recipe" | Poor - saving was removed |
| MealPlanGrid | Empty slots with + button | Good - clear affordance |
| GroceryListSection | "No ingredients parsed yet" | Medium - doesn't explain how to fix |
| EventRecipesTab | "No recipes locked in yet" with Add button | Good - actionable |
| CountdownCard (no event) | "No events scheduled" | Medium - non-admin can't act |

### Accessibility
- Color-only status indicators (green for cooked, no text alternative)
- Icon-only buttons throughout meal plan (no aria-labels observed in code)
- Small touch targets (h-3 w-3 icons = 12x12px, below 44px recommendation)
- No keyboard navigation testing for wheel spin
- Photo thumbnails have no alt text
- Dialog focus management handled by Radix UI (good)

---

## 13. Top 10 Prioritized Improvements

Ranked by user impact (frequency x severity).

### 1. **Mobile-responsive meal plan view** (Critical)
**Problem:** The 7-column grid requires 700px minimum width, forcing horizontal scroll on all phones. The meal plan is a daily-use feature rendered unusable on the most common device type.
**Recommendation:** Add a day-view or list-view alternative for screens under 640px. Show one day at a time with swipe navigation or a vertical scrollable list of today's meals.

### 2. **Add edit/delete for personal recipes in Recipe Hub** (Critical)
**Problem:** Users can add personal recipes but can never edit or delete them from the Recipe Hub. The only management path is through meal detail pages, which many personal recipes don't have.
**Recommendation:** Add edit (pencil) and delete (trash) buttons to RecipeCard when the recipe is personal (created_by === current user, event_id === null). Reuse the existing edit/delete patterns from EventDetailPage.

### 3. **Label icon-only buttons in meal plan slots** (High)
**Problem:** The meal plan slot action bar uses 4 icons (ChefHat, RotateCcw, Check, Plus) with no labels. Touch devices don't support hover tooltips. Users can't discover functionality.
**Recommendation:** Add text labels below icons (e.g., "Details", "Undo", "Done", "Add") or use a long-press menu on mobile. At minimum, add `aria-label` attributes for accessibility.

### 4. **Fix Recipe Hub search to include ingredient and creator** (High)
**Problem:** Searching for "chicken" doesn't find Chicken event recipes. Users expect full-text search across recipe name, ingredient name, and creator name.
**Recommendation:** Extend the search filter in RecipeHub to also match `ingredientName`, `createdByName`, and recipe URL domain.

### 5. **Add auth error feedback** (High)
**Problem:** Sign-in failures (Google OAuth errors, network issues) are silently logged to console. Users see a spinning button that never resolves.
**Recommendation:** Add toast.error() in the catch block of signInWithGoogle(). Add a timeout and error state to the loading indicator.

### 6. **Make pantry accessible from Meals grocery view** (Medium)
**Problem:** When viewing the Meals Groceries tab, there's no way to manage pantry items without navigating away to the Dashboard dropdown menu. Club events have an inline Pantry tab.
**Recommendation:** Add a Pantry tab alongside "Meal Plan" and "Groceries" in MealPlanPage, or add a "Manage Pantry" link/button within the Groceries tab. Reuse PantrySection component.

### 7. **Fix empty state for personal recipes** (Medium)
**Problem:** Personal recipes empty state says "save a club recipe" but recipe saving was removed. Misleading text directs users to a non-existent feature.
**Recommendation:** Update empty state text to: "No personal recipes yet. Add one from the Meals tab or click 'Add Recipe' above." with an actionable button.

### 8. **Add grocery list check-off functionality** (Medium)
**Problem:** The grocery list is read-only. Users shopping in-store can't check off items as they buy them. This makes the list less useful as a practical shopping tool.
**Recommendation:** Add checkbox toggles for each grocery item with local state (or persisted to DB). Show checked items with strikethrough. Add "Uncheck All" reset button.

### 9. **Add sort and recipe count to Recipe Hub** (Medium)
**Problem:** Recipes show in creation order with no way to sort by rating, date, or name. No indication of total recipe count per tab.
**Recommendation:** Add a sort dropdown (Newest, Highest Rated, A-Z, Would Cook Again %) and display tab counts as badges (e.g., "Club (24)" / "Personal (8)").

### 10. **Add session expiry feedback** (Medium)
**Problem:** When a session expires, AuthGuard silently redirects to the landing page. Users lose context with no explanation.
**Recommendation:** Show a toast ("Your session has expired. Please sign in again.") before redirecting. Consider auto-refreshing tokens before expiry.

---

## Additional Recommendations (Beyond Top 10)

### Quick Wins (Low effort, notable impact)
- Add delete confirmation dialog for pantry items (consistency with note/recipe deletion)
- Add loading/error toast for sign-in flow
- Show "X pantry items excluded" more prominently in grocery lists
- Fix time format inconsistency (AM vs am) across CountdownCard and IngredientWheel
- Add "Today" indicator to week navigation (highlight current day in grid)

### Medium Effort
- Add recipe sorting in RecipeHub (by rating, date, name)
- Add pagination or "Load More" to events list for clubs with many events
- Add copy/template feature to meal plans
- Consolidate PantryDialog and PantrySection into a single component with variant prop
- Add search to events list (by ingredient, date)
- Add drag-and-drop meal reordering in grid

### Large Effort (Future consideration)
- Offline-capable grocery list with sync
- Collaborative meal planning (share plan with household)
- Recipe import from URL without event context
- Print-friendly grocery list view
- Meal plan templates / recurring meals
