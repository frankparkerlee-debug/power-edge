-- The app talks to the database as service_role, which bypasses RLS.
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;
insert into public.scoreboard_settings (id) values (1) on conflict (id) do nothing;
-- Every table has RLS on and no policies, as in production.
do $$ declare r record; begin
  for r in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', r.tablename);
  end loop;
end $$;
notify pgrst, 'reload schema';
