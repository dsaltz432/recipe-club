-- ============================================================================
-- BASELINE SCHEMA: Recipe Club Hub
-- Date: 2026-01-17
--
-- This captures the full production schema as of before the 20260118 migrations.
-- It creates all tables, indexes, RLS policies, functions, and triggers
-- needed for a fresh local Supabase instance.
-- ============================================================================

-- ============================================================================
-- EXTENSIONS
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

-- ============================================================================
-- TABLES
-- ============================================================================

-- Allowed users (access control list)
CREATE TABLE IF NOT EXISTS allowed_users (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'viewer')),
  is_club_member BOOLEAN NOT NULL DEFAULT false,
  invited_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User profiles (auto-created on signup)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ingredients for the wheel
CREATE TABLE IF NOT EXISTS ingredients (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  used_count INTEGER NOT NULL DEFAULT 0,
  last_used_by UUID REFERENCES profiles(id),
  last_used_date TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  in_bank BOOLEAN NOT NULL DEFAULT true
);

-- Scheduled events
CREATE TABLE IF NOT EXISTS scheduled_events (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  ingredient_id UUID REFERENCES ingredients(id),
  event_date DATE NOT NULL,
  event_time TEXT,
  created_by UUID REFERENCES profiles(id),
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'canceled')),
  calendar_event_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Recipes
CREATE TABLE IF NOT EXISTS recipes (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  name TEXT NOT NULL,
  url TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Recipe contributions (will be renamed to recipe_notes in 20260118 migration)
CREATE TABLE IF NOT EXISTS recipe_contributions (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  event_id UUID REFERENCES scheduled_events(id) ON DELETE CASCADE,
  notes TEXT,
  photos TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT recipe_contributions_recipe_id_user_id_event_id_key UNIQUE(recipe_id, user_id, event_id)
);

-- Recipe ratings
CREATE TABLE IF NOT EXISTS recipe_ratings (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  event_id UUID NOT NULL REFERENCES scheduled_events(id) ON DELETE CASCADE,
  overall_rating INTEGER NOT NULL CHECK (overall_rating >= 1 AND overall_rating <= 5),
  would_cook_again BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT recipe_ratings_recipe_user_event_key UNIQUE(recipe_id, user_id, event_id)
);

-- ============================================================================
-- HELPER FUNCTIONS (after tables they reference)
-- ============================================================================

-- Function to check if the current authenticated user is an admin
CREATE OR REPLACE FUNCTION current_user_is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.allowed_users
    WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    AND role = 'admin'
  );
$$;

-- Function to auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'name', NEW.email),
    NEW.raw_user_meta_data ->> 'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE SET
    name = COALESCE(EXCLUDED.name, public.profiles.name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url);
  RETURN NEW;
END;
$$;

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_scheduled_events_date ON scheduled_events(event_date);
CREATE INDEX IF NOT EXISTS idx_scheduled_events_ingredient ON scheduled_events(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_recipe_contributions_event ON recipe_contributions(event_id);
CREATE INDEX IF NOT EXISTS idx_recipe_contributions_recipe ON recipe_contributions(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_contributions_user ON recipe_contributions(user_id);
CREATE INDEX IF NOT EXISTS idx_recipe_ratings_recipe ON recipe_ratings(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_ratings_user ON recipe_ratings(user_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE allowed_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_ratings ENABLE ROW LEVEL SECURITY;

-- allowed_users policies
CREATE POLICY "Anyone can view allowed users" ON allowed_users FOR SELECT USING (true);
CREATE POLICY "Admins can manage allowed users" ON allowed_users FOR ALL USING (current_user_is_admin());

-- profiles policies
CREATE POLICY "Anyone can view profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (id = auth.uid());

-- ingredients policies
CREATE POLICY "Anyone can view ingredients" ON ingredients FOR SELECT USING (true);
CREATE POLICY "Admins can manage ingredients" ON ingredients FOR ALL USING (current_user_is_admin());

-- scheduled_events policies
CREATE POLICY "Anyone can view events" ON scheduled_events FOR SELECT USING (true);
CREATE POLICY "Admins can manage events" ON scheduled_events FOR ALL USING (current_user_is_admin());

-- recipes policies
CREATE POLICY "Anyone can view recipes" ON recipes FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert recipes" ON recipes FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can update their own recipes or admins can update any" ON recipes FOR UPDATE USING (created_by = auth.uid() OR current_user_is_admin());
CREATE POLICY "Users can delete their own recipes or admins can delete any" ON recipes FOR DELETE USING (created_by = auth.uid() OR current_user_is_admin());

-- recipe_contributions policies
CREATE POLICY "Anyone can view contributions" ON recipe_contributions FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert contributions" ON recipe_contributions FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can update their own contributions" ON recipe_contributions FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete their own contributions or admins can delete any" ON recipe_contributions FOR DELETE USING (user_id = auth.uid() OR current_user_is_admin());

-- recipe_ratings policies
CREATE POLICY "Anyone can view ratings" ON recipe_ratings FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert ratings" ON recipe_ratings FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can update their own ratings" ON recipe_ratings FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete their own ratings" ON recipe_ratings FOR DELETE USING (user_id = auth.uid());

-- ============================================================================
-- TRIGGERS
-- ============================================================================

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- ============================================================================
-- STORAGE BUCKETS
-- ============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('recipe-photos', 'recipe-photos', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('recipe-images', 'recipe-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Anyone can view recipe photos" ON storage.objects FOR SELECT USING (bucket_id IN ('recipe-photos', 'recipe-images'));
CREATE POLICY "Authenticated users can upload recipe photos" ON storage.objects FOR INSERT WITH CHECK (bucket_id IN ('recipe-photos', 'recipe-images') AND auth.role() = 'authenticated');
CREATE POLICY "Users can delete their own photos" ON storage.objects FOR DELETE USING (bucket_id IN ('recipe-photos', 'recipe-images') AND auth.uid()::text = (storage.foldername(name))[1]);
