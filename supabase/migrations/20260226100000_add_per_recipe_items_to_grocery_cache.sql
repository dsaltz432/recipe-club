-- Add per_recipe_items column to combined_grocery_items table
-- Stores AI-generated per-recipe combined items (replaces display_name_map concept)
ALTER TABLE combined_grocery_items
ADD COLUMN IF NOT EXISTS per_recipe_items jsonb DEFAULT '{}';
