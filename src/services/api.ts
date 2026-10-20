import {
  Lesson, StudentCode, StudentUser, ForumPost, ForumAnswer, PlatformNotification, GradeType
} from '../types';

// Public values (safe in the browser). Security is enforced by RLS + SECURITY DEFINER functions.
const env = (import.meta as any).env || {};
const SUPABASE_URL: string = env.VITE_SUPABASE_URL || 'https://vmwfwyyrqbtwthakwqft.supabase.co';
const ANON_KEY: string = env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable__2XQ2mNTv9UbIX8on0OpvA_zYn_ygtw';
const BUCKET = 'lessons';
export const MAX_UPLOAD_MB = 50;

// ---------------------------------------------------------------------------
// Low level HTTP
// ---------------------------------------------------------------------------
async function http(path: string, opts: { method?: string; token?: string | null; body?: any; headers?: Record<string, string> } = {}) {
  const { method = 'GET', token, body, headers = {} } = opts;
  const isBlob = typeof Blob !== 'undefined' && body instanceof Blob;
  const res = await fetch(SUPABASE_URL + path, {
    method,
    headers: {
      apikey: ANON_KEY,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined && !isBlob ? { 'Content-Type': 'application/json' } : {}),
      ...headers
    },
    body: body === undefined ? undefined : isBlob ? body : JSON.stringify(body)
  });
  const text = await res.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  if (!res.ok) {
    throw new Error((json && (json.message || json.error_description || json.msg || json.error)) || res.statusText);
  }
  return json;
}

const rpc = (name: string, args: any, token?: string | null) =>
  http(`/rest/v1/rpc/${name}`, { method: 'POST', body: args, token });

const enc = encodeURIComponent;

// ---------------------------------------------------------------------------
// Teacher session (Supabase Auth, email + password)
// ---------------------------------------------------------------------------
const TEACHER_KEY = 'ha_teacher_session_v8';
interface Sess { access_token: string; refresh_token: string; expires_at: number }

function readSess(): Sess | null {
  try { const v = localStorage.getItem(TEACHER_KEY); return v ? JSON.parse(v) : null; } catch { return null; }
}
function writeSess(r: any) {
  const s: Sess = {
    access_token: r.access_token,
    refresh_token: r.refresh_token,
    expires_at: r.expires_at || Math.floor(Date.now() / 1000) + (r.expires_in || 3600)
  };
  localStorage.setItem(TEACHER_KEY, JSON.stringify(s));
  return s;
}

async function teacherToken(): Promise<string | null> {
  let s = readSess();
  if (!s) return null;
  if (s.expires_at - 60 < Date.now() / 1000) {
    try {
      const r = await http('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: s.refresh_token } });
      s = writeSess(r);
    } catch {
      localStorage.removeItem(TEACHER_KEY);
      return null;
    }
  }
  return s.access_token;
}

const tq = async (path: string, opts: any = {}) => {
  const token = await teacherToken();
  if (!token) throw new Error('انتهت جلسة المدرس، سجّل الدخول من جديد.');
  return http(path, { ...opts, token });
};

export async function teacherLogin(email: string, password: string): Promise<void> {
  const r = await http('/auth/v1/token?grant_type=password', { method: 'POST', body: { email: email.trim(), password } });
  writeSess(r);
  const ok = await rpc('ha_is_teacher', {}, r.access_token);
  if (ok !== true) {
    localStorage.removeItem(TEACHER_KEY);
    throw new Error('NOT_TEACHER');
  }
}

// The teacher code is the password of one fixed Supabase Auth account.
// It is verified by Supabase on the server, never stored in this bundle.
const TEACHER_ACCOUNT_EMAIL = 'teacher@eng-hussien-allam.app';

export async function teacherLoginWithCode(code: string): Promise<void> {
  return teacherLogin(TEACHER_ACCOUNT_EMAIL, code.trim());
}

export async function teacherSessionValid(): Promise<boolean> {
  const t = await teacherToken();
  if (!t) return false;
  try { return (await rpc('ha_is_teacher', {}, t)) === true; } catch { return false; }
}

export function teacherLogout() {
  localStorage.removeItem(TEACHER_KEY);
}

// ---------------------------------------------------------------------------
// Mapping helpers
// ---------------------------------------------------------------------------
const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' }) : '-';

const READ_KEY = 'ha_read_notifs_v8';
const readSet = (): Set<string> => {
  try { return new Set(JSON.parse(localStorage.getItem(READ_KEY) || '[]')); } catch { return new Set(); }
};
export function markNotifRead(id: string) {
  const s = readSet(); s.add(id);
  localStorage.setItem(READ_KEY, JSON.stringify([...s].slice(-200)));
}

function mapNotif(n: any): PlatformNotification {
  return {
    id: String(n.id),
    title: n.title,
    body: n.body || '',
    time: fmtDate(n.createdAt || n.created_at),
    type: 'lesson',
    read: readSet().has(String(n.id))
  };
}

function mapCode(c: any): StudentCode {
  const bound = !!c.bound_device;
  return {
    code: c.code,
    grade: c.grade,
    maxUses: c.max_uses ?? 1,
    timesUsed: bound ? 1 : 0,
    status: !c.active ? 'revoked' : bound ? 'used' : 'active',
    createdAt: (c.created_at || '').split('T')[0],
    note: c.note || undefined,
    usedBy: bound ? [{ studentName: c.student_name || '', studentPhone: c.student_phone || '', usedAt: fmtDate(c.used_at) }] : undefined
  };
}

function mapStudentRow(row: any, code?: any): StudentUser {
  const d = row.data || {};
  const last = row.last_login ? new Date(row.last_login).getTime() : 0;
  return {
    completedLessonIds: [],
    quizScores: [],
    ...d,
    id: row.code,
    name: code?.student_name || d.name || '',
    phone: code?.student_phone || d.phone || '',
    grade: (d.grade || (code && code.grade !== 'جميع الصفوف' ? code.grade : '3ث')) as GradeType,
    codeUsed: row.code,
    registeredAt: fmtDate(code?.used_at),
    lastLoginAt: fmtDate(row.last_login),
    status: Date.now() - last < 10 * 60 * 1000 ? 'online' : 'offline'
  };
}

// ---------------------------------------------------------------------------
// Student (code based, device bound)
// ---------------------------------------------------------------------------
const DEVICE_KEY = 'ha_device_id_v8';
const STUDENT_KEY = 'ha_student_session_v8';

export function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = (crypto as any).randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

interface StudentSession { code: string; name: string; phone: string; grade: GradeType }
export const getStudentSession = (): StudentSession | null => {
  try { const v = localStorage.getItem(STUDENT_KEY); return v ? JSON.parse(v) : null; } catch { return null; }
};
export const clearStudentSession = () => localStorage.removeItem(STUDENT_KEY);

const ERRORS: Record<string, string> = {
  INVALID_CODE: 'الكود غير صحيح أو تم إيقافه من المدرس. تأكد من الحروف والأرقام.',
  DEVICE_MISMATCH: 'هذا الكود مفعّل على جهاز آخر. تواصل مع المدرس لو محتاج تغيّر الجهاز.',
  NO_DEVICE: 'تعذر التعرف على الجهاز. جرّب متصفحاً آخر.',
  UNAUTHORIZED: 'انتهت صلاحية الدخول، سجّل دخولك بالكود من جديد.'
};

function buildStudent(r: any, code: string, grade: GradeType, name: string, phone: string): StudentUser {
  const st = r.student || {};
  return {
    completedLessonIds: [], quizScores: [],
    dailyWatchRate: 0, weeklyWatchRate: 0, monthlyWatchRate: 0,
    dailyWatchMinutes: 0, weeklyWatchHours: 0, monthlyWatchHours: 0, streakDays: 0,
    ...st,
    id: code,
    name: r.name || name,
    phone: r.phone || phone,
    grade,
    codeUsed: code,
    registeredAt: st.registeredAt || new Date().toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' }),
    lastLoginAt: 'الآن',
    device: navigator.userAgent.includes('Mobile') ? 'هاتف محمول' : 'كمبيوتر شخصي',
    status: 'online'
  };
}

export interface Feed { lessons: Lesson[]; notifications: PlatformNotification[] }

export async function studentFeed(code: string): Promise<Feed | null> {
  const r = await rpc('ha_feed', { p_code: code, p_device: getDeviceId() });
  if (!r?.ok) return null;
  return { lessons: r.lessons || [], notifications: (r.notifications || []).map(mapNotif) };
}

export async function studentLogin(code: string, name: string, phone: string, gradeChoice: GradeType):
  Promise<{ ok: true; student: StudentUser; feed: Feed } | { ok: false; error: string }> {
  try {
    const clean = code.trim().toUpperCase();
    const r = await rpc('ha_redeem', { p_code: clean, p_name: name, p_phone: phone, p_device: getDeviceId() });
    if (!r?.ok) return { ok: false, error: ERRORS[r?.error] || 'تعذر تسجيل الدخول. حاول مرة أخرى.' };
    const grade = (r.grade === 'جميع الصفوف' ? gradeChoice : r.grade) as GradeType;
    const student = buildStudent(r, clean, grade, name, phone);
    localStorage.setItem(STUDENT_KEY, JSON.stringify({ code: clean, name: student.name, phone: student.phone, grade }));
    const feed = (await studentFeed(clean)) || { lessons: [], notifications: [] };
    return { ok: true, student, feed };
  } catch {
    return { ok: false, error: 'تعذر الاتصال بالخادم. تأكد من الإنترنت وحاول مرة أخرى.' };
  }
}

export async function studentRestore(): Promise<{ student: StudentUser; feed: Feed } | null> {
  const s = getStudentSession();
  if (!s) return null;
  try {
    const r = await rpc('ha_redeem', { p_code: s.code, p_name: s.name, p_phone: s.phone, p_device: getDeviceId() });
    if (!r?.ok) { clearStudentSession(); return null; }
    const student = buildStudent(r, s.code, s.grade, s.name, s.phone);
    const feed = (await studentFeed(s.code)) || { lessons: [], notifications: [] };
    return { student, feed };
  } catch {
    return null;
  }
}

export async function saveStudentProgress(student: StudentUser) {
  try {
    await rpc('ha_save_student', { p_code: student.codeUsed, p_device: getDeviceId(), p_data: student });
  } catch (e) { console.error('save progress failed', e); }
}

// ---------------------------------------------------------------------------
// Forum
// ---------------------------------------------------------------------------
export async function forumFeedStudent(code: string): Promise<ForumPost[]> {
  const r = await rpc('ha_forum_feed', { p_code: code, p_device: getDeviceId() });
  return r?.ok ? r.posts || [] : [];
}

export async function forumAddPostStudent(code: string, post: ForumPost) {
  await rpc('ha_forum_add_post', { p_code: code, p_device: getDeviceId(), p_post: post });
}
export async function forumAddAnswerStudent(code: string, postId: string, answer: ForumAnswer) {
  await rpc('ha_forum_add_answer', { p_code: code, p_device: getDeviceId(), p_post_id: postId, p_answer: answer });
}
export async function forumUpvoteStudent(code: string, postId: string) {
  await rpc('ha_forum_upvote', { p_code: code, p_device: getDeviceId(), p_post_id: postId });
}

export async function forumSaveTeacher(post: ForumPost) {
  await tq('/rest/v1/ha_forum', {
    method: 'POST', body: { id: post.id, data: post },
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }
  });
}

// ---------------------------------------------------------------------------
// Teacher data
// ---------------------------------------------------------------------------
export interface TeacherData {
  lessons: Lesson[]; codes: StudentCode[]; students: StudentUser[];
  forum: ForumPost[]; notifications: PlatformNotification[];
}

export async function teacherLoadAll(): Promise<TeacherData> {
  const [lessons, codes, students, notifs, forum] = await Promise.all([
    tq('/rest/v1/ha_lessons?select=data,created_at&order=created_at.desc'),
    tq('/rest/v1/ha_codes?select=*&order=created_at.desc'),
    tq('/rest/v1/ha_students?select=*'),
    tq('/rest/v1/ha_notifications?select=*&order=created_at.desc&limit=50'),
    tq('/rest/v1/ha_forum?select=data&order=created_at.desc')
  ]);
  const codeMap = new Map<string, any>(codes.map((c: any) => [c.code, c]));
  return {
    lessons: lessons.map((l: any) => l.data),
    codes: codes.map(mapCode),
    students: students.map((s: any) => mapStudentRow(s, codeMap.get(s.code))),
    forum: forum.map((f: any) => f.data),
    notifications: notifs.map(mapNotif)
  };
}

export async function teacherSaveLesson(lesson: Lesson) {
  await tq('/rest/v1/ha_lessons', {
    method: 'POST', body: { id: lesson.id, grade: lesson.grade, data: lesson },
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }
  });
  await tq('/rest/v1/ha_notifications', {
    method: 'POST',
    body: {
      grade: lesson.grade,
      title: 'محاضرة جديدة أُضيفت للتو! 🚀',
      body: `نشر المهندس حسين علام: "${lesson.title}" (${lesson.grade} - ${lesson.unit})`,
      lesson_id: lesson.id
    },
    headers: { Prefer: 'return=minimal' }
  });
}

export async function teacherDeleteLesson(id: string) {
  await tq(`/rest/v1/ha_lessons?id=eq.${enc(id)}`, { method: 'DELETE' });
}

export async function teacherAddCode(c: StudentCode) {
  await tq('/rest/v1/ha_codes', {
    method: 'POST',
    body: { code: c.code.toUpperCase(), grade: c.grade, active: true, note: c.note || null, max_uses: c.maxUses || 1 },
    headers: { Prefer: 'return=minimal' }
  });
}
export async function teacherRevokeCode(code: string) {
  await tq(`/rest/v1/ha_codes?code=eq.${enc(code)}`, { method: 'PATCH', body: { active: false }, headers: { Prefer: 'return=minimal' } });
}
export async function teacherDeleteCode(code: string) {
  await tq(`/rest/v1/ha_students?code=eq.${enc(code)}`, { method: 'DELETE' });
  await tq(`/rest/v1/ha_codes?code=eq.${enc(code)}`, { method: 'DELETE' });
}

export async function uploadFile(file: File, folder: 'videos' | 'attachments'): Promise<string> {
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
    throw new Error(`حجم الملف أكبر من ${MAX_UPLOAD_MB} ميجابايت. ارفع الفيديو على يوتيوب (غير مدرج) وضع الرابط بدلاً من الملف.`);
  }
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  await tq(`/storage/v1/object/${BUCKET}/${path}`, {
    method: 'POST', body: file,
    headers: { 'Content-Type': file.type || 'application/octet-stream', 'x-upsert': 'false' }
  });
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}
