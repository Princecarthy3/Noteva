-- Track whether a user has completed the first-login workspace tour.
alter table public.profiles
  add column if not exists workspace_tour_completed boolean not null default false;
