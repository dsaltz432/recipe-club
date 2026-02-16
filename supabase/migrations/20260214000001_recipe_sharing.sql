-- recipe_shares: tracks recipe sharing between users
CREATE TABLE recipe_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  shared_by UUID NOT NULL REFERENCES auth.users(id),
  shared_with_email TEXT NOT NULL,
  message TEXT,
  viewed_at TIMESTAMPTZ,
  shared_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(recipe_id, shared_with_email)
);

-- RLS policies
ALTER TABLE recipe_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view shares they sent or received"
  ON recipe_shares FOR SELECT
  USING (
    auth.uid() = shared_by
    OR shared_with_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

CREATE POLICY "Users can insert shares"
  ON recipe_shares FOR INSERT
  WITH CHECK (auth.uid() = shared_by);

CREATE POLICY "Users can update shares they received (viewed_at)"
  ON recipe_shares FOR UPDATE
  USING (shared_with_email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- Add access_type to allowed_users
ALTER TABLE allowed_users ADD COLUMN IF NOT EXISTS access_type TEXT DEFAULT 'club';

-- Update RLS on recipes to allow shared recipients to read
CREATE POLICY "Recipients can view shared recipes"
  ON recipes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM recipe_shares
      WHERE recipe_shares.recipe_id = recipes.id
      AND recipe_shares.shared_with_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );
