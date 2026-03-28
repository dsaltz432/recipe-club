-- Create recipe_tags table for personal per-user recipe labels
CREATE TABLE IF NOT EXISTS recipe_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE recipe_tags ENABLE ROW LEVEL SECURITY;

-- Users can read all tags (so club members can see each other's labels)
CREATE POLICY "recipe_tags_select" ON recipe_tags
  FOR SELECT USING (true);

-- Users can only insert/update/delete their own tags
CREATE POLICY "recipe_tags_insert" ON recipe_tags
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "recipe_tags_delete" ON recipe_tags
  FOR DELETE USING (auth.uid() = user_id);

-- Index for fast lookups by user
CREATE INDEX IF NOT EXISTS recipe_tags_user_id_idx ON recipe_tags (user_id);
-- Index for fast lookups by recipe
CREATE INDEX IF NOT EXISTS recipe_tags_recipe_id_idx ON recipe_tags (recipe_id);
