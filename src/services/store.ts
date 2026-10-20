import { Lesson, StudentCode, StudentUser, ForumPost, PlatformNotification, GradeType } from '../types';
import { INITIAL_LESSONS, INITIAL_STUDENT_CODES, INITIAL_STUDENT_LOGINS, INITIAL_FORUM_POSTS, INITIAL_NOTIFICATIONS } from '../data/mockData';

const STORAGE_KEYS = {
  LESSONS: 'ha_physics_lessons_v7',
  CODES: 'ha_physics_codes_v7',
  STUDENTS: 'ha_physics_students_v7',
  FORUM: 'ha_physics_forum_v7',
  NOTIFICATIONS: 'ha_physics_notifs_v7',
  CURRENT_STUDENT: 'ha_physics_current_student_v7',
  TEACHER_AUTH: 'ha_physics_teacher_auth_v7',
  THEME: 'ha_physics_theme_v7'
};

function getStorage<T>(key: string, fallback: T): T {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch {
    return fallback;
  }
}

function setStorage<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save to localStorage', e);
  }
}

// Global state getters and setters
export function getStoredLessons(): Lesson[] {
  const loaded = getStorage<Lesson[]>(STORAGE_KEYS.LESSONS, INITIAL_LESSONS);
  return (loaded && loaded.length > 0) ? loaded : INITIAL_LESSONS;
}

export function saveLessons(lessons: Lesson[]): void {
  setStorage(STORAGE_KEYS.LESSONS, lessons);
}

export function getStoredCodes(): StudentCode[] {
  const loaded = getStorage<StudentCode[]>(STORAGE_KEYS.CODES, INITIAL_STUDENT_CODES);
  return (loaded && loaded.length > 0) ? loaded : INITIAL_STUDENT_CODES;
}

export function saveCodes(codes: StudentCode[]): void {
  setStorage(STORAGE_KEYS.CODES, codes);
}

export function getStoredStudents(): StudentUser[] {
  return getStorage<StudentUser[]>(STORAGE_KEYS.STUDENTS, INITIAL_STUDENT_LOGINS);
}

export function saveStudents(students: StudentUser[]): void {
  setStorage(STORAGE_KEYS.STUDENTS, students);
}

export function getStoredForum(): ForumPost[] {
  const loaded = getStorage<ForumPost[]>(STORAGE_KEYS.FORUM, INITIAL_FORUM_POSTS);
  return (loaded && loaded.length > 0) ? loaded : INITIAL_FORUM_POSTS;
}

export function saveForum(forum: ForumPost[]): void {
  setStorage(STORAGE_KEYS.FORUM, forum);
}

export function getStoredNotifications(): PlatformNotification[] {
  return getStorage<PlatformNotification[]>(STORAGE_KEYS.NOTIFICATIONS, INITIAL_NOTIFICATIONS);
}

export function saveNotifications(notifs: PlatformNotification[]): void {
  setStorage(STORAGE_KEYS.NOTIFICATIONS, notifs);
}

export function getCurrentStudent(): StudentUser | null {
  return getStorage<StudentUser | null>(STORAGE_KEYS.CURRENT_STUDENT, null);
}

export function saveCurrentStudent(student: StudentUser | null): void {
  setStorage(STORAGE_KEYS.CURRENT_STUDENT, student);
}

export function isTeacherAuthenticated(): boolean {
  return getStorage<boolean>(STORAGE_KEYS.TEACHER_AUTH, false);
}

export function setTeacherAuthenticated(auth: boolean): void {
  setStorage(STORAGE_KEYS.TEACHER_AUTH, auth);
}

// Code Generator Helper
export function generateRandomCode(prefix = 'PHYS', grade = '3ث'): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let rand = '';
  for (let i = 0; i < 4; i++) {
    rand += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  const gradeTag = grade === '3ث' ? '3SEC' : grade === '2ث' ? '2SEC' : grade === '1ث' ? '1SEC' : 'BAC';
  return `${prefix}-${gradeTag}-${rand}`;
}
