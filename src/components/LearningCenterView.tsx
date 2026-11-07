import React, { useCallback, useEffect, useState } from 'react';
import { BookCheck, Bot, CheckCircle2, Clock, Loader2, LogIn, AlertCircle } from 'lucide-react';
import { AssignmentItem, StudentUser } from '../types';
import * as api from '../services/api';
import { TutorView } from './TutorView';
import { formatCairo } from '../utils/progress';

interface Props { currentStudent: StudentUser | null; onOpenLoginModal: () => void }

const AssignmentCard: React.FC<{ item: AssignmentItem; code: string; onChanged: () => void }> = ({ item, code, onChanged }) => {
  const [answer, setAnswer] = useState(item.answer || '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const graded = item.grade !== null && item.grade !== undefined;
  const overdue = !!item.dueAt && new Date(item.dueAt).getTime() < Date.now();
  const locked = graded || (overdue && !item.submittedAt) || overdue;

  const submit = async () => {
    if (busy) return;
    if (!answer.trim()) { setMsg({ ok: false, text: 'اكتب إجابتك أولاً.' }); return; }
    setBusy(true); setMsg(null);
    const r = await api.assignmentSubmit(code, item.id, answer);
    setBusy(false);
    if (r.ok) { setMsg({ ok: true, text: 'تم تسليم الواجب بنجاح ✅' }); onChanged(); }
    else setMsg({ ok: false, text: (r as { error: string }).error });
  };

  return (
    <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <h4 className="font-bold text-white text-sm">{item.title}</h4>
        <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold shrink-0 ${
          graded ? 'bg-emerald-500/15 text-emerald-300' : item.submittedAt ? 'bg-sky-500/15 text-sky-300' : overdue ? 'bg-red-500/15 text-red-300' : 'bg-amber-500/15 text-amber-300'
        }`}>
          {graded ? 'تم التصحيح' : item.submittedAt ? 'تم التسليم' : overdue ? 'انتهى الموعد' : 'مطلوب'}
        </span>
      </div>
      {item.body && <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">{item.body}</p>}
      <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
        <Clock className="w-3.5 h-3.5" /> موعد التسليم: {item.dueAt ? formatCairo(item.dueAt) : 'غير محدد'}
      </div>

      {graded && (
        <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3 text-xs space-y-1">
          <div className="font-black text-emerald-300">الدرجة: {item.grade} / 100</div>
          {item.feedback && <div className="text-slate-200 whitespace-pre-wrap">تعليق المدرس: {item.feedback}</div>}
        </div>
      )}

      <textarea
        value={answer}
        onChange={e => setAnswer(e.target.value)}
        disabled={locked}
        maxLength={12000}
        rows={4}
        placeholder={locked ? '' : 'اكتب إجابتك هنا…'}
        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 disabled:opacity-60"
      />
      {msg && (
        <div className={`text-xs flex items-center gap-1.5 ${msg.ok ? 'text-emerald-300' : 'text-red-300'}`}>
          {msg.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}{msg.text}
        </div>
      )}
      {!locked && (
        <button onClick={submit} disabled={busy}
          className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs disabled:opacity-50 inline-flex items-center gap-1.5">
          {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {item.submittedAt ? 'تعديل التسليم' : 'تسليم الواجب'}
        </button>
      )}
    </div>
  );
};

export const LearningCenterView: React.FC<Props> = ({ currentStudent, onOpenLoginModal }) => {
  const [tab, setTab] = useState<'assignments' | 'tutor'>('assignments');
  const [items, setItems] = useState<AssignmentItem[] | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!currentStudent) return;
    setError('');
    try { setItems(await api.assignmentFeed(currentStudent.codeUsed)); }
    catch { setError('تعذر تحميل الواجبات. تأكد من الإنترنت.'); setItems([]); }
  }, [currentStudent?.codeUsed]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  if (!currentStudent) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4 text-white">
        <BookCheck className="w-12 h-12 mx-auto text-amber-400" />
        <h2 className="text-xl font-display font-black">مركز التعلّم</h2>
        <p className="text-sm text-slate-400">سجّل دخولك لتشوف واجباتك وتسأل المدرس الذكي.</p>
        <button onClick={onOpenLoginModal} className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-sm inline-flex items-center gap-2">
          <LogIn className="w-4 h-4" /> تسجيل الدخول
        </button>
      </div>
    );
  }

  const tabCls = (t: string) => `px-4 py-2 rounded-xl text-xs font-bold transition ${tab === t ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-300 hover:text-white'}`;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-5 text-white">
      <div>
        <h2 className="text-2xl font-display font-black">مركز التعلّم</h2>
        <p className="text-xs text-slate-400 mt-1">الواجبات المطلوبة منك، والمدرس الذكي يشرحلك أي نقطة صعبة.</p>
      </div>
      <div className="flex gap-1 bg-slate-800/70 border border-slate-700/60 p-1 rounded-2xl w-fit">
        <button className={tabCls('assignments')} onClick={() => setTab('assignments')}>الواجبات</button>
        <button className={tabCls('tutor')} onClick={() => setTab('tutor')}>
          <span className="inline-flex items-center gap-1.5"><Bot className="w-3.5 h-3.5" /> المدرس الذكي</span>
        </button>
      </div>

      {tab === 'assignments' && (
        <div className="space-y-4">
          {items === null && <div className="py-10 text-center text-slate-400 text-sm"><Loader2 className="w-5 h-5 animate-spin inline ml-2" />جاري التحميل…</div>}
          {error && <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs">{error}</div>}
          {items && items.length === 0 && !error && <div className="py-10 text-center text-slate-400 text-sm">لا توجد واجبات حالياً.</div>}
          {items?.map(it => <AssignmentCard key={it.id} item={it} code={currentStudent.codeUsed} onChanged={load} />)}
        </div>
      )}
      {tab === 'tutor' && <TutorView student={currentStudent} />}
    </div>
  );
};
