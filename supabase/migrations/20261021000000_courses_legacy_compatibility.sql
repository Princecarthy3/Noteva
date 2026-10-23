-- Add course fields that may be missing from pre-existing Noteva tables.
-- CREATE TABLE IF NOT EXISTS in Stage 4 does not upgrade an existing table.
alter table public.courses
  add column if not exists color text not null default '#7259e8',
  add column if not exists term text,
  add column if not exists archived boolean not null default false,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

notify pgrst, 'reload schema';
