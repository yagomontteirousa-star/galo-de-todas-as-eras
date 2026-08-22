create or replace function public.log_multiplayer_cpu_takeover()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (not old.home_cpu and new.home_cpu) or (not old.away_cpu and new.away_cpu) then
    insert into public.multiplayer_logs(room_id,match_id,event,details)
    values(new.room_id,new.id,'cpu_takeover',jsonb_build_object(
      'home',new.home_cpu and not old.home_cpu,
      'away',new.away_cpu and not old.away_cpu
    ));
  end if;
  return new;
end;
$$;

drop trigger if exists multiplayer_cpu_takeover_log on public.multiplayer_matches;
create trigger multiplayer_cpu_takeover_log
after update of home_cpu,away_cpu on public.multiplayer_matches
for each row execute function public.log_multiplayer_cpu_takeover();

revoke all on function public.log_multiplayer_cpu_takeover() from public,anon,authenticated;
