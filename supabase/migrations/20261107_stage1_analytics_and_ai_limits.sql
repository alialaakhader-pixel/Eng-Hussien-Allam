-- Stage 1: server-side learning analytics (watch time, attendance) + AI tutor rate limiting.
-- All new tables have RLS enabled with a teacher-only policy; students reach their own rows only
-- through SECURITY DEFINER RPCs that call ha_resolve (code + device / account JWT).

create table if not exists public.ha_lecture_progress (
  code text not null,
  lesson_id text not null,
  watched_seconds int not null default 0 check (watched_seconds >= 0),
  duration_seconds int not null default 0 check (duration_seconds >= 0),
  last_position int not null default 0 check (last_position >= 0),
  completed boolean not null default false,
  last_heartbeat timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (code, lesson_id)
);

create table if not exists public.ha_watch_daily (
  code text not null,
  day date not null,
  seconds int not null default 0 check (seconds >= 0),
  primary key (code, day)
);

create table if not exists public.ha_attendance (
  code text not null,
  day date not null,
  first_seen timestamptz not null default now(),
  primary key (code, day)
);

create table if not exists public.ha_ai_calls (
  id bigserial primary key,
  code text not null,
  at timestamptz not null default now()
);
create index if not exists ha_ai_calls_code_at on public.ha_ai_calls (code, at desc);

alter table public.ha_lecture_progress enable row level security;
alter table public.ha_watch_daily enable row level security;
alter table public.ha_attendance enable row level security;
alter table public.ha_ai_calls enable row level security;

do $$
declare t text;
begin
  foreach t in array array['ha_lecture_progress','ha_watch_daily','ha_attendance','ha_ai_calls'] loop
    execute format('drop policy if exists teacher_all on public.%I', t);
    execute format('create policy teacher_all on public.%I for all to authenticated using (public.ha_is_teacher()) with check (public.ha_is_teacher())', t);
  end loop;
end $$;

-- Heartbeat: credit is capped by real elapsed time since the previous heartbeat for this
-- (student, lesson), so a second tab, a replayed request or a forged delta cannot inflate watch time.
create or replace function public.ha_watch_heartbeat(
  p_code text, p_device text, p_lesson text, p_delta numeric, p_position numeric, p_duration numeric)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  c public.ha_codes; r public.ha_lecture_progress;
  elapsed numeric; credit int; dur int; watched int; done boolean; pos int;
  today date := (now() at time zone 'Africa/Cairo')::date;
begin
  c := public.ha_resolve(p_code, p_device);
  if c.code is null then return jsonb_build_object('ok', false, 'error', 'UNAUTHORIZED'); end if;
  if coalesce(p_lesson, '') = '' or length(p_lesson) > 80 then
    return jsonb_build_object('ok', false, 'error', 'INVALID');
  end if;

  insert into public.ha_lecture_progress (code, lesson_id, last_heartbeat)
    values (c.code, p_lesson, now() - interval '20 seconds')
    on conflict (code, lesson_id) do nothing;
  select * into r from public.ha_lecture_progress
    where code = c.code and lesson_id = p_lesson for update;

  elapsed := greatest(0, extract(epoch from (now() - r.last_heartbeat)));
  -- at most 2x playback speed, +2s slack, and never more than 30s per heartbeat
  credit := floor(greatest(0, least(coalesce(p_delta, 0), elapsed * 2 + 2, 30)))::int;

  dur := case when coalesce(p_duration, 0) > 0 then least(p_duration, 86400)::int else r.duration_seconds end;
  watched := r.watched_seconds + credit;
  if dur > 0 then watched := least(watched, dur); end if;
  done := r.completed or (dur > 0 and watched >= dur * 0.9);
  pos := greatest(0, least(coalesce(p_position, 0), case when dur > 0 then dur else 86400 end))::int;

  update public.ha_lecture_progress
     set watched_seconds = watched, duration_seconds = dur, last_position = pos,
         completed = done, last_heartbeat = now(), updated_at = now()
   where code = c.code and lesson_id = p_lesson;

  if credit > 0 then
    insert into public.ha_watch_daily (code, day, seconds) values (c.code, today, credit)
      on conflict (code, day) do update set seconds = public.ha_watch_daily.seconds + excluded.seconds;
  end if;

  return jsonb_build_object('ok', true, 'watchedSeconds', watched, 'durationSeconds', dur,
                            'lastPosition', pos, 'completed', done, 'credited', credit);
end $$;

-- Attendance = a real, authenticated sign-in on a Cairo calendar day. Never inferred from watching.
create or replace function public.ha_mark_attendance(p_code text, p_device text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare c public.ha_codes; n int;
begin
  c := public.ha_resolve(p_code, p_device);
  if c.code is null then return jsonb_build_object('ok', false, 'error', 'UNAUTHORIZED'); end if;
  insert into public.ha_attendance (code, day) values (c.code, (now() at time zone 'Africa/Cairo')::date)
    on conflict do nothing;
  select count(*) into n from public.ha_attendance where code = c.code;
  return jsonb_build_object('ok', true, 'days', n);
end $$;

create or replace function public.ha_my_progress(p_code text, p_device text)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare c public.ha_codes;
begin
  c := public.ha_resolve(p_code, p_device);
  if c.code is null then return jsonb_build_object('ok', false, 'error', 'UNAUTHORIZED'); end if;
  return jsonb_build_object(
    'ok', true,
    'lectures', coalesce((select jsonb_agg(jsonb_build_object(
        'lessonId', lesson_id, 'watchedSeconds', watched_seconds, 'durationSeconds', duration_seconds,
        'lastPosition', last_position, 'completed', completed, 'updatedAt', updated_at)
        order by updated_at desc)
      from public.ha_lecture_progress where code = c.code), '[]'::jsonb),
    'daily', coalesce((select jsonb_agg(jsonb_build_object('day', day, 'seconds', seconds) order by day)
      from public.ha_watch_daily where code = c.code and day >= (now() at time zone 'Africa/Cairo')::date - 60), '[]'::jsonb),
    'attendance', coalesce((select jsonb_agg(day order by day)
      from public.ha_attendance where code = c.code), '[]'::jsonb)
  );
end $$;

-- Teacher-only roll-up used by analytics / alerts.
create or replace function public.ha_teacher_analytics()
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.ha_is_teacher() then raise exception 'FORBIDDEN'; end if;
  return coalesce((
    select jsonb_agg(row_to_json(x) order by x.last_activity desc nulls last) from (
      select c.code,
             coalesce(a.name, c.student_name, c.code) as name,
             c.grade,
             (select count(*) from public.ha_attendance t where t.code = c.code) as attendance_days,
             (select max(day) from public.ha_attendance t where t.code = c.code) as last_attendance,
             (select coalesce(sum(seconds), 0) from public.ha_watch_daily d where d.code = c.code) as watch_seconds,
             (select coalesce(sum(seconds), 0) from public.ha_watch_daily d
               where d.code = c.code and d.day >= (now() at time zone 'Africa/Cairo')::date - 6) as watch_seconds_7d,
             (select count(*) from public.ha_lecture_progress p where p.code = c.code and p.completed) as completed_lectures,
             (select max(updated_at) from public.ha_lecture_progress p where p.code = c.code) as last_activity
      from public.ha_codes c
      left join public.ha_accounts a on a.code = c.code
      where c.used_at is not null or a.id is not null
    ) x), '[]'::jsonb);
end $$;

-- AI tutor gate: validates the student, then enforces per-minute and per-day limits server-side.
create or replace function public.ha_ai_gate(p_code text, p_device text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare c public.ha_codes; per_min int; per_day int;
begin
  c := public.ha_resolve(p_code, p_device);
  if c.code is null then return jsonb_build_object('ok', false, 'error', 'UNAUTHORIZED'); end if;
  perform pg_advisory_xact_lock(hashtext('ai:' || c.code));
  select count(*) into per_min from public.ha_ai_calls where code = c.code and at > now() - interval '1 minute';
  if per_min >= 5 then return jsonb_build_object('ok', false, 'error', 'RATE_LIMIT'); end if;
  select count(*) into per_day from public.ha_ai_calls
    where code = c.code and (at at time zone 'Africa/Cairo')::date = (now() at time zone 'Africa/Cairo')::date;
  if per_day >= 40 then return jsonb_build_object('ok', false, 'error', 'DAILY_LIMIT'); end if;
  insert into public.ha_ai_calls (code) values (c.code);
  delete from public.ha_ai_calls where at < now() - interval '30 days';
  return jsonb_build_object('ok', true, 'remainingToday', 40 - per_day - 1);
end $$;

revoke all on function public.ha_watch_heartbeat(text, text, text, numeric, numeric, numeric) from public;
revoke all on function public.ha_mark_attendance(text, text) from public;
revoke all on function public.ha_my_progress(text, text) from public;
revoke all on function public.ha_teacher_analytics() from public;
revoke all on function public.ha_ai_gate(text, text) from public;
grant execute on function public.ha_watch_heartbeat(text, text, text, numeric, numeric, numeric) to anon, authenticated;
grant execute on function public.ha_mark_attendance(text, text) to anon, authenticated;
grant execute on function public.ha_my_progress(text, text) to anon, authenticated;
grant execute on function public.ha_teacher_analytics() to authenticated;
grant execute on function public.ha_ai_gate(text, text) to anon, authenticated;
