import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Room, RoomEvent, Track, ConnectionState } from 'livekit-client';
import {
  AlertCircle, Ban, Camera, CameraOff, Check, Copy, Hand, HelpCircle, LayoutGrid, Loader2, LogOut, MessageSquare, Mic, MicOff, Monitor, MonitorOff, Pin, PenSquare,
  Radio, Send, Settings, Trash2, UserMinus, UserPlus, Users, Volume2, X, Maximize2
} from 'lucide-react';
import * as api from '../services/api';
import { LiveWhiteboard, BoardHandle } from './LiveWhiteboard';

type Layout = 'auto' | 'teacher' | 'side' | 'grid' | 'guest';
const LAYOUTS: { id: Layout; label: string }[] = [
  { id: 'auto', label: 'تلقائي' }, { id: 'teacher', label: 'المدرس فقط' }, { id: 'side', label: 'المدرس + الضيف' }, { id: 'grid', label: 'الكل متساوي' }, { id: 'guest', label: 'الضيف كبير' }
];

const roleOf = (p: any): string => {
  if (p.identity === 'teacher') return 'teacher';
  try { return JSON.parse(p.metadata || '{}').role || 'student'; } catch { return 'student'; }
};
const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

const Tile: React.FC<{ p: any; source?: any; big?: boolean; label?: string; tick: number }> = ({ p, source, big, label, tick }) => {
  const ref = useRef<HTMLVideoElement>(null);
  const src = source || Track.Source.Camera;
  const pub = p.getTrackPublication(src);
  const track = pub?.track;
  const off = !track || pub?.isMuted;
  useEffect(() => {
    const el = ref.current;
    if (!el || !track) return;
    track.attach(el);
    return () => { try { track.detach(el); } catch { /* ignore */ } };
  }, [track, tick]);
  const micPub = p.getTrackPublication(Track.Source.Microphone);
  return (
    <div className={`relative bg-slate-900 rounded-xl overflow-hidden border ${p.isSpeaking ? 'border-emerald-400' : 'border-slate-800'} ${big ? 'w-full h-full' : 'w-full aspect-video'}`}>
      <video ref={ref} autoPlay playsInline muted={p.isLocal} className={`w-full h-full ${src === Track.Source.ScreenShare ? 'object-contain' : 'object-cover'} ${off ? 'hidden' : ''}`} />
      {off && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-14 h-14 rounded-full bg-slate-700 flex items-center justify-center text-xl font-black text-white">{(p.name || '؟').trim().slice(0, 1)}</div>
        </div>
      )}
      <div className="absolute bottom-1 right-1 left-1 flex items-center justify-between gap-1 text-[11px]">
        <span className="px-2 py-0.5 rounded-md bg-black/60 text-white font-bold truncate">{label || p.name || p.identity}</span>
        {src !== Track.Source.ScreenShare && (!micPub || micPub.isMuted) && <MicOff className="w-4 h-4 text-red-400 bg-black/60 rounded p-0.5" />}
      </div>
    </div>
  );
};

interface Props {
  mode: 'teacher' | 'student' | 'invite';
  classId: string;
  code?: string;
  inviteToken?: string;
  guestName?: string;
  title: string;
  startedStatus?: string;
  onExit: () => void;
}

export const LiveRoom: React.FC<Props> = ({ mode, classId: classIdProp, code = '', inviteToken = '', guestName = '', title, startedStatus, onExit }) => {
  const [phase, setPhase] = useState<'connecting' | 'live' | 'error' | 'ended'>('connecting');
  const [err, setErr] = useState('');
  const [role, setRole] = useState<string>(mode === 'teacher' ? 'teacher' : 'student');
  const [tick, setTick] = useState(0);
  const [layout, setLayout] = useState<Layout>('auto');
  const [boardOn, setBoardOn] = useState(false);
  const [vol, setVol] = useState(1);
  const [connState, setConnState] = useState('');
  const [quality, setQuality] = useState('');
  const [secs, setSecs] = useState(0);
  const [panel, setPanel] = useState(true);
  const [tab, setTab] = useState<'chat' | 'people' | 'tools'>('chat');
  const [classStatus, setClassStatus] = useState(startedStatus || 'live');
  const [allowGuestScreen, setAllowGuestScreen] = useState(false);
  const [needPublish, setNeedPublish] = useState(false);
  const [devices, setDevices] = useState<{ cams: MediaDeviceInfo[]; mics: MediaDeviceInfo[] }>({ cams: [], mics: [] });
  const [showDev, setShowDev] = useState(false);

  const room = useRef<any>(null);
  const board = useRef<BoardHandle>(null);
  const audioHost = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const classId = useRef(classIdProp);
  const roleRef = useRef(role);
  const layoutRef = useRef<Layout>('auto');
  const boardRef = useRef(false);
  const alive = useRef(true);
  const bump = useCallback(() => setTick(t => t + 1), []);
  roleRef.current = role; layoutRef.current = layout; boardRef.current = boardOn;

  const sendData = useCallback((msg: any, dest?: string[]) => {
    const r = room.current;
    if (!r || roleRef.current !== 'teacher') return;
    try { r.localParticipant.publishData(new TextEncoder().encode(JSON.stringify(msg)), { reliable: true, destinationIdentities: dest }); } catch { /* ignore */ }
  }, []);
  const sendInit = useCallback((dest?: string[]) => {
    sendData({ t: 'init', layout: layoutRef.current, board: boardRef.current }, dest);
    board.current?.chunks().forEach(c => sendData(c, dest));
  }, [sendData]);

  const connect = useCallback(async () => {
    setPhase('connecting'); setErr('');
    if (room.current) { try { room.current.disconnect(); } catch { /* ignore */ } room.current = null; }
    audioHost.current && (audioHost.current.innerHTML = '');
    if (mode === 'student') api.setLiveCode(code);
    const t = await api.liveToken(mode === 'invite' ? { mode, token: inviteToken, name: guestName } : { mode, classId: classId.current });
    if (!alive.current) return;
    if (!t.ok || !t.token || !t.url) {
      setErr(api.LIVE_ERRORS[t.error || ''] || (t.error === 'NETWORK' ? 'تعذر الاتصال بالإنترنت.' : 'تعذر الدخول إلى البث.'));
      setPhase('error');
      return;
    }
    if (t.classId) classId.current = t.classId;
    setRole(t.role || 'student');
    roleRef.current = t.role || 'student';
    const r: any = new Room({ adaptiveStream: true, dynacast: true, videoCaptureDefaults: { resolution: { width: 1280, height: 720, frameRate: 24 } } });
    room.current = r;
    r.on(RoomEvent.TrackSubscribed, (track: any) => {
      if (track.kind === 'audio' && audioHost.current) { const el = track.attach(); el.volume = vol; audioHost.current.appendChild(el); }
      bump();
    });
    r.on(RoomEvent.TrackUnsubscribed, (track: any) => { try { track.detach().forEach((e: HTMLElement) => e.remove()); } catch { /* ignore */ } bump(); });
    [RoomEvent.ParticipantConnected, RoomEvent.ParticipantDisconnected, RoomEvent.TrackMuted, RoomEvent.TrackUnmuted, RoomEvent.LocalTrackPublished, RoomEvent.LocalTrackUnpublished, RoomEvent.TrackPublished, RoomEvent.TrackUnpublished, RoomEvent.ActiveSpeakersChanged]
      .forEach(ev => r.on(ev, bump));
    r.on(RoomEvent.ParticipantConnected, (p: any) => { if (roleRef.current === 'teacher') setTimeout(() => sendInit([p.identity]), 800); });
    r.on(RoomEvent.ConnectionQualityChanged, (q: string, p: any) => { if (p?.isLocal) setQuality(q); });
    r.on(RoomEvent.ConnectionStateChanged, (s: string) => setConnState(s));
    r.on(RoomEvent.Disconnected, () => { if (alive.current && phaseRef.current === 'live') { setErr('انقطع الاتصال بالبث.'); setPhase('error'); } });
    r.on(RoomEvent.DataReceived, (payload: Uint8Array, p: any) => {
      if (!p || p.identity !== 'teacher') return;
      let m: any;
      try { m = JSON.parse(new TextDecoder().decode(payload)); } catch { return; }
      if (m.t === 'layout') setLayout(m.v);
      else if (m.t === 'board') setBoardOn(!!m.on);
      else if (m.t === 'init') { setLayout(m.layout || 'auto'); setBoardOn(!!m.board); }
      else board.current?.apply(m);
    });
    try {
      await r.connect(t.url, t.token);
      try { await r.startAudio(); } catch { /* needs gesture */ }
      if (!alive.current) { r.disconnect(); return; }
      setPhase('live');
      bump();
      if (t.role === 'guest') setNeedPublish(true);
      if (t.role === 'teacher') {
        sendInit();
        try { setDevices({ cams: await Room.getLocalDevices('videoinput'), mics: await Room.getLocalDevices('audioinput') }); } catch { /* ignore */ }
      }
    } catch {
      setErr('تعذر الاتصال بخادم البث. تأكد من الإنترنت وحاول مرة أخرى.');
      setPhase('error');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, code, inviteToken, guestName]);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  useEffect(() => {
    alive.current = true;
    connect();
    const onUnload = () => { if (mode === 'student') api.liveLeave(code, classId.current); if (mode === 'invite') api.liveInviteLeave(inviteToken); };
    window.addEventListener('pagehide', onUnload);
    return () => {
      alive.current = false;
      window.removeEventListener('pagehide', onUnload);
      onUnload();
      try { room.current?.disconnect(); } catch { /* ignore */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase !== 'live') return;
    const i = setInterval(() => setSecs(s => s + 1), 1000);
    return () => clearInterval(i);
  }, [phase]);

  useEffect(() => { audioHost.current?.querySelectorAll('audio').forEach((a: any) => { a.volume = vol; }); }, [vol, tick]);

  // ---------- guest by invite: heartbeat ----------
  useEffect(() => {
    if (mode !== 'invite' || phase !== 'live') return;
    const i = setInterval(async () => {
      const r = await api.liveInvitePing(inviteToken, false);
      if (r.ok === false && r.status && r.status !== 'live') { setPhase('ended'); try { room.current?.disconnect(); } catch { /* ignore */ } }
      else if (r.ok === false && !r.status) { setErr('تم إلغاء دعوتك من المدرس.'); setPhase('ended'); try { room.current?.disconnect(); } catch { /* ignore */ } }
    }, 15000);
    return () => clearInterval(i);
  }, [mode, phase, inviteToken]);

  // ---------- publishing controls ----------
  const lp = () => room.current?.localParticipant;
  const camOn = !!lp()?.isCameraEnabled;
  const micOn = !!lp()?.isMicrophoneEnabled;
  const screenOn = !!lp()?.isScreenShareEnabled;
  const toggle = async (what: 'cam' | 'mic' | 'screen') => {
    const p = lp();
    if (!p) return;
    try {
      if (what === 'cam') await p.setCameraEnabled(!p.isCameraEnabled);
      else if (what === 'mic') await p.setMicrophoneEnabled(!p.isMicrophoneEnabled);
      else await p.setScreenShareEnabled(!p.isScreenShareEnabled, { audio: true });
    } catch { setErr(what === 'screen' ? 'تعذر مشاركة الشاشة (قد لا يدعمها جهازك أو تم الرفض).' : 'تعذر تشغيل الكاميرا/الميكروفون. اسمح بالصلاحية من المتصفح.'); setTimeout(() => setErr(''), 5000); }
    bump();
  };
  const startPublishing = async () => {
    setNeedPublish(false);
    const p = lp();
    try { await p.setMicrophoneEnabled(true); await p.setCameraEnabled(true); } catch { setErr('تعذر فتح الكاميرا/الميكروفون. اسمح بالصلاحية من المتصفح.'); setTimeout(() => setErr(''), 5000); }
    bump();
  };

  // ---------- layout / board (teacher) ----------
  const pickLayout = (l: Layout) => { setLayout(l); sendData({ t: 'layout', v: l }); };
  const toggleBoard = () => { const v = !boardOn; setBoardOn(v); sendData({ t: 'board', on: v }); };

  // ---------- derived participants ----------
  const parts: any[] = useMemo(() => {
    const r = room.current;
    if (!r) return [];
    return [r.localParticipant, ...Array.from(r.remoteParticipants.values())];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, phase]);
  const teacherP = parts.find(p => p.identity === 'teacher');
  const guests = parts.filter(p => p.identity !== 'teacher' && roleOf(p) === 'guest');
  const screenP = parts.find(p => p.getTrackPublication(Track.Source.ScreenShare)?.track);
  const camTiles = [...(teacherP ? [teacherP] : []), ...guests];
  const eff: Layout = layout === 'auto' ? (guests.length ? 'side' : 'teacher') : layout;

  const stage = (() => {
    if (boardOn) return { main: null as React.ReactNode, strip: camTiles };
    if (screenP) return { main: <Tile p={screenP} source={Track.Source.ScreenShare} big tick={tick} label={`شاشة ${screenP.name || ''}`} />, strip: camTiles };
    if (eff === 'teacher') return { main: teacherP ? <Tile p={teacherP} big tick={tick} /> : <Waiting />, strip: [] as any[] };
    if (eff === 'guest' && guests.length) return { main: <Tile p={guests[0]} big tick={tick} />, strip: [teacherP, ...guests.slice(1)].filter(Boolean) };
    const cols = camTiles.length <= 1 ? 1 : camTiles.length <= 4 ? 2 : 3;
    return {
      main: (
        <div className="grid gap-2 w-full h-full content-center p-1" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {camTiles.length ? camTiles.map(p => <Tile key={p.identity} p={p} tick={tick} />) : <Waiting />}
        </div>
      ),
      strip: [] as any[]
    };
  })();
  // the board stays mounted (hidden when closed) so strokes are never lost
  const boardEl = (
    <div className={boardOn ? 'absolute inset-0 z-[1] bg-slate-950' : 'hidden'}>
      <LiveWhiteboard ref={board} canDraw={role === 'teacher'} send={role === 'teacher' ? sendData : undefined} />
    </div>
  );

  const goFull = () => { const el: any = box.current; if (!el) return; if (document.fullscreenElement) document.exitFullscreen(); else el.requestFullscreen?.(); };
  const leave = () => { try { room.current?.disconnect(); } catch { /* ignore */ } onExit(); };

  // ---------- sidebar (chat etc.) ----------
  const side = mode === 'teacher'
    ? <TeacherSide classId={classId.current} tab={tab} setTab={setTab} layout={layout} pickLayout={pickLayout} boardOn={boardOn} toggleBoard={toggleBoard} parts={parts} setAllowGuestScreen={setAllowGuestScreen} allowGuestScreen={allowGuestScreen} onStatus={setClassStatus} />
    : mode === 'student'
      ? <StudentSide code={code} classId={classId.current} role={role} reconnect={connect} onEnded={() => { setPhase('ended'); try { room.current?.disconnect(); } catch { /* ignore */ } }} onBanned={() => { setErr('تم منعك من هذه المحاضرة.'); setPhase('error'); try { room.current?.disconnect(); } catch { /* ignore */ } }} onGuestScreen={setAllowGuestScreen} />
      : <div className="p-4 text-sm text-slate-300 space-y-2"><div className="font-black text-white">أنت ضيف في المحاضرة</div><p>تظهر بالصوت والصورة بعد ما تفتح الكاميرا والميكروفون. المدرس يتحكم في ظهورك.</p></div>;

  const canShare = role === 'teacher' || (role === 'guest' && allowGuestScreen);
  const publisher = role === 'teacher' || role === 'guest';

  if (phase === 'connecting') return <Shell><div className="m-auto text-center space-y-3 text-slate-200"><Loader2 className="w-8 h-8 animate-spin mx-auto text-amber-400" /><div className="font-bold">جاري الدخول إلى المحاضرة…</div></div></Shell>;
  if (phase === 'ended') return (
    <Shell><div className="m-auto text-center space-y-4 text-slate-100 p-6">
      <Radio className="w-10 h-10 mx-auto text-slate-400" /><div className="text-xl font-black">{err || 'انتهت المحاضرة'}</div>
      <p className="text-sm text-slate-400">لو المدرس سجّل المحاضرة هتلاقيها في قسم المحاضرات المباشرة بعد النشر.</p>
      <button onClick={onExit} className="px-6 py-2.5 rounded-xl bg-amber-500 text-slate-950 font-black">رجوع</button></div></Shell>
  );
  if (phase === 'error') return (
    <Shell><div className="m-auto text-center space-y-4 text-slate-100 p-6 max-w-sm">
      <AlertCircle className="w-10 h-10 mx-auto text-red-400" /><div className="font-bold">{err}</div>
      <div className="flex gap-2 justify-center">
        {!/منع|لا يتم|غير مسموح|اشتراك|غير صالح|لم تبدأ|لم يتم إعدادها/.test(err) && <button onClick={connect} className="px-5 py-2.5 rounded-xl bg-amber-500 text-slate-950 font-black">إعادة الاتصال</button>}
        <button onClick={onExit} className="px-5 py-2.5 rounded-xl bg-slate-800 text-white font-bold">رجوع</button>
      </div></div></Shell>
  );

  return (
    <Shell>
      <div ref={box} className="flex flex-col h-full bg-slate-950">
        <div className="flex items-center gap-2 px-3 py-2 bg-slate-900 border-b border-slate-800 text-sm">
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-600 text-white text-xs font-black"><Radio className="w-3 h-3" /> {classStatus === 'live' ? 'مباشر' : 'معاينة'}</span>
          <span className="font-black text-white truncate">{title}</span>
          <span className="text-slate-400 text-xs tabular-nums">{mmss(secs)}</span>
          <span className="flex-1" />
          {connState && connState !== ConnectionState.Connected && <span className="text-xs text-amber-300 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> {connState === ConnectionState.Reconnecting ? 'إعادة الاتصال…' : connState}</span>}
          {quality && <span className={`text-[11px] px-1.5 py-0.5 rounded ${quality === 'excellent' || quality === 'good' ? 'bg-emerald-500/20 text-emerald-300' : quality === 'poor' ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-700 text-slate-300'}`}>جودة: {({ excellent: 'ممتازة', good: 'جيدة', poor: 'ضعيفة', lost: 'منقطعة' } as any)[quality] || quality}</span>}
          <span className="flex items-center gap-1 text-slate-300 text-xs"><Users className="w-3.5 h-3.5" />{parts.length}</span>
          <button onClick={() => setPanel(p => !p)} className="p-1.5 rounded-lg bg-slate-800 text-slate-200 lg:hidden" aria-label="الشات"><MessageSquare className="w-4 h-4" /></button>
          <button onClick={goFull} className="p-1.5 rounded-lg bg-slate-800 text-slate-200" aria-label="ملء الشاشة"><Maximize2 className="w-4 h-4" /></button>
        </div>

        {err && <div className="px-3 py-1.5 text-xs bg-red-500/15 text-red-200 flex items-center gap-1.5"><AlertCircle className="w-4 h-4" /> {err}</div>}
        {role === 'guest' && <div className="px-3 py-1.5 text-xs bg-amber-500/15 text-amber-200">صوتك وصورتك ظاهرين لكل الطلاب، وقد يظهران في تسجيل المحاضرة.</div>}

        <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
          <div className="flex-1 min-h-0 min-w-0 flex flex-col p-2 gap-2">
            <div className="flex-1 min-h-0 relative">{stage.main}{boardEl}</div>
            {stage.strip.length > 0 && (
              <div className="flex gap-2 overflow-x-auto shrink-0">
                {stage.strip.map((p: any) => <div key={p.identity} className="w-32 sm:w-40 shrink-0"><Tile p={p} tick={tick} /></div>)}
              </div>
            )}
          </div>
          <div className={`${panel ? 'flex' : 'hidden'} lg:flex flex-col w-full lg:w-[22rem] h-[45%] lg:h-auto shrink-0 border-t lg:border-t-0 lg:border-r border-slate-800 bg-slate-900`}>{side}</div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 px-3 py-2.5 bg-slate-900 border-t border-slate-800">
          {publisher && (<>
            <Ctl on={micOn} onClick={() => toggle('mic')} icOn={<Mic className="w-5 h-5" />} icOff={<MicOff className="w-5 h-5" />} label="الميكروفون" />
            <Ctl on={camOn} onClick={() => toggle('cam')} icOn={<Camera className="w-5 h-5" />} icOff={<CameraOff className="w-5 h-5" />} label="الكاميرا" />
          </>)}
          {canShare && <Ctl on={screenOn} onClick={() => toggle('screen')} icOn={<Monitor className="w-5 h-5" />} icOff={<MonitorOff className="w-5 h-5" />} label={screenOn ? 'إيقاف المشاركة' : 'مشاركة الشاشة'} />}
          {role === 'teacher' && <button onClick={() => setShowDev(s => !s)} className="p-3 rounded-full bg-slate-800 text-slate-200" aria-label="الأجهزة"><Settings className="w-5 h-5" /></button>}
          {role === 'teacher' && classStatus !== 'live' && (<span className="text-xs text-amber-300">الطلاب لا يستطيعون الدخول قبل ضغط «ابدأ البث»</span>)}
          {role === 'teacher' && classStatus !== 'live' && (
            <button onClick={async () => { try { await api.teacherLiveStatus(classId.current, 'live'); setClassStatus('live'); } catch (e: any) { setErr(e.message); } }} className="px-5 py-3 rounded-full bg-red-600 hover:bg-red-500 text-white font-black text-sm">ابدأ البث للطلاب 🔴</button>
          )}
          {role === 'teacher' && classStatus === 'live' && (
            <button onClick={async () => { if (!confirm('إنهاء المحاضرة لكل الطلاب؟')) return; try { await api.teacherLiveStatus(classId.current, 'ended'); } catch { /* ignore */ } leave(); }} className="px-5 py-3 rounded-full bg-red-600 hover:bg-red-500 text-white font-black text-sm">إنهاء المحاضرة</button>
          )}
          {role !== 'teacher' && (
            <label className="flex items-center gap-1.5 text-slate-300 text-xs"><Volume2 className="w-4 h-4" /><input type="range" min={0} max={1} step={0.05} value={vol} onChange={e => setVol(+e.target.value)} className="w-20 accent-amber-500" aria-label="مستوى الصوت" /></label>
          )}
          <button onClick={leave} className="p-3 rounded-full bg-slate-700 hover:bg-slate-600 text-white flex items-center gap-1.5 text-sm font-bold px-4"><LogOut className="w-4 h-4" /> خروج</button>
        </div>

        {showDev && role === 'teacher' && (
          <div className="absolute bottom-20 right-3 z-10 bg-slate-800 border border-slate-700 rounded-xl p-3 w-72 text-xs space-y-2">
            <div className="font-black text-white">اختيار الأجهزة</div>
            <select className="w-full bg-slate-900 rounded p-1.5 text-white" onChange={e => room.current?.switchActiveDevice('videoinput', e.target.value)}>{devices.cams.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || 'كاميرا'}</option>)}</select>
            <select className="w-full bg-slate-900 rounded p-1.5 text-white" onChange={e => room.current?.switchActiveDevice('audioinput', e.target.value)}>{devices.mics.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || 'ميكروفون'}</option>)}</select>
          </div>
        )}

        {needPublish && (
          <div className="absolute inset-0 z-20 bg-black/70 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-amber-500/40 rounded-2xl p-6 max-w-sm text-center space-y-3">
              <UserPlus className="w-8 h-8 mx-auto text-amber-400" />
              <div className="font-black text-white text-lg">المدرس قبل مشاركتك</div>
              <p className="text-sm text-slate-300">لما تضغط «افتح الكاميرا والميكروفون» هيظهر صوتك وصورتك لكل الطلاب، وقد يظهران في تسجيل المحاضرة.</p>
              <div className="flex gap-2 justify-center">
                <button onClick={startPublishing} className="px-5 py-2.5 rounded-xl bg-amber-500 text-slate-950 font-black">افتح الكاميرا والميكروفون</button>
                <button onClick={() => setNeedPublish(false)} className="px-4 py-2.5 rounded-xl bg-slate-800 text-white font-bold">لاحقاً</button>
              </div>
            </div>
          </div>
        )}
        <div ref={audioHost} className="hidden" />
      </div>
    </Shell>
  );
};

const Waiting = () => <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm">في انتظار المدرس…</div>;
const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col" dir="rtl">{children}</div>
);
const Ctl: React.FC<{ on: boolean; onClick: () => void; icOn: React.ReactNode; icOff: React.ReactNode; label: string }> = ({ on, onClick, icOn, icOff, label }) => (
  <button onClick={onClick} aria-label={label} title={label} className={`p-3 rounded-full ${on ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-red-600/90 text-white hover:bg-red-500'}`}>{on ? icOn : icOff}</button>
);

// ======================= student sidebar =======================
const StudentSide: React.FC<{ code: string; classId: string; role: string; reconnect: () => void; onEnded: () => void; onBanned: () => void; onGuestScreen: (v: boolean) => void }> = ({ code, classId, role, reconnect, onEnded, onBanned, onGuestScreen }) => {
  const [msgs, setMsgs] = useState<api.LiveMsg[]>([]);
  const [st, setSt] = useState<api.LiveStudentState | null>(null);
  const [text, setText] = useState('');
  const [kind, setKind] = useState<'chat' | 'question'>('chat');
  const [note, setNote] = useState('');
  const since = useRef(0);
  const fails = useRef(0);
  const roleRef = useRef(role);
  roleRef.current = role;
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let stop = false;
    const run = async () => {
      const s = await api.liveState(code, classId, since.current);
      if (stop) return;
      if (!s) { fails.current++; return; }
      fails.current = 0;
      setSt(s);
      onGuestScreen(s.allowGuestScreen);
      if (s.messages.length) {
        setMsgs(prev => {
          const m = new Map<number, api.LiveMsg>(prev.map(x => [x.id, x] as [number, api.LiveMsg]));
          s.messages.forEach(x => m.set(x.id, x));
          s.removed.forEach(id => m.delete(id));
          return Array.from(m.values()).sort((a, b) => a.id - b.id).slice(-200);
        });
        since.current = Math.max(since.current, ...s.messages.map(x => x.id));
      } else if (s.removed.length) setMsgs(prev => prev.filter(x => !s.removed.includes(x.id)));
      if (s.status === 'ended' || s.status === 'cancelled') onEnded();
      else if (s.banned) onBanned();
      else if (s.hand === 'accepted' && roleRef.current !== 'guest') reconnect();
      else if (s.hand !== 'accepted' && roleRef.current === 'guest') reconnect();
    };
    run();
    const i = setInterval(run, 3000);
    return () => { stop = true; clearInterval(i); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, code]);

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [msgs.length]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const b = text.trim();
    if (!b) return;
    setText('');
    const m = await api.liveSend(code, classId, b, kind);
    if (m) { setNote(m); setTimeout(() => setNote(''), 3500); setText(b); }
  };
  const hand = async () => { const m = await api.liveHand(code, classId, st?.hand == null); if (m) { setNote(m); setTimeout(() => setNote(''), 3500); } };
  const blocked = !st || st.muted || st.chatMode === 'off';

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-2 p-2 border-b border-slate-800 flex-wrap">
        <button onClick={hand} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black ${st?.hand ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-white'}`}>
          <Hand className="w-4 h-4" /> {st?.hand === 'pending' ? 'بانتظار المدرس (إلغاء)' : st?.hand === 'accepted' ? 'إنهاء مشاركتي' : 'ارفع يدك للمشاركة'}
        </button>
        <button onClick={() => { api.liveConfused(code, classId); setNote('وصلت للمدرس: لم أفهم'); setTimeout(() => setNote(''), 2500); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800 text-white"><HelpCircle className="w-4 h-4" /> لم أفهم</button>
      </div>
      {st?.pinned && <div className="px-3 py-2 text-xs bg-amber-500/10 text-amber-200 flex gap-1.5 border-b border-slate-800"><Pin className="w-3.5 h-3.5 shrink-0 mt-0.5" /><span><b>{st.pinned.name}:</b> {st.pinned.body}</span></div>}
      {st?.poll && (
        <div className="p-3 border-b border-slate-800 space-y-1.5 bg-sky-500/5">
          <div className="text-xs font-black text-sky-200">{st.poll.question}</div>
          {st.poll.options.map((o, i) => (
            <button key={i} disabled={st.poll!.mine != null} onClick={() => api.livePollAnswer(code, st.poll!.id, i)} className={`w-full text-right text-xs px-3 py-1.5 rounded-lg border ${st.poll!.mine === i ? 'bg-sky-500 text-slate-950 border-sky-400 font-black' : 'bg-slate-800 border-slate-700 text-slate-100'}`}>{o}</button>
          ))}
          {st.poll.mine != null && <div className="text-[11px] text-slate-400">تم تسجيل إجابتك</div>}
        </div>
      )}
      <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1.5">
        {msgs.length === 0 && <div className="text-center text-xs text-slate-500 pt-6">لا توجد رسائل بعد.</div>}
        {msgs.map(m => (
          <div key={m.id} className={`text-xs rounded-lg px-2.5 py-1.5 ${m.kind === 'question' ? 'bg-sky-500/10 border border-sky-500/30' : m.mine ? 'bg-amber-500/10' : 'bg-slate-800/70'}`}>
            <b className="text-white">{m.name}{m.kind === 'question' ? ' ❓' : ''}:</b> <span className="text-slate-200 break-words">{m.body}</span>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      {note && <div className="px-3 py-1 text-[11px] text-amber-300">{note}</div>}
      <form onSubmit={send} className="p-2 border-t border-slate-800 space-y-1.5">
        <div className="flex gap-1.5 text-[11px]">
          <button type="button" onClick={() => setKind('chat')} className={`px-2 py-0.5 rounded ${kind === 'chat' ? 'bg-amber-500 text-slate-950 font-black' : 'bg-slate-800 text-slate-300'}`}>رسالة</button>
          <button type="button" onClick={() => setKind('question')} className={`px-2 py-0.5 rounded ${kind === 'question' ? 'bg-sky-500 text-slate-950 font-black' : 'bg-slate-800 text-slate-300'}`}>سؤال للمدرس</button>
          {st?.muted && <span className="text-red-300">تم كتمك</span>}
          {st?.chatMode === 'off' && <span className="text-amber-300">الشات متوقف</span>}
          {st?.chatMode === 'questions' && <span className="text-sky-300">الأسئلة فقط</span>}
        </div>
        <div className="flex gap-1.5">
          <input value={text} onChange={e => setText(e.target.value)} maxLength={600} disabled={blocked} placeholder={kind === 'question' ? 'اكتب سؤالك…' : 'اكتب رسالة…'} className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white disabled:opacity-50" />
          <button disabled={blocked} className="px-3 rounded-lg bg-amber-500 text-slate-950 disabled:opacity-50" aria-label="إرسال"><Send className="w-4 h-4" /></button>
        </div>
      </form>
    </div>
  );
};

// ======================= teacher sidebar =======================
const TeacherSide: React.FC<{
  classId: string; tab: 'chat' | 'people' | 'tools'; setTab: (t: 'chat' | 'people' | 'tools') => void; layout: Layout; pickLayout: (l: Layout) => void;
  boardOn: boolean; toggleBoard: () => void; parts: any[]; allowGuestScreen: boolean; setAllowGuestScreen: (v: boolean) => void; onStatus: (s: string) => void;
}> = ({ classId, tab, setTab, layout, pickLayout, boardOn, toggleBoard, parts, allowGuestScreen, setAllowGuestScreen, onStatus }) => {
  const [st, setSt] = useState<api.LiveTeacherState | null>(null);
  const [msgs, setMsgs] = useState<api.LiveMsg[]>([]);
  const [copied, setCopied] = useState('');
  const [pq, setPq] = useState('');
  const [po, setPo] = useState(['', '', '', '']);
  const [pc, setPc] = useState<number | null>(null);
  const [inviteLabel, setInviteLabel] = useState('');
  const [note, setNote] = useState('');
  const since = useRef(0);
  const flash = (m: string) => { setNote(m); setTimeout(() => setNote(''), 3500); };

  const load = useCallback(async () => {
    const s = await api.teacherLiveState(classId, since.current);
    if (!s) return;
    setSt(s);
    setAllowGuestScreen(s.allowGuestScreen);
    onStatus(s.status);
    if (s.messages.length) {
      setMsgs(prev => {
        const m = new Map<number, api.LiveMsg>(prev.map(x => [x.id, x] as [number, api.LiveMsg]));
        s.messages.forEach(x => m.set(x.id, x));
        return Array.from(m.values()).sort((a, b) => a.id - b.id).filter(x => !x.deleted).slice(-200);
      });
      since.current = Math.max(since.current, ...s.messages.map(x => x.id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId]);
  useEffect(() => { load(); const i = setInterval(load, 2000); return () => clearInterval(i); }, [load]);
  const act = async (f: () => Promise<any>) => { await f(); since.current = Math.max(0, since.current - 150); load(); };

  const msgAct = (id: number, a: 'delete' | 'pin' | 'unpin' | 'answered' | 'important') => act(async () => {
    await api.teacherLiveMsg(id, a);
    if (a === 'delete') setMsgs(p => p.filter(x => x.id !== id));
    if (a === 'pin') setMsgs(p => p.map(x => ({ ...x, pinned: x.id === id })));
    if (a === 'answered') setMsgs(p => p.map(x => (x.id === id ? { ...x, answered: true } : x)));
  });
  const copy = async (token: string) => {
    const link = `${window.location.origin}/?invite=${token}`;
    try { await navigator.clipboard.writeText(link); setCopied(token); setTimeout(() => setCopied(''), 2000); } catch { window.prompt('انسخ الرابط', link); }
  };
  const present = st?.present || [];
  const hands = st?.hands || [];
  const guestsAccepted = hands.filter(h => h.status === 'accepted').length;

  const TabBtn = (id: 'chat' | 'people' | 'tools', label: string, badge?: number) => (
    <button onClick={() => setTab(id)} className={`flex-1 py-2 text-xs font-black relative ${tab === id ? 'text-amber-400 border-b-2 border-amber-400' : 'text-slate-400'}`}>
      {label}{badge ? <span className="mr-1 px-1.5 rounded-full bg-red-500 text-white text-[10px]">{badge}</span> : null}
    </button>
  );

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex border-b border-slate-800">{TabBtn('chat', 'الشات والأسئلة', st?.open.length)}{TabBtn('people', 'الطلاب والضيوف', hands.filter(h => h.status === 'pending').length)}{TabBtn('tools', 'أدوات')}</div>
      {note && <div className="px-3 py-1 text-[11px] text-amber-300">{note}</div>}

      {tab === 'chat' && (
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="p-2 flex gap-1 text-[11px] border-b border-slate-800">
            {(['open', 'questions', 'off'] as const).map(m => (
              <button key={m} onClick={() => act(() => api.teacherLiveSettings(classId, m, st?.guestsMax ?? 2, allowGuestScreen))} className={`px-2 py-1 rounded ${st?.chatMode === m ? 'bg-amber-500 text-slate-950 font-black' : 'bg-slate-800 text-slate-300'}`}>
                {m === 'open' ? 'شات مفتوح' : m === 'questions' ? 'الأسئلة فقط' : 'إيقاف الشات'}
              </button>
            ))}
          </div>
          {(st?.open.length || 0) > 0 && (
            <div className="p-2 border-b border-slate-800 space-y-1 max-h-32 overflow-y-auto bg-sky-500/5">
              <div className="text-[11px] font-black text-sky-300">أسئلة لم يتم الرد عليها ({st!.open.length})</div>
              {st!.open.map(q => (
                <div key={q.id} className="text-xs flex items-start gap-1">
                  <span className="flex-1 text-slate-100"><b>{q.name}:</b> {q.body}</span>
                  <button onClick={() => msgAct(q.id, 'pin')} title="تثبيت" className="text-amber-300"><Pin className="w-3.5 h-3.5" /></button>
                  <button onClick={() => msgAct(q.id, 'answered')} title="تم الرد" className="text-emerald-300"><Check className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>
          )}
          <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1.5">
            {msgs.map(m => (
              <div key={m.id} className={`text-xs rounded-lg px-2.5 py-1.5 group ${m.kind === 'question' ? 'bg-sky-500/10 border border-sky-500/30' : 'bg-slate-800/70'} ${m.pinned ? 'ring-1 ring-amber-400' : ''}`}>
                <div className="flex items-start gap-1">
                  <span className="flex-1 break-words"><b className="text-white">{m.name}{m.kind === 'question' ? ' ❓' : ''}</b> <span className="text-slate-500">({m.code})</span>: <span className="text-slate-200">{m.body}</span></span>
                  <span className="flex gap-1.5 shrink-0">
                    <button onClick={() => msgAct(m.id, m.pinned ? 'unpin' : 'pin')} title="تثبيت" className="text-amber-300"><Pin className="w-3.5 h-3.5" /></button>
                    <button onClick={() => act(() => api.teacherLiveMember(classId, m.code!, true, false))} title="كتم الطالب" className="text-orange-300"><MicOff className="w-3.5 h-3.5" /></button>
                    <button onClick={() => msgAct(m.id, 'delete')} title="حذف" className="text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                  </span>
                </div>
              </div>
            ))}
            {msgs.length === 0 && <div className="text-center text-xs text-slate-500 pt-6">لا توجد رسائل بعد.</div>}
          </div>
        </div>
      )}

      {tab === 'people' && (
        <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-3 text-xs">
          <div>
            <div className="font-black text-white mb-1 flex items-center gap-1.5"><Hand className="w-4 h-4 text-amber-400" /> طلبات المشاركة ({hands.length}) · ضيوف ظاهرين {guestsAccepted}/{st?.guestsMax ?? 2}</div>
            {hands.length === 0 && <div className="text-slate-500">لا توجد طلبات.</div>}
            {hands.map(h => (
              <div key={h.id} className="flex items-center gap-1.5 bg-slate-800/70 rounded-lg px-2 py-1.5 mb-1">
                <span className="flex-1 text-slate-100">{h.name} <span className="text-slate-500">({h.code})</span></span>
                {h.status === 'pending' ? (<>
                  <button onClick={async () => { const m = await api.teacherLiveHand(h.id, 'accept'); if (m) flash(m); load(); }} className="px-2 py-0.5 rounded bg-emerald-500 text-slate-950 font-black">قبول</button>
                  <button onClick={async () => { await api.teacherLiveHand(h.id, 'reject'); load(); }} className="px-2 py-0.5 rounded bg-slate-700 text-white">رفض</button>
                </>) : (
                  <button onClick={async () => { await api.teacherLiveHand(h.id, 'end'); await api.liveAdmin(classId, `s:${h.code}`, 'remove'); load(); }} className="px-2 py-0.5 rounded bg-red-500/80 text-white">إنهاء المشاركة</button>
                )}
              </div>
            ))}
          </div>
          <div>
            <div className="font-black text-white mb-1">الموجودون الآن ({present.length})</div>
            {present.map(p => {
              const ident = p.role === 'guest' && p.code.startsWith('g:') ? p.code : `s:${p.code}`;
              return (
                <div key={p.code} className="bg-slate-800/70 rounded-lg px-2 py-1.5 mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className="flex-1 text-slate-100">{p.name} {p.role === 'guest' && <span className="text-amber-300">(ضيف)</span>} <span className="text-slate-500">{p.code.startsWith('g:') ? '' : p.code}</span></span>
                    {p.role === 'guest' && <>
                      <button title="كتم الصوت" onClick={async () => flash((await api.liveAdmin(classId, ident, 'mute')) ? 'تم كتم الصوت' : 'تعذر التنفيذ')} className="text-orange-300"><MicOff className="w-4 h-4" /></button>
                      <button title="إيقاف الكاميرا" onClick={async () => flash((await api.liveAdmin(classId, ident, 'camoff')) ? 'تم إيقاف الكاميرا' : 'تعذر التنفيذ')} className="text-orange-300"><CameraOff className="w-4 h-4" /></button>
                    </>}
                    <button title="إخراج" onClick={async () => { await api.liveAdmin(classId, ident, 'remove'); flash('تم الإخراج'); }} className="text-red-300"><UserMinus className="w-4 h-4" /></button>
                    {!p.code.startsWith('g:') && <button title="منع من المحاضرة" onClick={async () => { if (!confirm(`منع ${p.name} من هذه المحاضرة؟`)) return; await act(() => api.teacherLiveMember(classId, p.code, false, true)); await api.liveAdmin(classId, ident, 'remove'); }} className="text-red-400"><Ban className="w-4 h-4" /></button>}
                    {!p.code.startsWith('g:') && <button title={p.muted ? 'فك كتم الشات' : 'كتم الشات'} onClick={() => act(() => api.teacherLiveMember(classId, p.code, !p.muted, false))} className={p.muted ? 'text-red-400' : 'text-slate-400'}><MessageSquare className="w-4 h-4" /></button>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'tools' && (
        <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-4 text-xs">
          <div>
            <div className="font-black text-white mb-1.5 flex items-center gap-1.5"><LayoutGrid className="w-4 h-4 text-amber-400" /> تخطيط الشاشة</div>
            <div className="flex flex-wrap gap-1">{LAYOUTS.map(l => <button key={l.id} onClick={() => pickLayout(l.id)} className={`px-2 py-1 rounded ${layout === l.id ? 'bg-amber-500 text-slate-950 font-black' : 'bg-slate-800 text-slate-300'}`}>{l.label}</button>)}</div>
            <button onClick={toggleBoard} className={`mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-black ${boardOn ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-white'}`}><PenSquare className="w-4 h-4" /> {boardOn ? 'إغلاق السبورة' : 'فتح السبورة التفاعلية'}</button>
          </div>
          <div>
            <div className="font-black text-white mb-1.5 flex items-center gap-1.5"><UserPlus className="w-4 h-4 text-amber-400" /> إضافة ضيف</div>
            <div className="flex gap-1.5 mb-1.5">
              <input value={inviteLabel} onChange={e => setInviteLabel(e.target.value)} placeholder="اسم الضيف (اختياري)" className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-white" />
              <button onClick={async () => { await api.teacherLiveInvite(classId, inviteLabel); setInviteLabel(''); load(); }} className="px-3 rounded bg-amber-500 text-slate-950 font-black">رابط دعوة</button>
            </div>
            {(st?.invites || []).map(i => (
              <div key={i.id} className="flex items-center gap-1.5 bg-slate-800/70 rounded px-2 py-1 mb-1">
                <span className="flex-1 text-slate-200 truncate">{i.label || 'ضيف'} · …{i.token.slice(-6)}</span>
                <button onClick={() => copy(i.token)} className="text-amber-300 flex items-center gap-1">{copied === i.token ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}نسخ</button>
                <button onClick={async () => { await api.teacherLiveInvite(classId, '', i.id); load(); }} className="text-red-300"><X className="w-3.5 h-3.5" /></button>
              </div>
            ))}
            <div className="flex items-center gap-2 mt-2 text-slate-300">
              <label className="flex items-center gap-1">أقصى عدد ضيوف
                <select value={st?.guestsMax ?? 2} onChange={e => act(() => api.teacherLiveSettings(classId, st?.chatMode || 'open', +e.target.value, allowGuestScreen))} className="bg-slate-800 rounded px-1 py-0.5 text-white">{[0, 1, 2, 3, 4, 6, 8, 12, 16, 20, 30].map(n => <option key={n} value={n}>{n}</option>)}</select>
              </label>
              <label className="flex items-center gap-1"><input type="checkbox" checked={allowGuestScreen} onChange={e => act(() => api.teacherLiveSettings(classId, st?.chatMode || 'open', st?.guestsMax ?? 2, e.target.checked))} /> السماح للضيف بمشاركة الشاشة</label>
            </div>
          </div>
          <div>
            <div className="font-black text-white mb-1.5 flex items-center gap-1.5"><HelpCircle className="w-4 h-4 text-amber-400" /> «لم أفهم»: <span className="text-amber-300">{st?.confused ?? 0}</span> طالب (آخر دقيقتين)</div>
          </div>
          <div>
            <div className="font-black text-white mb-1.5">استطلاع / امتحان سريع</div>
            {st?.poll && st.poll.status === 'open' ? (
              <div className="bg-slate-800/70 rounded p-2 space-y-1">
                <div className="text-white font-bold">{st.poll.question}</div>
                {st.poll.options.map((o, i) => <div key={i} className="flex justify-between text-slate-200"><span>{o}{st.poll!.correct === i ? ' ✅' : ''}</span><b>{st.poll!.counts?.[String(i)] || 0}</b></div>)}
                <button onClick={() => act(() => api.teacherLivePoll(classId, '', [], null, st.poll!.id))} className="mt-1 px-3 py-1 rounded bg-red-500/80 text-white">إغلاق الاستطلاع</button>
              </div>
            ) : (
              <div className="space-y-1">
                <input value={pq} onChange={e => setPq(e.target.value)} placeholder="السؤال" className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-white" />
                {po.map((o, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <input type="radio" name="correct" checked={pc === i} onChange={() => setPc(i)} title="الإجابة الصحيحة (اختياري)" />
                    <input value={o} onChange={e => setPo(po.map((x, j) => (j === i ? e.target.value : x)))} placeholder={`اختيار ${i + 1}`} className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-white" />
                  </div>
                ))}
                <button onClick={async () => {
                  const opts = po.map(x => x.trim()).filter(Boolean);
                  if (!pq.trim() || opts.length < 2) return flash('اكتب سؤال واختيارين على الأقل');
                  await api.teacherLivePoll(classId, pq, opts, pc != null && po[pc]?.trim() ? opts.indexOf(po[pc].trim()) : null);
                  setPq(''); setPo(['', '', '', '']); setPc(null); load();
                }} className="px-3 py-1.5 rounded bg-sky-500 text-slate-950 font-black">إرسال للطلاب</button>
              </div>
            )}
          </div>
          <div className="text-slate-500">عدد المتصلين بالغرفة الآن: {parts.length}</div>
        </div>
      )}
    </div>
  );
};
