-- Add a flag to distinguish meal-plan-created events from user-created personal events.
-- Defaults to FALSE so existing standalone events are unaffected.
ALTER TABLE scheduled_events
  ADD COLUMN IF NOT EXISTS is_meal_plan_event BOOLEAN NOT NULL DEFAULT FALSE;

-- Backfill: mark events that already have meal_plan_items rows
UPDATE scheduled_events
SET is_meal_plan_event = TRUE
WHERE id IN (
  SELECT DISTINCT event_id
  FROM meal_plan_items
  WHERE event_id IS NOT NULL
);
