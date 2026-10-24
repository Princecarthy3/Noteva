-- Add university snapshot to public student reviews for landing-page cards.
alter table public.student_reviews
  add column if not exists university text;

-- Backfill from profiles when available.
update public.student_reviews as reviews
set university = nullif(trim(profiles.university), '')
from public.profiles as profiles
where profiles.id = reviews.user_id
  and (reviews.university is null or reviews.university = '')
  and profiles.university is not null
  and char_length(trim(profiles.university)) > 0;

alter table public.student_reviews
  drop constraint if exists student_reviews_university_check;

alter table public.student_reviews
  add constraint student_reviews_university_check
  check (university is null or char_length(university) between 2 and 160);
