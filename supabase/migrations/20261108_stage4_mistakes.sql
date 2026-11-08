-- Stage 4 / System 4: "كل الأخطاء" (mistakes notebook) + exams built from mistakes.
-- Exam/quiz/assignment mistakes are derived on the SERVER from real results (a student cannot forge them);
-- grading of mistake-exams is server-side against the stored correct answers.

create table if not exists public.ha_mistakes (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  source text not null check (source in ('exam','quiz','assignment','ai','manual')),
  source_ref text,
  dedupe_key text,
  question text not null check (length(question) between 1 and 3000),
  options jsonb not null default '[]'::jsonb,
  correct_index int,
  student_index int,
  student_answer text,
  correct_answer text,
  explanation text,
  reason text,
  chapter text,
  lesson_id text,
  lesson_title text,
  image_data text check (image_data is null or length(image_data) <= 450000),
  status text not null default 'new' check (status in ('new','reviewed','mastered','archived')),
  review_set boolean not null default false,
  note text,
  times_wrong int not null default 1,
  last_wrong_at timestamptz not null default now(),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists ha_mistakes_dedupe on public.ha_mistakes (code, dedupe_key) where dedupe_key is not null;
create index if not exists ha_mistakes_code_status on public.ha_mistakes (code, status);

create table if not exists public.ha_mistake_exams (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  items jsonb not null,
  duration_min int not null default 0 check (duration_min between 0 and 300),
  config jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  score int,
  total int,
  late boolean not null default false,
  result jsonb,
  created_at timestamptz not null default now()
);
create index if not exists ha_mistake_exams_code on public.ha_mistake_exams (code, created_at desc);

alter table public.ha_mistakes enable row level security;
alter table public.ha_mistake_exams enable row level security;
do $$
declare t text;
begin
  foreach t in array array['ha_mistakes','ha_mistake_exams'] loop
    execute format('drop policy if exists teacher_all on public.%I', t);
    execute format('create policy teacher_all on public.%I for all to authenticated using (public.ha_is_teacher()) with check (public.ha_is_teacher())', t);
  end loop;
end $$;

-- Derive mistakes from the student's real exam results and graded assignments (idempotent).
create or replace function public.ha_mistakes_sync(p_code text, p_device text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare c public.ha_codes; a1 int; a2 int;
begin
  c := public.ha_resolve(p_code, p_device);
  if c.code is null then return jsonb_build_object('ok', false, 'error', 'UNAUTHORIZED'); end if;
  insert into public.ha_mistakes (code, source, source_ref, dedupe_key, question, options, correct_index, student_index, student_answer, correct_answer, explanation, lesson_title, last_wrong_at, created_at)
  select c.code, 'exam', e.id, 'exam|' || r.id::text || '|' || t.ord::text,
         left(t.q ->> 'question', 3000), coalesce(t.q -> 'options', '[]'::jsonb), (t.q ->> 'correctIndex')::int,
         case when (r.answers ->> (t.ord::int - 1)) ~ '^[0-9]+$' then (r.answers ->> (t.ord::int - 1))::int end,
         case when (r.answers ->> (t.ord::int - 1)) ~ '^[0-9]+$' then t.q -> 'options' ->> (r.answers ->> (t.ord::int - 1))::int else 'لم تُجب' end,
         t.q -> 'options' ->> (t.q ->> 'correctIndex')::int, nullif(t.q ->> 'explanation', ''), e.title, r.created_at, r.created_at
  from public.ha_exam_results r
  join public.ha_exams e on e.id = r.exam_id
  cross join lateral jsonb_array_elements(e.questions) with ordinality as t(q, ord)
  where r.code = c.code and (t.q ->> 'correctIndex') ~ '^[0-9]+$' and coalesce(t.q ->> 'question', '') <> ''
    and ((r.answers ->> (t.ord::int - 1)) is null or not ((r.answers ->> (t.ord::int - 1)) ~ '^[0-9]+$')
         or (r.answers ->> (t.ord::int - 1))::int <> (t.q ->> 'correctIndex')::int)
  on conflict do nothing;
  get diagnostics a1 = row_count;
  insert into public.ha_mistakes (code, source, source_ref, dedupe_key, question, student_answer, explanation, lesson_title, last_wrong_at, created_at)
  select c.code, 'assignment', s.assignment_id::text, 'asg|' || s.id::text,
         left(a.title || coalesce(E'\n' || a.body, ''), 3000), left(s.answer, 3000), left(s.feedback, 3000), a.title, s.submitted_at, s.submitted_at
  from public.ha_assignment_submissions s join public.ha_assignments a on a.id = s.assignment_id
  where s.code = c.code and s.grade is not null and s.grade < 60
  on conflict do nothing;
  get diagnostics a2 = row_count;
  return jsonb_build_object('ok', true, 'added', a1 + a2);
end $$;

create or replace function public.ha_mistakes_list(p_code text, p_device text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare c public.ha_codes;
begin
  c := public.ha_resolve(p_code, p_device);
  if c.code is null then return jsonb_build_object('ok', false, 'error', 'UNAUTHORIZED'); end if;
  return jsonb_build_object('ok', true, 'items', coalesce((
    select jsonb_agg(jsonb_build_object('id', m.id, 'source', m.source, 'question', m.question, 'options', m.options, 'correctIndex', m.correct_index,
        'studentIndex', m.student_index, 'studentAnswer', m.student_answer, 'correctAnswer', m.correct_answer, 'explanation', m.explanation,
        'reason', m.reason, 'chapter', m.chapter, 'lessonId', m.lesson_id, 'lessonTitle', m.lesson_title, 'hasImage', m.image_data is not null,
        'status', m.status, 'reviewSet', m.review_set, 'note', m.note, 'timesWrong', m.times_wrong, 'createdAt', m.created_at, 'lastWrongAt', m.last_wrong_at,
        'reviewedAt', m.reviewed_at) order by m.last_wrong_at desc)
    from (select * from public.ha_mistakes where code = c.code order by last_wrong_at desc limit 600) m), '[]'::jsonb));
end $$;

create or replace function public.ha_mistake_add(p_code text, p_device text, p_m jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare c public.ha_codes; rid uuid; n int; q text := trim(coalesce(p_m ->> 'question', ''));
  opts jsonb := case when jsonb_typeof(p_m -> 'options') = 'array' then p_m -> 'options' else '[]'::jsonb end;
  ci int := case when (p_m ->> 'correctIndex') ~ '^[0-9]+$' then (p_m ->> 'correctIndex')::int end;
  si int := case when (p_m ->> 'studentIndex') ~ '^[0-9]+$' then (p_m ->> 'studentIndex')::int end;
  src text := case when p_m ->> 'source' = 'ai' then 'ai' else 'manual' end;
  img text := nullif(p_m ->> 'imageData', '');
begin
  c := public.ha_resolve(p_code, p_device);
  if c.code is null then return jsonb_build_object('ok', false, 'error', 'UNAUTHORIZED'); end if;
  if q = '' or length(q) > 3000 then return jsonb_build_object('ok', false, 'error', 'INVALID'); end if;
  if jsonb_array_length(opts) > 6 or (jsonb_array_length(opts) > 0 and jsonb_array_length(opts) < 2)
     or (ci is not null and (ci >= jsonb_array_length(opts))) or (si is not null and si >= jsonb_array_length(opts)) then
    return jsonb_build_object('ok', false, 'error', 'INVALID');
  end if;
  if img is not null and (img !~ '^data:image/(jpeg|png|webp);base64,' or length(img) > 450000) then return jsonb_build_object('ok', false, 'error', 'INVALID_IMAGE'); end if;
  select count(*) into n from public.ha_mistakes where code = c.code;
  if n >= 600 then return jsonb_build_object('ok', false, 'error', 'LIMIT'); end if;
  insert into public.ha_mistakes (code, source, question, options, correct_index, student_index, student_answer, correct_answer, explanation, reason, chapter, lesson_id, lesson_title, image_data, note)
    values (c.code, src, q, opts, ci, si, left(coalesce(p_m ->> 'studentAnswer', ''), 3000), left(coalesce(p_m ->> 'correctAnswer', ''), 3000),
            left(coalesce(p_m ->> 'explanation', ''), 6000), left(coalesce(p_m ->> 'reason', ''), 300), left(coalesce(p_m ->> 'chapter', ''), 120),
            nullif(left(coalesce(p_m ->> 'lessonId', ''), 80), ''), left(coalesce(p_m ->> 'lessonTitle', ''), 160), img, left(coalesce(p_m ->> 'note', ''), 1000))
    returning id into rid;
  return jsonb_build_object('ok', true, 'id', rid);
end $$;

create or replace function public.ha_mistake_update(p_code text, p_device text, p_id uuid, p_patch jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare c public.ha_codes; st text := p_patch ->> 'status'; rid uuid;
begin
  c := public.ha_resolve(p_code, p_device);
  if c.code is null then return jsonb_build_object('ok', false, 'error', 'UNAUTHORIZED'); end if;
  if st is not null and st not in ('new','reviewed','mastered','archived') then return jsonb_build_object('ok', false, 'error', 'INVALID'); end if;
  update public.ha_mistakes set
      status = coalesce(st, status),
      reviewed_at = case when st in ('reviewed','mastered') then now() else reviewed_at end,
      note = case when p_patch ? 'note' then left(coalesce(p_patch ->> 'note', ''), 1000) else note end,
      reason = case when p_patch ? 'reason' then left(coalesce(p_patch ->> 'reason', ''), 300) else reason end,
      review_set = case when p_patch ? 'reviewSet' then coalesce((p_patch ->> 'reviewSet')::boolean, false) else review_set end,
      updated_at = now()
    where id = p_id and code = c.code returning id into rid;
  if rid is null then return jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.ha_mistake_delete(p_code text, p_device text, p_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare c public.ha_codes;
begin
  c := public.ha_resolve(p_code, p_device);
  if c.code is null then return jsonb_build_object('ok', false, 'error', 'UNAUTHORIZED'); end if;
  delete from public.ha_mistakes where id = p_id and code = c.code;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.ha_mistake_image(p_code text, p_device text, p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare c public.ha_codes; img text;
begin
  c := public.ha_resolve(p_code, p_device);
  if c.code is null then return jsonb_build_object('ok', false, 'error', 'UNAUTHORIZED'); end if;
  select image_data into img from public.ha_mistakes where id = p_id and code = c.code;
  return jsonb_build_object('ok', true, 'image', img);
end $$;

-- A wrong answer in a lesson's quick quiz: the server re-checks it against the lesson's own quiz data.
create or replace function public.ha_mistake_quiz_report(p_code text, p_device text, p_lesson text, p_qid text, p_chosen int)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare c public.ha_codes; l public.ha_lessons; q jsonb; ci int;
begin
  c := public.ha_resolve(p_code, p_device);
  if c.code is null then return jsonb_build_object('ok', false, 'error', 'UNAUTHORIZED'); end if;
  select * into l from public.ha_lessons where id = p_lesson and (c.grade = 'جميع الصفوف' or grade = c.grade);
  if not found or not public.ha_has_access(c.code, 'lesson', l.id) then return jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); end if;
  select x into q from jsonb_array_elements(coalesce(l.data -> 'quiz', '[]'::jsonb)) x where x ->> 'id' = p_qid limit 1;
  if q is null or (q ->> 'correctIndex') !~ '^[0-9]+$' then return jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); end if;
  ci := (q ->> 'correctIndex')::int;
  if p_chosen is not distinct from ci then return jsonb_build_object('ok', true, 'recorded', false); end if;
  insert into public.ha_mistakes (code, source, source_ref, dedupe_key, question, options, correct_index, student_index, student_answer, correct_answer, explanation, chapter, lesson_id, lesson_title)
    values (c.code, 'quiz', l.id, 'quiz|' || l.id || '|' || p_qid, left(q ->> 'question', 3000), coalesce(q -> 'options', '[]'::jsonb), ci, p_chosen,
            case when p_chosen is not null and p_chosen >= 0 then q -> 'options' ->> p_chosen else 'لم تُجب' end, q -> 'options' ->> ci,
            nullif(q ->> 'explanation', ''), left(coalesce(l.data ->> 'chapter', ''), 120), l.id, left(coalesce(l.data ->> 'title', ''), 160))
    on conflict (code, dedupe_key) where dedupe_key is not null do update
      set times_wrong = public.ha_mistakes.times_wrong + 1, last_wrong_at = now(), student_index = excluded.student_index, student_answer = excluded.student_answer,
          status = case when public.ha_mistakes.status in ('mastered','reviewed') then 'new' else public.ha_mistakes.status end, updated_at = now();
  return jsonb_build_object('ok', true, 'recorded', true);
end $$;

-- Build an exam from the student's own mistakes (only multiple-choice mistakes can be auto-graded).
create or replace function public.ha_mistake_exam_start(p_code text, p_device text, p_ids uuid[], p_count int, p_difficulty text, p_order text, p_minutes int)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare c public.ha_codes; items jsonb; eid uuid; n int := least(greatest(coalesce(p_count, 10), 1), 50); mins int := least(greatest(coalesce(p_minutes, 0), 0), 300);
begin
  c := public.ha_resolve(p_code, p_device);
  if c.code is null then return jsonb_build_object('ok', false, 'error', 'UNAUTHORIZED'); end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'question', s.question, 'options', s.options, 'hasImage', s.image_data is not null, 'lesson', s.lesson_title)), '[]'::jsonb) into items
  from (
    select m.* from public.ha_mistakes m
    where m.code = c.code and m.status <> 'archived' and (p_ids is null and m.status <> 'mastered' or m.id = any(p_ids))
      and jsonb_typeof(m.options) = 'array' and jsonb_array_length(m.options) >= 2 and m.correct_index is not null and m.correct_index < jsonb_array_length(m.options)
      and case coalesce(p_difficulty, 'all') when 'easy' then m.times_wrong = 1 when 'medium' then m.times_wrong = 2 when 'hard' then m.times_wrong >= 3 else true end
    order by case when p_order = 'lesson' then coalesce(m.lesson_title, 'zzz') end, case when p_order = 'lesson' then m.created_at end, case when coalesce(p_order, 'random') <> 'lesson' then random() end
    limit n) s;
  if jsonb_array_length(items) = 0 then return jsonb_build_object('ok', false, 'error', 'NO_ELIGIBLE'); end if;
  insert into public.ha_mistake_exams (code, items, duration_min, config)
    values (c.code, items, mins, jsonb_build_object('count', n, 'difficulty', coalesce(p_difficulty, 'all'), 'order', coalesce(p_order, 'random'))) returning id into eid;
  return jsonb_build_object('ok', true, 'id', eid, 'durationMin', mins, 'items', items);
end $$;

create or replace function public.ha_mistake_exam_submit(p_code text, p_device text, p_exam uuid, p_answers jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare c public.ha_codes; e public.ha_mistake_exams; it jsonb; ord int; m public.ha_mistakes; chosen int; ok boolean; s int := 0; t int := 0; res jsonb := '[]'::jsonb; isl boolean; ans jsonb;
begin
  c := public.ha_resolve(p_code, p_device);
  if c.code is null then return jsonb_build_object('ok', false, 'error', 'UNAUTHORIZED'); end if;
  select * into e from public.ha_mistake_exams where id = p_exam and code = c.code for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); end if;
  if e.submitted_at is not null then return jsonb_build_object('ok', false, 'error', 'ALREADY_SUBMITTED'); end if;
  ans := case when jsonb_typeof(p_answers) = 'array' then p_answers else '[]'::jsonb end;
  isl := e.duration_min > 0 and now() > e.started_at + make_interval(mins => e.duration_min) + interval '60 seconds';
  for it, ord in select x, (n - 1)::int from jsonb_array_elements(e.items) with ordinality as z(x, n) loop
    select * into m from public.ha_mistakes where id = (it ->> 'id')::uuid and code = c.code;
    if not found then continue; end if;
    t := t + 1;
    chosen := case when (ans ->> ord) ~ '^[0-9]+$' then (ans ->> ord)::int end;
    ok := chosen is not null and chosen = m.correct_index;
    if ok then
      s := s + 1;
      update public.ha_mistakes set status = 'mastered', reviewed_at = now(), updated_at = now() where id = m.id;
    else
      update public.ha_mistakes set times_wrong = times_wrong + 1, last_wrong_at = now(),
          status = case when status in ('mastered','reviewed') then 'new' else status end, updated_at = now() where id = m.id;
    end if;
    res := res || jsonb_build_object('id', m.id, 'question', m.question, 'options', m.options, 'chosenIndex', chosen, 'correctIndex', m.correct_index, 'correct', ok,
      'explanation', m.explanation, 'repeated', not ok, 'timesWrong', case when ok then m.times_wrong else m.times_wrong + 1 end, 'lesson', m.lesson_title);
  end loop;
  update public.ha_mistake_exams set submitted_at = now(), score = s, total = t, late = isl, result = res where id = e.id;
  return jsonb_build_object('ok', true, 'score', s, 'total', t, 'late', isl, 'items', res);
end $$;

create or replace function public.ha_mistake_exams_list(p_code text, p_device text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare c public.ha_codes;
begin
  c := public.ha_resolve(p_code, p_device);
  if c.code is null then return jsonb_build_object('ok', false, 'error', 'UNAUTHORIZED'); end if;
  return jsonb_build_object('ok', true, 'items', coalesce((
    select jsonb_agg(jsonb_build_object('id', x.id, 'score', x.score, 'total', x.total, 'late', x.late, 'submittedAt', x.submitted_at, 'durationMin', x.duration_min) order by x.submitted_at desc)
    from (select * from public.ha_mistake_exams where code = c.code and submitted_at is not null order by submitted_at desc limit 30) x), '[]'::jsonb));
end $$;

create or replace function public.ha_teacher_mistakes_overview()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.ha_is_teacher() then raise exception 'FORBIDDEN'; end if;
  return jsonb_build_object(
    'topLessons', coalesce((select jsonb_agg(row_to_json(x)) from (
        select coalesce(nullif(lesson_title, ''), nullif(chapter, ''), 'غير محدد') as lesson, count(*) as mistakes, count(distinct code) as students, max(times_wrong) as max_repeat
        from public.ha_mistakes where status <> 'archived' group by 1 order by 2 desc limit 15) x), '[]'::jsonb),
    'students', coalesce((select jsonb_agg(row_to_json(y)) from (
        select m.code, coalesce(a.name, c.student_name, m.code) as name,
               count(*) filter (where m.status <> 'archived') as total,
               count(*) filter (where m.status = 'new') as unreviewed,
               count(*) filter (where m.status = 'mastered') as mastered,
               max(m.reviewed_at) as last_review,
               (select count(*) from public.ha_mistake_exams e where e.code = m.code and e.submitted_at is not null) as exams_taken,
               (count(*) filter (where m.status = 'new') >= 5 and coalesce(max(m.reviewed_at), 'epoch'::timestamptz) < now() - interval '7 days') as not_reviewing
        from public.ha_mistakes m left join public.ha_codes c on c.code = m.code left join public.ha_accounts a on a.code = m.code
        group by m.code, a.name, c.student_name order by unreviewed desc limit 200) y), '[]'::jsonb));
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'ha_mistakes_sync(text,text)','ha_mistakes_list(text,text)','ha_mistake_add(text,text,jsonb)','ha_mistake_update(text,text,uuid,jsonb)','ha_mistake_delete(text,text,uuid)',
    'ha_mistake_image(text,text,uuid)','ha_mistake_quiz_report(text,text,text,text,int)','ha_mistake_exam_start(text,text,uuid[],int,text,text,int)',
    'ha_mistake_exam_submit(text,text,uuid,jsonb)','ha_mistake_exams_list(text,text)'] loop
    execute format('revoke all on function public.%s from public', f);
    execute format('grant execute on function public.%s to anon, authenticated', f);
  end loop;
  revoke all on function public.ha_teacher_mistakes_overview() from public;
  grant execute on function public.ha_teacher_mistakes_overview() to authenticated;
end $$;
