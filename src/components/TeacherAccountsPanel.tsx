import React, { useMemo, useState } from 'react';
import { Search, UserCheck, Trash2, Hourglass, CalendarPlus, Ban, Smartphone } from 'lucide-react';
import { Account } from '../types';

interface Props {
  accounts: Account[];
  onGrant: (id: number, days: number, extend: boolean) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onResetDevices: (id: number) => Promise<void>;
  onSetMaxDevices: (id: number, max: number) => Promise<void>;
}

const gradeLabel = (g: string) => (g === '1ث' ? 'أولى ثانوي' : g === '2ث' ? 'ثانية ثانوي' : g === '3ث' ? 'ثالثة ثانوي' : g);

function status(a: Account): { text: string; cls: string } {
  if (!a.active) return { text: 'موقوف', cls: 'bg-red-500/15 text-red-400 border-red-500/30' };
  if (!a.accessUntil) return { text: 'لم يُفعَّل', cls: 'bg-slate-700/60 text-slate-300 border-slate-600' };
  const ms = new Date(a.accessUntil).getTime() - Date.now();
  if (ms <= 0) return { text: 'منتهي', cls: 'bg-red-500/15 text-red-400 border-red-500/30' };
  const days = Math.ceil(ms / 86400000);
  return { text: `مفعّل · باقي ${days} يوم`, cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' };
}

export const TeacherAccountsPanel: React.FC<Props> = ({ accounts, onGrant, onDelete, onResetDevices, onSetMaxDevices }) => {
  const [idInput, setIdInput] = useState('');
  const [days, setDays] = useState(30);
  const [extend, setExtend] = useState(true);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const found = useMemo(() => accounts.find(a => String(a.id) === idInput.trim()), [accounts, idInput]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter(a =>
      String(a.id).includes(q) || a.name.toLowerCase().includes(q) ||
      a.email.toLowerCase().includes(q) || a.phone.includes(q));
  }, [accounts, search]);

  const run = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true);
    setMsg('');
    try { await fn(); setMsg(ok); } catch (e: any) { setMsg('⚠️ ' + (e?.message || 'حدث خطأ')); }
    setBusy(false);
  };

  const activate = () => {
    const id = Number(idInput.trim());
    if (!id) { setMsg('⚠️ اكتب رقم الـ ID الصحيح.'); return; }
    if (!days || days < 1) { setMsg('⚠️ اكتب عدد الأيام.'); return; }
    run(() => onGrant(id, days, extend), `✅ تم فتح المنصة للطالب ${id} لمدة ${days} يوم.`);
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-display font-black text-white">فتح المنصة لطالب بالـ ID</h3>
            <p className="text-xs text-slate-400">اكتب رقم الـ ID اللي الطالب بعتهولك وحدد المدة.</p>
          </div>
        </div>

        <div className="grid sm:grid-cols-4 gap-3 items-end">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">ID الطالب</label>
            <input
              dir="ltr"
              inputMode="numeric"
              value={idInput}
              onChange={e => setIdInput(e.target.value.replace(/\D/g, ''))}
              placeholder="1001"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-center font-mono font-bold text-amber-300 focus:outline-none focus:border-amber-500"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">المدة (يوم)</label>
            <input
              type="number" min={1} max={3650}
              value={days}
              onChange={e => setDays(Number(e.target.value))}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-center font-mono font-bold text-white focus:outline-none focus:border-amber-500"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-300 pb-3 cursor-pointer">
            <input type="checkbox" checked={extend} onChange={e => setExtend(e.target.checked)} className="accent-amber-500" />
            إضافة على المدة المتبقية
          </label>
          <button
            onClick={activate}
            disabled={busy}
            className="bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black py-2.5 rounded-xl text-sm shadow-lg shadow-amber-500/25 disabled:opacity-50"
          >
            {busy ? 'جاري التنفيذ...' : 'فتح المنصة'}
          </button>
        </div>

        <div className="flex flex-wrap gap-2 mt-3">
          {[7, 30, 60, 90, 180, 365].map(d => (
            <button key={d} onClick={() => setDays(d)}
              className={`px-3 py-1 rounded-lg text-xs border transition ${days === d ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold' : 'bg-slate-800 text-slate-300 border-slate-700 hover:border-amber-500/50'}`}>
              {d} يوم
            </button>
          ))}
        </div>

        {idInput && (
          <p className="text-xs mt-3 text-slate-400">
            {found ? <>الطالب: <b className="text-white">{found.name}</b> · {gradeLabel(found.grade)} · {status(found).text}</> : 'لا يوجد حساب بهذا الـ ID.'}
          </p>
        )}
        {msg && <p className="text-xs mt-3 text-amber-300">{msg}</p>}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="font-display font-black text-white">حسابات الطلبة ({accounts.length})</h3>
          <div className="relative">
            <Search className="absolute right-3 top-2.5 w-4 h-4 text-slate-500" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="ابحث بالـ ID أو الاسم أو الإيميل أو الرقم"
              className="bg-slate-800 border border-slate-700 rounded-xl pr-9 pl-3 py-2 text-xs w-72 max-w-full focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="text-center text-sm text-slate-500 py-10">لا توجد حسابات.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right">
              <thead className="text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-2 px-2">ID</th>
                  <th className="py-2 px-2">الاسم</th>
                  <th className="py-2 px-2">الإيميل / الهاتف</th>
                  <th className="py-2 px-2">المرحلة</th>
                  <th className="py-2 px-2">الحالة</th>
                  <th className="py-2 px-2">الأجهزة</th>
                  <th className="py-2 px-2">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {filtered.map(a => {
                  const st = status(a);
                  return (
                    <tr key={a.id} className="hover:bg-slate-800/30">
                      <td className="py-2.5 px-2 font-mono font-black text-amber-400">{a.id}</td>
                      <td className="py-2.5 px-2 font-bold text-white">{a.name}</td>
                      <td className="py-2.5 px-2 text-slate-300">
                        <span dir="ltr" className="block">{a.email}</span>
                        <span dir="ltr" className="block text-slate-500">{a.phone}</span>
                      </td>
                      <td className="py-2.5 px-2 text-slate-300">{gradeLabel(a.grade)}</td>
                      <td className="py-2.5 px-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] ${st.cls}`}>
                          {st.text === 'لم يُفعَّل' && <Hourglass className="w-3 h-3" />}
                          {st.text}
                        </span>
                        {a.accessUntil && (
                          <span className="block text-[10px] text-slate-500 mt-1">
                            حتى {new Date(a.accessUntil).toLocaleDateString('ar-EG')}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-2">
                        <span className={`inline-flex items-center gap-1 font-mono font-bold ${a.deviceCount >= a.maxDevices ? 'text-amber-400' : 'text-slate-300'}`}>
                          <Smartphone className="w-3 h-3" /> {a.deviceCount} / {a.maxDevices}
                        </span>
                        <select
                          value={a.maxDevices}
                          disabled={busy}
                          onChange={e => run(() => onSetMaxDevices(a.id, Number(e.target.value)), `تم تعديل حد الأجهزة للطالب ${a.id}.`)}
                          className="block mt-1 bg-slate-800 border border-slate-700 rounded-lg px-1 py-0.5 text-[11px] text-slate-300"
                          title="الحد الأقصى للأجهزة"
                        >
                          {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>حد {n}</option>)}
                        </select>
                      </td>
                      <td className="py-2.5 px-2">
                        <div className="flex flex-wrap gap-1.5">
                          <button disabled={busy} onClick={() => {
                            if (window.confirm(`تصفير أجهزة ${a.name}؟ هيتسجل من جديد على أول أجهزة يدخل منها.`)) run(() => onResetDevices(a.id), `تم تصفير أجهزة الطالب ${a.id}.`);
                          }}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-sky-500/15 text-sky-300 border border-sky-500/30 hover:bg-sky-500/25">
                            <Smartphone className="w-3 h-3" /> تصفير الأجهزة
                          </button>
                          <button disabled={busy} onClick={() => run(() => onGrant(a.id, 30, true), `✅ تمت إضافة 30 يوم للطالب ${a.id}.`)}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25">
                            <CalendarPlus className="w-3 h-3" /> +30 يوم
                          </button>
                          <button disabled={busy} onClick={() => run(() => onGrant(a.id, 0, false), `تم إيقاف الاشتراك للطالب ${a.id}.`)}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25">
                            <Ban className="w-3 h-3" /> إيقاف
                          </button>
                          <button disabled={busy} onClick={() => {
                            if (window.confirm(`حذف حساب ${a.name} (ID ${a.id}) نهائياً مع كل نتائجه؟`)) run(() => onDelete(a.id), 'تم حذف الحساب.');
                          }}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25">
                            <Trash2 className="w-3 h-3" /> حذف
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
