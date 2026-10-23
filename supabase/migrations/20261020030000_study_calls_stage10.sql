-- Stage 10: stable, unpredictable room names for scheduled group calls.
alter table public.study_sessions
  add column if not exists call_room_id uuid;

update public.study_sessions
set call_room_id = gen_random_uuid()
where call_room_id is null;

alter table public.study_sessions
  alter column call_room_id set default gen_random_uuid(),
  alter column call_room_id set not null;

create unique index if not exists study_sessions_call_room_id_idx
  on public.study_sessions (call_room_id);
