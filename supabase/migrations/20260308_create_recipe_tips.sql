CREATE TABLE recipe_tips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  tip_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS policies
ALTER TABLE recipe_tips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recipe_tips_select" ON recipe_tips
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "recipe_tips_insert" ON recipe_tips
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "recipe_tips_delete" ON recipe_tips
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
