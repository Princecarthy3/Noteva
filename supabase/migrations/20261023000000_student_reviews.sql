create table if not exists public.student_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 100),
  rating smallint not null check (rating between 1 and 5),
  review text not null check (char_length(review) between 10 and 600),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists student_reviews_created_at_idx
  on public.student_reviews (created_at desc);

alter table public.student_reviews enable row level security;

drop policy if exists student_reviews_public_read on public.student_reviews;
create policy student_reviews_public_read on public.student_reviews
  for select to anon, authenticated using (true);

drop policy if exists student_reviews_insert_own on public.student_reviews;
create policy student_reviews_insert_own on public.student_reviews
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists student_reviews_update_own on public.student_reviews;
create policy student_reviews_update_own on public.student_reviews
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists student_reviews_delete_own on public.student_reviews;
create policy student_reviews_delete_own on public.student_reviews
  for delete to authenticated using ((select auth.uid()) = user_id);

grant select on public.student_reviews to anon, authenticated;
grant insert, update, delete on public.student_reviews to authenticated;
