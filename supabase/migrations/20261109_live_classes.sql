-- Live classes (LiveKit for audio/video; Supabase for access control, chat, hands, attendance, polls, invites).
-- Chat and moderation are server-authoritative (RPC + polling), never trusted from the media channel.

create table if not exists public.ha_live_classes (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(title) between 1 and 160),
  description text not null default '' check (length(description) <= 2000),
  grade text not null,
  lesson_id text,
  plan_id uuid references public.ha_plans(id) on delete set null,
  allowed_codes text[] not null default '{}',
  scheduled_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled','live','ended','cancelled')),
  room_name text not null unique default ('live-' || replace(gen_random_uuid()::text, '-', '')),
  started_at timestamptz,
  ended_at timestamptz,
  chat_mode text not null default 'open' check (chat_mode in ('open','questions','off')),
  guests_max int not null default 2 check (guests_max between 0 and 8),
  allow_guest_screen boolean not null default false,
  recording_url text not null default '',
  recording_until timestamptz,
  recording_note text not null default '' check (length(recording_note) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ha_live_classes_sched on public.ha_live_classes (status, scheduled_at);

create table if not exists public.ha_live_attendance (
  id bigserial primary key,
  class_id uuid not null references public.ha_live_classes(id) on delete cascade,
  code text not null,
  name text not null default '',
  role text not null default 'student' check (role in ('student','guest')),
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  last_seen timestamptz not null default now()
);
create index if not exists ha_live_att_class on public.ha_live_attendance (class_id, code);
create unique index if not exists ha_live_att_open on public.ha_live_attendance (class_id, code) where left_at is null;

create table if not exists public.ha_live_messages (
  id bigserial primary key,
  class_id uuid not null references public.ha_live_classes(id) on delete cascade,
  code text not null,
  name text not null default '',
  body text not null check (length(body) between 1 and 600),
  kind text not null default 'chat' check (kind in ('chat','question')),
  pinned boolean not null default false,
  answered boolean not null default false,
  important boolean not null default false,
  deleted boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists ha_live_msg_class on public.ha_live_messages (class_id, id);

create table if not exists public.ha_live_members (
  class_id uuid not null references public.ha_live_classes(id) on delete cascade,
  code text not null,
  muted boolean not null default false,
  banned boolean not null default false,
  primary key (class_id, code)
);

create table if not exists public.ha_live_hands (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.ha_live_classes(id) on delete cascade,
  code text not null,
  name text not null default '',
  status text not null default 'pending' check (status in ('pending','accepted','rejected','ended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists ha_live_hands_active on public.ha_live_hands (class_id, code) where status in ('pending','accepted');

create table if not exists public.ha_live_invites (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.ha_live_classes(id) on delete cascade,
  token text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  label text not null default '' check (length(label) <= 80),
  status text not null default 'active' check (status in ('active','revoked')),
  created_at timestamptz not null default now()
);

create table if not exists public.ha_live_polls (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.ha_live_classes(id) on delete cascade,
  question text not null check (length(question) between 1 and 300),
  options jsonb not null,
  correct int,
  status text not null default 'open' check (status in ('open','closed')),
  created_at timestamptz not null default now()
);
create table if not exists public.ha_live_poll_answers (
  poll_id uuid not null references public.ha_live_polls(id) on delete cascade,
  code text not null,
  choice int not null check (choice between 0 and 9),
  at timestamptz not null default now(),
  primary key (poll_id, code)
);
create table if not exists public.ha_live_confusion (
  id bigserial primary key,
  class_id uuid not null references public.ha_live_classes(id) on delete cascade,
  code text not null,
  at timestamptz not null default now()
);
create index if not exists ha_live_conf_class on public.ha_live_confusion (class_id, at desc);

do $$
declare t text;
begin
  foreach t in array array['ha_live_classes','ha_live_attendance','ha_live_messages','ha_live_members','ha_live_hands','ha_live_invites','ha_live_polls','ha_live_poll_answers','ha_live_confusion'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists teacher_all on public.%I', t);
    execute format('create policy teacher_all on public.%I for all to authenticated using (public.ha_is_teacher()) with check (public.ha_is_teacher())', t);
  end loop;
end $$;

-- ---------- helpers (internal) ----------
create or replace function public.ha_live_allowed(c public.ha_codes, k public.ha_live_classes)
returns boolean language sql stable security definer set search_path = '' as $$
  select (c.grade = 'جميع الصفوف' or k.grade = 'جميع الصفوف' or k.grade = c.grade)
     and (cardinality(k.allowed_codes) = 0 or c.code = any(k.allowed_codes))
     and not exists (select 1 from public.ha_live_members m where m.class_id = k.id and m.code = c.code and m.banned);
$$;

create or replace function public.ha_live_paid_ok(p_code text, k public.ha_live_classes)
returns boolean language sql stable security definer set search_path = '' as $$
  select k.plan_id is null or exists (
    select 1 from public.ha_subscriptions s where s.code = p_code and s.plan_id = k.plan_id and s.status = 'active' and s.starts_at <= now() and s.ends_at > now());
$$;

create or replace function public.ha_live_notify(p_class uuid, p_kind text, p_title text, p_body text)
returns int language plpgsql security definer set search_path = '' as $$
declare k public.ha_live_classes; n int;
begin
  select * into k from public.ha_live_classes where id = p_class;
  if not found then return 0; end if;
  insert into public.ha_user_notifications (code, kind, title, body, dedupe_key)
    select c.code, 'live', p_title, p_body, 'live|' || k.id::text || '|' || p_kind || '|' || c.code
    from public.ha_codes c
    where c.active and (c.used_at is not null or exists (select 1 from public.ha_accounts a where a.code = c.code))
      and (c.grade = 'جميع الصفوف' or k.grade = 'جميع الصفوف' or k.grade = c.grade)
      and (cardinality(k.allowed_codes) = 0 or c.code = any(k.allowed_codes))
    on conflict (dedupe_key) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

-- ---------- student RPCs ----------
create or replace function public.ha_live_list(p_code text, p_device text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare c public.ha_codes;
begin
  c := public.ha_resolve(p_code, p_device);
  if c.code is null then return jsonb_build_object('ok', false, 'error', 'UNAUTHORIZED'); end if;
  return jsonb_build_object('ok', true, 'classes', coalesce((select jsonb_agg(jsonb_build_object(
      'id', k.id, 'title', k.title, 'description', k.description, 'grade', k.grade, 'scheduledAt', k.scheduled_at, 'status', k.status,
      'startedAt', k.started_at, 'endedAt', k.ended_at, 'paid', k.plan_id is not null, 'locked', not public.ha_live_paid_ok(c.code, k),
      'recordingUrl', case when public.ha_live_paid_ok(c.code, k) and k.recording_url <> '' and (k.recording_until is null or k.recording_until > now()) then k.recording_url else '' end,
      'recordingNote', case when public.ha_live_paid_ok(c.code, k) then k.recording_note else '' end,
      'myMinutes', coalesce((select round(sum(extract(epoch from (coalesce(a.left_at, a.last_seen) - a.joined_at))) / 60)::int from public.ha_live_attendance a where a.class_id = k.id and a.code = c.code), 0)
    ) order by (k.status = 'live') desc, k.scheduled_at desc)
    from public.ha_live_classes k
    where k.status <> 'cancelled' and public.ha_live_allowed(c, k)
      and k.scheduled_at > now() - interval '60 days'), '[]'::jsonb));
end $$;

create or replace function public.ha_live_join(p_code text, p_device text, p_class uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare c public.ha_codes; k public.ha_live_classes; nm text; h public.ha_live_hands; role text := 'student';
begin
  c := public.ha_resolve(p_code, p_device);
  if c.code is null then return jsonb_build_object('ok', false, 'error', 'UNAUTHORIZED'); end if;
  select * into k from public.ha_live_classes where id = p_class;
  if not found or k.status = 'cancelled' then return jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); end if;
  if not public.ha_live_allowed(c, k) then return jsonb_build_object('ok', false, 'error', 'NOT_ALLOWED'); end if;
  if not public.ha_live_paid_ok(c.code, k) then return jsonb_build_object('ok', false, 'error', 'SUBSCRIPTION_REQUIRED'); end if;
  if k.status <> 'live' then return jsonb_build_object('ok', false, 'error', 'NOT_LIVE'); end if;
  select coalesce((select a.name from public.ha_accounts a where a.code = c.code), c.student_name, c.code) into nm;
  select * into h from public.ha_live_hands where class_id = k.id and code = c.code and status = 'accepted';
  if found then role := 'guest'; end if;
  update public.ha_live_attendance set last_seen = now() where class_id = k.id and code = c.code and left_at is null and last_seen > now() - interval '45 seconds';
  if not found then
    update public.ha_live_attendance set left_at = last_seen where class_id = k.id and code = c.code and left_at is null;
    insert into public.ha_live_attendance (class_id, code, name, role) values (k.id, c.code, nm, case when role = 'guest' then 'guest' else 'student' end);
  end if;
  return jsonb_build_object('ok', true, 'role', role, 'identity', 's:' || c.code, 'name', nm, 'room', k.room_name,
    'allowGuestScreen', k.allow_guest_screen);
end $$;

create or replace function public.ha_live_leave(p_code text, p_device text, p_class uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare c public.ha_codes;
begin
  c := public.ha_resolve(p_code, p_device);
  if c.code is null then return jsonb_build_object('ok', false); end if;
  update public.ha_live_attendance set left_at = now(), last_seen = now() where class_id = p_class and code = c.code and left_at is null;
  return jsonb_build_object('ok', true);
end $$;

-- One polling endpoint for the student room: chat since id, pinned message, my status, open poll, recording.
create or replace function public.ha_live_state(p_code text, p_device text, p_class uuid, p_since bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare c public.ha_codes; k public.ha_live_classes; mem public.ha_live_members; h public.ha_live_hands; pl public.ha_live_polls;
begin
  c := public.ha_resolve(p_code, p_device);
  if c.code is null then return jsonb_build_object('ok', false, 'error', 'UNAUTHORIZED'); end if;
  select * into k from public.ha_live_classes where id = p_class;
  if not found or not public.ha_live_allowed(c, k) then return jsonb_build_object('ok', false, 'error', 'NOT_ALLOWED'); end if;
  update public.ha_live_attendance set last_seen = now() where class_id = k.id and code = c.code and left_at is null;
  select * into mem from public.ha_live_members where class_id = k.id and code = c.code;
  select * into h from public.ha_live_hands where class_id = k.id and code = c.code and status in ('pending','accepted') order by created_at desc limit 1;
  select * into pl from public.ha_live_polls where class_id = k.id and status = 'open' order by created_at desc limit 1;
  return jsonb_build_object('ok', true, 'status', k.status, 'chatMode', k.chat_mode, 'muted', coalesce(mem.muted, false), 'banned', coalesce(mem.banned, false),
    'hand', h.status, 'handId', h.id, 'allowGuestScreen', k.allow_guest_screen,
    'messages', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'name', m.name, 'body', m.body, 'kind', m.kind, 'pinned', m.pinned, 'mine', m.code = c.code, 'at', m.created_at) order by m.id)
      from (select * from public.ha_live_messages where class_id = k.id and not deleted and id > coalesce(p_since, 0) and (kind = 'chat' or code = c.code or answered) order by id desc limit 100) m), '[]'::jsonb),
    'removed', coalesce((select jsonb_agg(m.id) from public.ha_live_messages m where m.class_id = k.id and m.deleted and m.id > greatest(coalesce(p_since, 0) - 200, 0)), '[]'::jsonb),
    'pinned', (select jsonb_build_object('id', m.id, 'name', m.name, 'body', m.body) from public.ha_live_messages m where m.class_id = k.id and m.pinned and not m.deleted order by m.id desc limit 1),
    'poll', case when pl.id is null then null else jsonb_build_object('id', pl.id, 'question', pl.question, 'options', pl.options,
        'mine', (select a.choice from public.ha_live_poll_answers a where a.poll_id = pl.id and a.code = c.code)) end);
end $$;

create or replace function public.ha_live_send(p_code text, p_device text, p_class uuid, p_body text, p_kind text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare c public.ha_codes; k public.ha_live_classes; mem public.ha_live_members; nm text; b text := trim(coalesce(p_body, '')); kd text := case when p_kind = 'question' then 'question' else 'chat' end;
begin
  c := public.ha_resolve(p_code, p_device);
  if c.code is null then return jsonb_build_object('ok', false, 'error', 'UNAUTHORIZED'); end if;
  select * into k from public.ha_live_classes where id = p_class;
  if not found or not public.ha_live_allowed(c, k) or not public.ha_live_paid_ok(c.code, k) then return jsonb_build_object('ok', false, 'error', 'NOT_ALLOWED'); end if;
  if k.status <> 'live' then return jsonb_build_object('ok', false, 'error', 'NOT_LIVE'); end if;
  if length(b) < 1 or length(b) > 600 then return jsonb_build_object('ok', false, 'error', 'INVALID'); end if;
  select * into mem from public.ha_live_members where class_id = k.id and code = c.code;
  if coalesce(mem.muted, false) then return jsonb_build_object('ok', false, 'error', 'MUTED'); end if;
  if k.chat_mode = 'off' then return jsonb_build_object('ok', false, 'error', 'CHAT_OFF'); end if;
  if k.chat_mode = 'questions' and kd = 'chat' then return jsonb_build_object('ok', false, 'error', 'QUESTIONS_ONLY'); end if;
  if (select count(*) from public.ha_live_messages where class_id = k.id and code = c.code and created_at > now() - interval '10 seconds') >= 4 then return jsonb_build_object('ok', false, 'error', 'SLOW_DOWN'); end if;
  select coalesce((select a.name from public.ha_accounts a where a.code = c.code), c.student_name, c.code) into nm;
  insert into public.ha_live_messages (class_id, code, name, body, kind) values (k.id, c.code, nm, b, kd);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.ha_live_hand(p_code text, p_device text, p_class uuid, p_raise boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare c public.ha_codes; k public.ha_live_classes; nm text;
begin
  c := public.ha_resolve(p_code, p_device);
  if c.code is null then return jsonb_build_object('ok', false, 'error', 'UNAUTHORIZED'); end if;
  select * into k from public.ha_live_classes where id = p_class;
  if not found or k.status <> 'live' or not public.ha_live_allowed(c, k) or not public.ha_live_paid_ok(c.code, k) then return jsonb_build_object('ok', false, 'error', 'NOT_ALLOWED'); end if;
  if p_raise then
    if coalesce((select muted from public.ha_live_members where class_id = k.id and code = c.code), false) then return jsonb_build_object('ok', false, 'error', 'MUTED'); end if;
    select coalesce((select a.name from public.ha_accounts a where a.code = c.code), c.student_name, c.code) into nm;
    insert into public.ha_live_hands (class_id, code, name) values (k.id, c.code, nm) on conflict do nothing;
  else
    update public.ha_live_hands set status = 'ended', updated_at = now() where class_id = k.id and code = c.code and status in ('pending','accepted');
  end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.ha_live_confused(p_code text, p_device text, p_class uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare c public.ha_codes; k public.ha_live_classes;
begin
  c := public.ha_resolve(p_code, p_device);
  if c.code is null then return jsonb_build_object('ok', false, 'error', 'UNAUTHORIZED'); end if;
  select * into k from public.ha_live_classes where id = p_class;
  if not found or k.status <> 'live' or not public.ha_live_allowed(c, k) then return jsonb_build_object('ok', false, 'error', 'NOT_ALLOWED'); end if;
  if exists (select 1 from public.ha_live_confusion where class_id = k.id and code = c.code and at > now() - interval '60 seconds') then return jsonb_build_object('ok', true); end if;
  insert into public.ha_live_confusion (class_id, code) values (k.id, c.code);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.ha_live_poll_answer(p_code text, p_device text, p_poll uuid, p_choice int)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare c public.ha_codes; pl public.ha_live_polls; k public.ha_live_classes;
begin
  c := public.ha_resolve(p_code, p_device);
  if c.code is null then return jsonb_build_object('ok', false, 'error', 'UNAUTHORIZED'); end if;
  select * into pl from public.ha_live_polls where id = p_poll and status = 'open';
  if not found then return jsonb_build_object('ok', false, 'error', 'CLOSED'); end if;
  select * into k from public.ha_live_classes where id = pl.class_id;
  if not public.ha_live_allowed(c, k) or p_choice < 0 or p_choice >= jsonb_array_length(pl.options) then return jsonb_build_object('ok', false, 'error', 'NOT_ALLOWED'); end if;
  insert into public.ha_live_poll_answers (poll_id, code, choice) values (pl.id, c.code, p_choice) on conflict (poll_id, code) do nothing;
  return jsonb_build_object('ok', true);
end $$;

-- ---------- guest by invite link (no account) ----------
create or replace function public.ha_live_invite_join(p_token text, p_name text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare i public.ha_live_invites; k public.ha_live_classes; nm text := left(trim(coalesce(p_name, '')), 60); gid text; n int;
begin
  select * into i from public.ha_live_invites where token = coalesce(p_token, '') and status = 'active';
  if not found then return jsonb_build_object('ok', false, 'error', 'INVALID_INVITE'); end if;
  select * into k from public.ha_live_classes where id = i.class_id;
  if k.status <> 'live' then return jsonb_build_object('ok', false, 'error', case when k.status = 'scheduled' then 'NOT_LIVE' else 'ENDED' end); end if;
  if nm = '' then return jsonb_build_object('ok', false, 'error', 'NAME_REQUIRED'); end if;
  gid := 'g:' || i.id::text;
  if not exists (select 1 from public.ha_live_attendance where class_id = k.id and code = gid and left_at is null and last_seen > now() - interval '45 seconds') then
    select count(*) into n from public.ha_live_attendance where class_id = k.id and role = 'guest' and left_at is null and last_seen > now() - interval '45 seconds';
    if n >= k.guests_max then return jsonb_build_object('ok', false, 'error', 'FULL'); end if;
    update public.ha_live_attendance set left_at = last_seen where class_id = k.id and code = gid and left_at is null;
    insert into public.ha_live_attendance (class_id, code, name, role) values (k.id, gid, nm, 'guest');
  else
    update public.ha_live_attendance set last_seen = now(), name = nm where class_id = k.id and code = gid and left_at is null;
  end if;
  return jsonb_build_object('ok', true, 'role', 'guest', 'identity', gid, 'name', nm, 'room', k.room_name, 'classId', k.id, 'title', k.title, 'allowGuestScreen', k.allow_guest_screen);
end $$;

create or replace function public.ha_live_invite_ping(p_token text, p_leave boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare i public.ha_live_invites; k public.ha_live_classes;
begin
  select * into i from public.ha_live_invites where token = coalesce(p_token, '');
  if not found then return jsonb_build_object('ok', false); end if;
  select * into k from public.ha_live_classes where id = i.class_id;
  if coalesce(p_leave, false) then
    update public.ha_live_attendance set left_at = now(), last_seen = now() where class_id = i.class_id and code = 'g:' || i.id::text and left_at is null;
  else
    update public.ha_live_attendance set last_seen = now() where class_id = i.class_id and code = 'g:' || i.id::text and left_at is null;
  end if;
  return jsonb_build_object('ok', i.status = 'active' and k.status = 'live', 'status', k.status);
end $$;

-- ---------- teacher RPCs ----------
create or replace function public.ha_live_teacher_join(p_class uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare k public.ha_live_classes;
begin
  if not public.ha_is_teacher() then return jsonb_build_object('ok', false, 'error', 'FORBIDDEN'); end if;
  select * into k from public.ha_live_classes where id = p_class;
  if not found or k.status in ('cancelled') then return jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); end if;
  return jsonb_build_object('ok', true, 'role', 'teacher', 'identity', 'teacher', 'name', 'المهندس حسين علام', 'room', k.room_name, 'status', k.status, 'allowGuestScreen', k.allow_guest_screen);
end $$;

create or replace function public.ha_teacher_live_save(
  p_id uuid, p_title text, p_desc text, p_grade text, p_lesson text, p_plan uuid, p_codes text[], p_at timestamptz, p_guests int, p_guest_screen boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare rid uuid; k public.ha_live_classes;
begin
  if not public.ha_is_teacher() then raise exception 'FORBIDDEN'; end if;
  if coalesce(trim(p_title), '') = '' or p_at is null or coalesce(p_grade, '') = '' then return jsonb_build_object('ok', false, 'error', 'INVALID'); end if;
  if p_id is null then
    insert into public.ha_live_classes (title, description, grade, lesson_id, plan_id, allowed_codes, scheduled_at, guests_max, allow_guest_screen)
      values (trim(p_title), left(coalesce(p_desc, ''), 2000), p_grade, nullif(p_lesson, ''), p_plan,
              coalesce((select array_agg(upper(trim(x))) from unnest(coalesce(p_codes, '{}')) x where trim(x) <> ''), '{}'), p_at, least(greatest(coalesce(p_guests, 2), 0), 8), coalesce(p_guest_screen, false))
      returning * into k;
    perform public.ha_live_notify(k.id, 'sched', 'محاضرة مباشرة جديدة: ' || k.title, 'ميعاد المحاضرة: ' || to_char(k.scheduled_at at time zone 'Africa/Cairo', 'YYYY-MM-DD HH12:MI AM'));
  else
    update public.ha_live_classes set title = trim(p_title), description = left(coalesce(p_desc, ''), 2000), grade = p_grade, lesson_id = nullif(p_lesson, ''), plan_id = p_plan,
        allowed_codes = coalesce((select array_agg(upper(trim(x))) from unnest(coalesce(p_codes, '{}')) x where trim(x) <> ''), '{}'), scheduled_at = p_at,
        guests_max = least(greatest(coalesce(p_guests, 2), 0), 8), allow_guest_screen = coalesce(p_guest_screen, false), updated_at = now()
      where id = p_id and status in ('scheduled','live') returning * into k;
    if not found then return jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); end if;
  end if;
  return jsonb_build_object('ok', true, 'id', k.id);
end $$;

create or replace function public.ha_teacher_live_status(p_id uuid, p_status text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare k public.ha_live_classes;
begin
  if not public.ha_is_teacher() then raise exception 'FORBIDDEN'; end if;
  if p_status not in ('live','ended','cancelled') then return jsonb_build_object('ok', false, 'error', 'INVALID'); end if;
  select * into k from public.ha_live_classes where id = p_id for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); end if;
  if p_status = 'live' then
    if k.status not in ('scheduled','live') then return jsonb_build_object('ok', false, 'error', 'INVALID'); end if;
    update public.ha_live_classes set status = 'live', started_at = coalesce(started_at, now()), updated_at = now() where id = k.id;
    perform public.ha_live_notify(k.id, 'start', 'البث المباشر بدأ الآن 🔴', k.title || ' — ادخل المحاضرة الآن');
  elsif p_status = 'ended' then
    if k.status <> 'live' then return jsonb_build_object('ok', false, 'error', 'INVALID'); end if;
    update public.ha_live_classes set status = 'ended', ended_at = now(), updated_at = now() where id = k.id;
    update public.ha_live_attendance set left_at = last_seen where class_id = k.id and left_at is null;
    update public.ha_live_hands set status = 'ended', updated_at = now() where class_id = k.id and status in ('pending','accepted');
  else
    if k.status = 'ended' then return jsonb_build_object('ok', false, 'error', 'INVALID'); end if;
    update public.ha_live_classes set status = 'cancelled', updated_at = now() where id = k.id;
  end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.ha_teacher_live_list()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.ha_is_teacher() then raise exception 'FORBIDDEN'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', k.id, 'title', k.title, 'description', k.description, 'grade', k.grade, 'lessonId', k.lesson_id, 'planId', k.plan_id,
      'allowedCodes', to_jsonb(k.allowed_codes), 'scheduledAt', k.scheduled_at, 'status', k.status, 'startedAt', k.started_at, 'endedAt', k.ended_at, 'chatMode', k.chat_mode,
      'guestsMax', k.guests_max, 'allowGuestScreen', k.allow_guest_screen, 'recordingUrl', k.recording_url, 'recordingUntil', k.recording_until, 'recordingNote', k.recording_note,
      'attendees', (select count(distinct a.code) from public.ha_live_attendance a where a.class_id = k.id and a.role = 'student')) order by k.scheduled_at desc)
    from public.ha_live_classes k), '[]'::jsonb);
end $$;

create or replace function public.ha_teacher_live_state(p_class uuid, p_since bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare k public.ha_live_classes; pl public.ha_live_polls;
begin
  if not public.ha_is_teacher() then raise exception 'FORBIDDEN'; end if;
  select * into k from public.ha_live_classes where id = p_class;
  if not found then return jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); end if;
  select * into pl from public.ha_live_polls where class_id = k.id order by created_at desc limit 1;
  return jsonb_build_object('ok', true, 'status', k.status, 'chatMode', k.chat_mode, 'guestsMax', k.guests_max, 'allowGuestScreen', k.allow_guest_screen,
    'messages', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'code', m.code, 'name', m.name, 'body', m.body, 'kind', m.kind, 'pinned', m.pinned, 'answered', m.answered, 'important', m.important, 'deleted', m.deleted, 'at', m.created_at) order by m.id)
      from (select * from public.ha_live_messages where class_id = k.id and id > coalesce(p_since, 0) order by id desc limit 150) m), '[]'::jsonb),
    'open', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'code', m.code, 'name', m.name, 'body', m.body, 'answered', m.answered, 'important', m.important) order by m.id)
      from public.ha_live_messages m where m.class_id = k.id and m.kind = 'question' and not m.deleted and not m.answered), '[]'::jsonb),
    'hands', coalesce((select jsonb_agg(jsonb_build_object('id', h.id, 'code', h.code, 'name', h.name, 'status', h.status) order by h.created_at)
      from public.ha_live_hands h where h.class_id = k.id and h.status in ('pending','accepted')), '[]'::jsonb),
    'present', coalesce((select jsonb_agg(jsonb_build_object('code', a.code, 'name', a.name, 'role', a.role, 'joinedAt', a.joined_at, 'muted', coalesce(m.muted, false)) order by a.joined_at)
      from public.ha_live_attendance a left join public.ha_live_members m on m.class_id = a.class_id and m.code = a.code
      where a.class_id = k.id and a.left_at is null and a.last_seen > now() - interval '45 seconds'), '[]'::jsonb),
    'confused', (select count(distinct code) from public.ha_live_confusion where class_id = k.id and at > now() - interval '120 seconds'),
    'poll', case when pl.id is null then null else jsonb_build_object('id', pl.id, 'question', pl.question, 'options', pl.options, 'correct', pl.correct, 'status', pl.status,
        'counts', coalesce((select jsonb_object_agg(x.choice::text, x.n) from (select choice, count(*) n from public.ha_live_poll_answers where poll_id = pl.id group by choice) x), '{}'::jsonb)) end,
    'invites', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'token', i.token, 'label', i.label) order by i.created_at) from public.ha_live_invites i where i.class_id = k.id and i.status = 'active'), '[]'::jsonb));
end $$;

create or replace function public.ha_teacher_live_msg(p_id bigint, p_action text)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not public.ha_is_teacher() then raise exception 'FORBIDDEN'; end if;
  if p_action = 'delete' then update public.ha_live_messages set deleted = true, pinned = false where id = p_id;
  elsif p_action = 'pin' then
    update public.ha_live_messages set pinned = false where class_id = (select class_id from public.ha_live_messages where id = p_id) and pinned;
    update public.ha_live_messages set pinned = true where id = p_id;
  elsif p_action = 'unpin' then update public.ha_live_messages set pinned = false where id = p_id;
  elsif p_action = 'answered' then update public.ha_live_messages set answered = true where id = p_id;
  elsif p_action = 'important' then update public.ha_live_messages set important = not important where id = p_id;
  else return jsonb_build_object('ok', false, 'error', 'INVALID'); end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.ha_teacher_live_member(p_class uuid, p_code text, p_muted boolean, p_banned boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not public.ha_is_teacher() then raise exception 'FORBIDDEN'; end if;
  insert into public.ha_live_members (class_id, code, muted, banned) values (p_class, p_code, coalesce(p_muted, false), coalesce(p_banned, false))
    on conflict (class_id, code) do update set muted = excluded.muted, banned = excluded.banned;
  if coalesce(p_banned, false) then
    update public.ha_live_attendance set left_at = now(), last_seen = now() where class_id = p_class and code = p_code and left_at is null;
    update public.ha_live_hands set status = 'ended', updated_at = now() where class_id = p_class and code = p_code and status in ('pending','accepted');
  end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.ha_teacher_live_settings(p_class uuid, p_chat text, p_guests int, p_guest_screen boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not public.ha_is_teacher() then raise exception 'FORBIDDEN'; end if;
  if p_chat not in ('open','questions','off') then return jsonb_build_object('ok', false, 'error', 'INVALID'); end if;
  update public.ha_live_classes set chat_mode = p_chat, guests_max = least(greatest(coalesce(p_guests, 2), 0), 8), allow_guest_screen = coalesce(p_guest_screen, false), updated_at = now() where id = p_class;
  return jsonb_build_object('ok', true);
end $$;

-- accept / reject / end a raised hand. Accepting is limited by the guest cap.
create or replace function public.ha_teacher_live_hand(p_hand uuid, p_decision text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare h public.ha_live_hands; k public.ha_live_classes; n int;
begin
  if not public.ha_is_teacher() then raise exception 'FORBIDDEN'; end if;
  select * into h from public.ha_live_hands where id = p_hand for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); end if;
  select * into k from public.ha_live_classes where id = h.class_id;
  if p_decision = 'accept' then
    select count(*) into n from public.ha_live_hands where class_id = h.class_id and status = 'accepted';
    if n >= k.guests_max then return jsonb_build_object('ok', false, 'error', 'FULL'); end if;
    update public.ha_live_hands set status = 'accepted', updated_at = now() where id = h.id;
  elsif p_decision = 'reject' then update public.ha_live_hands set status = 'rejected', updated_at = now() where id = h.id;
  elsif p_decision = 'end' then update public.ha_live_hands set status = 'ended', updated_at = now() where id = h.id;
  else return jsonb_build_object('ok', false, 'error', 'INVALID'); end if;
  return jsonb_build_object('ok', true, 'code', h.code, 'classId', h.class_id, 'room', k.room_name);
end $$;

create or replace function public.ha_teacher_live_invite(p_class uuid, p_label text, p_revoke uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare i public.ha_live_invites;
begin
  if not public.ha_is_teacher() then raise exception 'FORBIDDEN'; end if;
  if p_revoke is not null then
    update public.ha_live_invites set status = 'revoked' where id = p_revoke;
    return jsonb_build_object('ok', true);
  end if;
  insert into public.ha_live_invites (class_id, label) values (p_class, left(coalesce(p_label, ''), 80)) returning * into i;
  return jsonb_build_object('ok', true, 'token', i.token, 'id', i.id);
end $$;

create or replace function public.ha_teacher_live_poll(p_class uuid, p_question text, p_options jsonb, p_correct int, p_close uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not public.ha_is_teacher() then raise exception 'FORBIDDEN'; end if;
  if p_close is not null then update public.ha_live_polls set status = 'closed' where id = p_close; return jsonb_build_object('ok', true); end if;
  if jsonb_typeof(p_options) <> 'array' or jsonb_array_length(p_options) not between 2 and 6 or coalesce(trim(p_question), '') = '' then return jsonb_build_object('ok', false, 'error', 'INVALID'); end if;
  update public.ha_live_polls set status = 'closed' where class_id = p_class and status = 'open';
  insert into public.ha_live_polls (class_id, question, options, correct) values (p_class, left(trim(p_question), 300), p_options, p_correct);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.ha_teacher_live_recording(p_class uuid, p_url text, p_until timestamptz, p_note text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare k public.ha_live_classes; was text;
begin
  if not public.ha_is_teacher() then raise exception 'FORBIDDEN'; end if;
  if coalesce(p_url, '') <> '' and p_url !~ '^https://' then return jsonb_build_object('ok', false, 'error', 'INVALID'); end if;
  select recording_url into was from public.ha_live_classes where id = p_class;
  update public.ha_live_classes set recording_url = coalesce(p_url, ''), recording_until = p_until, recording_note = left(coalesce(p_note, ''), 2000), updated_at = now() where id = p_class returning * into k;
  if coalesce(was, '') = '' and coalesce(p_url, '') <> '' then
    perform public.ha_live_notify(k.id, 'rec', 'تسجيل المحاضرة متاح الآن', k.title);
  end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.ha_teacher_live_attendance(p_class uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.ha_is_teacher() then raise exception 'FORBIDDEN'; end if;
  return coalesce((select jsonb_agg(row_to_json(x) order by x.first_join) from (
    select a.code, max(a.name) as name, max(a.role) as role, min(a.joined_at) as first_join, max(coalesce(a.left_at, a.last_seen)) as last_leave,
      round(sum(extract(epoch from (coalesce(a.left_at, a.last_seen) - a.joined_at))) / 60)::int as minutes, greatest(count(*) - 1, 0) as reconnects
    from public.ha_live_attendance a where a.class_id = p_class group by a.code) x), '[]'::jsonb);
end $$;

-- ---------- scheduled reminders (1 hour / 10 minutes before), called by the per-minute cron ----------
create or replace function public.ha_live_tick()
returns int language plpgsql security definer set search_path = '' as $$
declare k record; made int := 0;
begin
  for k in select * from public.ha_live_classes where status = 'scheduled' and scheduled_at > now() and scheduled_at <= now() + interval '61 minutes' loop
    if k.scheduled_at <= now() + interval '60 minutes' then
      made := made + public.ha_live_notify(k.id, 'h1', 'محاضرة مباشرة بعد ساعة', k.title);
    end if;
    if k.scheduled_at <= now() + interval '10 minutes' then
      made := made + public.ha_live_notify(k.id, 'm10', 'محاضرة مباشرة بعد 10 دقائق', k.title);
    end if;
  end loop;
  -- close attendance sessions that went silent
  update public.ha_live_attendance set left_at = last_seen where left_at is null and last_seen < now() - interval '2 minutes';
  return made;
end $$;

create or replace function public.ha_cron_minute()
returns void language plpgsql security definer set search_path = '' as $$
declare sec text;
begin
  perform public.ha_study_tick();
  perform public.ha_live_tick();
  if exists (select 1 from public.ha_user_notifications n where n.pushed_at is null and n.created_at > now() - interval '3 hours'
             and exists (select 1 from public.ha_push_subs s where s.code = n.code)) then
    select decrypted_secret into sec from vault.decrypted_secrets where name = 'ha_cron_secret';
    perform net.http_post(url := 'https://vmwfwyyrqbtwthakwqft.supabase.co/functions/v1/ha-push',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object('action', 'dispatch', 'secret', sec));
  else
    update public.ha_user_notifications set pushed_at = now() where pushed_at is null;
  end if;
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'ha_live_list(text,text)','ha_live_join(text,text,uuid)','ha_live_leave(text,text,uuid)','ha_live_state(text,text,uuid,bigint)','ha_live_send(text,text,uuid,text,text)',
    'ha_live_hand(text,text,uuid,boolean)','ha_live_confused(text,text,uuid)','ha_live_poll_answer(text,text,uuid,int)','ha_live_invite_join(text,text)','ha_live_invite_ping(text,boolean)'] loop
    execute format('revoke all on function public.%s from public', f);
    execute format('grant execute on function public.%s to anon, authenticated', f);
  end loop;
  foreach f in array array[
    'ha_live_teacher_join(uuid)','ha_teacher_live_save(uuid,text,text,text,text,uuid,text[],timestamptz,int,boolean)','ha_teacher_live_status(uuid,text)','ha_teacher_live_list()',
    'ha_teacher_live_state(uuid,bigint)','ha_teacher_live_msg(bigint,text)','ha_teacher_live_member(uuid,text,boolean,boolean)','ha_teacher_live_settings(uuid,text,int,boolean)',
    'ha_teacher_live_hand(uuid,text)','ha_teacher_live_invite(uuid,text,uuid)','ha_teacher_live_poll(uuid,text,jsonb,int,uuid)','ha_teacher_live_recording(uuid,text,timestamptz,text)',
    'ha_teacher_live_attendance(uuid)'] loop
    execute format('revoke all on function public.%s from public', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  foreach f in array array['ha_live_allowed(public.ha_codes,public.ha_live_classes)','ha_live_paid_ok(text,public.ha_live_classes)','ha_live_notify(uuid,text,text,text)','ha_live_tick()','ha_cron_minute()'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
end $$;
