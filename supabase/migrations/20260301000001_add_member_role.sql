-- Add 'member' role between admin and viewer
-- Members can manage club content (events, recipes, ingredients, users)
-- but cannot edit/delete other users' recipes or manually re-parse recipes

-- 1. Drop existing CHECK constraint and add new one with 'member'
ALTER TABLE allowed_users DROP CONSTRAINT IF EXISTS allowed_users_role_check;
ALTER TABLE allowed_users ADD CONSTRAINT allowed_users_role_check
  CHECK (role IN ('admin', 'member', 'viewer'));

-- 2. Create helper function for member-or-admin check
CREATE OR REPLACE FUNCTION current_user_is_member_or_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM allowed_users
    WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    AND role IN ('admin', 'member')
  );
$$;

-- 3. Update RLS policies on allowed_users to use member_or_admin
-- Drop and recreate the insert/update/delete policies
DROP POLICY IF EXISTS "Admins can insert allowed_users" ON allowed_users;
CREATE POLICY "Members and admins can insert allowed_users"
  ON allowed_users FOR INSERT
  WITH CHECK (current_user_is_member_or_admin());

DROP POLICY IF EXISTS "Admins can update allowed_users" ON allowed_users;
CREATE POLICY "Members and admins can update allowed_users"
  ON allowed_users FOR UPDATE
  USING (current_user_is_member_or_admin());

DROP POLICY IF EXISTS "Admins can delete allowed_users" ON allowed_users;
CREATE POLICY "Members and admins can delete allowed_users"
  ON allowed_users FOR DELETE
  USING (current_user_is_member_or_admin());

-- 4. Update RLS policies on ingredients
DROP POLICY IF EXISTS "Admins can insert ingredients" ON ingredients;
CREATE POLICY "Members and admins can insert ingredients"
  ON ingredients FOR INSERT
  WITH CHECK (current_user_is_member_or_admin());

DROP POLICY IF EXISTS "Admins can update ingredients" ON ingredients;
CREATE POLICY "Members and admins can update ingredients"
  ON ingredients FOR UPDATE
  USING (current_user_is_member_or_admin());

DROP POLICY IF EXISTS "Admins can delete ingredients" ON ingredients;
CREATE POLICY "Members and admins can delete ingredients"
  ON ingredients FOR DELETE
  USING (current_user_is_member_or_admin());

-- 5. Update RLS policies on scheduled_events (club type management)
DROP POLICY IF EXISTS "Admins can insert scheduled_events" ON scheduled_events;
CREATE POLICY "Members and admins can insert scheduled_events"
  ON scheduled_events FOR INSERT
  WITH CHECK (current_user_is_member_or_admin());

DROP POLICY IF EXISTS "Admins can update scheduled_events" ON scheduled_events;
CREATE POLICY "Members and admins can update scheduled_events"
  ON scheduled_events FOR UPDATE
  USING (current_user_is_member_or_admin());

DROP POLICY IF EXISTS "Admins can delete scheduled_events" ON scheduled_events;
CREATE POLICY "Members and admins can delete scheduled_events"
  ON scheduled_events FOR DELETE
  USING (current_user_is_member_or_admin());

-- Note: recipes RLS stays unchanged — creator OR admin override remains admin-only
