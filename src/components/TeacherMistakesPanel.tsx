import React, { useEffect, useState } from 'react';
import { BookX, Loader2 } from 'lucide-react';
import { TeacherMistakesOverview } from '../types';
import * as api from '../services/api';
import { formatCairo } from '../utils/progress';

export const TeacherMistakesPanel: React.FC = () => {
  const [d, setD] = useState<TeacherMistakesOverview | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => { api.teacherMistakesOverview().then(setD).catch(e => setErr(e.message)); }, []);

  return (
    <section className="rounded-3xl bg-slate-900 border border-slate-800 p-5 space-y-4 text-white">
      <div className="flex items-center gap-2"><BookX className="w-5 h-5 text-amber-400" /><h3 className="text-lg font-black">أخطاء الطلاب</h3></div>
      {err && <div className="text-xs text-red-300">{err}</div>}
      {!d && !err && <div className="text-slate-400 text-sm flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> جاري التحميل…</div>}
      {d && (
        <>
          <div>
            <div className="text-sm font-bold mb-2">أكثر الدروس اللي بيخطأ فيها الطلاب</div>
            {d.topLessons.length === 0 && <div className="text-xs text-slate-400">لا توجد أخطاء مسجلة بعد.</div>}
            <div className="space-y-1.5">
              {d.topLessons.map(l => (
                <div key={l.lesson} className="flex items-center justify-between rounded-xl bg-slate-800/50 border border-slate-800 px-3 py-2 text-xs">
                  <span className="font-bold">{l.lesson}</span>
                  <span className="text-slate-300">{l.mistakes} خطأ · {l.students} طالب{l.max_repeat > 1 ? ` · أعلى تكرار ${l.max_repeat}` : ''}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="text-sm font-bold mb-2">مراجعة الطلاب لأخطائهم</div>
            <div className="space-y-1.5">
              {d.students.map(s => (
                <div key={s.code} className={`rounded-xl border px-3 py-2 text-xs flex flex-wrap items-center justify-between gap-2 ${s.not_reviewing ? 'border-red-500/40 bg-red-500/5' : 'border-slate-800 bg-slate-800/40'}`}>
                  <span className="font-bold">{s.name} <span className="text-slate-500 font-mono text-[11px]">{s.code}</span></span>
                  <span className="text-slate-300">{s.total} خطأ · {s.unreviewed} لم تُراجَع · {s.mastered} أُتقنت · {s.exams_taken} امتحان</span>
                  <span className={s.not_reviewing ? 'text-red-300 font-bold' : 'text-slate-500'}>{s.not_reviewing ? 'لا يراجع أخطاءه' : s.last_review ? `آخر مراجعة ${formatCairo(s.last_review)}` : 'لم يراجع بعد'}</span>
                </div>
              ))}
              {d.students.length === 0 && <div className="text-xs text-slate-400">لا يوجد طلاب لديهم أخطاء بعد.</div>}
            </div>
          </div>
        </>
      )}
    </section>
  );
};
