import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, BadgeCheck, CheckCircle2, KeyRound, Loader2 } from 'lucide-react';
import { MySubscription, PlanCatalogItem } from '../types';
import * as api from '../services/api';
import { formatCairo } from '../utils/progress';

const STATUS_AR: Record<string, string> = { active: 'نشط', paused: 'موقوف', cancelled: 'ملغي', expired: 'منتهي' };

export const MySubscriptionPanel: React.FC<{ code: string; onChanged?: () => void }> = ({ code, onChanged }) => {
  const [data, setData] = useState<{ subscriptions: MySubscription[]; plans: PlanCatalogItem[] } | null | undefined>(undefined);
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => { setData(await api.mySubscriptions(code)); }, [code]);
  useEffect(() => { load(); }, [load]);

  const redeem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !key.trim()) return;
    setBusy(true); setMsg(null);
    const r = await api.redeemActivation(code, key);
    setBusy(false);
    if (r.ok) {
      setMsg({ ok: true, text: `${r.renewed ? 'تم تجديد' : 'تم تفعيل'} باقة «${r.planName}» حتى ${formatCairo(r.endsAt)} ✅` });
      setKey('');
      load();
      onChanged?.();
    } else setMsg({ ok: false, text: (r as { error: string }).error });
  };

  const current = data?.subscriptions.filter(s => s.status === 'active') || [];
  const history = data?.subscriptions.filter(s => s.status !== 'active') || [];

  return (
    <section className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-5">
      <div className="flex items-center gap-2">
        <BadgeCheck className="w-5 h-5 text-amber-400" />
        <h3 className="text-lg font-display font-black text-white">اشتراكي</h3>
      </div>

      {data === undefined && <div className="text-slate-400 text-sm flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> جاري التحميل…</div>}
      {data === null && <div className="text-red-300 text-sm">تعذر تحميل بيانات الاشتراك الآن.</div>}

      {data && current.length === 0 && (
        <div className="rounded-2xl bg-slate-800/60 border border-slate-700 p-4 text-sm text-slate-300">
          لا يوجد اشتراك نشط حالياً. المحتوى المجاني متاح لك، وللمحتوى المدفوع فعّل كود الاشتراك بالأسفل.
        </div>
      )}

      {current.map(s => (
        <div key={s.id} className="rounded-2xl bg-emerald-500/10 border border-emerald-500/30 p-4 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="font-black text-white">{s.planName}</div>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold">{STATUS_AR[s.status]}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
            <div>البداية: <b className="text-white">{formatCairo(s.startsAt)}</b></div>
            <div>الانتهاء: <b className="text-white">{formatCairo(s.endsAt)}</b></div>
            <div>المتبقي: <b className={s.daysLeft <= 7 ? 'text-amber-300' : 'text-white'}>{s.daysLeft} يوم</b></div>
            <div>
              يشمل: {s.lessonCount} محاضرة · {s.examCount} امتحان{s.includesAi ? ' · المدرس الذكي' : ''}
            </div>
          </div>
          {s.daysLeft <= 7 && (
            <div className="flex items-center gap-1.5 text-xs text-amber-300 font-bold">
              <AlertCircle className="w-4 h-4" /> اشتراكك ينتهي خلال {s.daysLeft} يوم. جدّده بكود جديد من المدرس.
            </div>
          )}
        </div>
      ))}

      <form onSubmit={redeem} className="space-y-2">
        <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5"><KeyRound className="w-4 h-4 text-amber-400" /> كود تفعيل الاشتراك</label>
        <div className="flex gap-2">
          <input
            value={key}
            onChange={e => setKey(e.target.value)}
            dir="ltr"
            maxLength={40}
            placeholder="SUB-XXXX-XXXX-XXXX"
            className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-amber-500"
          />
          <button disabled={busy} className="px-5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 font-black text-sm">
            {busy ? '…' : 'تفعيل'}
          </button>
        </div>
        {msg && (
          <div className={`text-xs flex items-center gap-1.5 ${msg.ok ? 'text-emerald-300' : 'text-red-300'}`}>
            {msg.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />} {msg.text}
          </div>
        )}
        <p className="text-[11px] text-slate-500">الكود بتاخده من المدرس. الدفع الإلكتروني غير مفعّل حالياً.</p>
      </form>

      {data && data.plans.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-bold text-slate-300">الباقات المتاحة</div>
          <div className="grid sm:grid-cols-2 gap-3">
            {data.plans.map(p => (
              <div key={p.id} className="rounded-2xl bg-slate-800/60 border border-slate-700 p-3 text-xs space-y-1">
                <div className="font-black text-white text-sm">{p.name}</div>
                <div className="text-slate-300">{p.price > 0 ? `${p.price} ج.م` : 'مجاناً'} · {p.durationDays} يوم</div>
                <div className="text-slate-400">{p.lessonCount} محاضرة · {p.examCount} امتحان{p.includesAi ? ' · المدرس الذكي' : ''}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-bold text-slate-300">سجل اشتراكاتي السابقة</div>
          <div className="space-y-1.5">
            {history.map(s => (
              <div key={s.id} className="flex items-center justify-between gap-2 rounded-xl bg-slate-800/50 border border-slate-800 px-3 py-2 text-xs text-slate-300">
                <span className="font-bold text-white">{s.planName}</span>
                <span>{formatCairo(s.startsAt)} ← {formatCairo(s.endsAt)}</span>
                <span className="text-slate-400">{STATUS_AR[s.status]}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};
