create or replace function public.get_event_participants(p_event_id uuid)
returns table (user_id uuid, email text)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not (
    exists (
      select 1
      from events
      where id = p_event_id
        and creator_id = auth.uid()
    )
    or exists (
      select 1
      from profiles
      where id = auth.uid()
        and role = 'admin'
    )
  ) then
    raise exception 'not authorized';
  end if;

  return query
    select p.user_id, u.email
    from participants p
    join auth.users u on u.id = p.user_id
    where p.event_id = p_event_id
      and p.status = 'registered'
    order by p.created_at asc;
end;
$$;

revoke execute on function public.get_event_participants(uuid) from public;
grant execute on function public.get_event_participants(uuid) to authenticated;
