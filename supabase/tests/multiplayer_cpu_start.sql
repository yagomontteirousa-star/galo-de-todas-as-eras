do $$
declare
  test_user uuid := (select id from auth.users limit 1);
  test_room uuid;
  test_player uuid;
  test_match uuid := gen_random_uuid();
  actual_status text;
begin
  if test_user is null then
    raise exception 'O teste exige ao menos uma sessão anônima existente.';
  end if;

  perform set_config('request.jwt.claim.sub', test_user::text, true);

  insert into public.multiplayer_rooms(code,host_user_id,ratings_mode)
  values ('CPUTEST2',test_user,'visible')
  returning id into test_room;

  insert into public.multiplayer_players(room_id,user_id,nickname,slot_index,status)
  values (test_room,test_user,'Teste CPU',0,'ready')
  returning id into test_player;

  insert into public.multiplayer_matches(
    id,room_id,round,match_index,home_team,away_team,
    away_participant_id,controller_user_id,seed,status,result,progress,
    home_cpu,away_cpu
  ) values (
    test_match,test_room,'round16',0,'{}'::jsonb,'{}'::jsonb,
    test_player,test_user,1,'waiting','{}'::jsonb,'{}'::jsonb,
    true,false
  );

  perform public.ready_multiplayer_match(test_match);
  select status into actual_status from public.multiplayer_matches where id=test_match;
  if actual_status <> 'playing' then
    raise exception 'Partida contra CPU permaneceu em %.',actual_status;
  end if;

  delete from public.multiplayer_rooms where id=test_room;
end;
$$;
