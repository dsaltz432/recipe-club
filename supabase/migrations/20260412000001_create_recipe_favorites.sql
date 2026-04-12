-- Create recipe_favorites table so users can bookmark recipes they love
create table if not exists public.recipe_favorites (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  recipe_id   uuid not null references public.recipes (id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (user_id, recipe_id)
);

-- Index for fast per-user lookups
create index if not exists idx_recipe_favorites_user_id on public.recipe_favorites (user_id);

-- Row-Level Security: users can only see and manage their own favorites
alter table public.recipe_favorites enable row level security;

create policy "Users can view their own favorites"
  on public.recipe_favorites for select
  using (auth.uid() = user_id);

create policy "Users can insert their own favorites"
  on public.recipe_favorites for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own favorites"
  on public.recipe_favorites for delete
  using (auth.uid() = user_id);
