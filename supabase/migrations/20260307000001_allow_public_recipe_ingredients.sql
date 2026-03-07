-- Allow unauthenticated (anon) users to read recipe_ingredients and recipe_content.
-- Required so the public /recipes/:id share page can show ingredient lists without auth.

CREATE POLICY "Anyone can view recipe ingredients"
  ON recipe_ingredients FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anyone can view recipe content"
  ON recipe_content FOR SELECT
  TO anon
  USING (true);
