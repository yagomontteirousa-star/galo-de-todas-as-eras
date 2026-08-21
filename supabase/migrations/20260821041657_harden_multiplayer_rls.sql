alter function public.multiplayer_touch_updated_at() set search_path = '';
alter function public.multiplayer_code() set search_path = '';

create or replace function public.is_multiplayer_room_member(p_room_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(
    select 1
    from public.multiplayer_players
    where room_id = p_room_id
      and user_id = (select auth.uid())
  );
$$;

alter policy "host updates room" on public.multiplayer_rooms
using (host_user_id = (select auth.uid()))
with check (host_user_id = (select auth.uid()));

alter policy "player updates self" on public.multiplayer_players
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

alter policy "controller updates match" on public.multiplayer_matches
using (controller_user_id = (select auth.uid()))
with check (controller_user_id = (select auth.uid()));

alter policy "participants read decisions" on public.multiplayer_decisions
using (
  exists(
    select 1
    from public.multiplayer_matches m
    join public.multiplayer_players me on me.room_id = m.room_id
    where m.id = match_id
      and me.user_id = (select auth.uid())
  )
);

alter policy "player writes own decision" on public.multiplayer_decisions
with check (
  user_id = (select auth.uid())
  and exists(
    select 1
    from public.multiplayer_matches m
    join public.multiplayer_players p on p.id in (m.home_participant_id, m.away_participant_id)
    where m.id = match_id
      and p.user_id = (select auth.uid())
  )
);

alter policy "player updates own decision" on public.multiplayer_decisions
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));
