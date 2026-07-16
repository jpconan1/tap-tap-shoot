create table if not exists public.analytics_matches (
  id uuid primary key,
  started_at timestamptz not null,
  ended_at timestamptz,
  status text not null default 'started' check (status in ('started', 'completed', 'forfeit', 'no_contest', 'aborted')),
  p1_id text not null references public.players(id) on delete cascade,
  p2_id text not null references public.players(id) on delete cascade,
  winner_slot text check (winner_slot in ('p1', 'p2')),
  p1_game_wins integer not null default 0,
  p2_game_wins integer not null default 0,
  p1_timeout_strikes integer not null default 0,
  p2_timeout_strikes integer not null default 0,
  disconnected_slot text check (disconnected_slot in ('p1', 'p2')),
  check (p1_id <> p2_id)
);

create table if not exists public.analytics_variant_picks (
  match_id uuid not null references public.analytics_matches(id) on delete cascade,
  selection_round integer not null check (selection_round in (1, 2)),
  player_slot text not null check (player_slot in ('p1', 'p2')),
  variant_id text not null,
  pick_order integer not null check (pick_order in (1, 2)),
  picked_at timestamptz not null,
  primary key (match_id, selection_round, player_slot)
);

create table if not exists public.analytics_variant_games (
  match_id uuid not null references public.analytics_matches(id) on delete cascade,
  game_number integer not null check (game_number > 0),
  selection_round integer not null check (selection_round in (1, 2)),
  variant_id text not null,
  winner_slot text not null check (winner_slot in ('p1', 'p2')),
  p1_round_wins integer not null check (p1_round_wins >= 0),
  p2_round_wins integer not null check (p2_round_wins >= 0),
  turn_count integer not null check (turn_count >= 0),
  ended_at timestamptz not null,
  primary key (match_id, game_number)
);

create table if not exists public.analytics_turns (
  match_id uuid not null references public.analytics_matches(id) on delete cascade,
  variant_game_number integer not null check (variant_game_number > 0),
  round_number integer not null check (round_number > 0),
  turn_number integer not null check (turn_number > 0),
  variant_id text not null,
  p1_move text not null,
  p2_move text not null,
  round_winner_slot text check (round_winner_slot in ('p1', 'p2')),
  recorded_at timestamptz not null,
  primary key (match_id, variant_game_number, round_number, turn_number)
);

create index if not exists analytics_matches_started_at_idx on public.analytics_matches (started_at);
create index if not exists analytics_matches_status_idx on public.analytics_matches (status);
create index if not exists analytics_variant_picks_variant_idx on public.analytics_variant_picks (variant_id);
create index if not exists analytics_variant_games_variant_idx on public.analytics_variant_games (variant_id);

alter table public.analytics_matches enable row level security;
alter table public.analytics_variant_picks enable row level security;
alter table public.analytics_variant_games enable row level security;
alter table public.analytics_turns enable row level security;

create or replace view public.analytics_daily_summary with (security_invoker = true) as
select
  date_trunc('day', started_at) as day,
  count(distinct id) as matches_started,
  count(distinct id) filter (where status = 'completed') as matches_completed,
  count(distinct id) filter (where status = 'forfeit') as matches_forfeited,
  count(distinct id) filter (where status in ('no_contest', 'aborted')) as matches_unfinished,
  count(distinct player_id) as unique_players,
  avg(extract(epoch from (ended_at - started_at))) filter (where ended_at is not null) as average_match_seconds
from public.analytics_matches
cross join lateral (values (p1_id), (p2_id)) players(player_id)
group by 1;

create or replace view public.analytics_variant_summary with (security_invoker = true) as
select
  variants.variant_id,
  coalesce(picks.pick_count, 0) as times_picked,
  coalesce(games.games_played, 0) as games_played,
  coalesce(games.sweeps, 0) as sweeps,
  games.average_turns,
  games.average_loser_round_wins
from (
  select variant_id from public.analytics_variant_picks
  union
  select variant_id from public.analytics_variant_games
) variants
left join (
  select variant_id, count(*) as pick_count
  from public.analytics_variant_picks group by variant_id
) picks using (variant_id)
left join (
  select variant_id,
    count(*) as games_played,
    count(*) filter (where least(p1_round_wins, p2_round_wins) = 0) as sweeps,
    avg(turn_count) as average_turns,
    avg(least(p1_round_wins, p2_round_wins)) as average_loser_round_wins
  from public.analytics_variant_games group by variant_id
) games using (variant_id);

revoke all on public.analytics_matches, public.analytics_variant_picks, public.analytics_variant_games, public.analytics_turns from anon, authenticated;
revoke all on public.analytics_daily_summary, public.analytics_variant_summary from anon, authenticated;

grant select, insert, update on public.analytics_matches, public.analytics_variant_picks, public.analytics_variant_games, public.analytics_turns to service_role;
grant select on public.analytics_daily_summary, public.analytics_variant_summary to service_role;
