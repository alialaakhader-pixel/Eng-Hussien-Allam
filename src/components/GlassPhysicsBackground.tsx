import React from 'react';

export const GlassPhysicsBackground: React.FC = () => {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 select-none transform-gpu">
      
      {/* 1. Glass Rutherford-Bohr Atom (Top Right) */}
      <div className="absolute -top-12 -right-12 w-80 h-80 sm:w-96 sm:h-96 opacity-35 dark:opacity-40 animate-spin-slow will-change-transform">
        <div className="relative w-full h-full">
          {/* Orbit 1 */}
          <div className="absolute inset-0 rounded-[50%] border-2 border-amber-400/40 rotate-[35deg] shadow-[0_0_25px_rgba(245,158,11,0.2)]" />
          {/* Orbit 2 */}
          <div className="absolute inset-4 rounded-[50%] border-2 border-sky-400/40 rotate-[-45deg] shadow-[0_0_25px_rgba(56,189,248,0.2)]" />
          {/* Orbit 3 */}
          <div className="absolute inset-8 rounded-[50%] border-2 border-emerald-400/30 rotate-[85deg]" />
          {/* Glass Nucleus */}
          <div className="absolute inset-0 m-auto w-14 h-14 rounded-full bg-gradient-to-tr from-amber-500/50 to-orange-500/40 border border-white/30 shadow-[0_0_35px_rgba(245,158,11,0.5)] flex items-center justify-center">
            <span className="text-white/80 font-mono font-bold text-xs">⚛</span>
          </div>
          {/* Floating electron bead */}
          <div className="absolute top-10 left-12 w-3 h-3 rounded-full bg-amber-300 shadow-[0_0_12px_#fde047]" />
        </div>
      </div>

      {/* 2. Glass Prism with Refraction Spectrum (Mid Left) */}
      <div className="absolute top-1/3 -left-14 w-64 h-64 opacity-30 dark:opacity-35">
        <div className="relative w-full h-full flex items-center justify-center">
          {/* Glass Triangular Prism */}
          <div className="w-48 h-48 rounded-3xl bg-gradient-to-br from-white/10 via-sky-500/10 to-purple-500/15 border border-white/20 shadow-2xl rotate-45 flex items-center justify-center">
            <div className="w-28 h-28 rounded-2xl border border-white/20 bg-white/5 flex items-center justify-center -rotate-45">
              <span className="text-2xl font-serif text-white/50 font-black">λ</span>
            </div>
          </div>
          {/* Rainbow dispersion gradient sheen */}
          <div className="absolute w-72 h-1.5 bg-gradient-to-r from-red-500/40 via-amber-400/40 to-blue-500/40 rotate-[25deg] translate-x-12" />
        </div>
      </div>

      {/* 3. Glass Ohm's Law Resistor & Circuit Symbol (Bottom Right) */}
      <div className="absolute bottom-24 -right-10 w-72 h-72 opacity-25 dark:opacity-30">
        <div className="relative w-full h-full p-6 rounded-3xl bg-slate-900/30 border border-white/10 shadow-xl flex flex-col justify-center items-center">
          {/* Ohm Greek letter Ω in frosted glass */}
          <span className="text-7xl font-serif text-amber-400/50 font-black drop-shadow-md">
            Ω
          </span>
          <div className="flex items-center gap-2 mt-2">
            <span className="h-0.5 w-12 bg-white/20" />
            <span className="text-[11px] font-mono font-bold text-amber-300/60 tracking-widest">
              V = I · R
            </span>
            <span className="h-0.5 w-12 bg-white/20" />
          </div>
          {/* Zigzag resistor glyph */}
          <svg className="w-40 h-8 mt-3 text-amber-400/50 stroke-current fill-none stroke-2" viewBox="0 0 100 20">
            <path d="M0 10 L15 10 L22 2 L36 18 L50 2 L64 18 L78 2 L85 10 L100 10" />
          </svg>
        </div>
      </div>

      {/* 4. Glass Magnetic Flux Loop & Lorentz Force (Mid Bottom Left) */}
      <div className="absolute -bottom-16 left-1/4 w-80 h-80 opacity-20 dark:opacity-30">
        <div className="relative w-full h-full rounded-full border border-sky-400/25 bg-sky-500/5 flex items-center justify-center shadow-[inset_0_0_40px_rgba(56,189,248,0.1)]">
          <div className="w-56 h-56 rounded-full border border-dashed border-sky-400/30 flex items-center justify-center">
            <div className="w-32 h-32 rounded-full border border-white/20 bg-slate-900/40 flex flex-col items-center justify-center text-center p-2">
              <span className="font-mono text-xs font-bold text-sky-300/80">F = B·I·L</span>
              <span className="text-[10px] text-slate-400">Lorentz</span>
            </div>
          </div>
          {/* N and S magnetic poles floating */}
          <div className="absolute -top-3 px-2 py-0.5 rounded bg-rose-500/40 border border-white/20 text-[9px] font-mono font-black text-white">
            N
          </div>
          <div className="absolute -bottom-3 px-2 py-0.5 rounded bg-blue-500/40 border border-white/20 text-[9px] font-mono font-black text-white">
            S
          </div>
        </div>
      </div>

      {/* 5. Glass Electromagnetic Sine Wave Curve (Center Across Background) */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120vw] h-40 opacity-15 dark:opacity-20 rotate-[-12deg] pointer-events-none">
        <svg className="w-full h-full stroke-amber-400/40 fill-none stroke-[1.5]" viewBox="0 0 1200 100" preserveAspectRatio="none">
          <path d="M0,50 Q150,0 300,50 T600,50 T900,50 T1200,50" />
          <path d="M0,50 Q150,100 300,50 T600,50 T900,50 T1200,50" strokeDasharray="6 6" />
        </svg>
      </div>

    </div>
  );
};
