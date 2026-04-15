-- Add is_shared flag to scheduled_events for personal event sharing
ALTER TABLE scheduled_events ADD COLUMN IF NOT EXISTS is_shared BOOLEAN NOT NULL DEFAULT false;

-- Allow public (unauthenticated) read of personal events that the owner has shared
DROP POLICY IF EXISTS "Public can view shared personal events" ON scheduled_events;
CREATE POLICY "Public can view shared personal events"
  ON scheduled_events FOR SELECT
  USING (type = 'personal' AND is_shared = true);

-- Also allow meal_plan type events to be shared (meal_plan events are also personal)
DROP POLICY IF EXISTS "Public can view shared meal plan events" ON scheduled_events;
CREATE POLICY "Public can view shared meal plan events"
  ON scheduled_events FOR SELECT
  USING (type = 'meal_plan' AND is_shared = true);
