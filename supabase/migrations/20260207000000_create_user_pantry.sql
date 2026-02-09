CREATE TABLE user_pantry_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, name)
);

ALTER TABLE user_pantry_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own pantry" ON user_pantry_items
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can manage own pantry" ON user_pantry_items
  FOR ALL TO authenticated USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
