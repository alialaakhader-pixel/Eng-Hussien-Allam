import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ClipboardList, Clock, CheckCircle2, XCircle, Award, ChevronRight, Send, LogIn } from 'lucide-react';
import { Exam, ExamResult, StudentUser } from '../types';

interface ExamsViewProps {
  exams: Exam[];
  results: ExamResult[];
  currentStudent: StudentUser | null;
  onOpenLoginModal: () => void;
  onSubmit: (examId: string, answers: (number | null)[]) => Promise<{ ok: boolean; error?: string; result?: ExamResult }>;
}

const LETTERS = ['أ', 'ب', 'ج', 'د', 'هـ', 'و'];

const fmtTime = (sec: number) => {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

export const ExamsView: React.FC<ExamsViewProps> = ({ exams, results, currentStudent, onOpenLoginModal, onSubmit }) => {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [left, setLeft] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submittedRef = useRef(false);

  const resultOf = (id: string) => results.find(r => r.examId === id);
  const active = exams.find(e => e.id === activeId) || null;
  const activeResult = activeId ? resultOf(activeId) : undefined;

  const start = (exam: Exam) => {
    submittedRef.current = false;
    setAnswers(exam.questions.map(() => null));
    setLeft(Math.max(1, exam.durationMin) * 60);
    setError('');
    setActiveId(exam.id);
  };

  const taking = !!active && !activeResult;

  const submit = async (auto = false) => {
    if (!active || submittedRef.current) return;
    if (!auto) {
      const unanswered = answers.filter(a => a === null).length;
      if (unanswered > 0 && !window.confirm(`لسه ${unanswered} سؤال بدون إجابة. تسلّم الامتحان؟`)) return;
    }
    submittedRef.current = true;
    setBusy(true);
    setError('');
    const r = await onSubmit(active.id, answers);
    setBusy(false);
    if (!r.ok) {
      submittedRef.current = false;
      setError(r.error || 'تعذر تسليم الامتحان.');
    }
  };

  useEffect(() => {
    if (!taking) return;
    const id = setInterval(() => setLeft(v => (v > 0 ? v - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [taking, activeId]);

  useEffect(() => {
    if (taking && left === 0) submit(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left, taking]);

  const sorted = useMemo(() => exams, [exams]);

  if (!currentStudent) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center text-white">
        <ClipboardList className="w-12 h-12 text-amber-400 mx-auto mb-4" />
        <h2 className="text-xl font-black mb-2">الامتحانات للمشتركين فقط</h2>
        <p className="text-sm text-slate-400 mb-6">سجّل دخولك بحسابك عشان تشوف امتحانات مرحلتك وتتصحح تلقائياً.</p>
        <button
          onClick={onOpenLoginModal}
          className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-6 py-3 rounded-xl text-sm"
        >
          <LogIn className="w-4 h-4" /> تسجيل الدخول
        </button>
      </div>
    );
  }

  // ---------------- single exam (taking or review) ----------------
  if (active) {
    const review = activeResult;
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 text-white">
        <button
          onClick={() => setActiveId(null)}
          disabled={busy}
          className="flex items-center gap-1 text-xs text-slate-400 hover:text-amber-400 mb-4"
        >
          <ChevronRight className="w-4 h-4" /> كل الامتحانات
        </button>

        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-7 mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-display font-black">{active.title}</h2>
            <p className="text-xs text-slate-400 mt-1">{active.questions.length} سؤال · {active.durationMin} دقيقة</p>
          </div>
          {review ? (
            <div className="text-center bg-emerald-500/10 border border-emerald-500/30 rounded-2xl px-5 py-2">
              <span className="text-[11px] text-emerald-300 block">درجتك</span>
              <span className="text-2xl font-black font-mono text-emerald-400">{review.score} / {review.total}</span>
            </div>
          ) : (
            <div className={`flex items-center gap-2 px-4 py-2 rounded-2xl border font-mono font-black text-lg ${
              left <= 60 ? 'bg-red-500/15 border-red-500/40 text-red-400' : 'bg-slate-800 border-slate-700 text-amber-400'
            }`}>
              <Clock className="w-5 h-5" /> {fmtTime(left)}
            </div>
          )}
        </div>

        <div className="space-y-5">
          {active.questions.map((q, qi) => {
            const chosen = review ? review.answers[qi] ?? null : answers[qi];
            const rv = review?.review[qi];
            return (
              <div key={q.id || qi} className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6">
                <p className="font-bold text-sm sm:text-base leading-relaxed mb-4">
                  <span className="text-amber-400 font-mono ml-2">{qi + 1}.</span>{q.question}
                </p>
                <div className="space-y-2">
                  {q.options.map((opt, oi) => {
                    const isChosen = chosen === oi;
                    const isCorrect = rv ? Number(rv.correctIndex) === oi : false;
                    let cls = 'bg-slate-800/70 border-slate-700 hover:border-amber-500/60';
                    if (review) {
                      if (isCorrect) cls = 'bg-emerald-500/15 border-emerald-500/60';
                      else if (isChosen) cls = 'bg-red-500/15 border-red-500/60';
                      else cls = 'bg-slate-800/40 border-slate-800 opacity-70';
                    } else if (isChosen) {
                      cls = 'bg-amber-500/15 border-amber-500';
                    }
                    return (
                      <button
                        key={oi}
                        type="button"
                        disabled={!!review || busy}
                        onClick={() => setAnswers(a => a.map((v, i) => (i === qi ? oi : v)))}
                        className={`w-full text-right flex items-center gap-3 px-4 py-3 rounded-xl border text-sm transition ${cls}`}
                      >
                        <span className="w-6 h-6 rounded-full border border-slate-500 flex items-center justify-center text-[11px] font-bold shrink-0">
                          {review && isCorrect ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> :
                           review && isChosen ? <XCircle className="w-4 h-4 text-red-400" /> :
                           LETTERS[oi] || String(oi + 1)}
                        </span>
                        <span className="flex-1">{opt}</span>
                      </button>
                    );
                  })}
                </div>
                {review && rv?.explanation && (
                  <p className="mt-3 text-xs text-sky-300 bg-sky-500/10 border border-sky-500/20 rounded-xl p-3 leading-relaxed">
                    💡 {rv.explanation}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {!review && (
          <div className="mt-6">
            {error && <p className="text-xs text-red-400 mb-3">{error}</p>}
            <button
              onClick={() => submit(false)}
              disabled={busy}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black py-3.5 rounded-xl text-sm shadow-lg shadow-amber-500/25 disabled:opacity-50"
            >
              <Send className="w-4 h-4" /> {busy ? 'جاري التصحيح...' : 'تسليم الامتحان'}
            </button>
          </div>
        )}
      </div>
    );
  }

  // ---------------- exams list ----------------
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 text-white">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center">
          <ClipboardList className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-2xl font-display font-black">الامتحانات</h2>
          <p className="text-xs text-slate-400">بتتصحح تلقائياً وتتحفظ درجتك في حسابك. لكل امتحان محاولة واحدة.</p>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="text-center py-16 text-slate-500 text-sm bg-slate-900 border border-slate-800 rounded-3xl">
          لا توجد امتحانات متاحة لمرحلتك حالياً.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {sorted.map(ex => {
            const r = resultOf(ex.id);
            return (
              <div key={ex.id} className="bg-slate-900 border border-slate-800 rounded-3xl p-5 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-sm leading-snug">{ex.title}</h3>
                  {r && <Award className="w-5 h-5 text-emerald-400 shrink-0" />}
                </div>
                <p className="text-xs text-slate-400">{ex.questions.length} سؤال · {ex.durationMin} دقيقة</p>
                {r ? (
                  <div className="flex items-center justify-between mt-auto">
                    <span className="text-lg font-black font-mono text-emerald-400">{r.score} / {r.total}</span>
                    <button onClick={() => setActiveId(ex.id)} className="text-xs font-bold text-amber-400 hover:text-amber-300">
                      مراجعة الإجابات
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => start(ex)}
                    className="mt-auto bg-amber-500 hover:bg-amber-400 text-slate-950 font-black py-2.5 rounded-xl text-xs"
                  >
                    ابدأ الامتحان
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
