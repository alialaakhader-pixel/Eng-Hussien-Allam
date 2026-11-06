import { Lesson, LessonWatchProgress, StudentUser } from '../types';

// All numbers shown to the student are computed from real records only.

const TZ = 'Africa/Cairo';
const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });

export const cairoDay = (d: Date = new Date()) => dayFmt.format(d); // YYYY-MM-DD

export function addDays(day: string, delta: number): string {
  const [y, m, d] = day.split('-').map(Number);
  return cairoDay(new Date(Date.UTC(y, m - 1, d + delta, 12)));
}

export function percent(n: number, d: number): number | null {
  if (!Number.isFinite(d) || d <= 0) return null;
  return Math.min(100, Math.round((n / d) * 100));
}

export function lessonProgress(h?: LessonWatchProgress): number {
  if (!h) return 0;
  if (h.completed) return 100;
  return percent(h.watchedSeconds ?? 0, h.durationSeconds ?? 0) ?? 0;
}

export type LessonStatus = 'new' | 'progress' | 'done';
export function lessonStatus(student: StudentUser | null, lessonId: string): { status: LessonStatus; percent: number; entry?: LessonWatchProgress } {
  const entry = student?.watchHistory?.find(h => h.lessonId === lessonId);
  const done = !!student?.completedLessonIds.includes(lessonId) || !!entry?.completed;
  const pct = done ? 100 : lessonProgress(entry);
  return { status: done ? 'done' : pct > 0 ? 'progress' : 'new', percent: pct, entry };
}

export function attendanceDays(s: StudentUser | null): number {
  return new Set(s?.attendanceDates ?? []).size;
}

export function streak(s: StudentUser | null): number {
  const days = new Set(s?.attendanceDates ?? []);
  let cur = cairoDay();
  if (!days.has(cur)) cur = addDays(cur, -1);
  let n = 0;
  while (days.has(cur)) { n++; cur = addDays(cur, -1); }
  return n;
}

export function watchSecondsBetween(s: StudentUser | null, fromDay: string, toDay: string): number {
  let t = 0;
  for (const [k, v] of Object.entries(s?.watchLog ?? {})) if (k >= fromDay && k <= toDay) t += v;
  return t;
}

export function lastDays(s: StudentUser | null, n: number): { day: string; label: string; minutes: number }[] {
  const today = cairoDay();
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const day = addDays(today, -i);
    out.push({ day, label: day.slice(5).replace('-', '/'), minutes: Math.round(((s?.watchLog ?? {})[day] ?? 0) / 60) });
  }
  return out;
}

export function courseSummary(s: StudentUser | null, published: Lesson[]) {
  const ids = new Set(published.map(l => l.id));
  const completed = (s?.completedLessonIds ?? []).filter(id => ids.has(id)).length;
  return { total: published.length, completed, percent: percent(completed, published.length) };
}

export function formatCairo(value?: string | null): string {
  if (!value) return 'لا يوجد تسجيل سابق';
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat('ar-EG', { timeZone: TZ, dateStyle: 'medium', timeStyle: 'short' }).format(d);
}

export const fmtMinutes = (sec: number) => {
  const m = Math.round(sec / 60);
  return m >= 60 ? `${Math.floor(m / 60)} س ${m % 60} د` : `${m} دقيقة`;
};
