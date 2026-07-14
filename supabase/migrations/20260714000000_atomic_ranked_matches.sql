create table if not exists public.ranked_matches (
  id uuid primary key,
  winner_id text not null references public.players(id),
  loser_id text not null references public.players(id),
  played_at timestamptz not null
);

alter table public.ranked_matches enable row level security;

create or replace function public.record_ranked_match(
  p_match_id uuid,
  p_winner_id text,
  p_loser_id text,
  p_played_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_winner public.players%rowtype;
  v_loser public.players%rowtype;
  v_winner_rating integer;
  v_loser_rating integer;
begin
  if p_winner_id = p_loser_id then
    raise exception 'winner and loser must differ';
  end if;

  if exists (select 1 from public.ranked_matches where id = p_match_id) then
    select * into v_winner from public.players where id = p_winner_id;
    select * into v_loser from public.players where id = p_loser_id;
    return jsonb_build_object('winner', to_jsonb(v_winner), 'loser', to_jsonb(v_loser));
  end if;

  perform 1
  from public.players
  where id in (p_winner_id, p_loser_id)
  order by id
  for update;

  select * into strict v_winner from public.players where id = p_winner_id;
  select * into strict v_loser from public.players where id = p_loser_id;

  v_winner_rating := round(v_winner.rating + 32 * (1 - 1 / (1 + power(10, (v_loser.rating - v_winner.rating) / 400.0))));
  v_loser_rating := round(v_loser.rating + 32 * (0 - 1 / (1 + power(10, (v_winner.rating - v_loser.rating) / 400.0))));

  update public.players
  set rating = v_winner_rating,
      wins = wins + 1,
      last_played = p_played_at
  where id = p_winner_id
  returning * into v_winner;

  update public.players
  set rating = v_loser_rating,
      losses = losses + 1,
      last_played = p_played_at
  where id = p_loser_id
  returning * into v_loser;

  insert into public.ranked_matches (id, winner_id, loser_id, played_at)
  values (p_match_id, p_winner_id, p_loser_id, p_played_at);

  return jsonb_build_object('winner', to_jsonb(v_winner), 'loser', to_jsonb(v_loser));
end;
$$;

revoke all on function public.record_ranked_match(uuid, text, text, timestamptz) from public;
revoke all on function public.record_ranked_match(uuid, text, text, timestamptz) from anon;
revoke all on function public.record_ranked_match(uuid, text, text, timestamptz) from authenticated;
grant execute on function public.record_ranked_match(uuid, text, text, timestamptz) to service_role;
