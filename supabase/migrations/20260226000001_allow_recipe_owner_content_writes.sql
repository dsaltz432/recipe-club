-- Allow recipe creators to insert and update recipe_content from the client
-- (needed for manual ingredient entry setting status to 'completed')

CREATE POLICY "Recipe creators can insert recipe content"
  ON recipe_content FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM recipes WHERE id = recipe_content.recipe_id AND created_by = auth.uid()
  ));

CREATE POLICY "Recipe creators can update recipe content"
  ON recipe_content FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM recipes WHERE id = recipe_content.recipe_id AND created_by = auth.uid()
  ));
