-- Create general_grocery_items table for freeform grocery items per user per week
CREATE TABLE IF NOT EXISTS general_grocery_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  context_type TEXT NOT NULL CHECK (context_type IN ('meal_plan', 'event')),
  context_id TEXT NOT NULL,
  name TEXT NOT NULL,
  quantity TEXT,
  unit TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, context_type, context_id, name)
);

-- Enable RLS
ALTER TABLE general_grocery_items ENABLE ROW LEVEL SECURITY;

-- Users can select their own general grocery items
CREATE POLICY "Users can select own general grocery items"
  ON general_grocery_items FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can insert their own general grocery items
CREATE POLICY "Users can insert own general grocery items"
  ON general_grocery_items FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own general grocery items
CREATE POLICY "Users can update own general grocery items"
  ON general_grocery_items FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can delete their own general grocery items
CREATE POLICY "Users can delete own general grocery items"
  ON general_grocery_items FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
