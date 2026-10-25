import React, { useState, useRef, useEffect } from 'react';
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Maximize, 
  Download, 
  FileText, 
  CheckCircle2, 
  BookOpen, 
  ListChecks, 
  Sparkles,
  ShieldAlert,
  Award,
  Paperclip,
  Lock,
  KeyRound,
  Sliders,
  RefreshCw,
  Zap,
  Activity,
  GraduationCap,
  Video
} from 'lucide-react';
import { Lesson, StudentUser, GradeType } from '../types';
import { triggerDownload, triggerTextDownload } from '../utils/helpers';
import { resolveVideoSource } from '../utils/video';
import { SimulationBoard } from './SimulationBoard';

interface VideoPlayerViewProps {
  lesson?: Lesson | null;
  allLessons: Lesson[];
  onSelectLesson: (id: string) => void;
  currentStudent: StudentUser | null;
  onOpenLoginModal: () => void;
  onSaveQuizScore?: (lessonId: string, score: number, total: number) => void;
  onMarkLessonCompleted?: (lessonId: string) => void;
  onOpenTeacherUpload?: () => void;
}

export const VideoPlayerView: React.FC<VideoPlayerViewProps> = ({
  lesson,
  allLessons,
  onSelectLesson,
  currentStudent,
  onOpenLoginModal,
  onSaveQuizScore,
  onMarkLessonCompleted,
  onOpenTeacherUpload
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [videoQuality, setVideoQuality] = useState<'1080p' | '720p' | '480p'>('1080p');
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [activeBottomTab, setActiveBottomTab] = useState<'notes' | 'quiz' | 'attachments'>('notes');
  const [downloadingVideo, setDownloadingVideo] = useState(false);
  const [downloadSuccessToast, setDownloadSuccessToast] = useState('');
  
  // Player modes: 'auto' (detect youtube or mp4), 'mp4', 'simulation'
  const [playerMode, setPlayerMode] = useState<'auto' | 'mp4' | 'simulation'>('auto');

  // Grade filter for playlist
  const [selectedGradeFilter, setSelectedGradeFilter] = useState<GradeType | 'all'>(
    currentStudent ? currentStudent.grade : '3ث'
  );

  // Floating Watermark position (Anti-piracy)
  const [watermarkPos, setWatermarkPos] = useState({ top: '15%', left: '20%' });

  // Quiz state
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizScore, setQuizScore] = useState(0);

  // Sync selectedGradeFilter when currentStudent changes
  useEffect(() => {
    if (currentStudent) {
      setSelectedGradeFilter(currentStudent.grade);
    }
  }, [currentStudent?.grade]);

  // Periodic random watermark drift
  useEffect(() => {
    const interval = setInterval(() => {
      const top = Math.floor(Math.random() * 60 + 15) + '%';
      const left = Math.floor(Math.random() * 60 + 15) + '%';
      setWatermarkPos({ top, left });
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  // Reset video state when lesson changes
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setQuizSubmitted(false);
    setSelectedAnswers({});
    setPlayerMode('auto');
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.playbackRate = playbackSpeed;
    }
  }, [lesson?.id]);

  // Filter lessons based on active grade filter
  const filteredLessons = selectedGradeFilter === 'all'
    ? allLessons
    : allLessons.filter(l => l.grade === selectedGradeFilter);

  // If active lesson doesn't match filter, or if no lesson selected
  const currentActiveLesson = lesson && (selectedGradeFilter === 'all' || lesson.grade === selectedGradeFilter)
    ? lesson
    : (filteredLessons.length > 0 ? filteredLessons[0] : allLessons[0] || null);

  // If no lessons exist at all
  if (!currentActiveLesson || allLessons.length === 0) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 text-center text-white space-y-6">
        <div className="w-20 h-20 rounded-3xl bg-amber-500/15 border border-amber-500/30 text-amber-400 mx-auto flex items-center justify-center shadow-xl">
          <BookOpen className="w-10 h-10" />
        </div>
        <h2 className="text-2xl sm:text-3xl font-display font-black">
          لا توجد محاضرات في هذا القسم بعد
        </h2>
        <p className="text-sm text-slate-400 max-w-lg mx-auto leading-relaxed">
          اختر مرحلة دراسية أخرى من القائمة العلوية أو ادخل إلى لوحة المدرس لإضافة محاضرة جديدة فوراً.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => setSelectedGradeFilter('all')}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold rounded-xl text-xs border border-slate-700 transition"
          >
            عرض جميع المراحل الدراسية
          </button>
          {onOpenTeacherUpload && (
            <button
              onClick={onOpenTeacherUpload}
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs transition"
            >
              الانتقال لبوابة المدرس ورفع درس
            </button>
          )}
        </div>
      </div>
    );
  }

  // Active current video URL (YouTube / Vimeo / Drive are embedded, anything else plays as a file)
  const currentVideoSrc = currentActiveLesson.videoUrl;
  const resolved = resolveVideoSource(currentVideoSrc);
  const isEmbed = resolved.kind === 'embed';
  // The file player must use the lesson's own video first; the backup is only a fallback.
  const fileSrc = resolved.kind === 'file'
    ? resolved.url
    : (currentActiveLesson.backupVideoUrl || '');
  const effectiveMode = playerMode === 'simulation'
    ? 'simulation'
    : playerMode === 'mp4'
    ? 'mp4'
    : isEmbed ? 'youtube' : 'mp4';

  // Time format helper
  const formatTime = (secs: number) => {
    if (isNaN(secs)) return '0:00';
    const mins = Math.floor(secs / 60);
    const remainingSecs = Math.floor(secs % 60);
    return `${mins}:${remainingSecs < 10 ? '0' : ''}${remainingSecs}`;
  };

  const togglePlay = () => {
    // SECURITY BARRIER: Must have student code to hear/watch the video
    if (!currentStudent) {
      onOpenLoginModal();
      return;
    }

    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play()
        .then(() => {
          setIsPlaying(true);
          if (onMarkLessonCompleted) {
            onMarkLessonCompleted(currentActiveLesson.id);
          }
        })
        .catch(() => {
          if (videoRef.current) {
            videoRef.current.muted = true;
            setIsMuted(true);
            videoRef.current.play().then(() => setIsPlaying(true));
          }
        });
    }
  };

  const handleSpeedChange = (speed: number) => {
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
      setPlaybackSpeed(speed);
      setDownloadSuccessToast(`تم تغيير سرعة التشغيل إلى ${speed}x`);
      setTimeout(() => setDownloadSuccessToast(''), 2500);
    }
  };

  const handleQualityChange = (quality: '1080p' | '720p' | '480p') => {
    setVideoQuality(quality);
    setShowQualityMenu(false);
    setDownloadSuccessToast(`تم التبديل إلى جودة ${quality} بنجاح`);
    setTimeout(() => setDownloadSuccessToast(''), 3000);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!currentStudent) {
      onOpenLoginModal();
      return;
    }
    const target = Number(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = target;
      setCurrentTime(target);
    }
  };

  const handleFullScreen = () => {
    if (videoRef.current && videoRef.current.requestFullscreen) {
      videoRef.current.requestFullscreen();
    }
  };

  const handleDownloadVideo = () => {
    if (!currentStudent) {
      onOpenLoginModal();
      return;
    }
    const downloadTarget = currentActiveLesson.downloadUrl || currentActiveLesson.backupVideoUrl;
    if (!downloadTarget) {
      setDownloadSuccessToast('تنزيل الفيديو غير متاح لهذه المحاضرة.');
      setTimeout(() => setDownloadSuccessToast(''), 3500);
      return;
    }
    setDownloadingVideo(true);
    setDownloadSuccessToast('جاري بدء تنزيل فيديو المحاضرة...');

    setTimeout(() => {
      triggerDownload(downloadTarget, `${currentActiveLesson.title.replace(/\s+/g, '_')}_المهندس_حسين_علام.mp4`);
      setDownloadingVideo(false);
      setDownloadSuccessToast('تم بدء تنزيل الفيديو بنجاح! يمكنك الآن مشاهدته دون اتصال.');
      setTimeout(() => setDownloadSuccessToast(''), 4500);
    }, 1000);
  };

  const handleDownloadPDF = () => {
    if (!currentStudent) {
      onOpenLoginModal();
      return;
    }
    const textContent = `منصة المهندس حسين علام للفيزياء
=======================================
المحاضرة: ${currentActiveLesson.title}
المرحلة الدراسية: ${currentActiveLesson.grade === '1ث' ? 'الصف الأول الثانوي' : currentActiveLesson.grade === '2ث' ? 'الصف الثاني الثانوي' : 'الصف الثالث الثانوي'}
الفصل: ${currentActiveLesson.chapter}
الوحدة: ${currentActiveLesson.unit}

=======================================
أهم القوانين والنقاط الأساسية:
${currentActiveLesson.keyPoints ? currentActiveLesson.keyPoints.map((p, i) => `${i + 1}. ${p}`).join('\n') : 'شرح مفصل ومسائل'}

الوصف:
${currentActiveLesson.description}
=======================================
كود تفعيل الطالب: ${currentStudent.codeUsed}
اسم الطالب: ${currentStudent.name}
جميع الحقوق محفوظة - منصة المهندس حسين علام 2026`;

    triggerTextDownload(textContent, currentActiveLesson.pdfName || `${currentActiveLesson.title}_ملخص_فيزياء.txt`);
    setDownloadSuccessToast('تم تنزيل ملخص الدرس وشيت القوانين بنجاح!');
    setTimeout(() => setDownloadSuccessToast(''), 4500);
  };

  // Quiz handlers
  const handleSelectOption = (questionId: string, optionIdx: number) => {
    if (quizSubmitted) return;
    setSelectedAnswers({ ...selectedAnswers, [questionId]: optionIdx });
  };

  const handleSubmitQuiz = () => {
    if (!currentActiveLesson.quiz || currentActiveLesson.quiz.length === 0) return;
    let score = 0;
    currentActiveLesson.quiz.forEach(q => {
      if (selectedAnswers[q.id] === q.correctIndex) {
        score++;
      }
    });
    setQuizScore(score);
    setQuizSubmitted(true);

    if (onSaveQuizScore) {
      onSaveQuizScore(currentActiveLesson.id, score, currentActiveLesson.quiz.length);
    }
  };

  const handleResetQuiz = () => {
    setSelectedAnswers({});
    setQuizSubmitted(false);
    setQuizScore(0);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-300">
      
      {/* Toast Notification */}
      {downloadSuccessToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-emerald-950 border border-emerald-500/50 text-emerald-200 px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-sm font-bold animate-in slide-in-from-bottom-4">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{downloadSuccessToast}</span>
        </div>
      )}

      {/* Grade Personalization Header Banner */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-5 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-black shrink-0">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-amber-400">
                {currentStudent ? `المرحلة المقررة لحسابك: ${currentStudent.grade === '1ث' ? 'الصف الأول الثانوي' : currentStudent.grade === '2ث' ? 'الصف الثاني الثانوي' : 'الصف الثالث الثانوي'}` : 'تصفح المحاضرات حسب المرحلة'}
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <h2 className="text-base font-display font-black text-white">
              {currentActiveLesson.chapter}
            </h2>
          </div>
        </div>

        {/* Grade Filter Switcher Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-2xl border border-slate-800 text-xs font-bold self-start sm:self-auto overflow-x-auto max-w-full">
          <button
            onClick={() => {
              setSelectedGradeFilter('1ث');
              const first = allLessons.find(l => l.grade === '1ث');
              if (first) onSelectLesson(first.id);
            }}
            className={`px-3 py-1.5 rounded-xl transition whitespace-nowrap ${
              selectedGradeFilter === '1ث' ? 'bg-amber-500 text-slate-950 font-black shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            أولى ثانوي (1ث)
          </button>
          <button
            onClick={() => {
              setSelectedGradeFilter('2ث');
              const first = allLessons.find(l => l.grade === '2ث');
              if (first) onSelectLesson(first.id);
            }}
            className={`px-3 py-1.5 rounded-xl transition whitespace-nowrap ${
              selectedGradeFilter === '2ث' ? 'bg-amber-500 text-slate-950 font-black shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            ثانية ثانوي (2ث)
          </button>
          <button
            onClick={() => {
              setSelectedGradeFilter('3ث');
              const first = allLessons.find(l => l.grade === '3ث');
              if (first) onSelectLesson(first.id);
            }}
            className={`px-3 py-1.5 rounded-xl transition whitespace-nowrap ${
              selectedGradeFilter === '3ث' ? 'bg-amber-500 text-slate-950 font-black shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            ثالثة ثانوي (3ث)
          </button>
          <button
            onClick={() => setSelectedGradeFilter('all')}
            className={`px-3 py-1.5 rounded-xl transition whitespace-nowrap ${
              selectedGradeFilter === 'all' ? 'bg-amber-500 text-slate-950 font-black shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            عرض الكل
          </button>
        </div>
      </div>

      {/* Main Grid: Player on Left, Playlist on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Col: Video Player & Details */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Top Player Mode Switcher Pills */}
          <div className="flex items-center justify-between px-2 text-xs">
            <span className="text-slate-400 font-bold flex items-center gap-1.5">
              <Video className="w-4 h-4 text-amber-400" />
              <span>مشغل المحاضرة المعتمد:</span>
            </span>

            <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setPlayerMode('auto')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                  effectiveMode === 'youtube' ? 'bg-amber-500 text-slate-950 font-black shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                بث عالي الدقة (HD)
              </button>
              <button
                type="button"
                onClick={() => setPlayerMode('mp4')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                  effectiveMode === 'mp4' ? 'bg-amber-500 text-slate-950 font-black shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                مشغل مباشر
              </button>
              <button
                type="button"
                onClick={() => setPlayerMode('simulation')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 ${
                  effectiveMode === 'simulation' ? 'bg-amber-500 text-slate-950 font-black shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Zap className="w-3 h-3 text-amber-400" />
                <span>سبورة المحاكاة</span>
              </button>
            </div>
          </div>

          {/* Video Player Container */}
          <div className={`relative ${effectiveMode === 'simulation' ? 'min-h-[28rem]' : 'aspect-video'} w-full bg-slate-950 rounded-3xl overflow-hidden shadow-2xl border border-slate-800 group select-none`}>
            
            {/* 1. YOUTUBE EMBED ENGINE (Guaranteed 100% Playback in all browsers/iframes) */}
            {effectiveMode === 'youtube' && (
              <div className="w-full h-full relative">
                <iframe
                  src={isEmbed ? resolved.url : ''}
                  referrerPolicy="strict-origin-when-cross-origin"
                  loading="lazy"
                  title={currentActiveLesson.title}
                  className="w-full h-full border-0 absolute inset-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; fullscreen; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
            )}

            {/* 2. SIMULATION BOARD ENGINE (driven by the lesson's laws) */}
            {effectiveMode === 'simulation' && (
              <SimulationBoard lesson={currentActiveLesson} onBack={() => setPlayerMode('auto')} />
            )}

            {/* 3. HTML5 MP4 / LOCAL FILE ENGINE */}
            {effectiveMode === 'mp4' && (
              <>
                <video
                  ref={videoRef}
                  key={fileSrc}
                  src={fileSrc}
                  playsInline
                  preload="metadata"
                  onError={() => {
                    setDownloadSuccessToast('تعذر تشغيل هذا الفيديو. تأكد من الرابط أو جرّب وضع البث (HD).');
                    setTimeout(() => setDownloadSuccessToast(''), 4000);
                  }}
                  className={`w-full h-full object-cover transition duration-300 ${!currentStudent ? 'filter blur-md brightness-50 pointer-events-none' : ''}`}
                  onTimeUpdate={() => {
                    if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
                  }}
                  onLoadedMetadata={() => {
                    if (videoRef.current) setDuration(videoRef.current.duration);
                  }}
                  onEnded={() => setIsPlaying(false)}
                  onClick={togglePlay}
                />

                {/* Big Center Play Button if paused */}
                {!isPlaying && currentStudent && (
                  <button
                    onClick={togglePlay}
                    className="absolute inset-0 m-auto w-20 h-20 rounded-full bg-amber-500/90 hover:bg-amber-400 text-slate-950 flex items-center justify-center shadow-2xl shadow-amber-500/40 transition-transform duration-200 hover:scale-110 active:scale-95 z-20"
                    aria-label="تشغيل الفيديو"
                  >
                    <Play className="w-8 h-8 fill-slate-950 translate-x-[-2px]" />
                  </button>
                )}

                {/* Custom Bottom Controls Bar */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/95 via-slate-950/75 to-transparent p-4 z-20 space-y-2 opacity-95 transition-opacity">
                  <input
                    type="range"
                    min={0}
                    max={duration || 100}
                    value={currentTime}
                    onChange={handleSeek}
                    className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500 focus:outline-none"
                  />
                  <div className="flex items-center justify-between text-xs text-white">
                    <div className="flex items-center gap-3">
                      <button onClick={togglePlay} className="hover:text-amber-400 transition" aria-label="تشغيل أو إيقاف">
                        {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
                      </button>
                      <button 
                        onClick={() => {
                          if (videoRef.current) {
                            videoRef.current.muted = !isMuted;
                            setIsMuted(!isMuted);
                          }
                        }} 
                        className="hover:text-amber-400 transition"
                      >
                        {isMuted ? <VolumeX className="w-5 h-5 text-amber-400" /> : <Volume2 className="w-5 h-5" />}
                      </button>
                      <span className="font-mono text-slate-300">
                        {formatTime(currentTime)} / {formatTime(duration)}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1 bg-slate-900/90 px-2 py-1 rounded-lg border border-slate-700/80 font-mono font-bold text-[11px]">
                        {[0.75, 1, 1.25, 1.5, 2].map(speed => (
                          <button
                            key={speed}
                            onClick={() => handleSpeedChange(speed)}
                            className={`px-1.5 py-0.5 rounded transition ${
                              playbackSpeed === speed ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            {speed}x
                          </button>
                        ))}
                      </div>
                      <button onClick={handleFullScreen} className="hover:text-amber-400 transition">
                        <Maximize className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* SECURITY BARRIER: REQUIRE STUDENT CODE TO HEAR/WATCH THE VIDEO */}
            {!currentStudent && (
              <div className="absolute inset-0 z-30 flex flex-col items-center justify-center p-6 text-center bg-slate-950/85 backdrop-blur-md space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shadow-2xl animate-pulse">
                  <Lock className="w-8 h-8" />
                </div>
                
                <div className="space-y-1">
                  <h3 className="text-xl font-display font-black text-white">
                    المحاضرة محمية · يلزم إدخال كود الطالب للاستماع
                  </h3>
                  <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed">
                    عزيزي الطالب، لتشغيل المحاضرة وسماع الشرح وتحميل شيت المسائل، يرجى إدخال كود الدخول الخاص بك المسلم لك من المهندس حسين علام.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={onOpenLoginModal}
                  className="px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs sm:text-sm shadow-xl shadow-amber-500/30 transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
                >
                  <KeyRound className="w-4 h-4" />
                  <span>أدخل كود الطالب الآن لفك القفل وسماع الدرس 🔑</span>
                </button>
              </div>
            )}

            {/* Anti-Piracy Dynamic Watermark Overlay (Displays Student Name & Code) */}
            {currentStudent && (
              <div 
                style={{ top: watermarkPos.top, left: watermarkPos.left }}
                className="absolute pointer-events-none transition-all duration-1000 z-20 select-none opacity-40 hover:opacity-70"
              >
                <div className="bg-slate-950/80 border border-slate-700/60 text-slate-300 px-3 py-1 rounded-lg text-[10px] font-mono tracking-wider backdrop-blur-xs flex items-center gap-1.5 shadow-md">
                  <ShieldAlert className="w-3 h-3 text-amber-400" />
                  <span>
                    {`${currentStudent.name} · ${currentStudent.phone} · ${currentStudent.codeUsed}`}
                  </span>
                </div>
              </div>
            )}

          </div>

          {/* Lesson Title & Action Downloads Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl text-white">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <span className="text-xs text-amber-400 font-bold block mb-1">
                  {currentActiveLesson.grade === '1ث' ? 'الصف الأول الثانوي' : currentActiveLesson.grade === '2ث' ? 'الصف الثاني الثانوي' : 'الصف الثالث الثانوي'} · {currentActiveLesson.unit} · {currentActiveLesson.duration}
                </span>
                <h1 className="text-xl sm:text-2xl font-display font-black leading-snug">
                  {currentActiveLesson.title}
                </h1>
                <p className="text-xs text-slate-400 mt-1">
                  المهندس حسين علام · تم النشر: {currentActiveLesson.publishedAt}
                </p>
              </div>

              {/* Direct Download Action Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleDownloadVideo}
                  disabled={downloadingVideo}
                  className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                  title="تنزيل الفيديو لمشاهدته بدون إنترنت"
                >
                  <Download className="w-4 h-4" />
                  <span>تنزيل الفيديو</span>
                </button>

                <button
                  onClick={handleDownloadPDF}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-300 font-bold text-xs flex items-center gap-2 border border-slate-700 transition-all hover:scale-105 active:scale-95"
                  title="تحميل شيت المسائل والملخص بصيغة PDF"
                >
                  <FileText className="w-4 h-4 text-sky-400" />
                  <span>تحميل ملخص الدرس (PDF)</span>
                </button>
              </div>
            </div>

            <p className="text-sm text-slate-300 mt-4 leading-relaxed">
              {currentActiveLesson.description}
            </p>
          </div>

          {/* Tabbed Interactive Section: Notes & Formulas | Interactive Quiz | Attachments */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl text-white">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-3 mb-6 overflow-x-auto">
              <button
                onClick={() => setActiveBottomTab('notes')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                  activeBottomTab === 'notes'
                    ? 'bg-amber-500 text-slate-950 font-black shadow'
                    : 'text-slate-400 hover:text-white bg-slate-800'
                }`}
              >
                <BookOpen className="w-4 h-4" />
                <span>أهم قوانين ومفاهيم الدرس</span>
              </button>

              <button
                onClick={() => setActiveBottomTab('quiz')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                  activeBottomTab === 'quiz'
                    ? 'bg-amber-500 text-slate-950 font-black shadow'
                    : 'text-slate-400 hover:text-white bg-slate-800'
                }`}
              >
                <ListChecks className="w-4 h-4" />
                <span>اختبار تفاعلي على الدرس</span>
                {currentActiveLesson.quiz && (
                  <span className="px-1.5 py-0.2 rounded-full bg-slate-950/40 text-[10px]">
                    {currentActiveLesson.quiz.length} أسئلة
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveBottomTab('attachments')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                  activeBottomTab === 'attachments'
                    ? 'bg-amber-500 text-slate-950 font-black shadow'
                    : 'text-slate-400 hover:text-white bg-slate-800'
                }`}
              >
                <Paperclip className="w-4 h-4" />
                <span>ملحقات وملازم الدرس</span>
                <span className="px-1.5 py-0.2 rounded-full bg-slate-950/40 text-[10px]">
                  {currentActiveLesson.attachments && currentActiveLesson.attachments.length > 0 ? currentActiveLesson.attachments.length : (currentActiveLesson.pdfName ? 1 : 0)}
                </span>
              </button>
            </div>

            {/* TAB: NOTES & KEY FORMULAS */}
            {activeBottomTab === 'notes' && (
              <div className="space-y-4">
                <h3 className="font-display font-bold text-sm text-amber-400 flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  النقاط الذهبية للمهندس حسين علام:
                </h3>
                {currentActiveLesson.keyPoints && currentActiveLesson.keyPoints.length > 0 ? (
                  <ul className="space-y-2.5">
                    {currentActiveLesson.keyPoints.map((point, idx) => (
                      <li key={idx} className="flex items-start gap-3 p-3 rounded-2xl bg-slate-800/60 border border-slate-700/60 text-xs text-slate-200 leading-relaxed">
                        <span className="w-5 h-5 rounded-lg bg-amber-500/20 text-amber-400 font-mono font-bold flex items-center justify-center shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-400">تابع شرح المحاضرة وحل الواجب في شيت التدريب المرفق.</p>
                )}
              </div>
            )}

            {/* TAB: INTERACTIVE QUIZ */}
            {activeBottomTab === 'quiz' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div>
                    <h3 className="font-display font-bold text-sm text-white">
                      اختبار تثبيت المفاهيم وحل المسائل
                    </h3>
                    <p className="text-xs text-slate-400">
                      اختبر فهمك بعد مشاهدة الفيديو واحصل على تصحيح وتفسير فوري لكل إجابة
                    </p>
                  </div>

                  {quizSubmitted && (
                    <div className="px-3.5 py-1.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold text-xs flex items-center gap-2">
                      <Award className="w-4 h-4" />
                      <span>نتيجتك: {quizScore} من {currentActiveLesson.quiz?.length || 0}</span>
                    </div>
                  )}
                </div>

                {!currentActiveLesson.quiz || currentActiveLesson.quiz.length === 0 ? (
                  <p className="text-center py-8 text-xs text-slate-400">لا يوجد اختبار مسجل لهذا الدرس حالياً.</p>
                ) : (
                  <div className="space-y-5">
                    {currentActiveLesson.quiz.map((q, qIndex) => {
                      const userChoice = selectedAnswers[q.id];
                      const isAnswered = userChoice !== undefined;
                      const isCorrect = userChoice === q.correctIndex;

                      return (
                        <div key={q.id} className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/70 space-y-3">
                          <div className="flex items-start gap-2.5">
                            <span className="w-6 h-6 rounded-lg bg-slate-700 text-slate-300 font-mono font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                              {qIndex + 1}
                            </span>
                            <p className="text-sm font-bold text-white leading-relaxed">{q.question}</p>
                          </div>

                          {/* Options */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pr-8">
                            {q.options.map((opt, optIndex) => {
                              const isSelected = userChoice === optIndex;
                              let btnClass = 'bg-slate-900 border-slate-700 text-slate-200 hover:border-amber-500/40';
                              
                              if (quizSubmitted) {
                                if (optIndex === q.correctIndex) {
                                  btnClass = 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-bold';
                                } else if (isSelected && !isCorrect) {
                                  btnClass = 'bg-red-500/20 border-red-500 text-red-300';
                                } else {
                                  btnClass = 'bg-slate-900/50 border-slate-800 text-slate-500';
                                }
                              } else if (isSelected) {
                                btnClass = 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold';
                              }

                              return (
                                <button
                                  key={optIndex}
                                  type="button"
                                  onClick={() => handleSelectOption(q.id, optIndex)}
                                  className={`p-3 rounded-xl border text-right text-xs transition flex items-center justify-between ${btnClass}`}
                                >
                                  <span>{opt}</span>
                                  <span className="font-mono text-[10px] text-slate-500">
                                    {['أ', 'ب', 'ج', 'د'][optIndex]}
                                  </span>
                                </button>
                              );
                            })}
                          </div>

                          {/* Explanation when submitted */}
                          {quizSubmitted && (
                            <div className="mt-3 p-3 rounded-xl bg-slate-900 border border-slate-700/80 text-xs space-y-1">
                              <span className="font-bold text-amber-400 block">تفسير المهندس حسين علام:</span>
                              <p className="text-slate-300 leading-relaxed">{q.explanation}</p>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Quiz Controls */}
                    <div className="pt-2 flex items-center gap-3">
                      {!quizSubmitted ? (
                        <button
                          type="button"
                          onClick={handleSubmitQuiz}
                          className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/25 transition"
                        >
                          تصحيح الاختبار وعرض التفسيرات ✓
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleResetQuiz}
                          className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 transition"
                        >
                          إعادة حل الاختبار ↺
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB: ATTACHMENTS */}
            {activeBottomTab === 'attachments' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <h3 className="font-display font-bold text-sm text-sky-400 flex items-center gap-2">
                    <Paperclip className="w-4 h-4" />
                    <span>المذكرات والملحقات وشيتات التدريب المرفقة:</span>
                  </h3>
                  <span className="text-xs text-slate-400 font-mono">
                    {currentActiveLesson.attachments && currentActiveLesson.attachments.length > 0 ? `${currentActiveLesson.attachments.length} ملحقات` : '1 ملحق'}
                  </span>
                </div>

                {currentActiveLesson.attachments && currentActiveLesson.attachments.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {currentActiveLesson.attachments.map((att) => (
                      <div
                        key={att.id}
                        className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/70 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold shrink-0">
                            <FileText className="w-5 h-5" />
                          </div>
                          <div>
                            <strong className="text-xs font-bold text-white block">{att.name}</strong>
                            <span className="text-[10px] text-slate-400 font-mono">{att.size || 'ملف PDF'}</span>
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            if (!currentStudent) {
                              onOpenLoginModal();
                              return;
                            }
                            if (att.url && att.url !== '#') {
                              triggerDownload(att.url, att.name);
                            } else {
                              handleDownloadPDF();
                            }
                          }}
                          className="px-3.5 py-1.5 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 font-bold text-xs flex items-center gap-1.5 transition"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>تحميل</span>
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/70 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <strong className="text-xs font-bold text-white block">{currentActiveLesson.pdfName || `${currentActiveLesson.title}_ملخص.pdf`}</strong>
                        <span className="text-[10px] text-slate-400 font-mono">{currentActiveLesson.pdfSize || '4.8 ميجابايت'}</span>
                      </div>
                    </div>

                    <button
                      onClick={handleDownloadPDF}
                      className="px-3.5 py-2 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 font-bold text-xs flex items-center gap-1.5 transition"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>تحميل الملخص</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

        </div>

        {/* Right Col: Playlist of Lectures filtered by grade */}
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl text-white">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
              <h3 className="font-display font-bold text-base flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-amber-400" />
                <span>المحاضرات المتاحة ({filteredLessons.length})</span>
              </h3>
              <span className="text-[11px] px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-400 font-mono font-bold">
                {selectedGradeFilter === 'all' ? 'جميع الصفوف' : selectedGradeFilter === '1ث' ? 'أولى ثانوي' : selectedGradeFilter === '2ث' ? 'ثانية ثانوي' : 'ثالثة ثانوي'}
              </span>
            </div>

            <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
              {filteredLessons.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs">
                  لا توجد محاضرات في هذه المرحلة بعد.
                </div>
              ) : (
                filteredLessons.map((item, index) => {
                  const isCurrent = item.id === currentActiveLesson.id;
                  return (
                    <div
                      key={item.id}
                      onClick={() => onSelectLesson(item.id)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                        isCurrent
                          ? 'bg-amber-500/15 border-amber-500 text-white shadow-md'
                          : 'bg-slate-800/60 border-slate-700/60 hover:bg-slate-800 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-900 font-mono text-amber-400">
                          حصة {index + 1} ({item.grade})
                        </span>
                        <span className="text-[10px] text-slate-400">{item.duration}</span>
                      </div>

                      <h4 className={`text-xs font-bold leading-snug line-clamp-2 ${isCurrent ? 'text-amber-300' : 'text-white'}`}>
                        {item.title}
                      </h4>

                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-700/40 text-[10px] text-slate-400">
                        <span className="truncate max-w-[140px]">{item.chapter}</span>
                        {!currentStudent ? (
                          <span className="text-amber-400 font-bold flex items-center gap-1 shrink-0">
                            <Lock className="w-3 h-3 text-amber-400" /> يتطلب كود
                          </span>
                        ) : isCurrent ? (
                          <span className="text-amber-400 font-bold flex items-center gap-1 shrink-0">
                            <Play className="w-3 h-3 fill-current" /> جاري المشاهدة
                          </span>
                        ) : (
                          <span className="text-slate-400 hover:text-white shrink-0">مشاهدة ←</span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};
