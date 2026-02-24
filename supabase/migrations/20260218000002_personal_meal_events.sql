-- Personal Meal Events: extend scheduled_events and meal_plan_items

-- Step 1: Add event type column to scheduled_events
ALTER TABLE scheduled_events
  ADD COLUMN type TEXT DEFAULT 'club' CHECK (type IN ('club', 'personal'));

-- Step 2: Make ingredient_id nullable (personal events don't need an ingredient)
ALTER TABLE scheduled_events
  ALTER COLUMN ingredient_id DROP NOT NULL;

-- Step 3: Add event_id to meal_plan_items (links a meal slot to a personal event)
ALTER TABLE meal_plan_items
  ADD COLUMN event_id UUID REFERENCES scheduled_events(id) ON DELETE SET NULL;

-- Step 4: Update RLS policies for scheduled_events
-- Drop existing policies (they assume all events are club events)
DROP POLICY IF EXISTS "Anyone can view events" ON scheduled_events;
DROP POLICY IF EXISTS "Admins can manage events" ON scheduled_events;

-- Club events: anyone can view
CREATE POLICY "Anyone can view club events"
  ON scheduled_events FOR SELECT
  USING (type = 'club');

-- Personal events: only owner can view
CREATE POLICY "Users can view own personal events"
  ON scheduled_events FOR SELECT
  USING (type = 'personal' AND created_by = auth.uid());

-- Personal events: owner can insert
CREATE POLICY "Users can insert personal events"
  ON scheduled_events FOR INSERT
  WITH CHECK (type = 'personal' AND created_by = auth.uid());

-- Personal events: owner can update
CREATE POLICY "Users can update own personal events"
  ON scheduled_events FOR UPDATE
  USING (type = 'personal' AND created_by = auth.uid());

-- Personal events: owner can delete
CREATE POLICY "Users can delete own personal events"
  ON scheduled_events FOR DELETE
  USING (type = 'personal' AND created_by = auth.uid());
