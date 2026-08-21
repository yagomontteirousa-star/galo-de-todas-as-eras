create or replace function public.ready_multiplayer_match(p_match_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare target public.multiplayer_matches; player_id uuid; can_start boolean;
begin
  select * into target from public.multiplayer_matches where id=p_match_id for update;
  select id into player_id from public.multiplayer_players where room_id=target.room_id and user_id=(select auth.uid());
  if player_id is null or player_id not in (target.home_participant_id,target.away_participant_id) then raise exception 'Você não participa desta partida.'; end if;
  update public.multiplayer_matches set
    home_ready=home_ready or coalesce(home_participant_id=player_id,false),
    away_ready=away_ready or coalesce(away_participant_id=player_id,false),
    status='ready'
  where id=p_match_id;
  select * into target from public.multiplayer_matches where id=p_match_id;
  can_start := (target.home_participant_id is null or target.home_cpu or target.home_ready)
    and (target.away_participant_id is null or target.away_cpu or target.away_ready);
  if can_start then
    update public.multiplayer_matches set status='playing',official_minute=0,phase_base_minute=0,phase_started_at=now(),decision_deadline=null where id=p_match_id;
    insert into public.multiplayer_logs(room_id,match_id,event) values(target.room_id,p_match_id,'match_started');
  end if;
end;
$$;

revoke all on function public.ready_multiplayer_match(uuid) from public,anon;
grant execute on function public.ready_multiplayer_match(uuid) to authenticated;
