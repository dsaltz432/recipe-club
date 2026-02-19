-- Fix: Add FK from recipe_shares.shared_by → profiles.id
-- PostgREST needs a public-schema FK to resolve `profiles:shared_by(name)` joins.
-- The existing FK to auth.users(id) is cross-schema and invisible to PostgREST.
ALTER TABLE recipe_shares
  ADD CONSTRAINT recipe_shares_shared_by_profiles_fkey
  FOREIGN KEY (shared_by) REFERENCES profiles(id) ON DELETE CASCADE;
