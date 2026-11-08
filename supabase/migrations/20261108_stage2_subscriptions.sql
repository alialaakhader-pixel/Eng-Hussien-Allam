-- Stage 2 / System 1: subscriptions & plans. Server-side enforcement; no online payment (activation codes / teacher grants only).
-- Content not listed in any plan stays free exactly as before. Content listed in a plan requires an active subscription to a plan that lists it.

create table if not exists public.ha_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 80),
  price numeric(10,2) not null default 0 check (price >= 0),
  duration_days int not null check (duration_days between 1 and 1100),
  grade text,
  lesson_ids text[] not null default '{}',
  exam_ids text[] not null default '{}',
  includes_ai boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ha_subscriptions (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  plan_id uuid not null references public.ha_plans(id) on delete restrict,
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  status text not null default 'active' check (status in ('active','paused','cancelled')),
  source text not null default 'teacher' check (source in ('teacher','activation_code')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index if not exists ha_subscriptions_code on public.ha_subscriptions (code, ends_at desc);

create table if not exists public.ha_activation_codes (
  code text primary key,
  plan_id uuid not null references public.ha_plans(id) on delete cascade,
  active boolean not null default true,
  expires_at timestamptz,
  used_by text,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.ha_subscription_log (
  id bigserial primary key,
  code text not null,
  subscription_id uuid,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  actor text not null default 'system',
  at timestamptz not null default now()
);
create index if not exists ha_subscription_log_code on public.ha_subscription_log (code, at desc);

alter table public.ha_plans enable row level security;
alter table public.ha_subscriptions enable row level security;
alter table public.ha_activation_codes enable row level security;
alter table public.ha_subscription_log enable row level security;
do $$
declare t text;
begin
  foreach t in array array['ha_plans','ha_subscriptions','ha_activation_codes','ha_subscription_log'] loop
    execute format('drop policy if exists teacher_all on public.%I', t);
    execute format('create policy teacher_all on public.%I for all to authenticated using (public.ha_is_teacher()) with check (public.ha_is_teacher())', t);
  end loop;
end $$;

-- Internal access check (not callable by clients).
create or replace function public.ha_has_access(p_code text, p_kind text, p_id text)
returns boolean language sql stable security definer set search_path = '' as $$
  with hit as (
    select p.id,
      case p_kind when 'lesson' then p_id = any(p.lesson_ids)
                  when 'exam' then p_id = any(p.exam_ids)
                  when 'ai' then p.includes_ai else false end as covers
    from public.ha_plans p
  )
  select not exists (select 1 from hit where covers)
      or exists (
        select 1 from public.ha_subscriptions s join hit h on h.id = s.plan_id and h.covers
        where s.code = p_code and s.status = 'active' and s.starts_at <= now() and s.ends_at > now());
$$;
revoke all on function public.ha_has_access(text, text, text) from public, anon, authenticated;

-- Student: my subscription, history, and the plan catalogue for my grade.
create or replace function public.ha_sub_me(p_code text, p_device text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare c public.ha_codes;
begin
  c := public.ha_resolve(p_code, p_device);
  if c.code is null then return jsonb_build_object('ok', false, 'error', 'UNAUTHORIZED'); end if;
  return jsonb_build_object('ok', true,
    'subscriptions', coalesce((select jsonb_agg(jsonb_build_object(
        'id', s.id, 'planId', p.id, 'planName', p.name, 'startsAt', s.starts_at, 'endsAt', s.ends_at,
        'status', case when s.status <> 'active' then s.status when s.ends_at <= now() then 'expired' else 'active' end,
        'daysLeft', greatest(0, ceil(extract(epoch from (s.ends_at - now())) / 86400))::int,
        'includesAi', p.includes_ai, 'lessonCount', cardinality(p.lesson_ids), 'examCount', cardinality(p.exam_ids),
        'source', s.source) order by s.ends_at desc)
      from public.ha_subscriptions s join public.ha_plans p on p.id = s.plan_id where s.code = c.code), '[]'::jsonb),
    'plans', coalesce((select jsonb_agg(jsonb_build_object(
        'id', p.id, 'name', p.name, 'price', p.price, 'durationDays', p.duration_days,
        'includesAi', p.includes_ai, 'lessonCount', cardinality(p.lesson_ids), 'examCount', cardinality(p.exam_ids)) order by p.price)
      from public.ha_plans p where p.active and (p.grade is null or p.grade = c.grade or c.grade = 'جميع الصفوف')), '[]'::jsonb));
end $$;

-- Student: redeem an activation code. Same plan already active => extends (renewal).
create or replace function public.ha_sub_redeem(p_code text, p_device text, p_activation text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare c public.ha_codes; a public.ha_activation_codes; pl public.ha_plans; cur public.ha_subscriptions;
        sid uuid; st timestamptz; en timestamptz; k text := upper(trim(coalesce(p_activation, '')));
begin
  c := public.ha_resolve(p_code, p_device);
  if c.code is null then return jsonb_build_object('ok', false, 'error', 'UNAUTHORIZED'); end if;
  if length(k) < 4 or length(k) > 40 then return jsonb_build_object('ok', false, 'error', 'INVALID_CODE'); end if;
  perform pg_advisory_xact_lock(hashtext('subredeem:' || c.code));
  select * into a from public.ha_activation_codes where code = k for update;
  if not found or not a.active or a.used_at is not null or (a.expires_at is not null and a.expires_at <= now()) then
    insert into public.ha_subscription_log (code, action, details, actor) values (c.code, 'redeem_failed', jsonb_build_object('attempt', left(k, 40)), c.code);
    return jsonb_build_object('ok', false, 'error', 'INVALID_CODE');
  end if;
  select * into pl from public.ha_plans where id = a.plan_id;
  if not found or not pl.active then return jsonb_build_object('ok', false, 'error', 'PLAN_UNAVAILABLE'); end if;
  if pl.grade is not null and c.grade <> 'جميع الصفوف' and pl.grade <> c.grade then
    return jsonb_build_object('ok', false, 'error', 'WRONG_GRADE');
  end if;
  select * into cur from public.ha_subscriptions
    where code = c.code and plan_id = pl.id and status = 'active' and ends_at > now() order by ends_at desc limit 1 for update;
  if found then
    st := cur.starts_at; en := cur.ends_at + make_interval(days => pl.duration_days);
    update public.ha_subscriptions set ends_at = en, updated_at = now() where id = cur.id;
    sid := cur.id;
  else
    st := now(); en := now() + make_interval(days => pl.duration_days);
    insert into public.ha_subscriptions (code, plan_id, starts_at, ends_at, source) values (c.code, pl.id, st, en, 'activation_code') returning id into sid;
  end if;
  update public.ha_activation_codes set used_by = c.code, used_at = now() where code = k;
  insert into public.ha_subscription_log (code, subscription_id, action, details, actor)
    values (c.code, sid, case when cur.id is not null then 'renewed' else 'activated' end,
            jsonb_build_object('plan', pl.name, 'endsAt', en, 'via', 'activation_code'), c.code);
  return jsonb_build_object('ok', true, 'planName', pl.name, 'endsAt', en, 'renewed', cur.id is not null);
end $$;

-- Teacher RPCs
create or replace function public.ha_teacher_plan_save(
  p_id uuid, p_name text, p_price numeric, p_days int, p_grade text, p_lessons text[], p_exams text[], p_ai boolean, p_active boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare rid uuid;
begin
  if not public.ha_is_teacher() then raise exception 'FORBIDDEN'; end if;
  if p_id is null then
    insert into public.ha_plans (name, price, duration_days, grade, lesson_ids, exam_ids, includes_ai, active)
      values (trim(p_name), coalesce(p_price, 0), p_days, nullif(trim(coalesce(p_grade, '')), ''), coalesce(p_lessons, '{}'), coalesce(p_exams, '{}'), coalesce(p_ai, false), coalesce(p_active, true))
      returning id into rid;
  else
    update public.ha_plans set name = trim(p_name), price = coalesce(p_price, 0), duration_days = p_days,
        grade = nullif(trim(coalesce(p_grade, '')), ''), lesson_ids = coalesce(p_lessons, '{}'), exam_ids = coalesce(p_exams, '{}'),
        includes_ai = coalesce(p_ai, false), active = coalesce(p_active, true), updated_at = now()
      where id = p_id returning id into rid;
    if rid is null then return jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); end if;
  end if;
  return jsonb_build_object('ok', true, 'id', rid);
end $$;

create or replace function public.ha_teacher_plan_delete(p_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not public.ha_is_teacher() then raise exception 'FORBIDDEN'; end if;
  if exists (select 1 from public.ha_subscriptions where plan_id = p_id) then
    update public.ha_plans set active = false, updated_at = now() where id = p_id;
    return jsonb_build_object('ok', true, 'deactivated', true);
  end if;
  delete from public.ha_plans where id = p_id;
  return jsonb_build_object('ok', true, 'deactivated', false);
end $$;

create or replace function public.ha_teacher_codes_generate(p_plan uuid, p_count int, p_expires timestamptz)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare n int := least(greatest(coalesce(p_count, 1), 1), 200); out text[] := '{}'; k text; i int := 0; tries int := 0;
begin
  if not public.ha_is_teacher() then raise exception 'FORBIDDEN'; end if;
  if not exists (select 1 from public.ha_plans where id = p_plan) then return jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); end if;
  while i < n and tries < n * 5 loop
    tries := tries + 1;
    k := 'SUB-' || upper(substr(md5(gen_random_uuid()::text), 1, 4)) || '-' || upper(substr(md5(gen_random_uuid()::text), 1, 4)) || '-' || upper(substr(md5(gen_random_uuid()::text), 1, 4));
    begin
      insert into public.ha_activation_codes (code, plan_id, expires_at) values (k, p_plan, p_expires);
      out := out || k; i := i + 1;
    exception when unique_violation then null;
    end;
  end loop;
  return jsonb_build_object('ok', true, 'codes', to_jsonb(out));
end $$;

create or replace function public.ha_teacher_sub_grant(p_student text, p_plan uuid, p_days int)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare pl public.ha_plans; d int; sid uuid; en timestamptz; cur public.ha_subscriptions; stu text := upper(trim(coalesce(p_student, '')));
begin
  if not public.ha_is_teacher() then raise exception 'FORBIDDEN'; end if;
  if not exists (select 1 from public.ha_codes where code = stu) then return jsonb_build_object('ok', false, 'error', 'STUDENT_NOT_FOUND'); end if;
  select * into pl from public.ha_plans where id = p_plan;
  if not found then return jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); end if;
  d := coalesce(p_days, pl.duration_days);
  if d < 1 or d > 1100 then return jsonb_build_object('ok', false, 'error', 'INVALID'); end if;
  select * into cur from public.ha_subscriptions where code = stu and plan_id = pl.id and status = 'active' and ends_at > now() order by ends_at desc limit 1 for update;
  if found then
    en := cur.ends_at + make_interval(days => d);
    update public.ha_subscriptions set ends_at = en, updated_at = now() where id = cur.id; sid := cur.id;
  else
    en := now() + make_interval(days => d);
    insert into public.ha_subscriptions (code, plan_id, starts_at, ends_at, source) values (stu, pl.id, now(), en, 'teacher') returning id into sid;
  end if;
  insert into public.ha_subscription_log (code, subscription_id, action, details, actor)
    values (stu, sid, case when cur.id is not null then 'renewed' else 'granted' end, jsonb_build_object('plan', pl.name, 'days', d, 'endsAt', en), 'teacher');
  return jsonb_build_object('ok', true, 'id', sid, 'endsAt', en);
end $$;

create or replace function public.ha_teacher_sub_set_status(p_id uuid, p_status text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare s public.ha_subscriptions;
begin
  if not public.ha_is_teacher() then raise exception 'FORBIDDEN'; end if;
  if p_status not in ('active','paused','cancelled') then return jsonb_build_object('ok', false, 'error', 'INVALID'); end if;
  update public.ha_subscriptions set status = p_status, updated_at = now() where id = p_id returning * into s;
  if not found then return jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); end if;
  insert into public.ha_subscription_log (code, subscription_id, action, details, actor) values (s.code, s.id, 'status_' || p_status, '{}'::jsonb, 'teacher');
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.ha_teacher_subs_overview()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.ha_is_teacher() then raise exception 'FORBIDDEN'; end if;
  return jsonb_build_object(
    'plans', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'price', p.price, 'durationDays', p.duration_days,
        'grade', p.grade, 'lessonIds', p.lesson_ids, 'examIds', p.exam_ids, 'includesAi', p.includes_ai, 'active', p.active,
        'subscribers', (select count(*) from public.ha_subscriptions s where s.plan_id = p.id and s.status = 'active' and s.ends_at > now())) order by p.created_at desc)
      from public.ha_plans p), '[]'::jsonb),
    'subscriptions', coalesce((select jsonb_agg(row_to_json(x) order by x.ends_at desc) from (
        select s.id, s.code, coalesce(a.name, c.student_name, s.code) as student, p.name as plan, s.plan_id, s.starts_at, s.ends_at, s.source, s.status as raw_status,
          case when s.status <> 'active' then s.status when s.ends_at <= now() then 'expired'
               when s.ends_at <= now() + interval '7 days' then 'expiring' else 'active' end as status,
          greatest(0, ceil(extract(epoch from (s.ends_at - now())) / 86400))::int as days_left
        from public.ha_subscriptions s join public.ha_plans p on p.id = s.plan_id
        left join public.ha_codes c on c.code = s.code left join public.ha_accounts a on a.code = s.code
        order by s.ends_at desc limit 500) x), '[]'::jsonb),
    'codes', coalesce((select jsonb_agg(row_to_json(y) order by y.created_at desc) from (
        select k.code, k.plan_id, p.name as plan, k.active, k.expires_at, k.used_by, k.used_at, k.created_at
        from public.ha_activation_codes k join public.ha_plans p on p.id = k.plan_id order by k.created_at desc limit 300) y), '[]'::jsonb),
    'log', coalesce((select jsonb_agg(row_to_json(z) order by z.at desc) from (
        select l.id, l.code, coalesce(a.name, c.student_name, l.code) as student, l.action, l.details, l.actor, l.at
        from public.ha_subscription_log l left join public.ha_codes c on c.code = l.code left join public.ha_accounts a on a.code = l.code
        order by l.at desc limit 200) z), '[]'::jsonb));
end $$;

-- Enforcement: feed hides locked lesson media/questions; exam submit, AI and watch tracking refuse locked content.
create or replace function public.ha_feed(p_code text, p_device text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare c public.ha_codes;
begin
  c := public.ha_resolve(p_code, p_device);
  if c.code is null then return jsonb_build_object('ok', false, 'error', 'UNAUTHORIZED'); end if;
  return jsonb_build_object(
    'ok', true, 'grade', c.grade,
    'lessons', coalesce((select jsonb_agg(
        case when public.ha_has_access(c.code, 'lesson', l.id) then l.data
             else (l.data - 'videoUrl' - 'backupVideoUrl' - 'downloadUrl' - 'pdfUrl' - 'attachments' - 'quiz' - 'laws' - 'keyPoints')
                  || jsonb_build_object('videoUrl', '', 'locked', true) end
        order by l.created_at desc)
      from public.ha_lessons l where c.grade = 'جميع الصفوف' or l.grade = c.grade), '[]'::jsonb),
    'notifications', coalesce((select jsonb_agg(jsonb_build_object('id', n.id, 'title', n.title, 'body', n.body, 'lessonId', n.lesson_id, 'createdAt', n.created_at) order by n.created_at desc)
      from (select * from public.ha_notifications where grade is null or c.grade = 'جميع الصفوف' or grade = c.grade order by created_at desc limit 30) n), '[]'::jsonb),
    'exams', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'title', e.title, 'grade', e.grade, 'durationMin', e.duration_min, 'createdAt', e.created_at,
          'locked', not public.ha_has_access(c.code, 'exam', e.id),
          'questions', case when public.ha_has_access(c.code, 'exam', e.id) then
              (select coalesce(jsonb_agg((t.q - 'correctIndex' - 'explanation') order by t.ord), '[]'::jsonb) from jsonb_array_elements(e.questions) with ordinality as t(q, ord))
            else '[]'::jsonb end) order by e.created_at desc)
      from public.ha_exams e where e.published and (c.grade = 'جميع الصفوف' or e.grade = c.grade)), '[]'::jsonb),
    'examResults', coalesce((select jsonb_agg(jsonb_build_object('examId', r.exam_id, 'score', r.score, 'total', r.total, 'createdAt', r.created_at, 'answers', r.answers,
          'review', (select coalesce(jsonb_agg(jsonb_build_object('correctIndex', t.q -> 'correctIndex', 'explanation', coalesce(t.q ->> 'explanation', '')) order by t.ord), '[]'::jsonb)
                     from jsonb_array_elements(e2.questions) with ordinality as t(q, ord))) order by r.created_at desc)
      from public.ha_exam_results r join public.ha_exams e2 on e2.id = r.exam_id where r.code = c.code), '[]'::jsonb));
end $$;

create or replace function public.ha_exam_submit(p_code text, p_device text, p_exam_id text, p_answers jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare c public.ha_codes; e public.ha_exams; n int; s int := 0; i int; ans jsonb;
begin
  c := public.ha_resolve(p_code, p_device);
  if c.code is null then return jsonb_build_object('ok', false, 'error', 'UNAUTHORIZED'); end if;
  select * into e from public.ha_exams where id = p_exam_id and published and (c.grade = 'جميع الصفوف' or grade = c.grade);
  if not found then return jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); end if;
  if not public.ha_has_access(c.code, 'exam', e.id) then return jsonb_build_object('ok', false, 'error', 'SUBSCRIPTION_REQUIRED'); end if;
  if exists (select 1 from public.ha_exam_results where exam_id = e.id and code = c.code) then return jsonb_build_object('ok', false, 'error', 'ALREADY_TAKEN'); end if;
  n := jsonb_array_length(e.questions);
  if n = 0 then return jsonb_build_object('ok', false, 'error', 'EMPTY_EXAM'); end if;
  ans := case when jsonb_typeof(p_answers) = 'array' then p_answers else '[]'::jsonb end;
  for i in 0 .. n - 1 loop
    if (ans ->> i) ~ '^[0-9]+$' and (e.questions -> i ->> 'correctIndex') ~ '^[0-9]+$'
       and (ans ->> i)::int = (e.questions -> i ->> 'correctIndex')::int then s := s + 1; end if;
  end loop;
  insert into public.ha_exam_results (exam_id, code, score, total, answers) values (e.id, c.code, s, n, ans);
  return jsonb_build_object('ok', true, 'score', s, 'total', n, 'answers', ans,
    'review', (select coalesce(jsonb_agg(jsonb_build_object('correctIndex', t.q -> 'correctIndex', 'explanation', coalesce(t.q ->> 'explanation', '')) order by t.ord), '[]'::jsonb)
               from jsonb_array_elements(e.questions) with ordinality as t(q, ord)));
end $$;

create or replace function public.ha_ai_gate(p_code text, p_device text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare c public.ha_codes; per_min int; per_day int;
begin
  c := public.ha_resolve(p_code, p_device);
  if c.code is null then return jsonb_build_object('ok', false, 'error', 'UNAUTHORIZED'); end if;
  if not public.ha_has_access(c.code, 'ai', '') then return jsonb_build_object('ok', false, 'error', 'SUBSCRIPTION_REQUIRED'); end if;
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

create or replace function public.ha_watch_heartbeat(
  p_code text, p_device text, p_lesson text, p_delta numeric, p_position numeric, p_duration numeric)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  c public.ha_codes; r public.ha_lecture_progress;
  elapsed numeric; credit int; dur int; watched int; done boolean; pos int;
  today date := (now() at time zone 'Africa/Cairo')::date;
begin
  c := public.ha_resolve(p_code, p_device);
  if c.code is null then return jsonb_build_object('ok', false, 'error', 'UNAUTHORIZED'); end if;
  if coalesce(p_lesson, '') = '' or length(p_lesson) > 80 then return jsonb_build_object('ok', false, 'error', 'INVALID'); end if;
  if not public.ha_has_access(c.code, 'lesson', p_lesson) then return jsonb_build_object('ok', false, 'error', 'SUBSCRIPTION_REQUIRED'); end if;
  insert into public.ha_lecture_progress (code, lesson_id, last_heartbeat) values (c.code, p_lesson, now() - interval '20 seconds') on conflict (code, lesson_id) do nothing;
  select * into r from public.ha_lecture_progress where code = c.code and lesson_id = p_lesson for update;
  elapsed := greatest(0, extract(epoch from (now() - r.last_heartbeat)));
  credit := floor(greatest(0, least(coalesce(p_delta, 0), elapsed * 2 + 2, 30)))::int;
  dur := case when coalesce(p_duration, 0) > 0 then least(p_duration, 86400)::int else r.duration_seconds end;
  watched := r.watched_seconds + credit;
  if dur > 0 then watched := least(watched, dur); end if;
  done := r.completed or (dur > 0 and watched >= dur * 0.9);
  pos := greatest(0, least(coalesce(p_position, 0), case when dur > 0 then dur else 86400 end))::int;
  update public.ha_lecture_progress set watched_seconds = watched, duration_seconds = dur, last_position = pos, completed = done, last_heartbeat = now(), updated_at = now()
   where code = c.code and lesson_id = p_lesson;
  if credit > 0 then
    insert into public.ha_watch_daily (code, day, seconds) values (c.code, today, credit)
      on conflict (code, day) do update set seconds = public.ha_watch_daily.seconds + excluded.seconds;
  end if;
  return jsonb_build_object('ok', true, 'watchedSeconds', watched, 'durationSeconds', dur, 'lastPosition', pos, 'completed', done, 'credited', credit);
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'ha_sub_me(text,text)','ha_sub_redeem(text,text,text)',
    'ha_teacher_plan_save(uuid,text,numeric,int,text,text[],text[],boolean,boolean)','ha_teacher_plan_delete(uuid)',
    'ha_teacher_codes_generate(uuid,int,timestamptz)','ha_teacher_sub_grant(text,uuid,int)','ha_teacher_sub_set_status(uuid,text)','ha_teacher_subs_overview()'] loop
    execute format('revoke all on function public.%s from public', f);
  end loop;
end $$;
grant execute on function public.ha_sub_me(text, text) to anon, authenticated;
grant execute on function public.ha_sub_redeem(text, text, text) to anon, authenticated;
grant execute on function public.ha_teacher_plan_save(uuid, text, numeric, int, text, text[], text[], boolean, boolean) to authenticated;
grant execute on function public.ha_teacher_plan_delete(uuid) to authenticated;
grant execute on function public.ha_teacher_codes_generate(uuid, int, timestamptz) to authenticated;
grant execute on function public.ha_teacher_sub_grant(text, uuid, int) to authenticated;
grant execute on function public.ha_teacher_sub_set_status(uuid, text) to authenticated;
grant execute on function public.ha_teacher_subs_overview() to authenticated;
