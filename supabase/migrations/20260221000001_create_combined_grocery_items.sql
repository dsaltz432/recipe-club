-- Combined grocery items cache for meal plan and event contexts
-- Stores AI-combined grocery results to avoid re-running the edge function on every page load

CREATE TABLE IF NOT EXISTS combined_grocery_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  context_type TEXT NOT NULL CHECK (context_type IN ('meal_plan', 'event')),
  context_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  recipe_ids TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (context_type, context_id, user_id)
);

-- Enable Row Level Security
ALTER TABLE combined_grocery_items ENABLE ROW LEVEL SECURITY;

-- Users can only read/write their own rows
CREATE POLICY "Users can select own combined grocery items"
  ON combined_grocery_items FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own combined grocery items"
  ON combined_grocery_items FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own combined grocery items"
  ON combined_grocery_items FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own combined grocery items"
  ON combined_grocery_items FOR DELETE
  USING (auth.uid() = user_id);
