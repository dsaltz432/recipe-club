-- Expand the type check constraint to allow 'meal_plan' events,
-- then backfill existing meal-plan-created events.

ALTER TABLE scheduled_events
  DROP CONSTRAINT IF EXISTS scheduled_events_type_check;

ALTER TABLE scheduled_events
  ADD CONSTRAINT scheduled_events_type_check
  CHECK (type IN ('club', 'personal', 'meal_plan'));

-- Backfill: mark events already linked via meal_plan_items
UPDATE scheduled_events
SET type = 'meal_plan'
WHERE type = 'personal'
  AND id IN (
    SELECT DISTINCT event_id
    FROM meal_plan_items
    WHERE event_id IS NOT NULL
  );
