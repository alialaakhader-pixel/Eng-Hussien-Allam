import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Pencil, Plus, Save, Trash2 } from 'lucide-react';
import { Exam, Lesson, TeacherPlan, TeacherSubsOverview } from '../types';
import * as api from '../services/api';
import { PlanPosterImg } from './PlanPoster';
import { formatCairo } from '../utils/progress';
import { TeacherPaymentsPanel } from './TeacherPaymentsPanel';

const inp = 'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500';
const GRADES = [{ v: '', l: 'كل الصفوف' }, { v: '1ث', l: '1ث' }, { v: '2ث', l: '2ث' }, { v: '3ث', l: '3ث' }];
const STATUS_AR: Record<string, string> = { active: 'نشط', expiring: 'قريب الانتهاء', expired: 'منتهي', paused: 'موقوف', cancelled: 'ملغي' };
const STATUS_CLS: Record<string, string> = {
  active: 'bg-emerald-500/15 text-emerald-300', expiring: 'bg-amber-500/15 text-amber-300', expired: 'bg-red-500/15 text-red-300',
  paused: 'bg-slate-500/20 text-slate-300', cancelled: 'bg-slate-500/20 text-slate-400'
};
const ACTION_AR: Record<string, string> = {
  activated: 'تفعيل بكود', granted: 'تفعيل من المدرس', renewed: 'تجديد', redeem_failed: 'محاولة كود فاشلة',
  status_active: 'استئناف', status_paused: 'إيقاف', status_cancelled: 'إلغاء'
};

export const TeacherSubscriptionsPanel: React.FC<{ lessons: Lesson[]; exams: Exam[] }> = ({ lessons, exams }) => {
  const [data, setData] = useState<TeacherSubsOverview | null>(null);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<'subs' | 'plans' | 'codes' | 'pay' | 'log'>('subs');
  const [q, setQ] = useState('');

  // plan form
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('0');
  const [days, setDays] = useState('30');
  const [grade, setGrade] = useState('');
  const [selLessons, setSelLessons] = useState<string[]>([]);
  const [selExams, setSelExams] = useState<string[]>([]);
  const [ai, setAi] = useState(false);
  const [active, setActive] = useState(true);

  // codes / grant
  const [codePlan, setCodePlan] = useState('');
  const [codeCount, setCodeCount] = useState('5');
  const [fresh, setFresh] = useState<string[]>([]);
  const [grantStudent, setGrantStudent] = useState('');
  const [grantPlan, setGrantPlan] = useState('');
  const [grantDays, setGrantDays] = useState('');

  const load = useCallback(async () => {
    setError('');
    try { setData(await api.teacherSubsOverview()); } catch (e: any) { setError(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const run = async (fn: () => Promise<void>, ok: string) => {
    if (busy) return;
    setBusy(true); setNote(''); setError('');
    try { await fn(); setNote(ok); await load(); } catch (e: any) { setError(e.message || 'تعذر تنفيذ العملية.'); }
    setBusy(false);
  };

  const resetForm = () => { setEditId(null); setName(''); setPrice('0'); setDays('30'); setGrade(''); setSelLessons([]); setSelExams([]); setAi(false); setActive(true); };
  const editPlan = (p: TeacherPlan) => {
    setEditId(p.id); setName(p.name); setPrice(String(p.price)); setDays(String(p.durationDays)); setGrade(p.grade || '');
    setSelLessons(p.lessonIds); setSelExams(p.examIds); setAi(p.includesAi); setActive(p.active); setView('plans');
  };
  const toggle = (arr: string[], set: (v: string[]) => void, id: string) => set(arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id]);

  const savePlan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || Number(days) < 1) { setError('اكتب اسم الباقة ومدة صحيحة.'); return; }
    run(async () => {
      await api.teacherPlanSave({ id: editId, name: name.trim(), price: Number(price) || 0, days: Math.floor(Number(days)), grade, lessons: selLessons, exams: selExams, ai, active });
      resetForm();
    }, 'تم حفظ الباقة ✅');
  };

  const filteredSubs = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (data?.subscriptions || []).filter(s => !t || s.student.toLowerCase().includes(t) || s.code.toLowerCase().includes(t));
  }, [data, q]);

  const counts = useMemo(() => {
    const c = { active: 0, expiring: 0, expired: 0 };
    (data?.subscriptions || []).forEach(s => { if (s.status in c) (c as Record<string, number>)[s.status]++; });
    return c;
  }, [data]);

  const visibleLessons = lessons.filter(l => !grade || l.grade === grade);
  const plans = data?.plans || [];

  if (view === 'pay') {
    return (
      <div className="space-y-5 text-white">
        <div className="flex flex-wrap gap-2">
          {([['subs', 'المشتركون'], ['plans', 'الباقات'], ['codes', 'أكواد التفعيل'], ['pay', 'المدفوعات'], ['log', 'السجل']] as const).map(([k, l]) => (
            <button key={k} onClick={() => setView(k)} className={`px-4 py-2 rounded-xl text-xs font-bold ${view === k ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300 border border-slate-700'}`}>{l}</button>
          ))}
        </div>
        <TeacherPaymentsPanel onChanged={load} />
      </div>
    );
  }

  return (
    <div className="space-y-5 text-white">
      <div className="flex flex-wrap gap-2">
        {([['subs', 'المشتركون'], ['plans', 'الباقات'], ['codes', 'أكواد التفعيل'], ['pay', 'المدفوعات'], ['log', 'السجل']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setView(k)} className={`px-4 py-2 rounded-xl text-xs font-bold ${view === k ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300 border border-slate-700'}`}>{l}</button>
        ))}
      </div>

      {error && <div className="rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs p-3">{error}</div>}
      {note && <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs p-3">{note}</div>}
      {!data && !error && <div className="text-slate-400 text-sm flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> جاري التحميل…</div>}

      {data && view === 'subs' && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-2xl bg-slate-900 border border-slate-800 p-3"><div className="text-2xl font-black text-emerald-300">{counts.active}</div><div className="text-[11px] text-slate-400">نشطة</div></div>
            <div className="rounded-2xl bg-slate-900 border border-slate-800 p-3"><div className="text-2xl font-black text-amber-300">{counts.expiring}</div><div className="text-[11px] text-slate-400">قريبة الانتهاء</div></div>
            <div className="rounded-2xl bg-slate-900 border border-slate-800 p-3"><div className="text-2xl font-black text-red-300">{counts.expired}</div><div className="text-[11px] text-slate-400">منتهية</div></div>
          </div>

          <form
            onSubmit={e => { e.preventDefault(); run(async () => { await api.teacherGrantSub(grantStudent, grantPlan, grantDays ? Math.floor(Number(grantDays)) : null); setGrantStudent(''); setGrantDays(''); }, 'تم تفعيل/تجديد الاشتراك ✅'); }}
            className="rounded-2xl bg-slate-900 border border-slate-800 p-4 grid sm:grid-cols-4 gap-2 items-end"
          >
            <div className="sm:col-span-4 text-xs font-bold text-slate-300">تفعيل أو تجديد اشتراك لطالب (التجديد على نفس الباقة بيمدّد التاريخ)</div>
            <input value={grantStudent} onChange={e => setGrantStudent(e.target.value)} dir="ltr" placeholder="كود الطالب" className={inp} required />
            <select value={grantPlan} onChange={e => setGrantPlan(e.target.value)} className={inp} required>
              <option value="">اختر الباقة</option>
              {plans.filter(p => p.active).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <input value={grantDays} onChange={e => setGrantDays(e.target.value)} type="number" min={1} placeholder="عدد الأيام (اختياري)" className={inp} />
            <button disabled={busy} className="bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 font-black rounded-lg py-2 text-xs">تنفيذ</button>
          </form>

          <input value={q} onChange={e => setQ(e.target.value)} placeholder="بحث بالاسم أو كود الطالب…" className={inp} />
          <div className="space-y-2">
            {filteredSubs.length === 0 && <div className="text-xs text-slate-400">لا توجد اشتراكات.</div>}
            {filteredSubs.map(s => (
              <div key={s.id} className="rounded-2xl bg-slate-900 border border-slate-800 p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div>
                  <div className="font-black text-sm">{s.student} <span className="text-slate-500 font-mono text-[11px]">{s.code}</span></div>
                  <div className="text-slate-400">{s.plan} · حتى {formatCairo(s.ends_at)} · متبقي {s.days_left} يوم</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full font-bold ${STATUS_CLS[s.status]}`}>{STATUS_AR[s.status]}</span>
                  {s.raw_status === 'active' && <button disabled={busy} onClick={() => run(() => api.teacherSetSubStatus(s.id, 'paused'), 'تم إيقاف الاشتراك')} className="px-2 py-1 rounded-lg bg-slate-800 border border-slate-700">إيقاف</button>}
                  {s.raw_status !== 'active' && <button disabled={busy} onClick={() => run(() => api.teacherSetSubStatus(s.id, 'active'), 'تم استئناف الاشتراك')} className="px-2 py-1 rounded-lg bg-slate-800 border border-slate-700">استئناف</button>}
                  {s.raw_status !== 'cancelled' && <button disabled={busy} onClick={() => { if (confirm('إلغاء هذا الاشتراك؟')) run(() => api.teacherSetSubStatus(s.id, 'cancelled'), 'تم إلغاء الاشتراك'); }} className="px-2 py-1 rounded-lg bg-red-500/10 text-red-300 border border-red-500/30">إلغاء</button>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {data && view === 'plans' && (
        <div className="space-y-4">
          <form onSubmit={savePlan} className="rounded-2xl bg-slate-900 border border-slate-800 p-4 space-y-3">
            <div className="text-sm font-black flex items-center gap-2">{editId ? <Pencil className="w-4 h-4" /> : <Plus className="w-4 h-4" />} {editId ? 'تعديل باقة' : 'باقة جديدة'}</div>
            <div className="grid sm:grid-cols-4 gap-2">
              <input value={name} onChange={e => setName(e.target.value)} placeholder="اسم الباقة" className={`${inp} sm:col-span-2`} maxLength={80} required />
              <input value={price} onChange={e => setPrice(e.target.value)} type="number" min={0} step="0.01" placeholder="السعر (ج.م)" className={inp} />
              <input value={days} onChange={e => setDays(e.target.value)} type="number" min={1} max={1100} placeholder="المدة بالأيام" className={inp} required />
            </div>
            <div className="grid sm:grid-cols-2 gap-2">
              <select value={grade} onChange={e => setGrade(e.target.value)} className={inp}>{GRADES.map(g => <option key={g.v} value={g.v}>{g.l}</option>)}</select>
              <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={ai} onChange={e => setAi(e.target.checked)} /> تشمل المدرس الذكي</label>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <div className="text-xs font-bold text-slate-300 mb-1">المحاضرات داخل الباقة ({selLessons.length})</div>
                <div className="max-h-40 overflow-auto rounded-lg bg-slate-800 border border-slate-700 p-2 space-y-1">
                  {visibleLessons.length === 0 && <div className="text-[11px] text-slate-500">لا توجد محاضرات.</div>}
                  {visibleLessons.map(l => <label key={l.id} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={selLessons.includes(l.id)} onChange={() => toggle(selLessons, setSelLessons, l.id)} /> {l.title}</label>)}
                </div>
              </div>
              <div>
                <div className="text-xs font-bold text-slate-300 mb-1">الامتحانات داخل الباقة ({selExams.length})</div>
                <div className="max-h-40 overflow-auto rounded-lg bg-slate-800 border border-slate-700 p-2 space-y-1">
                  {exams.length === 0 && <div className="text-[11px] text-slate-500">لا توجد امتحانات.</div>}
                  {exams.map(x => <label key={x.id} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={selExams.includes(x.id)} onChange={() => toggle(selExams, setSelExams, x.id)} /> {x.title}</label>)}
                </div>
              </div>
            </div>
            <p className="text-[11px] text-slate-500">أي محاضرة/امتحان تختاره هنا يتقفل على غير المشتركين من الخادم. اللي مش داخل أي باقة يفضل مجاني.</p>
            <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} /> الباقة مفعّلة</label>
            <div className="flex gap-2">
              <button disabled={busy} className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 font-black rounded-lg px-4 py-2 text-xs"><Save className="w-4 h-4" /> حفظ</button>
              {editId && <button type="button" onClick={resetForm} className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs">إلغاء التعديل</button>}
            </div>
          </form>

          <div className="space-y-2">
            {plans.length === 0 && <div className="text-xs text-slate-400">لا توجد باقات بعد.</div>}
            {plans.map(p => (
              <div key={p.id} className="rounded-2xl bg-slate-900 border border-slate-800 p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="w-full sm:w-44 shrink-0">
                  <PlanPosterImg plan={{ name: p.name, price: p.price, durationDays: p.durationDays, grade: p.grade, includesAi: p.includesAi, lessonCount: p.lessonIds.length, examCount: p.examIds.length }} download />
                </div>
                <div className="flex-1 min-w-[10rem]">
                  <div className="font-black text-sm">{p.name} {!p.active && <span className="text-slate-500">(موقوفة)</span>}</div>
                  <div className="text-slate-400">{p.price} ج.م · {p.durationDays} يوم · {p.grade || 'كل الصفوف'} · {p.lessonIds.length} محاضرة · {p.examIds.length} امتحان{p.includesAi ? ' · AI' : ''} · {p.subscribers} مشترك نشط</div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => editPlan(p)} className="px-2 py-1 rounded-lg bg-slate-800 border border-slate-700">تعديل</button>
                  <button disabled={busy} onClick={() => { if (confirm('حذف الباقة؟ لو لها اشتراكات هتتوقف بدل الحذف.')) run(async () => { await api.teacherPlanDelete(p.id); }, 'تم'); }} className="px-2 py-1 rounded-lg bg-red-500/10 text-red-300 border border-red-500/30"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {data && view === 'codes' && (
        <div className="space-y-4">
          <form
            onSubmit={e => { e.preventDefault(); run(async () => { setFresh(await api.teacherGenerateCodes(codePlan, Math.floor(Number(codeCount)) || 1, null)); }, 'تم إنشاء الأكواد ✅'); }}
            className="rounded-2xl bg-slate-900 border border-slate-800 p-4 grid sm:grid-cols-4 gap-2 items-end"
          >
            <div className="sm:col-span-4 text-xs font-bold text-slate-300">إنشاء أكواد تفعيل (كل كود يُستخدم مرة واحدة)</div>
            <select value={codePlan} onChange={e => setCodePlan(e.target.value)} className={`${inp} sm:col-span-2`} required>
              <option value="">اختر الباقة</option>
              {plans.filter(p => p.active).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <input value={codeCount} onChange={e => setCodeCount(e.target.value)} type="number" min={1} max={200} className={inp} />
            <button disabled={busy} className="bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 font-black rounded-lg py-2 text-xs">إنشاء</button>
          </form>
          {fresh.length > 0 && (
            <div className="rounded-2xl bg-amber-500/10 border border-amber-500/30 p-3 space-y-2">
              <div className="text-xs font-bold text-amber-300">الأكواد الجديدة (انسخها دلوقتي)</div>
              <pre dir="ltr" className="text-xs font-mono whitespace-pre-wrap select-all">{fresh.join('\n')}</pre>
              <button onClick={() => navigator.clipboard?.writeText(fresh.join('\n'))} className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs">نسخ الكل</button>
            </div>
          )}
          <div className="space-y-1.5">
            {data.codes.map(c => (
              <div key={c.code} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-900 border border-slate-800 px-3 py-2 text-xs">
                <span dir="ltr" className="font-mono">{c.code}</span>
                <span className="text-slate-400">{c.plan}</span>
                <span className={c.used_at ? 'text-slate-500' : 'text-emerald-300'}>{c.used_at ? `استُخدم بواسطة ${c.used_by} · ${formatCairo(c.used_at)}` : 'غير مستخدم'}</span>
              </div>
            ))}
            {data.codes.length === 0 && <div className="text-xs text-slate-400">لا توجد أكواد.</div>}
          </div>
        </div>
      )}

      {data && view === 'log' && (
        <div className="space-y-1.5">
          {data.log.length === 0 && <div className="text-xs text-slate-400">لا توجد عمليات بعد.</div>}
          {data.log.map(l => (
            <div key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-900 border border-slate-800 px-3 py-2 text-xs">
              <span className="font-bold">{l.student}</span>
              <span className="text-amber-300">{ACTION_AR[l.action] || l.action}</span>
              <span className="text-slate-400">{String((l.details as { plan?: string }).plan || '')}</span>
              <span className="text-slate-500">{formatCairo(l.at)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
