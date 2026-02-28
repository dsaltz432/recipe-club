-- Add meal_types and week_start_day columns to user_preferences table
-- meal_types: which meals appear in the meal plan grid (any subset of breakfast/lunch/dinner)
-- week_start_day: 0=Sunday (default), 1=Monday

ALTER TABLE user_preferences
ADD COLUMN IF NOT EXISTS meal_types TEXT[] NOT NULL DEFAULT '{breakfast,lunch,dinner}';

ALTER TABLE user_preferences
ADD COLUMN IF NOT EXISTS week_start_day INTEGER NOT NULL DEFAULT 0;

-- Ensure week_start_day is either 0 (Sunday) or 1 (Monday)
ALTER TABLE user_preferences
ADD CONSTRAINT week_start_day_check CHECK (week_start_day IN (0, 1));
