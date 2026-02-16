-- Phase 3: Meal Planning tables

-- User dietary/cuisine preferences for AI
CREATE TABLE user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  dietary_restrictions TEXT[] DEFAULT '{}',
  cuisine_preferences TEXT[] DEFAULT '{}',
  disliked_ingredients TEXT[] DEFAULT '{}',
  household_size INTEGER DEFAULT 2,
  cooking_skill TEXT DEFAULT 'intermediate',
  max_cook_time_minutes INTEGER DEFAULT 60,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own preferences" ON user_preferences
  FOR ALL USING (auth.uid() = user_id);

-- Weekly meal plans
CREATE TABLE meal_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT DEFAULT 'Weekly Plan',
  week_start DATE NOT NULL,
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE meal_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own meal plans" ON meal_plans
  FOR ALL USING (auth.uid() = user_id);

-- Individual meals in a plan
CREATE TABLE meal_plan_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
  recipe_id UUID REFERENCES recipes(id) ON DELETE SET NULL,
  day_of_week INTEGER NOT NULL,
  meal_type TEXT NOT NULL,
  custom_name TEXT,
  custom_url TEXT,
  sort_order INTEGER DEFAULT 0
);

ALTER TABLE meal_plan_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own meal plan items" ON meal_plan_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM meal_plans WHERE meal_plans.id = meal_plan_items.plan_id AND meal_plans.user_id = auth.uid())
  );

-- Grocery cache for meal plans
CREATE TABLE meal_plan_grocery_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL UNIQUE REFERENCES meal_plans(id) ON DELETE CASCADE,
  items JSONB NOT NULL,
  recipe_ids TEXT[] NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE meal_plan_grocery_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own meal plan grocery cache" ON meal_plan_grocery_cache
  FOR ALL USING (
    EXISTS (SELECT 1 FROM meal_plans WHERE meal_plans.id = meal_plan_grocery_cache.plan_id AND meal_plans.user_id = auth.uid())
  );
