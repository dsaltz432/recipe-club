ALTER TABLE combined_grocery_items ADD COLUMN IF NOT EXISTS display_name_map jsonb DEFAULT '{}';
