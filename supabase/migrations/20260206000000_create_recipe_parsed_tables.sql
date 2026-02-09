-- Table: recipe_content — full parsed recipe data
CREATE TABLE recipe_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL UNIQUE REFERENCES recipes(id) ON DELETE CASCADE,
  description TEXT,
  servings TEXT,
  prep_time TEXT,
  cook_time TEXT,
  total_time TEXT,
  instructions JSONB,
  source_title TEXT,
  parsed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Table: recipe_ingredients — structured ingredient list for grocery list
CREATE TABLE recipe_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity DECIMAL,
  unit TEXT,
  category TEXT NOT NULL DEFAULT 'other',
  raw_text TEXT,
  sort_order INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_recipe_content_recipe_id ON recipe_content(recipe_id);
CREATE INDEX idx_recipe_ingredients_recipe_id ON recipe_ingredients(recipe_id);
CREATE INDEX idx_recipe_ingredients_category ON recipe_ingredients(category);

-- RLS policies
ALTER TABLE recipe_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_ingredients ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read
CREATE POLICY "Authenticated users can view recipe content"
  ON recipe_content FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can view recipe ingredients"
  ON recipe_ingredients FOR SELECT
  TO authenticated
  USING (true);

-- Service role can do everything (edge functions use service role key)
CREATE POLICY "Service role can manage recipe content"
  ON recipe_content FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage recipe ingredients"
  ON recipe_ingredients FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
