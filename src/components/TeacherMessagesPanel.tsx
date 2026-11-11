import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Send } from 'lucide-react';
import * as api from '../services/api';
import { formatCairo } from '../utils/progress';

const inp = 'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500';
const TARGETS = [{ v: 'all', l: 'كل الطلاب' }, { v: '1ث', l: 'الصف الأول الثانوي' }, { v: '2ث', l: 'الصف الثاني الثانوي' }, { v: '3ث', l: 'الصف الثالث الثانوي' }, { v: 'one', l: 'طالب واحد (بالكود)' }];
const label = (t: string) => (t === 'all' ? 'كل الطلاب' : t.startsWith('code:') ? `الطالب ${t.slice(5)}` : TARGETS.find(x => x.v === t)?.l || t);

export const TeacherMessagesPanel: React.FC = () => {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [target, setTarget] = useState('all');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [list, setList] = useState<api.TeacherMsg[]>([]);

  const load = useCallback(async () => { try { setList(await api.teacherMessages()); } catch { /* optional */ } }, []);
  useEffect(() => { load(); }, [load]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(''); setNote('');
    const t = target === 'one' ? `code:${code.trim().toUpperCase()}` : target;
    if (target === 'one' && !code.trim()) { setError('اكتب كود الطالب.'); return; }
    setBusy(true);
    try {
      const n = await api.teacherSendMessage(title, body, t);
      if (n === 0) setError('الرسالة اتحفظت لكن مفيش طالب مفعّل مطابق للاختيار.');
      else { setNote(`تم إرسال الرسالة إلى ${n} طالب ✅ — تظهر في صندوق الإشعارات وتوصلهم كإشعار على الموبايل.`); setTitle(''); setBody(''); }
      await load();
    } catch (err: any) { setError(err.message || 'تعذر الإرسال.'); }
    setBusy(false);
  };

  return (
    <div className="space-y-5 text-white">
      <form onSubmit={send} className="rounded-2xl bg-slate-900 border border-slate-800 p-4 space-y-3">
        <div className="text-sm font-black flex items-center gap-2"><Send className="w-4 h-4" /> رسالة جديدة للطلاب</div>
        <div className="grid sm:grid-cols-2 gap-2">
          <select value={target} onChange={e => setTarget(e.target.value)} className={inp}>{TARGETS.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}</select>
          {target === 'one' && <input value={code} onChange={e => setCode(e.target.value)} dir="ltr" placeholder="كود الطالب" className={inp} />}
        </div>
        <input value={title} onChange={e => setTitle(e.target.value)} maxLength={120} placeholder="عنوان الرسالة" className={inp} required />
        <textarea value={body} onChange={e => setBody(e.target.value)} maxLength={600} rows={4} placeholder="نص الرسالة…" className={inp} required />
        <div className="text-[11px] text-slate-500">{body.length}/600</div>
        {error && <div className="rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs p-3">{error}</div>}
        {note && <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs p-3">{note}</div>}
        <button disabled={busy} className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 font-black rounded-lg px-4 py-2 text-xs">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} إرسال
        </button>
      </form>

      <div className="space-y-2">
        <div className="text-xs font-bold text-slate-300">آخر الرسائل المرسلة</div>
        {list.length === 0 && <div className="text-xs text-slate-400">لا توجد رسائل بعد.</div>}
        {list.map(m => (
          <div key={m.id} className="rounded-2xl bg-slate-900 border border-slate-800 p-3 text-xs space-y-1">
            <div className="flex flex-wrap justify-between gap-2"><b className="text-sm">{m.title}</b><span className="text-slate-500">{formatCairo(m.created_at)}</span></div>
            <div className="text-slate-300 whitespace-pre-wrap">{m.body}</div>
            <div className="text-slate-500">إلى: {label(m.target)} · وصلت لـ {m.sent_count} طالب</div>
          </div>
        ))}
      </div>
    </div>
  );
};
