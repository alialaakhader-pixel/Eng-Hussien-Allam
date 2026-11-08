import React, { useCallback, useEffect, useState } from 'react';
import { Check, Eye, Loader2, Save, X } from 'lucide-react';
import * as api from '../services/api';
import { formatCairo } from '../utils/progress';

const inp = 'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500';
const METHOD: Record<string, string> = { vodafone_cash: 'فودافون كاش', instapay: 'إنستا باي' };
const STATUS: Record<string, string> = { pending: 'قيد المراجعة', approved: 'مقبول', rejected: 'مرفوض' };
const CLS: Record<string, string> = { pending: 'bg-amber-500/15 text-amber-300', approved: 'bg-emerald-500/15 text-emerald-300', rejected: 'bg-red-500/15 text-red-300' };

export const TeacherPaymentsPanel: React.FC<{ onChanged?: () => void }> = ({ onChanged }) => {
  const [data, setData] = useState<{ settings: api.PayInfo; payments: api.TeacherPayment[] } | null>(null);
  const [s, setS] = useState<api.PayInfo>({ vodafoneCash: '', instapay: '', instructions: '' });
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<{ id: string; src: string } | null>(null);

  const load = useCallback(async () => {
    setError('');
    try { const d = await api.teacherPayList(); setData(d); setS(d.settings); } catch (e: any) { setError(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const run = async (fn: () => Promise<void>, ok: string) => {
    if (busy) return;
    setBusy(true); setError(''); setNote('');
    try { await fn(); setNote(ok); await load(); onChanged?.(); } catch (e: any) { setError(e.message || 'تعذر تنفيذ العملية.'); }
    setBusy(false);
  };
  const view = async (id: string) => {
    setReceipt({ id, src: '' });
    const src = await api.teacherPayReceipt(id).catch(() => '');
    setReceipt({ id, src });
  };

  const pending = data?.payments.filter(p => p.status === 'pending').length || 0;

  return (
    <div className="space-y-4">
      {error && <div className="rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs p-3">{error}</div>}
      {note && <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs p-3">{note}</div>}
      {!data && !error && <div className="text-slate-400 text-sm flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> جاري التحميل…</div>}

      <form onSubmit={e => { e.preventDefault(); run(() => api.teacherPaySaveSettings(s), 'تم حفظ بيانات التحويل ✅'); }} className="rounded-2xl bg-slate-900 border border-slate-800 p-4 space-y-2">
        <div className="text-sm font-black">بيانات استلام الدفع (بتظهر للطالب)</div>
        <div className="grid sm:grid-cols-2 gap-2">
          <input value={s.vodafoneCash} onChange={e => setS({ ...s, vodafoneCash: e.target.value })} dir="ltr" placeholder="رقم فودافون كاش" maxLength={40} className={inp} />
          <input value={s.instapay} onChange={e => setS({ ...s, instapay: e.target.value })} dir="ltr" placeholder="عنوان إنستا باي (مثال: name@instapay)" maxLength={80} className={inp} />
        </div>
        <textarea value={s.instructions} onChange={e => setS({ ...s, instructions: e.target.value })} rows={2} maxLength={600} placeholder="تعليمات إضافية للطالب (اختياري)" className={inp} />
        <button disabled={busy} className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 font-black rounded-lg px-4 py-2 text-xs"><Save className="w-4 h-4" /> حفظ</button>
      </form>

      <div className="text-sm font-black">طلبات الدفع {pending > 0 && <span className="text-[11px] bg-amber-500 text-slate-950 rounded-full px-2 py-0.5 mr-1">{pending} قيد المراجعة</span>}</div>
      <div className="space-y-2">
        {data?.payments.length === 0 && <div className="text-xs text-slate-400">لا توجد طلبات دفع بعد.</div>}
        {data?.payments.map(p => (
          <div key={p.id} className="rounded-2xl bg-slate-900 border border-slate-800 p-3 text-xs space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-black text-sm">{p.student} <span className="text-slate-500 font-mono text-[11px]">{p.code}</span></div>
                <div className="text-slate-400">{p.plan} · {p.amount} ج.م · {METHOD[p.method]}{p.sender_ref ? ` · ${p.sender_ref}` : ''} · {formatCairo(p.created_at)}</div>
                {p.status === 'rejected' && p.reject_reason && <div className="text-red-300">سبب الرفض: {p.reject_reason}</div>}
              </div>
              <span className={`px-2 py-0.5 rounded-full font-bold ${CLS[p.status]}`}>{STATUS[p.status]}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => view(p.id)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700"><Eye className="w-3.5 h-3.5" /> عرض الإيصال</button>
              {p.status === 'pending' && (
                <>
                  <button disabled={busy} onClick={() => run(() => api.teacherPayReview(p.id, true, ''), 'تم قبول الدفع وتفعيل الاشتراك ✅')} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-black"><Check className="w-3.5 h-3.5" /> قبول وتفعيل</button>
                  <button disabled={busy} onClick={() => { const r = prompt('سبب الرفض (اختياري):'); if (r !== null) run(() => api.teacherPayReview(p.id, false, r), 'تم رفض الطلب'); }} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-300 border border-red-500/30"><X className="w-3.5 h-3.5" /> رفض</button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {receipt && (
        <div className="fixed inset-0 z-[80] bg-black/80 flex items-center justify-center p-4" onClick={() => setReceipt(null)}>
          {receipt.src ? <img src={receipt.src} alt="إيصال التحويل" className="max-h-[90vh] max-w-full rounded-xl" /> : <Loader2 className="w-8 h-8 animate-spin text-white" />}
        </div>
      )}
    </div>
  );
};
