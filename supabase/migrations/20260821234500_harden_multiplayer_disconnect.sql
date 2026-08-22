create or replace function public.set_multiplayer_presence(p_room_id uuid, p_connected boolean)
returns void language plpgsql security definer set search_path = public as $$
declare was_connected boolean;
begin
  select connected into was_connected
  from public.multiplayer_players
  where room_id=p_room_id and user_id=(select auth.uid())
  for update;

  if not found then return; end if;

  update public.multiplayer_players
  set connected=p_connected, left_at=case when p_connected then null else coalesce(left_at,now()) end
  where room_id=p_room_id and user_id=(select auth.uid());

  if not p_connected and was_connected then
    insert into public.multiplayer_logs(room_id,event,details)
    values(p_room_id,'disconnected',jsonb_build_object('user_id',(select auth.uid())));
  end if;
end;
$$;

create or replace function public.mark_multiplayer_disconnected(p_room_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare was_connected boolean;
begin
  if not public.is_multiplayer_room_member(p_room_id) then raise exception 'Acesso negado.'; end if;

  select connected into was_connected
  from public.multiplayer_players
  where room_id=p_room_id and user_id=p_user_id
  for update;

  if not found then return; end if;

  update public.multiplayer_players
  set connected=false, left_at=coalesce(left_at,now())
  where room_id=p_room_id and user_id=p_user_id;

  if was_connected then
    insert into public.multiplayer_logs(room_id,event,details)
    values(p_room_id,'disconnected',jsonb_build_object('user_id',p_user_id));
  end if;
end;
$$;

grant execute on function public.set_multiplayer_presence(uuid,boolean) to authenticated;
grant execute on function public.mark_multiplayer_disconnected(uuid,uuid) to authenticated;
revoke all on function public.set_multiplayer_presence(uuid,boolean) from public,anon;
revoke all on function public.mark_multiplayer_disconnected(uuid,uuid) from public,anon;
