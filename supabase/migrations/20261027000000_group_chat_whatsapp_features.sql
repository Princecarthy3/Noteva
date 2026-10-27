-- WhatsApp-style group chat: replies, edit, soft-delete
alter table public.group_messages
  add column if not exists reply_to_id uuid references public.group_messages(id) on delete set null;

alter table public.group_messages
  add column if not exists edited_at timestamptz;

alter table public.group_messages
  add column if not exists deleted_at timestamptz;

create index if not exists group_messages_reply_to_id_idx
  on public.group_messages (reply_to_id)
  where reply_to_id is not null;

-- Optional per-user read receipts for double-tick
create table if not exists public.group_message_reads (
  message_id uuid not null references public.group_messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

create index if not exists group_message_reads_user_id_idx
  on public.group_message_reads (user_id);

alter table public.group_message_reads enable row level security;

drop policy if exists group_message_reads_select_members on public.group_message_reads;
create policy group_message_reads_select_members on public.group_message_reads
  for select to authenticated
  using (
    exists (
      select 1 from public.group_messages gm
      join public.group_members m on m.group_id = gm.group_id
      where gm.id = message_id and m.user_id = auth.uid()
    )
  );

revoke insert, update, delete on public.group_message_reads from public, anon, authenticated;
grant select on public.group_message_reads to authenticated;
grant all on public.group_message_reads to service_role;
