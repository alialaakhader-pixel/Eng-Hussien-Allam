-- Stage 3 / System 3: photos in the AI tutor. Applied to the project as migration "stage3_ai_images".
-- Private bucket `ha-ai-images` (no storage policies => service role only), ha_ai_messages (RLS, no policies => owner reads via ha_ai_history),
-- ha_ai_gate2 (subscription + rate limit + 15 images/day), ha_ai_log_service (service role only).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ha-ai-images', 'ha-ai-images', false, 3145728, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = 3145728, allowed_mime_types = array['image/jpeg','image/png','image/webp'];

create table if not exists public.ha_ai_messages (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  role text not null check (role in ('user','assistant')),
  content text not null,
  image_paths text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists ha_ai_messages_code on public.ha_ai_messages (code, created_at desc);
alter table public.ha_ai_messages enable row level security;

create or replace function public.ha_ai_gate2(p_code text, p_device text, p_images int)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare c public.ha_codes; used int;
begin
  c := public.ha_resolve(p_code, p_device);
  if c.code is null then return jsonb_build_object('ok', false, 'error', 'UNAUTHORIZED'); end if;
  if coalesce(p_images, 0) > 3 or coalesce(p_images, 0) < 0 then return jsonb_build_object('ok', false, 'error', 'TOO_MANY_IMAGES'); end if;
  if coalesce(p_images, 0) > 0 then
    select coalesce(sum(cardinality(image_paths)), 0) into used from public.ha_ai_messages
      where code = c.code and role = 'user' and (created_at at time zone 'Africa/Cairo')::date = (now() at time zone 'Africa/Cairo')::date;
    if used + p_images > 15 then return jsonb_build_object('ok', false, 'error', 'IMAGE_LIMIT'); end if;
  end if;
  return public.ha_ai_gate(p_code, p_device);
end $$;

create or replace function public.ha_ai_log_service(p_code text, p_question text, p_answer text, p_paths text[])
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.ha_ai_messages (code, role, content, image_paths, created_at)
    values (p_code, 'user', left(p_question, 2500), coalesce(p_paths, '{}'), now() - interval '1 millisecond'),
           (p_code, 'assistant', left(p_answer, 12000), '{}', now());
end $$;

create or replace function public.ha_ai_history(p_code text, p_device text, p_limit int)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare c public.ha_codes;
begin
  c := public.ha_resolve(p_code, p_device);
  if c.code is null then return jsonb_build_object('ok', false, 'error', 'UNAUTHORIZED'); end if;
  return jsonb_build_object('ok', true, 'messages', coalesce((
    select jsonb_agg(jsonb_build_object('role', m.role, 'content', m.content, 'imageCount', cardinality(m.image_paths), 'createdAt', m.created_at) order by m.created_at)
    from (select * from public.ha_ai_messages where code = c.code order by created_at desc limit least(greatest(coalesce(p_limit, 20), 1), 60)) m), '[]'::jsonb));
end $$;

revoke all on function public.ha_ai_gate2(text, text, int) from public;
revoke all on function public.ha_ai_log_service(text, text, text, text[]) from public, anon, authenticated;
revoke all on function public.ha_ai_history(text, text, int) from public;
grant execute on function public.ha_ai_gate2(text, text, int) to anon, authenticated;
grant execute on function public.ha_ai_history(text, text, int) to anon, authenticated;
grant execute on function public.ha_ai_log_service(text, text, text, text[]) to service_role;
