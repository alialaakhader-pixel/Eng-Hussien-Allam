import React from 'react';
import { 
  Atom, 
  Play, 
  KeyRound, 
  ShieldCheck, 
  Sparkles, 
  Download, 
  MessageSquare, 
  BookOpen, 
  ArrowLeft, 
  Zap, 
  CheckCircle2, 
  Users, 
  Award,
  Video
} from 'lucide-react';
import { Lesson, StudentUser } from '../types';
import { GradesShowcase } from './GradesShowcase';

interface HomeHeroProps {
  onOpenLessons: () => void;
  onOpenLoginModal: () => void;
  onOpenTeacherGate: () => void;
  onOpenForum: () => void;
  onSelectLesson: (id: string) => void;
  lessons: Lesson[];
  currentStudent: StudentUser | null;
}

export const HomeHero: React.FC<HomeHeroProps> = ({
  onOpenLessons,
  onOpenLoginModal,
  onOpenTeacherGate,
  onOpenForum,
  onSelectLesson,
  lessons,
  currentStudent
}) => {
  return (
    <div className="space-y-16 animate-in fade-in duration-300">
      
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 py-20 px-4 sm:px-6 lg:px-8 border-b border-slate-800 text-white">
        
        {/* Glow ambient circles */}
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 left-1/4 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Left/Main Text Copy */}
            <div className="lg:col-span-7 space-y-6 text-right">
              
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-800/90 border border-amber-500/30 text-amber-300 text-xs font-bold shadow-inner">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>المنصة التعليمية الرسمية · فيزياء الثانوية العامة والأزهر</span>
              </div>

              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-display font-black tracking-tight leading-[1.2] text-white">
                مش مجرد حفظ قوانين.. <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-l from-amber-400 via-amber-300 to-orange-400">
                  ده فهم هندسي وفيزيائي يفرّق!
                </span>
              </h1>

              <p className="text-base sm:text-lg text-slate-300 max-w-2xl leading-relaxed">
                مع <strong>المهندس حسين علام</strong>، افهم الفكرة من أصلها، حل أعقد مسائل كيرشوف والدينامو والحديثة بملاحظة العين وبأبسط الطرق، واستفد من نظام المشغل المحمي والأكواد والمنتدى العلمي.
              </p>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  onClick={onOpenLessons}
                  className="px-6 py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black rounded-2xl text-sm shadow-xl shadow-amber-500/25 transition-all hover:scale-105 active:scale-95 flex items-center gap-2.5"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>بدء مشاهدة المحاضرات 🎬</span>
                </button>

                {!currentStudent && (
                  <button
                    onClick={onOpenLoginModal}
                    className="px-6 py-3.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-2xl text-sm border border-slate-700 transition flex items-center gap-2 hover:border-amber-500/50"
                  >
                    <KeyRound className="w-4 h-4 text-amber-400" />
                    <span>دخول الطالب بكود المنصة 🔑</span>
                  </button>
                )}

                <button
                  onClick={onOpenTeacherGate}
                  className="px-5 py-3.5 bg-slate-800/80 hover:bg-amber-500/10 text-amber-300 font-bold rounded-2xl text-sm border border-amber-500/30 transition flex items-center gap-2"
                >
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                  <span>بوابة المدرس الخاصة 👨‍🏫</span>
                </button>

              </div>

              {/* Highlights check marks */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-4 text-xs font-semibold text-slate-300">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>تنزيل المحاضرات والـ PDF</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>توليد أكواد الطلاب وسجل الدخول</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>منتدى نقاشات وحلول معتمدة</span>
                </div>
              </div>

            </div>

            {/* Right Feature Card / Preview */}
            <div className="lg:col-span-5">
              <div className="relative bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5">
                
                {/* Visual Header */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                      <Atom className="w-5 h-5 animate-spin-slow" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-white">المحاضرة الحالية</h4>
                      <span className="text-[11px] text-amber-400 font-mono">3 ثانوي · الفصل الأول</span>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-bold">
                    متاح للمشاهدة
                  </span>
                </div>

                {/* Lesson Preview Box */}
                {lessons.length > 0 && lessons[0] ? (
                  <div 
                    onClick={() => onSelectLesson(lessons[0].id)}
                    className="group relative rounded-2xl overflow-hidden aspect-video bg-slate-950 border border-slate-800 cursor-pointer shadow-lg"
                  >
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent z-10" />
                    
                    {/* Simulated board graphic */}
                    <div className="absolute inset-0 blueprint-grid flex items-center justify-center">
                      <div className="w-14 h-14 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform">
                        <Play className="w-6 h-6 fill-current translate-x-[-2px]" />
                      </div>
                    </div>

                    <div className="absolute bottom-3 right-3 left-3 z-20">
                      <span className="text-[10px] text-amber-400 font-bold block">{lessons[0].unit}</span>
                      <h5 className="font-bold text-sm text-white line-clamp-1 group-hover:text-amber-300 transition-colors">
                        {lessons[0].title}
                      </h5>
                    </div>
                  </div>
                ) : (
                  <div 
                    onClick={onOpenTeacherGate}
                    className="group relative rounded-2xl overflow-hidden aspect-video bg-slate-950/80 border border-dashed border-amber-500/40 flex flex-col items-center justify-center p-4 text-center cursor-pointer hover:border-amber-500 transition"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-400 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                      <Atom className="w-6 h-6 animate-spin-slow" />
                    </div>
                    <span className="text-sm font-bold text-white block">بانتظار نشر المحاضرة الأولى</span>
                    <span className="text-xs text-amber-400 underline mt-1">اضغط للدخول لبوابة المدرس ورفع درس جديد</span>
                  </div>
                )}

                {/* Interactive stats inside card */}
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/60">
                    <span className="text-amber-400 font-bold font-mono block text-sm">1080p</span>
                    <span className="text-[10px] text-slate-400">جودة Full HD</span>
                  </div>
                  <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/60">
                    <span className="text-sky-400 font-bold font-mono block text-sm">0.5x - 2x</span>
                    <span className="text-[10px] text-slate-400">سرعات تشغيل</span>
                  </div>
                  <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/60">
                    <span className="text-emerald-400 font-bold font-mono block text-sm">PDF</span>
                    <span className="text-[10px] text-slate-400">ملخص وشيت</span>
                  </div>
                </div>

                <button
                  onClick={onOpenForum}
                  className="w-full py-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 text-xs font-bold transition flex items-center justify-center gap-2"
                >
                  <MessageSquare className="w-4 h-4 text-amber-400" />
                  <span>انتقل لأسئلة ومناقشات الطلاب في المنتدى ←</span>
                </button>

              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Grades showcase (glass frame) */}
      <GradesShowcase onPick={currentStudent ? onOpenLessons : onOpenLoginModal} />

      {/* Featured Lectures Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 text-amber-400 font-bold text-xs mb-1">
              <Video className="w-4 h-4" />
              <span>المحاضرات والشروحات الجاهزة</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-display font-black text-white">
              دروس منهج الفيزياء لجميع الصفوف
            </h2>
          </div>

          <button
            onClick={onOpenLessons}
            className="self-start sm:self-auto text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1.5 underline"
          >
            <span>عرض كل المحاضرات في المشغل</span>
            <ArrowLeft className="w-4 h-4" />
          </button>
        </div>

        {lessons.length === 0 ? (
          <div className="p-10 rounded-3xl bg-slate-900/60 border border-slate-800 text-center space-y-3">
            <BookOpen className="w-10 h-10 text-amber-500 mx-auto" />
            <h3 className="font-bold text-white text-base">
              {currentStudent ? 'لا توجد محاضرات منشورة لمرحلتك حالياً' : 'سجّل دخولك بكود الطالب لعرض المحاضرات'}
            </h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
              {currentStudent
                ? 'ستظهر المحاضرات هنا فور نشرها من المهندس حسين علام.'
                : 'المحاضرات متاحة للطلبة المشتركين فقط. أدخل الكود المسلم لك من المدرس لتظهر لك محاضرات مرحلتك.'}
            </p>
            {!currentStudent && (
              <button
                onClick={onOpenLoginModal}
                className="mt-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs transition"
              >
                دخول الطالب بالكود 🔑
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {lessons.slice(0, 6).map((lesson) => (
              <div
                key={lesson.id}
                onClick={() => onSelectLesson(lesson.id)}
                className="group bg-slate-900 border border-slate-800 hover:border-amber-500/60 rounded-3xl p-5 shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-400 font-bold text-xs font-mono">
                      {lesson.grade}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      {lesson.duration}
                    </span>
                  </div>

                  <h3 className="font-bold text-base text-white group-hover:text-amber-300 transition-colors line-clamp-2 leading-snug">
                    {lesson.title}
                  </h3>

                  <p className="text-xs text-slate-400 mt-2 line-clamp-2 leading-relaxed">
                    {lesson.description}
                  </p>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <span className="text-slate-400">{lesson.unit.split(' ')[0]}</span>
                  <span className="text-amber-400 font-bold flex items-center gap-1">
                    <span>مشاهدة وتحميل</span>
                    <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-1" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 4 Pillars Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 text-right space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-400 flex items-center justify-center font-bold">
              <Download className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-base text-white">تنزيل المحاضرات</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              إمكانية تنزيل الفيديوهات وشيتات الشرح والواجبات PDF للمذاكرة بدون إنترنت في أي وقت.
            </p>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 text-right space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-sky-500/15 text-sky-400 flex items-center justify-center font-bold">
              <KeyRound className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-base text-white">توليد أكواد الطلاب</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              توليد أكواد دخول للطلبة وتسجيل بياناتهم وحضورهم تلقائياً في سجل المدرس.
            </p>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 text-right space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/15 text-purple-400 flex items-center justify-center font-bold">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-base text-white">بوابة المدرس الخاصة</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              قسم خاص ومحمي للمهندس حسين علام لرفع الفيديوهات والشروحات وتوليد الأكواد وإدارة الطلاب.
            </p>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 text-right space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center font-bold">
              <MessageSquare className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-base text-white">منتدى فيزياء احترافي</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              مساحة تفاعلية لطرح المسائل والحلول مع وسم الإجابات المعتمدة من المهندس حسين علام.
            </p>
          </div>

        </div>
      </section>

    </div>
  );
};
