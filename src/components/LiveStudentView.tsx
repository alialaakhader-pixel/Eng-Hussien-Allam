import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, LogIn, PlayCircle, Radio, Video } from 'lucide-react';
import * as api from '../services/api';
import { StudentUser } from '../types';
import { formatCairo } from '../utils/progress';
import { LiveRoom } from './LiveRoom';

export const LiveStudentView: React.FC<{ currentStudent: StudentUser | null; onOpenLoginModal: () => void; onGoSubscriptions: () => void }> = ({ currentStudent, onOpenLoginModal, onGoSubscriptions }) => {
  const [items, setItems] = useState<api.LiveClass[] | null | undefined>(undefined);
  const [room, setRoom] = useState<api.LiveClass | null>(null);
  const code = currentStudent?.codeUsed || '';

  const load = useCallback(async () => { if (code) setItems(await api.liveList(code)); }, [code]);
  useEffect(() => { load(); const i = setInterval(load, 20000); return () => clearInterval(i); }, [load]);

  if (!currentStudent) {
    return (
      <div className="max-w-xl mx-auto text-center py-16 space-y-4" dir="rtl">
        <Radio className="w-10 h-10 mx-auto text-red-400" />
        <h2 className="text-2xl font-display font-black text-white">المحاضرات المباشرة</h2>
        <p className="text-slate-300 text-sm">سجّل الدخول عشان تشوف المحاضرات المباشرة وتحضرها.</p>
        <button onClick={onOpenLoginModal} className="px-6 py-2.5 rounded-xl bg-amber-500 text-slate-950 font-black inline-flex items-center gap-2"><LogIn className="w-4 h-4" /> تسجيل الدخول</button>
      </div>
    );
  }
  if (room) return <LiveRoom mode="student" classId={room.id} code={code} title={room.title} onExit={() => { setRoom(null); load(); }} />;

  const live = items?.filter(i => i.status === 'live') || [];
  const soon = items?.filter(i => i.status === 'scheduled').sort((a, b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt)) || [];
  const past = items?.filter(i => i.status === 'ended') || [];

  const Card = (c: api.LiveClass) => (
    <div key={c.id} className={`rounded-2xl border p-4 space-y-2 ${c.status === 'live' ? 'bg-red-500/10 border-red-500/40' : 'bg-slate-900 border-slate-800'}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-black text-white">{c.title}</div>
          <div className="text-xs text-slate-400 mt-0.5">المهندس حسين علام · {formatCairo(c.scheduledAt)}{c.paid ? ' · مدفوعة' : ' · مجانية'}</div>
        </div>
        <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold shrink-0 ${c.status === 'live' ? 'bg-red-600 text-white' : c.status === 'scheduled' ? 'bg-sky-500/20 text-sky-300' : 'bg-slate-700 text-slate-300'}`}>
          {c.status === 'live' ? '🔴 مباشرة الآن' : c.status === 'scheduled' ? 'قريباً' : 'انتهت'}
        </span>
      </div>
      {c.description && <p className="text-xs text-slate-300">{c.description}</p>}
      {c.status === 'live' && (c.locked
        ? <button onClick={onGoSubscriptions} className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-black text-sm">🔒 المحاضرة تحتاج اشتراك — اشترك الآن</button>
        : <button onClick={() => setRoom(c)} className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-sm inline-flex items-center gap-2"><PlayCircle className="w-4 h-4" /> انضم إلى المحاضرة الآن</button>)}
      {c.status === 'scheduled' && c.locked && <div className="text-xs text-amber-300">🔒 تحتاج اشتراك نشط لحضورها.</div>}
      {c.status === 'ended' && (
        <div className="text-xs text-slate-300 space-y-1">
          {c.myMinutes > 0 && <div>حضرت: <b className="text-white">{c.myMinutes} دقيقة</b></div>}
          {c.locked ? <div className="text-amber-300">🔒 التسجيل متاح للمشتركين فقط.</div>
            : c.recordingUrl ? <a href={c.recordingUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-black"><Video className="w-3.5 h-3.5" /> مشاهدة التسجيل</a>
              : <div className="text-slate-500">التسجيل غير متاح حالياً.</div>}
          {!c.locked && c.recordingNote && <p className="text-slate-400">{c.recordingNote}</p>}
        </div>
      )}
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto space-y-6 py-6" dir="rtl">
      <h2 className="text-2xl font-display font-black text-white flex items-center gap-2"><Radio className="w-6 h-6 text-red-400" /> المحاضرات المباشرة</h2>
      {items === undefined && <div className="text-slate-400 text-sm flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> جاري التحميل…</div>}
      {items === null && <div className="text-red-300 text-sm">تعذر تحميل المحاضرات. تأكد من تسجيل الدخول والإنترنت.</div>}
      {items && items.length === 0 && <div className="text-slate-400 text-sm bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center">لا توجد محاضرات مباشرة لصفك حالياً.</div>}
      {live.length > 0 && <div className="space-y-3">{live.map(Card)}</div>}
      {soon.length > 0 && <div className="space-y-3"><div className="text-sm font-black text-slate-300">القادمة</div>{soon.map(Card)}</div>}
      {past.length > 0 && <div className="space-y-3"><div className="text-sm font-black text-slate-300">السابقة</div>{past.map(Card)}</div>}
    </div>
  );
};
