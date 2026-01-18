-- ============================================================================
-- MIGRATION: Ingredient Reuse, Recipe Contributions & Recipe Ratings
-- Date: 2026-01-17
--
-- This migration implements three major changes:
-- 1. Ingredient Reuse - Track usage count instead of boolean, add in_bank flag
-- 2. Recipe Contributions - Split recipes into canonical definitions + user contributions
-- 3. Recipe Ratings - Add rating system for recipes
--
-- IMPORTANT: Run this migration in a single transaction. If any part fails,
-- the entire migration will be rolled back.
-- ============================================================================

BEGIN;

-- ============================================================================
-- PART 1: INGREDIENTS SCHEMA MIGRATION
-- Change from boolean is_used to integer used_count, add in_bank flag
-- ============================================================================

-- Step 1.1: Add new columns
ALTER TABLE ingredients
ADD COLUMN IF NOT EXISTS used_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_used_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS in_bank BOOLEAN DEFAULT true;

-- Step 1.2: Migrate existing data
UPDATE ingredients
SET
  used_count = CASE WHEN is_used = true THEN 1 ELSE 0 END,
  last_used_date = used_date,
  in_bank = (is_used = false) -- Unused ingredients are in the bank, used ones are not
WHERE used_count IS NULL OR used_count = 0;

-- Step 1.3: Rename used_by to last_used_by for clarity
ALTER TABLE ingredients RENAME COLUMN used_by TO last_used_by;

-- Step 1.4: Drop old columns
ALTER TABLE ingredients DROP COLUMN IF EXISTS is_used;
ALTER TABLE ingredients DROP COLUMN IF EXISTS used_date;

-- Step 1.5: Add NOT NULL constraint now that data is migrated
ALTER TABLE ingredients ALTER COLUMN used_count SET NOT NULL;
ALTER TABLE ingredients ALTER COLUMN in_bank SET NOT NULL;

-- Step 1.6: Add index for bank filtering
CREATE INDEX IF NOT EXISTS idx_ingredients_in_bank ON ingredients(in_bank);

-- ============================================================================
-- PART 2: RECIPES SCHEMA MIGRATION
-- Split recipes into canonical definitions + user contributions
-- ============================================================================

-- Step 2.1: Create new recipes table (canonical recipe definitions)
CREATE TABLE IF NOT EXISTS recipes_new (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  url TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 2.2: Create index for recipe name search (not unique per user clarification)
-- Per user clarification: every recipe added is assumed different, OK if two have same name
-- The autocomplete will suggest existing recipes but won't prevent duplicates
CREATE INDEX IF NOT EXISTS idx_recipes_name ON recipes_new (LOWER(name));

-- Step 2.3: Create recipe_contributions table
CREATE TABLE IF NOT EXISTS recipe_contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES recipes_new(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  event_id UUID REFERENCES scheduled_events(id) ON DELETE CASCADE,
  notes TEXT,
  photos TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- Each user can only have one contribution per recipe per event
  UNIQUE(recipe_id, user_id, event_id)
);

-- Step 2.4: Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_recipe_contributions_recipe ON recipe_contributions(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_contributions_user ON recipe_contributions(user_id);
CREATE INDEX IF NOT EXISTS idx_recipe_contributions_event ON recipe_contributions(event_id);

-- Step 2.5: Migrate existing recipe data (if old recipes table exists)
-- Create temp table to track old_id -> new_id mapping for migration
CREATE TEMP TABLE recipe_id_map (
  old_id UUID,
  new_id UUID
);

-- Insert recipes and track the mapping
INSERT INTO recipes_new (name, url, created_by, created_at)
SELECT
  name,
  url,
  user_id as created_by,
  created_at
FROM recipes;

-- Create mapping by matching on all fields (since no unique constraint)
INSERT INTO recipe_id_map (old_id, new_id)
SELECT r.id as old_id, rn.id as new_id
FROM recipes r
JOIN recipes_new rn ON
  rn.name = r.name AND
  COALESCE(rn.url, '') = COALESCE(r.url, '') AND
  COALESCE(rn.created_by::text, '') = COALESCE(r.user_id::text, '') AND
  rn.created_at = r.created_at;

-- Step 2.6: Insert contributions (map old recipe to new, link to event_id)
INSERT INTO recipe_contributions (recipe_id, user_id, event_id, notes, photos, created_at)
SELECT
  rim.new_id as recipe_id,
  r.user_id,
  se.id as event_id,
  r.notes,
  r.photos,
  r.created_at
FROM recipes r
JOIN recipe_id_map rim ON rim.old_id = r.id
LEFT JOIN scheduled_events se ON se.event_date = r.event_date AND se.ingredient_id = r.ingredient_id
ON CONFLICT (recipe_id, user_id, event_id) DO NOTHING;

-- Step 2.7: Drop old recipes table and rename new one
DROP TABLE IF EXISTS recipes;
ALTER TABLE recipes_new RENAME TO recipes;

-- Drop temp table
DROP TABLE IF EXISTS recipe_id_map;

-- Step 2.8: Set up RLS policies for recipes table
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view recipes" ON recipes
FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert recipes" ON recipes
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update their own recipes or admins can update any" ON recipes
FOR UPDATE USING (created_by = auth.uid() OR current_user_is_admin());

CREATE POLICY "Users can delete their own recipes or admins can delete any" ON recipes
FOR DELETE USING (created_by = auth.uid() OR current_user_is_admin());

-- Step 2.9: Set up RLS policies for recipe_contributions table
ALTER TABLE recipe_contributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view contributions" ON recipe_contributions
FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert contributions" ON recipe_contributions
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update their own contributions" ON recipe_contributions
FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own contributions or admins can delete any" ON recipe_contributions
FOR DELETE USING (user_id = auth.uid() OR current_user_is_admin());

-- ============================================================================
-- PART 3: RECIPE RATINGS SCHEMA
-- Add rating system for recipes
-- ============================================================================

-- Step 3.1: Create recipe_ratings table
CREATE TABLE IF NOT EXISTS recipe_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  event_id UUID NOT NULL REFERENCES scheduled_events(id) ON DELETE CASCADE,
  would_cook_again BOOLEAN NOT NULL,
  overall_rating INTEGER NOT NULL CHECK (overall_rating >= 1 AND overall_rating <= 5),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- Each user can only rate a recipe once per event
  UNIQUE(recipe_id, user_id, event_id)
);

-- Step 3.2: Create indexes
CREATE INDEX IF NOT EXISTS idx_recipe_ratings_recipe ON recipe_ratings(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_ratings_user ON recipe_ratings(user_id);
CREATE INDEX IF NOT EXISTS idx_recipe_ratings_event ON recipe_ratings(event_id);

-- Step 3.3: Set up RLS policies
ALTER TABLE recipe_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view ratings" ON recipe_ratings
FOR SELECT USING (true);

-- Per user clarification: Only club members (in allowed_users table) can rate
CREATE POLICY "Club members can insert ratings" ON recipe_ratings
FOR INSERT WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM allowed_users au
    JOIN auth.users u ON au.email = u.email
    WHERE u.id = auth.uid()
  )
);

CREATE POLICY "Users can update their own ratings" ON recipe_ratings
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own ratings" ON recipe_ratings
FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- VERIFICATION QUERIES
-- Run these after the migration to verify data integrity
-- ============================================================================

-- Verify ingredients migration
-- SELECT 'Ingredients' as table_name, COUNT(*) as count FROM ingredients;

-- Verify recipes migration
-- SELECT 'Recipes' as table_name, COUNT(*) as count FROM recipes;

-- Verify recipe_contributions migration
-- SELECT 'Recipe Contributions' as table_name, COUNT(*) as count FROM recipe_contributions;

-- Verify recipe_ratings table exists
-- SELECT 'Recipe Ratings' as table_name, COUNT(*) as count FROM recipe_ratings;

-- Show ingredients summary
-- SELECT name, used_count, in_bank, last_used_date FROM ingredients ORDER BY name;

COMMIT;

-- ============================================================================
-- ROLLBACK SCRIPT (if needed, run these manually)
-- ============================================================================
--
-- -- Rollback recipe_ratings
-- DROP TABLE IF EXISTS recipe_ratings;
--
-- -- Rollback recipe_contributions (complex - requires restoring old recipes table)
-- -- You would need to restore from backup
--
-- -- Rollback ingredients
-- ALTER TABLE ingredients ADD COLUMN is_used BOOLEAN DEFAULT false;
-- ALTER TABLE ingredients ADD COLUMN used_date TIMESTAMPTZ;
-- UPDATE ingredients SET is_used = (used_count > 0), used_date = last_used_date;
-- ALTER TABLE ingredients DROP COLUMN used_count;
-- ALTER TABLE ingredients DROP COLUMN last_used_date;
-- ALTER TABLE ingredients DROP COLUMN in_bank;
-- ALTER TABLE ingredients RENAME COLUMN last_used_by TO used_by;
