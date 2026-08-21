create extension if not exists pgcrypto;

create table if not exists public.multiplayer_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z2-9]{8}$'),
  host_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'waiting' check (status in ('waiting','drafting','playing','finished')),
  ratings_mode text not null check (ratings_mode in ('visible','memory')),
  current_round text not null default 'round16' check (current_round in ('round16','quarterfinal','semifinal','final')),
  bracket jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.multiplayer_players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.multiplayer_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 2 and 24),
  slot_index smallint not null check (slot_index between 0 and 15),
  status text not null default 'waiting' check (status in ('waiting','drafting','ready','playing','eliminated','qualified')),
  campaign jsonb,
  team jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(room_id, user_id),
  unique(room_id, slot_index)
);

create table if not exists public.multiplayer_matches (
  id uuid primary key,
  room_id uuid not null references public.multiplayer_rooms(id) on delete cascade,
  round text not null check (round in ('round16','quarterfinal','semifinal','final')),
  match_index smallint not null,
  home_team jsonb not null,
  away_team jsonb not null,
  home_participant_id uuid references public.multiplayer_players(id) on delete set null,
  away_participant_id uuid references public.multiplayer_players(id) on delete set null,
  controller_user_id uuid not null references auth.users(id) on delete cascade,
  seed bigint not null,
  status text not null default 'waiting' check (status in ('waiting','playing','finished')),
  result jsonb,
  progress jsonb,
  updated_at timestamptz not null default now(),
  unique(room_id, round, match_index)
);

create table if not exists public.multiplayer_decisions (
  match_id uuid not null references public.multiplayer_matches(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  instructions jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key(match_id, user_id)
);

create or replace function public.multiplayer_touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists multiplayer_rooms_touch on public.multiplayer_rooms;
create trigger multiplayer_rooms_touch before update on public.multiplayer_rooms for each row execute function public.multiplayer_touch_updated_at();
drop trigger if exists multiplayer_players_touch on public.multiplayer_players;
create trigger multiplayer_players_touch before update on public.multiplayer_players for each row execute function public.multiplayer_touch_updated_at();
drop trigger if exists multiplayer_matches_touch on public.multiplayer_matches;
create trigger multiplayer_matches_touch before update on public.multiplayer_matches for each row execute function public.multiplayer_touch_updated_at();
drop trigger if exists multiplayer_decisions_touch on public.multiplayer_decisions;
create trigger multiplayer_decisions_touch before update on public.multiplayer_decisions for each row execute function public.multiplayer_touch_updated_at();

create or replace function public.multiplayer_code()
returns text language plpgsql volatile as $$
declare alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; generated text := '';
begin
  for position in 1..8 loop
    generated := generated || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  end loop;
  return generated;
end;
$$;

create or replace function public.create_multiplayer_room(p_nickname text, p_ratings_mode text)
returns text language plpgsql security definer set search_path = public as $$
declare new_code text; new_room_id uuid; attempts int := 0;
begin
  if auth.uid() is null then raise exception 'Sessão anônima necessária.'; end if;
  if char_length(trim(p_nickname)) not between 2 and 24 then raise exception 'Use um apelido entre 2 e 24 caracteres.'; end if;
  if p_ratings_mode not in ('visible','memory') then raise exception 'Configuração de overall inválida.'; end if;
  loop
    attempts := attempts + 1;
    new_code := public.multiplayer_code();
    begin
      insert into public.multiplayer_rooms(code, host_user_id, ratings_mode) values (new_code, auth.uid(), p_ratings_mode) returning id into new_room_id;
      exit;
    exception when unique_violation then
      if attempts >= 5 then raise exception 'Não foi possível gerar o código da sala.'; end if;
    end;
  end loop;
  insert into public.multiplayer_players(room_id, user_id, nickname, slot_index) values (new_room_id, auth.uid(), trim(p_nickname), 0);
  return new_code;
end;
$$;

create or replace function public.join_multiplayer_room(p_code text, p_nickname text)
returns uuid language plpgsql security definer set search_path = public as $$
declare target public.multiplayer_rooms; next_slot int; player_id uuid;
begin
  if auth.uid() is null then raise exception 'Sessão anônima necessária.'; end if;
  if char_length(trim(p_nickname)) not between 2 and 24 then raise exception 'Use um apelido entre 2 e 24 caracteres.'; end if;
  select * into target from public.multiplayer_rooms where code = upper(trim(p_code)) for update;
  if target.id is null then raise exception 'Sala não encontrada.'; end if;
  if target.status <> 'waiting' then raise exception 'A sala já começou.'; end if;
  select id into player_id from public.multiplayer_players where room_id = target.id and user_id = auth.uid();
  if player_id is not null then return player_id; end if;
  select min(candidate) into next_slot from generate_series(0,15) candidate where not exists (select 1 from public.multiplayer_players p where p.room_id = target.id and p.slot_index = candidate);
  if next_slot is null then raise exception 'A sala está cheia.'; end if;
  insert into public.multiplayer_players(room_id,user_id,nickname,slot_index) values(target.id,auth.uid(),trim(p_nickname),next_slot) returning id into player_id;
  return player_id;
end;
$$;

create or replace function public.start_multiplayer_room(p_room_id uuid, p_bracket jsonb, p_matches jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists(select 1 from public.multiplayer_rooms where id=p_room_id and host_user_id=auth.uid() and status in ('waiting','drafting')) then
    raise exception 'Somente o anfitrião pode iniciar esta sala.';
  end if;
  if exists(select 1 from public.multiplayer_players where room_id=p_room_id and team is null) then
    raise exception 'Todos os participantes precisam concluir o elenco.';
  end if;
  insert into public.multiplayer_matches(id,room_id,round,match_index,home_team,away_team,home_participant_id,away_participant_id,controller_user_id,seed,status,result,progress)
  select id,room_id,round,match_index,home_team,away_team,home_participant_id,away_participant_id,controller_user_id,seed,status,result,progress
  from jsonb_to_recordset(p_matches) as x(id uuid,room_id uuid,round text,match_index smallint,home_team jsonb,away_team jsonb,home_participant_id uuid,away_participant_id uuid,controller_user_id uuid,seed bigint,status text,result jsonb,progress jsonb);
  update public.multiplayer_rooms set status='playing', bracket=p_bracket where id=p_room_id;
  update public.multiplayer_players set status='playing' where room_id=p_room_id;
end;
$$;

create or replace function public.advance_multiplayer_room(p_room_id uuid, p_round text, p_bracket jsonb, p_matches jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists(select 1 from public.multiplayer_rooms where id=p_room_id and host_user_id=auth.uid() and status='playing') then
    raise exception 'Somente o anfitrião pode avançar a chave.';
  end if;
  if p_round not in ('quarterfinal','semifinal','final') then raise exception 'Fase inválida.'; end if;
  if exists(select 1 from public.multiplayer_matches where room_id=p_room_id and round=(select current_round from public.multiplayer_rooms where id=p_room_id) and result is null) then
    raise exception 'A fase atual ainda tem partidas em aberto.';
  end if;
  insert into public.multiplayer_matches(id,room_id,round,match_index,home_team,away_team,home_participant_id,away_participant_id,controller_user_id,seed,status,result,progress)
  select id,room_id,round,match_index,home_team,away_team,home_participant_id,away_participant_id,controller_user_id,seed,status,result,progress
  from jsonb_to_recordset(p_matches) as x(id uuid,room_id uuid,round text,match_index smallint,home_team jsonb,away_team jsonb,home_participant_id uuid,away_participant_id uuid,controller_user_id uuid,seed bigint,status text,result jsonb,progress jsonb);
  update public.multiplayer_rooms set current_round=p_round, bracket=p_bracket where id=p_room_id;
end;
$$;

create or replace function public.is_multiplayer_room_member(p_room_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.multiplayer_players where room_id=p_room_id and user_id=auth.uid());
$$;

alter table public.multiplayer_rooms enable row level security;
alter table public.multiplayer_players enable row level security;
alter table public.multiplayer_matches enable row level security;
alter table public.multiplayer_decisions enable row level security;

create policy "room members read rooms" on public.multiplayer_rooms for select to authenticated using (
  public.is_multiplayer_room_member(id)
);
create policy "host updates room" on public.multiplayer_rooms for update to authenticated using (host_user_id=auth.uid()) with check (host_user_id=auth.uid());
create policy "room members read players" on public.multiplayer_players for select to authenticated using (
  public.is_multiplayer_room_member(room_id)
);
create policy "player updates self" on public.multiplayer_players for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy "room members read matches" on public.multiplayer_matches for select to authenticated using (
  public.is_multiplayer_room_member(room_id)
);
create policy "controller updates match" on public.multiplayer_matches for update to authenticated using (controller_user_id=auth.uid()) with check (controller_user_id=auth.uid());
create policy "participants read decisions" on public.multiplayer_decisions for select to authenticated using (
  exists(select 1 from public.multiplayer_matches m join public.multiplayer_players me on me.room_id=m.room_id where m.id=match_id and me.user_id=auth.uid())
);
create policy "player writes own decision" on public.multiplayer_decisions for insert to authenticated with check (
  user_id=auth.uid() and exists(select 1 from public.multiplayer_matches m join public.multiplayer_players p on p.id in (m.home_participant_id,m.away_participant_id) where m.id=match_id and p.user_id=auth.uid())
);
create policy "player updates own decision" on public.multiplayer_decisions for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());

revoke all on function public.multiplayer_touch_updated_at() from public, anon;
revoke all on function public.multiplayer_code() from public, anon;
revoke all on function public.create_multiplayer_room(text,text) from public, anon;
revoke all on function public.join_multiplayer_room(text,text) from public, anon;
revoke all on function public.start_multiplayer_room(uuid,jsonb,jsonb) from public, anon;
revoke all on function public.advance_multiplayer_room(uuid,text,jsonb,jsonb) from public, anon;
revoke all on function public.is_multiplayer_room_member(uuid) from public, anon;

grant execute on function public.create_multiplayer_room(text,text) to authenticated;
grant execute on function public.join_multiplayer_room(text,text) to authenticated;
grant execute on function public.start_multiplayer_room(uuid,jsonb,jsonb) to authenticated;
grant execute on function public.advance_multiplayer_room(uuid,text,jsonb,jsonb) to authenticated;
grant execute on function public.is_multiplayer_room_member(uuid) to authenticated;
grant select, update on public.multiplayer_rooms to authenticated;
grant select, update on public.multiplayer_players to authenticated;
grant select, update on public.multiplayer_matches to authenticated;
grant select, insert, update on public.multiplayer_decisions to authenticated;

alter publication supabase_realtime add table public.multiplayer_rooms;
alter publication supabase_realtime add table public.multiplayer_players;
alter publication supabase_realtime add table public.multiplayer_matches;
alter publication supabase_realtime add table public.multiplayer_decisions;
