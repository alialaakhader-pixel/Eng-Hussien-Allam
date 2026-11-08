import type { ServerProgress, AssignmentItem, TeacherAssignment, StudentAnalyticsRow, TutorMessage, MySubscription, PlanCatalogItem, TeacherSubsOverview, StudyItem, StudySettings, StudyState, Mistake, MistakeNew, MistakeExamItem, MistakeExamResultItem, MistakeExamHistory, TeacherMistakesOverview } from '../types';
import {
  Lesson, StudentCode, StudentUser, ForumPost, ForumAnswer, PlatformNotification, GradeType,
  Exam, ExamResult, ExamResultRow, Account, AccountInfo, ExamReviewItem
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
// Student account session (Supabase Auth, email + password)
// ---------------------------------------------------------------------------
const ACC_KEY = 'ha_account_session_v9';

function readAcc(): Sess | null {
  try { const v = localStorage.getItem(ACC_KEY); return v ? JSON.parse(v) : null; } catch { return null; }
}
function writeAcc(r: any) {
  const x: Sess = {
    access_token: r.access_token,
    refresh_token: r.refresh_token,
    expires_at: r.expires_at || Math.floor(Date.now() / 1000) + (r.expires_in || 3600)
  };
  localStorage.setItem(ACC_KEY, JSON.stringify(x));
  return x;
}
export const clearAccountSession = () => { try { localStorage.removeItem(ACC_KEY); } catch { /* ignore */ } };

async function accToken(): Promise<string | null> {
  let x = readAcc();
  if (!x) return null;
  if (x.expires_at - 60 < Date.now() / 1000) {
    try {
      const r = await http('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: x.refresh_token } });
      x = writeAcc(r);
    } catch {
      clearAccountSession();
      return null;
    }
  }
  return x.access_token;
}

// student RPC: sends the account token when an email account is signed in, otherwise anonymous (code + device)
const srpc = async (name: string, args: any) => rpc(name, args, await accToken());

export interface AccountMe extends AccountInfo {
  name: string; phone: string; grade: GradeType; code: string; student: any;
}

const ACC_ERRORS: Record<string, string> = {
  BAD_EMAIL: 'اكتب بريداً إلكترونياً صحيحاً.',
  WEAK_PASSWORD: 'كلمة المرور لازم تكون 6 أحرف أو أرقام على الأقل.',
  BAD_NAME: 'اكتب اسم الطالب (ثلاثة أحرف على الأقل).',
  BAD_GRADE: 'اختر المرحلة الدراسية.',
  EMAIL_EXISTS: 'هذا الإيميل مسجّل من قبل، سجّل الدخول بدلاً من إنشاء حساب.',
  NO_ACCOUNT: 'هذا الحساب ليس حساب طالب.',
  DEVICE_LIMIT: 'هذا الحساب مسجّل على الحد الأقصى من الأجهزة. لو غيّرت جهازك تواصل مع المدرس لتصفير الأجهزة.',
  NO_DEVICE: 'تعذر التعرف على الجهاز. جرّب متصفحاً آخر.'
};

function toMe(r: any): AccountMe {
  return {
    id: r.id, email: r.email, name: r.name, phone: r.phone || '', grade: r.grade as GradeType,
    code: r.code, accessUntil: r.accessUntil || null, hasAccess: !!r.hasAccess, student: r.student || {}
  };
}

export async function accountMe(): Promise<AccountMe | null> {
  const t = await accToken();
  if (!t) return null;
  try {
    const r = await rpc('ha_acc_me', { p_device: getDeviceId() }, t);
    if (!r?.ok && r?.error === 'DEVICE_LIMIT') clearAccountSession();
    return r?.ok ? toMe(r) : null;
  } catch { return null; }
}

export async function accountLogin(email: string, password: string):
  Promise<{ ok: true; me: AccountMe } | { ok: false; error: string }> {
  try {
    const r = await http('/auth/v1/token?grant_type=password', { method: 'POST', body: { email: email.trim().toLowerCase(), password } });
    writeAcc(r);
    const me = await rpc('ha_acc_me', { p_device: getDeviceId() }, r.access_token);
    if (!me?.ok) {
      clearAccountSession();
      return { ok: false, error: ACC_ERRORS[me?.error] || 'تعذر تسجيل الدخول.' };
    }
    return { ok: true, me: toMe(me) };
  } catch (e: any) {
    clearAccountSession();
    const m = String(e?.message || '');
    if (/invalid login|invalid_grant|credentials/i.test(m)) return { ok: false, error: 'الإيميل أو كلمة المرور غير صحيحة.' };
    return { ok: false, error: 'تعذر الاتصال بالخادم. تأكد من الإنترنت وحاول مرة أخرى.' };
  }
}

export async function accountSignup(email: string, password: string, name: string, phone: string, grade: GradeType):
  Promise<{ ok: true; me: AccountMe } | { ok: false; error: string }> {
  try {
    const r = await rpc('ha_signup', { p_email: email, p_password: password, p_name: name, p_phone: phone, p_grade: grade });
    if (!r?.ok) return { ok: false, error: ACC_ERRORS[r?.error] || 'تعذر إنشاء الحساب.' };
  } catch {
    return { ok: false, error: 'تعذر الاتصال بالخادم. تأكد من الإنترنت وحاول مرة أخرى.' };
  }
  return accountLogin(email, password);
}

export function buildAccountStudent(me: AccountMe): StudentUser {
  return {
    completedLessonIds: [], quizScores: [],
    dailyWatchRate: 0, weeklyWatchRate: 0, monthlyWatchRate: 0,
    dailyWatchMinutes: 0, weeklyWatchHours: 0, monthlyWatchHours: 0, streakDays: 0,
    ...(me.student || {}),
    id: me.code,
    accountId: me.id,
    email: me.email,
    name: me.name,
    phone: me.phone,
    grade: me.grade,
    codeUsed: me.code,
    registeredAt: (me.student && me.student.registeredAt) || new Date().toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' }),
    lastLoginAt: 'الآن',
    device: navigator.userAgent.includes('Mobile') ? 'هاتف محمول' : 'كمبيوتر شخصي',
    status: 'online'
  };
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
export const clearStudentSession = () => { localStorage.removeItem(STUDENT_KEY); clearAccountSession(); };

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

export interface Feed {
  lessons: Lesson[]; notifications: PlatformNotification[]; exams: Exam[]; examResults: ExamResult[];
}
export const emptyFeed = (): Feed => ({ lessons: [], notifications: [], exams: [], examResults: [] });

export async function studentFeed(code: string): Promise<Feed | null> {
  const r = await srpc('ha_feed', { p_code: code, p_device: getDeviceId() });
  if (!r?.ok) return null;
  return {
    lessons: r.lessons || [],
    notifications: (r.notifications || []).map(mapNotif),
    exams: r.exams || [],
    examResults: r.examResults || []
  };
}

export async function studentLogin(code: string, name: string, phone: string, gradeChoice: GradeType):
  Promise<{ ok: true; student: StudentUser; feed: Feed } | { ok: false; error: string }> {
  try {
    const clean = code.trim().toUpperCase();
    clearAccountSession();
    const r = await rpc('ha_redeem', { p_code: clean, p_name: name, p_phone: phone, p_device: getDeviceId() });
    if (!r?.ok) return { ok: false, error: ERRORS[r?.error] || 'تعذر تسجيل الدخول. حاول مرة أخرى.' };
    const grade = (r.grade === 'جميع الصفوف' ? gradeChoice : r.grade) as GradeType;
    const student = buildStudent(r, clean, grade, name, phone);
    localStorage.setItem(STUDENT_KEY, JSON.stringify({ code: clean, name: student.name, phone: student.phone, grade }));
    const feed = (await studentFeed(clean)) || emptyFeed();
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
    const feed = (await studentFeed(s.code)) || emptyFeed();
    return { student, feed };
  } catch {
    return null;
  }
}

export async function saveStudentProgress(student: StudentUser) {
  try {
    await srpc('ha_save_student', { p_code: student.codeUsed, p_device: getDeviceId(), p_data: student });
  } catch (e) { console.error('save progress failed', e); }
}

// ---------------------------------------------------------------------------
// Exams (graded on the server)
// ---------------------------------------------------------------------------
const EXAM_ERRORS: Record<string, string> = {
  ALREADY_TAKEN: 'سبق وأديت هذا الامتحان. لو محتاج محاولة جديدة تواصل مع المدرس.',
  NOT_FOUND: 'هذا الامتحان غير متاح لك.',
  UNAUTHORIZED: 'انتهت صلاحية الدخول أو الاشتراك. سجّل دخولك من جديد.',
  EMPTY_EXAM: 'هذا الامتحان لا يحتوي على أسئلة.'
};

export async function examSubmit(code: string, examId: string, answers: (number | null)[]):
  Promise<{ ok: true; result: ExamResult } | { ok: false; error: string }> {
  try {
    const r = await srpc('ha_exam_submit', { p_code: code, p_device: getDeviceId(), p_exam_id: examId, p_answers: answers });
    if (!r?.ok) return { ok: false, error: EXAM_ERRORS[r?.error] || 'تعذر تسليم الامتحان.' };
    return {
      ok: true,
      result: {
        examId, score: r.score, total: r.total, answers: r.answers || answers,
        review: (r.review || []) as ExamReviewItem[], createdAt: new Date().toISOString()
      }
    };
  } catch {
    return { ok: false, error: 'تعذر الاتصال بالخادم. إجاباتك لم تُسلَّم، حاول مرة أخرى.' };
  }
}

// ---------------------------------------------------------------------------
// Forum
// ---------------------------------------------------------------------------
export async function forumFeedStudent(code: string): Promise<ForumPost[]> {
  const r = await srpc('ha_forum_feed', { p_code: code, p_device: getDeviceId() });
  return r?.ok ? r.posts || [] : [];
}

export async function forumAddPostStudent(code: string, post: ForumPost) {
  await srpc('ha_forum_add_post', { p_code: code, p_device: getDeviceId(), p_post: post });
}
export async function forumAddAnswerStudent(code: string, postId: string, answer: ForumAnswer) {
  await srpc('ha_forum_add_answer', { p_code: code, p_device: getDeviceId(), p_post_id: postId, p_answer: answer });
}
export async function forumUpvoteStudent(code: string, postId: string) {
  await srpc('ha_forum_upvote', { p_code: code, p_device: getDeviceId(), p_post_id: postId });
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
  accounts: Account[]; exams: Exam[]; examResults: ExamResultRow[];
}

const ACC_NOTE = '__acct__';

function mapAccount(a: any): Account {
  return {
    id: Number(a.id), email: a.email, name: a.name, phone: a.phone || '', grade: a.grade as GradeType,
    code: a.code || null, accessUntil: a.access_until || null, active: !!a.active, createdAt: a.created_at,
    maxDevices: Number(a.max_devices ?? 2), deviceCount: 0
  };
}
function mapExam(e: any): Exam {
  return {
    id: e.id, title: e.title, grade: e.grade as GradeType, durationMin: e.duration_min,
    questions: e.questions || [], createdAt: e.created_at
  };
}

export async function teacherLoadAll(): Promise<TeacherData> {
  const [lessons, codes, students, notifs, forum, accounts, exams, results, devices] = await Promise.all([
    tq('/rest/v1/ha_lessons?select=data,created_at&order=created_at.desc'),
    tq('/rest/v1/ha_codes?select=*&order=created_at.desc'),
    tq('/rest/v1/ha_students?select=*'),
    tq('/rest/v1/ha_notifications?select=*&order=created_at.desc&limit=50'),
    tq('/rest/v1/ha_forum?select=data&order=created_at.desc'),
    tq('/rest/v1/ha_accounts?select=*&order=id.desc'),
    tq('/rest/v1/ha_exams?select=*&order=created_at.desc'),
    tq('/rest/v1/ha_exam_results?select=*&order=created_at.desc'),
    tq('/rest/v1/ha_account_devices?select=account_id')
  ]);
  const devCount = new Map<number, number>();
  for (const d of devices as any[]) devCount.set(Number(d.account_id), (devCount.get(Number(d.account_id)) || 0) + 1);
  const codeMap = new Map<string, any>(codes.map((c: any) => [c.code, c]));
  return {
    lessons: lessons.map((l: any) => l.data),
    codes: codes.filter((c: any) => c.note !== ACC_NOTE).map(mapCode),
    students: students.map((s: any) => mapStudentRow(s, codeMap.get(s.code))),
    forum: forum.map((f: any) => f.data),
    notifications: notifs.map(mapNotif),
    accounts: accounts.map((a: any) => ({ ...mapAccount(a), deviceCount: devCount.get(Number(a.id)) || 0 })),
    exams: exams.map(mapExam),
    examResults: results.map((r: any) => ({
      id: r.id, examId: r.exam_id, code: r.code, score: r.score, total: r.total, createdAt: r.created_at
    }))
  };
}

export async function teacherGrantAccess(id: number, days: number, extend: boolean) {
  const r = await rpc('ha_teacher_grant', { p_id: id, p_days: days, p_extend: extend }, await teacherToken());
  if (!r?.ok) throw new Error(r?.error === 'NOT_FOUND' ? 'لا يوجد حساب بهذا الـ ID.' : 'تعذر تحديث الاشتراك.');
  return r.accessUntil as string;
}

export async function teacherResetDevices(id: number) {
  const r = await rpc('ha_teacher_reset_devices', { p_id: id }, await teacherToken());
  if (!r?.ok) throw new Error('تعذر تصفير الأجهزة.');
}

export async function teacherSetMaxDevices(id: number, max: number) {
  const r = await rpc('ha_teacher_set_max_devices', { p_id: id, p_max: max }, await teacherToken());
  if (!r?.ok) throw new Error('تعذر تعديل عدد الأجهزة.');
}

export async function teacherDeleteAccount(id: number) {
  const r = await rpc('ha_teacher_delete_account', { p_id: id }, await teacherToken());
  if (!r?.ok) throw new Error('تعذر حذف الحساب.');
}

export async function teacherSaveExam(exam: Exam) {
  await tq('/rest/v1/ha_exams', {
    method: 'POST',
    body: {
      id: exam.id, grade: exam.grade, title: exam.title, duration_min: exam.durationMin,
      questions: exam.questions, published: true
    },
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }
  });
  await tq('/rest/v1/ha_notifications', {
    method: 'POST',
    body: { grade: exam.grade, title: 'امتحان جديد متاح الآن 📝', body: `أضاف المهندس حسين علام امتحان "${exam.title}" (${exam.grade})` },
    headers: { Prefer: 'return=minimal' }
  });
}
export async function teacherDeleteExam(id: string) {
  await tq(`/rest/v1/ha_exams?id=eq.${enc(id)}`, { method: 'DELETE' });
}
export async function teacherDeleteExamResult(id: string) {
  await tq(`/rest/v1/ha_exam_results?id=eq.${enc(id)}`, { method: 'DELETE' });
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

// ---------------------------------------------------------------------------
// Stage 1: server-side analytics, assignments, AI tutor, teacher analytics
// ---------------------------------------------------------------------------

export async function watchHeartbeat(code: string, lessonId: string, delta: number, position: number, duration: number) {
  try {
    const r = await srpc('ha_watch_heartbeat', {
      p_code: code, p_device: getDeviceId(), p_lesson: lessonId,
      p_delta: Math.max(0, delta), p_position: position, p_duration: duration
    });
    return r?.ok ? r as { ok: true; watchedSeconds: number; durationSeconds: number; lastPosition: number; completed: boolean; credited: number } : null;
  } catch { return null; }
}

export async function markAttendance(code: string): Promise<number | null> {
  try {
    const r = await srpc('ha_mark_attendance', { p_code: code, p_device: getDeviceId() });
    return r?.ok ? Number(r.days) : null;
  } catch { return null; }
}

export async function myProgress(code: string): Promise<ServerProgress | null> {
  try {
    const r = await srpc('ha_my_progress', { p_code: code, p_device: getDeviceId() });
    return r?.ok ? { lectures: r.lectures || [], daily: r.daily || [], attendance: r.attendance || [] } : null;
  } catch { return null; }
}

const ASSIGN_ERRORS: Record<string, string> = {
  UNAUTHORIZED: 'انتهت صلاحية الدخول، سجّل دخولك من جديد.',
  NOT_FOUND: 'هذا الواجب غير متاح لك.',
  TOO_LARGE: 'الإجابة طويلة جداً.',
  DUE_PASSED: 'انتهى موعد تسليم هذا الواجب.',
  ALREADY_GRADED: 'تم تصحيح هذا الواجب ولا يمكن تعديله.',
  EMPTY: 'اكتب إجابتك أولاً.'
};

export async function assignmentFeed(code: string): Promise<AssignmentItem[]> {
  const r = await srpc('ha_assignment_feed', { p_code: code, p_device: getDeviceId() });
  return r?.ok ? (r.items || []) : [];
}

export async function assignmentSubmit(code: string, assignmentId: string, answer: string):
  Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const r = await srpc('ha_assignment_submit', { p_code: code, p_device: getDeviceId(), p_assignment: assignmentId, p_answer: answer });
    return r?.ok ? { ok: true } : { ok: false, error: ASSIGN_ERRORS[r?.error] || 'تعذر تسليم الواجب.' };
  } catch { return { ok: false, error: 'تعذر الاتصال بالخادم. حاول مرة أخرى.' }; }
}

export async function teacherAssignments(): Promise<TeacherAssignment[]> {
  const r = await rpc('ha_teacher_assignment_results', {}, await teacherToken());
  if (!r?.ok) throw new Error('تعذر تحميل الواجبات.');
  return r.items || [];
}

export async function teacherSaveAssignment(a: { id?: string | null; grade: string; title: string; body: string; dueAt: string | null; published: boolean }) {
  const r = await rpc('ha_teacher_assignment_save', {
    p_id: a.id || null, p_grade: a.grade, p_title: a.title.trim(), p_body: a.body, p_due: a.dueAt, p_published: a.published
  }, await teacherToken());
  if (!r?.ok) throw new Error(r?.error === 'INVALID_TITLE' ? 'اكتب عنواناً للواجب (حتى 180 حرفاً).' : 'تعذر حفظ الواجب.');
}

export async function teacherGradeAssignment(submissionId: string, grade: number | null, feedback: string) {
  const r = await rpc('ha_teacher_assignment_grade', { p_submission: submissionId, p_grade: grade, p_feedback: feedback }, await teacherToken());
  if (!r?.ok) throw new Error(r?.error === 'BAD_GRADE' ? 'الدرجة لازم تكون من 0 إلى 100.' : 'تعذر حفظ الدرجة.');
}

export async function teacherAnalytics(): Promise<StudentAnalyticsRow[]> {
  const r = await rpc('ha_teacher_analytics', {}, await teacherToken());
  return Array.isArray(r) ? r : [];
}

const TUTOR_ERRORS: Record<string, string> = {
  RATE_LIMIT: 'بعتّ أسئلة كتير بسرعة. استنى دقيقة وحاول تاني.',
  DAILY_LIMIT: 'وصلت للحد اليومي من أسئلة المدرس الذكي. كمّل بكرة.',
  SUBSCRIPTION_REQUIRED: 'المدرس الذكي ضمن باقة اشتراك. فعّل اشتراكك من لوحة الطالب ← اشتراكي.',
  IMAGE_LIMIT: 'وصلت للحد اليومي لإرسال الصور (15 صورة). كمّل بكرة أو اكتب المسألة نصاً.'
};

export async function askTutor(code: string, grade: string, question: string, history: TutorMessage[], images: string[] = []):
  Promise<{ ok: true; answer: string } | { ok: false; error: string; retryable: boolean }> {
  try {
    const token = await accToken();
    const res = await fetch(SUPABASE_URL + '/functions/v1/ha-ai-tutor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: ANON_KEY, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ code, device: getDeviceId(), grade, question, images, history: history.slice(-8).map(m => ({ role: m.role, content: m.content })) })
    });
    const data = await res.json().catch(() => null);
    if (res.ok && data?.ok) return { ok: true, answer: data.answer };
    const msg = (data?.code && TUTOR_ERRORS[data.code]) || data?.error || 'تعذر الحصول على إجابة.';
    if (res.status === 503) {
      // service not configured on the server: retrying will not help
      return { ok: false, error: 'المدرس الذكي غير متاح حالياً. هيتفعّل قريباً، وتقدر تسأل المدرس في المنتدى لحد ما يشتغل.', retryable: false };
    }
    return { ok: false, error: msg, retryable: res.status >= 500 || res.status === 429 };
  } catch {
    return { ok: false, error: 'تعذر الاتصال بالخادم. تأكد من الإنترنت وحاول مرة أخرى.', retryable: true };
  }
}

// ---------- Subscriptions ----------
const SUB_ERRORS: Record<string, string> = {
  INVALID_CODE: 'كود التفعيل غير صحيح أو مستخدم من قبل أو منتهي.',
  PLAN_UNAVAILABLE: 'هذه الباقة غير متاحة حالياً.',
  WRONG_GRADE: 'هذه الباقة مخصصة لصف دراسي آخر.',
  UNAUTHORIZED: 'سجّل دخولك أولاً.',
  STUDENT_NOT_FOUND: 'كود الطالب غير موجود.',
  NOT_FOUND: 'العنصر غير موجود.',
  INVALID: 'بيانات غير صالحة.'
};
const subErr = (e: unknown) => SUB_ERRORS[String(e)] || 'تعذر تنفيذ العملية.';

export async function mySubscriptions(code: string): Promise<{ subscriptions: MySubscription[]; plans: PlanCatalogItem[] } | null> {
  try {
    const r = await srpc('ha_sub_me', { p_code: code, p_device: getDeviceId() });
    return r?.ok ? { subscriptions: r.subscriptions || [], plans: r.plans || [] } : null;
  } catch { return null; }
}

export async function redeemActivation(code: string, activation: string):
  Promise<{ ok: true; planName: string; endsAt: string; renewed: boolean } | { ok: false; error: string }> {
  try {
    const r = await srpc('ha_sub_redeem', { p_code: code, p_device: getDeviceId(), p_activation: activation });
    return r?.ok ? { ok: true, planName: r.planName, endsAt: r.endsAt, renewed: !!r.renewed } : { ok: false, error: subErr(r?.error) };
  } catch { return { ok: false, error: 'تعذر الاتصال بالخادم. حاول مرة أخرى.' }; }
}

export async function teacherSubsOverview(): Promise<TeacherSubsOverview> {
  const r = await rpc('ha_teacher_subs_overview', {}, await teacherToken());
  if (!r || r.plans === undefined) throw new Error('تعذر تحميل الاشتراكات.');
  return r as TeacherSubsOverview;
}

export async function teacherPlanSave(p: { id?: string | null; name: string; price: number; days: number; grade: string; lessons: string[]; exams: string[]; ai: boolean; active: boolean }) {
  const r = await rpc('ha_teacher_plan_save', {
    p_id: p.id || null, p_name: p.name, p_price: p.price, p_days: p.days, p_grade: p.grade,
    p_lessons: p.lessons, p_exams: p.exams, p_ai: p.ai, p_active: p.active
  }, await teacherToken());
  if (!r?.ok) throw new Error(subErr(r?.error));
}
export async function teacherPlanDelete(id: string): Promise<{ deactivated: boolean }> {
  const r = await rpc('ha_teacher_plan_delete', { p_id: id }, await teacherToken());
  if (!r?.ok) throw new Error(subErr(r?.error));
  return { deactivated: !!r.deactivated };
}
export async function teacherGenerateCodes(planId: string, count: number, expiresAt: string | null): Promise<string[]> {
  const r = await rpc('ha_teacher_codes_generate', { p_plan: planId, p_count: count, p_expires: expiresAt }, await teacherToken());
  if (!r?.ok) throw new Error(subErr(r?.error));
  return r.codes || [];
}
export async function teacherGrantSub(student: string, planId: string, days: number | null) {
  const r = await rpc('ha_teacher_sub_grant', { p_student: student, p_plan: planId, p_days: days }, await teacherToken());
  if (!r?.ok) throw new Error(subErr(r?.error));
}
export async function teacherSetSubStatus(id: string, status: 'active' | 'paused' | 'cancelled') {
  const r = await rpc('ha_teacher_sub_set_status', { p_id: id, p_status: status }, await teacherToken());
  if (!r?.ok) throw new Error(subErr(r?.error));
}

// ---------- Study planner & notifications ----------
export async function studyGet(code: string): Promise<StudyState | null> {
  try {
    const r = await srpc('ha_study_get', { p_code: code, p_device: getDeviceId() });
    return r?.ok ? (r as StudyState) : null;
  } catch { return null; }
}
const STUDY_ERRORS: Record<string, string> = { INVALID: 'راجع البيانات: الاسم والوقت واليوم مطلوبين، ووقت النهاية بعد البداية.', LIMIT: 'وصلت للحد الأقصى من المهام (100).', NOT_FOUND: 'المهمة غير موجودة.', UNAUTHORIZED: 'سجّل دخولك أولاً.' };
export async function studySaveItem(code: string, item: StudyItem): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const r = await srpc('ha_study_save_item', { p_code: code, p_device: getDeviceId(), p_item: item });
    return r?.ok ? { ok: true } : { ok: false, error: STUDY_ERRORS[r?.error] || 'تعذر الحفظ.' };
  } catch { return { ok: false, error: 'تعذر الاتصال بالخادم.' }; }
}
export async function studyDeleteItem(code: string, id: string): Promise<boolean> {
  try { return !!(await srpc('ha_study_delete_item', { p_code: code, p_device: getDeviceId(), p_id: id }))?.ok; } catch { return false; }
}
export async function studySetDone(code: string, id: string, day: string, done: boolean): Promise<boolean> {
  try { return !!(await srpc('ha_study_set_done', { p_code: code, p_device: getDeviceId(), p_id: id, p_day: day, p_done: done }))?.ok; } catch { return false; }
}
export async function studySaveSettings(code: string, s: StudySettings): Promise<boolean> {
  try {
    return !!(await srpc('ha_study_save_settings', {
      p_code: code, p_device: getDeviceId(), p_tz: s.tz, p_rest: s.restDays, p_notify: s.notifyEnabled, p_summary: s.dailySummary, p_summary_time: s.summaryTime
    }))?.ok;
  } catch { return false; }
}
export async function notifMarkRead(code: string, ids: string[] | null): Promise<void> {
  try { await srpc('ha_notif_mark_read', { p_code: code, p_device: getDeviceId(), p_ids: ids }); } catch { /* ignore */ }
}
export async function pushPublicKey(): Promise<string | null> {
  try {
    const res = await fetch(SUPABASE_URL + '/functions/v1/ha-push', { headers: { apikey: ANON_KEY } });
    const d = await res.json().catch(() => null);
    return res.ok && d?.publicKey ? d.publicKey : null;
  } catch { return null; }
}
export async function pushSubscribe(code: string, endpoint: string, p256dh: string, auth: string): Promise<boolean> {
  try { return !!(await srpc('ha_push_subscribe', { p_code: code, p_device: getDeviceId(), p_endpoint: endpoint, p_p256dh: p256dh, p_auth: auth }))?.ok; } catch { return false; }
}
export async function pushUnsubscribe(code: string, endpoint: string): Promise<void> {
  try { await srpc('ha_push_unsubscribe', { p_code: code, p_device: getDeviceId(), p_endpoint: endpoint }); } catch { /* ignore */ }
}

export async function tutorHistory(code: string): Promise<TutorMessage[]> {
  try {
    const r = await srpc('ha_ai_history', { p_code: code, p_device: getDeviceId(), p_limit: 20 });
    return r?.ok ? (r.messages || []).map((m: any) => ({ role: m.role, content: m.content, imageCount: m.imageCount || 0 })) : [];
  } catch { return []; }
}

// ---------- Mistakes notebook (كل الأخطاء) ----------
export async function mistakesLoad(code: string): Promise<Mistake[] | null> {
  try {
    await srpc('ha_mistakes_sync', { p_code: code, p_device: getDeviceId() }); // derive exam / assignment mistakes on the server
    const r = await srpc('ha_mistakes_list', { p_code: code, p_device: getDeviceId() });
    return r?.ok ? (r.items as Mistake[]) : null;
  } catch { return null; }
}
const MISTAKE_ERRORS: Record<string, string> = { INVALID: 'راجع البيانات: نص السؤال مطلوب، والاختيارات من 2 إلى 6، ورقم الإجابة الصحيحة ضمن الاختيارات.', INVALID_IMAGE: 'الصورة غير صالحة أو كبيرة.', LIMIT: 'وصلت للحد الأقصى من الأسئلة (600). احذف أو أرشف بعضها.', NOT_FOUND: 'غير موجود.' };
export async function mistakeAdd(code: string, m: MistakeNew): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const r = await srpc('ha_mistake_add', { p_code: code, p_device: getDeviceId(), p_m: m });
    return r?.ok ? { ok: true } : { ok: false, error: MISTAKE_ERRORS[r?.error] || 'تعذر الحفظ.' };
  } catch { return { ok: false, error: 'تعذر الاتصال بالخادم.' }; }
}
export async function mistakeUpdate(code: string, id: string, patch: { status?: string; note?: string; reason?: string; reviewSet?: boolean }): Promise<boolean> {
  try { return !!(await srpc('ha_mistake_update', { p_code: code, p_device: getDeviceId(), p_id: id, p_patch: patch }))?.ok; } catch { return false; }
}
export async function mistakeDelete(code: string, id: string): Promise<boolean> {
  try { return !!(await srpc('ha_mistake_delete', { p_code: code, p_device: getDeviceId(), p_id: id }))?.ok; } catch { return false; }
}
export async function mistakeImage(code: string, id: string): Promise<string | null> {
  try { const r = await srpc('ha_mistake_image', { p_code: code, p_device: getDeviceId(), p_id: id }); return r?.ok ? r.image : null; } catch { return null; }
}
export async function mistakeQuizReport(code: string, lessonId: string, qid: string, chosen: number): Promise<void> {
  try { await srpc('ha_mistake_quiz_report', { p_code: code, p_device: getDeviceId(), p_lesson: lessonId, p_qid: qid, p_chosen: chosen }); } catch { /* best effort */ }
}
export async function mistakeExamStart(code: string, o: { ids: string[] | null; count: number; difficulty: string; order: string; minutes: number }):
  Promise<{ ok: true; id: string; durationMin: number; items: MistakeExamItem[] } | { ok: false; error: string }> {
  try {
    const r = await srpc('ha_mistake_exam_start', { p_code: code, p_device: getDeviceId(), p_ids: o.ids, p_count: o.count, p_difficulty: o.difficulty, p_order: o.order, p_minutes: o.minutes });
    if (r?.ok) return { ok: true, id: r.id, durationMin: r.durationMin, items: r.items };
    return { ok: false, error: r?.error === 'NO_ELIGIBLE' ? 'مفيش أسئلة اختيار من متعدد مناسبة للإعدادات دي. غيّر الفلتر أو أضف أسئلة بخيارات.' : 'تعذر إنشاء الامتحان.' };
  } catch { return { ok: false, error: 'تعذر الاتصال بالخادم.' }; }
}
export async function mistakeExamSubmit(code: string, examId: string, answers: (number | null)[]):
  Promise<{ ok: true; score: number; total: number; late: boolean; items: MistakeExamResultItem[] } | { ok: false; error: string }> {
  try {
    const r = await srpc('ha_mistake_exam_submit', { p_code: code, p_device: getDeviceId(), p_exam: examId, p_answers: answers });
    return r?.ok ? { ok: true, score: r.score, total: r.total, late: !!r.late, items: r.items } : { ok: false, error: r?.error === 'ALREADY_SUBMITTED' ? 'تم تسليم هذا الامتحان من قبل.' : 'تعذر تسليم الامتحان.' };
  } catch { return { ok: false, error: 'تعذر الاتصال بالخادم. حاول مرة أخرى.' }; }
}
export async function mistakeExamsList(code: string): Promise<MistakeExamHistory[]> {
  try { const r = await srpc('ha_mistake_exams_list', { p_code: code, p_device: getDeviceId() }); return r?.ok ? r.items : []; } catch { return []; }
}
export async function teacherMistakesOverview(): Promise<TeacherMistakesOverview> {
  const r = await rpc('ha_teacher_mistakes_overview', {}, await teacherToken());
  if (!r || r.topLessons === undefined) throw new Error('تعذر تحميل تحليل الأخطاء.');
  return r as TeacherMistakesOverview;
}
