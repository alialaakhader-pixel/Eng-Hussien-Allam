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
  NO_ACCOUNT: 'هذا الحساب ليس حساب طالب.'
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
    const r = await rpc('ha_acc_me', {}, t);
    return r?.ok ? toMe(r) : null;
  } catch { return null; }
}

export async function accountLogin(email: string, password: string):
  Promise<{ ok: true; me: AccountMe } | { ok: false; error: string }> {
  try {
    const r = await http('/auth/v1/token?grant_type=password', { method: 'POST', body: { email: email.trim().toLowerCase(), password } });
    writeAcc(r);
    const me = await rpc('ha_acc_me', {}, r.access_token);
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
    code: a.code || null, accessUntil: a.access_until || null, active: !!a.active, createdAt: a.created_at
  };
}
function mapExam(e: any): Exam {
  return {
    id: e.id, title: e.title, grade: e.grade as GradeType, durationMin: e.duration_min,
    questions: e.questions || [], createdAt: e.created_at
  };
}

export async function teacherLoadAll(): Promise<TeacherData> {
  const [lessons, codes, students, notifs, forum, accounts, exams, results] = await Promise.all([
    tq('/rest/v1/ha_lessons?select=data,created_at&order=created_at.desc'),
    tq('/rest/v1/ha_codes?select=*&order=created_at.desc'),
    tq('/rest/v1/ha_students?select=*'),
    tq('/rest/v1/ha_notifications?select=*&order=created_at.desc&limit=50'),
    tq('/rest/v1/ha_forum?select=data&order=created_at.desc'),
    tq('/rest/v1/ha_accounts?select=*&order=id.desc'),
    tq('/rest/v1/ha_exams?select=*&order=created_at.desc'),
    tq('/rest/v1/ha_exam_results?select=*&order=created_at.desc')
  ]);
  const codeMap = new Map<string, any>(codes.map((c: any) => [c.code, c]));
  return {
    lessons: lessons.map((l: any) => l.data),
    codes: codes.filter((c: any) => c.note !== ACC_NOTE).map(mapCode),
    students: students.map((s: any) => mapStudentRow(s, codeMap.get(s.code))),
    forum: forum.map((f: any) => f.data),
    notifications: notifs.map(mapNotif),
    accounts: accounts.map(mapAccount),
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
