import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, BadgeCheck, CheckCircle2, KeyRound, Loader2, LogIn } from 'lucide-react';
import { MySubscription, StudentUser } from '../types';
import * as api from '../services/api';
import { formatCairo } from '../utils/progress';
import { prepareImage } from '../utils/image';

const GRADES = [
  { id: '1ث', label: 'الصف الأول الثانوي', short: 'أولى ثانوي', src: '/grades/grade-1.webp', alt: 'المهندس حسين علام - فيزياء الصف الأول الثانوي' },
  { id: '2ث', label: 'الصف الثاني الثانوي', short: 'ثانية ثانوي', src: '/grades/grade-2.webp', alt: 'المهندس حسين علام - فيزياء الصف الثاني الثانوي' },
  { id: '3ث', label: 'الصف الثالث الثانوي', short: 'ثالثة ثانوي', src: '/grades/grade-3.webp', alt: 'المهندس حسين علام - فيزياء الصف الثالث الثانوي' }
];

const PAY_STATUS: Record<string, string> = { pending: 'قيد المراجعة', approved: 'تم القبول', rejected: 'مرفوض' };

const PayModal: React.FC<{ plan: api.PublicPlan; code: string; onClose: () => void; onDone: () => void }> = ({ plan, code, onClose, onDone }) => {
  const [info, setInfo] = useState<api.PayInfo | null>(null);
  const [method, setMethod] = useState<'vodafone_cash' | 'instapay'>('vodafone_cash');
  const [ref, setRef] = useState('');
  const [receipt, setReceipt] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [sent, setSent] = useState(false);
  useEffect(() => { api.payInfo().then(setInfo); }, []);

  const pick = async (f?: File | null) => {
    if (!f) return;
    setErr('');
    try { setReceipt(await prepareImage(f, 1200, 300 * 1024)); } catch (e: any) { setErr(e.message || 'تعذر قراءة الصورة.'); }
  };
  const submit = async () => {
    if (busy) return;
    if (!receipt) { setErr('ارفع صورة إيصال التحويل.'); return; }
    setBusy(true); setErr('');
    const r = await api.payCreate(code, plan.id, method, ref, receipt);
    setBusy(false);
    if (r.ok) { setSent(true); onDone(); } else setErr((r as { error: string }).error);
  };
  const target = method === 'vodafone_cash' ? info?.vodafoneCash : info?.instapay;

  return (
    <div className="fixed inset-0 z-[80] bg-black/70 flex items-end sm:items-center justify-center p-3" onClick={onClose}>
      <div className="w-full max-w-md max-h-[90vh] overflow-auto rounded-3xl bg-slate-900 border border-slate-700 p-5 space-y-4 text-white" onClick={e => e.stopPropagation()}>
        {sent ? (
          <div className="text-center space-y-3 py-4">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
            <div className="font-black text-lg">تم إرسال طلب الدفع</div>
            <p className="text-xs text-slate-300">المدرس هيراجع الإيصال، وأول ما يوافق اشتراكك هيتفعّل وهيوصلك إشعار.</p>
            <button onClick={onClose} className="px-5 py-2 rounded-xl bg-amber-500 text-slate-950 font-black text-sm">تمام</button>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-2">
              <div><div className="font-black text-lg">الاشتراك في «{plan.name}»</div><div className="text-sm text-amber-300 font-black">{plan.price} ج.م · {plan.durationDays} يوم</div></div>
              <button onClick={onClose} className="text-slate-400 text-xl leading-none">×</button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs font-bold">
              {([['vodafone_cash', 'فودافون كاش'], ['instapay', 'إنستا باي']] as const).map(([k, l]) => (
                <button key={k} type="button" onClick={() => setMethod(k)} className={`py-2.5 rounded-xl border ${method === k ? 'bg-amber-500 text-slate-950 border-amber-500' : 'bg-slate-800 border-slate-700 text-slate-200'}`}>{l}</button>
              ))}
            </div>
            <div className="rounded-2xl bg-slate-800/70 border border-slate-700 p-3 text-xs space-y-1.5">
              <div>حوّل مبلغ <b className="text-amber-300">{plan.price} ج.م</b> إلى:</div>
              {info === null ? <div className="text-slate-400">جاري التحميل…</div> : target
                ? <div dir="ltr" className="text-base font-black font-mono text-white select-all text-center py-1">{target}</div>
                : <div className="text-red-300">المدرس لسه ما حدّدش بيانات التحويل لهذه الطريقة. جرّب الطريقة التانية أو تواصل معه.</div>}
              {info?.instructions && <div className="text-slate-300 whitespace-pre-line">{info.instructions}</div>}
            </div>
            <input value={ref} onChange={e => setRef(e.target.value)} maxLength={120} placeholder="رقم المحوِّل أو اسمك (اختياري)" className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500" />
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-200">صورة إيصال التحويل</label>
              <input type="file" accept="image/*" onChange={e => pick(e.target.files?.[0])} className="block w-full text-xs text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-700 file:px-3 file:py-2 file:text-white" />
              {receipt && <img src={receipt} alt="إيصال التحويل" className="max-h-48 rounded-xl border border-slate-700 mx-auto" />}
            </div>
            {err && <div className="text-xs text-red-300 flex items-start gap-1.5"><AlertCircle className="w-4 h-4 shrink-0" /> {err}</div>}
            <button disabled={busy || !target} onClick={submit} className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black text-sm">{busy ? 'جاري الإرسال…' : 'إرسال طلب الدفع'}</button>
            <p className="text-[11px] text-slate-500 text-center">الاشتراك بيتفعّل بعد ما المدرس يراجع الإيصال ويوافق.</p>
          </>
        )}
      </div>
    </div>
  );
};

interface Props { currentStudent: StudentUser | null; onOpenLoginModal: () => void; onChanged: () => void }

const GradeColumn: React.FC<{
  g: typeof GRADES[number]; plans: api.PublicPlan[]; mine: MySubscription[]; student: StudentUser | null;
  onOpenLoginModal: () => void; onChanged: () => void;
}> = ({ g, plans, mine, student, onOpenLoginModal, onChanged }) => {
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const mineHere = student?.grade === g.id;
  const [payPlan, setPayPlan] = useState<api.PublicPlan | null>(null);
  const [myPays, setMyPays] = useState<api.MyPayment[]>([]);
  const loadPays = useCallback(async () => { if (student && mineHere) setMyPays(await api.payMine(student.codeUsed)); }, [student, mineHere]);
  useEffect(() => { loadPays(); }, [loadPays]);

  const redeem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!student || busy || !key.trim()) return;
    setBusy(true); setMsg(null);
    const r = await api.redeemActivation(student.codeUsed, key);
    setBusy(false);
    if (r.ok) { setMsg({ ok: true, text: `${r.renewed ? 'تم تجديد' : 'تم تفعيل'} «${r.planName}» حتى ${formatCairo(r.endsAt)} ✅` }); setKey(''); onChanged(); }
    else setMsg({ ok: false, text: (r as { error: string }).error });
  };

  return (
    <div className="rounded-[28px] p-2.5 border border-white/25 bg-gradient-to-br from-white/[0.18] via-white/[0.06] to-white/[0.12] shadow-[0_12px_40px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.4)] flex flex-col">
      <div className="relative overflow-hidden rounded-[20px] ring-1 ring-white/20 bg-slate-950">
        <img src={g.src} alt={g.alt} width={1024} height={1024} loading="lazy" decoding="async" className="block w-full h-auto aspect-square object-cover" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-transparent opacity-60" />
      </div>
      <div className="px-2.5 pt-3 pb-1 leading-tight">
        <span className="block text-[11px] text-amber-300 font-bold">{g.short}</span>
        <span className="block text-sm font-black text-white">{g.label}</span>
      </div>

      <div className="px-2 pb-2 pt-2 space-y-3 flex-1">
        {mine.length > 0 && mineHere && mine.filter(s => s.status === 'active').map(s => (
          <div key={s.id} className="rounded-2xl bg-emerald-500/10 border border-emerald-500/30 p-3 text-xs space-y-1">
            <div className="font-black text-emerald-300 flex items-center gap-1.5"><BadgeCheck className="w-4 h-4" /> اشتراكك الحالي: {s.planName}</div>
            <div className="text-slate-300">ينتهي {formatCairo(s.endsAt)} · متبقي <b className={s.daysLeft <= 7 ? 'text-amber-300' : 'text-white'}>{s.daysLeft}</b> يوم</div>
          </div>
        ))}

        {plans.length === 0 && <div className="rounded-2xl bg-slate-900/70 border border-slate-700 p-3 text-xs text-slate-400">لا توجد باقات لهذه المرحلة حالياً. المحتوى المتاح مجاني.</div>}
        {plans.map(p => (
          <div key={p.id} className="rounded-2xl bg-slate-900/80 border border-slate-700 p-3 text-xs space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="font-black text-sm text-white">{p.name}</span>
              <span className="font-black text-amber-300">{p.price > 0 ? `${p.price} ج.م` : 'مجاناً'}</span>
            </div>
            <div className="text-slate-300">المدة: {p.durationDays} يوم</div>
            <div className="text-slate-400">{p.lessonCount} محاضرة · {p.examCount} امتحان{p.includesAi ? ' · المدرس الذكي' : ''}</div>
            {student && mineHere && p.price > 0 && (
              <button onClick={() => setPayPlan(p)} className="mt-1.5 w-full py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs">اشترك الآن · تحويل فودافون كاش / إنستا باي</button>
            )}
          </div>
        ))}

        {mineHere && myPays.filter(x => plans.some(p => p.id === x.planId)).slice(0, 3).map(x => (
          <div key={x.id} className="rounded-xl bg-slate-900/70 border border-slate-700 px-3 py-2 text-[11px] flex items-center justify-between gap-2">
            <span className="text-slate-200">{x.plan} · {x.amount} ج.م</span>
            <span className={x.status === 'approved' ? 'text-emerald-300 font-bold' : x.status === 'rejected' ? 'text-red-300 font-bold' : 'text-amber-300 font-bold'}>{PAY_STATUS[x.status]}{x.status === 'rejected' && x.reason ? ` (${x.reason})` : ''}</span>
          </div>
        ))}

        {student ? (
          mineHere ? (
            <form onSubmit={redeem} className="space-y-2">
              <label className="text-[11px] font-bold text-slate-200 flex items-center gap-1.5"><KeyRound className="w-3.5 h-3.5 text-amber-400" /> كود تفعيل الاشتراك</label>
              <div className="flex gap-2">
                <input value={key} onChange={e => setKey(e.target.value)} dir="ltr" maxLength={40} placeholder="SUB-XXXX-XXXX-XXXX"
                  className="flex-1 min-w-0 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-500" />
                <button disabled={busy} className="px-4 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 font-black text-xs">{busy ? '…' : 'تفعيل'}</button>
              </div>
              {msg && <div className={`text-[11px] flex items-start gap-1.5 ${msg.ok ? 'text-emerald-300' : 'text-red-300'}`}>{msg.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />} {msg.text}</div>}
            </form>
          ) : (
            <div className="rounded-xl bg-slate-900/70 border border-slate-700 p-3 text-[11px] text-slate-400">حسابك مسجّل في مرحلة أخرى، فتفعيل هذه المرحلة غير متاح لك.</div>
          )
        ) : (
          <button onClick={onOpenLoginModal} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs">
            <LogIn className="w-4 h-4" /> سجّل دخولك لتفعيل الاشتراك
          </button>
        )}
      </div>
      {payPlan && student && <PayModal plan={payPlan} code={student.codeUsed} onClose={() => setPayPlan(null)} onDone={loadPays} />}
    </div>
  );
};

export const SubscriptionsView: React.FC<Props> = ({ currentStudent, onOpenLoginModal, onChanged }) => {
  const [plans, setPlans] = useState<api.PublicPlan[] | null | undefined>(undefined);
  const [mine, setMine] = useState<MySubscription[]>([]);

  const load = useCallback(async () => {
    setPlans(await api.publicPlans());
    if (currentStudent) setMine((await api.mySubscriptions(currentStudent.codeUsed))?.subscriptions || []); else setMine([]);
  }, [currentStudent]);
  useEffect(() => { load(); }, [load]);

  return (
    <section className="px-4 sm:px-6 lg:px-8 py-8 text-white">
      <div className="relative max-w-7xl mx-auto rounded-[36px] p-4 sm:p-8 border border-white/20 bg-gradient-to-br from-white/[0.12] via-white/[0.04] to-white/[0.09] shadow-[0_20px_70px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.35)] overflow-hidden">
        <div className="relative text-center mb-7">
          <h2 className="text-2xl sm:text-4xl font-display font-black">الاشتراكات</h2>
          <p className="mt-2 text-sm text-slate-300">اختر مرحلتك، شوف الباقات المتاحة، وفعّل اشتراكك بالكود اللي بتاخده من المدرس.</p>
        </div>
        {plans === undefined && <div className="text-center text-slate-400 text-sm flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> جاري التحميل…</div>}
        {plans === null && <div className="text-center text-red-300 text-sm mb-4">تعذر تحميل الباقات الآن. حاول مرة أخرى.</div>}
        {plans !== undefined && (
          <div className="relative grid grid-cols-1 sm:grid-cols-3 gap-5 sm:gap-6">
            {GRADES.map(g => (
              <GradeColumn key={g.id} g={g} plans={(plans || []).filter(p => !p.grade || p.grade === g.id)} mine={mine} student={currentStudent}
                onOpenLoginModal={onOpenLoginModal} onChanged={() => { load(); onChanged(); }} />
            ))}
          </div>
        )}
        <p className="relative mt-5 text-center text-[11px] text-slate-400">الدفع الإلكتروني غير مفعّل حالياً. التفعيل بكود من المدرس.</p>
      </div>
    </section>
  );
};
