-- Restore club event management policies that were lost in personal_meal_events migration
-- The original "Admins can manage events" policy was dropped but only personal-event
-- policies were added back, leaving club events with no INSERT/UPDATE/DELETE access.

-- Allowed users can manage club events (insert, update, delete)
CREATE POLICY "Allowed users can manage club events"
  ON scheduled_events FOR ALL
  USING (type = 'club')
  WITH CHECK (type = 'club');
