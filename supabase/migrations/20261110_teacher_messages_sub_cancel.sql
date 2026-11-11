-- Teacher: cancel/delete any subscription (student is notified) + send messages into students' notification inbox.

create table if not exists public.ha_teacher_messages (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  target text not null,
  sent_count int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.ha_teacher_messages enable row level security;
drop policy if exists teacher_all on public.ha_teacher_messages;
create policy teacher_all on public.ha_teacher_messages for all to authenticated using (public.ha_is_teacher()) with check (public.ha_is_teacher());

create or replace function public.ha_teacher_sub_set_status(p_id uuid, p_status text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare s public.ha_subscriptions; pn text;
begin
  if not public.ha_is_teacher() then raise exception 'FORBIDDEN'; end if;
  if p_status not in ('active','paused','cancelled') then return jsonb_build_object('ok', false, 'error', 'INVALID'); end if;
  update public.ha_subscriptions set status = p_status, updated_at = now() where id = p_id returning * into s;
  if not found then return jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); end if;
  select name into pn from public.ha_plans where id = s.plan_id;
  insert into public.ha_subscription_log (code, subscription_id, action, details, actor)
    values (s.code, s.id, 'status_' || p_status, jsonb_build_object('plan', pn), 'teacher');
  insert into public.ha_user_notifications (code, kind, title, body, dedupe_key)
    values (s.code, 'sub',
      case p_status when 'cancelled' then 'تم إلغاء اشتراكك' when 'paused' then 'تم إيقاف اشتراكك مؤقتاً' else 'تم استئناف اشتراكك' end,
      coalesce(pn, 'اشتراك') || case p_status when 'cancelled' then ' — للاستفسار تواصل مع المدرس' when 'paused' then ' — للاستفسار تواصل مع المدرس' else ' — تقدر تكمل مذاكرتك' end,
      'sub|' || s.id::text || '|' || p_status || '|' || extract(epoch from clock_timestamp())::text);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.ha_teacher_sub_delete(p_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare s public.ha_subscriptions; pn text;
begin
  if not public.ha_is_teacher() then raise exception 'FORBIDDEN'; end if;
  select * into s from public.ha_subscriptions where id = p_id;
  if not found then return jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); end if;
  select name into pn from public.ha_plans where id = s.plan_id;
  delete from public.ha_subscriptions where id = p_id;
  insert into public.ha_subscription_log (code, subscription_id, action, details, actor)
    values (s.code, null, 'status_cancelled', jsonb_build_object('plan', pn, 'deleted', true), 'teacher');
  return jsonb_build_object('ok', true);
exception when foreign_key_violation then
  update public.ha_subscriptions set status = 'cancelled', ends_at = least(ends_at, now()), updated_at = now() where id = p_id;
  return jsonb_build_object('ok', true, 'softened', true);
end $$;

-- p_target: 'all' | grade ('1ث','2ث','3ث') | 'code:<STUDENT CODE>'
create or replace function public.ha_teacher_send_message(p_title text, p_body text, p_target text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare n int; mid uuid := gen_random_uuid(); t text := trim(coalesce(p_target, 'all')); ti text := left(trim(coalesce(p_title, '')), 120); bo text := left(trim(coalesce(p_body, '')), 600);
begin
  if not public.ha_is_teacher() then raise exception 'FORBIDDEN'; end if;
  if ti = '' or bo = '' then return jsonb_build_object('ok', false, 'error', 'EMPTY'); end if;
  insert into public.ha_user_notifications (code, kind, title, body, dedupe_key)
    select c.code, 'teacher', ti, bo, 'msg|' || mid::text || '|' || c.code
    from public.ha_codes c
    where c.active and (c.used_at is not null or exists (select 1 from public.ha_accounts a where a.code = c.code))
      and (t = 'all'
        or (t like 'code:%' and c.code = upper(trim(substr(t, 6))))
        or (t in ('1ث','2ث','3ث') and (c.grade = t or c.grade = 'جميع الصفوف')));
  get diagnostics n = row_count;
  insert into public.ha_teacher_messages (id, title, body, target, sent_count) values (mid, ti, bo, t, n);
  return jsonb_build_object('ok', true, 'sent', n);
end $$;

do $$
declare f text;
begin
  foreach f in array array['ha_teacher_sub_set_status(uuid,text)','ha_teacher_sub_delete(uuid)','ha_teacher_send_message(text,text,text)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
