import React from 'react';
import { Plus, Trash2, FlaskConical } from 'lucide-react';
import { LessonLaw, LawVariable } from '../types';
import { lawError, syncVariables } from '../utils/laws';

interface Props { laws: LessonLaw[]; onChange: (l: LessonLaw[]) => void }

const PRESETS: { title: string; formula: string; resultName: string; resultUnit: string; vars: Record<string, Partial<LawVariable>> }[] = [
  { title: 'قانون أوم', formula: 'V = I * R', resultName: 'فرق الجهد', resultUnit: 'V',
    vars: { I: { name: 'التيار', unit: 'A', min: 0.1, max: 10, step: 0.1, value: 2 }, R: { name: 'المقاومة', unit: 'Ω', min: 1, max: 100, step: 1, value: 10 } } },
  { title: 'قانون نيوتن الثاني', formula: 'F = m * a', resultName: 'القوة', resultUnit: 'N',
    vars: { m: { name: 'الكتلة', unit: 'kg', min: 1, max: 100, step: 1, value: 10 }, a: { name: 'العجلة', unit: 'm/s²', min: 0.5, max: 20, step: 0.5, value: 2 } } },
  { title: 'طاقة الحركة', formula: 'KE = 0.5 * m * v^2', resultName: 'طاقة الحركة', resultUnit: 'J',
    vars: { m: { name: 'الكتلة', unit: 'kg', min: 1, max: 50, step: 1, value: 5 }, v: { name: 'السرعة', unit: 'm/s', min: 1, max: 30, step: 1, value: 10 } } },
  { title: 'القوة المغناطيسية على سلك', formula: 'F = B * I * L * sind(theta)', resultName: 'القوة', resultUnit: 'N',
    vars: { B: { name: 'الكثافة المغناطيسية', unit: 'T', min: 0.1, max: 5, step: 0.1, value: 1 }, I: { name: 'التيار', unit: 'A', min: 1, max: 20, step: 1, value: 5 },
            L: { name: 'الطول', unit: 'm', min: 0.1, max: 5, step: 0.1, value: 1 }, theta: { name: 'الزاوية', unit: '°', min: 0, max: 90, step: 1, value: 90 } } }
];

const uid = () => Math.random().toString(36).slice(2, 9);
const inp = 'w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500';

export const LawsEditor: React.FC<Props> = ({ laws, onChange }) => {
  const update = (id: string, patch: Partial<LessonLaw>) =>
    onChange(laws.map(l => (l.id === id ? { ...l, ...patch } : l)));

  const setFormula = (l: LessonLaw, formula: string) =>
    update(l.id, { formula, variables: syncVariables(formula, l.variables) });

  const setVar = (l: LessonLaw, sym: string, patch: Partial<LawVariable>) =>
    update(l.id, { variables: l.variables.map(v => (v.symbol === sym ? { ...v, ...patch } : v)) });

  const addPreset = (i: number) => {
    const p = PRESETS[i];
    const base = syncVariables(p.formula, []);
    onChange([...laws, { id: uid(), title: p.title, formula: p.formula, resultName: p.resultName, resultUnit: p.resultUnit,
      variables: base.map(v => ({ ...v, ...(p.vars[v.symbol] || {}) })) }]);
  };

  const num = (s: string, fb: number) => { const n = parseFloat(s); return Number.isFinite(n) ? n : fb; };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-bold text-white">
        <FlaskConical className="w-4 h-4 text-amber-400" />
        6. قوانين الدرس لسبورة المحاكاة (اختياري)
      </div>
      <p className="text-[11px] text-slate-400">اكتب القانون مثل <span dir="ltr" className="font-mono text-amber-300">V = I * R</span> وستظهر للطالب أشرطة تحكم ونتيجة لحظية.</p>

      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p, i) => (
          <button key={p.title} type="button" onClick={() => addPreset(i)}
            className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-[11px] text-slate-200 hover:border-amber-500 transition">
            + {p.title}
          </button>
        ))}
        <button type="button" onClick={() => onChange([...laws, { id: uid(), title: '', formula: '', resultName: '', resultUnit: '', variables: [] }])}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950 text-[11px] font-bold">
          <Plus className="w-3 h-3" /> قانون جديد
        </button>
      </div>

      {laws.map(l => {
        const err = l.formula ? lawError(l) : null;
        return (
          <div key={l.id} className="rounded-xl border border-slate-700 bg-slate-900/60 p-3 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <input className={inp} placeholder="اسم القانون" value={l.title} onChange={e => update(l.id, { title: e.target.value })} />
              <input className={inp + ' font-mono'} dir="ltr" placeholder="V = I * R" value={l.formula} onChange={e => setFormula(l, e.target.value)} />
              <input className={inp} placeholder="اسم الناتج (فرق الجهد)" value={l.resultName} onChange={e => update(l.id, { resultName: e.target.value })} />
              <input className={inp} dir="ltr" placeholder="وحدة الناتج (V)" value={l.resultUnit} onChange={e => update(l.id, { resultUnit: e.target.value })} />
            </div>
            {err && <div className="text-[11px] text-red-400">{err}</div>}
            {l.variables.map(v => (
              <div key={v.symbol} className="grid grid-cols-6 gap-1.5 items-center">
                <span className="font-mono text-amber-300 text-xs text-center" dir="ltr">{v.symbol}</span>
                <input className={inp} placeholder="الاسم" value={v.name} onChange={e => setVar(l, v.symbol, { name: e.target.value })} />
                <input className={inp} dir="ltr" placeholder="وحدة" value={v.unit} onChange={e => setVar(l, v.symbol, { unit: e.target.value })} />
                <input className={inp} dir="ltr" type="number" title="أقل قيمة" value={v.min} onChange={e => setVar(l, v.symbol, { min: num(e.target.value, v.min) })} />
                <input className={inp} dir="ltr" type="number" title="أعلى قيمة" value={v.max} onChange={e => setVar(l, v.symbol, { max: num(e.target.value, v.max) })} />
                <input className={inp} dir="ltr" type="number" title="القيمة الابتدائية" value={v.value} onChange={e => setVar(l, v.symbol, { value: num(e.target.value, v.value) })} />
              </div>
            ))}
            {l.variables.length > 0 && <div className="text-[10px] text-slate-500">الأعمدة: الرمز • الاسم • الوحدة • أقل • أعلى • ابتدائية</div>}
            <button type="button" onClick={() => onChange(laws.filter(x => x.id !== l.id))}
              className="inline-flex items-center gap-1 text-[11px] text-red-400 hover:text-red-300">
              <Trash2 className="w-3 h-3" /> حذف القانون
            </button>
          </div>
        );
      })}
    </div>
  );
};
