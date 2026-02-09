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
