-- All pre-existing personal events were created by the meal planner
-- (PersonalEventsList didn't exist before this feature was built).
-- Convert any remaining ones that the meal_plan_items join missed.
UPDATE scheduled_events
SET type = 'meal_plan'
WHERE type = 'personal';
