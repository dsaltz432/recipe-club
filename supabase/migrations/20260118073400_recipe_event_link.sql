-- ============================================================================
-- MIGRATION: Recipe-Event Direct Link & Rename Contributions to Notes
-- Date: 2026-01-18
--
-- Changes:
-- 1. Add event_id to recipes table (recipe belongs to one event)
-- 2. Add ingredient_id to recipes table (recipe links to ingredient)
-- 3. Rename recipe_contributions to recipe_notes
-- 4. Remove event_id from recipe_notes (redundant - get via recipe)
-- 5. Update constraints on recipe_notes
--
-- This makes recipes event-specific and recipe_notes purely for user notes
-- ============================================================================

BEGIN;

-- ============================================================================
-- PART 1: ADD COLUMNS TO RECIPES TABLE
-- ============================================================================

-- Step 1.1: Add event_id and ingredient_id columns to recipes
ALTER TABLE recipes
ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES scheduled_events(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS ingredient_id UUID REFERENCES ingredients(id);

-- Step 1.2: Migrate data - populate event_id and ingredient_id from recipe_contributions
UPDATE recipes r
SET
  event_id = rc.event_id,
  ingredient_id = se.ingredient_id
FROM recipe_contributions rc
JOIN scheduled_events se ON se.id = rc.event_id
WHERE rc.recipe_id = r.id
  AND rc.event_id IS NOT NULL
  AND r.event_id IS NULL;

-- Step 1.3: Create indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_recipes_event_id ON recipes(event_id);
CREATE INDEX IF NOT EXISTS idx_recipes_ingredient_id ON recipes(ingredient_id);

-- ============================================================================
-- PART 2: RENAME AND CLEAN UP RECIPE_CONTRIBUTIONS -> RECIPE_NOTES
-- ============================================================================

-- Step 2.1: Drop constraints and indexes that reference old table/column names
ALTER TABLE recipe_contributions DROP CONSTRAINT IF EXISTS recipe_contributions_event_id_fkey;
ALTER TABLE recipe_contributions DROP CONSTRAINT IF EXISTS recipe_contributions_recipe_id_user_id_event_id_key;
DROP INDEX IF EXISTS idx_recipe_contributions_event;
DROP INDEX IF EXISTS idx_recipe_contributions_recipe;
DROP INDEX IF EXISTS idx_recipe_contributions_user;

-- Step 2.2: Remove the event_id column (now redundant - on recipes table)
ALTER TABLE recipe_contributions DROP COLUMN IF EXISTS event_id;

-- Step 2.3: Delete rows that have no notes and no photos (just links, no longer needed)
DELETE FROM recipe_contributions
WHERE (notes IS NULL OR notes = '')
  AND (photos IS NULL OR array_length(photos, 1) IS NULL);

-- Step 2.4: Delete any remaining rows with null user_id
DELETE FROM recipe_contributions WHERE user_id IS NULL;

-- Step 2.5: Make user_id required
ALTER TABLE recipe_contributions ALTER COLUMN user_id SET NOT NULL;

-- Step 2.6: Rename the table
ALTER TABLE recipe_contributions RENAME TO recipe_notes;

-- Step 2.7: Rename constraints to match new table name
ALTER TABLE recipe_notes RENAME CONSTRAINT recipe_contributions_pkey TO recipe_notes_pkey;
ALTER TABLE recipe_notes RENAME CONSTRAINT recipe_contributions_recipe_id_fkey TO recipe_notes_recipe_id_fkey;
ALTER TABLE recipe_notes RENAME CONSTRAINT recipe_contributions_user_id_fkey TO recipe_notes_user_id_fkey;

-- Step 2.8: Add new unique constraint (one note per user per recipe)
ALTER TABLE recipe_notes
ADD CONSTRAINT recipe_notes_recipe_id_user_id_key UNIQUE(recipe_id, user_id);

-- Step 2.9: Recreate indexes with new names
CREATE INDEX idx_recipe_notes_recipe ON recipe_notes(recipe_id);
CREATE INDEX idx_recipe_notes_user ON recipe_notes(user_id);

-- Step 2.10: Update RLS policies to use new table name
DROP POLICY IF EXISTS "Anyone can view contributions" ON recipe_notes;
DROP POLICY IF EXISTS "Authenticated users can insert contributions" ON recipe_notes;
DROP POLICY IF EXISTS "Users can update their own contributions" ON recipe_notes;
DROP POLICY IF EXISTS "Users can delete their own contributions or admins can delete any" ON recipe_notes;

CREATE POLICY "Anyone can view notes" ON recipe_notes
FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert notes" ON recipe_notes
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update their own notes" ON recipe_notes
FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own notes or admins can delete any" ON recipe_notes
FOR DELETE USING (user_id = auth.uid() OR current_user_is_admin());

-- ============================================================================
-- PART 3: UPDATE RECIPE_RATINGS (remove event_id, get via recipe)
-- ============================================================================

-- Note: Keeping event_id on recipe_ratings for now since a user might rate
-- a recipe differently at different events. If we want to simplify later,
-- we can remove it in another migration.

COMMIT;
