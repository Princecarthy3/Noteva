-- Stage 4: additive, forward-only schema and row-level security for Supabase.
-- Existing application tables are created only when absent; this migration does
-- not drop or rewrite user data.

do $$ begin create type public.lecture_status as enum ('uploaded', 'processing', 'ready', 'failed');
exception when duplicate_object then null; end $$;
do $$ begin create type public.lecture_source_type as enum ('recording', 'audio', 'video', 'link', 'document');
exception when duplicate_object then null; end $$;
do $$ begin create type public.study_material_type as enum ('flashcards', 'quiz', 'summary');
exception when duplicate_object then null; end $$;
do $$ begin create type public.timetable_event_type as enum ('lecture', 'lab', 'seminar', 'study', 'review', 'exam', 'personal');
exception when duplicate_object then null; end $$;
do $$ begin create type public.group_visibility as enum ('public', 'private');
exception when duplicate_object then null; end $$;
do $$ begin create type public.group_role as enum ('owner', 'moderator', 'member');
exception when duplicate_object then null; end $$;
do $$ begin create type public.resource_visibility as enum ('private', 'group');
exception when duplicate_object then null; end $$;
do $$ begin create type public.generation_status as enum ('queued', 'processing', 'completed', 'failed');
exception when duplicate_object then null; end $$;
do $$ begin create type public.generation_task as enum ('summary', 'flashcards', 'quiz', 'question');
exception when duplicate_object then null; end $$;
do $$ begin create type public.study_task_status as enum ('todo', 'in_progress', 'completed', 'cancelled');
exception when duplicate_object then null; end $$;
do $$ begin create type public.study_task_priority as enum ('low', 'normal', 'high');
exception when duplicate_object then null; end $$;
do $$ begin create type public.study_session_status as enum ('scheduled', 'cancelled', 'completed');
exception when duplicate_object then null; end $$;

create table if not exists public.universities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country_code text not null,
  website text,
  created_at timestamptz not null default now(),
  constraint universities_name_country_idx unique (name, country_code)
);

create table if not exists public.profiles (
  id uuid primary key,
  full_name text not null,
  degree text,
  university text,
  university_id uuid references public.universities(id) on delete set null,
  country_code text,
  programme text,
  academic_level text,
  current_semester text,
  timezone text not null default 'UTC',
  avatar_url text,
  onboarding_complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists university_id uuid references public.universities(id) on delete set null;
alter table public.profiles add column if not exists country_code text;
alter table public.profiles add column if not exists programme text;
alter table public.profiles add column if not exists academic_level text;
alter table public.profiles add column if not exists current_semester text;

create table if not exists public.course_catalog (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities(id) on delete cascade,
  code text not null,
  title text not null,
  description text,
  department text,
  created_at timestamptz not null default now(),
  constraint course_catalog_university_code_idx unique (university_id, code)
);

create table if not exists public.student_courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.course_catalog(id) on delete cascade,
  semester text,
  academic_year text,
  created_at timestamptz not null default now()
);
create unique index if not exists student_courses_user_course_term_idx
  on public.student_courses (user_id, course_id, coalesce(semester, ''), coalesce(academic_year, ''));
create index if not exists student_courses_user_id_idx on public.student_courses (user_id);
create index if not exists course_catalog_university_title_idx on public.course_catalog (university_id, title);

-- Existing StudyStation tables are retained as the student's personal workspace.
create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text not null,
  code text not null,
  color text not null default '#7259e8',
  term text,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint courses_user_code_idx unique (user_id, code)
);
create table if not exists public.lectures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  course_id uuid references public.courses(id) on delete set null,
  title text not null,
  source_type public.lecture_source_type not null,
  source_url text,
  storage_path text,
  mime_type text,
  duration_seconds integer,
  language text,
  status public.lecture_status not null default 'uploaded',
  transcript text,
  transcript_segments jsonb,
  processing_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
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
create table if not exists public.study_materials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  note_id uuid not null references public.notes(id) on delete cascade,
  type public.study_material_type not null,
  title text not null,
  content jsonb not null,
  mastery real not null default 0,
  due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.timetable_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  course_id uuid references public.courses(id) on delete set null,
  type public.timetable_event_type not null,
  title text not null,
  location text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  generated boolean not null default false,
  source_metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint timetable_events_valid_range check (ends_at > starts_at)
);
create table if not exists public.study_preferences (
  user_id uuid primary key,
  pace text not null default 'balanced',
  session_minutes integer not null default 45,
  break_minutes integer not null default 10,
  daily_limit_minutes integer not null default 150,
  preferred_times jsonb not null default '["afternoon"]'::jsonb,
  study_days jsonb not null default '[1, 2, 3, 4, 5]'::jsonb,
  updated_at timestamptz not null default now()
);
create table if not exists public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text not null,
  course_id uuid references public.courses(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  role text not null,
  content text not null,
  citations jsonb,
  created_at timestamptz not null default now(),
  constraint chat_messages_valid_role check (role in ('user', 'assistant'))
);

create index if not exists courses_user_id_idx on public.courses (user_id);
create index if not exists lectures_user_id_idx on public.lectures (user_id);
create index if not exists lectures_course_id_idx on public.lectures (course_id);
create index if not exists lectures_status_idx on public.lectures (status);
create index if not exists notes_user_id_idx on public.notes (user_id);
create index if not exists study_materials_user_id_idx on public.study_materials (user_id);
create index if not exists study_materials_note_id_idx on public.study_materials (note_id);
create index if not exists study_materials_due_at_idx on public.study_materials (due_at);
create index if not exists timetable_events_user_start_idx on public.timetable_events (user_id, starts_at);
create index if not exists chat_threads_user_id_idx on public.chat_threads (user_id);
create index if not exists chat_messages_thread_id_idx on public.chat_messages (thread_id);

-- Add owner foreign keys without scanning legacy rows; new writes are still checked.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_auth_user_fkey' and conrelid = 'public.profiles'::regclass) then
    alter table public.profiles add constraint profiles_auth_user_fkey foreign key (id) references auth.users(id) on delete cascade not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'courses_auth_user_fkey' and conrelid = 'public.courses'::regclass) then
    alter table public.courses add constraint courses_auth_user_fkey foreign key (user_id) references auth.users(id) on delete cascade not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'lectures_auth_user_fkey' and conrelid = 'public.lectures'::regclass) then
    alter table public.lectures add constraint lectures_auth_user_fkey foreign key (user_id) references auth.users(id) on delete cascade not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'notes_auth_user_fkey' and conrelid = 'public.notes'::regclass) then
    alter table public.notes add constraint notes_auth_user_fkey foreign key (user_id) references auth.users(id) on delete cascade not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'study_materials_auth_user_fkey' and conrelid = 'public.study_materials'::regclass) then
    alter table public.study_materials add constraint study_materials_auth_user_fkey foreign key (user_id) references auth.users(id) on delete cascade not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'timetable_events_auth_user_fkey' and conrelid = 'public.timetable_events'::regclass) then
    alter table public.timetable_events add constraint timetable_events_auth_user_fkey foreign key (user_id) references auth.users(id) on delete cascade not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'study_preferences_auth_user_fkey' and conrelid = 'public.study_preferences'::regclass) then
    alter table public.study_preferences add constraint study_preferences_auth_user_fkey foreign key (user_id) references auth.users(id) on delete cascade not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'chat_threads_auth_user_fkey' and conrelid = 'public.chat_threads'::regclass) then
    alter table public.chat_threads add constraint chat_threads_auth_user_fkey foreign key (user_id) references auth.users(id) on delete cascade not valid;
  end if;
end $$;

create table if not exists public.study_groups (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid references public.courses(id) on delete set null,
  name text not null check (length(trim(name)) between 1 and 120),
  description text,
  visibility public.group_visibility not null default 'private',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.study_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.group_role not null default 'member',
  joined_at timestamptz not null default now(),
  constraint group_members_group_user_idx unique (group_id, user_id)
);
create table if not exists public.group_invites (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.study_groups(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  token_hash text not null,
  expires_at timestamptz not null,
  max_uses integer check (max_uses is null or max_uses > 0),
  use_count integer not null default 0 check (use_count >= 0),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint group_invites_token_hash_idx unique (token_hash)
);
create table if not exists public.resources (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid references public.courses(id) on delete set null,
  shared_group_id uuid references public.study_groups(id) on delete restrict,
  title text not null,
  resource_type text not null,
  storage_path text,
  content jsonb,
  visibility public.resource_visibility not null default 'private',
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint resources_visibility_group_check check (
    (visibility = 'private' and shared_group_id is null)
    or (visibility = 'group' and shared_group_id is not null)
  ),
  constraint resources_storage_path_idx unique (storage_path)
);
create table if not exists public.group_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.study_groups(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (length(trim(body)) between 1 and 10000),
  resource_id uuid references public.resources(id) on delete set null,
  created_at timestamptz not null default now()
);
create table if not exists public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.study_groups(id) on delete cascade,
  creator_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.study_session_status not null default 'scheduled',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint study_sessions_valid_range check (ends_at > starts_at)
);
create table if not exists public.ai_generations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid references public.courses(id) on delete set null,
  lecture_id uuid references public.lectures(id) on delete set null,
  resource_id uuid references public.resources(id) on delete set null,
  task public.generation_task not null,
  status public.generation_status not null default 'queued',
  input_metadata jsonb,
  output jsonb,
  model text,
  usage_metadata jsonb,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.flashcards (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid references public.courses(id) on delete set null,
  generation_id uuid references public.ai_generations(id) on delete set null,
  lecture_id uuid references public.lectures(id) on delete set null,
  front text not null,
  back text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid references public.courses(id) on delete set null,
  generation_id uuid references public.ai_generations(id) on delete set null,
  lecture_id uuid references public.lectures(id) on delete set null,
  title text not null,
  questions jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  answers jsonb not null,
  score integer not null,
  total integer not null,
  completed_at timestamptz not null default now(),
  constraint quiz_attempts_valid_score check (total > 0 and score between 0 and total)
);
create table if not exists public.study_tasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid references public.courses(id) on delete set null,
  title text not null check (length(trim(title)) between 1 and 240),
  description text,
  due_at timestamptz,
  status public.study_task_status not null default 'todo',
  priority public.study_task_priority not null default 'normal',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- Some existing projects may already have these table names with user_id (or
-- another owner column) instead of owner_id. Upgrade those tables before the
-- owner indexes and RLS policies below reference owner_id.
do $$
declare
  target_table text;
  source_column text;
  owner_expression text;
  null_owner_count bigint;
  owner_constraint text;
begin
  foreach target_table in array array[
    'resources',
    'ai_generations',
    'flashcards',
    'quizzes',
    'study_tasks'
  ]
  loop
    if not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = target_table
        and column_name = 'owner_id'
    ) then
      execute format('alter table public.%I add column owner_id uuid', target_table);
    end if;

    owner_expression := 'owner_id';
    foreach source_column in array array[
      'user_id',
      'created_by',
      'creator_id',
      'author_id',
      'uploaded_by'
    ]
    loop
      if exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = target_table
          and column_name = source_column
      ) then
        owner_expression := owner_expression || format(
          ', nullif(btrim(%I::text), '''')::uuid',
          source_column
        );
      end if;
    end loop;

    if owner_expression <> 'owner_id' then
      execute format(
        'update public.%I set owner_id = coalesce(%s) where owner_id is null',
        target_table,
        owner_expression
      );
    end if;

    execute format(
      'select count(*) from public.%I where owner_id is null',
      target_table
    ) into null_owner_count;

    if null_owner_count > 0 then
      raise exception
        'Cannot safely migrate public.%: % existing rows have no owner_id or recognized owner column (user_id, created_by, creator_id, author_id, uploaded_by). Map those rows to auth.users before retrying Stage 4.',
        target_table,
        null_owner_count;
    end if;

    execute format(
      'alter table public.%I alter column owner_id set not null',
      target_table
    );

    owner_constraint := 'stage4_' || target_table || '_owner_auth_user_fkey';
    if not exists (
      select 1
      from pg_constraint constraint_row
      join pg_attribute owner_attribute
        on owner_attribute.attrelid = constraint_row.conrelid
       and owner_attribute.attname = 'owner_id'
      where constraint_row.contype = 'f'
        and constraint_row.conrelid = format('public.%I', target_table)::regclass
        and constraint_row.confrelid = 'auth.users'::regclass
        and owner_attribute.attnum = any(constraint_row.conkey)
    ) then
      execute format(
        'alter table public.%I add constraint %I foreign key (owner_id) references auth.users(id) on delete cascade not valid',
        target_table,
        owner_constraint
      );
    end if;
  end loop;
end $$;

-- Existing tables are not altered by CREATE TABLE IF NOT EXISTS. Add the
-- optional course relationship where later indexes and policies rely on it.
do $$
declare
  target_table text;
  course_constraint text;
begin
  foreach target_table in array array[
    'lectures',
    'timetable_events',
    'chat_threads',
    'study_groups',
    'resources',
    'ai_generations',
    'flashcards',
    'quizzes',
    'study_tasks'
  ]
  loop
    if not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = target_table
        and column_name = 'course_id'
    ) then
      execute format(
        'alter table public.%I add column course_id uuid',
        target_table
      );
    elsif not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = target_table
        and column_name = 'course_id'
        and udt_name = 'uuid'
    ) then
      raise exception
        'Cannot safely add the Stage 4 course relationship: public.% has a course_id column that is not UUID.',
        target_table;
    end if;

    if not exists (
      select 1
      from pg_constraint constraint_row
      join pg_attribute course_attribute
        on course_attribute.attrelid = constraint_row.conrelid
       and course_attribute.attname = 'course_id'
      where constraint_row.contype = 'f'
        and constraint_row.conrelid = format('public.%I', target_table)::regclass
        and constraint_row.confrelid = 'public.courses'::regclass
        and course_attribute.attnum = any(constraint_row.conkey)
    ) then
      course_constraint := 'stage4_' || target_table || '_course_fkey';
      execute format(
        'alter table public.%I add constraint %I foreign key (course_id) references public.courses(id) on delete set null not valid',
        target_table,
        course_constraint
      );
    end if;
  end loop;
end $$;

create index if not exists study_groups_creator_id_idx on public.study_groups (creator_id);
create index if not exists study_groups_course_id_idx on public.study_groups (course_id);
create index if not exists study_groups_visibility_idx on public.study_groups (visibility);
create index if not exists group_members_user_id_idx on public.group_members (user_id);
create index if not exists group_invites_group_id_idx on public.group_invites (group_id);
create index if not exists group_messages_group_created_idx on public.group_messages (group_id, created_at);
create index if not exists group_messages_sender_id_idx on public.group_messages (sender_id);
create index if not exists study_sessions_group_start_idx on public.study_sessions (group_id, starts_at);
create index if not exists study_sessions_creator_id_idx on public.study_sessions (creator_id);
create index if not exists resources_owner_id_idx on public.resources (owner_id);
create index if not exists resources_course_id_idx on public.resources (course_id);
create index if not exists resources_shared_group_id_idx on public.resources (shared_group_id);
create index if not exists ai_generations_owner_created_idx on public.ai_generations (owner_id, created_at);
create index if not exists ai_generations_status_idx on public.ai_generations (status);
create index if not exists flashcards_owner_id_idx on public.flashcards (owner_id);
create index if not exists flashcards_course_id_idx on public.flashcards (course_id);
create index if not exists quizzes_owner_id_idx on public.quizzes (owner_id);
create index if not exists quizzes_course_id_idx on public.quizzes (course_id);
create index if not exists quiz_attempts_quiz_user_idx on public.quiz_attempts (quiz_id, user_id);
create index if not exists quiz_attempts_user_completed_idx on public.quiz_attempts (user_id, completed_at);
create index if not exists study_tasks_owner_due_idx on public.study_tasks (owner_id, due_at);
create index if not exists study_tasks_course_id_idx on public.study_tasks (course_id);
create index if not exists notifications_user_created_idx on public.notifications (user_id, created_at);

create or replace function public.is_group_member(target_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.group_members gm
    where gm.group_id = target_group_id and gm.user_id = (select auth.uid())
  );
$$;

create or replace function public.is_group_manager(target_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.group_members gm
    where gm.group_id = target_group_id
      and gm.user_id = (select auth.uid())
      and gm.role in ('owner', 'moderator')
  );
$$;

create or replace function public.is_group_owner(target_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.group_members gm
    where gm.group_id = target_group_id
      and gm.user_id = (select auth.uid())
      and gm.role = 'owner'
  );
$$;

revoke all on function public.is_group_member(uuid) from public;
revoke all on function public.is_group_manager(uuid) from public;
revoke all on function public.is_group_owner(uuid) from public;
grant execute on function public.is_group_member(uuid) to authenticated;
grant execute on function public.is_group_manager(uuid) to authenticated;
grant execute on function public.is_group_owner(uuid) to authenticated;

create or replace function public.add_study_group_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.group_members (group_id, user_id, role)
  values (new.id, new.creator_id, 'owner')
  on conflict (group_id, user_id) do nothing;
  return new;
end;
$$;

revoke all on function public.add_study_group_owner() from public;
drop trigger if exists study_groups_add_owner on public.study_groups;
create trigger study_groups_add_owner
after insert on public.study_groups
for each row execute function public.add_study_group_owner();

alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.lectures enable row level security;
alter table public.notes enable row level security;
alter table public.study_materials enable row level security;
alter table public.timetable_events enable row level security;
alter table public.study_preferences enable row level security;
alter table public.chat_threads enable row level security;
alter table public.chat_messages enable row level security;
alter table public.universities enable row level security;
alter table public.course_catalog enable row level security;
alter table public.student_courses enable row level security;
alter table public.study_groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_invites enable row level security;
alter table public.resources enable row level security;
alter table public.group_messages enable row level security;
alter table public.study_sessions enable row level security;
alter table public.ai_generations enable row level security;
alter table public.flashcards enable row level security;
alter table public.quizzes enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.study_tasks enable row level security;
alter table public.notifications enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.profiles, public.courses, public.lectures, public.notes,
  public.study_materials, public.timetable_events, public.study_preferences, public.chat_threads,
  public.chat_messages, public.student_courses, public.group_members, public.group_invites,
  public.study_groups, public.resources, public.group_messages, public.study_sessions, public.flashcards,
  public.quizzes, public.study_tasks to authenticated;
grant select on public.universities, public.course_catalog, public.study_groups,
  public.ai_generations, public.quiz_attempts, public.notifications to authenticated;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles for select to authenticated using (id = (select auth.uid()));
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles for insert to authenticated with check (id = (select auth.uid()));
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy if exists courses_manage_own on public.courses;
create policy courses_manage_own on public.courses for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists lectures_manage_own on public.lectures;
create policy lectures_manage_own on public.lectures for all to authenticated
  using (
    user_id = (select auth.uid())
    and (course_id is null or exists (select 1 from public.courses c where c.id = course_id and c.user_id = (select auth.uid())))
  )
  with check (
    user_id = (select auth.uid())
    and (course_id is null or exists (select 1 from public.courses c where c.id = course_id and c.user_id = (select auth.uid())))
  );
drop policy if exists notes_manage_own on public.notes;
create policy notes_manage_own on public.notes for all to authenticated
  using (user_id = (select auth.uid()) and exists (select 1 from public.lectures l where l.id = lecture_id and l.user_id = (select auth.uid())))
  with check (user_id = (select auth.uid()) and exists (select 1 from public.lectures l where l.id = lecture_id and l.user_id = (select auth.uid())));
drop policy if exists study_materials_manage_own on public.study_materials;
create policy study_materials_manage_own on public.study_materials for all to authenticated
  using (user_id = (select auth.uid()) and exists (select 1 from public.notes n where n.id = note_id and n.user_id = (select auth.uid())))
  with check (user_id = (select auth.uid()) and exists (select 1 from public.notes n where n.id = note_id and n.user_id = (select auth.uid())));
drop policy if exists timetable_events_manage_own on public.timetable_events;
create policy timetable_events_manage_own on public.timetable_events for all to authenticated
  using (
    user_id = (select auth.uid())
    and (course_id is null or exists (select 1 from public.courses c where c.id = course_id and c.user_id = (select auth.uid())))
  )
  with check (
    user_id = (select auth.uid())
    and (course_id is null or exists (select 1 from public.courses c where c.id = course_id and c.user_id = (select auth.uid())))
  );
drop policy if exists study_preferences_manage_own on public.study_preferences;
create policy study_preferences_manage_own on public.study_preferences for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists chat_threads_manage_own on public.chat_threads;
create policy chat_threads_manage_own on public.chat_threads for all to authenticated
  using (
    user_id = (select auth.uid())
    and (course_id is null or exists (select 1 from public.courses c where c.id = course_id and c.user_id = (select auth.uid())))
  )
  with check (
    user_id = (select auth.uid())
    and (course_id is null or exists (select 1 from public.courses c where c.id = course_id and c.user_id = (select auth.uid())))
  );
drop policy if exists chat_messages_thread_owner on public.chat_messages;
create policy chat_messages_thread_owner on public.chat_messages for all to authenticated
  using (exists (select 1 from public.chat_threads t where t.id = thread_id and t.user_id = (select auth.uid())))
  with check (exists (select 1 from public.chat_threads t where t.id = thread_id and t.user_id = (select auth.uid())));

drop policy if exists universities_read_authenticated on public.universities;
create policy universities_read_authenticated on public.universities for select to authenticated using (true);
drop policy if exists course_catalog_read_authenticated on public.course_catalog;
create policy course_catalog_read_authenticated on public.course_catalog for select to authenticated using (true);
drop policy if exists student_courses_manage_own on public.student_courses;
create policy student_courses_manage_own on public.student_courses for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists study_groups_read_visible on public.study_groups;
create policy study_groups_read_visible on public.study_groups for select to authenticated
  using (visibility = 'public' or creator_id = (select auth.uid()) or (select public.is_group_member(id)));
drop policy if exists study_groups_create_own on public.study_groups;
create policy study_groups_create_own on public.study_groups for insert to authenticated
  with check (
    creator_id = (select auth.uid())
    and (course_id is null or exists (select 1 from public.courses c where c.id = course_id and c.user_id = (select auth.uid())))
  );
drop policy if exists study_groups_update_own on public.study_groups;
create policy study_groups_update_own on public.study_groups for update to authenticated
  using (creator_id = (select auth.uid()))
  with check (
    creator_id = (select auth.uid())
    and (course_id is null or exists (select 1 from public.courses c where c.id = course_id and c.user_id = (select auth.uid())))
  );
drop policy if exists study_groups_delete_own on public.study_groups;
create policy study_groups_delete_own on public.study_groups for delete to authenticated
  using (creator_id = (select auth.uid()));

drop policy if exists group_members_read_visible on public.group_members;
create policy group_members_read_visible on public.group_members for select to authenticated
  using (
    (select public.is_group_member(group_id))
    or exists (select 1 from public.study_groups g where g.id = group_id and g.visibility = 'public')
  );
drop policy if exists group_members_add_by_manager on public.group_members;
drop policy if exists group_members_add_by_owner on public.group_members;
create policy group_members_add_by_owner on public.group_members for insert to authenticated
  with check ((select public.is_group_owner(group_id)));
drop policy if exists group_members_remove_non_owner on public.group_members;
create policy group_members_remove_non_owner on public.group_members for delete to authenticated
  using (role <> 'owner' and (user_id = (select auth.uid()) or (select public.is_group_manager(group_id))));

drop policy if exists group_invites_manage_by_manager on public.group_invites;
create policy group_invites_manage_by_manager on public.group_invites for all to authenticated
  using ((select public.is_group_manager(group_id)))
  with check ((select public.is_group_manager(group_id)) and created_by = (select auth.uid()));

drop policy if exists resources_read_authorized on public.resources;
create policy resources_read_authorized on public.resources for select to authenticated
  using (
    owner_id = (select auth.uid())
    or (visibility = 'group' and shared_group_id is not null and (select public.is_group_member(shared_group_id)))
  );
drop policy if exists resources_create_own on public.resources;
create policy resources_create_own on public.resources for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and (course_id is null or exists (select 1 from public.courses c where c.id = course_id and c.user_id = (select auth.uid())))
    and (shared_group_id is null or (visibility = 'group' and (select public.is_group_member(shared_group_id))))
    and (storage_path is null or storage_path like ((select auth.uid())::text || '/%'))
  );
drop policy if exists resources_update_own on public.resources;
create policy resources_update_own on public.resources for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and (course_id is null or exists (select 1 from public.courses c where c.id = course_id and c.user_id = (select auth.uid())))
    and (shared_group_id is null or (visibility = 'group' and (select public.is_group_member(shared_group_id))))
    and (storage_path is null or storage_path like ((select auth.uid())::text || '/%'))
  );
drop policy if exists resources_delete_own on public.resources;
create policy resources_delete_own on public.resources for delete to authenticated
  using (owner_id = (select auth.uid()));

drop policy if exists group_messages_read_members on public.group_messages;
create policy group_messages_read_members on public.group_messages for select to authenticated
  using ((select public.is_group_member(group_id)));
drop policy if exists group_messages_create_members on public.group_messages;
create policy group_messages_create_members on public.group_messages for insert to authenticated
  with check (sender_id = (select auth.uid()) and (select public.is_group_member(group_id)));
drop policy if exists group_messages_update_own on public.group_messages;
create policy group_messages_update_own on public.group_messages for update to authenticated
  using (sender_id = (select auth.uid()) and (select public.is_group_member(group_id)))
  with check (sender_id = (select auth.uid()) and (select public.is_group_member(group_id)));
drop policy if exists group_messages_delete_authorized on public.group_messages;
create policy group_messages_delete_authorized on public.group_messages for delete to authenticated
  using (
    (select public.is_group_member(group_id))
    and (sender_id = (select auth.uid()) or (select public.is_group_manager(group_id)))
  );

drop policy if exists study_sessions_read_members on public.study_sessions;
create policy study_sessions_read_members on public.study_sessions for select to authenticated
  using ((select public.is_group_member(group_id)));
drop policy if exists study_sessions_create_by_manager on public.study_sessions;
create policy study_sessions_create_by_manager on public.study_sessions for insert to authenticated
  with check (creator_id = (select auth.uid()) and (select public.is_group_manager(group_id)));
drop policy if exists study_sessions_update_by_manager on public.study_sessions;
create policy study_sessions_update_by_manager on public.study_sessions for update to authenticated
  using ((select public.is_group_manager(group_id)))
  with check ((select public.is_group_manager(group_id)));
drop policy if exists study_sessions_delete_by_manager on public.study_sessions;
create policy study_sessions_delete_by_manager on public.study_sessions for delete to authenticated
  using ((select public.is_group_manager(group_id)));

drop policy if exists ai_generations_read_own on public.ai_generations;
create policy ai_generations_read_own on public.ai_generations for select to authenticated
  using (owner_id = (select auth.uid()));
drop policy if exists flashcards_manage_own on public.flashcards;
create policy flashcards_manage_own on public.flashcards for all to authenticated
  using (
    owner_id = (select auth.uid())
    and (course_id is null or exists (select 1 from public.courses c where c.id = course_id and c.user_id = (select auth.uid())))
  )
  with check (
    owner_id = (select auth.uid())
    and (course_id is null or exists (select 1 from public.courses c where c.id = course_id and c.user_id = (select auth.uid())))
  );
drop policy if exists quizzes_manage_own on public.quizzes;
create policy quizzes_manage_own on public.quizzes for all to authenticated
  using (
    owner_id = (select auth.uid())
    and (course_id is null or exists (select 1 from public.courses c where c.id = course_id and c.user_id = (select auth.uid())))
  )
  with check (
    owner_id = (select auth.uid())
    and (course_id is null or exists (select 1 from public.courses c where c.id = course_id and c.user_id = (select auth.uid())))
  );
drop policy if exists quiz_attempts_read_own on public.quiz_attempts;
create policy quiz_attempts_read_own on public.quiz_attempts for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists study_tasks_manage_own on public.study_tasks;
create policy study_tasks_manage_own on public.study_tasks for all to authenticated
  using (
    owner_id = (select auth.uid())
    and (course_id is null or exists (select 1 from public.courses c where c.id = course_id and c.user_id = (select auth.uid())))
  )
  with check (
    owner_id = (select auth.uid())
    and (course_id is null or exists (select 1 from public.courses c where c.id = course_id and c.user_id = (select auth.uid())))
  );
drop policy if exists notifications_read_own on public.notifications;
create policy notifications_read_own on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));

insert into storage.buckets (id, name, public)
values ('lecture-media', 'lecture-media', false), ('study-resources', 'study-resources', false)
on conflict (id) do update set public = false;

-- Supabase Storage manages RLS on storage.objects; do not alter that managed
-- table's RLS flag here because its owner may differ from the SQL Editor role.
drop policy if exists lecture_media_read_owner on storage.objects;
create policy lecture_media_read_owner on storage.objects for select to authenticated
  using (bucket_id = 'lecture-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists lecture_media_insert_owner on storage.objects;
create policy lecture_media_insert_owner on storage.objects for insert to authenticated
  with check (bucket_id = 'lecture-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists lecture_media_update_owner on storage.objects;
create policy lecture_media_update_owner on storage.objects for update to authenticated
  using (bucket_id = 'lecture-media' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'lecture-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists lecture_media_delete_owner on storage.objects;
create policy lecture_media_delete_owner on storage.objects for delete to authenticated
  using (bucket_id = 'lecture-media' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists study_resources_read_authorized on storage.objects;
create policy study_resources_read_authorized on storage.objects for select to authenticated
  using (
    bucket_id = 'study-resources'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or exists (
        select 1 from public.resources r
        where r.storage_path = name
          and r.owner_id::text = (storage.foldername(name))[1]
          and r.visibility = 'group'
          and r.shared_group_id is not null
          and (select public.is_group_member(r.shared_group_id))
      )
    )
  );
drop policy if exists study_resources_insert_owner on storage.objects;
create policy study_resources_insert_owner on storage.objects for insert to authenticated
  with check (bucket_id = 'study-resources' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists study_resources_update_owner on storage.objects;
create policy study_resources_update_owner on storage.objects for update to authenticated
  using (bucket_id = 'study-resources' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'study-resources' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists study_resources_delete_owner on storage.objects;
create policy study_resources_delete_owner on storage.objects for delete to authenticated
  using (bucket_id = 'study-resources' and (storage.foldername(name))[1] = (select auth.uid())::text);
