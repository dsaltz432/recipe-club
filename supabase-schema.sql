-- Recipe Club Database Schema
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql

-- profiles table (auto-created users from Google OAuth)
create table profiles (
  id uuid references auth.users primary key,
  name text,
  avatar_url text,
  created_at timestamp with time zone default now()
);

-- ingredients table
create table ingredients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_used boolean default false,
  used_by uuid references profiles(id),
  used_date timestamp with time zone,
  created_by uuid references profiles(id),
  created_at timestamp with time zone default now()
);

-- recipes table
create table recipes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text,
  notes text,
  user_id uuid references profiles(id),
  ingredient_id uuid references ingredients(id),
  event_date date,
  created_at timestamp with time zone default now()
);

-- scheduled_events table
create table scheduled_events (
  id uuid primary key default gen_random_uuid(),
  ingredient_id uuid references ingredients(id),
  event_date date not null,
  created_by uuid references profiles(id),
  status text default 'scheduled',
  created_at timestamp with time zone default now()
);

-- Enable Row Level Security
alter table profiles enable row level security;
alter table ingredients enable row level security;
alter table recipes enable row level security;
alter table scheduled_events enable row level security;

-- Policies for profiles
create policy "Public profiles are viewable by everyone"
  on profiles for select using (true);

create policy "Users can insert their own profile"
  on profiles for insert with check (auth.uid() = id);

create policy "Users can update their own profile"
  on profiles for update using (auth.uid() = id);

-- Policies for ingredients (all authenticated users can CRUD)
create policy "Authenticated users can view ingredients"
  on ingredients for select to authenticated using (true);

create policy "Authenticated users can insert ingredients"
  on ingredients for insert to authenticated with check (true);

create policy "Authenticated users can update ingredients"
  on ingredients for update to authenticated using (true);

create policy "Authenticated users can delete ingredients"
  on ingredients for delete to authenticated using (true);

-- Policies for recipes
create policy "Anyone can view recipes"
  on recipes for select using (true);

create policy "Authenticated users can insert recipes"
  on recipes for insert to authenticated with check (true);

create policy "Users can update their own recipes"
  on recipes for update to authenticated using (auth.uid() = user_id);

create policy "Users can delete their own recipes"
  on recipes for delete to authenticated using (auth.uid() = user_id);

-- Policies for scheduled_events
create policy "Anyone can view scheduled events"
  on scheduled_events for select using (true);

create policy "Authenticated users can insert events"
  on scheduled_events for insert to authenticated with check (true);

create policy "Users can update their own events"
  on scheduled_events for update to authenticated using (auth.uid() = created_by);

create policy "Users can delete their own events"
  on scheduled_events for delete to authenticated using (auth.uid() = created_by);

-- Function to auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name'),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to call the function on new user signup
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
