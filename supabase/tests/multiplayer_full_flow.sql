do $$
declare
  host_user uuid;
  guest_user uuid;
  removed_user uuid;
  room_code text;
  test_room_id uuid;
  host_player uuid;
  guest_player uuid;
  removed_player uuid;
  human_match uuid := gen_random_uuid();
  cpu_match uuid := gen_random_uuid();
  schedules jsonb;
  matches jsonb;
  blocked boolean;
  current_status text;
  current_mode text;
  current_count integer;
begin
  select id into host_user from auth.users order by created_at limit 1;
  select id into guest_user from auth.users where id <> host_user order by created_at limit 1;
  select id into removed_user from auth.users where id not in (host_user, guest_user) order by created_at limit 1;
  if host_user is null or guest_user is null or removed_user is null then
    raise exception 'O teste exige três sessões anônimas existentes.';
  end if;

  perform set_config('request.jwt.claim.sub', host_user::text, true);
  room_code := public.create_multiplayer_room('Anfitrião teste', 'knockout', true, 'teste123');
  select id, ratings_mode into test_room_id, current_mode from public.multiplayer_rooms where code=room_code;
  select id into host_player from public.multiplayer_players where room_id=test_room_id and user_id=host_user;
  if room_code !~ '^[A-Z2-9]{8}$' or current_mode <> 'visible' or host_player is null then
    raise exception 'A criação da sala não preservou código, anfitrião ou overall.';
  end if;
  if not exists(select 1 from public.list_open_multiplayer_rooms('knockout') where code=room_code and password_required) then
    raise exception 'A sala pública não apareceu na lista com a indicação de senha.';
  end if;

  begin
    perform set_config('request.jwt.claim.sub', guest_user::text, true);
    blocked := false;
    begin
      perform public.join_multiplayer_room(room_code, 'Convidado teste', 'senha-errada');
    exception when others then
      blocked := position('incorreta' in sqlerrm)>0;
    end;
    if not blocked then raise exception 'A sala protegida aceitou uma senha incorreta.'; end if;
    guest_player := public.join_multiplayer_room(room_code, 'Convidado teste', 'teste123');
    perform public.set_multiplayer_presence(test_room_id, true);
    perform set_config('request.jwt.claim.sub', removed_user::text, true);
    removed_player := public.join_multiplayer_room(room_code, 'Saída teste', 'teste123');

    perform public.leave_multiplayer_room(test_room_id);
    if exists(select 1 from public.multiplayer_players where id=removed_player) then
      raise exception 'Sair antes do torneio não liberou a vaga.';
    end if;
    removed_player := public.join_multiplayer_room(room_code, 'Removido teste', 'teste123');

    perform set_config('request.jwt.claim.sub', host_user::text, true);
    perform public.set_multiplayer_presence(test_room_id, true);
    perform public.kick_multiplayer_player(test_room_id, removed_player);
    if exists(select 1 from public.multiplayer_players where id=removed_player) then
      raise exception 'A expulsão pelo anfitrião não liberou a vaga.';
    end if;
    perform public.configure_multiplayer_room(test_room_id, 'memory', 4::smallint);

    blocked := false;
    begin
      schedules := jsonb_build_object(
        host_player::text, jsonb_build_array('1927','1937','1950','1969','1971','1977','1980','1999','2013'),
        guest_player::text, jsonb_build_array('1928','1938','1952','1970','1976','1978','1981','2000','2014')
      );
      perform public.begin_multiplayer_draft(test_room_id, schedules);
    exception when others then
      blocked := position('confirmar presença' in sqlerrm) > 0;
    end;
    if not blocked then raise exception 'O draft iniciou sem todos confirmarem presença.'; end if;

    perform public.toggle_multiplayer_lobby_ready(test_room_id, true);
    perform set_config('request.jwt.claim.sub', guest_user::text, true);
    perform public.toggle_multiplayer_lobby_ready(test_room_id, true);
    blocked := false;
    begin
      perform public.begin_multiplayer_draft(test_room_id, schedules);
    exception when others then
      blocked := position('Somente o anfitrião' in sqlerrm) > 0;
    end;
    if not blocked then raise exception 'Um convidado conseguiu iniciar o draft.'; end if;

    perform set_config('request.jwt.claim.sub', host_user::text, true);
    perform public.begin_multiplayer_draft(test_room_id, schedules);
    select status, ratings_mode into current_status, current_mode from public.multiplayer_rooms where id=test_room_id;
    if current_status <> 'drafting' or current_mode <> 'memory' then
      raise exception 'O draft não iniciou ou alterou a regra de overall.';
    end if;
    if exists(
      select 1 from public.multiplayer_players
      where room_id=test_room_id and (status <> 'drafting' or array_length(draft_schedule,1) <> 9)
    ) then raise exception 'Os participantes não receberam o draft simultaneamente.'; end if;
    if exists(
      select 1
      from generate_series(1,9) round_number
      where (select draft_schedule[round_number] from public.multiplayer_players where id=host_player)
          = (select draft_schedule[round_number] from public.multiplayer_players where id=guest_player)
    ) then raise exception 'O mesmo ano foi entregue a dois humanos na mesma rodada.'; end if;

    perform public.start_multiplayer_player_draft(
      host_player,
      '{"formation":"4-3-3","tactic":"balanced","lineup":[],"bench":[]}'::jsonb,
      now()+interval '15 seconds',
      false
    );
    perform public.save_multiplayer_draft_pick(
      host_player,
      '{"formation":"4-3-3","tactic":"balanced","lineup":[{"playerId":"atleta-a"}],"bench":[]}'::jsonb,
      null,
      'drafting',
      0::smallint,0::smallint,0::smallint,1::smallint,
      now()+interval '15 seconds',
      array['atleta-a'],
      false
    );
    if not exists(select 1 from public.multiplayer_players where id=host_player and draft_round=0 and draft_pick=1) then
      raise exception 'A primeira escolha não manteve o mesmo ano para o segundo atleta.';
    end if;
    perform public.save_multiplayer_draft_pick(
      host_player,
      '{"formation":"4-3-3","tactic":"balanced","lineup":[{"playerId":"atleta-a"},{"playerId":"atleta-b"}],"bench":[]}'::jsonb,
      null,
      'drafting',
      0::smallint,1::smallint,1::smallint,0::smallint,
      now()+interval '15 seconds',
      array['atleta-a','atleta-b'],
      false
    );
    if not exists(select 1 from public.multiplayer_players where id=host_player and draft_round=1 and draft_pick=0) then
      raise exception 'A segunda escolha não avançou para o próximo ano.';
    end if;
    perform set_config('request.jwt.claim.sub', guest_user::text, true);
    blocked := false;
    begin
      perform public.save_multiplayer_draft_pick(
        host_player,
        '{"formation":"4-3-3","tactic":"balanced","lineup":[{"playerId":"atleta-a"},{"playerId":"atleta-b"},{"playerId":"atleta-c"}],"bench":[]}'::jsonb,
        null,'drafting',1::smallint,0::smallint,1::smallint,1::smallint,now()+interval '15 seconds',array['atleta-a','atleta-b','atleta-c'],false
      );
    exception when others then
      blocked := position('próprio elenco' in sqlerrm)>0;
    end;
    if not blocked then raise exception 'Um participante alterou a escolha de outro.'; end if;
    update public.multiplayer_players set draft_deadline=now()-interval '1 second' where id=host_player;
    perform public.save_multiplayer_draft_pick(
      host_player,
      '{"formation":"4-3-3","tactic":"balanced","lineup":[{"playerId":"atleta-a"},{"playerId":"atleta-b"},{"playerId":"atleta-c"}],"bench":[]}'::jsonb,
      null,'drafting',1::smallint,0::smallint,1::smallint,1::smallint,now()+interval '15 seconds',array['atleta-a','atleta-b','atleta-c'],true
    );
    perform set_config('request.jwt.claim.sub', host_user::text, true);

    update public.multiplayer_players set campaign='{}'::jsonb, team=jsonb_build_object('id','team-'||id::text), status='ready'
    where room_id=test_room_id;
    matches := jsonb_build_array(
      jsonb_build_object(
        'id',human_match,'room_id',test_room_id,'round','round16','match_index',0,
        'home_team',jsonb_build_object('id','multiplayer-'||host_player::text),
        'away_team',jsonb_build_object('id','multiplayer-'||guest_player::text),
        'home_participant_id',host_player,'away_participant_id',guest_player,
        'controller_user_id',host_user,'seed',101,'status','waiting',
        'result',jsonb_build_object('wentToExtraTime',false,'winnerId','multiplayer-'||host_player::text),
        'progress','{}'::jsonb,'home_cpu',false,'away_cpu',false
      ),
      jsonb_build_object(
        'id',cpu_match,'room_id',test_room_id,'round','round16','match_index',1,
        'home_team',jsonb_build_object('id','multiplayer-'||host_player::text),
        'away_team',jsonb_build_object('id','cpu-test'),
        'home_participant_id',host_player,'away_participant_id',null,
        'controller_user_id',host_user,'seed',102,'status','waiting',
        'result',jsonb_build_object('wentToExtraTime',false,'winnerId','multiplayer-'||host_player::text),
        'progress','{}'::jsonb,'home_cpu',false,'away_cpu',true
      )
    );

    perform set_config('request.jwt.claim.sub', guest_user::text, true);
    blocked := false;
    begin
      perform public.start_multiplayer_room(test_room_id, '{}'::jsonb, matches);
    exception when others then
      blocked := position('Somente o anfitrião' in sqlerrm) > 0;
    end;
    if not blocked then raise exception 'Um convidado conseguiu iniciar o torneio.'; end if;

    perform set_config('request.jwt.claim.sub', host_user::text, true);
    perform public.start_multiplayer_room(test_room_id, '{}'::jsonb, matches);
    if (select status from public.multiplayer_rooms where id=test_room_id) <> 'playing' then
      raise exception 'O torneio não iniciou com vagas preenchidas por CPU.';
    end if;

    perform public.ready_multiplayer_match(human_match);
    if (select status from public.multiplayer_matches where id=human_match) <> 'ready' then
      raise exception 'Humano contra humano não aguardou a confirmação do rival.';
    end if;
    perform set_config('request.jwt.claim.sub', guest_user::text, true);
    perform public.ready_multiplayer_match(human_match);
    if (select status from public.multiplayer_matches where id=human_match) <> 'playing' then
      raise exception 'Humano contra humano não iniciou após as duas confirmações.';
    end if;

    update public.multiplayer_matches set phase_started_at=now()-interval '23 seconds' where id=human_match;
    perform public.sync_multiplayer_match(human_match);
    if (select status from public.multiplayer_matches where id=human_match) <> 'halftime' then
      raise exception 'A partida não parou no intervalo.';
    end if;
    perform public.submit_multiplayer_decision(human_match, '{"halftime":"keep"}'::jsonb);
    if (select status from public.multiplayer_matches where id=human_match) <> 'halftime' then
      raise exception 'A decisão de um jogador liberou o intervalo antes do rival.';
    end if;
    perform set_config('request.jwt.claim.sub', host_user::text, true);
    perform public.submit_multiplayer_decision(human_match, '{"halftime":"press"}'::jsonb);
    if (select status from public.multiplayer_matches where id=human_match) <> 'playing' then
      raise exception 'As duas decisões não retomaram o segundo tempo.';
    end if;

    update public.multiplayer_matches set phase_started_at=now()-interval '11 seconds' where id=human_match;
    perform public.sync_multiplayer_match(human_match);
    if (select status from public.multiplayer_matches where id=human_match) <> 'moment' then
      raise exception 'A partida não parou aos 65 minutos.';
    end if;
    perform set_config('request.jwt.claim.sub', guest_user::text, true);
    perform public.set_multiplayer_presence(test_room_id, false);
    update public.multiplayer_players set left_at=now()-interval '16 seconds' where id=guest_player;
    perform set_config('request.jwt.claim.sub', host_user::text, true);
    perform public.sync_multiplayer_match(human_match);
    if not (select away_cpu from public.multiplayer_matches where id=human_match) then
      raise exception 'A desconexão durante a partida não entregou o time à CPU.';
    end if;
    perform public.submit_multiplayer_decision(human_match, '{"halftime":"press","moment":"calm"}'::jsonb);
    if (select status from public.multiplayer_matches where id=human_match) <> 'playing' then
      raise exception 'A saída do rival deixou a pausa de 65 minutos travada.';
    end if;
    update public.multiplayer_matches set phase_started_at=now()-interval '13 seconds' where id=human_match;
    perform public.sync_multiplayer_match(human_match);
    if (select status from public.multiplayer_matches where id=human_match) <> 'finished' then
      raise exception 'A partida não chegou ao resultado após a desconexão.';
    end if;

    perform public.ready_multiplayer_match(cpu_match);
    if (select status from public.multiplayer_matches where id=cpu_match) <> 'playing' then
      raise exception 'Humano contra CPU não iniciou com uma confirmação.';
    end if;
    update public.multiplayer_matches set phase_started_at=now()-interval '23 seconds' where id=cpu_match;
    perform public.sync_multiplayer_match(cpu_match);
    update public.multiplayer_matches set decision_deadline=now()-interval '1 second' where id=cpu_match;
    perform public.sync_multiplayer_match(cpu_match);
    update public.multiplayer_matches set phase_started_at=now()-interval '11 seconds' where id=cpu_match;
    perform public.sync_multiplayer_match(cpu_match);
    update public.multiplayer_matches set decision_deadline=now()-interval '1 second' where id=cpu_match;
    perform public.sync_multiplayer_match(cpu_match);
    update public.multiplayer_matches set phase_started_at=now()-interval '13 seconds' where id=cpu_match;
    perform public.sync_multiplayer_match(cpu_match);
    if (select status from public.multiplayer_matches where id=cpu_match) <> 'finished' then
      raise exception 'Humano contra CPU não concluiu após expirar as duas decisões.';
    end if;

    select count(*) into current_count from public.multiplayer_logs where room_id=test_room_id and event='match_started';
    if current_count <> 2 then raise exception 'Os inícios de partida não foram registrados.'; end if;
    select count(*) into current_count from public.multiplayer_logs where room_id=test_room_id and event='timer_expired';
    if current_count <> 2 then raise exception 'As duas expirações de decisão não foram registradas.'; end if;
    if not exists(select 1 from public.multiplayer_logs where room_id=test_room_id and event='cpu_takeover') then
      raise exception 'A troca para CPU não foi registrada.';
    end if;
    if not exists(select 1 from public.multiplayer_logs where room_id=test_room_id and event='disconnected') then
      raise exception 'A desconexão não foi registrada.';
    end if;
    if not exists(select 1 from public.multiplayer_logs where room_id=test_room_id and event='match_finished') then
      raise exception 'O encerramento das partidas não foi registrado.';
    end if;
  exception when others then
    delete from public.multiplayer_rooms where id=test_room_id;
    raise;
  end;

  delete from public.multiplayer_rooms where id=test_room_id;
end;
$$;
