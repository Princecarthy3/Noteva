-- Stage 9: tighten group privacy and add member-submitted content reports.
create table if not exists public.group_reports (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.study_groups(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  message_id uuid references public.group_messages(id) on delete set null,
  reason text not null check (length(trim(reason)) between 10 and 1000),
  status text not null default 'open' check (status in ('open', 'reviewed', 'dismissed')),
  created_at timestamptz not null default now()
);

create index if not exists group_reports_group_created_idx
  on public.group_reports (group_id, created_at desc);

alter table public.group_messages
  drop constraint if exists group_messages_stage9_body_length_check;
alter table public.group_messages
  add constraint group_messages_stage9_body_length_check
  check (length(trim(body)) <= 2000) not valid;

alter table public.group_reports enable row level security;
revoke all on public.group_reports from public, anon, authenticated;
grant all on public.group_reports to service_role;

-- Membership, invitation, discussion, and session mutations go through
-- authenticated server routes that enforce the role and input rules.
revoke insert, update, delete on public.group_members from public, anon, authenticated;
grant select on public.group_members to authenticated;
revoke all on public.group_invites from public, anon, authenticated;
revoke insert, update, delete on public.group_messages from public, anon, authenticated;
grant select on public.group_messages to authenticated;
revoke insert, update, delete on public.study_sessions from public, anon, authenticated;
grant select on public.study_sessions to authenticated;
grant all on public.group_members, public.group_invites, public.group_messages, public.study_sessions to service_role;

-- Public group discovery does not disclose the membership roster.
drop policy if exists group_members_read_visible on public.group_members;
create policy group_members_read_visible on public.group_members for select to authenticated
  using ((select public.is_group_member(group_id)));
drop policy if exists group_members_add_by_owner on public.group_members;
drop policy if exists group_members_remove_non_owner on public.group_members;

-- Existing messages and sessions are visible only to current group members.
drop policy if exists group_messages_read_members on public.group_messages;
create policy group_messages_read_members on public.group_messages for select to authenticated
  using ((select public.is_group_member(group_id)));

drop policy if exists study_sessions_read_members on public.study_sessions;
create policy study_sessions_read_members on public.study_sessions for select to authenticated
  using ((select public.is_group_member(group_id)));

create or replace function public.delete_study_group(target_group_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.study_groups g
    join public.group_members gm on gm.group_id = g.id
    where g.id = target_group_id
      and g.creator_id = (select auth.uid())
      and gm.user_id = (select auth.uid())
      and gm.role = 'owner'
  ) then
    raise exception 'Only the current group owner may delete the group.'
      using errcode = '42501';
  end if;

  update public.resources
  set shared_group_id = null,
      visibility = 'private',
      updated_at = now()
  where shared_group_id = target_group_id;

  delete from public.study_groups where id = target_group_id;
end;
$$;

revoke all on function public.delete_study_group(uuid) from public, anon;
grant execute on function public.delete_study_group(uuid) to authenticated;
