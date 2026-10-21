export type GradeType = '3ث' | '2ث' | '1ث' | 'بكالوريا';

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface LessonAttachmentItem {
  id: string;
  name: string;
  url: string;
  size?: string;
  type?: string;
}

export interface Lesson {
  id: string;
  title: string;
  grade: GradeType;
  chapter: string;
  unit: string;
  duration: string;
  description: string;
  videoUrl: string;
  backupVideoUrl?: string;
  downloadUrl?: string;
  pdfUrl?: string;
  pdfName?: string;
  pdfSize?: string;
  attachments?: LessonAttachmentItem[];
  publishedAt: string;
  viewsCount: number;
  keyPoints?: string[];
  quiz?: QuizQuestion[];
}

export interface StudentCode {
  code: string;
  grade: GradeType | 'جميع الصفوف';
  maxUses: number;
  timesUsed: number;
  status: 'active' | 'used' | 'revoked';
  createdAt: string;
  usedBy?: {
    studentName: string;
    studentPhone: string;
    usedAt: string;
  }[];
  note?: string;
}

export interface LessonWatchProgress {
  lessonId: string;
  lessonTitle: string;
  progressPercent: number;
  watchedMinutes: number;
  totalMinutes: number;
  lastWatchedAt: string;
  completed: boolean;
}

export interface StudentUser {
  id: string;
  name: string;
  phone: string;
  grade: GradeType;
  codeUsed: string;
  registeredAt: string;
  lastLoginAt: string;
  accountId?: number;
  email?: string;
  device?: string;
  status: 'online' | 'offline';
  completedLessonIds: string[];
  watchHistory?: LessonWatchProgress[];
  dailyWatchRate?: number; // e.g. 85%
  weeklyWatchRate?: number; // e.g. 90%
  monthlyWatchRate?: number; // e.g. 88%
  dailyWatchMinutes?: number;
  weeklyWatchHours?: number;
  monthlyWatchHours?: number;
  streakDays?: number;
  lastWatchedLessonId?: string;
  quizScores: {
    lessonId: string;
    lessonTitle: string;
    score: number;
    total: number;
    date: string;
  }[];
}

export interface ForumAnswer {
  id: string;
  authorName: string;
  authorRole: 'student' | 'teacher';
  isTeacherVerified: boolean;
  content: string;
  createdAt: string;
  upvotes: number;
}

export interface ForumPost {
  id: string;
  title: string;
  content: string;
  authorName: string;
  authorRole: 'student' | 'teacher';
  grade: GradeType;
  category: string;
  createdAt: string;
  upvotes: number;
  answers: ForumAnswer[];
}

export interface PlatformNotification {
  id: string;
  title: string;
  body: string;
  time: string;
  type: 'lesson' | 'code' | 'forum' | 'system';
  read: boolean;
}

export interface ExamQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex?: number;
  explanation?: string;
}

export interface Exam {
  id: string;
  title: string;
  grade: GradeType;
  durationMin: number;
  questions: ExamQuestion[];
  createdAt?: string;
}

export interface ExamReviewItem {
  correctIndex: number;
  explanation: string;
}

export interface ExamResult {
  examId: string;
  score: number;
  total: number;
  createdAt: string;
  answers: (number | null)[];
  review: ExamReviewItem[];
}

export interface ExamResultRow {
  id: string;
  examId: string;
  code: string;
  score: number;
  total: number;
  createdAt: string;
}

export interface Account {
  id: number;
  email: string;
  name: string;
  phone: string;
  grade: GradeType;
  code: string | null;
  accessUntil: string | null;
  active: boolean;
  createdAt: string;
}

export interface AccountInfo {
  id: number;
  email: string;
  accessUntil: string | null;
  hasAccess: boolean;
}
