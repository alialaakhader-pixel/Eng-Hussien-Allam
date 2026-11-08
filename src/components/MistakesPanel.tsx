import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Archive, BookX, CalendarPlus, CheckCircle2, ImagePlus, Loader2, Plus, Sparkles, Trash2, X } from 'lucide-react';
import { Mistake, MistakeExamHistory, MistakeExamItem, MistakeExamResultItem, MistakeNew, MistakeStatus, StudentUser } from '../types';
import * as api from '../services/api';
import { prepareImage } from '../utils/image';
import { formatCairo } from '../utils/progress';

const SOURCE_AR: Record<string, string> = { exam: 'امتحان', quiz: 'اختبار قصير', assignment: 'واجب', ai: 'المدرس الذكي', manual: 'يدوي' };
const STATUS_AR: Record<string, string> = { new: 'لم تُراجَع', reviewed: 'تمت المراجعة', mastered: 'تم إتقانها', archived: 'مؤرشفة' };
const STATUS_CLS: Record<string, string> = { new: 'bg-amber-500/15 text-amber-300', reviewed: 'bg-sky-500/15 text-sky-300', mastered: 'bg-emerald-500/15 text-emerald-300', archived: 'bg-slate-500/20 text-slate-400' };
const REASONS = ['قرأت السؤال غلط', 'نسيت القانون', 'اخترت قانون غلط', 'خطأ في الحساب', 'خطأ في الوحدات', 'لم أفهم الدرس', 'سهو / استعجال', 'تخمين'];
const inp = 'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500';
const LET = ['أ', 'ب', 'ج', 'د', 'هـ', 'و'];

const MistakeCard: React.FC<{
  m: Mistake; code: string; grade: string; selected: boolean; onSelect: () => void; onChanged: () => void;
}> = ({ m, code, grade, selected, onSelect, onChanged }) => {
  const [open, setOpen] = useState(false);
  const [img, setImg] = useState<string | null>(null);
  const [note, setNote] = useState(m.note || '');
  const [ai, setAi] = useState<{ busy: boolean; text: string }>({ busy: false, text: '' });

  useEffect(() => { if (open && m.hasImage && !img) api.mistakeImage(code, m.id).then(setImg); }, [open, m.hasImage, m.id, code, img]);

  const patch = async (p: { status?: string; note?: string; reason?: string; reviewSet?: boolean }) => { if (await api.mistakeUpdate(code, m.id, p)) onChanged(); };
  const askAi = async () => {
    setAi({ busy: true, text: '' });
    const q = `أخطأت في هذا السؤال وعايز أفهمه:\n${m.question}${m.options.length ? '\nالاختيارات: ' + m.options.map((o, i) => `${LET[i]}) ${o}`).join(' ، ') : ''}\nإجابتي: ${m.studentAnswer || 'غير معروفة'}${m.correctAnswer ? `\nالإجابة الصحيحة: ${m.correctAnswer}` : ''}\nاشرحلي ليه أخطأت والحل الصح خطوة بخطوة.`;
    const r = await api.askTutor(code, grade, q.slice(0, 2400), []);
    setAi({ busy: false, text: r.ok ? r.answer : (r as { error: string }).error });
  };

  return (
    <div className={`rounded-2xl border p-3 text-xs space-y-2 ${selected ? 'border-amber-500 bg-amber-500/5' : 'border-slate-800 bg-slate-800/40'}`}>
      <div className="flex items-start gap-2">
        <input type="checkbox" checked={selected} onChange={onSelect} aria-label="تحديد للامتحان" className="mt-1" />
        <button onClick={() => setOpen(o => !o)} className="flex-1 text-right space-y-1">
          <div className="font-bold text-white text-sm whitespace-pre-line line-clamp-3">{m.question}</div>
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className={`px-2 py-0.5 rounded-full font-bold ${STATUS_CLS[m.status]}`}>{STATUS_AR[m.status]}</span>
            <span className="text-slate-400">{SOURCE_AR[m.source]}</span>
            {m.lessonTitle && <span className="text-slate-400">· {m.lessonTitle}</span>}
            {m.timesWrong > 1 && <span className="text-red-300 font-bold">· تكرر {m.timesWrong} مرات</span>}
            {m.reviewSet && <span className="text-sky-300">· في مجموعة المراجعة</span>}
          </div>
        </button>
      </div>

      {open && (
        <div className="space-y-2 pt-2 border-t border-slate-700">
          {img && <img src={img} alt="صورة السؤال" className="max-h-60 rounded-lg border border-slate-700" />}
          {m.options.length > 0 && (
            <div className="space-y-1">
              {m.options.map((o, i) => (
                <div key={i} className={`rounded-lg px-2 py-1 border ${i === m.correctIndex ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-200' : i === m.studentIndex ? 'border-red-500/50 bg-red-500/10 text-red-200' : 'border-slate-700 text-slate-300'}`}>
                  {LET[i]}) {o} {i === m.correctIndex ? '✓ الصحيحة' : i === m.studentIndex ? '✗ إجابتك' : ''}
                </div>
              ))}
            </div>
          )}
          {m.options.length === 0 && (
            <div className="space-y-1">
              {m.studentAnswer && <div><b className="text-red-300">إجابتك:</b> <span className="whitespace-pre-line">{m.studentAnswer}</span></div>}
              {m.correctAnswer && <div><b className="text-emerald-300">الإجابة الصحيحة:</b> <span className="whitespace-pre-line">{m.correctAnswer}</span></div>}
            </div>
          )}
          {m.explanation && <div className="rounded-lg bg-slate-900 border border-slate-700 p-2 whitespace-pre-line"><b className="text-amber-300">الشرح:</b> {m.explanation}</div>}
          <div className="grid sm:grid-cols-2 gap-2">
            <label className="space-y-1">سبب الخطأ
              <select value={REASONS.includes(m.reason || '') ? m.reason! : m.reason ? '__custom' : ''} onChange={e => patch({ reason: e.target.value === '__custom' ? m.reason || '' : e.target.value })} className={inp}>
                <option value="">غير محدد</option>
                {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                {m.reason && !REASONS.includes(m.reason) && <option value="__custom">{m.reason}</option>}
              </select>
            </label>
            <div className="text-slate-400 space-y-0.5 self-end">
              <div>آخر خطأ: {formatCairo(m.lastWrongAt)}</div>
              {m.reviewedAt && <div>آخر مراجعة: {formatCairo(m.reviewedAt)}</div>}
            </div>
          </div>
          <label className="block space-y-1">ملاحظاتي
            <textarea value={note} onChange={e => setNote(e.target.value)} onBlur={() => note !== (m.note || '') && patch({ note })} maxLength={1000} rows={2} className={inp} placeholder="اكتب ملاحظة شخصية…" />
          </label>
          <div className="flex flex-wrap gap-2">
            {m.status !== 'reviewed' && m.status !== 'mastered' && <button onClick={() => patch({ status: 'reviewed' })} className="px-3 py-1.5 rounded-lg bg-sky-500/15 text-sky-300 border border-sky-500/30 font-bold">تمت مراجعته</button>}
            {m.status !== 'mastered' && <button onClick={() => patch({ status: 'mastered' })} className="px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold">أتقنتها</button>}
            {(m.status === 'mastered' || m.status === 'reviewed' || m.status === 'archived') && <button onClick={() => patch({ status: 'new' })} className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700">إعادة فتحها</button>}
            <button onClick={() => patch({ reviewSet: !m.reviewSet })} className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700">{m.reviewSet ? 'إزالة من مجموعة المراجعة' : 'إضافة لمجموعة المراجعة'}</button>
            {m.status !== 'archived' && <button onClick={() => patch({ status: 'archived' })} className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 inline-flex items-center gap-1"><Archive className="w-3.5 h-3.5" /> أرشفة</button>}
            <button onClick={async () => { if (confirm('حذف هذا السؤال نهائياً؟')) { if (await api.mistakeDelete(code, m.id)) onChanged(); } }} className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-300 border border-red-500/30 inline-flex items-center gap-1"><Trash2 className="w-3.5 h-3.5" /> حذف</button>
            <button onClick={askAi} disabled={ai.busy} className="px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-black inline-flex items-center gap-1 disabled:opacity-60"><Sparkles className="w-3.5 h-3.5" /> اسأل المدرس الذكي</button>
          </div>
          {(ai.busy || ai.text) && (
            <div className="rounded-lg bg-slate-900 border border-amber-500/30 p-3 whitespace-pre-wrap leading-relaxed text-slate-100">
              {ai.busy ? <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> المدرس الذكي بيجهز الشرح…</span> : ai.text}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

type Phase = { t: 'list' } | { t: 'taking'; id: string; items: MistakeExamItem[]; durationMin: number; startedAt: number } | { t: 'result'; score: number; total: number; late: boolean; items: MistakeExamResultItem[] };

export const MistakesPanel: React.FC<{ student: StudentUser; onAddToPlanner?: (lesson: string) => Promise<boolean> }> = ({ student, onAddToPlanner }) => {
  const code = student.codeUsed;
  const [list, setList] = useState<Mistake[] | null | undefined>(undefined);
  const [hist, setHist] = useState<MistakeExamHistory[]>([]);
  const [q, setQ] = useState('');
  const [fLesson, setFLesson] = useState('');
  const [fSource, setFSource] = useState('');
  const [fStatus, setFStatus] = useState<'active' | MistakeStatus | 'reviewSet'>('active');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showExam, setShowExam] = useState(false);
  const [phase, setPhase] = useState<Phase>({ t: 'list' });
  const [suggestDone, setSuggestDone] = useState<Set<string>>(new Set());

  const load = useCallback(async () => { setList(await api.mistakesLoad(code)); setHist(await api.mistakeExamsList(code)); }, [code]);
  useEffect(() => { load(); }, [load]);

  const lessons = useMemo(() => Array.from(new Set((list || []).map(m => m.lessonTitle).filter(Boolean) as string[])), [list]);
  const filtered = useMemo(() => (list || []).filter(m => {
    if (fStatus === 'active' ? m.status === 'archived' : fStatus === 'reviewSet' ? !m.reviewSet : m.status !== fStatus) return false;
    if (fLesson && m.lessonTitle !== fLesson) return false;
    if (fSource && m.source !== fSource) return false;
    const t = q.trim().toLowerCase();
    return !t || m.question.toLowerCase().includes(t) || (m.note || '').toLowerCase().includes(t) || (m.lessonTitle || '').toLowerCase().includes(t);
  }), [list, q, fLesson, fSource, fStatus]);

  const counts = useMemo(() => {
    const c = { new: 0, mastered: 0, total: 0 };
    (list || []).forEach(m => { if (m.status !== 'archived') { c.total++; if (m.status === 'new') c.new++; if (m.status === 'mastered') c.mastered++; } });
    return c;
  }, [list]);

  // integration: a lesson with 3+ open mistakes is suggested for the study schedule
  const suggestions = useMemo(() => {
    const by: Record<string, number> = {};
    (list || []).forEach(m => { if (m.lessonTitle && (m.status === 'new' || m.status === 'reviewed')) by[m.lessonTitle] = (by[m.lessonTitle] || 0) + 1; });
    return Object.entries(by).filter(([l, n]) => n >= 3 && !suggestDone.has(l)).sort((a, b) => b[1] - a[1]).slice(0, 2);
  }, [list, suggestDone]);

  const toggleSel = (id: string) => setSel(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // ---- add form ----
  const [f, setF] = useState({ question: '', opts: ['', '', '', ''], ci: -1, si: -1, studentAnswer: '', correctAnswer: '', explanation: '', lessonTitle: '', reason: '' });
  const [fImg, setFImg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const resetAdd = () => { setF({ question: '', opts: ['', '', '', ''], ci: -1, si: -1, studentAnswer: '', correctAnswer: '', explanation: '', lessonTitle: '', reason: '' }); setFImg(null); };
  const saveAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const opts = f.opts.map(o => o.trim()).filter(Boolean);
    if (f.question.trim().length < 2) { setMsg({ ok: false, text: 'اكتب نص السؤال.' }); return; }
    if (opts.length === 1) { setMsg({ ok: false, text: 'لو هتضيف اختيارات لازم تكتب اثنين على الأقل.' }); return; }
    // keep indices aligned with the compacted options list
    const nonEmpty = f.opts.map((o, i) => (o.trim() ? i : -1)).filter(i => i >= 0);
    const ci = f.ci >= 0 ? nonEmpty.indexOf(f.ci) : -1;
    const si = f.si >= 0 ? nonEmpty.indexOf(f.si) : -1;
    const m: MistakeNew = {
      source: 'manual', question: f.question.trim(), options: opts, correctIndex: ci >= 0 ? ci : null, studentIndex: si >= 0 ? si : null,
      studentAnswer: opts.length ? (si >= 0 ? opts[si] : '') : f.studentAnswer, correctAnswer: opts.length ? (ci >= 0 ? opts[ci] : '') : f.correctAnswer,
      explanation: f.explanation, reason: f.reason, lessonTitle: f.lessonTitle, imageData: fImg || undefined
    };
    setBusy(true);
    const r = await api.mistakeAdd(code, m);
    setBusy(false);
    if (r.ok) { setMsg({ ok: true, text: 'تم حفظ السؤال في كل الأخطاء ✅' }); resetAdd(); setShowAdd(false); load(); } else setMsg({ ok: false, text: (r as { error: string }).error });
  };
  const pickImg = async (files: FileList | null) => {
    if (!files?.[0]) return;
    try { setFImg(await prepareImage(files[0], 1000, 300 * 1024)); } catch (e: any) { setMsg({ ok: false, text: e?.message || 'تعذر تجهيز الصورة.' }); }
    if (fileRef.current) fileRef.current.value = '';
  };

  // ---- build exam from mistakes ----
  const [cfg, setCfg] = useState({ scope: 'open', count: 10, difficulty: 'all', order: 'random', minutes: 0 });
  const startExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    let ids: string[] | null = null;
    if (cfg.scope === 'selected') ids = Array.from(sel);
    if (cfg.scope === 'reviewSet') ids = (list || []).filter(m => m.reviewSet && m.status !== 'archived').map(m => m.id);
    if (ids && ids.length === 0) { setMsg({ ok: false, text: cfg.scope === 'selected' ? 'حدّد أسئلة من القائمة أولاً (مربع الاختيار).' : 'مجموعة المراجعة فاضية.' }); return; }
    setBusy(true);
    const r = await api.mistakeExamStart(code, { ids, count: cfg.count, difficulty: cfg.difficulty, order: cfg.order, minutes: cfg.minutes });
    setBusy(false);
    if (r.ok) { setShowExam(false); setMsg(null); setPhase({ t: 'taking', id: r.id, items: r.items, durationMin: r.durationMin, startedAt: Date.now() }); } else setMsg({ ok: false, text: (r as { error: string }).error });
  };

  if (list === undefined) return <div className="text-slate-400 text-sm flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> جاري تحميل كل الأخطاء…</div>;
  if (list === null) return <div className="text-red-300 text-sm">تعذر تحميل كل الأخطاء الآن.</div>;

  if (phase.t === 'taking') return <ExamTaker phase={phase} code={code} onDone={(r) => { setPhase({ t: 'result', ...r }); load(); }} onCancel={() => { setPhase({ t: 'list' }); load(); }} />;
  if (phase.t === 'result') return (
    <section className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-4">
      <div className="text-center space-y-1">
        <div className="text-3xl font-black text-amber-400">{phase.score} / {phase.total}</div>
        <div className="text-sm text-slate-300">{phase.score === phase.total ? 'ممتاز! أتقنت كل الأسئلة 👏' : 'الأسئلة الصح انتقلت إلى «تم إتقانها»، والغلط فضلت في سجل الأخطاء.'}</div>
        {phase.late && <div className="text-xs text-amber-300">تم التسليم بعد انتهاء الوقت المحدد.</div>}
      </div>
      <div className="space-y-2">
        {phase.items.map((it, i) => (
          <div key={it.id} className={`rounded-xl border p-3 text-xs space-y-1 ${it.correct ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-red-500/40 bg-red-500/5'}`}>
            <div className="font-bold text-white">{i + 1}. {it.question}</div>
            <div>إجابتك: <b>{it.chosenIndex != null ? `${LET[it.chosenIndex]}) ${it.options[it.chosenIndex]}` : 'لم تُجب'}</b> {it.correct ? '✓' : '✗'}</div>
            {!it.correct && <div>الصحيحة: <b className="text-emerald-300">{LET[it.correctIndex]}) {it.options[it.correctIndex]}</b></div>}
            {it.repeated && <div className="text-red-300 font-bold">⚠ خطأ متكرر (للمرة {it.timesWrong})</div>}
            {it.explanation && <div className="text-slate-300 whitespace-pre-line">الشرح: {it.explanation}</div>}
          </div>
        ))}
      </div>
      <button onClick={() => setPhase({ t: 'list' })} className="px-5 py-2 rounded-xl bg-amber-500 text-slate-950 font-black text-sm">رجوع لكل الأخطاء</button>
    </section>
  );

  return (
    <section className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2"><BookX className="w-5 h-5 text-amber-400" /><h3 className="text-lg font-display font-black text-white">كل الأخطاء</h3></div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => { setShowAdd(s => !s); setShowExam(false); }} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-amber-300 font-bold text-xs"><Plus className="w-4 h-4" /> إضافة سؤال</button>
          <button onClick={() => { setShowExam(s => !s); setShowAdd(false); }} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs">حوّل أخطائي إلى امتحان</button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-2xl bg-slate-800/60 border border-slate-700 p-3"><div className="text-2xl font-black text-white">{counts.total}</div><div className="text-[11px] text-slate-400">إجمالي الأخطاء</div></div>
        <div className="rounded-2xl bg-slate-800/60 border border-slate-700 p-3"><div className="text-2xl font-black text-amber-300">{counts.new}</div><div className="text-[11px] text-slate-400">لم تُراجَع</div></div>
        <div className="rounded-2xl bg-slate-800/60 border border-slate-700 p-3"><div className="text-2xl font-black text-emerald-300">{counts.mastered}</div><div className="text-[11px] text-slate-400">تم إتقانها</div></div>
      </div>

      {msg && <div className={`text-xs rounded-xl p-3 border flex items-center gap-2 ${msg.ok ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-red-500/10 border-red-500/30 text-red-300'}`}>{msg.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}{msg.text}</div>}

      {suggestions.map(([lesson, n]) => (
        <div key={lesson} className="rounded-2xl bg-sky-500/10 border border-sky-500/30 p-3 text-xs flex flex-wrap items-center justify-between gap-2">
          <span className="text-sky-200">أخطأت {n} مرات في «{lesson}». نقترح تضيف مراجعتها لجدول مذاكرتك.</span>
          {onAddToPlanner && <button onClick={async () => { if (await onAddToPlanner(lesson)) { setSuggestDone(prev => new Set(prev).add(lesson)); setMsg({ ok: true, text: `تمت إضافة مراجعة «${lesson}» لجدول مذاكرتك (بكرة 6 مساءً) ✅` }); } else setMsg({ ok: false, text: 'تعذرت الإضافة لجدول المذاكرة.' }); }} className="px-3 py-1.5 rounded-lg bg-sky-500 text-slate-950 font-black inline-flex items-center gap-1"><CalendarPlus className="w-3.5 h-3.5" /> أضفها لجدولي</button>}
        </div>
      ))}

      {showAdd && (
        <form onSubmit={saveAdd} className="rounded-2xl bg-slate-800/60 border border-slate-700 p-4 space-y-3">
          <div className="text-sm font-black text-white">إضافة سؤال صعب أو خطأ تريد مراجعته</div>
          <textarea value={f.question} onChange={e => setF({ ...f, question: e.target.value })} rows={3} maxLength={3000} placeholder="نص السؤال" className={inp} required />
          <div className="text-[11px] text-slate-400">اختيارات (اختياري، ضرورية عشان السؤال يدخل في الامتحان). حدّد الإجابة الصحيحة وإجابتك:</div>
          {f.opts.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-5 text-slate-400">{LET[i]}</span>
              <input value={o} onChange={e => { const n = [...f.opts]; n[i] = e.target.value; setF({ ...f, opts: n }); }} className={inp} placeholder={`الاختيار ${LET[i]}`} />
              <label className="text-[11px] text-emerald-300 flex items-center gap-1 shrink-0"><input type="radio" name="ci" checked={f.ci === i} onChange={() => setF({ ...f, ci: i })} /> صحيحة</label>
              <label className="text-[11px] text-red-300 flex items-center gap-1 shrink-0"><input type="radio" name="si" checked={f.si === i} onChange={() => setF({ ...f, si: i })} /> إجابتي</label>
            </div>
          ))}
          {f.opts.every(o => !o.trim()) && (
            <div className="grid sm:grid-cols-2 gap-2">
              <textarea value={f.studentAnswer} onChange={e => setF({ ...f, studentAnswer: e.target.value })} rows={2} placeholder="إجابتي" className={inp} />
              <textarea value={f.correctAnswer} onChange={e => setF({ ...f, correctAnswer: e.target.value })} rows={2} placeholder="الإجابة الصحيحة (لو تعرفها)" className={inp} />
            </div>
          )}
          <textarea value={f.explanation} onChange={e => setF({ ...f, explanation: e.target.value })} rows={2} placeholder="شرح الحل الصحيح (اختياري)" className={inp} />
          <div className="grid sm:grid-cols-2 gap-2">
            <input value={f.lessonTitle} onChange={e => setF({ ...f, lessonTitle: e.target.value })} placeholder="الباب / الدرس" className={inp} list="mist-lessons" />
            <select value={f.reason} onChange={e => setF({ ...f, reason: e.target.value })} className={inp}><option value="">سبب الخطأ (اختياري)</option>{REASONS.map(r => <option key={r} value={r}>{r}</option>)}</select>
          </div>
          <datalist id="mist-lessons">{lessons.map(l => <option key={l} value={l} />)}</datalist>
          <div className="flex items-center gap-2">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => pickImg(e.target.files)} />
            <button type="button" onClick={() => fileRef.current?.click()} className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs inline-flex items-center gap-1"><ImagePlus className="w-4 h-4" /> صورة السؤال</button>
            {fImg && <span className="relative"><img src={fImg} alt="" className="h-12 rounded border border-slate-700" /><button type="button" onClick={() => setFImg(null)} className="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center"><X className="w-3 h-3" /></button></span>}
          </div>
          <div className="flex gap-2"><button disabled={busy} className="px-4 py-2 rounded-lg bg-amber-500 text-slate-950 font-black text-xs disabled:opacity-60">حفظ</button><button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs">إلغاء</button></div>
        </form>
      )}

      {showExam && (
        <form onSubmit={startExam} className="rounded-2xl bg-slate-800/60 border border-slate-700 p-4 space-y-3 text-xs">
          <div className="text-sm font-black text-white">حوّل أخطائي إلى امتحان</div>
          <div className="grid sm:grid-cols-2 gap-2">
            <label className="space-y-1">من أي أسئلة؟
              <select value={cfg.scope} onChange={e => setCfg({ ...cfg, scope: e.target.value })} className={inp}>
                <option value="open">كل أخطائي (اللي لسه ما اتقنتهاش)</option>
                <option value="selected">الأسئلة اللي حدّدتها ({sel.size})</option>
                <option value="reviewSet">مجموعة المراجعة</option>
              </select></label>
            <label className="space-y-1">عدد الأسئلة<input type="number" min={1} max={50} value={cfg.count} onChange={e => setCfg({ ...cfg, count: Number(e.target.value) || 10 })} className={inp} /></label>
            <label className="space-y-1">الصعوبة (حسب تكرار الخطأ)
              <select value={cfg.difficulty} onChange={e => setCfg({ ...cfg, difficulty: e.target.value })} className={inp}>
                <option value="all">الكل</option><option value="easy">سهل (أخطأت مرة)</option><option value="medium">متوسط (مرتين)</option><option value="hard">صعب (3 مرات أو أكثر)</option>
              </select></label>
            <label className="space-y-1">الترتيب
              <select value={cfg.order} onChange={e => setCfg({ ...cfg, order: e.target.value })} className={inp}><option value="random">عشوائي</option><option value="lesson">حسب الدروس</option></select></label>
            <label className="space-y-1">الوقت (دقائق، 0 = بدون وقت)<input type="number" min={0} max={300} value={cfg.minutes} onChange={e => setCfg({ ...cfg, minutes: Number(e.target.value) || 0 })} className={inp} /></label>
          </div>
          <p className="text-[11px] text-slate-400">الامتحان بيشمل الأسئلة اللي ليها اختيارات فقط (بتتصحح تلقائياً). الأسئلة الأصلية بتفضل محفوظة زي ما هي.</p>
          <div className="flex gap-2"><button disabled={busy} className="px-4 py-2 rounded-lg bg-amber-500 text-slate-950 font-black disabled:opacity-60">ابدأ الامتحان</button><button type="button" onClick={() => setShowExam(false)} className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-700">إلغاء</button></div>
        </form>
      )}

      <div className="grid sm:grid-cols-4 gap-2">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="ابحث عن سؤال…" className={`${inp} sm:col-span-2`} />
        <select value={fLesson} onChange={e => setFLesson(e.target.value)} className={inp}><option value="">كل الأبواب والدروس</option>{lessons.map(l => <option key={l} value={l}>{l}</option>)}</select>
        <select value={fSource} onChange={e => setFSource(e.target.value)} className={inp}><option value="">كل أنواع الخطأ</option>{Object.entries(SOURCE_AR).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {([['active', 'الكل'], ['new', 'لم تُراجَع'], ['reviewed', 'تمت مراجعتها'], ['mastered', 'تم إتقانها'], ['reviewSet', 'مجموعة المراجعة'], ['archived', 'المؤرشفة']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setFStatus(k)} className={`px-3 py-1 rounded-full border text-xs ${fStatus === k ? 'bg-amber-500 text-slate-950 border-amber-500 font-bold' : 'bg-slate-800 border-slate-700 text-slate-300'}`}>{l}</button>
        ))}
        {sel.size > 0 && <button onClick={() => setSel(new Set())} className="px-3 py-1 rounded-full border border-slate-700 text-xs text-slate-400">إلغاء تحديد ({sel.size})</button>}
      </div>

      <div className="space-y-2">
        {filtered.length === 0 && <div className="text-xs text-slate-400">{list.length === 0 ? 'مفيش أخطاء محفوظة لسه. أخطاء الامتحانات والاختبارات القصيرة والواجبات بتتضاف هنا تلقائياً، وتقدر تضيف أي سؤال بنفسك أو من المدرس الذكي.' : 'مفيش نتائج للفلتر ده.'}</div>}
        {filtered.map(m => <MistakeCard key={m.id} m={m} code={code} grade={student.grade} selected={sel.has(m.id)} onSelect={() => toggleSel(m.id)} onChanged={load} />)}
      </div>

      {hist.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-sm font-black text-white">سجل امتحانات الأخطاء</div>
          {hist.map(h => (
            <div key={h.id} className="flex items-center justify-between rounded-xl bg-slate-800/40 border border-slate-800 px-3 py-2 text-xs">
              <span className="text-slate-300">{formatCairo(h.submittedAt)}</span>
              <b className="text-amber-300">{h.score} / {h.total}</b>
              <span className="text-slate-500">{h.durationMin ? `${h.durationMin} د` : 'بدون وقت'}{h.late ? ' · متأخر' : ''}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

const ExamTaker: React.FC<{
  phase: { id: string; items: MistakeExamItem[]; durationMin: number; startedAt: number }; code: string;
  onDone: (r: { score: number; total: number; late: boolean; items: MistakeExamResultItem[] }) => void; onCancel: () => void;
}> = ({ phase, code, onDone, onCancel }) => {
  const [answers, setAnswers] = useState<(number | null)[]>(() => phase.items.map(() => null));
  const [left, setLeft] = useState(phase.durationMin > 0 ? phase.durationMin * 60 : -1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const sent = useRef(false);

  const submit = useCallback(async () => {
    if (sent.current) return;
    sent.current = true; setBusy(true); setErr('');
    const r = await api.mistakeExamSubmit(code, phase.id, answers);
    if (r.ok) onDone(r); else { sent.current = false; setBusy(false); setErr((r as { error: string }).error); }
  }, [answers, code, onDone, phase.id]);

  useEffect(() => {
    if (left < 0) return;
    if (left === 0) { submit(); return; }
    const t = setTimeout(() => setLeft(l => l - 1), 1000);
    return () => clearTimeout(t);
  }, [left, submit]);

  return (
    <section className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-display font-black text-white">امتحان أخطائي ({phase.items.length} سؤال)</h3>
        {left >= 0 && <span className={`font-mono font-black ${left < 60 ? 'text-red-400' : 'text-amber-300'}`}>{String(Math.floor(left / 60)).padStart(2, '0')}:{String(left % 60).padStart(2, '0')}</span>}
      </div>
      {phase.items.map((it, qi) => (
        <div key={it.id} className="rounded-2xl bg-slate-800/50 border border-slate-700 p-3 space-y-2 text-sm">
          <div className="font-bold text-white whitespace-pre-line">{qi + 1}. {it.question}</div>
          {it.hasImage && <MistakeImg code={code} id={it.id} />}
          <div className="space-y-1.5">
            {it.options.map((o, oi) => (
              <button key={oi} onClick={() => setAnswers(a => a.map((x, i) => (i === qi ? oi : x)))}
                className={`w-full text-right rounded-lg border px-3 py-2 text-xs ${answers[qi] === oi ? 'border-amber-500 bg-amber-500/15 text-white font-bold' : 'border-slate-700 text-slate-300 hover:border-slate-500'}`}>{LET[oi]}) {o}</button>
            ))}
          </div>
        </div>
      ))}
      {err && <div className="text-xs text-red-300">{err}</div>}
      <div className="flex gap-2">
        <button onClick={submit} disabled={busy} className="px-5 py-2.5 rounded-xl bg-amber-500 text-slate-950 font-black text-sm disabled:opacity-60">{busy ? 'جاري التسليم…' : 'تسليم الامتحان'}</button>
        <button onClick={() => { if (confirm('الخروج هيلغي المحاولة دي. متأكد؟')) onCancel(); }} disabled={busy} className="px-5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm">خروج</button>
      </div>
    </section>
  );
};

const MistakeImg: React.FC<{ code: string; id: string }> = ({ code, id }) => {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => { api.mistakeImage(code, id).then(setSrc); }, [code, id]);
  return src ? <img src={src} alt="صورة السؤال" className="max-h-56 rounded-lg border border-slate-700" /> : null;
};
