-- Add checked_items column to combined_grocery_items table
-- Stores an array of item name strings representing crossed-off items
ALTER TABLE combined_grocery_items
ADD COLUMN IF NOT EXISTS checked_items jsonb NOT NULL DEFAULT '[]'::jsonb;
