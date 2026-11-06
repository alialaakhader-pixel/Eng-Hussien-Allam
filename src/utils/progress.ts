import { LectureProgress, StudentUser } from '../types';

// Dates are always taken in Cairo time so "today" means the same thing for everyone.
export function cairoDay(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

export function formatCairoDate(value?: string | null): string {
  if (!value) return 'لا يوجد تسجيل سابق';
  const d = new Date(value);
  if (isNaN(d.getTime())) return 'لا يوجد تسجيل سابق';
  return new Intl.DateTimeFormat('ar-EG', { timeZone: 'Africa/Cairo', dateStyle: 'medium', timeStyle: 'short' }).format(d);
}

export const COMPLETE_AT = 90; // percent of real watched time that counts as "completed"

export function percent(n: number, d: number): number | null {
  if (!Number.isFinite(d) || d <= 0) return null;
  return Math.round((n / d) * 100);
}

export function lectureProgressPct(p?: LectureProgress): number {
  if (!p) return 0;
  return percent(Math.min(Math.max(0, p.watchedSeconds), p.durationSeconds), p.durationSeconds) ?? 0;
}

/** Applies a batch of really-watched seconds to the student and returns the updated student. */
export function applyWatch(
  student: StudentUser,
  lessonId: string,
  deltaSeconds: number,
  positionSeconds: number,
  durationSeconds: number
): StudentUser {
  const now = new Date();
  const today = cairoDay(now);
  const list = student.lectureProgress ? [...student.lectureProgress] : [];
  const i = list.findIndex(x => x.lessonId === lessonId);
  const prev: LectureProgress = i >= 0 ? list[i] : {
    lessonId, watchedSeconds: 0, durationSeconds: 0, lastPositionSeconds: 0, lastWatchedAt: now.toISOString(), completed: false
  };
  const dur = Number.isFinite(durationSeconds) && durationSeconds > 0 ? durationSeconds : prev.durationSeconds;
  const next: LectureProgress = {
    ...prev,
    watchedSeconds: Math.round(prev.watchedSeconds + Math.max(0, deltaSeconds)),
    durationSeconds: Math.round(dur),
    lastPositionSeconds: Math.max(0, Math.round(positionSeconds)),
    lastWatchedAt: now.toISOString()
  };
  if (!next.completed && (lectureProgressPct(next) >= COMPLETE_AT)) next.completed = true;
  if (i >= 0) list[i] = next; else list.push(next);

  const days = { ...(student.activityDays || {}) };
  days[today] = Math.round((days[today] || 0) + Math.max(0, deltaSeconds));

  const att = student.attendanceDates || [];
  return {
    ...student,
    lectureProgress: list,
    activityDays: days,
    attendanceDates: att.includes(today) ? att : [...att, today],
    lastWatchedLessonId: lessonId,
    completedLessonIds: next.completed && !student.completedLessonIds.includes(lessonId)
      ? [...student.completedLessonIds, lessonId]
      : student.completedLessonIds
  };
}

export function withAttendanceToday(student: StudentUser): StudentUser | null {
  const today = cairoDay();
  const att = student.attendanceDates || [];
  return att.includes(today) ? null : { ...student, attendanceDates: [...att, today] };
}

function sumDays(days: Record<string, number>, back: number): number {
  let total = 0;
  const now = Date.now();
  for (let i = 0; i < back; i++) total += days[cairoDay(new Date(now - i * 86400000))] || 0;
  return total;
}

export function computeMetrics(student: StudentUser | null) {
  const days = student?.activityDays || {};
  const att = new Set([...(student?.attendanceDates || []), ...Object.keys(days).filter(k => days[k] > 0)]);
  let streak = 0;
  const now = Date.now();
  for (let i = 0; i < 366; i++) {
    const k = cairoDay(new Date(now - i * 86400000));
    if (att.has(k)) streak++;
    else if (i === 0) continue; // today may not have started yet
    else break;
  }
  const todaySec = days[cairoDay()] || 0;
  return {
    dailyMinutes: Math.round(todaySec / 60),
    weeklyHours: Math.round((sumDays(days, 7) / 3600) * 10) / 10,
    monthlyHours: Math.round((sumDays(days, 30) / 3600) * 10) / 10,
    attendanceDays: att.size,
    streakDays: streak
  };
}
