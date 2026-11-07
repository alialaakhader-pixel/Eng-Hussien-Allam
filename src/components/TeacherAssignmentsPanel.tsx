import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, Save, ChevronDown, ChevronUp, Pencil } from 'lucide-react';
import { TeacherAssignment } from '../types';
import * as api from '../services/api';
import { formatCairo } from '../utils/progress';

const inp = 'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500';
const GRADES = ['جميع الصفوف', '1ث', '2ث', '3ث'];

// Cairo is UTC+2 / UTC+3; datetime-local gives wall time, so convert through the Cairo zone offset explicitly.
function cairoLocalToIso(v: string): string | null {
  if (!v) return null;
  const [d, t] = v.split('T');
  const guess = new Date(`${d}T${t}:00Z`);
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Cairo', timeZoneName: 'shortOffset' }).formatToParts(guess);
  const off = parts.find(p => p.type === 'timeZoneName')?.value.replace('GMT', '') || '+2';
  const hrs = Number(off) || 2;
  return new Date(guess.getTime() - hrs * 3600_000).toISOString();
}
function isoToCairoLocal(iso: string | null): string {
  if (!iso) return '';
  const f = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Africa/Cairo', dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso));
  return f.replace(' ', 'T');
}

export const TeacherAssignmentsPanel: React.FC = () => {
  const [list, setList] = useState<TeacherAssignment[] | null>(null);
  const [error, setError] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [grade, setGrade] = useState('3ث');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [due, setDue] = useState('');
  const [published, setPublished] = useState(true);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, { grade: string; feedback: string }>>({});
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    setError('');
    try { setList(await api.teacherAssignments()); } catch (e: any) { setError(e.message); setList([]); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const reset = () => { setEditId(null); setTitle(''); setBody(''); setDue(''); setPublished(true); setGrade('3ث'); };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError(''); setNote('');
    try {
      await api.teacherSaveAssignment({ id: editId, grade, title, body, dueAt: cairoLocalToIso(due), published });
      setNote('تم حفظ الواجب.'); reset(); await load();
    } catch (err: any) { setError(err.message); }
    setBusy(false);
  };

  const edit = (a: TeacherAssignment) => {
    setEditId(a.id); setGrade(a.grade); setTitle(a.title); setBody(a.body); setDue(isoToCairoLocal(a.dueAt)); setPublished(a.published);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const saveGrade = async (subId: string, cur: { grade: number | null; feedback: string | null }) => {
    const e = edits[subId] || { grade: cur.grade === null ? '' : String(cur.grade), feedback: cur.feedback || '' };
    const g = e.grade.trim() === '' ? null : Number(e.grade);
    if (g !== null && (!Number.isFinite(g) || g < 0 || g > 100)) { setError('الدرجة لازم تكون من 0 إلى 100.'); return; }
    try { await api.teacherGradeAssignment(subId, g, e.feedback); setNote('تم حفظ الدرجة.'); setError(''); await load(); }
    catch (err: any) { setError(err.message); }
  };

  return (
    <div className="space-y-6 text-white">
      <form onSubmit={save} className="rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-3">
        <h3 className="font-black text-sm flex items-center gap-2"><Plus className="w-4 h-4 text-amber-400" />{editId ? 'تعديل واجب' : 'واجب جديد'}</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <input className={inp} placeholder="عنوان الواجب" value={title} maxLength={180} onChange={e => setTitle(e.target.value)} required />
          <select className={inp} value={grade} onChange={e => setGrade(e.target.value)}>
            {GRADES.map(g => <option key={g} value={g}>{g === 'جميع الصفوف' ? g : g === '1ث' ? 'أولى ثانوي' : g === '2ث' ? 'تانية ثانوي' : 'تالتة ثانوي'}</option>)}
          </select>
        </div>
        <textarea className={inp} rows={4} placeholder="نص الواجب / الأسئلة" value={body} onChange={e => setBody(e.target.value)} />
        <div className="grid sm:grid-cols-2 gap-3 items-center">
          <label className="text-[11px] text-slate-400">موعد التسليم (بتوقيت القاهرة)
            <input type="datetime-local" className={inp + ' mt-1'} value={due} onChange={e => setDue(e.target.value)} />
          </label>
          <label className="text-xs flex items-center gap-2"><input type="checkbox" checked={published} onChange={e => setPublished(e.target.checked)} /> منشور للطلاب</label>
        </div>
        <div className="flex gap-2">
          <button disabled={busy} className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs inline-flex items-center gap-1.5 disabled:opacity-50">
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} حفظ
          </button>
          {editId && <button type="button" onClick={reset} className="px-4 py-2 rounded-xl bg-slate-800 text-xs">إلغاء التعديل</button>}
        </div>
        {error && <div className="text-xs text-red-300">{error}</div>}
        {note && <div className="text-xs text-emerald-300">{note}</div>}
      </form>

      {list === null && <div className="text-center text-slate-400 text-sm py-6"><Loader2 className="w-5 h-5 animate-spin inline ml-2" />جاري التحميل…</div>}
      {list && list.length === 0 && <div className="text-center text-slate-400 text-sm py-6">لا توجد واجبات بعد.</div>}

      {list?.map(a => (
        <div key={a.id} className="rounded-2xl bg-slate-900 border border-slate-800 p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-bold text-sm">{a.title} <span className={`text-[10px] px-2 py-0.5 rounded-full ${a.published ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-700 text-slate-300'}`}>{a.published ? 'منشور' : 'مسودة'}</span></div>
              <div className="text-[11px] text-slate-400 mt-0.5">الصف: {a.grade} · التسليم: {a.dueAt ? formatCairo(a.dueAt) : 'غير محدد'} · {a.submissions.length} تسليم</div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => edit(a)} className="px-3 py-1.5 rounded-lg bg-slate-800 text-[11px] inline-flex items-center gap-1"><Pencil className="w-3 h-3" /> تعديل</button>
              <button onClick={() => setOpen(open === a.id ? null : a.id)} className="px-3 py-1.5 rounded-lg bg-slate-800 text-[11px] inline-flex items-center gap-1">
                التسليمات {open === a.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            </div>
          </div>
          {open === a.id && (
            <div className="space-y-3 pt-2 border-t border-slate-800">
              {a.submissions.length === 0 && <div className="text-xs text-slate-400">لا توجد تسليمات.</div>}
              {a.submissions.map(s => {
                const e = edits[s.id] || { grade: s.grade === null ? '' : String(s.grade), feedback: s.feedback || '' };
                return (
                  <div key={s.id} className="rounded-xl bg-slate-800/60 p-3 space-y-2">
                    <div className="text-xs font-bold">{s.studentName || s.code} <span className="text-slate-400 font-normal">· {formatCairo(s.submittedAt)}</span></div>
                    <div className="text-xs text-slate-200 whitespace-pre-wrap">{s.answer}</div>
                    <div className="grid sm:grid-cols-[7rem_1fr_auto] gap-2">
                      <input className={inp} type="number" min={0} max={100} placeholder="الدرجة /100" value={e.grade} onChange={ev => setEdits(p => ({ ...p, [s.id]: { ...e, grade: ev.target.value } }))} />
                      <input className={inp} placeholder="تعليق للطالب" value={e.feedback} maxLength={3000} onChange={ev => setEdits(p => ({ ...p, [s.id]: { ...e, feedback: ev.target.value } }))} />
                      <button onClick={() => saveGrade(s.id, s)} className="px-4 py-2 rounded-lg bg-amber-500 text-slate-950 font-black text-xs">حفظ</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
