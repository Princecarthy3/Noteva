-- Align pre-existing StudyStation course tables with the title field used by the app.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'courses'
      and column_name = 'name'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'courses'
      and column_name = 'title'
  ) then
    alter table public.courses rename column name to title;
  elsif not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'courses'
      and column_name = 'title'
  ) then
    alter table public.courses add column title text;
    update public.courses
    set title = coalesce(nullif(btrim(code), ''), 'Untitled course')
    where title is null;
    alter table public.courses alter column title set not null;
  end if;
end $$;

notify pgrst, 'reload schema';
