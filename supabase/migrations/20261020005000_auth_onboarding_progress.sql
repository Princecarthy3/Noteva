-- Stage 5: preserve onboarding progress across devices and refreshes.
alter table public.profiles
  add column if not exists onboarding_step smallint not null default 0;
alter table public.profiles
  add column if not exists country_name text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_onboarding_step_range'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_onboarding_step_range
      check (onboarding_step between 0 and 3) not valid;
  end if;
end $$;

create unique index if not exists courses_user_code_idx
  on public.courses (user_id, code);
