-- RPC to detach event recipes that are referenced by meal plan items.
-- Runs as SECURITY DEFINER so it can see meal_plan_items across all users.
CREATE OR REPLACE FUNCTION detach_meal_plan_recipes(p_event_id UUID)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE recipes
  SET event_id = NULL
  WHERE event_id = p_event_id
    AND id IN (SELECT recipe_id FROM meal_plan_items WHERE recipe_id IS NOT NULL);
$$;
