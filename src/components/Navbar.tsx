import React, { useState } from 'react';
import { 
  Atom, 
  BookOpen, 
  MessageSquare, 
  LayoutDashboard, 
  KeyRound, 
  ShieldCheck, 
  Bell, 
  Sun, 
  Moon, 
  Menu, 
  X, 
  LogOut, 
  UserCheck, 
  Sparkles,
  ChevronDown,
  Download,
  ClipboardList
} from 'lucide-react';
import { StudentUser, PlatformNotification } from '../types';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  currentStudent: StudentUser | null;
  onOpenStudentLogin: () => void;
  onLogoutStudent: () => void;
  isTeacherAuth: boolean;
  onLogoutTeacher: () => void;
  notifications: PlatformNotification[];
  onMarkNotificationRead: (id: string) => void;
  darkMode: boolean;
  setDarkMode: (dark: boolean) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  currentStudent,
  onOpenStudentLogin,
  onLogoutStudent,
  isTeacherAuth,
  onLogoutTeacher,
  notifications,
  onMarkNotificationRead,
  darkMode,
  setDarkMode
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleNavClick = (tabId: string) => {
    setActiveTab(tabId);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 bg-slate-900 dark:bg-slate-950 border-b border-slate-800 text-white transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-18">
          
          {/* Logo & Identity */}
          <div 
            onClick={() => handleNavClick('home')}
            className="flex items-center gap-3.5 cursor-pointer group select-none"
          >
            <div className="relative w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/25 group-hover:scale-105 transition-transform duration-300">
              <Atom className="w-6 h-6 text-slate-950 animate-spin-slow" />
              <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-slate-900 flex items-center justify-center">
                <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
              </div>
            </div>
            <div className="leading-tight">
              <div className="flex items-center gap-2">
                <span className="font-display font-black text-lg tracking-tight text-white group-hover:text-amber-400 transition-colors">
                  المهندس حسين علام
                </span>
                <span className="text-[10px] bg-amber-500/15 text-amber-400 px-2 py-0.5 rounded-full font-bold border border-amber-500/30">
                  فيزياء 2026
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">
                ثانوية عامة · أزهر · بكالوريا
              </p>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1.5 bg-slate-800/60 p-1.5 rounded-2xl border border-slate-700/50">
            <button
              onClick={() => handleNavClick('home')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-bold transition-all duration-200 ${
                activeTab === 'home'
                  ? 'bg-amber-500 text-slate-950 shadow-md font-black shadow-amber-500/20'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <span>الرئيسية</span>
            </button>

            <button
              onClick={() => handleNavClick('lessons')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-bold transition-all duration-200 ${
                activeTab === 'lessons'
                  ? 'bg-amber-500 text-slate-950 shadow-md font-black shadow-amber-500/20'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>الدروس والفيديوهات</span>
            </button>

            <button
              onClick={() => handleNavClick('forum')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-bold transition-all duration-200 ${
                activeTab === 'forum'
                  ? 'bg-amber-500 text-slate-950 shadow-md font-black shadow-amber-500/20'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span>المنتدى الطلابي</span>
              <span className="text-[10px] bg-sky-500/20 text-sky-300 px-1.5 py-0.5 rounded-full font-bold">
                نقاشات
              </span>
            </button>

            <button
              onClick={() => handleNavClick('exams')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-bold transition-all duration-200 ${
                activeTab === 'exams'
                  ? 'bg-amber-500 text-slate-950 shadow-md font-black shadow-amber-500/20'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <ClipboardList className="w-4 h-4" />
              <span>الامتحانات</span>
            </button>

            <button
              onClick={() => handleNavClick('dashboard')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-bold transition-all duration-200 ${
                activeTab === 'dashboard'
                  ? 'bg-amber-500 text-slate-950 shadow-md font-black shadow-amber-500/20'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>لوحة الطالب</span>
            </button>

            <button
              onClick={() => handleNavClick('teacher')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-bold transition-all duration-200 ${
                activeTab === 'teacher'
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md font-black shadow-amber-500/30'
                  : 'text-amber-400 hover:text-amber-300 hover:bg-amber-500/10'
              }`}
            >
              <KeyRound className="w-4 h-4" />
              <span>بوابة المدرس</span>
            </button>
          </nav>

          {/* Right Action Icons & Auth Badges */}
          <div className="flex items-center gap-2.5">
            {/* Theme Toggle */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 hover:text-amber-400 border border-slate-700/60 transition-colors"
              title={darkMode ? 'التبديل إلى الوضع الفاتح' : 'التبديل إلى الوضع الداكن'}
              aria-label="تبديل مظهر الموقع"
            >
              {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Notification Bell with Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowNotifs(!showNotifs)}
                className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 hover:text-amber-400 border border-slate-700/60 transition-colors relative"
                aria-label="الإشعارات"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 text-slate-950 text-[10px] font-black rounded-full flex items-center justify-center shadow-md animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notifications Dropdown */}
              {showNotifs && (
                <div className="absolute left-0 sm:right-auto sm:left-0 mt-2 w-80 sm:w-96 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4 text-amber-400" />
                      <h4 className="font-bold text-sm text-white">إشعارات المنصة</h4>
                    </div>
                    <span className="text-[11px] text-slate-400">
                      {notifications.length} إشعار
                    </span>
                  </div>

                  <div className="divide-y divide-slate-800/60 max-h-80 overflow-y-auto mt-2">
                    {notifications.length === 0 ? (
                      <p className="text-center py-6 text-xs text-slate-500">لا توجد إشعارات جديدة حالياً</p>
                    ) : (
                      notifications.map(n => (
                        <div 
                          key={n.id} 
                          onClick={() => onMarkNotificationRead(n.id)}
                          className={`py-3 px-2 rounded-xl transition cursor-pointer ${
                            n.read ? 'opacity-65 hover:bg-slate-800/40' : 'bg-amber-500/10 hover:bg-amber-500/15'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <h5 className="text-xs font-bold text-white leading-snug">{n.title}</h5>
                            <span className="text-[10px] text-amber-400/80 shrink-0 font-medium">{n.time}</span>
                          </div>
                          <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">{n.body}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Teacher Auth Badge if logged in */}
            {isTeacherAuth && (
              <div className="hidden md:flex items-center gap-2 bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/40 px-3 py-1.5 rounded-xl text-xs font-bold text-amber-300">
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                <span>المدرس (المهندس حسين)</span>
                <button
                  onClick={onLogoutTeacher}
                  title="تسجيل خروج المدرس"
                  className="hover:text-red-400 mr-1 p-0.5 rounded transition"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Student Auth / Login Button */}
            {currentStudent ? (
              <div className="flex items-center gap-2 bg-slate-800/90 border border-slate-700/70 px-3 py-1.5 rounded-xl text-xs">
                <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-[11px]">
                  {currentStudent.name.charAt(0)}
                </div>
                <div className="hidden sm:block text-right leading-tight">
                  <div className="font-bold text-white text-xs truncate max-w-[110px]">
                    {currentStudent.name}
                  </div>
                  <div className="text-[10px] text-emerald-400 font-mono">
                    {currentStudent.grade} · {currentStudent.accountId ? `ID ${currentStudent.accountId}` : currentStudent.codeUsed}
                  </div>
                </div>
                <button
                  onClick={onLogoutStudent}
                  title="تسجيل خروج الطالب"
                  className="text-slate-400 hover:text-red-400 p-1 rounded-lg transition"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={onOpenStudentLogin}
                className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-4 py-2 rounded-xl text-xs sm:text-sm shadow-md shadow-amber-500/20 transition-all hover:scale-105 active:scale-95"
              >
                <KeyRound className="w-4 h-4" />
                <span>دخول / حساب جديد</span>
              </button>
            )}

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 border border-slate-700/60"
              aria-label="القائمة"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-slate-900 border-b border-slate-800 px-4 pt-2 pb-6 space-y-2 animate-in slide-in-from-top-4 duration-200">
          <button
            onClick={() => handleNavClick('home')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-right ${
              activeTab === 'home' ? 'bg-amber-500 text-slate-950' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <span>الرئيسية</span>
          </button>

          <button
            onClick={() => handleNavClick('lessons')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-right ${
              activeTab === 'lessons' ? 'bg-amber-500 text-slate-950' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>الدروس والفيديوهات</span>
          </button>

          <button
            onClick={() => handleNavClick('forum')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-right ${
              activeTab === 'forum' ? 'bg-amber-500 text-slate-950' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>المنتدى الطلابي</span>
          </button>

          <button
            onClick={() => handleNavClick('exams')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-right ${
              activeTab === 'exams' ? 'bg-amber-500 text-slate-950' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            <span>الامتحانات</span>
          </button>

          <button
            onClick={() => handleNavClick('dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-right ${
              activeTab === 'dashboard' ? 'bg-amber-500 text-slate-950' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>لوحة تحكم الطالب</span>
          </button>

          <button
            onClick={() => handleNavClick('teacher')}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-bold text-right ${
              activeTab === 'teacher' ? 'bg-amber-500 text-slate-950' : 'text-amber-400 bg-amber-500/10 hover:bg-amber-500/20'
            }`}
          >
            <div className="flex items-center gap-3">
              <KeyRound className="w-4 h-4" />
              <span>بوابة المدرس الخاصة</span>
            </div>
          </button>

        </div>
      )}
    </header>
  );
};
