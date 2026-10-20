import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { HomeHero } from './components/HomeHero';
import { VideoPlayerView } from './components/VideoPlayerView';
import { ForumView } from './components/ForumView';
import { StudentDashboardView } from './components/StudentDashboardView';
import { TeacherGate } from './components/TeacherGate';
import { TeacherDashboard } from './components/TeacherDashboard';
import { StudentLoginModal } from './components/StudentLoginModal';
import { GlassPhysicsBackground } from './components/GlassPhysicsBackground';

import {
  Lesson,
  StudentCode,
  StudentUser,
  ForumPost,
  ForumAnswer,
  PlatformNotification,
  GradeType
} from './types';

import * as api from './services/api';

const POLL_MS = 30000;

export default function App() {
  // Navigation State
  const [activeTab, setActiveTab] = useState<string>('home');
  const [darkMode, setDarkMode] = useState<boolean>(true);

  // Core Data State (loaded from Supabase)
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [selectedLessonId, setSelectedLessonId] = useState<string>('');
  const [codes, setCodes] = useState<StudentCode[]>([]);
  const [students, setStudents] = useState<StudentUser[]>([]);
  const [forumPosts, setForumPosts] = useState<ForumPost[]>([]);
  const [notifications, setNotifications] = useState<PlatformNotification[]>([]);

  // Auth State
  const [currentStudent, setCurrentStudent] = useState<StudentUser | null>(null);
  const [isTeacherAuth, setIsTeacherAuth] = useState<boolean>(false);
  const [showStudentLoginModal, setShowStudentLoginModal] = useState<boolean>(false);
  const [booting, setBooting] = useState<boolean>(true);

  // Toast / Live Alert
  const [liveToast, setLiveToast] = useState<string | null>(null);

  const studentRef = useRef<StudentUser | null>(null);
  studentRef.current = currentStudent;
  const teacherRef = useRef<boolean>(false);
  teacherRef.current = isTeacherAuth;

  const fail = (e: any) => {
    console.error(e);
    setLiveToast('تعذر إتمام العملية: ' + (e?.message || 'خطأ في الاتصال'));
  };

  // ---------- data loaders ----------
  const pickLesson = (list: Lesson[], grade?: GradeType) => {
    setSelectedLessonId(prev => {
      if (prev && list.some(l => l.id === prev)) return prev;
      const g = grade ? list.find(l => l.grade === grade) : undefined;
      return g ? g.id : list[0]?.id || '';
    });
  };

  const loadTeacher = useCallback(async () => {
    const d = await api.teacherLoadAll();
    setLessons(d.lessons);
    setCodes(d.codes);
    setStudents(d.students);
    setForumPosts(d.forum);
    setNotifications(d.notifications);
    pickLesson(d.lessons);
  }, []);

  const loadStudent = useCallback(async (code: string, grade?: GradeType) => {
    const [feed, forum] = await Promise.all([api.studentFeed(code), api.forumFeedStudent(code)]);
    if (feed) {
      setLessons(feed.lessons);
      setNotifications(feed.notifications);
      pickLesson(feed.lessons, grade);
    }
    setForumPosts(forum);
  }, []);

  // Initialize on mount: restore teacher or student session
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (await api.teacherSessionValid()) {
          setIsTeacherAuth(true);
          await loadTeacher();
        } else {
          const restored = await api.studentRestore();
          if (restored && alive) {
            setCurrentStudent(restored.student);
            setLessons(restored.feed.lessons);
            setNotifications(restored.feed.notifications);
            pickLesson(restored.feed.lessons, restored.student.grade);
            setForumPosts(await api.forumFeedStudent(restored.student.codeUsed));
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (alive) setBooting(false);
      }
    })();
    return () => { alive = false; };
  }, [loadTeacher]);

  // Poll for fresh data (new lessons, forum, student log)
  useEffect(() => {
    const tick = () => {
      if (document.hidden) return;
      if (teacherRef.current) loadTeacher().catch(() => {});
      else if (studentRef.current) loadStudent(studentRef.current.codeUsed, studentRef.current.grade).catch(() => {});
    };
    const id = setInterval(tick, POLL_MS);
    window.addEventListener('focus', tick);
    return () => { clearInterval(id); window.removeEventListener('focus', tick); };
  }, [loadTeacher, loadStudent]);

  // Update HTML dark class
  useEffect(() => {
    if (darkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [darkMode]);

  // Handle Live Toast Timer
  useEffect(() => {
    if (!liveToast) return;
    const timer = setTimeout(() => setLiveToast(null), 5000);
    return () => clearTimeout(timer);
  }, [liveToast]);

  // --------------------------------------------------------------------------
  // ACTIONS: LESSONS (teacher)
  // --------------------------------------------------------------------------
  const handleAddLesson = async (newLesson: Lesson) => {
    try {
      await api.teacherSaveLesson(newLesson);
      setLessons(prev => [newLesson, ...prev]);
      setSelectedLessonId(newLesson.id);
      setLiveToast(`📢 تم نشر المحاضرة "${newLesson.title}" وستظهر لطلبة ${newLesson.grade} فوراً!`);
      loadTeacher().catch(() => {});
    } catch (e) { fail(e); }
  };

  const handleDeleteLesson = async (id: string) => {
    try {
      await api.teacherDeleteLesson(id);
      const updated = lessons.filter(l => l.id !== id);
      setLessons(updated);
      if (selectedLessonId === id) setSelectedLessonId(updated[0]?.id || '');
    } catch (e) { fail(e); }
  };

  // --------------------------------------------------------------------------
  // ACTIONS: CODES (teacher)
  // --------------------------------------------------------------------------
  const handleAddCode = async (newCode: StudentCode) => {
    try {
      await api.teacherAddCode(newCode);
      setCodes(prev => [{ ...newCode, code: newCode.code.toUpperCase() }, ...prev]);
    } catch (e) { fail(e); }
  };

  const handleRevokeCode = async (codeStr: string) => {
    try {
      await api.teacherRevokeCode(codeStr);
      setCodes(prev => prev.map(c => c.code === codeStr ? { ...c, status: 'revoked' as const } : c));
    } catch (e) { fail(e); }
  };

  const handleDeleteCode = async (codeStr: string) => {
    try {
      await api.teacherDeleteCode(codeStr);
      setCodes(prev => prev.filter(c => c.code !== codeStr));
      setStudents(prev => prev.filter(s => s.codeUsed !== codeStr));
    } catch (e) { fail(e); }
  };

  // --------------------------------------------------------------------------
  // ACTIONS: STUDENT LOGIN
  // --------------------------------------------------------------------------
  const handleStudentAttempt = async (name: string, phone: string, grade: GradeType, code: string) => {
    const r = await api.studentLogin(code, name, phone, grade);
    if (!r.ok) return { ok: false as const, error: r.error };

    setCurrentStudent(r.student);
    setLessons(r.feed.lessons);
    setNotifications(r.feed.notifications);
    pickLesson(r.feed.lessons, r.student.grade);
    api.forumFeedStudent(r.student.codeUsed).then(setForumPosts).catch(() => {});
    const gradeMatching = r.feed.lessons.find(l => l.grade === r.student.grade);
    if (gradeMatching) setSelectedLessonId(gradeMatching.id);
    setActiveTab('lessons');

    const gradeLabel = r.student.grade === '1ث' ? 'الصف الأول الثانوي' : r.student.grade === '2ث' ? 'الصف الثاني الثانوي' : 'الصف الثالث الثانوي';
    setLiveToast(`مرحباً يا بطل ${r.student.name}! تم فتح محاضرات ${gradeLabel} وتفعيل المشغل لحسابك 🚀`);
    return { ok: true as const };
  };

  const handleLogoutStudent = () => {
    api.clearStudentSession();
    setCurrentStudent(null);
    setLessons([]);
    setNotifications([]);
    setForumPosts([]);
    setSelectedLessonId('');
    setActiveTab('home');
    setLiveToast('تم تسجيل الخروج بنجاح.');
  };

  // --------------------------------------------------------------------------
  // ACTIONS: TEACHER AUTH
  // --------------------------------------------------------------------------
  const handleTeacherUnlock = async () => {
    setIsTeacherAuth(true);
    try { await loadTeacher(); } catch (e) { fail(e); }
    setLiveToast('أهلاً بك يا مهندس حسين علام! تم تسجيل الدخول بنجاح إلى لوحة التحكم.');
  };

  const handleTeacherLogout = () => {
    api.teacherLogout();
    setIsTeacherAuth(false);
    setLessons([]); setCodes([]); setStudents([]); setForumPosts([]); setNotifications([]);
    setSelectedLessonId('');
    setActiveTab('home');
    setLiveToast('تم تسجيل خروج المدرس.');
  };

  // --------------------------------------------------------------------------
  // ACTIONS: FORUM
  // --------------------------------------------------------------------------
  const handleAddForumPost = async (post: ForumPost) => {
    try {
      if (isTeacherAuth) await api.forumSaveTeacher(post);
      else if (currentStudent) await api.forumAddPostStudent(currentStudent.codeUsed, post);
      else { setShowStudentLoginModal(true); return; }
      setForumPosts(prev => [post, ...prev]);
      setLiveToast('تم نشر سؤالك في المنتدى بنجاح! سيتم إشعار المهندس حسين علام وزملائك.');
    } catch (e) { fail(e); }
  };

  const handleAddForumAnswer = async (postId: string, answer: ForumAnswer) => {
    try {
      if (isTeacherAuth) {
        const post = forumPosts.find(p => p.id === postId);
        if (!post) return;
        await api.forumSaveTeacher({ ...post, answers: [...post.answers, answer] });
      } else if (currentStudent) {
        await api.forumAddAnswerStudent(currentStudent.codeUsed, postId, answer);
      } else { setShowStudentLoginModal(true); return; }
      setForumPosts(prev => prev.map(p => p.id === postId ? { ...p, answers: [...p.answers, answer] } : p));
      setLiveToast(answer.isTeacherVerified ? 'تم اعتماد ونشر رد المدرس في المنتدى.' : 'تمت إضافة إجابتك بنجاح.');
    } catch (e) { fail(e); }
  };

  const handleUpvotePost = async (postId: string) => {
    try {
      if (isTeacherAuth) {
        const post = forumPosts.find(p => p.id === postId);
        if (post) await api.forumSaveTeacher({ ...post, upvotes: post.upvotes + 1 });
      } else if (currentStudent) {
        await api.forumUpvoteStudent(currentStudent.codeUsed, postId);
      } else { setShowStudentLoginModal(true); return; }
      setForumPosts(prev => prev.map(p => p.id === postId ? { ...p, upvotes: p.upvotes + 1 } : p));
    } catch (e) { fail(e); }
  };

  // --------------------------------------------------------------------------
  // ACTIONS: QUIZ SCORE & PROGRESS (student, saved to server)
  // --------------------------------------------------------------------------
  const updateStudent = (updated: StudentUser) => {
    setCurrentStudent(updated);
    api.saveStudentProgress(updated);
  };

  const handleSaveQuizScore = (lessonId: string, score: number, total: number) => {
    if (!currentStudent) return;
    const lessonObj = lessons.find(l => l.id === lessonId);
    const newScoreItem = {
      lessonId,
      lessonTitle: lessonObj?.title || 'اختبار فيزياء',
      score,
      total,
      date: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
    };
    updateStudent({
      ...currentStudent,
      quizScores: [newScoreItem, ...currentStudent.quizScores.filter(qs => qs.lessonId !== lessonId)]
    });
    setLiveToast(`أحسنت! تم حفظ نتيجتك (${score}/${total}) في سجل إنجازك.`);
  };

  const handleMarkLessonCompleted = (lessonId: string) => {
    if (!currentStudent) return;
    if (currentStudent.completedLessonIds.includes(lessonId)) return;
    updateStudent({
      ...currentStudent,
      completedLessonIds: [...currentStudent.completedLessonIds, lessonId]
    });
  };

  const handleMarkNotificationRead = (id: string) => {
    api.markNotifRead(id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const activeLesson = lessons.find(l => l.id === selectedLessonId) || (lessons.length > 0 ? lessons[0] : null);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950 relative overflow-x-hidden">
      
      {/* Floating Glassy Physics Apparatus & Orbits Background */}
      <GlassPhysicsBackground />

      {/* Toast Notification Alert */}
      {liveToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 max-w-md w-full px-4 animate-in slide-in-from-top-4 duration-300">
          <div className="bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-bold p-4 rounded-2xl shadow-2xl flex items-center justify-between text-xs sm:text-sm">
            <span>{liveToast}</span>
            <button 
              onClick={() => setLiveToast(null)} 
              className="mr-2 text-slate-950/70 hover:text-slate-950 font-black text-lg"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Main Navigation Bar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentStudent={currentStudent}
        onOpenStudentLogin={() => setShowStudentLoginModal(true)}
        onLogoutStudent={handleLogoutStudent}
        isTeacherAuth={isTeacherAuth}
        onLogoutTeacher={handleTeacherLogout}
        notifications={notifications}
        onMarkNotificationRead={handleMarkNotificationRead}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
      />

      {/* Main Content Area */}
      <main className="flex-1 relative z-10">
        {activeTab === 'home' && (
          <HomeHero
            onOpenLessons={() => setActiveTab('lessons')}
            onOpenLoginModal={() => setShowStudentLoginModal(true)}
            onOpenTeacherGate={() => setActiveTab('teacher')}
            onOpenForum={() => setActiveTab('forum')}
            onSelectLesson={(id) => {
              setSelectedLessonId(id);
              setActiveTab('lessons');
            }}
            lessons={lessons}
            currentStudent={currentStudent}
          />
        )}

        {activeTab === 'lessons' && (
          <VideoPlayerView
            lesson={activeLesson}
            allLessons={lessons}
            onSelectLesson={(id) => setSelectedLessonId(id)}
            currentStudent={currentStudent}
            onOpenLoginModal={() => setShowStudentLoginModal(true)}
            onSaveQuizScore={handleSaveQuizScore}
            onMarkLessonCompleted={handleMarkLessonCompleted}
            onOpenTeacherUpload={() => setActiveTab('teacher')}
          />
        )}

        {activeTab === 'forum' && (
          <ForumView
            posts={forumPosts}
            onAddPost={handleAddForumPost}
            onAddAnswer={handleAddForumAnswer}
            onUpvotePost={handleUpvotePost}
            currentStudent={currentStudent}
            isTeacherAuth={isTeacherAuth}
            onOpenLoginModal={() => setShowStudentLoginModal(true)}
          />
        )}

        {activeTab === 'dashboard' && (
          <StudentDashboardView
            currentStudent={currentStudent}
            lessons={lessons}
            onSelectLesson={(id) => {
              setSelectedLessonId(id);
              setActiveTab('lessons');
            }}
            onOpenLoginModal={() => setShowStudentLoginModal(true)}
          />
        )}

        {activeTab === 'teacher' && (
          isTeacherAuth ? (
            <TeacherDashboard
              lessons={lessons}
              onAddLesson={handleAddLesson}
              onDeleteLesson={handleDeleteLesson}
              codes={codes}
              onAddCode={handleAddCode}
              onRevokeCode={handleRevokeCode}
              onDeleteCode={handleDeleteCode}
              students={students}
              forumPosts={forumPosts}
              onTeacherReply={(postId, text) => {
                const answer: ForumAnswer = {
                  id: 'ans-' + Date.now(),
                  authorName: 'المهندس حسين علام',
                  authorRole: 'teacher',
                  isTeacherVerified: true,
                  content: text,
                  createdAt: 'الآن',
                  upvotes: 0
                };
                handleAddForumAnswer(postId, answer);
              }}
              onLogout={handleTeacherLogout}
              onSelectLessonForPreview={(id) => {
                setSelectedLessonId(id);
                setActiveTab('lessons');
              }}
            />
          ) : (
            <TeacherGate
              onUnlock={handleTeacherUnlock}
              onCancel={() => setActiveTab('home')}
            />
          )
        )}
      </main>

      {/* Student Code Login Modal */}
      <StudentLoginModal
        isOpen={showStudentLoginModal}
        onClose={() => setShowStudentLoginModal(false)}
        onAttemptLogin={handleStudentAttempt}
      />

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-12 px-4 sm:px-6 lg:px-8 text-slate-400 text-xs">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-right space-y-1">
            <span className="font-display font-black text-white text-sm block">
              منصة المهندس حسين علام للفيزياء © 2026
            </span>
            <p>الثانوية العامة والأزهر والبكالوريا · شرح هندسي وفهم فيزيائي متكامل</p>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs font-medium">
            <button onClick={() => setActiveTab('home')} className="hover:text-amber-400 transition">
              الرئيسية
            </button>
            <span>·</span>
            <button onClick={() => setActiveTab('lessons')} className="hover:text-amber-400 transition">
              مشغل الدروس
            </button>
            <span>·</span>
            <button onClick={() => setActiveTab('forum')} className="hover:text-amber-400 transition">
              منتدى النقاشات
            </button>
            <span>·</span>
            <button onClick={() => setActiveTab('dashboard')} className="hover:text-amber-400 transition">
              لوحة الطالب
            </button>
            <span>·</span>
            <button onClick={() => setActiveTab('teacher')} className="text-amber-400 hover:text-amber-300 font-bold transition">
              بوابة المدرس
            </button>
          </div>
        </div>
      </footer>

    </div>
  );
}
