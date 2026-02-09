-- Test combine harness tables (local dev only, no RLS)

-- A "round" of testing (batch of generated events)
create table if not exists test_rounds (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  status text default 'in_progress',  -- 'in_progress', 'feedback_sent', 'completed'
  feedback_result jsonb               -- Claude's analysis after "Complete Feedback"
);

-- A generated test event (2-4 recipes combined)
create table if not exists test_events (
  id uuid primary key default gen_random_uuid(),
  round_id uuid references test_rounds(id) on delete cascade,
  recipe_ids text[] not null,          -- array of recipe slugs from recipes.ts
  naive_result jsonb,                  -- CombinedGroceryItem[] from combineIngredients
  smart_result jsonb,                  -- SmartGroceryItem[] from edge function (null if failed)
  comment text,                        -- user feedback on this event
  status text default 'pending',       -- 'pending', 'commented', 'looks_good'
  created_at timestamptz default now()
);
