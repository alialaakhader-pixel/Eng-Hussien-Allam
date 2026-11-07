import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Download, Loader2, RefreshCw } from 'lucide-react';
import { ExamResultRow, StudentAnalyticsRow } from '../types';
import * as api from '../services/api';
import { addDays, cairoDay, fmtMinutes, formatCairo } from '../utils/progress';

interface Props { examResults: ExamResultRow[] }

interface Thresholds { absentDays: number; minWatchMin7d: number; dropPoints: number }
const TH_KEY = 'ha_teacher_alert_thresholds_v1';
const DEFAULT_TH: Thresholds = { absentDays: 5, minWatchMin7d: 30, dropPoints: 15 };
const loadTh = (): Thresholds => { try { return { ...DEFAULT_TH, ...JSON.parse(localStorage.getItem(TH_KEY) || '{}') }; } catch { return DEFAULT_TH; } };

const inp = 'w-20 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500';

const dayDiff = (a: string, b: string) => Math.round((Date.parse(a + 'T12:00:00Z') - Date.parse(b + 'T12:00:00Z')) / 86400000);

function csvCell(v: unknown) {
  const s = String(v ?? '');
  const safe = /^[=+\-@]/.test(s) ? "'" + s : s; // neutralise spreadsheet formulas
  return `"${safe.replace(/"/g, '""')}"`;
}

export const TeacherInsightsPanel: React.FC<Props> = ({ examResults }) => {
  const [rows, setRows] = useState<StudentAnalyticsRow[] | null>(null);
  const [error, setError] = useState('');
  const [grade, setGrade] = useState('all');
  const [th, setTh] = useState<Thresholds>(loadTh);

  const load = useCallback(async () => {
    setError(''); setRows(null);
    try { setRows(await api.teacherAnalytics()); } catch (e: any) { setError(e.message || 'تعذر تحميل البيانات.'); setRows([]); }
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { try { localStorage.setItem(TH_KEY, JSON.stringify(th)); } catch { /* ignore */ } }, [th]);

  const today = cairoDay();
  const shown = useMemo(() => (rows || []).filter(r => grade === 'all' || r.grade === grade), [rows, grade]);

  // Score trend per student from verified exam results (server graded)
  const drops = useMemo(() => {
    const by = new Map<string, ExamResultRow[]>();
    for (const r of examResults) { if (r.total > 0) (by.get(r.code) || by.set(r.code, []).get(r.code)!).push(r); }
    const out = new Map<string, { from: number; to: number }>();
    by.forEach((list, code) => {
      const s = [...list].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      if (s.length < 2) return;
      const prev = (s[s.length - 2].score / s[s.length - 2].total) * 100;
      const last = (s[s.length - 1].score / s[s.length - 1].total) * 100;
      if (prev - last >= th.dropPoints) out.set(code, { from: Math.round(prev), to: Math.round(last) });
    });
    return out;
  }, [examResults, th.dropPoints]);

  const alerts = useMemo(() => {
    const list: { code: string; name: string; kind: string; detail: string }[] = [];
    for (const r of shown) {
      const gone = r.last_attendance ? dayDiff(today, r.last_attendance) : null;
      if (gone === null) list.push({ code: r.code, name: r.name, kind: 'غياب', detail: 'لم يسجّل دخولاً بعد' });
      else if (gone >= th.absentDays) list.push({ code: r.code, name: r.name, kind: 'غياب', detail: `آخر دخول من ${gone} يوم` });
      if (gone !== null && gone < th.absentDays && r.watch_seconds_7d / 60 < th.minWatchMin7d)
        list.push({ code: r.code, name: r.name, kind: 'تقدم ضعيف', detail: `مشاهدة آخر 7 أيام: ${fmtMinutes(r.watch_seconds_7d)} (الحد ${th.minWatchMin7d} د)` });
      const d = drops.get(r.code);
      if (d) list.push({ code: r.code, name: r.name, kind: 'تراجع درجات', detail: `من ${d.from}% إلى ${d.to}% في آخر امتحانين` });
    }
    return list;
  }, [shown, drops, th, today]);

  const exportCsv = () => {
    const head = ['الكود', 'الاسم', 'الصف', 'أيام الدخول', 'آخر دخول', 'دقائق المشاهدة', 'مشاهدة 7 أيام (دقيقة)', 'محاضرات مكتملة', 'آخر نشاط'];
    const lines = [head.map(csvCell).join(',')].concat(shown.map(r => [
      r.code, r.name, r.grade, r.attendance_days, r.last_attendance || '', Math.round(r.watch_seconds / 60),
      Math.round(r.watch_seconds_7d / 60), r.completed_lectures, r.last_activity || ''
    ].map(csvCell).join(',')));
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `students-report-${today}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const totalWatch7 = shown.reduce((t, r) => t + r.watch_seconds_7d, 0);
  const active7 = shown.filter(r => r.last_attendance && dayDiff(today, r.last_attendance) <= 6).length;

  return (
    <div className="space-y-5 text-white">
      <div className="flex flex-wrap items-center gap-3">
        <select value={grade} onChange={e => setGrade(e.target.value)} className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs">
          <option value="all">كل الصفوف</option><option value="1ث">أولى ثانوي</option><option value="2ث">تانية ثانوي</option><option value="3ث">تالتة ثانوي</option>
        </select>
        <button onClick={load} className="px-3 py-2 rounded-lg bg-slate-800 text-xs inline-flex items-center gap-1.5"><RefreshCw className="w-3.5 h-3.5" /> تحديث</button>
        <button onClick={exportCsv} disabled={shown.length === 0} className="px-3 py-2 rounded-lg bg-amber-500 text-slate-950 font-black text-xs inline-flex items-center gap-1.5 disabled:opacity-50"><Download className="w-3.5 h-3.5" /> تصدير CSV</button>
      </div>

      {rows === null && <div className="text-center text-slate-400 text-sm py-8"><Loader2 className="w-5 h-5 animate-spin inline ml-2" />جاري التحميل…</div>}
      {error && <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs">{error}</div>}

      {rows && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[['عدد الطلاب', shown.length], ['نشطون آخر 7 أيام', active7], ['مشاهدة آخر 7 أيام', fmtMinutes(totalWatch7)], ['تنبيهات مفتوحة', alerts.length]].map(([k, v]) => (
              <div key={String(k)} className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
                <div className="text-[11px] text-slate-400">{k}</div><div className="text-2xl font-black text-amber-400 mt-1 font-mono">{v}</div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300">
              <span className="font-black text-white flex items-center gap-1.5"><AlertTriangle className="w-4 h-4 text-amber-400" /> حدود التنبيه</span>
              <label className="flex items-center gap-2">غياب (أيام) <input className={inp} type="number" min={1} value={th.absentDays} onChange={e => setTh({ ...th, absentDays: Math.max(1, Number(e.target.value) || 1) })} /></label>
              <label className="flex items-center gap-2">أقل مشاهدة 7 أيام (د) <input className={inp} type="number" min={0} value={th.minWatchMin7d} onChange={e => setTh({ ...th, minWatchMin7d: Math.max(0, Number(e.target.value) || 0) })} /></label>
              <label className="flex items-center gap-2">تراجع درجات (نقطة) <input className={inp} type="number" min={1} value={th.dropPoints} onChange={e => setTh({ ...th, dropPoints: Math.max(1, Number(e.target.value) || 1) })} /></label>
            </div>
            {alerts.length === 0 ? <div className="text-xs text-slate-400">لا توجد تنبيهات حالياً.</div> : (
              <ul className="divide-y divide-slate-800">
                {alerts.map((a, i) => (
                  <li key={i} className="py-2 text-xs flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${a.kind === 'غياب' ? 'bg-red-500/15 text-red-300' : a.kind === 'تقدم ضعيف' ? 'bg-amber-500/15 text-amber-300' : 'bg-purple-500/15 text-purple-300'}`}>{a.kind}</span>
                    <span className="font-bold">{a.name}</span><span className="text-slate-400">{a.detail}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-slate-400"><tr className="text-right">
                {['الطالب', 'الصف', 'أيام الدخول', 'آخر دخول', 'مشاهدة (إجمالي)', 'مشاهدة 7 أيام', 'مكتملة', 'آخر نشاط'].map(h => <th key={h} className="p-3 font-bold whitespace-nowrap">{h}</th>)}
              </tr></thead>
              <tbody>
                {shown.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-slate-400">لا توجد بيانات بعد</td></tr>}
                {shown.map(r => (
                  <tr key={r.code} className="border-t border-slate-800">
                    <td className="p-3 font-bold">{r.name}</td><td className="p-3">{r.grade}</td><td className="p-3 font-mono">{r.attendance_days}</td>
                    <td className="p-3 whitespace-nowrap">{r.last_attendance || '—'}</td><td className="p-3">{fmtMinutes(r.watch_seconds)}</td>
                    <td className="p-3">{fmtMinutes(r.watch_seconds_7d)}</td><td className="p-3 font-mono">{r.completed_lectures}</td>
                    <td className="p-3 whitespace-nowrap">{r.last_activity ? formatCairo(r.last_activity) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-slate-500">الأرقام من سجلات الخادم: الحضور = أيام الدخول الفعلي، والمشاهدة = وقت التشغيل الفعلي بدون قفز. الفترة: بتوقيت القاهرة.</p>
        </>
      )}
    </div>
  );
};
