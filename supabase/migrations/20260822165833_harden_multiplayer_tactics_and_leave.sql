create or replace function public.leave_multiplayer_room(p_room_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare leaving public.multiplayer_players; room_state text; successor uuid;
begin
  select * into leaving from public.multiplayer_players where room_id=p_room_id and user_id=(select auth.uid()) for update;
  if leaving.id is null then return; end if;
  select status into room_state from public.multiplayer_rooms where id=p_room_id for update;
  if room_state in ('waiting','drafting') then
    if exists(select 1 from public.multiplayer_rooms where id=p_room_id and host_user_id=leaving.user_id) then
      select user_id into successor from public.multiplayer_players where room_id=p_room_id and id<>leaving.id order by slot_index limit 1;
      if successor is null then
        delete from public.multiplayer_rooms where id=p_room_id;
        return;
      end if;
      update public.multiplayer_rooms set host_user_id=successor where id=p_room_id;
    end if;
    delete from public.multiplayer_players where id=leaving.id;
  else
    update public.multiplayer_players set connected=false,left_at=now() where id=leaving.id;
    update public.multiplayer_matches set
      home_cpu=home_cpu or home_participant_id=leaving.id,
      away_cpu=away_cpu or away_participant_id=leaving.id
    where room_id=p_room_id and status<>'finished' and (home_participant_id=leaving.id or away_participant_id=leaving.id);
    insert into public.multiplayer_logs(room_id,event,details) values(p_room_id,'disconnected',jsonb_build_object('participant_id',leaving.id));
  end if;
end;
$$;

create or replace function public.submit_multiplayer_decision(p_match_id uuid,p_instructions jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare target public.multiplayer_matches; player_id uuid; expected int; received int;
begin
  select * into target from public.multiplayer_matches where id=p_match_id for update;
  select id into player_id from public.multiplayer_players where room_id=target.room_id and user_id=(select auth.uid());
  if player_id is null or player_id not in (target.home_participant_id,target.away_participant_id) then raise exception 'Você não participa desta partida.'; end if;
  if target.status not in ('halftime','moment') or target.decision_deadline<=now() then raise exception 'O tempo para decidir terminou.'; end if;
  if p_instructions ? 'substitutions' then raise exception 'Não existem substituições no multiplayer.'; end if;
  if target.status='halftime' and coalesce(p_instructions->>'halftime','') not in ('keep','press','attack','defend') then raise exception 'Orientação de intervalo inválida.'; end if;
  if target.status='moment' and not (p_instructions ? 'moment') then raise exception 'Orientação aos 65 minutos inválida.'; end if;
  insert into public.multiplayer_decisions(match_id,user_id,instructions)
  values(p_match_id,(select auth.uid()),p_instructions)
  on conflict(match_id,user_id) do update set instructions=excluded.instructions;
  insert into public.multiplayer_logs(room_id,match_id,event,details)
  values(target.room_id,p_match_id,'decision_saved',jsonb_build_object('minute',target.official_minute,'participant_id',player_id));
  expected := (case when target.home_participant_id is not null and not target.home_cpu then 1 else 0 end)
    +(case when target.away_participant_id is not null and not target.away_cpu then 1 else 0 end);
  select count(*) into received from public.multiplayer_decisions d
  join public.multiplayer_players p on p.user_id=d.user_id
  where d.match_id=p_match_id and p.id in (target.home_participant_id,target.away_participant_id)
    and ((target.status='halftime' and d.instructions?'halftime') or (target.status='moment' and d.instructions?'moment'));
  if received>=expected then
    update public.multiplayer_matches set status='playing',phase_base_minute=official_minute,phase_started_at=now(),decision_deadline=null where id=p_match_id;
    insert into public.multiplayer_logs(room_id,match_id,event) values(target.room_id,p_match_id,'match_resumed');
  end if;
end;
$$;

revoke all on function public.leave_multiplayer_room(uuid) from public,anon;
revoke all on function public.submit_multiplayer_decision(uuid,jsonb) from public,anon;
grant execute on function public.leave_multiplayer_room(uuid) to authenticated;
grant execute on function public.submit_multiplayer_decision(uuid,jsonb) to authenticated;
