-- Allow authenticated users to update and delete recipe ingredients
-- so they can edit/remove items from per-recipe grocery tabs.

DROP POLICY IF EXISTS "Authenticated users can update recipe ingredients" ON recipe_ingredients;
CREATE POLICY "Authenticated users can update recipe ingredients"
  ON recipe_ingredients FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can delete recipe ingredients" ON recipe_ingredients;
CREATE POLICY "Authenticated users can delete recipe ingredients"
  ON recipe_ingredients FOR DELETE
  TO authenticated
  USING (true);
