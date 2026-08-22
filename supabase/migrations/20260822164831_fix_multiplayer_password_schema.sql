create or replace function public.create_multiplayer_room(
  p_nickname text,
  p_mode text,
  p_is_public boolean,
  p_password text default null
)
returns text language plpgsql security definer set search_path = public, private, extensions as $$
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
    values(new_room_id,extensions.crypt(normalized_password,extensions.gen_salt('bf')));
  end if;
  insert into public.multiplayer_players(room_id,user_id,nickname,slot_index,connected)
  values(new_room_id,(select auth.uid()),trim(p_nickname),0,true);
  return new_code;
end;
$$;

create or replace function public.join_multiplayer_room(p_code text,p_nickname text,p_password text default null)
returns uuid language plpgsql security definer set search_path = public, private, extensions as $$
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
    if secret_hash is null or extensions.crypt(coalesce(p_password,''),secret_hash)<>secret_hash then raise exception 'Senha da sala incorreta.'; end if;
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

revoke all on function public.create_multiplayer_room(text,text,boolean,text) from public,anon;
revoke all on function public.join_multiplayer_room(text,text,text) from public,anon;
grant execute on function public.create_multiplayer_room(text,text,boolean,text) to authenticated;
grant execute on function public.join_multiplayer_room(text,text,text) to authenticated;
