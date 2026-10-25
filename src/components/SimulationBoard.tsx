import React, { useEffect, useMemo, useState } from 'react';
import { RotateCcw, FlaskConical, ArrowRight } from 'lucide-react';
import { Lesson, LessonLaw } from '../types';
import { evalLaw, fmtNum, isLawValid, parseFormula } from '../utils/laws';

interface Props {
  lesson: Lesson | null | undefined;
  onBack: () => void;
}

const initialValues = (law: LessonLaw) =>
  Object.fromEntries(law.variables.map(v => [v.symbol, v.value])) as Record<string, number>;

const Chart: React.FC<{ law: LessonLaw; values: Record<string, number> }> = ({ law, values }) => {
  const x = law.variables[0];
  const pts = useMemo(() => {
    if (!x) return [];
    const N = 40;
    const out: { x: number; y: number }[] = [];
    for (let i = 0; i <= N; i++) {
      const xv = x.min + ((x.max - x.min) * i) / N;
      const y = evalLaw(law, { ...values, [x.symbol]: xv });
      if (Number.isFinite(y)) out.push({ x: xv, y });
    }
    return out;
  }, [law, values, x]);
  if (!x || pts.length < 2) return null;

  const W = 320, H = 150, P = 18;
  const minY = Math.min(...pts.map(p => p.y)), maxY = Math.max(...pts.map(p => p.y));
  const spanY = maxY - minY || 1;
  const sx = (v: number) => P + ((v - x.min) / (x.max - x.min || 1)) * (W - 2 * P);
  const sy = (v: number) => H - P - ((v - minY) / spanY) * (H - 2 * P);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ');
  const cur = evalLaw(law, values);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="رسم بياني للقانون">
      <line x1={P} y1={H - P} x2={W - P} y2={H - P} stroke="#475569" />
      <line x1={P} y1={P} x2={P} y2={H - P} stroke="#475569" />
      <path d={d} fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" />
      {Number.isFinite(cur) && (
        <circle cx={sx(values[x.symbol])} cy={sy(Math.min(Math.max(cur, minY), maxY))} r="5" fill="#fbbf24" stroke="#0f172a" strokeWidth="2" />
      )}
      <text x={W - P} y={H - 4} textAnchor="end" fontSize="10" fill="#94a3b8">{x.symbol}</text>
      <text x={P + 4} y={P - 4} fontSize="10" fill="#94a3b8">{law.formula.split('=')[0].trim()}</text>
    </svg>
  );
};

export const SimulationBoard: React.FC<Props> = ({ lesson, onBack }) => {
  const laws = useMemo(() => (lesson?.laws || []).filter(isLawValid), [lesson]);
  const [idx, setIdx] = useState(0);
  const law = laws[Math.min(idx, laws.length - 1)];
  const [values, setValues] = useState<Record<string, number>>(() => (law ? initialValues(law) : {}));

  useEffect(() => { setIdx(0); }, [lesson?.id]);
  useEffect(() => { if (law) setValues(initialValues(law)); }, [law?.id, lesson?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const backBtn = (
    <button type="button" onClick={onBack}
      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400 transition">
      <ArrowRight className="w-4 h-4" /> العودة للبث
    </button>
  );

  if (!law) {
    const pts = lesson?.keyPoints || [];
    return (
      <div className="w-full min-h-[28rem] bg-slate-900 flex flex-col items-center justify-center p-6 text-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center">
          <FlaskConical className="w-7 h-7" />
        </div>
        <h3 className="text-lg font-display font-black text-white">سبورة المحاكاة</h3>
        <p className="text-xs text-slate-300 max-w-sm leading-relaxed">
          لم يضف المدرس قوانين تفاعلية لهذا الدرس بعد. بمجرد إضافتها ستظهر هنا بمتغيرات تتحكم فيها لحظياً.
        </p>
        {pts.length > 0 && (
          <ul className="text-xs text-slate-200 space-y-1 max-w-sm text-right list-disc pr-5">
            {pts.slice(0, 6).map((k, i) => <li key={i}>{k}</li>)}
          </ul>
        )}
        {backBtn}
      </div>
    );
  }

  const result = evalLaw(law, values);
  const resSym = (() => { try { return parseFormula(law.formula).result; } catch { return 'y'; } })();

  return (
    <div className="w-full min-h-[28rem] bg-slate-900 p-4 sm:p-6 text-white" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <FlaskConical className="w-5 h-5 text-amber-400" />
          <h3 className="font-display font-black text-sm sm:text-base">سبورة المحاكاة — {lesson?.title}</h3>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setValues(initialValues(law))}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs font-bold hover:bg-slate-700 transition">
            <RotateCcw className="w-3.5 h-3.5" /> إعادة
          </button>
          {backBtn}
        </div>
      </div>

      {laws.length > 1 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {laws.map((l, i) => (
            <button key={l.id} type="button" onClick={() => setIdx(i)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${i === idx ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300 hover:text-white'}`}>
              {l.title || l.formula}
            </button>
          ))}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-4">
          <div className="rounded-2xl bg-slate-800/60 border border-slate-700 p-4 text-center">
            <div className="text-[11px] text-slate-400 mb-1">{law.title}</div>
            <div dir="ltr" className="text-2xl sm:text-3xl font-mono font-black text-amber-300 break-words">{law.formula}</div>
          </div>
          {law.variables.map(v => (
            <div key={v.symbol} className="rounded-xl bg-slate-800/40 border border-slate-700/60 p-3">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-bold text-slate-200">{v.name || v.symbol} <span className="font-mono text-amber-400" dir="ltr">({v.symbol})</span></span>
                <span className="font-mono font-black text-white" dir="ltr">{fmtNum(values[v.symbol])} {v.unit}</span>
              </div>
              <input
                type="range" dir="ltr" min={v.min} max={v.max} step={v.step || 1}
                value={values[v.symbol] ?? v.value}
                onChange={e => setValues(s => ({ ...s, [v.symbol]: parseFloat(e.target.value) }))}
                className="w-full accent-amber-500"
                aria-label={v.name || v.symbol}
              />
            </div>
          ))}
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl bg-amber-500/10 border border-amber-500/40 p-4 text-center">
            <div className="text-xs text-amber-200 mb-1">{law.resultName || 'الناتج'}</div>
            <div dir="ltr" className="text-4xl font-mono font-black text-amber-300">
              {resSym} = {fmtNum(result)} <span className="text-lg text-amber-200">{law.resultUnit}</span>
            </div>
          </div>
          <div className="rounded-2xl bg-slate-800/40 border border-slate-700/60 p-3">
            <Chart law={law} values={values} />
            <p className="text-[11px] text-slate-400 text-center mt-1">
              العلاقة بين {law.variables[0]?.symbol} و {resSym} مع ثبات باقي المتغيرات
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
