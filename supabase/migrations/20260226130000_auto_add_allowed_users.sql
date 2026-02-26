-- Auto-add new Google sign-in users as viewers in allowed_users
-- Uses ON CONFLICT (email) DO NOTHING so pre-invited users keep their existing role/membership

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'name', NEW.raw_user_meta_data ->> 'full_name'),
    NEW.raw_user_meta_data ->> 'avatar_url'
  );

  INSERT INTO public.allowed_users (email, role, is_club_member)
  VALUES (NEW.email, 'viewer', false)
  ON CONFLICT (email) DO NOTHING;

  RETURN NEW;
END;
$$;
