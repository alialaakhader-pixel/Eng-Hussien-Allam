import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, BadgeCheck, CheckCircle2, KeyRound, Loader2, LogIn } from 'lucide-react';
import { MySubscription, StudentUser } from '../types';
import * as api from '../services/api';
import { formatCairo } from '../utils/progress';

const GRADES = [
  { id: '1ث', label: 'الصف الأول الثانوي', short: 'أولى ثانوي', src: '/grades/grade-1.webp', alt: 'المهندس حسين علام - فيزياء الصف الأول الثانوي' },
  { id: '2ث', label: 'الصف الثاني الثانوي', short: 'ثانية ثانوي', src: '/grades/grade-2.webp', alt: 'المهندس حسين علام - فيزياء الصف الثاني الثانوي' },
  { id: '3ث', label: 'الصف الثالث الثانوي', short: 'ثالثة ثانوي', src: '/grades/grade-3.webp', alt: 'المهندس حسين علام - فيزياء الصف الثالث الثانوي' }
];

interface Props { currentStudent: StudentUser | null; onOpenLoginModal: () => void; onChanged: () => void }

const GradeColumn: React.FC<{
  g: typeof GRADES[number]; plans: api.PublicPlan[]; mine: MySubscription[]; student: StudentUser | null;
  onOpenLoginModal: () => void; onChanged: () => void;
}> = ({ g, plans, mine, student, onOpenLoginModal, onChanged }) => {
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const mineHere = student?.grade === g.id;

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
