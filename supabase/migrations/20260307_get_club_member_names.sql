-- Returns first names of all club members by joining allowed_users → auth.users → profiles
create or replace function get_club_member_names()
returns text[]
language sql
security definer
stable
as $$
  select coalesce(
    array_agg(split_part(p.name, ' ', 1) order by split_part(p.name, ' ', 1)),
    '{}'::text[]
  )
  from allowed_users au
  join auth.users u on u.email = au.email
  join profiles p on p.id = u.id
  where au.is_club_member = true
    and p.name is not null
    and p.name <> '';
$$;

grant execute on function get_club_member_names() to authenticated;
