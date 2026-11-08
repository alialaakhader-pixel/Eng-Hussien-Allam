import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, BellOff, CalendarClock, CheckCircle2, Circle, Loader2, Pencil, Plus, Save, Trash2 } from 'lucide-react';
import { Lesson, StudyItem, StudySettings, StudyState } from '../types';
import * as api from '../services/api';
import { currentPushEndpoint, disablePush, enablePush, pushSupported } from '../utils/push';
import { formatCairo } from '../utils/progress';

const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const ZONES = [['Africa/Cairo', 'القاهرة'], ['Asia/Riyadh', 'الرياض'], ['Asia/Dubai', 'دبي'], ['Asia/Kuwait', 'الكويت'], ['Asia/Amman', 'عمّان'], ['Africa/Tripoli', 'طرابلس'], ['Europe/London', 'لندن']];
const inp = 'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500';

const blank = (): StudyItem => ({ title: '', subject: 'فيزياء', lessonId: '', kind: 'study', repeat: 'weekly', days: [], onceDate: '', startTime: '18:00', endTime: '19:00', remindBeforeMin: 10, enabled: true });

const localDay = (tz: string, offset = 0) => {
  const d = new Date(Date.now() + offset * 86400_000);
  return new Intl.DateTimeFormat('sv-SE', { timeZone: tz }).format(d);
};
const dowOf = (ymd: string) => new Date(ymd + 'T12:00:00Z').getUTCDay();
const occursOn = (i: StudyItem, ymd: string, rest: number[]) => {
  if (!i.enabled) return false;
  const dow = dowOf(ymd);
  if (i.repeat === 'once') return i.onceDate === ymd;
  if (rest.includes(dow)) return false;
  return i.repeat === 'daily' || i.days.includes(dow);
};
const fmt12 = (t?: string | null) => {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'ص' : 'م'}`;
};
const addMin = (t: string, m: number) => { const [h, mm] = t.split(':').map(Number); const x = (h * 60 + mm + m) % 1440; return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`; };

export const StudyPlannerPanel: React.FC<{ code: string; lessons: Lesson[] }> = ({ code, lessons }) => {
  const [st, setSt] = useState<StudyState | null | undefined>(undefined);
  const [form, setForm] = useState<StudyItem>(blank());
  const [dur, setDur] = useState('60');
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pushOn, setPushOn] = useState(false);

  const load = useCallback(async () => {
    const s = await api.studyGet(code);
    setSt(s);
    setPushOn(!!(await currentPushEndpoint()) && (s?.pushDevices ?? 0) > 0);
  }, [code]);
  useEffect(() => { load(); const t = setInterval(load, 60_000); return () => clearInterval(t); }, [load]);

  const tz = st?.settings.tz || 'Africa/Cairo';
  const rest = st?.settings.restDays || [];
  const today = localDay(tz);
  const doneSet = useMemo(() => new Set((st?.done || []).map(d => `${d.itemId}|${d.day}`)), [st]);
  const todayItems = useMemo(() => (st?.items || []).filter(i => occursOn(i, today, rest)).sort((a, b) => a.startTime.localeCompare(b.startTime)), [st, today, rest]);
  const nowHm = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());

  const flash = (ok: boolean, text: string) => setMsg({ ok, text });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!form.title.trim()) { flash(false, 'اكتب عنوان المهمة.'); return; }
    if (form.repeat === 'weekly' && form.days.length === 0) { flash(false, 'اختر يوماً واحداً على الأقل.'); return; }
    if (form.repeat === 'once' && !form.onceDate) { flash(false, 'اختر التاريخ.'); return; }
    setBusy(true);
    const item = { ...form, endTime: form.kind === 'study' ? addMin(form.startTime, Math.max(5, Number(dur) || 60)) : '' };
    const r = await api.studySaveItem(code, item);
    setBusy(false);
    if (r.ok) { flash(true, 'تم حفظ المهمة ✅'); setForm(blank()); setShowForm(false); load(); } else flash(false, (r as { error: string }).error);
  };

  const edit = (i: StudyItem) => {
    setForm({ ...i, lessonId: i.lessonId || '', onceDate: i.onceDate || '' });
    if (i.endTime) { const [a, b] = [i.startTime, i.endTime].map(t => t.split(':').map(Number)); setDur(String((b[0] * 60 + b[1]) - (a[0] * 60 + a[1]))); }
    setShowForm(true);
  };
  const toggleDone = async (i: StudyItem, day: string, done: boolean) => { if (i.id && await api.studySetDone(code, i.id, day, done)) load(); };
  const remove = async (i: StudyItem) => { if (i.id && confirm('حذف هذه المهمة؟') && await api.studyDeleteItem(code, i.id)) load(); };

  const saveSettings = async (patch: Partial<StudySettings>) => {
    if (!st) return;
    const next = { ...st.settings, ...patch };
    setSt({ ...st, settings: next });
    if (!(await api.studySaveSettings(code, next))) flash(false, 'تعذر حفظ الإعدادات.');
  };

  const togglePush = async () => {
    if (busy) return;
    setBusy(true);
    if (pushOn) { await disablePush(code); flash(true, 'تم إيقاف إشعارات هذا الجهاز.'); }
    else {
      const r = await enablePush(code);
      flash(r.ok, r.ok ? 'تم تفعيل الإشعارات على هذا الجهاز ✅ هتوصلك التذكيرات حتى والمنصة مقفولة.' : (r as { error: string }).error);
    }
    setBusy(false);
    load();
  };

  const markAll = async () => { await api.notifMarkRead(code, null); load(); };

  if (st === undefined) return <div className="text-slate-400 text-sm flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> جاري تحميل جدولك…</div>;
  if (st === null) return <div className="text-red-300 text-sm">تعذر تحميل جدول المذاكرة الآن.</div>;

  return (
    <section className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2"><CalendarClock className="w-5 h-5 text-amber-400" /><h3 className="text-lg font-display font-black text-white">جدول مذاكرتي</h3></div>
        <button onClick={() => { setForm(blank()); setShowForm(s => !s); }} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs"><Plus className="w-4 h-4" /> مهمة جديدة</button>
      </div>

      {msg && <div className={`text-xs rounded-xl p-3 border ${msg.ok ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-red-500/10 border-red-500/30 text-red-300'}`}>{msg.text}</div>}

      {/* Reminders channel */}
      <div className="rounded-2xl bg-slate-800/60 border border-slate-700 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-black text-white flex items-center gap-2">{pushOn ? <Bell className="w-4 h-4 text-emerald-400" /> : <BellOff className="w-4 h-4 text-slate-400" />} التذكيرات</div>
          {pushSupported()
            ? <button disabled={busy} onClick={togglePush} className={`px-4 py-2 rounded-xl text-xs font-bold ${pushOn ? 'bg-slate-700 text-slate-200' : 'bg-amber-500 text-slate-950 font-black'}`}>{pushOn ? 'إيقاف إشعارات هذا الجهاز' : 'تفعيل الإشعارات على هذا الجهاز'}</button>
            : <span className="text-[11px] text-slate-400">إشعارات الجهاز غير مدعومة هنا. التذكيرات هتظهر داخل المنصة.</span>}
        </div>
        <div className="grid sm:grid-cols-2 gap-3 text-xs">
          <label className="flex items-center gap-2"><input type="checkbox" checked={st.settings.notifyEnabled} onChange={e => saveSettings({ notifyEnabled: e.target.checked })} /> تشغيل كل التنبيهات</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={st.settings.dailySummary} onChange={e => saveSettings({ dailySummary: e.target.checked })} /> ملخص يومي بجدولي الساعة
            <input type="time" value={st.settings.summaryTime} onChange={e => e.target.value && saveSettings({ summaryTime: e.target.value })} className="bg-slate-800 border border-slate-700 rounded px-1 py-0.5 text-white" /></label>
          <label className="flex items-center gap-2">المنطقة الزمنية
            <select value={st.settings.tz} onChange={e => saveSettings({ tz: e.target.value })} className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-white">
              {ZONES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select></label>
          <div className="flex flex-wrap items-center gap-1.5">أيام الراحة:
            {DAYS.map((d, n) => (
              <button key={n} type="button" onClick={() => saveSettings({ restDays: rest.includes(n) ? rest.filter(x => x !== n) : [...rest, n] })}
                className={`px-2 py-0.5 rounded-full border text-[11px] ${rest.includes(n) ? 'bg-amber-500 text-slate-950 border-amber-500 font-bold' : 'bg-slate-800 border-slate-700 text-slate-300'}`}>{d}</button>
            ))}
          </div>
        </div>
      </div>

      {showForm && (
        <form onSubmit={save} className="rounded-2xl bg-slate-800/60 border border-slate-700 p-4 space-y-3">
          <div className="text-sm font-black text-white flex items-center gap-2">{form.id ? <Pencil className="w-4 h-4" /> : <Plus className="w-4 h-4" />} {form.id ? 'تعديل مهمة' : 'مهمة جديدة'}</div>
          <div className="grid sm:grid-cols-2 gap-2">
            <select value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value as 'study' | 'task' })} className={inp}><option value="study">مذاكرة</option><option value="task">مهمة / واجب</option></select>
            <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="عنوان المهمة (مثال: قانون أوم)" maxLength={120} className={inp} required />
            <input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} placeholder="المادة" maxLength={60} className={inp} />
            <select value={form.lessonId || ''} onChange={e => setForm({ ...form, lessonId: e.target.value })} className={inp}>
              <option value="">بدون ربط بمحاضرة</option>
              {lessons.filter(l => !l.locked).map(l => <option key={l.id} value={l.id}>{l.title}</option>)}
            </select>
          </div>
          <div className="grid sm:grid-cols-4 gap-2">
            <select value={form.repeat} onChange={e => setForm({ ...form, repeat: e.target.value as StudyItem['repeat'] })} className={inp}>
              <option value="weekly">أسبوعياً</option><option value="daily">يومياً</option><option value="once">مرة واحدة</option>
            </select>
            {form.repeat === 'once' && <input type="date" value={form.onceDate || ''} onChange={e => setForm({ ...form, onceDate: e.target.value })} className={inp} />}
            <label className="text-[11px] text-slate-300 flex items-center gap-1">يبدأ<input type="time" value={form.startTime} onChange={e => setForm({ ...form, startTime: e.target.value })} className={inp} required /></label>
            {form.kind === 'study' && <label className="text-[11px] text-slate-300 flex items-center gap-1">المدة (د)<input type="number" min={5} max={600} value={dur} onChange={e => setDur(e.target.value)} className={inp} /></label>}
            <label className="text-[11px] text-slate-300 flex items-center gap-1">نبّهني قبلها بـ (د)<input type="number" min={0} max={180} value={form.remindBeforeMin} onChange={e => setForm({ ...form, remindBeforeMin: Number(e.target.value) || 0 })} className={inp} /></label>
          </div>
          {form.repeat === 'weekly' && (
            <div className="flex flex-wrap gap-1.5">
              {DAYS.map((d, n) => (
                <button key={n} type="button" onClick={() => setForm({ ...form, days: form.days.includes(n) ? form.days.filter(x => x !== n) : [...form.days, n] })}
                  className={`px-3 py-1 rounded-full border text-xs ${form.days.includes(n) ? 'bg-amber-500 text-slate-950 border-amber-500 font-bold' : 'bg-slate-800 border-slate-700 text-slate-300'}`}>{d}</button>
              ))}
            </div>
          )}
          <label className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={form.enabled} onChange={e => setForm({ ...form, enabled: e.target.checked })} /> مفعّلة</label>
          <div className="flex gap-2">
            <button disabled={busy} className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 font-black rounded-lg px-4 py-2 text-xs"><Save className="w-4 h-4" /> حفظ</button>
            <button type="button" onClick={() => { setShowForm(false); setForm(blank()); }} className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-200">إلغاء</button>
          </div>
        </form>
      )}

      {/* Today */}
      <div className="space-y-2">
        <div className="text-sm font-black text-white">مهام اليوم ({todayItems.length})</div>
        {todayItems.length === 0 && <div className="text-xs text-slate-400">مفيش مهام النهاردة. ضيف مهمة وهتتنبّه في وقتها.</div>}
        {todayItems.map(i => {
          const done = doneSet.has(`${i.id}|${today}`);
          const late = !done && i.startTime < nowHm;
          return (
            <div key={i.id} className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-xs ${done ? 'bg-emerald-500/10 border-emerald-500/30' : late ? 'bg-red-500/10 border-red-500/30' : 'bg-slate-800/60 border-slate-700'}`}>
              <button onClick={() => toggleDone(i, today, !done)} className="flex items-center gap-2 text-right">
                {done ? <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" /> : <Circle className="w-5 h-5 text-slate-500 shrink-0" />}
                <span><b className="text-white">{i.title}</b><span className="text-slate-400"> · {i.subject} · {fmt12(i.startTime)}{i.endTime ? ` – ${fmt12(i.endTime)}` : ''}</span></span>
              </button>
              {late && <span className="text-[11px] text-red-300 font-bold shrink-0">متأخرة</span>}
            </div>
          );
        })}
      </div>

      {/* Whole schedule */}
      <div className="space-y-2">
        <div className="text-sm font-black text-white">كل مهامي ({st.items.length})</div>
        {st.items.map(i => (
          <div key={i.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-800/40 border border-slate-800 px-3 py-2 text-xs">
            <div>
              <b className="text-white">{i.title}</b> <span className="text-slate-400">· {i.kind === 'task' ? 'مهمة' : i.subject} · {fmt12(i.startTime)}{i.endTime ? ` – ${fmt12(i.endTime)}` : ''}</span>
              <div className="text-slate-500 text-[11px]">
                {i.repeat === 'daily' ? 'يومياً' : i.repeat === 'once' ? `مرة واحدة ${i.onceDate}` : i.days.map(d => DAYS[d]).join('، ')}
                {i.remindBeforeMin > 0 ? ` · تنبيه قبلها ${i.remindBeforeMin} د` : ''}{!i.enabled ? ' · موقوفة' : ''}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => edit(i)} className="px-2 py-1 rounded-lg bg-slate-800 border border-slate-700">تعديل</button>
              <button onClick={() => remove(i)} className="px-2 py-1 rounded-lg bg-red-500/10 text-red-300 border border-red-500/30"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        ))}
      </div>

      {/* Inbox */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-sm font-black text-white">تنبيهاتي {st.unread > 0 && <span className="text-[11px] bg-amber-500 text-slate-950 rounded-full px-2 py-0.5 mr-1">{st.unread} جديد</span>}</div>
          {st.unread > 0 && <button onClick={markAll} className="text-xs text-amber-400 font-bold">تحديد الكل كمقروء</button>}
        </div>
        {st.notifications.length === 0 && <div className="text-xs text-slate-400">لا توجد تنبيهات بعد.</div>}
        {st.notifications.map(n => (
          <div key={n.id} className={`rounded-xl border px-3 py-2 text-xs ${n.read ? 'bg-slate-800/30 border-slate-800 text-slate-400' : 'bg-amber-500/10 border-amber-500/30 text-slate-100'}`}>
            <div className="font-bold">{n.title}</div>
            <div className="whitespace-pre-line">{n.body}</div>
            <div className="text-[10px] text-slate-500 mt-1">{formatCairo(n.createdAt)}</div>
          </div>
        ))}
      </div>
    </section>
  );
};
