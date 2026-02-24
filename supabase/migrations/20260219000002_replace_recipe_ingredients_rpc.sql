-- RPC function to atomically replace recipe ingredients in a single transaction.
-- This prevents data loss from partial failure during the delete-then-insert pattern.
CREATE OR REPLACE FUNCTION replace_recipe_ingredients(
  p_recipe_id UUID,
  p_ingredients JSONB
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete existing ingredients
  DELETE FROM recipe_ingredients WHERE recipe_id = p_recipe_id;

  -- Insert new ingredients (if any)
  IF jsonb_array_length(p_ingredients) > 0 THEN
    INSERT INTO recipe_ingredients (recipe_id, name, quantity, unit, category, raw_text, sort_order)
    SELECT
      p_recipe_id,
      ing->>'name',
      (ing->>'quantity')::decimal,
      ing->>'unit',
      COALESCE(ing->>'category', 'other'),
      ing->>'raw_text',
      (ing->>'sort_order')::int
    FROM jsonb_array_elements(p_ingredients) AS ing;
  END IF;
END;
$$;
