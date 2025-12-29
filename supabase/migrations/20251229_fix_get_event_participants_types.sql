CREATE OR REPLACE FUNCTION public.get_event_participants(p_event_id uuid)
 RETURNS TABLE(user_id uuid, email text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
begin
  -- Check if the requester is the event creator or an admin
  if not (
    exists (
      select 1
      from public.events
      where id = p_event_id
        and creator_id = auth.uid()
    )
    or exists (
      select 1
      from public.profiles
      where id = auth.uid()
        and role = 'admin'
    )
  ) then
    raise exception 'not authorized';
  end if;

  return query
    select p.user_id, prof.email
    from public.participants p
    join public.profiles prof on prof.id = p.user_id
    where p.event_id = p_event_id
      and p.status = 'registered'
    order by p.created_at asc;
end;
$function$;
