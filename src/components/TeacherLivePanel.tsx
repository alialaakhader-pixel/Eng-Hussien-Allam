import React, { useCallback, useEffect, useState } from 'react';
import { Download, Link2, Loader2, Pencil, PlayCircle, Plus, Radio, Trash2, Users, XCircle } from 'lucide-react';
import * as api from '../services/api';
import { Lesson, TeacherPlan } from '../types';
import { formatCairo } from '../utils/progress';
import { LiveRoom } from './LiveRoom';

const ST: Record<string, { t: string; c: string }> = {
  scheduled: { t: 'مجدولة', c: 'bg-sky-500/20 text-sky-300' },
  live: { t: 'مباشرة الآن', c: 'bg-red-500/20 text-red-300' },
  ended: { t: 'انتهت', c: 'bg-slate-700 text-slate-300' },
  cancelled: { t: 'ملغاة', c: 'bg-amber-500/20 text-amber-300' }
};
const GRADES = [{ id: '1ث', l: 'أولى ثانوي' }, { id: '2ث', l: 'تانية ثانوي' }, { id: '3ث', l: 'تالتة ثانوي' }, { id: 'جميع الصفوف', l: 'كل الصفوف' }];

const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
};

interface FormState { id: string | null; title: string; desc: string; grade: string; lesson: string; plan: string; codes: string; at: string; guests: number; guestScreen: boolean }
const blank = (): FormState => ({ id: null, title: '', desc: '', grade: '3ث', lesson: '', plan: '', codes: '', at: toLocalInput(new Date(Date.now() + 3600000).toISOString()), guests: 2, guestScreen: false });

export const TeacherLivePanel: React.FC<{ lessons: Lesson[] }> = ({ lessons }) => {
  const [items, setItems] = useState<api.TeacherLiveClass[] | null>(null);
  const [plans, setPlans] = useState<TeacherPlan[]>([]);
  const [form, setForm] = useState<FormState | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [room, setRoom] = useState<api.TeacherLiveClass | null>(null);
  const [rec, setRec] = useState<{ id: string; url: string; until: string; note: string } | null>(null);
  const [att, setAtt] = useState<{ cls: api.TeacherLiveClass; rows: api.LiveAttendanceRow[] } | null>(null);

  const load = useCallback(async () => {
    try { setItems(await api.teacherLiveList()); } catch (e: any) { setMsg(e.message); setItems([]); }
  }, []);
  useEffect(() => { load(); api.teacherSubsOverview().then(o => setPlans(o.plans)).catch(() => { /* plans optional */ }); }, [load]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setBusy(true); setMsg('');
    try {
      await api.teacherLiveSave({
        id: form.id, title: form.title, desc: form.desc, grade: form.grade, lesson: form.lesson || null, plan: form.plan || null,
        codes: form.codes.split(/[\s,،]+/).filter(Boolean), at: new Date(form.at).toISOString(), guests: form.guests, guestScreen: form.guestScreen
      });
      setForm(null); await load();
    } catch (er: any) { setMsg(er.message); }
    setBusy(false);
  };
  const setStatus = async (c: api.TeacherLiveClass, s: 'live' | 'ended' | 'cancelled') => {
    try { await api.teacherLiveStatus(c.id, s); await load(); } catch (e: any) { setMsg(e.message); }
  };
  const openAtt = async (c: api.TeacherLiveClass) => setAtt({ cls: c, rows: await api.teacherLiveAttendance(c.id) });
  const csv = () => {
    if (!att) return;
    const head = 'الاسم,الكود,النوع,أول دخول,آخر خروج,مدة الحضور (دقيقة),مرات العودة';
    const lines = att.rows.map(r => [r.name, r.code, r.role === 'guest' ? 'ضيف' : 'طالب', formatCairo(r.first_join), formatCairo(r.last_leave), r.minutes, r.reconnects].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
    const blob = new Blob(['﻿' + [head, ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `حضور-${att.cls.title}.csv`;
    a.click();
  };
  const saveRec = async () => {
    if (!rec) return;
    try { await api.teacherLiveRecording(rec.id, rec.url.trim(), rec.until ? new Date(rec.until).toISOString() : null, rec.note); setRec(null); await load(); } catch (e: any) { setMsg(e.message); }
  };

  if (room) return <LiveRoom mode="teacher" classId={room.id} title={room.title} startedStatus={room.status} onExit={() => { setRoom(null); load(); }} />;

  return (
    <section className="space-y-5" dir="rtl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-xl font-display font-black text-white flex items-center gap-2"><Radio className="w-5 h-5 text-red-400" /> البث المباشر – Live Classes</h3>
        <button onClick={() => setForm(blank())} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-black text-sm"><Plus className="w-4 h-4" /> محاضرة مباشرة جديدة</button>
      </div>
      {msg && <div className="text-sm text-red-300 bg-red-500/10 rounded-xl px-3 py-2">{msg}</div>}
      <div className="text-xs text-slate-400 bg-slate-900 border border-slate-800 rounded-xl p-3">
        البث يعمل عبر LiveKit. لو ظهرت رسالة «خدمة البث لم يتم إعدادها» يبقى لازم تضيف المفاتيح LIVEKIT_URL و LIVEKIT_API_KEY و LIVEKIT_API_SECRET في Supabase → Edge Functions → Secrets.
      </div>

      {form && (
        <form onSubmit={save} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
          <div className="font-black text-white">{form.id ? 'تعديل المحاضرة' : 'محاضرة جديدة'}</div>
          <input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="عنوان المحاضرة" maxLength={160} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm" />
          <textarea value={form.desc} onChange={e => setForm({ ...form, desc: e.target.value })} placeholder="وصف المحاضرة" rows={2} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm" />
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="text-xs text-slate-300 space-y-1">الصف
              <select value={form.grade} onChange={e => setForm({ ...form, grade: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm">{GRADES.map(g => <option key={g.id} value={g.id}>{g.l}</option>)}</select>
            </label>
            <label className="text-xs text-slate-300 space-y-1">الموعد
              <input required type="datetime-local" value={form.at} onChange={e => setForm({ ...form, at: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm" />
            </label>
            <label className="text-xs text-slate-300 space-y-1">الدرس المرتبط (اختياري)
              <select value={form.lesson} onChange={e => setForm({ ...form, lesson: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm">
                <option value="">— بدون —</option>{lessons.filter(l => form.grade === 'جميع الصفوف' || l.grade === form.grade).map(l => <option key={l.id} value={l.id}>{l.title}</option>)}
              </select>
            </label>
            <label className="text-xs text-slate-300 space-y-1">الباقة المطلوبة
              <select value={form.plan} onChange={e => setForm({ ...form, plan: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm">
                <option value="">مجانية (بدون اشتراك)</option>{plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
          </div>
          <label className="text-xs text-slate-300 space-y-1 block">أكواد طلاب محددين (اتركها فاضية لكل طلاب الصف)
            <input value={form.codes} onChange={e => setForm({ ...form, codes: e.target.value })} dir="ltr" placeholder="1111, 2222" className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm" />
          </label>
          <div className="flex items-center gap-4 flex-wrap text-xs text-slate-300">
            <label className="flex items-center gap-1.5">أقصى عدد ضيوف
              <select value={form.guests} onChange={e => setForm({ ...form, guests: +e.target.value })} className="bg-slate-800 rounded px-2 py-1 text-white">{[0, 1, 2, 3, 4, 6, 8].map(n => <option key={n} value={n}>{n}</option>)}</select>
            </label>
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={form.guestScreen} onChange={e => setForm({ ...form, guestScreen: e.target.checked })} /> السماح للضيف بمشاركة الشاشة</label>
          </div>
          <div className="flex gap-2">
            <button disabled={busy} className="px-5 py-2 rounded-xl bg-amber-500 text-slate-950 font-black text-sm disabled:opacity-60">{busy ? '…' : form.id ? 'حفظ التعديل' : 'جدولة المحاضرة'}</button>
            <button type="button" onClick={() => setForm(null)} className="px-4 py-2 rounded-xl bg-slate-800 text-white text-sm">إلغاء</button>
          </div>
        </form>
      )}

      {items === null && <div className="text-slate-400 text-sm flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> جاري التحميل…</div>}
      {items && items.length === 0 && <div className="text-slate-400 text-sm bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center">لا توجد محاضرات مباشرة بعد.</div>}

      <div className="space-y-3">
        {items?.map(c => (
          <div key={c.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div>
                <div className="font-black text-white">{c.title}</div>
                <div className="text-xs text-slate-400 mt-0.5">{formatCairo(c.scheduledAt)} · {GRADES.find(g => g.id === c.grade)?.l || c.grade}{c.planId ? ' · مدفوعة' : ' · مجانية'} · <Users className="w-3 h-3 inline" /> حضر {c.attendees}</div>
              </div>
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${ST[c.status].c}`}>{ST[c.status].t}</span>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              {(c.status === 'scheduled' || c.status === 'live') && <button onClick={() => setRoom(c)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 text-white font-black"><PlayCircle className="w-4 h-4" /> {c.status === 'live' ? 'العودة لغرفة البث' : 'فتح غرفة البث'}</button>}
              {c.status === 'live' && <button onClick={() => setStatus(c, 'ended')} className="px-3 py-1.5 rounded-lg bg-slate-700 text-white font-bold">إنهاء</button>}
              {c.status === 'scheduled' && <button onClick={() => setForm({ id: c.id, title: c.title, desc: c.description, grade: c.grade, lesson: c.lessonId || '', plan: c.planId || '', codes: c.allowedCodes.join(', '), at: toLocalInput(c.scheduledAt), guests: c.guestsMax, guestScreen: c.allowGuestScreen })} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 text-white"><Pencil className="w-3.5 h-3.5" /> تعديل</button>}
              {(c.status === 'scheduled' || c.status === 'live') && <button onClick={() => { if (confirm('إلغاء المحاضرة؟')) setStatus(c, 'cancelled'); }} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 text-red-300"><XCircle className="w-3.5 h-3.5" /> إلغاء</button>}
              {(c.status === 'ended' || c.status === 'live') && <button onClick={() => openAtt(c)} className="px-3 py-1.5 rounded-lg bg-slate-800 text-white">تقرير الحضور</button>}
              {c.status === 'ended' && <button onClick={() => setRec({ id: c.id, url: c.recordingUrl, until: c.recordingUntil ? toLocalInput(c.recordingUntil) : '', note: c.recordingNote })} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 text-white"><Link2 className="w-3.5 h-3.5" /> {c.recordingUrl ? 'تعديل التسجيل' : 'نشر التسجيل'}</button>}
              {c.recordingUrl && <button onClick={async () => { if (confirm('حذف رابط التسجيل؟')) { await api.teacherLiveRecording(c.id, '', null, c.recordingNote); load(); } }} className="px-2 py-1.5 rounded-lg bg-slate-800 text-red-300"><Trash2 className="w-3.5 h-3.5" /></button>}
            </div>
            {rec?.id === c.id && (
              <div className="bg-slate-800/60 rounded-xl p-3 space-y-2 text-xs">
                <input value={rec.url} onChange={e => setRec({ ...rec, url: e.target.value })} dir="ltr" placeholder="https://… رابط التسجيل (يوتيوب غير مدرج / Drive / Vimeo)" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white" />
                <label className="block text-slate-300">تاريخ انتهاء الإتاحة (اختياري)<input type="datetime-local" value={rec.until} onChange={e => setRec({ ...rec, until: e.target.value })} className="block mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white" /></label>
                <textarea value={rec.note} onChange={e => setRec({ ...rec, note: e.target.value })} rows={2} placeholder="وصف / ملاحظات للمحاضرة" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white" />
                <div className="flex gap-2"><button onClick={saveRec} className="px-4 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-black">حفظ ونشر</button><button onClick={() => setRec(null)} className="px-3 py-1.5 rounded-lg bg-slate-700 text-white">إلغاء</button></div>
                <p className="text-slate-500">التسجيل التلقائي من LiveKit يحتاج إعداد Egress منفصل. هنا بتضيف رابط التسجيل بعد رفعه.</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {att && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setAtt(null)}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 w-full max-w-3xl max-h-[85vh] overflow-auto space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-2"><div className="font-black text-white">حضور: {att.cls.title}</div>
              <button onClick={csv} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-black text-xs"><Download className="w-3.5 h-3.5" /> تصدير CSV</button></div>
            <p className="text-[11px] text-slate-500">المدة محسوبة من سجلات الدخول والخروج الفعلية وليس من مجرد فتح الرابط.</p>
            <div className="overflow-x-auto"><table className="w-full text-xs text-slate-200">
              <thead><tr className="text-slate-400 text-right"><th className="p-1.5">الاسم</th><th>الكود</th><th>أول دخول</th><th>آخر خروج</th><th>المدة (د)</th><th>مرات العودة</th></tr></thead>
              <tbody>{att.rows.map(r => <tr key={r.code} className="border-t border-slate-800"><td className="p-1.5">{r.name}{r.role === 'guest' ? ' (ضيف)' : ''}</td><td dir="ltr">{r.code.startsWith('g:') ? '—' : r.code}</td><td>{formatCairo(r.first_join)}</td><td>{formatCairo(r.last_leave)}</td><td className="font-black">{r.minutes}</td><td>{r.reconnects}</td></tr>)}</tbody>
            </table></div>
            {att.rows.length === 0 && <div className="text-center text-slate-500 text-sm py-4">لا يوجد حضور مسجل.</div>}
            <button onClick={() => setAtt(null)} className="px-4 py-1.5 rounded-lg bg-slate-700 text-white text-sm">إغلاق</button>
          </div>
        </div>
      )}
    </section>
  );
};
