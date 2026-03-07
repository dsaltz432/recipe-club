-- ============================================================================
-- SEED DATA: Local Development
--
-- Provides test data for local development. Run with:
--   supabase db reset
-- ============================================================================

-- Test users in allowed_users
INSERT INTO allowed_users (email, role, is_club_member) VALUES
  ('dev@example.com', 'admin', true),
  ('viewer@example.com', 'viewer', false),
  ('member@example.com', 'viewer', true);

-- Seed auth user + profile for member@example.com so get_club_member_names() returns them.
-- dev@example.com is created via the dev auth flow and gets its own profile on first sign-in.
INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_super_admin
) VALUES (
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'member@example.com',
  crypt('password123', gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"name":"Member User"}'::jsonb,
  false
) ON CONFLICT (id) DO NOTHING;

INSERT INTO profiles (id, name) VALUES
  ('00000000-0000-0000-0000-000000000002', 'Member User')
ON CONFLICT (id) DO NOTHING;

-- Sample ingredients with colors
INSERT INTO ingredients (name, in_bank, used_count, color) VALUES
  ('Salmon', true, 0, '#FA8072'),
  ('Lemon', true, 0, '#FFF44F'),
  ('Mushrooms', true, 0, '#8B7355'),
  ('Sweet Potato', true, 0, '#FF6347'),
  ('Chickpeas', true, 0, '#DAA520'),
  ('Spinach', true, 0, '#2E8B57'),
  ('Tofu', true, 0, '#F5F5DC'),
  ('Avocado', true, 0, '#568203'),
  ('Cauliflower', true, 0, '#FFFDD0'),
  ('Black Beans', false, 1, '#3D0C02');
