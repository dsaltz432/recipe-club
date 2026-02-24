-- Fix duplicate meal_plans: keep the plan with the most items per user/week
-- Then add a UNIQUE constraint to prevent future duplicates

-- Step 1: Delete items belonging to duplicate (non-keeper) plans
DELETE FROM meal_plan_items
WHERE plan_id IN (
  SELECT mp.id
  FROM meal_plans mp
  WHERE mp.id NOT IN (
    -- For each (user_id, week_start) group, keep the plan with most items
    SELECT DISTINCT ON (sub.user_id, sub.week_start) sub.id
    FROM meal_plans sub
    LEFT JOIN (
      SELECT plan_id, COUNT(*) AS item_count
      FROM meal_plan_items
      GROUP BY plan_id
    ) counts ON counts.plan_id = sub.id
    ORDER BY sub.user_id, sub.week_start, COALESCE(counts.item_count, 0) DESC, sub.created_at ASC
  )
);

-- Step 2: Delete the duplicate plan rows themselves
DELETE FROM meal_plans
WHERE id NOT IN (
  SELECT DISTINCT ON (user_id, week_start) id
  FROM meal_plans
  ORDER BY user_id, week_start, created_at ASC
);

-- Step 3: Add unique constraint to prevent future duplicates
ALTER TABLE meal_plans
  ADD CONSTRAINT meal_plans_user_id_week_start_key UNIQUE (user_id, week_start);
