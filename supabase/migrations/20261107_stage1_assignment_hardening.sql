-- Assignment hardening: no empty answers, no late submissions, no edits after grading; grade range 0..100.
create or replace function public.ha_assignment_submit(p_code text, p_device text, p_assignment uuid, p_answer text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare c public.ha_codes; a public.ha_assignments; s public.ha_assignment_submissions;
begin
  c := public.ha_resolve(p_code, p_device);
  if c.code is null then return jsonb_build_object('ok', false, 'error', 'UNAUTHORIZED'); end if;
  select * into a from public.ha_assignments
    where id = p_assignment and published and (grade = 'جميع الصفوف' or grade = c.grade);
  if not found then return jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); end if;
  if char_length(trim(coalesce(p_answer, ''))) = 0 then return jsonb_build_object('ok', false, 'error', 'EMPTY'); end if;
  if char_length(p_answer) > 12000 then return jsonb_build_object('ok', false, 'error', 'TOO_LARGE'); end if;
  if a.due_at is not null and a.due_at < now() then return jsonb_build_object('ok', false, 'error', 'DUE_PASSED'); end if;
  select * into s from public.ha_assignment_submissions where assignment_id = a.id and code = c.code for update;
  if found and s.grade is not null then return jsonb_build_object('ok', false, 'error', 'ALREADY_GRADED'); end if;
  insert into public.ha_assignment_submissions (assignment_id, code, answer)
    values (a.id, c.code, p_answer)
    on conflict (assignment_id, code) do update set answer = excluded.answer, submitted_at = now(), feedback = null;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.ha_teacher_assignment_grade(p_submission uuid, p_grade numeric, p_feedback text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not public.ha_is_teacher() then return jsonb_build_object('ok', false, 'error', 'UNAUTHORIZED'); end if;
  if p_grade is not null and (p_grade < 0 or p_grade > 100) then return jsonb_build_object('ok', false, 'error', 'BAD_GRADE'); end if;
  update public.ha_assignment_submissions set grade = p_grade, feedback = left(coalesce(p_feedback, ''), 3000) where id = p_submission;
  return jsonb_build_object('ok', found);
end $$;
