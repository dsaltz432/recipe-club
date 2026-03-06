-- Allow authenticated users to insert recipe ingredients directly from the client.
-- Previously only service_role (edge functions) could insert; this blocked
-- client-side add-ingredient flows in RecipeIngredientList.

CREATE POLICY "Authenticated users can insert recipe ingredients"
  ON recipe_ingredients FOR INSERT
  TO authenticated
  WITH CHECK (true);
