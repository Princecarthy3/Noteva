-- Stage 7: keep lecture status and transcript writes behind authenticated server routes.
drop policy if exists lectures_manage_own on public.lectures;
drop policy if exists lectures_read_own on public.lectures;
create policy lectures_read_own on public.lectures for select to authenticated
  using (
    user_id = (select auth.uid())
    and (course_id is null or exists (
      select 1 from public.courses c
      where c.id = course_id and c.user_id = (select auth.uid())
    ))
  );

revoke insert, update, delete on public.lectures from public, anon, authenticated;
grant select on public.lectures to authenticated;
grant select, insert, update, delete on public.lectures to service_role;
