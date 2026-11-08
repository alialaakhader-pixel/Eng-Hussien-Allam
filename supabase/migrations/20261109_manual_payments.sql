-- Manual bank/wallet transfer payments (Vodafone Cash / InstaPay): student uploads a receipt, teacher approves, subscription activates.
create table if not exists public.ha_payment_settings (
  id int primary key default 1 check (id = 1),
  vodafone_cash text not null default '',
  instapay text not null default '',
  instructions text not null default '',
  updated_at timestamptz not null default now()
);
insert into public.ha_payment_settings (id) values (1) on conflict do nothing;

create table if not exists public.ha_payments (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  plan_id uuid not null references public.ha_plans(id) on delete restrict,
  amount numeric(10,2) not null check (amount >= 0),
  method text not null check (method in ('vodafone_cash','instapay')),
  sender_ref text not null default '' check (length(sender_ref) <= 120),
  receipt_data text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reject_reason text not null default '',
  subscription_id uuid,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create index if not exists ha_payments_code on public.ha_payments (code, created_at desc);
create index if not exists ha_payments_status on public.ha_payments (status, created_at desc);

alter table public.ha_payment_settings enable row level security;
alter table public.ha_payments enable row level security;
do $$
declare t text;
begin
  foreach t in array array['ha_payment_settings','ha_payments'] loop
    execute format('drop policy if exists teacher_all on public.%I', t);
    execute format('create policy teacher_all on public.%I for all to authenticated using (public.ha_is_teacher()) with check (public.ha_is_teacher())', t);
  end loop;
end $$;

create or replace function public.ha_pay_info()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('vodafoneCash', vodafone_cash, 'instapay', instapay, 'instructions', instructions) from public.ha_payment_settings where id = 1;
$$;

create or replace function public.ha_pay_create(p_code text, p_device text, p_plan uuid, p_method text, p_ref text, p_receipt text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare c public.ha_codes; pl public.ha_plans; rid uuid;
begin
  c := public.ha_resolve(p_code, p_device);
  if c.code is null then return jsonb_build_object('ok', false, 'error', 'UNAUTHORIZED'); end if;
  select * into pl from public.ha_plans where id = p_plan and active;
  if not found then return jsonb_build_object('ok', false, 'error', 'PLAN_UNAVAILABLE'); end if;
  if pl.grade is not null and c.grade <> 'جميع الصفوف' and pl.grade <> c.grade then return jsonb_build_object('ok', false, 'error', 'WRONG_GRADE'); end if;
  if p_method not in ('vodafone_cash','instapay') then return jsonb_build_object('ok', false, 'error', 'INVALID'); end if;
  if coalesce(p_receipt, '') !~ '^data:image/(jpeg|png|webp);base64,' or length(p_receipt) > 450000 then return jsonb_build_object('ok', false, 'error', 'INVALID_IMAGE'); end if;
  if exists (select 1 from public.ha_payments where code = c.code and plan_id = pl.id and status = 'pending') then return jsonb_build_object('ok', false, 'error', 'PENDING_EXISTS'); end if;
  if (select count(*) from public.ha_payments where code = c.code and created_at > now() - interval '1 day') >= 5 then return jsonb_build_object('ok', false, 'error', 'TOO_MANY'); end if;
  insert into public.ha_payments (code, plan_id, amount, method, sender_ref, receipt_data)
    values (c.code, pl.id, pl.price, p_method, left(trim(coalesce(p_ref, '')), 120), p_receipt) returning id into rid;
  insert into public.ha_subscription_log (code, action, details, actor) values (c.code, 'payment_submitted', jsonb_build_object('plan', pl.name, 'amount', pl.price, 'method', p_method), c.code);
  return jsonb_build_object('ok', true, 'id', rid);
end $$;

create or replace function public.ha_pay_mine(p_code text, p_device text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare c public.ha_codes;
begin
  c := public.ha_resolve(p_code, p_device);
  if c.code is null then return jsonb_build_object('ok', false, 'error', 'UNAUTHORIZED'); end if;
  return jsonb_build_object('ok', true, 'payments', coalesce((select jsonb_agg(jsonb_build_object('id', y.id, 'planId', y.plan_id, 'plan', p.name, 'amount', y.amount,
      'method', y.method, 'status', y.status, 'reason', y.reject_reason, 'createdAt', y.created_at) order by y.created_at desc)
    from (select * from public.ha_payments where code = c.code order by created_at desc limit 30) y join public.ha_plans p on p.id = y.plan_id), '[]'::jsonb));
end $$;

create or replace function public.ha_teacher_pay_list()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.ha_is_teacher() then raise exception 'FORBIDDEN'; end if;
  return jsonb_build_object(
    'settings', (select jsonb_build_object('vodafoneCash', vodafone_cash, 'instapay', instapay, 'instructions', instructions) from public.ha_payment_settings where id = 1),
    'payments', coalesce((select jsonb_agg(row_to_json(x) order by x.created_at desc) from (
      select y.id, y.code, coalesce(a.name, c.student_name, y.code) as student, p.name as plan, y.amount, y.method, y.sender_ref, y.status, y.reject_reason, y.created_at, y.reviewed_at
      from public.ha_payments y join public.ha_plans p on p.id = y.plan_id
      left join public.ha_codes c on c.code = y.code left join public.ha_accounts a on a.code = y.code
      order by (y.status = 'pending') desc, y.created_at desc limit 300) x), '[]'::jsonb));
end $$;

create or replace function public.ha_teacher_pay_receipt(p_id uuid)
returns text language plpgsql stable security definer set search_path = '' as $$
declare r text;
begin
  if not public.ha_is_teacher() then raise exception 'FORBIDDEN'; end if;
  select receipt_data into r from public.ha_payments where id = p_id;
  return r;
end $$;

create or replace function public.ha_teacher_pay_review(p_id uuid, p_approve boolean, p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare y public.ha_payments; pl public.ha_plans; cur public.ha_subscriptions; sid uuid; en timestamptz;
begin
  if not public.ha_is_teacher() then raise exception 'FORBIDDEN'; end if;
  select * into y from public.ha_payments where id = p_id for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); end if;
  if y.status <> 'pending' then return jsonb_build_object('ok', false, 'error', 'ALREADY_REVIEWED'); end if;
  select * into pl from public.ha_plans where id = y.plan_id;
  if p_approve then
    select * into cur from public.ha_subscriptions where code = y.code and plan_id = pl.id and status = 'active' and ends_at > now() order by ends_at desc limit 1 for update;
    if found then
      en := cur.ends_at + make_interval(days => pl.duration_days);
      update public.ha_subscriptions set ends_at = en, updated_at = now() where id = cur.id; sid := cur.id;
    else
      en := now() + make_interval(days => pl.duration_days);
      insert into public.ha_subscriptions (code, plan_id, starts_at, ends_at, source) values (y.code, pl.id, now(), en, 'teacher') returning id into sid;
    end if;
    update public.ha_payments set status = 'approved', subscription_id = sid, reviewed_at = now() where id = y.id;
    insert into public.ha_subscription_log (code, subscription_id, action, details, actor)
      values (y.code, sid, case when cur.id is not null then 'renewed' else 'granted' end, jsonb_build_object('plan', pl.name, 'endsAt', en, 'via', 'payment', 'amount', y.amount), 'teacher');
    insert into public.ha_user_notifications (code, kind, title, body, dedupe_key)
      values (y.code, 'payment', 'تم قبول دفعتك ✅', 'تم تفعيل اشتراكك في «' || pl.name || '». استمتع بالمحتوى!', 'pay|' || y.id::text || '|approved') on conflict (dedupe_key) do nothing;
  else
    update public.ha_payments set status = 'rejected', reject_reason = left(coalesce(p_reason, ''), 300), reviewed_at = now() where id = y.id;
    insert into public.ha_subscription_log (code, action, details, actor) values (y.code, 'payment_rejected', jsonb_build_object('plan', pl.name, 'reason', left(coalesce(p_reason, ''), 300)), 'teacher');
    insert into public.ha_user_notifications (code, kind, title, body, dedupe_key)
      values (y.code, 'payment', 'تعذر قبول دفعتك', 'طلب اشتراكك في «' || pl.name || '» لم يُقبل' || case when coalesce(p_reason, '') <> '' then ': ' || left(p_reason, 300) else '' end || '. تواصل مع المدرس.', 'pay|' || y.id::text || '|rejected') on conflict (dedupe_key) do nothing;
  end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.ha_teacher_pay_settings_save(p_vodafone text, p_instapay text, p_instructions text)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not public.ha_is_teacher() then raise exception 'FORBIDDEN'; end if;
  update public.ha_payment_settings set vodafone_cash = left(trim(coalesce(p_vodafone, '')), 40), instapay = left(trim(coalesce(p_instapay, '')), 80),
    instructions = left(trim(coalesce(p_instructions, '')), 600), updated_at = now() where id = 1;
  return jsonb_build_object('ok', true);
end $$;

do $$
declare f text;
begin
  foreach f in array array['ha_pay_info()','ha_pay_create(text,text,uuid,text,text,text)','ha_pay_mine(text,text)','ha_teacher_pay_list()','ha_teacher_pay_receipt(uuid)','ha_teacher_pay_review(uuid,boolean,text)','ha_teacher_pay_settings_save(text,text,text)'] loop
    execute format('revoke all on function public.%s from public', f);
  end loop;
end $$;
grant execute on function public.ha_pay_info() to anon, authenticated;
grant execute on function public.ha_pay_create(text, text, uuid, text, text, text) to anon, authenticated;
grant execute on function public.ha_pay_mine(text, text) to anon, authenticated;
grant execute on function public.ha_teacher_pay_list() to authenticated;
grant execute on function public.ha_teacher_pay_receipt(uuid) to authenticated;
grant execute on function public.ha_teacher_pay_review(uuid, boolean, text) to authenticated;
grant execute on function public.ha_teacher_pay_settings_save(text, text, text) to authenticated;
