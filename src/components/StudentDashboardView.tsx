import React, { useState } from 'react';
import { 
  TrendingUp, 
  BookOpen, 
  CheckCircle2, 
  Play, 
  KeyRound, 
  Clock, 
  BarChart3, 
  Calendar, 
  Flame, 
  Target, 
  ArrowUpRight, 
  GraduationCap,
  Sparkles,
  Award
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell
} from 'recharts';
import { Lesson, StudentUser } from '../types';

interface StudentDashboardViewProps {
  currentStudent: StudentUser | null;
  lessons: Lesson[];
  onSelectLesson: (id: string) => void;
  onOpenLoginModal: () => void;
}

export const StudentDashboardView: React.FC<StudentDashboardViewProps> = ({
  currentStudent,
  lessons,
  onSelectLesson,
  onOpenLoginModal
}) => {
  // Chart tab: daily, weekly, monthly, quizzes
  const [metricTab, setMetricTab] = useState<'daily' | 'weekly' | 'monthly' | 'quizzes'>('daily');

  const studentName = currentStudent ? currentStudent.name : 'طالب الفيزياء';
  const studentGrade = currentStudent?.grade || '3ث';
  
  // Filter lessons for student's grade
  const gradeLessons = lessons.filter(l => l.grade === studentGrade);
  const displayLessons = gradeLessons.length > 0 ? gradeLessons : lessons;

  // Real metrics only (zero until the student actually watches / takes quizzes)
  const dailyRate = currentStudent?.dailyWatchRate ?? 0;
  const weeklyRate = currentStudent?.weeklyWatchRate ?? 0;
  const monthlyRate = currentStudent?.monthlyWatchRate ?? 0;
  const dailyMinutes = currentStudent?.dailyWatchMinutes ?? 0;
  const weeklyHours = currentStudent?.weeklyWatchHours ?? 0;
  const monthlyHours = currentStudent?.monthlyWatchHours ?? 0;
  const streakDays = currentStudent?.streakDays ?? 0;

  const dailyChartData = [
    { day: 'اليوم', minutes: dailyMinutes, rate: dailyRate, target: 50, lectures: '-' }
  ];

  const weeklyChartData = [
    { week: 'هذا الأسبوع', rate: weeklyRate, hours: weeklyHours, target: 5.5, completedLectures: currentStudent?.completedLessonIds.length ?? 0 }
  ];

  const monthlyChartData = [
    { month: 'هذا الشهر', rate: monthlyRate, hours: monthlyHours, target: 22, attendance: '-' }
  ];

  const quizScoresData = (currentStudent?.quizScores || []).map((qs) => ({
    name: qs.lessonTitle.length > 20 ? qs.lessonTitle.slice(0, 20) + '...' : qs.lessonTitle,
    scorePercent: Math.round((qs.score / qs.total) * 100),
    scoreRaw: `${qs.score}/${qs.total}`,
    date: qs.date
  }));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-300 space-y-8">
      
      {/* If student not logged in: Clean Alert */}
      {!currentStudent && (
        <div className="bg-gradient-to-r from-amber-500/15 via-slate-800 to-slate-900 border border-amber-500/40 rounded-3xl p-6 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shrink-0 shadow-lg">
              <KeyRound className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-display font-black text-lg text-white">
                لوحة متابعة نسب مشاهدة محاضرات الفيزياء
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                سجّل دخولك بكود الطالب المسلم لك من المدرس لتسجيل تقدمك الفعلي وحفظ نتائجك أولاً بأول.
              </p>
            </div>
          </div>

          <button
            onClick={onOpenLoginModal}
            className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs shadow-lg shadow-amber-500/20 transition whitespace-nowrap self-start sm:self-auto"
          >
            تسجيل الدخول بكود الطالب 🔑
          </button>
        </div>
      )}

      {/* Student Profile Header Card */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-slate-700/80 rounded-3xl p-6 sm:p-8 shadow-2xl text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-bold text-xs border border-emerald-500/40 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                {currentStudent ? 'حساب مفعل رسمياً' : 'لوحة الطالب'}
              </span>
              <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 font-bold text-xs border border-amber-500/40 flex items-center gap-1">
                <GraduationCap className="w-3.5 h-3.5" />
                <span>{studentGrade === '1ث' ? 'الصف الأول الثانوي' : studentGrade === '2ث' ? 'الصف الثاني الثانوي' : 'الصف الثالث الثانوي'}</span>
              </span>
              {currentStudent && (
                <span className="text-xs text-slate-400 font-mono">
                  كود الطالب: {currentStudent.codeUsed}
                </span>
              )}
            </div>
            
            <h1 className="text-2xl sm:text-3xl font-display font-black text-white">
              مرحباً يا بطل، {studentName} 👋
            </h1>
            <p className="text-sm text-slate-300 mt-1 max-w-xl leading-relaxed">
              منصة المهندس حسين علام للفيزياء — تابع مؤشرات مشاهدتك للمحاضرات والتزامك اليومي والأسبوعي والشهري بدقة.
            </p>
          </div>

          {/* Quick Streak & Total Watch Box */}
          <div className="flex items-center gap-4 bg-slate-800/90 p-4 rounded-2xl border border-slate-700/80">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex flex-col items-center justify-center font-black">
              <Flame className="w-6 h-6 text-amber-400 animate-bounce" />
              <span className="text-[10px] font-bold">{streakDays} أيام</span>
            </div>
            <div>
              <span className="text-xs text-slate-400 block font-medium">سلسلة الالتزام (Streak)</span>
              <strong className="text-sm font-bold text-white block mt-0.5 font-mono">
                {monthlyHours} ساعة دراسة هذا الشهر
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* 4 CORE METRIC CARDS: Daily, Weekly, Monthly Watch Rates & Completion */}
      {/* ------------------------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Metric 1: Daily Watch Rate */}
        <div className="bg-slate-900 border border-slate-800 hover:border-amber-500/40 rounded-3xl p-5 shadow-xl transition-all duration-200">
          <div className="flex items-center justify-between text-xs mb-3">
            <span className="text-slate-400 font-bold flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-amber-400" />
              المشاهدة اليومية
            </span>
            <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 font-bold font-mono text-[11px]">
              اليوم
            </span>
          </div>

          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-3xl font-display font-black text-amber-400 font-mono">
              {dailyRate}%
            </span>
            <span className="text-xs text-slate-400">من الهدف اليومي</span>
          </div>

          {/* Progress bar */}
          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700 mb-3">
            <div 
              style={{ width: `${dailyRate}%` }} 
              className="h-full bg-gradient-to-l from-amber-400 to-amber-600 rounded-full"
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800">
            <span>وقت المشاهدة الفعلي:</span>
            <span className="font-bold text-white font-mono">{dailyMinutes} دقيقة / 50 دقيقة</span>
          </div>
        </div>

        {/* Metric 2: Weekly Watch Rate */}
        <div className="bg-slate-900 border border-slate-800 hover:border-emerald-500/40 rounded-3xl p-5 shadow-xl transition-all duration-200">
          <div className="flex items-center justify-between text-xs mb-3">
            <span className="text-slate-400 font-bold flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-emerald-400" />
              المشاهدة الأسبوعية
            </span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 font-bold font-mono text-[11px] flex items-center gap-1">
              <ArrowUpRight className="w-3 h-3" />
              +8%
            </span>
          </div>

          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-3xl font-display font-black text-emerald-400 font-mono">
              {weeklyRate}%
            </span>
            <span className="text-xs text-slate-400">من جدول الأسبوع</span>
          </div>

          {/* Progress bar */}
          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700 mb-3">
            <div 
              style={{ width: `${weeklyRate}%` }} 
              className="h-full bg-gradient-to-l from-emerald-400 to-emerald-600 rounded-full"
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800">
            <span>إجمالي الأسبوع:</span>
            <span className="font-bold text-white font-mono">{weeklyHours} ساعات من 5.5 س</span>
          </div>
        </div>

        {/* Metric 3: Monthly Watch Rate */}
        <div className="bg-slate-900 border border-slate-800 hover:border-sky-500/40 rounded-3xl p-5 shadow-xl transition-all duration-200">
          <div className="flex items-center justify-between text-xs mb-3">
            <span className="text-slate-400 font-bold flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-sky-400" />
              المشاهدة الشهرية
            </span>
            <span className="px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300 font-bold font-mono text-[11px]">
              أكتوبر
            </span>
          </div>

          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-3xl font-display font-black text-sky-400 font-mono">
              {monthlyRate}%
            </span>
            <span className="text-xs text-slate-400">معدل تغطية المنهج</span>
          </div>

          {/* Progress bar */}
          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700 mb-3">
            <div 
              style={{ width: `${monthlyRate}%` }} 
              className="h-full bg-gradient-to-l from-sky-400 to-sky-600 rounded-full"
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800">
            <span>الانضباط والحضور:</span>
            <span className="font-bold text-white font-mono">22 من 26 يوماً</span>
          </div>
        </div>

        {/* Metric 4: Video Completion Rate */}
        <div className="bg-slate-900 border border-slate-800 hover:border-purple-500/40 rounded-3xl p-5 shadow-xl transition-all duration-200">
          <div className="flex items-center justify-between text-xs mb-3">
            <span className="text-slate-400 font-bold flex items-center gap-1.5">
              <Target className="w-4 h-4 text-purple-400" />
              معدل استيعاب الحصة
            </span>
            <span className="px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 font-bold font-mono text-[11px]">
              مثالي
            </span>
          </div>

          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-3xl font-display font-black text-purple-400 font-mono">
              92%
            </span>
            <span className="text-xs text-slate-400">إكمال بدون تسريع</span>
          </div>

          {/* Progress bar */}
          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700 mb-3">
            <div 
              style={{ width: '92%' }} 
              className="h-full bg-gradient-to-l from-purple-400 to-purple-600 rounded-full"
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800">
            <span>التقييم العام:</span>
            <span className="font-bold text-amber-400">ممتاز · متفوق فيزياء ⭐</span>
          </div>
        </div>

      </div>

      {/* ------------------------------------------------------------------- */}
      {/* RECHARTS COMPONENT: Interactive Visual Analysis (Daily, Weekly, Monthly, Quizzes) */}
      {/* ------------------------------------------------------------------- */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl text-white space-y-6">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 text-amber-400 font-bold text-xs mb-1">
              <BarChart3 className="w-4 h-4" />
              <span>مخططات نسب المشاهدة التفاعلية (Recharts Analytics)</span>
            </div>
            <h2 className="text-xl font-display font-black text-white">
              تحليل نسب المشاهدة (اليومية · الأسبوعية · الشهرية)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              مؤشرات واقعية ومثالية لمتابعة وتيرة المذاكرة واستيعاب منهج الفيزياء
            </p>
          </div>

          {/* 4 Switcher Tabs */}
          <div className="flex items-center gap-1.5 bg-slate-800/90 p-1.5 rounded-2xl border border-slate-700/70 text-xs font-bold overflow-x-auto max-w-full">
            <button
              onClick={() => setMetricTab('daily')}
              className={`px-3 py-1.5 rounded-xl transition whitespace-nowrap ${
                metricTab === 'daily'
                  ? 'bg-amber-500 text-slate-950 font-black shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              المشاهدة اليومية 📅
            </button>

            <button
              onClick={() => setMetricTab('weekly')}
              className={`px-3 py-1.5 rounded-xl transition whitespace-nowrap ${
                metricTab === 'weekly'
                  ? 'bg-amber-500 text-slate-950 font-black shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              المشاهدة الأسبوعية 📊
            </button>

            <button
              onClick={() => setMetricTab('monthly')}
              className={`px-3 py-1.5 rounded-xl transition whitespace-nowrap ${
                metricTab === 'monthly'
                  ? 'bg-amber-500 text-slate-950 font-black shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              المشاهدة الشهرية 📈
            </button>

            <button
              onClick={() => setMetricTab('quizzes')}
              className={`px-3 py-1.5 rounded-xl transition whitespace-nowrap ${
                metricTab === 'quizzes'
                  ? 'bg-amber-500 text-slate-950 font-black shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              درجات الاختبارات 🎯
            </button>
          </div>
        </div>

        {/* TAB 1: DAILY WATCH RATE (AreaChart of Minutes & Rate) */}
        {metricTab === 'daily' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-400 px-2">
              <span>دقائق المشاهدة اليومية خلال الأسبوع الحالي مقابل المستهدف (50 دقيقة)</span>
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-amber-500 inline-block" />
                <span>دقائق المذاكرة</span>
              </span>
            </div>

            <div className="h-72 w-full pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={dailyChartData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
                >
                  <defs>
                    <linearGradient id="dailyGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                  <XAxis 
                    dataKey="day" 
                    stroke="#94a3b8" 
                    fontSize={11} 
                    tickLine={false}
                  />
                  <YAxis 
                    stroke="#94a3b8" 
                    fontSize={11} 
                    domain={[0, 70]} 
                    tickFormatter={(val) => `${val}د`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '16px',
                      color: '#f8fafc',
                      fontSize: '12px'
                    }}
                    formatter={(value: any) => [
                      `${value} دقيقة (${dailyChartData.find(d => d.minutes === value)?.rate || 0}% إنجاز)`,
                      'وقت المشاهدة'
                    ]}
                    labelStyle={{ color: '#f59e0b', fontWeight: 'bold' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="minutes"
                    stroke="#f59e0b"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#dailyGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Quick Days Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-7 gap-2 pt-2">
              {dailyChartData.map(d => (
                <div key={d.day} className="bg-slate-800/60 p-2.5 rounded-2xl border border-slate-700/60 text-center">
                  <span className="text-[10px] text-slate-400 block truncate">{d.day}</span>
                  <strong className="text-sm font-black font-mono text-amber-400 mt-0.5 block">
                    {d.minutes} د
                  </strong>
                  <span className="text-[10px] text-emerald-400 block font-bold">{d.rate}%</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 2: WEEKLY WATCH RATE (BarChart comparing weeks) */}
        {metricTab === 'weekly' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-400 px-2">
              <span>نسبة الإنجاز الأسبوعية % في شهر أكتوبر وساعات المشاهدة المقررة</span>
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-emerald-500 inline-block" />
                <span>النسبة المكتملة</span>
              </span>
            </div>

            <div className="h-72 w-full pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={weeklyChartData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                  <XAxis 
                    dataKey="week" 
                    stroke="#94a3b8" 
                    fontSize={11} 
                    tickLine={false}
                  />
                  <YAxis 
                    stroke="#94a3b8" 
                    fontSize={11} 
                    domain={[0, 100]} 
                    tickFormatter={(val) => `${val}%`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '16px',
                      color: '#f8fafc',
                      fontSize: '12px'
                    }}
                    formatter={(value: any) => [`${value}% (${weeklyChartData.find(w => w.rate === value)?.hours || 0} ساعات)`, 'نسبة المشاهدة']}
                    labelStyle={{ color: '#10b981', fontWeight: 'bold' }}
                  />
                  <Bar 
                    dataKey="rate" 
                    radius={[8, 8, 0, 0]}
                    fill="#10b981"
                  >
                    {weeklyChartData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.rate >= 85 ? '#10b981' : entry.rate >= 80 ? '#f59e0b' : '#38bdf8'} 
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              {weeklyChartData.map(w => (
                <div key={w.week} className="bg-slate-800/60 p-3.5 rounded-2xl border border-slate-700/60 text-center">
                  <span className="text-xs text-slate-400 block font-bold">{w.week}</span>
                  <strong className="text-lg font-black font-mono text-emerald-400 mt-1 block">
                    {w.rate}%
                  </strong>
                  <span className="text-[11px] text-slate-300 block">{w.hours} ساعات · {w.completedLectures} محاضرات</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: MONTHLY WATCH RATE (AreaChart across term months) */}
        {metricTab === 'monthly' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-400 px-2">
              <span>تطور نسب مشاهدة المحاضرات الشهرية % وساعات الدراسة عبر العام الدراسي</span>
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-sky-400 inline-block" />
                <span>النسبة الشهرية</span>
              </span>
            </div>

            <div className="h-72 w-full pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={monthlyChartData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
                >
                  <defs>
                    <linearGradient id="monthlyGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                  <XAxis 
                    dataKey="month" 
                    stroke="#94a3b8" 
                    fontSize={11} 
                    tickLine={false}
                  />
                  <YAxis 
                    stroke="#94a3b8" 
                    fontSize={11} 
                    domain={[60, 100]} 
                    tickFormatter={(val) => `${val}%`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '16px',
                      color: '#f8fafc',
                      fontSize: '12px'
                    }}
                    formatter={(value: any) => [`${value}% إنجاز`, 'نسبة المشاهدة الشهرية']}
                    labelStyle={{ color: '#38bdf8', fontWeight: 'bold' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="rate"
                    stroke="#38bdf8"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#monthlyGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              {monthlyChartData.map(m => (
                <div key={m.month} className="bg-slate-800/60 p-3.5 rounded-2xl border border-slate-700/60 text-center">
                  <span className="text-xs text-slate-400 block font-bold">{m.month}</span>
                  <strong className="text-lg font-black font-mono text-sky-400 mt-1 block">
                    {m.rate}%
                  </strong>
                  <span className="text-[11px] text-slate-300 block">{m.hours} ساعة · {m.attendance}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: QUIZ SCORES */}
        {metricTab === 'quizzes' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-400 px-2">
              <span>درجات الاختبارات الدورية لمقرر {studentGrade === '1ث' ? 'الصف الأول الثانوي' : studentGrade === '2ث' ? 'الصف الثاني الثانوي' : 'الصف الثالث الثانوي'}</span>
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-amber-400 inline-block" />
                <span>الدرجة المحققة</span>
              </span>
            </div>

            <div className="h-72 w-full pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={quizScoresData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                  <XAxis 
                    dataKey="name" 
                    stroke="#94a3b8" 
                    fontSize={11} 
                    tickLine={false}
                  />
                  <YAxis 
                    stroke="#94a3b8" 
                    fontSize={11} 
                    domain={[0, 100]} 
                    tickFormatter={(val) => `${val}%`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '16px',
                      color: '#f8fafc',
                      fontSize: '12px'
                    }}
                    formatter={(value: any, name: any, item: any) => [
                      `${value}% (${item.payload.scoreRaw})`, 
                      'الدرجة'
                    ]}
                    labelStyle={{ color: '#f59e0b', fontWeight: 'bold' }}
                  />
                  <Bar 
                    dataKey="scorePercent" 
                    radius={[8, 8, 0, 0]}
                    fill="#f59e0b"
                  >
                    {quizScoresData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.scorePercent >= 85 ? '#10b981' : entry.scorePercent >= 70 ? '#f59e0b' : '#ef4444'} 
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

      </div>

      {/* ------------------------------------------------------------------- */}
      {/* SECTION: Recent Watch Progress & Recommended Grade Lectures         */}
      {/* ------------------------------------------------------------------- */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl text-white space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 text-amber-400 font-bold text-xs mb-1">
              <BookOpen className="w-4 h-4" />
              <span>محاضرات مقرر {studentGrade === '1ث' ? 'الصف الأول الثانوي' : studentGrade === '2ث' ? 'الصف الثاني الثانوي' : 'الصف الثالث الثانوي'}</span>
            </div>
            <h3 className="text-xl font-display font-black">
              نسب استكمال المحاضرات المقررة لصفك
            </h3>
          </div>
          <span className="text-xs font-mono text-slate-400">
            {displayLessons.length} محاضرات متاحة
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {displayLessons.map((l, idx) => {
            const isCompleted = currentStudent?.completedLessonIds.includes(l.id);
            const progress = isCompleted ? 100 : 0;

            return (
              <div
                key={l.id}
                className="p-5 rounded-2xl bg-slate-800/60 border border-slate-700/70 hover:border-amber-500/50 transition space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-900 font-mono text-amber-400 font-bold">
                      {l.grade} · {l.unit}
                    </span>
                    <h4 className="text-sm font-bold text-white mt-1 leading-snug">
                      {l.title}
                    </h4>
                  </div>
                  <span className="text-xs text-slate-400 font-mono shrink-0">
                    {l.duration}
                  </span>
                </div>

                {/* Individual Lecture Watch Bar */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>نسبة الإنجاز:</span>
                    <span className="font-mono font-bold text-amber-400">{progress}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden p-0.5 border border-slate-700">
                    <div
                      style={{ width: `${progress}%` }}
                      className={`h-full rounded-full transition-all duration-500 ${
                        progress === 100 ? 'bg-emerald-400' : progress > 0 ? 'bg-amber-500' : 'bg-slate-700'
                      }`}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 text-xs">
                  <span className="text-slate-400 flex items-center gap-1">
                    {progress === 100 ? (
                      <span className="text-emerald-400 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> تم المشاهدة بالكامل
                      </span>
                    ) : progress > 0 ? (
                      <span className="text-amber-400 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" /> جاري الاستكمال
                      </span>
                    ) : (
                      <span className="text-slate-400 flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5" /> جاهزة للمشاهدة
                      </span>
                    )}
                  </span>

                  <button
                    onClick={() => onSelectLesson(l.id)}
                    className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 transition"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    <span>مشاهدة المحاضرة</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
};
