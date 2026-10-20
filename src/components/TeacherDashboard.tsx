import React, { useState, useRef } from 'react';
import { 
  Upload, 
  KeyRound, 
  Users, 
  MessageSquare, 
  BookOpen, 
  Plus, 
  Copy, 
  Check, 
  Trash2, 
  Send, 
  Video, 
  FileText, 
  CheckCircle2, 
  Sparkles, 
  Clock, 
  LogOut,
  RefreshCw,
  Search,
  Award,
  Paperclip,
  Image as ImageIcon,
  Film,
  FileSpreadsheet,
  Download
} from 'lucide-react';
import { resolveVideoSource } from '../utils/video';
import { Lesson, StudentCode, StudentUser, ForumPost, GradeType, LessonAttachmentItem } from '../types';
import { generateRandomCode } from '../services/store';
import { uploadFile } from '../services/api';
import { exportToCsv } from '../utils/helpers';

interface TeacherDashboardProps {
  lessons: Lesson[];
  onAddLesson: (lesson: Lesson) => void;
  onDeleteLesson: (id: string) => void;
  codes: StudentCode[];
  onAddCode: (code: StudentCode) => void;
  onRevokeCode: (codeStr: string) => void;
  onDeleteCode: (codeStr: string) => void;
  students: StudentUser[];
  forumPosts: ForumPost[];
  onTeacherReply: (postId: string, replyContent: string) => void;
  onLogout: () => void;
  onSelectLessonForPreview: (lessonId: string) => void;
}

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({
  lessons,
  onAddLesson,
  onDeleteLesson,
  codes,
  onAddCode,
  onRevokeCode,
  onDeleteCode,
  students,
  forumPosts,
  onTeacherReply,
  onLogout,
  onSelectLessonForPreview
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'codes' | 'students' | 'forum' | 'lessons'>('upload');
  
  // ---- 1. Upload Lesson State (Fully custom inputs as requested) ----
  const [title, setTitle] = useState('');
  const [grade, setGrade] = useState<GradeType>('3ث');
  const [chapter, setChapter] = useState('');
  const [unit, setUnit] = useState('');
  const [duration, setDuration] = useState('45 دقيقة');
  const [description, setDescription] = useState('');
  
  // Video Source: Gallery File or Custom Link
  const [videoMode, setVideoMode] = useState<'gallery' | 'url'>('url');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoFileName, setVideoFileName] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const videoInputRef = useRef<HTMLInputElement>(null);

  // Multi-attachment state as requested
  const [attachments, setAttachments] = useState<LessonAttachmentItem[]>([]);
  const [newAttachmentName, setNewAttachmentName] = useState('');
  const attachmentInputRef = useRef<HTMLInputElement>(null);

  const [keyPointInput, setKeyPointInput] = useState('');
  const [keyPoints, setKeyPoints] = useState<string[]>([]);
  const [isPublishing, setIsPublishing] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');
  const [publishSuccess, setPublishSuccess] = useState(false);

  // ---- 2. Code Generator State ----
  const [codePrefix, setCodePrefix] = useState('PHYS');
  const [codeGrade, setCodeGrade] = useState<GradeType | 'جميع الصفوف'>('3ث');
  const [codeMaxUses, setCodeMaxUses] = useState(1);
  const [customCode, setCustomCode] = useState('');
  const [codeBatchCount, setCodeBatchCount] = useState(1);
  const [codeNote, setCodeNote] = useState('كود طالب جديد');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [codeSearch, setCodeSearch] = useState('');

  // ---- 3. Student Log Search State ----
  const [studentSearch, setStudentSearch] = useState('');

  // ---- 4. Forum Reply State ----
  const [replyTextMap, setReplyTextMap] = useState<Record<string, string>>({});

  // ------------------------------------
  // Handlers for Video & Attachments
  // ------------------------------------

  const handleVideoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setVideoFile(file);
    setVideoFileName(file.name);
    setVideoUrl('');
    setUploadMsg('جاري رفع الفيديو للسحابة... لا تغلق الصفحة');
    try {
      const url = await uploadFile(file, 'videos');
      setVideoUrl(url);
      setUploadMsg('تم رفع الفيديو بنجاح ✅ وجاهز للنشر للطلبة.');
    } catch (err: any) {
      setVideoFile(null);
      setVideoFileName('');
      setUploadMsg('');
      alert(err?.message || 'فشل رفع الفيديو');
    }
  };

  const handleAddAttachmentFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadMsg('جاري رفع الملحق...');
    try {
      const fileUrl = await uploadFile(file, 'attachments');
      const sizeStr = `${(file.size / (1024 * 1024)).toFixed(1)} ميجابايت`;
      const item: LessonAttachmentItem = {
        id: 'att-' + Date.now(),
        name: newAttachmentName.trim() || file.name,
        url: fileUrl,
        size: sizeStr,
        type: file.type.includes('pdf') ? 'pdf' : file.type.includes('image') ? 'image' : 'file'
      };
      setAttachments(prev => [...prev, item]);
      setNewAttachmentName('');
      setUploadMsg('تم رفع الملحق ✅');
    } catch (err: any) {
      setUploadMsg('');
      alert(err?.message || 'فشل رفع الملحق');
    }
    if (attachmentInputRef.current) attachmentInputRef.current.value = '';
  };

  const handleAddLinkAttachment = () => {
    if (!newAttachmentName.trim()) return;
    const item: LessonAttachmentItem = {
      id: 'att-' + Date.now(),
      name: newAttachmentName.trim(),
      url: '#',
      size: 'ملف خارجي',
      type: 'pdf'
    };
    setAttachments([...attachments, item]);
    setNewAttachmentName('');
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments(attachments.filter(a => a.id !== id));
  };

  const handleAddKeyPoint = () => {
    if (keyPointInput.trim()) {
      setKeyPoints([...keyPoints, keyPointInput.trim()]);
      setKeyPointInput('');
    }
  };

  const handleRemoveKeyPoint = (idx: number) => {
    setKeyPoints(keyPoints.filter((_, i) => i !== idx));
  };

  const handlePublishLesson = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('يرجى كتابة عنوان الدرس أولاً');
      return;
    }
    if (!chapter.trim()) {
      alert('يرجى كتابة الفصل أو الباب الخاص بالدرس');
      return;
    }

    const src = videoUrl.trim();
    const resolved = resolveVideoSource(src);
    if (resolved.kind === 'empty') {
      alert('يرجى إضافة رابط الفيديو (يوتيوب / Vimeo / Google Drive / mp4) أو اختيار ملف');
      return;
    }
    const isBlob = src.startsWith('blob:');
    if (isBlob) {
      alert('انتظر حتى يكتمل رفع الفيديو أو استخدم رابطاً.');
      return;
    }
    if (resolved.kind === 'file' && !isBlob && !/^(https?:\/\/|\/)/i.test(src)) {
      alert('رابط الفيديو غير صحيح. يجب أن يبدأ بـ https://');
      return;
    }

    setIsPublishing(true);

    setTimeout(() => {
      const newLesson: Lesson = {
        id: 'lesson-' + Date.now(),
        title: title.trim(),
        grade: grade,
        chapter: chapter.trim(),
        unit: unit.trim() || title.trim(),
        duration: duration.trim() || '45 دقيقة',
        description: description.trim() || `شرح ${title.trim()} مع المهندس حسين علام`,
        videoUrl: src,
        downloadUrl: resolved.kind === 'file' && !isBlob ? src : undefined,
        pdfUrl: attachments[0]?.url,
        pdfName: attachments[0]?.name,
        pdfSize: attachments[0]?.size,
        attachments: attachments,
        publishedAt: new Date().toISOString().split('T')[0],
        viewsCount: 0,
        keyPoints: keyPoints.length > 0 ? keyPoints : undefined
      };

      onAddLesson(newLesson);
      setIsPublishing(false);
      setPublishSuccess(true);

      // Reset form fields
      setTitle('');
      setChapter('');
      setUnit('');
      setDescription('');
      setVideoFile(null);
      setVideoFileName('');
      setVideoUrl('');
      setAttachments([]);
      setKeyPoints([]);

      setTimeout(() => {
        setPublishSuccess(false);
      }, 4000);
    }, 600);
  };

  const handleGenerateCodes = () => {
    const count = Math.min(Math.max(codeBatchCount, 1), 20);
    for (let i = 0; i < count; i++) {
      const generatedCodeStr = customCode.trim() 
        ? (count === 1 ? customCode.trim().toUpperCase() : `${customCode.trim().toUpperCase()}-${i+1}`)
        : generateRandomCode(codePrefix.toUpperCase(), codeGrade);

      const newCodeObj: StudentCode = {
        code: generatedCodeStr,
        grade: codeGrade,
        maxUses: codeMaxUses,
        timesUsed: 0,
        status: 'active',
        createdAt: new Date().toISOString().split('T')[0],
        note: codeNote.trim() || 'كود تم توليده من لوحة المدرس'
      };

      onAddCode(newCodeObj);
    }
    setCustomCode('');
  };

  const handleExportCodesCsv = () => {
    const headers = ['كود الوصول', 'الصف', 'الحالة', 'الحد الأقصى للاستخدام', 'مرات الاستخدام', 'الطالب المستفيد', 'رقم هاتف الطالب', 'تاريخ التوليد', 'ملاحظات'];
    const rows = codes.map(c => [
      c.code,
      c.grade,
      c.status === 'revoked' ? 'ملغي' : (c.timesUsed >= c.maxUses ? 'مستخدم بالكامل' : 'نشط ومتاح'),
      c.maxUses,
      c.timesUsed,
      c.usedBy && c.usedBy.length > 0 ? c.usedBy[0].studentName : 'غير مستخدم بعد',
      c.usedBy && c.usedBy.length > 0 ? c.usedBy[0].studentPhone : '-',
      c.createdAt,
      c.note || ''
    ]);
    exportToCsv(headers, rows, `أكواد_الطلاب_المهندس_حسين_علام_${new Date().toISOString().split('T')[0]}`);
  };

  const handleExportStudentsCsv = () => {
    if (students.length === 0) {
      alert('لا توجد بيانات طلاب مسجلين حالياً للتصدير.');
      return;
    }
    const headers = ['اسم الطالب', 'رقم الهاتف', 'الصف', 'الكود المستخدم', 'تاريخ التسجيل', 'آخر تواجد', 'الحالة', 'الدروس المكتملة'];
    const rows = students.map(s => [
      s.name,
      s.phone,
      s.grade,
      s.codeUsed,
      s.registeredAt,
      s.lastLoginAt,
      s.status === 'online' ? 'متصل الآن' : 'غير متصل',
      s.completedLessonIds.length
    ]);
    exportToCsv(headers, rows, `سجل_طلاب_المهندس_حسين_علام_${new Date().toISOString().split('T')[0]}`);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(text);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleSendTeacherReply = (postId: string) => {
    const text = replyTextMap[postId];
    if (text && text.trim()) {
      onTeacherReply(postId, text.trim());
      setReplyTextMap({ ...replyTextMap, [postId]: '' });
    }
  };

  // Filtered Codes
  const filteredCodes = codes.filter(c => 
    c.code.toLowerCase().includes(codeSearch.toLowerCase()) ||
    c.grade.toLowerCase().includes(codeSearch.toLowerCase()) ||
    (c.note && c.note.toLowerCase().includes(codeSearch.toLowerCase()))
  );

  // Filtered Students
  const filteredStudents = students.filter(s =>
    s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
    s.phone.includes(studentSearch) ||
    s.codeUsed.toLowerCase().includes(studentSearch.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-300">
      
      {/* Top Banner (No 2009 text) */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-slate-700/80 rounded-3xl p-6 sm:p-8 shadow-2xl mb-8 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 font-mono text-xs font-bold border border-amber-500/40">
                لوحة تحكم المدرس الخاصة
              </span>
              <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/40 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                مباشر مع الطلاب
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-display font-black text-white">
              لوحة تحكم وإدارة المهندس حسين علام
            </h1>
            <p className="text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
              ارفع الفيديوهات من المعرض أو بالروابط لتنزل فوراً للطلاب مع الملحقات، ولّد أكواد دخول الطلبة، وتابع سجل تسجيل دخولهم الفعلي أولاً بأول.
            </p>
          </div>

          <div className="flex items-center gap-3">
<button
              onClick={onLogout}
              className="px-4 py-2.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 hover:text-red-400 text-xs font-bold transition flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              <span>تسجيل خروج المدرس</span>
            </button>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-6 pt-6 border-t border-slate-700/60">
          <div className="bg-slate-800/80 p-3.5 rounded-2xl border border-slate-700/80">
            <span className="text-xs text-slate-400 font-medium block mb-1">الدروس المنشورة</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black font-mono text-amber-400">{lessons.length}</span>
              <span className="text-xs text-slate-400">محاضرة</span>
            </div>
          </div>

          <div className="bg-slate-800/80 p-3.5 rounded-2xl border border-slate-700/80">
            <span className="text-xs text-slate-400 font-medium block mb-1">أكواد الطلاب المولدة</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black font-mono text-sky-400">{codes.length}</span>
              <span className="text-xs text-slate-400">كود</span>
            </div>
          </div>

          <div className="bg-slate-800/80 p-3.5 rounded-2xl border border-slate-700/80">
            <span className="text-xs text-slate-400 font-medium block mb-1">الطلاب المسجلين بالدخول</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black font-mono text-emerald-400">{students.length}</span>
              <span className="text-xs text-slate-400">طالب مسجل</span>
            </div>
          </div>

          <div className="bg-slate-800/80 p-3.5 rounded-2xl border border-slate-700/80">
            <span className="text-xs text-slate-400 font-medium block mb-1">استفسارات المنتدى</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black font-mono text-purple-400">{forumPosts.length}</span>
              <span className="text-xs text-slate-400">سؤال فيزيائي</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-4 mb-8">
        <button
          onClick={() => setActiveTab('upload')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold transition-all ${
            activeTab === 'upload'
              ? 'bg-amber-500 text-slate-950 shadow-md font-black shadow-amber-500/20'
              : 'bg-slate-800/70 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700/60'
          }`}
        >
          <Upload className="w-4 h-4" />
          <span>رفع درس وفيديو فوري 🚀</span>
        </button>

        <button
          onClick={() => setActiveTab('codes')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold transition-all ${
            activeTab === 'codes'
              ? 'bg-amber-500 text-slate-950 shadow-md font-black shadow-amber-500/20'
              : 'bg-slate-800/70 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700/60'
          }`}
        >
          <KeyRound className="w-4 h-4" />
          <span>توليد وإدارة أكواد الطلبة 🔑</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-950/40">
            {codes.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('students')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold transition-all ${
            activeTab === 'students'
              ? 'bg-amber-500 text-slate-950 shadow-md font-black shadow-amber-500/20'
              : 'bg-slate-800/70 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700/60'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>سجل تسجيل ودخول الطلاب 📋</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-950/40">
            {students.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('forum')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold transition-all ${
            activeTab === 'forum'
              ? 'bg-amber-500 text-slate-950 shadow-md font-black shadow-amber-500/20'
              : 'bg-slate-800/70 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700/60'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>متابعة أسئلة المنتدى 💬</span>
        </button>

        <button
          onClick={() => setActiveTab('lessons')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold transition-all ${
            activeTab === 'lessons'
              ? 'bg-amber-500 text-slate-950 shadow-md font-black shadow-amber-500/20'
              : 'bg-slate-800/70 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700/60'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>الدروس المرفوعة ({lessons.length})</span>
        </button>
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* TAB 1: UPLOAD & PUBLISH LESSON (Custom fields + Gallery Video + Attachments) */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === 'upload' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Upload Form */}
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
            <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-display font-black text-white">إضافة ونشر درس جديد</h2>
                  <p className="text-xs text-slate-400">اكتب اسم الدرس والفصل وأضف الفيديو من المعرض والملحقات المطلوبة</p>
                </div>
              </div>
            </div>

            {publishSuccess && (
              <div className="mb-6 p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-sm flex items-center gap-3 animate-in fade-in">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <strong className="block font-bold">تم نشر الدرس بنجاح وبسرعة فائقة! 🎉</strong>
                  <span>أصبح الدرس وملحقاته متاحين الآن للطلاب مع إشعار فوري.</span>
                </div>
              </div>
            )}

            <form onSubmit={handlePublishLesson} className="space-y-5">
              
              {/* 1. Lesson Title Input */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  اسم الدرس / عنوان المحاضرة <span className="text-amber-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="اكتب اسم الدرس هنا (مثال: قانون أوم للدائرة المغلقة)"
                  className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition"
                />
              </div>

              {/* 2. Chapter / Section + Grade + Duration */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    الفصل / الباب <span className="text-amber-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={chapter}
                    onChange={e => setChapter(e.target.value)}
                    placeholder="اكتب اسم الفصل (مثال: الفصل الأول - الكهربية)"
                    className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    اسم الحصة / الموضوع الفرعي
                  </label>
                  <input
                    type="text"
                    value={unit}
                    onChange={e => setUnit(e.target.value)}
                    placeholder="مثال: الحصة 2 - توصيل المقاومات"
                    className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">الصف الدراسي</label>
                  <select
                    value={grade}
                    onChange={e => setGrade(e.target.value as GradeType)}
                    className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition"
                  >
                    <option value="3ث">تالتة ثانوي عام / أزهر</option>
                    <option value="2ث">تانية ثانوي عام / أزهر</option>
                    <option value="1ث">أولى ثانوي عام</option>
                    <option value="بكالوريا">بكالوريا وتوجيهي</option>
                  </select>
                </div>
              </div>

              {/* Duration + Description */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">مدة الفيديو</label>
                  <input
                    type="text"
                    value={duration}
                    onChange={e => setDuration(e.target.value)}
                    placeholder="مثال: 45 دقيقة"
                    className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    وصف الدرس والملاحظات للطلاب
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="أضف وصفاً مختصراً لأهم ما سيتعلمه الطالب..."
                    className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition"
                  />
                </div>
              </div>

              {/* 3. Video Upload: From Gallery or Link (As requested) */}
              <div className="p-5 rounded-2xl bg-slate-800/70 border border-slate-700/80 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-400 flex items-center gap-2">
                    <Video className="w-4 h-4" />
                    <span>فيديو المحاضرة</span>
                  </span>

                  {/* Mode switcher: Gallery vs Link */}
                  <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-700 text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setVideoMode('gallery')}
                      className={`px-3 py-1 rounded-lg transition flex items-center gap-1.5 ${
                        videoMode === 'gallery' ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Film className="w-3.5 h-3.5" />
                      <span>إضافة من المعرض / جهازك</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setVideoMode('url')}
                      className={`px-3 py-1 rounded-lg transition ${
                        videoMode === 'url' ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <span>رابط مباشر</span>
                    </button>
                  </div>
                </div>

                {videoMode === 'gallery' ? (
                  <div>
                    <label
                      htmlFor="video-gallery-file"
                      className="relative flex flex-col items-center justify-center p-6 border-2 border-dashed border-amber-500/40 hover:border-amber-500 rounded-2xl bg-slate-900/60 hover:bg-slate-900 cursor-pointer transition text-center group"
                    >
                      <input
                        ref={videoInputRef}
                        type="file"
                        accept="video/*"
                        onChange={handleVideoFileChange}
                        onClick={(e) => { (e.currentTarget as HTMLInputElement).value = ''; }}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        id="video-gallery-file"
                      />
                      <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-400 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                        <Upload className="w-6 h-6" />
                      </div>
                      <span className="text-sm font-bold text-white block">
                        اضغط هنا لاختيار فيديو المحاضرة من المعرض أو ملفات جهازك
                      </span>
                      <span className="text-xs text-slate-400 mt-1">
                        يدعم صيغ MP4, MOV, WebM, MKV
                      </span>
                    </label>

                    <p className="mt-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 text-[11px] leading-relaxed">
                      {uploadMsg || 'الفيديو بيترفع على السحابة ويظهر لكل الطلبة. الحد الأقصى 50 ميجابايت للملف؛ للفيديوهات الأكبر استخدم رابط يوتيوب (غير مدرج) أو Google Drive.'}
                    </p>

                    {videoFileName && (
                      <div className="mt-3 p-3 rounded-xl bg-slate-900 border border-emerald-500/40 text-emerald-300 text-xs flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span className="font-bold truncate max-w-xs">{videoFileName}</span>
                          {videoFile && (
                            <span className="text-slate-400 text-[11px]">
                              ({(videoFile.size / (1024 * 1024)).toFixed(1)} ميجابايت)
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setVideoFile(null);
                            setVideoFileName('');
                            setVideoUrl('');
                          }}
                          className="text-red-400 hover:text-red-300 text-xs underline"
                        >
                          إلغاء الملف
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <input
                      type="url"
                      dir="ltr"
                      value={videoUrl}
                      onChange={e => setVideoUrl(e.target.value)}
                      placeholder="https://... /video.mp4"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-amber-500 transition text-right"
                    />
                    <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                      الروابط المدعومة: يوتيوب (يُفضّل &quot;غير مدرج&quot; Unlisted) · Vimeo · Google Drive (مشاركة لأي شخص لديه الرابط) · ملف mp4 مباشر.
                    </p>
                  </div>
                )}
              </div>

              {/* 4. Attachments Section (As requested: "وحط ان اضيف ملحقات") */}
              <div className="p-5 rounded-2xl bg-slate-800/70 border border-slate-700/80 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-sky-400 flex items-center gap-2">
                    <Paperclip className="w-4 h-4" />
                    <span>ملحقات الدرس (شيتات، ملخصات، واجبات PDF أو صور)</span>
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {attachments.length} ملحقات مضافة
                  </span>
                </div>

                {/* Add Attachment input bar */}
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={newAttachmentName}
                    onChange={e => setNewAttachmentName(e.target.value)}
                    placeholder="اسم الملحق (مثال: شيت تدريبات قانون أوم PDF)"
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />

                  <div className="flex items-center gap-2">
                    <label
                      htmlFor="attachment-file-input"
                      className="relative overflow-hidden px-4 py-2 bg-slate-800 hover:bg-slate-700 text-sky-400 rounded-xl text-xs font-bold border border-slate-700 cursor-pointer flex items-center gap-1.5 transition"
                    >
                      <input
                        ref={attachmentInputRef}
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,image/*,application/pdf"
                        onChange={handleAddAttachmentFile}
                        onClick={(e) => { (e.currentTarget as HTMLInputElement).value = ''; }}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        id="attachment-file-input"
                      />
                      <Upload className="w-3.5 h-3.5" />
                      <span>اختيار ملف من جهازك</span>
                    </label>

                    <button
                      type="button"
                      onClick={handleAddLinkAttachment}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold border border-slate-700"
                    >
                      إضافة بالاسم
                    </button>
                  </div>
                </div>

                {/* List of Added Attachments */}
                {attachments.length > 0 && (
                  <div className="space-y-2 pt-2">
                    {attachments.map(att => (
                      <div
                        key={att.id}
                        className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-700/80 text-xs text-slate-200"
                      >
                        <div className="flex items-center gap-2.5">
                          <FileText className="w-4 h-4 text-sky-400 shrink-0" />
                          <span className="font-bold">{att.name}</span>
                          {att.size && (
                            <span className="text-[10px] text-slate-400 font-mono">({att.size})</span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveAttachment(att.id)}
                          className="text-slate-400 hover:text-red-400 transition p-1"
                          title="حذف الملحق"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 5. Key points & formulas */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  أهم النقاط والقوانين الأساسية في المحاضرة (اختياري)
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={keyPointInput}
                    onChange={e => setKeyPointInput(e.target.value)}
                    placeholder="أضف قانوناً أو فكرة أساسية..."
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddKeyPoint(); } }}
                    className="flex-1 bg-slate-800/90 border border-slate-700 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddKeyPoint}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded-xl text-xs font-bold border border-slate-700"
                  >
                    إضافة
                  </button>
                </div>
                <div className="space-y-1.5">
                  {keyPoints.map((kp, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-slate-800/40 px-3 py-1.5 rounded-lg text-xs text-slate-300">
                      <span>• {kp}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveKeyPoint(idx)}
                        className="text-slate-500 hover:text-red-400"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isPublishing}
                className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black py-3.5 rounded-2xl text-sm shadow-xl shadow-amber-500/25 transition-all flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
              >
                {isPublishing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>جاري معالجة ونشر الدرس بسرعة...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>نشر الدرس فوراً للطلاب وإرسال إشعار 🚀</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Quick Publish Tips & Security Status */}
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
              <h3 className="font-display font-bold text-white text-base mb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>مواصفات النشر السريع</span>
              </h3>
              <ul className="text-xs text-slate-300 space-y-3 leading-relaxed">
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                  <span><strong>فيديو المعرض:</strong> يمكنك اختيار أي فيديو مباشرة من هاتفك أو جهازك وسيعمل للمشاهدة والتنزيل فوراً.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                  <span><strong>الملحقات:</strong> أضف شيتات ومذكرات PDF مع الدرس لتكون متاحة للطلاب للتنزيل.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                  <span><strong>العلامة المائية الذكية:</strong> يتحرك اسم ورقم وكود الطالب المسجل فوق الفيديو لمنع تصوير الشاشة.</span>
                </li>
              </ul>
            </div>

            {/* Quick action to preview lessons */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-800 rounded-3xl p-6 shadow-xl">
              <h3 className="font-display font-bold text-white text-base mb-2">معاينة الدروس الحالية</h3>
              <p className="text-xs text-slate-400 mb-4">
                تصفح الدروس المنشورة كطالب وتحقق من المشغل والاختبارات التفاعلية:
              </p>
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {lessons.slice(0, 4).map(l => (
                  <div 
                    key={l.id}
                    onClick={() => onSelectLessonForPreview(l.id)}
                    className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 cursor-pointer transition text-xs flex items-center justify-between"
                  >
                    <span className="font-bold text-white truncate max-w-[200px]">{l.title}</span>
                    <span className="text-[10px] text-amber-400 font-mono">{l.grade}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* TAB 2: STUDENT CODE GENERATOR                                         */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === 'codes' && (
        <div className="space-y-8">
          
          {/* Generator Controls Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 mb-6 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center font-bold">
                  <KeyRound className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-display font-black text-white">
                    مُوَلّد أكواد الطلاب الرسمية
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    ولّد أكواد الدخول للطلبة لتسجيل دخولهم بالمنصة وحضور المحاضرات
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleGenerateCodes}
                  className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black rounded-xl text-xs shadow-lg shadow-amber-500/25 transition flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>توليد الأكواد الآن ({codeBatchCount})</span>
                </button>
              </div>
            </div>

            {/* Generator Settings Form */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">بادئة الكود (Prefix)</label>
                <input
                  type="text"
                  dir="ltr"
                  value={codePrefix}
                  onChange={e => setCodePrefix(e.target.value.toUpperCase())}
                  placeholder="PHYS أو ALLAM"
                  className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold text-amber-300 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">الصف المستهدف</label>
                <select
                  value={codeGrade}
                  onChange={e => setCodeGrade(e.target.value as GradeType | 'جميع الصفوف')}
                  className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="3ث">تالتة ثانوي (3ث)</option>
                  <option value="2ث">تانية ثانوي (2ث)</option>
                  <option value="1ث">أولى ثانوي (1ث)</option>
                  <option value="جميع الصفوف">جميع الصفوف</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">عدد مرات استخدام الكود</label>
                <select
                  value={codeMaxUses}
                  onChange={e => setCodeMaxUses(Number(e.target.value))}
                  className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                >
                  <option value={1}>طالب واحد فقط (استخدام فردي)</option>
                  <option value={5}>5 طلاب</option>
                  <option value={10}>10 طلاب</option>
                  <option value={50}>50 طالب (كود عام)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">عدد الأكواد المطلوبة</label>
                <select
                  value={codeBatchCount}
                  onChange={e => setCodeBatchCount(Number(e.target.value))}
                  className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                >
                  <option value={1}>كود واحد (1)</option>
                  <option value={5}>دفعة 5 أكواد</option>
                  <option value={10}>دفعة 10 أكواد</option>
                  <option value={20}>دفعة 20 كود</option>
                </select>
              </div>
            </div>

            {/* Custom Code Optional Input & Note */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-800">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  تحديد كود مخصص يدوياً (اختياري)
                </label>
                <input
                  type="text"
                  dir="ltr"
                  value={customCode}
                  onChange={e => setCustomCode(e.target.value.toUpperCase())}
                  placeholder="مثال: ALLAM-VIP-OCTOBER"
                  className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-amber-300 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  ملاحظة على الكود (المجموعة أو السنتر)
                </label>
                <input
                  type="text"
                  value={codeNote}
                  onChange={e => setCodeNote(e.target.value)}
                  placeholder="مثال: طلاب سنتر الأهرام - شهر أكتوبر"
                  className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
          </div>

          {/* Generated Codes List Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="font-display font-bold text-white text-lg">
                  قائمة الأكواد الصادرة ({filteredCodes.length})
                </h3>
                <p className="text-xs text-slate-400">انسخ الكود وشاركه مع الطالب عبر الواتساب أو الرسائل</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportCodesCsv}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
                  title="تصدير جميع الأكواد إلى ملف Excel أو CSV"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>تصدير الأكواد (CSV / Excel)</span>
                </button>

                {/* Search Bar */}
                <div className="relative w-full sm:w-60">
                  <Search className="absolute right-3 top-2.5 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    value={codeSearch}
                    onChange={e => setCodeSearch(e.target.value)}
                    placeholder="ابحث بكود أو صف أو ملاحظة..."
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl pr-9 pl-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-bold">
                    <th className="pb-3 px-3">الكود</th>
                    <th className="pb-3 px-3">الصف</th>
                    <th className="pb-3 px-3">الحالة</th>
                    <th className="pb-3 px-3">مرات الاستخدام</th>
                    <th className="pb-3 px-3">الطالب المستفيد</th>
                    <th className="pb-3 px-3">تاريخ التوليد</th>
                    <th className="pb-3 px-3 text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredCodes.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500">
                        لا توجد أكواد مطابقة لنتائج البحث
                      </td>
                    </tr>
                  ) : (
                    filteredCodes.map(codeItem => (
                      <tr key={codeItem.code} className="hover:bg-slate-800/40 transition">
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-amber-400 text-sm bg-slate-950 px-2.5 py-1 rounded-lg border border-amber-500/30">
                              {codeItem.code}
                            </span>
                            <button
                              onClick={() => copyToClipboard(codeItem.code)}
                              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
                              title="نسخ الكود"
                            >
                              {copiedCode === codeItem.code ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                          {codeItem.note && (
                            <span className="block text-[10px] text-slate-500 mt-0.5">{codeItem.note}</span>
                          )}
                        </td>

                        <td className="py-3 px-3 font-bold text-slate-300">
                          {codeItem.grade}
                        </td>

                        <td className="py-3 px-3">
                          {codeItem.status === 'revoked' ? (
                            <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 font-bold text-[10px]">
                              ملغي
                            </span>
                          ) : codeItem.timesUsed >= codeItem.maxUses ? (
                            <span className="px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 font-bold text-[10px]">
                              تم الاستخدام بالكامل
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold text-[10px]">
                              جاهز ومتاح
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-3 font-mono font-bold text-slate-300">
                          {codeItem.timesUsed} / {codeItem.maxUses}
                        </td>

                        <td className="py-3 px-3 text-slate-300">
                          {codeItem.usedBy && codeItem.usedBy.length > 0 ? (
                            <div>
                              <span className="font-bold text-white block">{codeItem.usedBy[0].studentName}</span>
                              <span className="font-mono text-[10px] text-slate-400" dir="ltr">{codeItem.usedBy[0].studentPhone}</span>
                            </div>
                          ) : (
                            <span className="text-slate-500">لم يُسجّل به أحد بعد</span>
                          )}
                        </td>

                        <td className="py-3 px-3 text-slate-400 font-mono">
                          {codeItem.createdAt}
                        </td>

                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {codeItem.status !== 'revoked' && (
                              <button
                                onClick={() => onRevokeCode(codeItem.code)}
                                className="px-2 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-[10px] font-bold border border-red-500/30 transition"
                              >
                                إيقاف
                              </button>
                            )}
                            <button
                              onClick={() => onDeleteCode(codeItem.code)}
                              className="p-1 rounded bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition"
                              title="حذف الكود"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* TAB 3: LIVE STUDENT REGISTRATION & LOGIN LOG (No fake students!)      */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === 'students' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-bold">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-display font-black text-white">
                  سجل تسجيل ودخول الطلاب الفعلي
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  يتسجل هنا تلقائياً كل طالب حقيقي يقوم بالدخول للمنصة بكوده مع الوقت ورقم هاتفه
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleExportStudentsCsv}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
                title="تصدير قائمة الطلاب المسجلين إلى ملف Excel أو CSV"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>تصدير سجل الطلاب (CSV / Excel)</span>
              </button>

              <div className="relative w-full sm:w-60">
                <Search className="absolute right-3 top-2.5 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  value={studentSearch}
                  onChange={e => setStudentSearch(e.target.value)}
                  placeholder="ابحث باسم الطالب أو الهاتف..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pr-9 pl-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-bold">
                  <th className="pb-3 px-3">اسم الطالب</th>
                  <th className="pb-3 px-3">رقم الهاتف</th>
                  <th className="pb-3 px-3">الصف</th>
                  <th className="pb-3 px-3">الكود المستخدم</th>
                  <th className="pb-3 px-3">تاريخ التسجيل</th>
                  <th className="pb-3 px-3">آخر تواجد</th>
                  <th className="pb-3 px-3">الحالة</th>
                  <th className="pb-3 px-3">الدروس المكتملة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      <div className="max-w-md mx-auto space-y-2">
                        <Users className="w-10 h-10 text-slate-600 mx-auto" />
                        <h4 className="font-bold text-white text-sm">لا يوجد طلاب مسجلون بعد</h4>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          السجل نظيف وخالٍ من أي بيانات وهمية. عندما يقوم الطالب بالدخول برقم هاتفه وكوده المسلم له، ستظهر بياناته وحضوره هنا فوراً.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map(student => (
                    <tr key={student.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs">
                            {student.name.charAt(0)}
                          </div>
                          <span className="font-bold text-white">{student.name}</span>
                        </div>
                      </td>

                      <td className="py-3 px-3 font-mono font-medium text-slate-300" dir="ltr">
                        {student.phone}
                      </td>

                      <td className="py-3 px-3 font-bold text-amber-400">
                        {student.grade}
                      </td>

                      <td className="py-3 px-3 font-mono font-bold text-sky-400">
                        {student.codeUsed}
                      </td>

                      <td className="py-3 px-3 text-slate-400 font-mono">
                        {student.registeredAt}
                      </td>

                      <td className="py-3 px-3 text-slate-300">
                        {student.lastLoginAt}
                      </td>

                      <td className="py-3 px-3">
                        {student.status === 'online' ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                            متصل الآن
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-[10px]">
                            غير متصل
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-3">
                        <span className="font-mono font-bold text-amber-400">
                          {student.completedLessonIds.length}
                        </span>
                        <span className="text-slate-500 text-[10px]"> دروس</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* TAB 4: TEACHER FORUM MODERATION & DIRECT REPLIES                      */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === 'forum' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/15 border border-purple-500/30 text-purple-400 flex items-center justify-center font-bold">
                <MessageSquare className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-display font-black text-white">
                  أسئلة واستفسارات الطلاب في المنتدى
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  رد على أسئلة الطلاب بختم المدرس المعتمد (المهندس حسين علام)
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {forumPosts.map(post => {
              const hasTeacherAnswer = post.answers.some(a => a.isTeacherVerified);
              return (
                <div key={post.id} className="p-5 rounded-2xl bg-slate-800/60 border border-slate-700/70 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-bold text-[10px]">
                          {post.category}
                        </span>
                        <span className="text-slate-400 text-xs">طالب: {post.authorName} ({post.grade})</span>
                        <span className="text-slate-500 text-[11px] font-mono">{post.createdAt}</span>
                      </div>
                      <h4 className="text-sm font-bold text-white">{post.title}</h4>
                      <p className="text-xs text-slate-300 mt-1 leading-relaxed">{post.content}</p>
                    </div>

                    {hasTeacherAnswer ? (
                      <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold shrink-0 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>تمت إجابتك</span>
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold shrink-0">
                        في انتظار ردك
                      </span>
                    )}
                  </div>

                  {/* Previous answers */}
                  {post.answers.length > 0 && (
                    <div className="space-y-2 mt-3 pt-3 border-t border-slate-700/50">
                      {post.answers.map(ans => (
                        <div 
                          key={ans.id}
                          className={`p-3 rounded-xl text-xs ${
                            ans.isTeacherVerified
                              ? 'bg-amber-500/10 border border-amber-500/30 text-slate-200'
                              : 'bg-slate-900/60 border border-slate-800 text-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold flex items-center gap-1.5 text-amber-400">
                              {ans.isTeacherVerified && <Award className="w-3.5 h-3.5" />}
                              {ans.authorName}
                            </span>
                            <span className="text-[10px] text-slate-500">{ans.createdAt}</span>
                          </div>
                          <p className="whitespace-pre-line leading-relaxed">{ans.content}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Quick Teacher Reply Box */}
                  <div className="pt-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={replyTextMap[post.id] || ''}
                        onChange={e => setReplyTextMap({ ...replyTextMap, [post.id]: e.target.value })}
                        placeholder="اكتب ردك كمهندس حسين علام واعتمده فوراً..."
                        className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                        onKeyDown={e => { if (e.key === 'Enter') handleSendTeacherReply(post.id); }}
                      />
                      <button
                        onClick={() => handleSendTeacherReply(post.id)}
                        className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 transition"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>رد معتمد</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* TAB 5: PUBLISHED LESSONS LIST                                         */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === 'lessons' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div>
              <h2 className="text-xl font-display font-black text-white">الدروس المنشورة للطلاب</h2>
              <p className="text-xs text-slate-400">يمكنك معاينة أي درس أو حذفه من المنصة</p>
            </div>
            <button
              onClick={() => setActiveTab('upload')}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة درس جديد</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {lessons.map(lesson => (
              <div 
                key={lesson.id} 
                className="p-5 rounded-2xl bg-slate-800/60 border border-slate-700/80 hover:border-amber-500/50 transition space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-bold text-[10px]">
                        {lesson.grade}
                      </span>
                      <span className="text-[11px] text-slate-400">{lesson.chapter}</span>
                    </div>
                    <h3 className="font-bold text-sm text-white leading-snug">{lesson.title}</h3>
                  </div>

                  <span className="text-xs font-mono text-slate-400 bg-slate-900 px-2 py-1 rounded-lg shrink-0">
                    {lesson.duration}
                  </span>
                </div>

                <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                  {lesson.description}
                </p>

                {lesson.attachments && lesson.attachments.length > 0 && (
                  <div className="flex items-center gap-2 text-[11px] text-sky-400">
                    <Paperclip className="w-3.5 h-3.5" />
                    <span>{lesson.attachments.length} ملحقات مرفقة</span>
                  </div>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-slate-700/50 text-xs">
                  <span className="text-slate-400">{lesson.publishedAt}</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onSelectLessonForPreview(lesson.id)}
                      className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold text-xs transition"
                    >
                      معاينة المشغل
                    </button>
                    <button
                      onClick={() => onDeleteLesson(lesson.id)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition"
                      title="حذف الدرس"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};
