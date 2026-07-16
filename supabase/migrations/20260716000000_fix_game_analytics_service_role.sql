-- Service-role keys bypass RLS, but still require explicit table privileges after
-- privileges have been revoked from the API roles.
grant select, insert, update on public.analytics_matches, public.analytics_variant_picks, public.analytics_variant_games, public.analytics_turns to service_role;
grant select on public.analytics_daily_summary, public.analytics_variant_summary to service_role;
