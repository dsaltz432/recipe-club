-- Allow unauthenticated (anon) users to read recipe_tips.
-- Required so the public /recipes/:id share page can show tips without auth.

CREATE POLICY "Anyone can view recipe tips"
  ON recipe_tips FOR SELECT
  TO anon
  USING (true);
