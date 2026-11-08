create or replace function public.ha_public_plans()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'price', p.price, 'durationDays', p.duration_days,
      'grade', p.grade, 'includesAi', p.includes_ai, 'lessonCount', cardinality(p.lesson_ids), 'examCount', cardinality(p.exam_ids)) order by p.price, p.created_at), '[]'::jsonb)
  from public.ha_plans p where p.active;
$$;
revoke all on function public.ha_public_plans() from public;
grant execute on function public.ha_public_plans() to anon, authenticated;
