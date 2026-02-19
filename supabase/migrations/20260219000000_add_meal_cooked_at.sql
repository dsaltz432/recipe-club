-- Add cooked_at column to meal_plan_items for tracking meal completion
ALTER TABLE meal_plan_items ADD COLUMN cooked_at TIMESTAMPTZ;
