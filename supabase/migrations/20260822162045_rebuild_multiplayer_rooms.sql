begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

alter table public.multiplayer_rooms
  add column if not exists mode text not null default 'knockout',
  add column if not exists bracket_size smallint not null default 16,
  add column if not exists is_public boolean not null default false,
  add column if not exists password_required boolean not null default false;

alter table public.multiplayer_rooms
  drop constraint if exists multiplayer_rooms_mode_check,
  drop constraint if exists multiplayer_rooms_bracket_size_check;
alter table public.multiplayer_rooms
  add constraint multiplayer_rooms_mode_check check (mode in ('final','knockout')),
  add constraint multiplayer_rooms_bracket_size_check check (bracket_size in (2,4,8,16));

create table if not exists private.multiplayer_room_secrets (
  room_id uuid primary key references public.multiplayer_rooms(id) on delete cascade,
  password_hash text not null
);
revoke all on private.multiplayer_room_secrets from public, anon, authenticated;

alter table public.multiplayer_players
  add column if not exists drafted_person_ids text[] not null default '{}';

alter table public.multiplayer_matches
  drop constraint if exists multiplayer_matches_status_check;
alter table public.multiplayer_matches
  add constraint multiplayer_matches_status_check
  check (status in ('waiting','ready','playing','halftime','moment','shootout','finished')),
  add column if not exists shootout_step smallint not null default 0,
  add column if not exists shootout_revealed boolean not null default false;

drop function if exists public.create_multiplayer_room(text,text);
drop function if exists public.join_multiplayer_room(text,text);
drop function if exists public.submit_multiplayer_decision(uuid,jsonb,jsonb,jsonb,jsonb);

alter table public.multiplayer_decisions
  drop column if exists lineup,
  drop column if exists bench,
  drop column if exists substitutions;

drop policy if exists "player updates self" on public.multiplayer_players;
drop policy if exists "controller updates match" on public.multiplayer_matches;
revoke update on public.multiplayer_players from authenticated;
revoke update on public.multiplayer_matches from authenticated;

create or replace function public.create_multiplayer_room(
  p_nickname text,
  p_mode text,
  p_is_public boolean,
  p_password text default null
)
returns text language plpgsql security definer set search_path = public, private as $$
declare new_code text; new_room_id uuid; attempts int := 0; normalized_password text := nullif(trim(p_password),'');
begin
  if (select auth.uid()) is null then raise exception 'Sessão anônima necessária.'; end if;
  if char_length(trim(p_nickname)) not between 2 and 24 then raise exception 'Use um apelido entre 2 e 24 caracteres.'; end if;
  if p_mode not in ('final','knockout') then raise exception 'Modo de sala inválido.'; end if;
  if normalized_password is not null and char_length(normalized_password) not between 4 and 32 then
    raise exception 'A senha precisa ter entre 4 e 32 caracteres.';
  end if;
  loop
    attempts := attempts + 1;
    new_code := public.multiplayer_code();
    begin
      insert into public.multiplayer_rooms(code,host_user_id,ratings_mode,mode,bracket_size,is_public,password_required,current_round)
      values(new_code,(select auth.uid()),'visible',p_mode,case when p_mode='final' then 2 else 16 end,p_is_public,normalized_password is not null,case when p_mode='final' then 'final' else 'round16' end)
      returning id into new_room_id;
      exit;
    exception when unique_violation then
      if attempts >= 5 then raise exception 'Não foi possível gerar o código da sala.'; end if;
    end;
  end loop;
  if normalized_password is not null then
    insert into private.multiplayer_room_secrets(room_id,password_hash)
    values(new_room_id,crypt(normalized_password,gen_salt('bf')));
  end if;
  insert into public.multiplayer_players(room_id,user_id,nickname,slot_index,connected)
  values(new_room_id,(select auth.uid()),trim(p_nickname),0,true);
  return new_code;
end;
$$;

create or replace function public.get_multiplayer_room_preview(p_code text)
returns table(code text, mode text, bracket_size smallint, is_public boolean, password_required boolean, player_count bigint, status text)
language sql stable security definer set search_path = public as $$
  select r.code,r.mode,r.bracket_size,r.is_public,r.password_required,count(p.id),r.status
  from public.multiplayer_rooms r
  left join public.multiplayer_players p on p.room_id=r.id
  where r.code=upper(trim(p_code)) and r.status='waiting'
  group by r.id;
$$;

create or replace function public.list_open_multiplayer_rooms(p_mode text default null)
returns table(code text, mode text, bracket_size smallint, password_required boolean, player_count bigint, slots_left bigint, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select r.code,r.mode,r.bracket_size,r.password_required,count(p.id),r.bracket_size-count(p.id),r.created_at
  from public.multiplayer_rooms r
  left join public.multiplayer_players p on p.room_id=r.id
  where r.is_public and r.status='waiting' and (p_mode is null or r.mode=p_mode)
  group by r.id
  having count(p.id)<r.bracket_size
  order by r.created_at desc
  limit 24;
$$;

create or replace function public.join_multiplayer_room(p_code text,p_nickname text,p_password text default null)
returns uuid language plpgsql security definer set search_path = public, private as $$
declare target public.multiplayer_rooms; next_slot int; player_id uuid; secret_hash text;
begin
  if (select auth.uid()) is null then raise exception 'Sessão anônima necessária.'; end if;
  if char_length(trim(p_nickname)) not between 2 and 24 then raise exception 'Use um apelido entre 2 e 24 caracteres.'; end if;
  select * into target from public.multiplayer_rooms where code=upper(trim(p_code)) for update;
  if target.id is null then raise exception 'Sala não encontrada.'; end if;
  if target.status<>'waiting' then raise exception 'A sala já começou.'; end if;
  select id into player_id from public.multiplayer_players where room_id=target.id and user_id=(select auth.uid());
  if player_id is not null then return player_id; end if;
  if target.password_required then
    select password_hash into secret_hash from private.multiplayer_room_secrets where room_id=target.id;
    if secret_hash is null or crypt(coalesce(p_password,''),secret_hash)<>secret_hash then raise exception 'Senha da sala incorreta.'; end if;
  end if;
  select min(candidate) into next_slot
  from generate_series(0,target.bracket_size-1) candidate
  where not exists(select 1 from public.multiplayer_players p where p.room_id=target.id and p.slot_index=candidate);
  if next_slot is null then raise exception 'A sala está cheia.'; end if;
  insert into public.multiplayer_players(room_id,user_id,nickname,slot_index,connected)
  values(target.id,(select auth.uid()),trim(p_nickname),next_slot,true)
  returning id into player_id;
  return player_id;
end;
$$;

create or replace function public.join_random_multiplayer_room(p_nickname text,p_mode text default null)
returns text language plpgsql security definer set search_path = public as $$
declare target_code text;
begin
  select r.code into target_code
  from public.multiplayer_rooms r
  where r.is_public and not r.password_required and r.status='waiting'
    and (p_mode is null or r.mode=p_mode)
    and (select count(*) from public.multiplayer_players p where p.room_id=r.id)<r.bracket_size
  order by random() limit 1;
  if target_code is null then raise exception 'Nenhuma sala pública disponível agora.'; end if;
  perform public.join_multiplayer_room(target_code,p_nickname,null);
  return target_code;
end;
$$;

create or replace function public.configure_multiplayer_room(p_room_id uuid,p_ratings_mode text,p_bracket_size smallint)
returns void language plpgsql security definer set search_path = public as $$
declare target public.multiplayer_rooms; player_count int;
begin
  select * into target from public.multiplayer_rooms where id=p_room_id for update;
  if target.host_user_id<>(select auth.uid()) or target.status<>'waiting' then raise exception 'Somente o anfitrião pode configurar a sala antes do draft.'; end if;
  if p_ratings_mode not in ('visible','memory') then raise exception 'Configuração de overall inválida.'; end if;
  if p_bracket_size not in (2,4,8,16) then raise exception 'Tamanho de chave inválido.'; end if;
  if target.mode='final' and p_bracket_size<>2 then raise exception 'A Final direta sempre tem duas vagas.'; end if;
  select count(*) into player_count from public.multiplayer_players where room_id=p_room_id;
  if player_count>p_bracket_size then raise exception 'A chave escolhida é menor que o número de participantes.'; end if;
  update public.multiplayer_rooms set ratings_mode=p_ratings_mode,bracket_size=p_bracket_size,
    current_round=case p_bracket_size when 2 then 'final' when 4 then 'semifinal' when 8 then 'quarterfinal' else 'round16' end
  where id=p_room_id;
end;
$$;

create or replace function public.begin_multiplayer_draft(p_room_id uuid,p_schedules jsonb)
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
    from jsonb_array_elements_text(coalesce(p_schedules->player.id::text,'[]'::jsonb)) with ordinality;
    if coalesce(array_length(schedule,1),0)<6 then raise exception 'Sorteio de anos incompleto.'; end if;
    update public.multiplayer_players set status='drafting',campaign=null,team=null,draft_schedule=schedule,
      draft_round=0,draft_pick=0,draft_deadline=now()+interval '15 seconds',drafted_person_ids='{}',left_at=null
    where id=player.id;
  end loop;
  update public.multiplayer_rooms set status='drafting',draft_started_at=now() where id=p_room_id;
end;
$$;

create or replace function public.start_multiplayer_player_draft(p_player_id uuid,p_campaign jsonb,p_deadline timestamptz,p_auto boolean default false)
returns void language plpgsql security definer set search_path = public as $$
declare target public.multiplayer_players; room_state public.multiplayer_rooms;
begin
  select * into target from public.multiplayer_players where id=p_player_id for update;
  select * into room_state from public.multiplayer_rooms where id=target.room_id;
  if target.id is null or room_state.status<>'drafting' or target.campaign is not null then raise exception 'A montagem não pode começar agora.'; end if;
  if p_auto then
    if not public.is_multiplayer_room_member(target.room_id) or target.draft_deadline>now() then raise exception 'A escolha automática ainda não foi liberada.'; end if;
  elsif target.user_id<>(select auth.uid()) then raise exception 'Você só pode montar o próprio elenco.'; end if;
  if not (p_campaign ? 'formation') or not (p_campaign ? 'tactic') then raise exception 'Formação e tática são obrigatórias.'; end if;
  if coalesce(jsonb_array_length(p_campaign->'lineup'),0)<>0 or coalesce(jsonb_array_length(p_campaign->'bench'),0)<>0 then raise exception 'A montagem precisa começar vazia.'; end if;
  update public.multiplayer_players set campaign=p_campaign,draft_deadline=p_deadline where id=p_player_id;
end;
$$;

create or replace function public.save_multiplayer_draft_pick(
  p_player_id uuid,
  p_campaign jsonb,
  p_team jsonb,
  p_status text,
  p_expected_round smallint,
  p_expected_pick smallint,
  p_next_round smallint,
  p_next_pick smallint,
  p_next_deadline timestamptz,
  p_person_ids text[],
  p_auto boolean default false
)
returns void language plpgsql security definer set search_path = public as $$
declare target public.multiplayer_players; room_status text; lineup_count int; unique_people int;
begin
  select * into target from public.multiplayer_players where id=p_player_id for update;
  select status into room_status from public.multiplayer_rooms where id=target.room_id;
  if target.id is null or room_status<>'drafting' or target.status<>'drafting' then raise exception 'A escolha não pode ser salva agora.'; end if;
  if target.draft_round<>p_expected_round or target.draft_pick<>p_expected_pick then raise exception 'Esta escolha já foi processada.'; end if;
  if p_auto then
    if not public.is_multiplayer_room_member(target.room_id) or target.draft_deadline>now() then raise exception 'A escolha automática ainda não foi liberada.'; end if;
  elsif target.user_id<>(select auth.uid()) then raise exception 'Você só pode alterar o próprio elenco.'; end if;
  lineup_count := coalesce(jsonb_array_length(p_campaign->'lineup'),0);
  if lineup_count<>coalesce(jsonb_array_length(target.campaign->'lineup'),0)+1 or lineup_count>11 then raise exception 'A escolha precisa adicionar exatamente um titular.'; end if;
  if coalesce(jsonb_array_length(p_campaign->'bench'),0)<>0 then raise exception 'Não existe banco de reservas no multiplayer.'; end if;
  select count(distinct value) into unique_people from unnest(coalesce(p_person_ids,'{}')) value;
  if cardinality(coalesce(p_person_ids,'{}'))<>lineup_count or unique_people<>lineup_count then raise exception 'Um atleta não pode ser escolhido duas vezes.'; end if;
  if p_status not in ('drafting','ready') then raise exception 'Estado de draft inválido.'; end if;
  if p_status='ready' and (lineup_count<>11 or p_team is null) then raise exception 'O onze ainda não está completo.'; end if;
  if p_status='drafting' and lineup_count<11 and not (
    (p_expected_pick=0 and p_next_round=p_expected_round and p_next_pick=1)
    or (p_expected_pick=1 and p_next_round=p_expected_round+1 and p_next_pick=0)
  ) then raise exception 'Avanço de escolha fora de ordem.'; end if;
  update public.multiplayer_players set campaign=p_campaign,team=p_team,status=p_status,
    draft_round=p_next_round,draft_pick=p_next_pick,draft_deadline=case when p_status='ready' then null else p_next_deadline end,
    drafted_person_ids=p_person_ids
  where id=p_player_id;
end;
$$;

create or replace function public.relocate_multiplayer_draft_lineup(p_player_id uuid,p_campaign jsonb,p_team jsonb default null)
returns void language plpgsql security definer set search_path = public as $$
declare target public.multiplayer_players; before_players text[]; after_players text[];
begin
  select * into target from public.multiplayer_players where id=p_player_id for update;
  if target.id is null or target.user_id<>(select auth.uid()) or target.status<>'drafting' then
    raise exception 'Você só pode organizar o próprio elenco durante o draft.';
  end if;
  select array_agg(item->>'playerId' order by item->>'playerId') into before_players
  from jsonb_array_elements(coalesce(target.campaign->'lineup','[]'::jsonb)) item;
  select array_agg(item->>'playerId' order by item->>'playerId') into after_players
  from jsonb_array_elements(coalesce(p_campaign->'lineup','[]'::jsonb)) item;
  if coalesce(before_players,'{}')<>coalesce(after_players,'{}')
    or coalesce(jsonb_array_length(p_campaign->'bench'),0)<>0 then
    raise exception 'A organização pode trocar posições, mas não atletas.';
  end if;
  update public.multiplayer_players set campaign=p_campaign,team=p_team where id=p_player_id;
end;
$$;

create or replace function public.finalize_multiplayer_draft(p_player_id uuid,p_campaign jsonb,p_team jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.multiplayer_players p set campaign=p_campaign,team=p_team,status='ready',draft_deadline=null
  where p.id=p_player_id and p.user_id=(select auth.uid()) and p.status='drafting'
    and coalesce(jsonb_array_length(p_campaign->'lineup'),0)=11 and coalesce(jsonb_array_length(p_campaign->'bench'),0)=0;
  if not found then raise exception 'O onze ainda não pode ser confirmado.'; end if;
end;
$$;

create or replace function public.start_multiplayer_room(p_room_id uuid,p_bracket jsonb,p_matches jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare target public.multiplayer_rooms; match_count int;
begin
  select * into target from public.multiplayer_rooms where id=p_room_id for update;
  if target.host_user_id<>(select auth.uid()) or target.status<>'drafting' then raise exception 'Somente o anfitrião pode iniciar esta sala.'; end if;
  if exists(select 1 from public.multiplayer_players where room_id=p_room_id and team is null) then raise exception 'Todos os participantes conectados precisam concluir o elenco.'; end if;
  match_count := jsonb_array_length(p_matches);
  if match_count<>target.bracket_size/2 then raise exception 'A chave recebida não corresponde ao tamanho da sala.'; end if;
  insert into public.multiplayer_matches(id,room_id,round,match_index,home_team,away_team,home_participant_id,away_participant_id,controller_user_id,seed,status,result,progress,home_cpu,away_cpu,home_ready,away_ready)
  select id,room_id,round,match_index,home_team,away_team,home_participant_id,away_participant_id,controller_user_id,seed,status,result,progress,home_cpu,away_cpu,false,false
  from jsonb_to_recordset(p_matches) as x(id uuid,room_id uuid,round text,match_index smallint,home_team jsonb,away_team jsonb,home_participant_id uuid,away_participant_id uuid,controller_user_id uuid,seed bigint,status text,result jsonb,progress jsonb,home_cpu boolean,away_cpu boolean);
  update public.multiplayer_rooms set status='playing',bracket=p_bracket,current_round=(p_matches->0->>'round') where id=p_room_id;
  update public.multiplayer_players set status='playing' where room_id=p_room_id;
end;
$$;

create or replace function public.claim_multiplayer_match_result(p_match_id uuid,p_result jsonb,p_progress jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare target public.multiplayer_matches; winner text;
begin
  select * into target from public.multiplayer_matches where id=p_match_id for update;
  if target.id is null or not public.is_multiplayer_room_member(target.room_id) then raise exception 'Partida não encontrada.'; end if;
  if target.result is not null then return; end if;
  winner := p_result->>'winnerId';
  if winner not in (target.home_team->>'id',target.away_team->>'id') then raise exception 'Resultado inválido.'; end if;
  update public.multiplayer_matches set result=p_result,progress=p_progress,
    status=case when home_cpu and away_cpu then 'finished' else status end,
    official_minute=case when home_cpu and away_cpu then case when coalesce((p_result->>'wentToExtraTime')::boolean,false) then 122 else 90 end else official_minute end,
    phase_started_at=case when home_cpu and away_cpu then null else phase_started_at end
  where id=p_match_id;
  if target.home_cpu and target.away_cpu then
    insert into public.multiplayer_logs(room_id,match_id,event) values(target.room_id,p_match_id,'match_finished');
  end if;
end;
$$;

create or replace function public.ready_multiplayer_match(p_match_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare target public.multiplayer_matches; player_id uuid; can_start boolean;
begin
  select * into target from public.multiplayer_matches where id=p_match_id for update;
  select id into player_id from public.multiplayer_players where room_id=target.room_id and user_id=(select auth.uid());
  if player_id is null or player_id not in (target.home_participant_id,target.away_participant_id) then raise exception 'Você não participa desta partida.'; end if;
  if target.result is null then raise exception 'A partida ainda está sendo preparada.'; end if;
  update public.multiplayer_matches set
    home_ready=home_ready or coalesce(home_participant_id=player_id,false),
    away_ready=away_ready or coalesce(away_participant_id=player_id,false),status='ready'
  where id=p_match_id and status in ('waiting','ready');
  select * into target from public.multiplayer_matches where id=p_match_id;
  can_start := (target.home_participant_id is null or target.home_cpu or target.home_ready)
    and (target.away_participant_id is null or target.away_cpu or target.away_ready);
  if can_start then
    update public.multiplayer_matches set status='playing',official_minute=0,phase_base_minute=0,phase_started_at=now(),decision_deadline=null where id=p_match_id;
    insert into public.multiplayer_logs(room_id,match_id,event) values(target.room_id,p_match_id,'match_started');
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

create or replace function public.update_multiplayer_match_result(p_match_id uuid,p_result jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare target public.multiplayer_matches;
begin
  select * into target from public.multiplayer_matches where id=p_match_id for update;
  if target.id is null or not public.is_multiplayer_room_member(target.room_id) then raise exception 'Partida não encontrada.'; end if;
  if (p_result->>'winnerId') not in (target.home_team->>'id',target.away_team->>'id') then raise exception 'Resultado inválido.'; end if;
  update public.multiplayer_matches set result=p_result where id=p_match_id;
end;
$$;

create or replace function public.sync_multiplayer_match(p_match_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare target public.multiplayer_matches; calculated int; max_minute int; elapsed_ms bigint; kicks int; expected int; received int;
begin
  select m.* into target from public.multiplayer_matches m where m.id=p_match_id and public.is_multiplayer_room_member(m.room_id) for update;
  if target.id is null then raise exception 'Partida não encontrada.'; end if;
  update public.multiplayer_matches m set
    home_cpu=m.home_cpu or exists(select 1 from public.multiplayer_players p where p.id=m.home_participant_id and not p.connected and p.left_at<=now()-interval '15 seconds'),
    away_cpu=m.away_cpu or exists(select 1 from public.multiplayer_players p where p.id=m.away_participant_id and not p.connected and p.left_at<=now()-interval '15 seconds')
  where m.id=p_match_id;
  select * into target from public.multiplayer_matches where id=p_match_id;
  if target.result is null then return; end if;
  if target.status in ('waiting','ready') and (target.home_cpu or target.home_ready or target.home_participant_id is null) and (target.away_cpu or target.away_ready or target.away_participant_id is null) then
    update public.multiplayer_matches set status='playing',official_minute=0,phase_base_minute=0,phase_started_at=now() where id=p_match_id;
    insert into public.multiplayer_logs(room_id,match_id,event) values(target.room_id,p_match_id,'match_started');
    return;
  end if;
  max_minute := case when coalesce((target.result->>'wentToExtraTime')::boolean,false) then 122 else 90 end;
  if target.status='playing' then
    calculated := least(max_minute,target.phase_base_minute+floor(extract(epoch from (now()-target.phase_started_at))*1000/165)::int);
    if calculated>=45 and target.phase_base_minute<45 then
      update public.multiplayer_matches set status='halftime',official_minute=45,decision_deadline=now()+interval '15 seconds' where id=p_match_id;
    elsif calculated>=65 and target.phase_base_minute<65 then
      update public.multiplayer_matches set status='moment',official_minute=65,decision_deadline=now()+interval '10 seconds' where id=p_match_id;
    elsif calculated>=max_minute and coalesce((target.result->>'wentToPenalties')::boolean,false) then
      update public.multiplayer_matches set status='shootout',official_minute=max_minute,phase_started_at=now(),shootout_step=0,shootout_revealed=false where id=p_match_id;
    elsif calculated>=max_minute then
      update public.multiplayer_matches set status='finished',official_minute=max_minute,phase_started_at=null where id=p_match_id;
      insert into public.multiplayer_logs(room_id,match_id,event) values(target.room_id,p_match_id,'match_finished');
    else update public.multiplayer_matches set official_minute=calculated where id=p_match_id;
    end if;
  elsif target.status in ('halftime','moment') then
    expected := (case when target.home_participant_id is not null and not target.home_cpu then 1 else 0 end)
      +(case when target.away_participant_id is not null and not target.away_cpu then 1 else 0 end);
    select count(*) into received from public.multiplayer_decisions d join public.multiplayer_players p on p.user_id=d.user_id
    where d.match_id=p_match_id and p.id in (target.home_participant_id,target.away_participant_id)
      and ((target.status='halftime' and d.instructions?'halftime') or (target.status='moment' and d.instructions?'moment'));
    if received>=expected or target.decision_deadline<=now() then
      update public.multiplayer_matches set status='playing',phase_base_minute=official_minute,phase_started_at=now(),decision_deadline=null where id=p_match_id;
      if received<expected then insert into public.multiplayer_logs(room_id,match_id,event,details) values(target.room_id,p_match_id,'timer_expired',jsonb_build_object('minute',target.official_minute)); end if;
      insert into public.multiplayer_logs(room_id,match_id,event) values(target.room_id,p_match_id,'match_resumed');
    end if;
  elsif target.status='shootout' then
    kicks := coalesce(jsonb_array_length(target.result->'penaltyKicks'),0);
    elapsed_ms := floor(extract(epoch from (now()-target.phase_started_at))*1000)::bigint;
    if elapsed_ms>=kicks*2000+2200 then
      update public.multiplayer_matches set status='finished',shootout_step=kicks,shootout_revealed=true,phase_started_at=null where id=p_match_id;
      insert into public.multiplayer_logs(room_id,match_id,event) values(target.room_id,p_match_id,'match_finished');
    else
      update public.multiplayer_matches set shootout_step=least(kicks,floor(elapsed_ms/2000)::int),shootout_revealed=(elapsed_ms%2000)>=1250 where id=p_match_id;
    end if;
  end if;
end;
$$;

create or replace function public.advance_multiplayer_room(p_room_id uuid,p_round text,p_bracket jsonb,p_matches jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_multiplayer_room_member(p_room_id) or not exists(select 1 from public.multiplayer_rooms where id=p_room_id and status='playing') then raise exception 'A sala não pode avançar agora.'; end if;
  if p_round not in ('quarterfinal','semifinal','final') then raise exception 'Fase inválida.'; end if;
  if exists(select 1 from public.multiplayer_matches where room_id=p_room_id and round=(select current_round from public.multiplayer_rooms where id=p_room_id) and status<>'finished') then raise exception 'A fase atual ainda tem partidas em aberto.'; end if;
  if exists(select 1 from public.multiplayer_matches where room_id=p_room_id and round=p_round) then return; end if;
  insert into public.multiplayer_matches(id,room_id,round,match_index,home_team,away_team,home_participant_id,away_participant_id,controller_user_id,seed,status,result,progress,home_cpu,away_cpu)
  select id,room_id,round,match_index,home_team,away_team,home_participant_id,away_participant_id,controller_user_id,seed,status,result,progress,home_cpu,away_cpu
  from jsonb_to_recordset(p_matches) as x(id uuid,room_id uuid,round text,match_index smallint,home_team jsonb,away_team jsonb,home_participant_id uuid,away_participant_id uuid,controller_user_id uuid,seed bigint,status text,result jsonb,progress jsonb,home_cpu boolean,away_cpu boolean);
  update public.multiplayer_rooms set current_round=p_round,bracket=p_bracket where id=p_room_id;
end;
$$;

create or replace function public.complete_multiplayer_room(p_room_id uuid,p_bracket jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_multiplayer_room_member(p_room_id) then raise exception 'Acesso negado.'; end if;
  if not exists(select 1 from public.multiplayer_matches where room_id=p_room_id and round='final' and status='finished') then raise exception 'A final ainda não terminou.'; end if;
  update public.multiplayer_rooms set status='finished',bracket=p_bracket where id=p_room_id and status='playing';
end;
$$;

revoke all on function public.create_multiplayer_room(text,text,boolean,text) from public,anon;
revoke all on function public.get_multiplayer_room_preview(text) from public,anon;
revoke all on function public.list_open_multiplayer_rooms(text) from public,anon;
revoke all on function public.join_multiplayer_room(text,text,text) from public,anon;
revoke all on function public.join_random_multiplayer_room(text,text) from public,anon;
revoke all on function public.configure_multiplayer_room(uuid,text,smallint) from public,anon;
revoke all on function public.begin_multiplayer_draft(uuid,jsonb) from public,anon;
revoke all on function public.start_multiplayer_player_draft(uuid,jsonb,timestamptz,boolean) from public,anon;
revoke all on function public.save_multiplayer_draft_pick(uuid,jsonb,jsonb,text,smallint,smallint,smallint,smallint,timestamptz,text[],boolean) from public,anon;
revoke all on function public.relocate_multiplayer_draft_lineup(uuid,jsonb,jsonb) from public,anon;
revoke all on function public.finalize_multiplayer_draft(uuid,jsonb,jsonb) from public,anon;
revoke all on function public.start_multiplayer_room(uuid,jsonb,jsonb) from public,anon;
revoke all on function public.claim_multiplayer_match_result(uuid,jsonb,jsonb) from public,anon;
revoke all on function public.ready_multiplayer_match(uuid) from public,anon;
revoke all on function public.submit_multiplayer_decision(uuid,jsonb) from public,anon;
revoke all on function public.update_multiplayer_match_result(uuid,jsonb) from public,anon;
revoke all on function public.sync_multiplayer_match(uuid) from public,anon;
revoke all on function public.advance_multiplayer_room(uuid,text,jsonb,jsonb) from public,anon;
revoke all on function public.complete_multiplayer_room(uuid,jsonb) from public,anon;

grant execute on function public.create_multiplayer_room(text,text,boolean,text) to authenticated;
grant execute on function public.get_multiplayer_room_preview(text) to authenticated;
grant execute on function public.list_open_multiplayer_rooms(text) to authenticated;
grant execute on function public.join_multiplayer_room(text,text,text) to authenticated;
grant execute on function public.join_random_multiplayer_room(text,text) to authenticated;
grant execute on function public.configure_multiplayer_room(uuid,text,smallint) to authenticated;
grant execute on function public.begin_multiplayer_draft(uuid,jsonb) to authenticated;
grant execute on function public.start_multiplayer_player_draft(uuid,jsonb,timestamptz,boolean) to authenticated;
grant execute on function public.save_multiplayer_draft_pick(uuid,jsonb,jsonb,text,smallint,smallint,smallint,smallint,timestamptz,text[],boolean) to authenticated;
grant execute on function public.relocate_multiplayer_draft_lineup(uuid,jsonb,jsonb) to authenticated;
grant execute on function public.finalize_multiplayer_draft(uuid,jsonb,jsonb) to authenticated;
grant execute on function public.start_multiplayer_room(uuid,jsonb,jsonb) to authenticated;
grant execute on function public.claim_multiplayer_match_result(uuid,jsonb,jsonb) to authenticated;
grant execute on function public.ready_multiplayer_match(uuid) to authenticated;
grant execute on function public.submit_multiplayer_decision(uuid,jsonb) to authenticated;
grant execute on function public.update_multiplayer_match_result(uuid,jsonb) to authenticated;
grant execute on function public.sync_multiplayer_match(uuid) to authenticated;
grant execute on function public.advance_multiplayer_room(uuid,text,jsonb,jsonb) to authenticated;
grant execute on function public.complete_multiplayer_room(uuid,jsonb) to authenticated;

commit;
