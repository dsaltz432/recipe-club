-- Add color column to ingredients table
ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS color TEXT;

-- Add a comment explaining the column
COMMENT ON COLUMN ingredients.color IS 'Hex color code for the ingredient (e.g., #FF6347 for tomato red)';
