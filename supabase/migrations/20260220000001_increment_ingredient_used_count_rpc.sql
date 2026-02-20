-- Atomic increment for ingredient used_count to prevent race conditions (BUG-005/006)
CREATE OR REPLACE FUNCTION increment_ingredient_used_count(
  p_ingredient_id UUID,
  p_user_id UUID DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  UPDATE ingredients
  SET
    used_count = used_count + 1,
    last_used_date = now(),
    last_used_by = COALESCE(p_user_id, last_used_by)
  WHERE id = p_ingredient_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
