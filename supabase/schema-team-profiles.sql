-- Team-page profile fields used for organisation grouping and role titles.
alter table public.profiles
  add column if not exists team_name text,
  add column if not exists role_name text;

notify pgrst, 'reload schema';
