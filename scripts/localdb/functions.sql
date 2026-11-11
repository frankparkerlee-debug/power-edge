-- Who a name on a record belongs to. Older rows say "Zach" for Zach Delgado:
-- an exact name wins, then a first name that only one active person has.
create or replace function public.team_name(p_raw text)
returns text
language sql stable
set search_path = ''
as $$
  select coalesce(
    (select t.name from public.team_members t
      where lower(t.name) = lower(trim(p_raw)) order by t.active desc limit 1),
    (select min(t.name) from public.team_members t
      where t.active and lower(split_part(t.name, ' ', 1)) = lower(trim(p_raw))
      having count(*) = 1),
    nullif(trim(p_raw), ''));
$$;

-- Everything the scoreboard shows for one period, in one call. Times bucket in Central.
create or replace function public.scoreboard(p_from timestamptz, p_to timestamptz)
returns jsonb
language sql stable
set search_path = ''
as $$
with
k as (
  select kn.id, kn.rep as raw, kn.outcome, kn.created_at, kn.note, kn.target_id,
    (kn.created_at at time zone 'America/Chicago') as lt
  from public.knocks kn
  where kn.created_at >= p_from and kn.created_at < p_to and coalesce(kn.rep, '') <> ''
),
ap as (
  select a.id, a.setter, a.closer, a.created_at, a.slot_start, coalesce(a.status, '') as status, a.address
  from public.appointments a
  where (a.created_at >= p_from and a.created_at < p_to)
     or (a.slot_start >= p_from and a.slot_start < p_to)
),
ev as (
  select distinct on (e.job_id, e.kind)
    e.job_id, e.kind, e.detail, e.actor, e.created_at, j.setter, j.address, j.city,
    case when e.kind like 'agreement%' then
      nullif(replace(substring(coalesce(e.detail, '') from '[0-9][0-9,]*(?:\.[0-9]{1,2})?'), ',', ''), '')::numeric
    end as amount
  from public.job_events e
  join public.jobs j on j.id = e.job_id
  where e.created_at >= p_from and e.created_at < p_to
    and e.kind in ('inspection', 'agreement_sent', 'agreement_signed')
  -- An agreement sent twice is one agreement: keep the latest per job.
  order by e.job_id, e.kind, e.created_at desc
),
cb as (
  select kn.rep as raw, kn.follow_up_at
  from public.knocks kn
  where kn.outcome = 'come_back' and kn.follow_up_at is not null and kn.done_at is null
),
alias as (
  select r.raw, public.team_name(r.raw) as who
  from (
    select raw from k union select setter from ap union select closer from ap
    union select actor from ev union select setter from ev union select raw from cb
  ) r
  where coalesce(r.raw, '') <> ''
),
kn as (
  select a.who, k.* from k join alias a on a.raw = k.raw
),
apn as (
  select ap.*, s.who as setter_n, c.who as closer_n
  from ap left join alias s on s.raw = ap.setter left join alias c on c.raw = ap.closer
),
evn as (
  select ev.*, a.who as actor_n, s.who as setter_n
  from ev left join alias a on a.raw = ev.actor left join alias s on s.raw = ev.setter
),
-- Setter work
s_knock as (
  select who, count(*) as knocks,
    count(*) filter (where outcome in ('not_interested', 'come_back', 'appointment_set', 'already_done', 'inspected')) as talked,
    count(distinct lt::date) as days_out
  from kn group by who
),
s_hours as (
  select who, round((sum(extract(epoch from (t1 - t0))) / 3600.0)::numeric, 1) as hours
  from (select who, lt::date, min(created_at) as t0, max(created_at) as t1 from kn group by 1, 2) d
  group by who
),
s_set as (
  select setter_n as who, count(*) as sets
  from apn
  where setter_n is not null and created_at >= p_from and created_at < p_to and status not like 'cancel%'
  group by 1
),
s_from_sets as (
  select setter_n as who,
    count(*) filter (where kind = 'inspection') as held,
    count(*) filter (where kind = 'inspection' and detail like 'Damage found%') as held_damage,
    count(*) filter (where kind = 'agreement_signed') as set_signed,
    coalesce(sum(amount) filter (where kind = 'agreement_signed'), 0) as set_signed_value
  from evn where setter_n is not null group by 1
),
s_set_noshow as (
  select setter_n as who, count(*) as set_no_shows
  from apn where setter_n is not null and status = 'no_show' and slot_start >= p_from and slot_start < p_to
  group by 1
),
s_cb as (
  select a.who, count(*) as come_backs, count(*) filter (where cb.follow_up_at < now()) as come_backs_late
  from cb join alias a on a.raw = cb.raw group by 1
),
-- Closer work
s_assigned as (
  select closer_n as who,
    count(*) filter (where status not like 'cancel%') as assigned,
    count(*) filter (where status = 'no_show') as no_shows
  from apn where closer_n is not null and slot_start >= p_from and slot_start < p_to
  group by 1
),
s_close as (
  select actor_n as who,
    count(*) filter (where kind = 'inspection') as ran,
    count(*) filter (where kind = 'inspection' and detail like 'Damage found%') as damage,
    count(distinct job_id) filter (where kind in ('agreement_sent', 'agreement_signed')) as sent,
    count(*) filter (where kind = 'agreement_signed') as signed,
    coalesce(sum(amount) filter (where kind = 'agreement_signed'), 0) as signed_value
  from evn where actor_n is not null group by 1
),
active as (
  select t.name as who, t.role, t.goal_knocks_week, t.goal_sets_week, t.goal_signed_month
  from public.team_members t where t.active
),
names as (
  select who from active
  union select who from s_knock union select who from s_set union select who from s_from_sets
  union select who from s_assigned union select who from s_close union select who from s_cb
),
people as (
  select n.who, coalesce(a.role, (select t.role from public.team_members t where t.name = n.who limit 1)) as role,
    a.who is not null as active, a.goal_knocks_week, a.goal_sets_week, a.goal_signed_month
  from names n left join active a on a.who = n.who
),
reps as (
  select p.*,
    coalesce(k.knocks, 0) as knocks, coalesce(k.talked, 0) as talked, coalesce(k.days_out, 0) as days_out,
    coalesce(h.hours, 0) as hours,
    coalesce(s.sets, 0) as sets,
    coalesce(f.held, 0) as held, coalesce(f.held_damage, 0) as held_damage,
    coalesce(f.set_signed, 0) as set_signed, coalesce(f.set_signed_value, 0) as set_signed_value,
    coalesce(ns.set_no_shows, 0) as set_no_shows,
    coalesce(c.come_backs, 0) as come_backs, coalesce(c.come_backs_late, 0) as come_backs_late,
    coalesce(asg.assigned, 0) as assigned, coalesce(asg.no_shows, 0) as no_shows,
    coalesce(cl.ran, 0) as ran, coalesce(cl.damage, 0) as damage, coalesce(cl.sent, 0) as sent,
    coalesce(cl.signed, 0) as signed, coalesce(cl.signed_value, 0) as signed_value
  from people p
  left join s_knock k on k.who = p.who
  left join s_hours h on h.who = p.who
  left join s_set s on s.who = p.who
  left join s_from_sets f on f.who = p.who
  left join s_set_noshow ns on ns.who = p.who
  left join s_cb c on c.who = p.who
  left join s_assigned asg on asg.who = p.who
  left join s_close cl on cl.who = p.who
),
team as (
  select
    (select count(*) from kn) as knocks,
    (select count(*) from kn where outcome in ('not_interested', 'come_back', 'appointment_set', 'already_done', 'inspected')) as talked,
    (select count(*) from apn where created_at >= p_from and created_at < p_to and status not like 'cancel%') as sets,
    (select count(*) from apn where created_at >= p_from and created_at < p_to and status not like 'cancel%' and setter_n is null) as web_sets,
    (select count(*) from apn where slot_start >= p_from and slot_start < p_to and status = 'no_show') as no_shows,
    (select count(*) from evn where kind = 'inspection') as held,
    (select count(*) from evn where kind = 'inspection' and detail like 'Damage found%') as damage,
    (select count(distinct job_id) from evn where kind in ('agreement_sent', 'agreement_signed')) as sent,
    (select count(*) from evn where kind = 'agreement_signed') as signed,
    (select coalesce(sum(amount), 0) from evn where kind = 'agreement_signed') as signed_value
),
reasons as (
  select who,
    case outcome
      when 'do_not_knock' then 'No-soliciting sign, or asked us not to come back'
      when 'already_done' then 'Already replaced'
      else coalesce(nullif(substring(note from '^Reason: (.*)$'), ''), 'No reason given')
    end as reason,
    count(*) as n
  from kn where outcome in ('not_interested', 'do_not_knock', 'already_done')
  group by 1, 2
),
hours as (
  select who, extract(hour from lt)::int as hour, count(*) as knocks,
    count(*) filter (where outcome in ('not_interested', 'come_back', 'appointment_set', 'already_done', 'inspected')) as talked,
    count(*) filter (where outcome = 'appointment_set') as sets
  from kn group by 1, 2
),
hail as (
  select kn.who,
    case when r.radar_in >= 2.5 then 4 when r.radar_in >= 2 then 3 when r.radar_in >= 1 then 2 else 1 end as band,
    count(*) as knocks,
    count(*) filter (where kn.outcome in ('not_interested', 'come_back', 'appointment_set', 'already_done', 'inspected')) as talked,
    count(*) filter (where kn.outcome = 'appointment_set') as sets
  from kn left join public.storm_targets_radar r on r.id = kn.target_id
  group by 1, 2
),
daily as (
  select day, who, sum(knocks) as knocks, sum(sets) as sets, sum(signed) as signed, sum(signed_value) as signed_value
  from (
    select lt::date as day, who, 1 as knocks, 0 as sets, 0 as signed, 0::numeric as signed_value from kn
    union all
    select (created_at at time zone 'America/Chicago')::date, setter_n, 0, 1, 0, 0
      from apn where setter_n is not null and created_at >= p_from and created_at < p_to and status not like 'cancel%'
    union all
    select (created_at at time zone 'America/Chicago')::date, actor_n, 0, 0, 1, coalesce(amount, 0)
      from evn where kind = 'agreement_signed' and actor_n is not null
  ) x
  group by 1, 2
),
wins as (
  select * from (
    select 'signed' as kind, actor_n as who, created_at as at, amount, address, city from evn where kind = 'agreement_signed'
    union all
    select 'damage', actor_n, created_at, null, address, city from evn where kind = 'inspection' and detail like 'Damage found%'
    union all
    select 'set', setter_n, created_at, null, address, null
      from apn where setter_n is not null and created_at >= p_from and created_at < p_to and status not like 'cancel%'
  ) w
  order by at desc limit 12
)
select jsonb_build_object(
  'team', (select to_jsonb(t) from team t),
  'reps', coalesce((select jsonb_agg(to_jsonb(r)) from reps r), '[]'::jsonb),
  'reasons', coalesce((select jsonb_agg(to_jsonb(x) order by x.n desc) from reasons x), '[]'::jsonb),
  'hours', coalesce((select jsonb_agg(to_jsonb(x) order by x.hour) from hours x), '[]'::jsonb),
  'hail', coalesce((select jsonb_agg(to_jsonb(x) order by x.band desc) from hail x), '[]'::jsonb),
  'daily', coalesce((select jsonb_agg(to_jsonb(x) order by x.day) from daily x), '[]'::jsonb),
  'wins', coalesce((select jsonb_agg(to_jsonb(w) order by w.at desc) from wins w), '[]'::jsonb)
);
$$;

-- Personal records and streaks: the last 180 days, per person per day.
create or replace function public.scoreboard_days(p_days int default 180)
returns table (who text, day date, knocks bigint, sets bigint, signed_value numeric)
language sql stable
set search_path = ''
as $$
  with since as (select now() - make_interval(days => least(greatest(p_days, 1), 400)) as t),
  x as (
    select kn.rep as raw, (kn.created_at at time zone 'America/Chicago')::date as day, 1 as knocks, 0 as sets, 0::numeric as signed_value
      from public.knocks kn, since where kn.created_at >= since.t and coalesce(kn.rep, '') <> ''
    union all
    select a.setter, (a.created_at at time zone 'America/Chicago')::date, 0, 1, 0
      from public.appointments a, since
      where a.created_at >= since.t and a.setter is not null and coalesce(a.status, '') not like 'cancel%'
    union all
    select s.actor, (s.created_at at time zone 'America/Chicago')::date, 0, 0,
      coalesce(nullif(replace(substring(coalesce(s.detail, '') from '[0-9][0-9,]*(?:\.[0-9]{1,2})?'), ',', ''), '')::numeric, 0)
      from (select distinct on (e.job_id) e.* from public.job_events e, since
            where e.kind = 'agreement_signed' and e.created_at >= since.t order by e.job_id, e.created_at desc) s
  ),
  alias as (select r.raw, public.team_name(r.raw) as who from (select distinct raw from x) r)
  select a.who, x.day, sum(x.knocks)::bigint, sum(x.sets)::bigint, sum(x.signed_value)
  from x join alias a on a.raw = x.raw
  where a.who is not null
  group by 1, 2;
$$;

revoke all on function public.team_name(text) from public, anon, authenticated;
revoke all on function public.scoreboard(timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.scoreboard_days(int) from public, anon, authenticated;
grant execute on function public.team_name(text) to service_role;
grant execute on function public.scoreboard(timestamptz, timestamptz) to service_role;
grant execute on function public.scoreboard_days(int) to service_role;

comment on function public.scoreboard(timestamptz, timestamptz) is
  'Scoreboard for a period: team funnel, per person setter and closer numbers with goals, reasons for a no, knocking by hour, results by hail band, a daily series and recent wins. Central time.';
comment on function public.scoreboard_days(int) is
  'Per person per day knocks, inspections set and dollars signed, for personal bests and streaks.';

create or replace function public.scoreboard(p_from timestamptz, p_to timestamptz)
returns jsonb
language sql stable
set search_path = ''
as $$
with
k as (
  select kn.id, kn.rep as raw, kn.outcome, kn.created_at, kn.note, kn.target_id,
    (kn.created_at at time zone 'America/Chicago') as lt
  from public.knocks kn
  where kn.created_at >= p_from and kn.created_at < p_to and coalesce(kn.rep, '') <> ''
),
ap as (
  select a.id, a.setter, a.closer, a.created_at, a.slot_start, coalesce(a.status, '') as status, a.address
  from public.appointments a
  where (a.created_at >= p_from and a.created_at < p_to)
     or (a.slot_start >= p_from and a.slot_start < p_to)
),
ev as (
  select distinct on (e.job_id, e.kind)
    e.job_id, e.kind, e.detail, e.actor, e.created_at, j.setter, j.closer as jcloser, j.address, j.city,
    case when e.kind like 'agreement%' then
      nullif(replace(substring(coalesce(e.detail, '') from '[0-9][0-9,]*(?:\.[0-9]{1,2})?'), ',', ''), '')::numeric
    end as amount
  from public.job_events e
  join public.jobs j on j.id = e.job_id
  where e.created_at >= p_from and e.created_at < p_to
    and e.kind in ('inspection', 'agreement_sent', 'agreement_signed')
  -- An agreement sent twice is one agreement: keep the latest per job.
  order by e.job_id, e.kind, e.created_at desc
),
cb as (
  select kn.rep as raw, kn.follow_up_at
  from public.knocks kn
  where kn.outcome = 'come_back' and kn.follow_up_at is not null and kn.done_at is null
),
alias as (
  select r.raw, public.team_name(r.raw) as who
  from (
    select raw from k union select setter from ap union select closer from ap
    union select actor from ev union select setter from ev union select jcloser from ev union select raw from cb
  ) r
  where coalesce(r.raw, '') <> ''
),
kn as (
  select a.who, k.* from k join alias a on a.raw = k.raw
),
apn as (
  select ap.*, s.who as setter_n, c.who as closer_n
  from ap left join alias s on s.raw = ap.setter left join alias c on c.raw = ap.closer
),
evn as (
  select ev.*, a.who as actor_n, s.who as setter_n, c.who as closer_n
  from ev left join alias a on a.raw = ev.actor left join alias s on s.raw = ev.setter
  left join alias c on c.raw = ev.jcloser
),
-- Setter work
s_knock as (
  select who, count(*) as knocks,
    count(*) filter (where outcome in ('not_interested', 'come_back', 'appointment_set', 'already_done', 'inspected')) as talked,
    count(distinct lt::date) as days_out
  from kn group by who
),
s_hours as (
  select who, round((sum(extract(epoch from (t1 - t0))) / 3600.0)::numeric, 1) as hours
  from (select who, lt::date, min(created_at) as t0, max(created_at) as t1 from kn group by 1, 2) d
  group by who
),
s_set as (
  select setter_n as who, count(*) as sets
  from apn
  where setter_n is not null and created_at >= p_from and created_at < p_to and status not like 'cancel%'
  group by 1
),
s_from_sets as (
  select setter_n as who,
    count(*) filter (where kind = 'inspection') as held,
    count(*) filter (where kind = 'inspection' and detail like 'Damage found%') as held_damage,
    count(*) filter (where kind = 'agreement_signed') as set_signed,
    coalesce(sum(amount) filter (where kind = 'agreement_signed'), 0) as set_signed_value
  from evn where setter_n is not null group by 1
),
s_set_noshow as (
  select setter_n as who, count(*) as set_no_shows
  from apn where setter_n is not null and status = 'no_show' and slot_start >= p_from and slot_start < p_to
  group by 1
),
s_cb as (
  select a.who, count(*) as come_backs, count(*) filter (where cb.follow_up_at < now()) as come_backs_late
  from cb join alias a on a.raw = cb.raw group by 1
),
-- Closer work
s_assigned as (
  select closer_n as who,
    count(*) filter (where status not like 'cancel%') as assigned,
    count(*) filter (where status = 'no_show') as no_shows
  from apn where closer_n is not null and slot_start >= p_from and slot_start < p_to
  group by 1
),
s_close as (
  select actor_n as who,
    count(*) filter (where kind = 'inspection') as ran,
    count(*) filter (where kind = 'inspection' and detail like 'Damage found%') as damage,
    count(distinct job_id) filter (where kind in ('agreement_sent', 'agreement_signed')) as sent,
    count(*) filter (where kind = 'agreement_signed') as signed,
    coalesce(sum(amount) filter (where kind = 'agreement_signed'), 0) as signed_value
  from evn where actor_n is not null group by 1
),
active as (
  select t.name as who, t.role, t.goal_knocks_week, t.goal_sets_week, t.goal_signed_month, t.team_id
  from public.team_members t where t.active
),
names as (
  select who from active
  union select who from s_knock union select who from s_set union select who from s_from_sets
  union select who from s_assigned union select who from s_close union select who from s_cb
),
people as (
  select n.who, coalesce(a.role, (select t.role from public.team_members t where t.name = n.who limit 1)) as role,
    a.who is not null as active, a.goal_knocks_week, a.goal_sets_week, a.goal_signed_month, a.team_id
  from names n left join active a on a.who = n.who
),
reps as (
  select p.*,
    coalesce(k.knocks, 0) as knocks, coalesce(k.talked, 0) as talked, coalesce(k.days_out, 0) as days_out,
    coalesce(h.hours, 0) as hours,
    coalesce(s.sets, 0) as sets,
    coalesce(f.held, 0) as held, coalesce(f.held_damage, 0) as held_damage,
    coalesce(f.set_signed, 0) as set_signed, coalesce(f.set_signed_value, 0) as set_signed_value,
    coalesce(ns.set_no_shows, 0) as set_no_shows,
    coalesce(c.come_backs, 0) as come_backs, coalesce(c.come_backs_late, 0) as come_backs_late,
    coalesce(asg.assigned, 0) as assigned, coalesce(asg.no_shows, 0) as no_shows,
    coalesce(cl.ran, 0) as ran, coalesce(cl.damage, 0) as damage, coalesce(cl.sent, 0) as sent,
    coalesce(cl.signed, 0) as signed, coalesce(cl.signed_value, 0) as signed_value
  from people p
  left join s_knock k on k.who = p.who
  left join s_hours h on h.who = p.who
  left join s_set s on s.who = p.who
  left join s_from_sets f on f.who = p.who
  left join s_set_noshow ns on ns.who = p.who
  left join s_cb c on c.who = p.who
  left join s_assigned asg on asg.who = p.who
  left join s_close cl on cl.who = p.who
),
team as (
  select
    (select count(*) from kn) as knocks,
    (select count(*) from kn where outcome in ('not_interested', 'come_back', 'appointment_set', 'already_done', 'inspected')) as talked,
    (select count(*) from apn where created_at >= p_from and created_at < p_to and status not like 'cancel%') as sets,
    (select count(*) from apn where created_at >= p_from and created_at < p_to and status not like 'cancel%' and setter_n is null) as web_sets,
    (select count(*) from apn where slot_start >= p_from and slot_start < p_to and status = 'no_show') as no_shows,
    (select count(*) from evn where kind = 'inspection') as held,
    (select count(*) from evn where kind = 'inspection' and detail like 'Damage found%') as damage,
    (select count(distinct job_id) from evn where kind in ('agreement_sent', 'agreement_signed')) as sent,
    (select count(*) from evn where kind = 'agreement_signed') as signed,
    (select coalesce(sum(amount), 0) from evn where kind = 'agreement_signed') as signed_value
),
reasons as (
  select who,
    case outcome
      when 'do_not_knock' then 'No-soliciting sign, or asked us not to come back'
      when 'already_done' then 'Already replaced'
      else coalesce(nullif(substring(note from '^Reason: (.*)$'), ''), 'No reason given')
    end as reason,
    count(*) as n
  from kn where outcome in ('not_interested', 'do_not_knock', 'already_done')
  group by 1, 2
),
hours as (
  select who, extract(hour from lt)::int as hour, count(*) as knocks,
    count(*) filter (where outcome in ('not_interested', 'come_back', 'appointment_set', 'already_done', 'inspected')) as talked,
    count(*) filter (where outcome = 'appointment_set') as sets
  from kn group by 1, 2
),
hail as (
  select kn.who,
    case when r.radar_in >= 2.5 then 4 when r.radar_in >= 2 then 3 when r.radar_in >= 1 then 2 else 1 end as band,
    count(*) as knocks,
    count(*) filter (where kn.outcome in ('not_interested', 'come_back', 'appointment_set', 'already_done', 'inspected')) as talked,
    count(*) filter (where kn.outcome = 'appointment_set') as sets
  from kn left join public.storm_targets_radar r on r.id = kn.target_id
  group by 1, 2
),
daily as (
  select day, who, sum(knocks) as knocks, sum(sets) as sets, sum(signed) as signed, sum(signed_value) as signed_value
  from (
    select lt::date as day, who, 1 as knocks, 0 as sets, 0 as signed, 0::numeric as signed_value from kn
    union all
    select (created_at at time zone 'America/Chicago')::date, setter_n, 0, 1, 0, 0
      from apn where setter_n is not null and created_at >= p_from and created_at < p_to and status not like 'cancel%'
    union all
    select (created_at at time zone 'America/Chicago')::date, actor_n, 0, 0, 1, coalesce(amount, 0)
      from evn where kind = 'agreement_signed' and actor_n is not null
  ) x
  group by 1, 2
),
-- Every roof signed in the period, with what it brought in and what it made.
-- Revenue: the final amount once the office enters it, else the contract value.
-- Profit: actual costs once entered, else an estimate from the company rates
-- when the job has squares, else unknown.
st as (select * from public.scoreboard_settings where id = 1),
roof_base as (
  select e.job_id, e.created_at as signed_at, e.setter_n as setter, coalesce(e.closer_n, e.actor_n) as closer,
    j.squares, j.address, j.city, j.costs_entered_at,
    coalesce(j.final_value,
      nullif(replace(substring(coalesce(j.contract_value, '') from '[0-9][0-9,]*(?:\.[0-9]{1,2})?'), ',', ''), '')::numeric,
      e.amount, 0) as revenue,
    coalesce(j.cost_materials, 0) + coalesce(j.cost_labor, 0) + coalesce(j.cost_other, 0) + coalesce(j.cost_commission, 0) as actual_cost
  from evn e join public.jobs j on j.id = e.job_id
  where e.kind = 'agreement_signed'
),
roofs as (
  select b.job_id, b.signed_at, b.setter, b.closer, b.squares, b.address, b.city, b.revenue,
    case when b.costs_entered_at is not null then 'actual'
         when st.est_cost_per_square is not null and coalesce(b.squares, 0) > 0 then 'estimated' end as profit_kind,
    case when b.costs_entered_at is not null then b.revenue - b.actual_cost
         when st.est_cost_per_square is not null and coalesce(b.squares, 0) > 0 then
           b.revenue - b.squares * st.est_cost_per_square - coalesce(st.est_other_per_job, 0)
             - b.revenue * coalesce(st.est_commission_pct, 0) / 100 end as profit
  from roof_base b cross join st
),
wins as (
  select * from (
    select 'signed' as kind, actor_n as who, created_at as at, amount, address, city from evn where kind = 'agreement_signed'
    union all
    select 'damage', actor_n, created_at, null, address, city from evn where kind = 'inspection' and detail like 'Damage found%'
    union all
    select 'set', setter_n, created_at, null, address, null
      from apn where setter_n is not null and created_at >= p_from and created_at < p_to and status not like 'cancel%'
  ) w
  order by at desc limit 12
)
select jsonb_build_object(
  'team', (select to_jsonb(t) from team t),
  'reps', coalesce((select jsonb_agg(to_jsonb(r)) from reps r), '[]'::jsonb),
  'reasons', coalesce((select jsonb_agg(to_jsonb(x) order by x.n desc) from reasons x), '[]'::jsonb),
  'hours', coalesce((select jsonb_agg(to_jsonb(x) order by x.hour) from hours x), '[]'::jsonb),
  'hail', coalesce((select jsonb_agg(to_jsonb(x) order by x.band desc) from hail x), '[]'::jsonb),
  'daily', coalesce((select jsonb_agg(to_jsonb(x) order by x.day) from daily x), '[]'::jsonb),
  'wins', coalesce((select jsonb_agg(to_jsonb(w) order by w.at desc) from wins w), '[]'::jsonb),
  'roofs', coalesce((select jsonb_agg(to_jsonb(x) order by x.signed_at desc) from roofs x), '[]'::jsonb),
  'teams', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name) order by t.name) from public.teams t where t.active), '[]'::jsonb),
  'settings', (select jsonb_build_object('est_cost_per_square', st.est_cost_per_square, 'est_other_per_job', st.est_other_per_job, 'est_commission_pct', st.est_commission_pct) from st)
);
$$;


notify pgrst, 'reload schema';
