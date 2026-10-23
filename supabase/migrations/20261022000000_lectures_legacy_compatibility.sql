-- Migration: Add missing lecture columns and remove legacy check constraints from pre-existing Noteva tables.
-- CREATE TABLE IF NOT EXISTS in Stage 4 does not add columns or drop old constraints if public.lectures already existed.

-- 1. Ensure all required lecture columns exist
alter table public.lectures
  add column if not exists storage_path text,
  add column if not exists mime_type text,
  add column if not exists processing_error text,
  add column if not exists transcript_segments jsonb,
  add column if not exists language text,
  add column if not exists duration_seconds integer,
  add column if not exists source_url text,
  add column if not exists transcript text;

-- 2. Drop legacy check constraints (e.g. lectures_status_check, lectures_source_type_check)
alter table public.lectures drop constraint if exists lectures_status_check;
alter table public.lectures drop constraint if exists lectures_source_type_check;

do $$
declare
  r record;
begin
  for r in (
    select c.conname
    from pg_constraint c
    where c.conrelid = 'public.lectures'::regclass
      and c.contype = 'c'
      and (
        pg_get_constraintdef(c.oid) ilike '%status%'
        or pg_get_constraintdef(c.oid) ilike '%source_type%'
      )
  ) loop
    execute 'alter table public.lectures drop constraint if exists ' || quote_ident(r.conname);
  end loop;
end $$;

-- 3. Ensure lecture_status enum exists and has all required values ('uploaded', 'processing', 'ready', 'failed')
do $$
begin
  if not exists (select 1 from pg_type where typname = 'lecture_status') then
    create type public.lecture_status as enum ('uploaded', 'processing', 'ready', 'failed');
  else
    begin alter type public.lecture_status add value if not exists 'uploaded'; exception when others then null; end;
    begin alter type public.lecture_status add value if not exists 'processing'; exception when others then null; end;
    begin alter type public.lecture_status add value if not exists 'ready'; exception when others then null; end;
    begin alter type public.lecture_status add value if not exists 'failed'; exception when others then null; end;
  end if;
end $$;

-- 4. Ensure lecture_source_type enum exists and has all required values
do $$
begin
  if not exists (select 1 from pg_type where typname = 'lecture_source_type') then
    create type public.lecture_source_type as enum ('recording', 'audio', 'video', 'link', 'document');
  else
    begin alter type public.lecture_source_type add value if not exists 'recording'; exception when others then null; end;
    begin alter type public.lecture_source_type add value if not exists 'audio'; exception when others then null; end;
    begin alter type public.lecture_source_type add value if not exists 'video'; exception when others then null; end;
    begin alter type public.lecture_source_type add value if not exists 'link'; exception when others then null; end;
    begin alter type public.lecture_source_type add value if not exists 'document'; exception when others then null; end;
  end if;
end $$;

-- 5. Normalize legacy status data if present
do $$
begin
  update public.lectures set status = 'ready' where status in ('completed', 'done', 'transcribed');
  update public.lectures set status = 'uploaded' where status in ('pending', 'draft', 'created');
exception when others then null;
end $$;

-- 6. Align status column type to public.lecture_status enum (or safe fallback)
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'lectures'
      and column_name = 'status'
      and data_type in ('text', 'character varying')
  ) then
    alter table public.lectures alter column status drop default;

    update public.lectures
    set status = case
      when status in ('completed', 'done', 'transcribed') then 'ready'
      when status in ('pending', 'draft', 'created') then 'uploaded'
      when status in ('uploaded', 'processing', 'ready', 'failed') then status
      else 'uploaded'
    end;

    alter table public.lectures
      alter column status type public.lecture_status
      using status::public.lecture_status;

    alter table public.lectures
      alter column status set default 'uploaded'::public.lecture_status;
  else
    begin
      alter table public.lectures alter column status set default 'uploaded';
    exception when others then null;
    end;
  end if;
exception when others then
  -- Fallback if type conversion is restricted: remove check constraint and ensure valid values allowed
  begin
    alter table public.lectures drop constraint if exists lectures_status_check;
    alter table public.lectures add constraint lectures_status_check check (status::text in ('uploaded', 'processing', 'ready', 'failed'));
    alter table public.lectures alter column status set default 'uploaded';
  exception when others then null;
  end;
end $$;

-- 7. Align source_type column type to public.lecture_source_type enum if text
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'lectures'
      and column_name = 'source_type'
      and data_type in ('text', 'character varying')
  ) then
    alter table public.lectures
      alter column source_type type public.lecture_source_type
      using source_type::public.lecture_source_type;
  end if;
exception when others then
  begin
    alter table public.lectures drop constraint if exists lectures_source_type_check;
    alter table public.lectures add constraint lectures_source_type_check check (source_type::text in ('recording', 'audio', 'video', 'link', 'document'));
  exception when others then null;
  end;
end $$;

-- 8. Ensure public.notes table exists and has proper permissions
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  lecture_id uuid not null references public.lectures(id) on delete cascade,
  title text not null,
  summary text not null,
  content jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notes_lecture_id_idx unique (lecture_id)
);

-- 9. Ensure service_role and authenticated permissions
grant select, insert, update, delete on public.lectures to service_role;
grant select on public.lectures to authenticated;
grant select, insert, update, delete on public.notes to service_role;
grant select, insert, update, delete on public.notes to authenticated;

-- 10. Reload PostgREST schema cache immediately
notify pgrst, 'reload schema';
