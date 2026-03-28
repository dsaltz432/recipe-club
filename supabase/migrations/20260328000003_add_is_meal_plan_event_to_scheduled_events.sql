-- Use a dedicated type value for meal-plan-created events instead of a boolean flag.
-- Backfill existing events that have meal_plan_items rows.
UPDATE scheduled_events
SET type = 'meal_plan'
WHERE type = 'personal'
  AND id IN (
    SELECT DISTINCT event_id
    FROM meal_plan_items
    WHERE event_id IS NOT NULL
  );
