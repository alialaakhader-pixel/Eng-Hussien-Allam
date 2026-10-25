import React from 'react';
import { ArrowLeft, Sparkles } from 'lucide-react';

interface GradesShowcaseProps {
  onPick: () => void;
}

const GRADES = [
  { id: '1ث', label: 'الصف الأول الثانوي', short: 'أولى ثانوي', src: '/grades/grade-1.webp', alt: 'المهندس حسين علام - فيزياء الصف الأول الثانوي بكالوريا' },
  { id: '2ث', label: 'الصف الثاني الثانوي', short: 'ثانية ثانوي', src: '/grades/grade-2.webp', alt: 'المهندس حسين علام - فيزياء الصف الثاني الثانوي بكالوريا' },
  { id: '3ث', label: 'الصف الثالث الثانوي', short: 'ثالثة ثانوي', src: '/grades/grade-3.webp', alt: 'المهندس حسين علام - فيزياء الصف الثالث الثانوي' }
];

export const GradesShowcase: React.FC<GradesShowcaseProps> = ({ onPick }) => {
  return (
    <section className="px-4 sm:px-6 lg:px-8 text-white">
      <div className="relative max-w-7xl mx-auto rounded-[36px] p-4 sm:p-8 border border-white/20 bg-gradient-to-br from-white/[0.12] via-white/[0.04] to-white/[0.09] shadow-[0_20px_70px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.35)] overflow-hidden">
        {/* glass sheen + glow */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.06] to-transparent" />
        <div className="pointer-events-none absolute -top-24 right-10 w-72 h-72 rounded-full bg-amber-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-10 w-72 h-72 rounded-full bg-sky-500/15 blur-3xl" />

        <div className="relative text-center mb-7">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/20 text-amber-300 text-xs font-bold">
            <Sparkles className="w-4 h-4" />
            <span>فيزياء · المهندس حسين علام</span>
          </div>
          <h2 className="mt-3 text-2xl sm:text-4xl font-display font-black">اختر مرحلتك الدراسية</h2>
          <p className="mt-2 text-sm text-slate-300">كل مرحلة ليها محاضراتها وامتحاناتها الخاصة، وبتفتح بعد تسجيل دخولك وتفعيل حسابك.</p>
        </div>

        <div className="relative grid grid-cols-1 sm:grid-cols-3 gap-5 sm:gap-6">
          {GRADES.map(g => (
            <button
              key={g.id}
              type="button"
              onClick={onPick}
              className="group relative text-right rounded-[28px] p-2.5 border border-white/25 bg-gradient-to-br from-white/[0.18] via-white/[0.06] to-white/[0.12] shadow-[0_12px_40px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.4)] transition-transform duration-300 hover:-translate-y-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              aria-label={`افتح محاضرات ${g.label}`}
            >
              <div className="relative overflow-hidden rounded-[20px] ring-1 ring-white/20 bg-slate-950">
                <img
                  src={g.src}
                  alt={g.alt}
                  width={1024}
                  height={1024}
                  loading="lazy"
                  decoding="async"
                  className="block w-full h-auto aspect-square object-cover"
                />
                {/* glass reflection over the photo */}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-transparent opacity-60" />
              </div>

              <div className="flex items-center justify-between gap-2 px-2.5 pt-3 pb-1.5">
                <div className="leading-tight">
                  <span className="block text-[11px] text-amber-300 font-bold">{g.short}</span>
                  <span className="block text-sm font-black">{g.label}</span>
                </div>
                <span className="flex items-center gap-1.5 text-xs font-black text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 px-3 py-2 rounded-xl shadow-lg shadow-amber-500/25 group-hover:from-amber-300 group-hover:to-amber-400 transition-colors">
                  ادخل الآن
                  <ArrowLeft className="w-3.5 h-3.5" />
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};
