alter table public.multiplayer_rooms
  add column if not exists draft_started_at timestamptz;

alter table public.multiplayer_players
  add column if not exists draft_schedule text[] not null default '{}',
  add column if not exists draft_round smallint not null default 0,
  add column if not exists draft_pick smallint not null default 0,
  add column if not exists draft_deadline timestamptz,
  add column if not exists connected boolean not null default false,
  add column if not exists left_at timestamptz,
  add column if not exists lobby_ready boolean not null default false;

alter table public.multiplayer_matches
  drop constraint if exists multiplayer_matches_status_check;
alter table public.multiplayer_matches
  add constraint multiplayer_matches_status_check
  check (status in ('waiting','ready','playing','halftime','moment','finished'));
alter table public.multiplayer_matches
  add column if not exists home_ready boolean not null default false,
  add column if not exists away_ready boolean not null default false,
  add column if not exists home_cpu boolean not null default false,
  add column if not exists away_cpu boolean not null default false,
  add column if not exists official_minute smallint not null default 0,
  add column if not exists phase_started_at timestamptz,
  add column if not exists phase_base_minute smallint not null default 0,
  add column if not exists decision_deadline timestamptz;

alter table public.multiplayer_decisions
  add column if not exists lineup jsonb,
  add column if not exists bench jsonb,
  add column if not exists substitutions jsonb;

create or replace function public.start_multiplayer_room(p_room_id uuid, p_bracket jsonb, p_matches jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists(select 1 from public.multiplayer_rooms where id=p_room_id and host_user_id=(select auth.uid()) and status='drafting') then
    raise exception 'Somente o anfitrião pode iniciar esta sala.';
  end if;
  if exists(select 1 from public.multiplayer_players where room_id=p_room_id and team is null) then
    raise exception 'Todos os participantes precisam concluir o elenco.';
  end if;
  insert into public.multiplayer_matches(id,room_id,round,match_index,home_team,away_team,home_participant_id,away_participant_id,controller_user_id,seed,status,result,progress,home_cpu,away_cpu)
  select id,room_id,round,match_index,home_team,away_team,home_participant_id,away_participant_id,controller_user_id,seed,status,result,progress,home_cpu,away_cpu
  from jsonb_to_recordset(p_matches) as x(id uuid,room_id uuid,round text,match_index smallint,home_team jsonb,away_team jsonb,home_participant_id uuid,away_participant_id uuid,controller_user_id uuid,seed bigint,status text,result jsonb,progress jsonb,home_cpu boolean,away_cpu boolean);
  update public.multiplayer_rooms set status='playing', bracket=p_bracket where id=p_room_id;
  update public.multiplayer_players set status='playing' where room_id=p_room_id;
end;
$$;

create or replace function public.advance_multiplayer_room(p_room_id uuid, p_round text, p_bracket jsonb, p_matches jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_multiplayer_room_member(p_room_id) or not exists(select 1 from public.multiplayer_rooms where id=p_room_id and status='playing') then
    raise exception 'A sala não pode avançar agora.';
  end if;
  if p_round not in ('quarterfinal','semifinal','final') then raise exception 'Fase inválida.'; end if;
  if exists(select 1 from public.multiplayer_matches where room_id=p_room_id and round=(select current_round from public.multiplayer_rooms where id=p_room_id) and status<>'finished') then
    raise exception 'A fase atual ainda tem partidas em aberto.';
  end if;
  if exists(select 1 from public.multiplayer_matches where room_id=p_room_id and round=p_round) then return; end if;
  insert into public.multiplayer_matches(id,room_id,round,match_index,home_team,away_team,home_participant_id,away_participant_id,controller_user_id,seed,status,result,progress,home_cpu,away_cpu)
  select id,room_id,round,match_index,home_team,away_team,home_participant_id,away_participant_id,controller_user_id,seed,status,result,progress,home_cpu,away_cpu
  from jsonb_to_recordset(p_matches) as x(id uuid,room_id uuid,round text,match_index smallint,home_team jsonb,away_team jsonb,home_participant_id uuid,away_participant_id uuid,controller_user_id uuid,seed bigint,status text,result jsonb,progress jsonb,home_cpu boolean,away_cpu boolean);
  update public.multiplayer_rooms set current_round=p_round, bracket=p_bracket where id=p_room_id;
end;
$$;

create table if not exists public.multiplayer_logs (
  id bigint generated always as identity primary key,
  room_id uuid not null references public.multiplayer_rooms(id) on delete cascade,
  match_id uuid references public.multiplayer_matches(id) on delete cascade,
  event text not null check (event in ('match_started','decision_saved','timer_expired','disconnected','cpu_takeover','match_resumed','match_finished')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.begin_multiplayer_draft(p_room_id uuid, p_schedules jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare player record; schedule text[];
begin
  if not exists(select 1 from public.multiplayer_rooms where id=p_room_id and host_user_id=(select auth.uid()) and status='waiting') then
    raise exception 'Somente o anfitrião pode iniciar a montagem.';
  end if;
  if exists(select 1 from public.multiplayer_players where room_id=p_room_id and not lobby_ready) then
    raise exception 'Todos os participantes precisam confirmar presença.';
  end if;
  for player in select id from public.multiplayer_players where room_id=p_room_id loop
    select array_agg(value order by ordinality) into schedule
    from jsonb_array_elements_text(coalesce(p_schedules -> player.id::text, '[]'::jsonb)) with ordinality;
    if coalesce(array_length(schedule, 1), 0) < 9 then raise exception 'Sorteio de anos incompleto.'; end if;
    update public.multiplayer_players
      set status='drafting', campaign=null, team=null, draft_schedule=schedule,
          draft_round=0, draft_pick=0, draft_deadline=null, left_at=null
      where id=player.id;
  end loop;
  update public.multiplayer_rooms set status='drafting', draft_started_at=now() where id=p_room_id;
end;
$$;

create or replace function public.toggle_multiplayer_lobby_ready(p_room_id uuid, p_ready boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists(select 1 from public.multiplayer_rooms where id=p_room_id and status='waiting') then
    raise exception 'A confirmação foi encerrada pelo anfitrião.';
  end if;
  update public.multiplayer_players set lobby_ready=p_ready
  where room_id=p_room_id and user_id=(select auth.uid());
  if not found then raise exception 'Você não participa desta sala.'; end if;
end;
$$;

create or replace function public.kick_multiplayer_player(p_room_id uuid, p_player_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists(select 1 from public.multiplayer_rooms where id=p_room_id and host_user_id=(select auth.uid()) and status in ('waiting','drafting')) then
    raise exception 'Somente o anfitrião pode remover participantes antes do torneio.';
  end if;
  if exists(select 1 from public.multiplayer_players where id=p_player_id and user_id=(select auth.uid())) then
    raise exception 'O anfitrião não pode remover a si mesmo.';
  end if;
  delete from public.multiplayer_players where id=p_player_id and room_id=p_room_id;
end;
$$;

create or replace function public.leave_multiplayer_room(p_room_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare leaving public.multiplayer_players; room_state text;
begin
  select * into leaving from public.multiplayer_players where room_id=p_room_id and user_id=(select auth.uid()) for update;
  if leaving.id is null then return; end if;
  select status into room_state from public.multiplayer_rooms where id=p_room_id for update;
  if room_state in ('waiting','drafting') then
    delete from public.multiplayer_players where id=leaving.id;
    if exists(select 1 from public.multiplayer_rooms where id=p_room_id and host_user_id=leaving.user_id) then
      update public.multiplayer_rooms set host_user_id=(select user_id from public.multiplayer_players where room_id=p_room_id order by slot_index limit 1) where id=p_room_id;
    end if;
  else
    update public.multiplayer_players set connected=false, left_at=now() where id=leaving.id;
    update public.multiplayer_matches set
      home_cpu = home_cpu or home_participant_id=leaving.id,
      away_cpu = away_cpu or away_participant_id=leaving.id
      where room_id=p_room_id and status<>'finished' and (home_participant_id=leaving.id or away_participant_id=leaving.id);
    insert into public.multiplayer_logs(room_id,event,details) values(p_room_id,'disconnected',jsonb_build_object('participant_id',leaving.id));
    insert into public.multiplayer_logs(room_id,event,details) values(p_room_id,'cpu_takeover',jsonb_build_object('participant_id',leaving.id));
  end if;
end;
$$;

create or replace function public.set_multiplayer_presence(p_room_id uuid, p_connected boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.multiplayer_players set connected=p_connected, left_at=case when p_connected then null else now() end
  where room_id=p_room_id and user_id=(select auth.uid());
end;
$$;

create or replace function public.mark_multiplayer_disconnected(p_room_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_multiplayer_room_member(p_room_id) then raise exception 'Acesso negado.'; end if;
  update public.multiplayer_players set connected=false, left_at=coalesce(left_at,now())
  where room_id=p_room_id and user_id=p_user_id;
  insert into public.multiplayer_logs(room_id,event,details)
  values(p_room_id,'disconnected',jsonb_build_object('user_id',p_user_id));
end;
$$;

create or replace function public.ready_multiplayer_match(p_match_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare target public.multiplayer_matches; player_id uuid; can_start boolean;
begin
  select * into target from public.multiplayer_matches where id=p_match_id for update;
  select id into player_id from public.multiplayer_players where room_id=target.room_id and user_id=(select auth.uid());
  if player_id is null or player_id not in (target.home_participant_id,target.away_participant_id) then raise exception 'Você não participa desta partida.'; end if;
  update public.multiplayer_matches set
    home_ready=home_ready or home_participant_id=player_id,
    away_ready=away_ready or away_participant_id=player_id,
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

create or replace function public.submit_multiplayer_decision(p_match_id uuid, p_instructions jsonb, p_lineup jsonb, p_bench jsonb, p_substitutions jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare target public.multiplayer_matches; player_id uuid; expected int; received int;
begin
  select * into target from public.multiplayer_matches where id=p_match_id for update;
  select id into player_id from public.multiplayer_players where room_id=target.room_id and user_id=(select auth.uid());
  if player_id is null or player_id not in (target.home_participant_id,target.away_participant_id) then raise exception 'Você não participa desta partida.'; end if;
  if target.status not in ('halftime','moment') or target.decision_deadline <= now() then raise exception 'O tempo para alterações terminou.'; end if;
  insert into public.multiplayer_decisions(match_id,user_id,instructions,lineup,bench,substitutions)
  values(p_match_id,(select auth.uid()),p_instructions,p_lineup,p_bench,p_substitutions)
  on conflict(match_id,user_id) do update set instructions=excluded.instructions,lineup=excluded.lineup,bench=excluded.bench,substitutions=excluded.substitutions;
  insert into public.multiplayer_logs(room_id,match_id,event,details)
  values(target.room_id,p_match_id,'decision_saved',jsonb_build_object('minute',target.official_minute,'participant_id',player_id));
  expected := (case when target.home_participant_id is not null and not target.home_cpu then 1 else 0 end)
    + (case when target.away_participant_id is not null and not target.away_cpu then 1 else 0 end);
  select count(*) into received from public.multiplayer_decisions d
  join public.multiplayer_players p on p.user_id=d.user_id
  where d.match_id=p_match_id and p.id in (target.home_participant_id,target.away_participant_id)
    and ((target.status='halftime' and d.instructions ? 'halftime') or (target.status='moment' and d.instructions ? 'moment'));
  if received >= expected then
    update public.multiplayer_matches set status='playing',phase_base_minute=official_minute,phase_started_at=now(),decision_deadline=null where id=p_match_id;
    insert into public.multiplayer_logs(room_id,match_id,event) values(target.room_id,p_match_id,'match_resumed');
  end if;
end;
$$;

create or replace function public.sync_multiplayer_match(p_match_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare target public.multiplayer_matches; calculated int; max_minute int;
begin
  select m.* into target from public.multiplayer_matches m
  where m.id=p_match_id and public.is_multiplayer_room_member(m.room_id) for update;
  if target.id is null then raise exception 'Partida não encontrada.'; end if;
  update public.multiplayer_matches m set
    home_cpu = m.home_cpu or exists(select 1 from public.multiplayer_players p where p.id=m.home_participant_id and not p.connected and p.left_at <= now()-interval '15 seconds'),
    away_cpu = m.away_cpu or exists(select 1 from public.multiplayer_players p where p.id=m.away_participant_id and not p.connected and p.left_at <= now()-interval '15 seconds')
  where m.id=p_match_id;
  if found then
    insert into public.multiplayer_logs(room_id,match_id,event,details)
    select target.room_id,p_match_id,'cpu_takeover',jsonb_build_object('minute',target.official_minute)
    where exists(select 1 from public.multiplayer_matches m where m.id=p_match_id and (m.home_cpu<>target.home_cpu or m.away_cpu<>target.away_cpu));
  end if;
  select * into target from public.multiplayer_matches where id=p_match_id;
  max_minute := case when coalesce((target.result->>'wentToExtraTime')::boolean,false) then 122 else 90 end;
  if target.status='playing' then
    calculated := least(max_minute, target.phase_base_minute + floor(extract(epoch from (now()-target.phase_started_at))*2)::int);
    if calculated >= 45 and target.phase_base_minute < 45 then
      update public.multiplayer_matches set status='halftime',official_minute=45,decision_deadline=now()+interval '15 seconds' where id=p_match_id;
    elsif calculated >= 65 and target.phase_base_minute < 65 then
      update public.multiplayer_matches set status='moment',official_minute=65,decision_deadline=now()+interval '15 seconds' where id=p_match_id;
    elsif calculated >= max_minute then
      update public.multiplayer_matches set status='finished',official_minute=max_minute,phase_started_at=null where id=p_match_id;
      insert into public.multiplayer_logs(room_id,match_id,event) values(target.room_id,p_match_id,'match_finished');
    else
      update public.multiplayer_matches set official_minute=calculated where id=p_match_id;
    end if;
  elsif target.status in ('halftime','moment') and target.decision_deadline <= now() then
    update public.multiplayer_matches set status='playing',phase_base_minute=official_minute,phase_started_at=now(),decision_deadline=null where id=p_match_id;
    insert into public.multiplayer_logs(room_id,match_id,event,details) values(target.room_id,p_match_id,'timer_expired',jsonb_build_object('minute',target.official_minute));
    insert into public.multiplayer_logs(room_id,match_id,event) values(target.room_id,p_match_id,'match_resumed');
  end if;
end;
$$;

alter table public.multiplayer_logs enable row level security;
create policy "room members read logs" on public.multiplayer_logs for select to authenticated
using (public.is_multiplayer_room_member(room_id));

grant select on public.multiplayer_logs to authenticated;
grant execute on function public.begin_multiplayer_draft(uuid,jsonb) to authenticated;
grant execute on function public.toggle_multiplayer_lobby_ready(uuid,boolean) to authenticated;
grant execute on function public.kick_multiplayer_player(uuid,uuid) to authenticated;
grant execute on function public.leave_multiplayer_room(uuid) to authenticated;
grant execute on function public.set_multiplayer_presence(uuid,boolean) to authenticated;
grant execute on function public.mark_multiplayer_disconnected(uuid,uuid) to authenticated;
grant execute on function public.ready_multiplayer_match(uuid) to authenticated;
grant execute on function public.submit_multiplayer_decision(uuid,jsonb,jsonb,jsonb,jsonb) to authenticated;
grant execute on function public.sync_multiplayer_match(uuid) to authenticated;

revoke all on function public.begin_multiplayer_draft(uuid,jsonb) from public,anon;
revoke all on function public.toggle_multiplayer_lobby_ready(uuid,boolean) from public,anon;
revoke all on function public.kick_multiplayer_player(uuid,uuid) from public,anon;
revoke all on function public.leave_multiplayer_room(uuid) from public,anon;
revoke all on function public.set_multiplayer_presence(uuid,boolean) from public,anon;
revoke all on function public.mark_multiplayer_disconnected(uuid,uuid) from public,anon;
revoke all on function public.ready_multiplayer_match(uuid) from public,anon;
revoke all on function public.submit_multiplayer_decision(uuid,jsonb,jsonb,jsonb,jsonb) from public,anon;
revoke all on function public.sync_multiplayer_match(uuid) from public,anon;

alter publication supabase_realtime add table public.multiplayer_logs;

alter policy "controller updates match" on public.multiplayer_matches
using (
  exists(select 1 from public.multiplayer_players p where p.room_id=multiplayer_matches.room_id and p.user_id=(select auth.uid()) and p.id in (home_participant_id,away_participant_id))
)
with check (
  exists(select 1 from public.multiplayer_players p where p.room_id=multiplayer_matches.room_id and p.user_id=(select auth.uid()) and p.id in (home_participant_id,away_participant_id))
);
