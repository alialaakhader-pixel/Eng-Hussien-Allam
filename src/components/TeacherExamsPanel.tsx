import React, { useState } from 'react';
import { Plus, Trash2, ClipboardList, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import { Exam, ExamQuestion, ExamResultRow, GradeType, StudentUser } from '../types';

interface Props {
  exams: Exam[];
  results: ExamResultRow[];
  students: StudentUser[];
  onSave: (exam: Exam) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onDeleteResult: (id: string) => Promise<void>;
}

const LETTERS = ['أ', 'ب', 'ج', 'د', 'هـ', 'و'];

interface DraftQ { question: string; options: string[]; correctIndex: number; explanation: string }
const newQ = (): DraftQ => ({ question: '', options: ['', '', '', ''], correctIndex: 0, explanation: '' });

const inp = 'w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500';

export const TeacherExamsPanel: React.FC<Props> = ({ exams, results, students, onSave, onDelete, onDeleteResult }) => {
  const [title, setTitle] = useState('');
  const [grade, setGrade] = useState<GradeType>('3ث');
  const [duration, setDuration] = useState(30);
  const [qs, setQs] = useState<DraftQ[]>([newQ()]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const nameOf = (code: string) => {
    const s = students.find(x => x.codeUsed === code);
    const label = code.startsWith('ID') ? code.slice(2) : code;
    return s ? `${s.name || 'بدون اسم'} (${label})` : label;
  };

  const setQ = (i: number, patch: Partial<DraftQ>) => setQs(a => a.map((q, k) => (k === i ? { ...q, ...patch } : q)));

  const publish = async () => {
    setMsg('');
    if (!title.trim()) { setMsg('⚠️ اكتب عنوان الامتحان.'); return; }
    const questions: ExamQuestion[] = [];
    for (let i = 0; i < qs.length; i++) {
      const q = qs[i];
      const opts = q.options.map(o => o.trim());
      if (!q.question.trim()) { setMsg(`⚠️ السؤال ${i + 1}: اكتب نص السؤال.`); return; }
      if (opts.filter(Boolean).length < 2) { setMsg(`⚠️ السؤال ${i + 1}: لازم اختيارين على الأقل.`); return; }
      if (!opts[q.correctIndex]) { setMsg(`⚠️ السؤال ${i + 1}: الإجابة الصحيحة المحددة فاضية.`); return; }
      // drop empty trailing options but keep the correct index aligned
      const keep = opts.map((o, k) => ({ o, k })).filter(x => x.o);
      questions.push({
        id: `q${i + 1}`,
        question: q.question.trim(),
        options: keep.map(x => x.o),
        correctIndex: keep.findIndex(x => x.k === q.correctIndex),
        explanation: q.explanation.trim()
      });
    }
    setBusy(true);
    try {
      await onSave({ id: 'exam-' + Date.now(), title: title.trim(), grade, durationMin: Math.max(1, duration || 30), questions });
      setTitle(''); setQs([newQ()]);
      setMsg('✅ تم نشر الامتحان وظهر لطلبة المرحلة فوراً.');
    } catch (e: any) { setMsg('⚠️ ' + (e?.message || 'تعذر نشر الامتحان')); }
    setBusy(false);
  };

  return (
    <div className="grid lg:grid-cols-5 gap-6">
      {/* builder */}
      <div className="lg:col-span-3 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
            <ClipboardList className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-display font-black text-white">إنشاء امتحان جديد</h3>
            <p className="text-xs text-slate-400">حدد الإجابة الصحيحة لكل سؤال، والتصحيح بيتم تلقائياً للطالب.</p>
          </div>
        </div>

        <input className={inp} placeholder="عنوان الامتحان (مثال: امتحان الباب الأول)" value={title} onChange={e => setTitle(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <select className={inp} value={grade} onChange={e => setGrade(e.target.value as GradeType)}>
            <option value="1ث">أولى ثانوي</option>
            <option value="2ث">ثانية ثانوي</option>
            <option value="3ث">ثالثة ثانوي</option>
          </select>
          <div className="relative">
            <input type="number" min={1} className={inp} value={duration} onChange={e => setDuration(Number(e.target.value))} />
            <span className="absolute left-3 top-2.5 text-xs text-slate-500">دقيقة</span>
          </div>
        </div>

        {qs.map((q, i) => (
          <div key={i} className="bg-slate-800/60 border border-slate-700 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-amber-400">السؤال {i + 1}</span>
              {qs.length > 1 && (
                <button onClick={() => setQs(a => a.filter((_, k) => k !== i))} className="text-red-400 hover:text-red-300">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
            <textarea className={inp + ' min-h-[64px]'} placeholder="نص السؤال" value={q.question} onChange={e => setQ(i, { question: e.target.value })} />
            {q.options.map((o, oi) => (
              <div key={oi} className="flex items-center gap-2">
                <input type="radio" name={`correct-${i}`} checked={q.correctIndex === oi} onChange={() => setQ(i, { correctIndex: oi })} className="accent-emerald-500" title="الإجابة الصحيحة" />
                <span className="text-xs text-slate-400 w-5">{LETTERS[oi]}</span>
                <input className={inp} placeholder={`الاختيار ${LETTERS[oi]}`} value={o}
                  onChange={e => setQ(i, { options: q.options.map((x, k) => (k === oi ? e.target.value : x)) })} />
              </div>
            ))}
            <p className="text-[11px] text-emerald-400">الدائرة المحددة = الإجابة الصحيحة</p>
            <input className={inp} placeholder="شرح الإجابة (اختياري، بيظهر للطالب بعد التسليم)" value={q.explanation} onChange={e => setQ(i, { explanation: e.target.value })} />
          </div>
        ))}

        <button onClick={() => setQs(a => [...a, newQ()])} className="flex items-center gap-2 text-xs font-bold text-amber-400 hover:text-amber-300">
          <Plus className="w-4 h-4" /> إضافة سؤال
        </button>

        {msg && <p className="text-xs text-amber-300">{msg}</p>}
        <button onClick={publish} disabled={busy}
          className="w-full bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black py-3 rounded-xl text-sm shadow-lg shadow-amber-500/25 disabled:opacity-50">
          {busy ? 'جاري النشر...' : `نشر الامتحان (${qs.length} سؤال) 🚀`}
        </button>
      </div>

      {/* list + results */}
      <div className="lg:col-span-2 space-y-4">
        <h3 className="font-display font-black text-white">الامتحانات المنشورة ({exams.length})</h3>
        {exams.length === 0 && <p className="text-sm text-slate-500 bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center">لم تنشر أي امتحان بعد.</p>}
        {exams.map(ex => {
          const rs = results.filter(r => r.examId === ex.id);
          const avg = rs.length ? Math.round((rs.reduce((t, r) => t + (r.total ? r.score / r.total : 0), 0) / rs.length) * 100) : 0;
          const open = openId === ex.id;
          return (
            <div key={ex.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="font-bold text-sm text-white">{ex.title}</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">{ex.grade} · {ex.questions.length} سؤال · {ex.durationMin} د · {rs.length} طالب سلّم{rs.length ? ` · متوسط ${avg}%` : ''}</p>
                </div>
                <button onClick={() => { if (window.confirm('حذف الامتحان مع كل نتائجه؟')) onDelete(ex.id); }} className="text-red-400 hover:text-red-300">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <button onClick={() => setOpenId(open ? null : ex.id)} className="mt-3 flex items-center gap-1 text-xs font-bold text-amber-400">
                نتائج الطلبة {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
              {open && (
                <div className="mt-2 divide-y divide-slate-800/70">
                  {rs.length === 0 && <p className="text-xs text-slate-500 py-2">لا توجد نتائج بعد.</p>}
                  {rs.map(r => (
                    <div key={r.id} className="py-2 flex items-center justify-between gap-2 text-xs">
                      <span className="text-slate-200">{nameOf(r.code)}</span>
                      <span className="font-mono font-black text-emerald-400">{r.score}/{r.total}</span>
                      <button title="السماح بمحاولة جديدة"
                        onClick={() => { if (window.confirm('حذف النتيجة وإتاحة محاولة جديدة للطالب؟')) onDeleteResult(r.id); }}
                        className="text-amber-400 hover:text-amber-300"><RotateCcw className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
