-- Consolidate grocery caching into combined_grocery_items table
-- Drop the old event_grocery_cache and meal_plan_grocery_cache tables
-- Neither table has production data

DROP TABLE IF EXISTS event_grocery_cache;
DROP TABLE IF EXISTS meal_plan_grocery_cache;
