-- US-001: Fix critical RLS security vulnerabilities
-- BUG-002: Fix club event management policy to require admin role
-- BUG-009: Fix event_grocery_cache policies to check event access

-- ============================================================
-- BUG-002: Fix scheduled_events club event policies
-- ============================================================

-- Drop the overly permissive policy that allows ANY authenticated user to manage club events
DROP POLICY IF EXISTS "Allowed users can manage club events" ON scheduled_events;

-- Club events: all authenticated users can read (SELECT already exists as "Anyone can view club events")
-- No need to create a new SELECT policy — it already exists from 20260218000002

-- Club events: only admins can insert
CREATE POLICY "Admins can insert club events"
  ON scheduled_events FOR INSERT
  WITH CHECK (
    type = 'club'
    AND current_user_is_admin()
  );

-- Club events: only admins can update
CREATE POLICY "Admins can update club events"
  ON scheduled_events FOR UPDATE
  USING (
    type = 'club'
    AND current_user_is_admin()
  );

-- Club events: only admins can delete
CREATE POLICY "Admins can delete club events"
  ON scheduled_events FOR DELETE
  USING (
    type = 'club'
    AND current_user_is_admin()
  );

-- ============================================================
-- BUG-009: Fix event_grocery_cache policies to check event access
-- ============================================================

-- Drop the overly permissive policies
DROP POLICY IF EXISTS "Authenticated can read" ON event_grocery_cache;
DROP POLICY IF EXISTS "Authenticated can insert" ON event_grocery_cache;
DROP POLICY IF EXISTS "Authenticated can update" ON event_grocery_cache;
DROP POLICY IF EXISTS "Authenticated can delete" ON event_grocery_cache;

-- Helper: user can access the event if it's a club event OR a personal event they created
-- SELECT: user can read cache for events they can access
CREATE POLICY "Users can read accessible event grocery cache"
  ON event_grocery_cache FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM scheduled_events se
      WHERE se.id = event_grocery_cache.event_id
        AND (
          se.type = 'club'
          OR (se.type = 'personal' AND se.created_by = auth.uid())
        )
    )
  );

-- INSERT: user can create cache for events they can access
CREATE POLICY "Users can insert accessible event grocery cache"
  ON event_grocery_cache FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM scheduled_events se
      WHERE se.id = event_grocery_cache.event_id
        AND (
          se.type = 'club'
          OR (se.type = 'personal' AND se.created_by = auth.uid())
        )
    )
  );

-- UPDATE: user can update cache for events they can access
CREATE POLICY "Users can update accessible event grocery cache"
  ON event_grocery_cache FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM scheduled_events se
      WHERE se.id = event_grocery_cache.event_id
        AND (
          se.type = 'club'
          OR (se.type = 'personal' AND se.created_by = auth.uid())
        )
    )
  );

-- DELETE: user can delete cache for events they can access
CREATE POLICY "Users can delete accessible event grocery cache"
  ON event_grocery_cache FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM scheduled_events se
      WHERE se.id = event_grocery_cache.event_id
        AND (
          se.type = 'club'
          OR (se.type = 'personal' AND se.created_by = auth.uid())
        )
    )
  );
