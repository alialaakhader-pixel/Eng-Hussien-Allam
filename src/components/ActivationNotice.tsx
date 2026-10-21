import React, { useState } from 'react';
import { Copy, Check, RefreshCw, LogOut, Hourglass } from 'lucide-react';
import { AccountInfo } from '../types';

interface ActivationNoticeProps {
  info: AccountInfo;
  name: string;
  onRefresh: () => Promise<void> | void;
  onLogout: () => void;
}

export const ActivationNotice: React.FC<ActivationNoticeProps> = ({ info, name, onRefresh, onLogout }) => {
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const expired = !!info.accessUntil && new Date(info.accessUntil).getTime() <= Date.now();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(String(info.id));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  };

  const refresh = async () => {
    setBusy(true);
    try { await onRefresh(); } finally { setBusy(false); }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-8 text-center text-white">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center mb-5">
          <Hourglass className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-display font-black">
          {expired ? 'انتهى اشتراكك' : 'حسابك في انتظار التفعيل'}
        </h2>
        <p className="text-sm text-slate-400 mt-2 leading-relaxed">
          أهلاً {name}! {expired
            ? 'انتهت مدة اشتراكك. ابعت الـ ID بتاعك للمهندس حسين علام لتجديده.'
            : 'ابعت الـ ID بتاعك للمهندس حسين علام عشان يفتحلك المنصة.'}
        </p>

        <div className="my-6 bg-slate-800/80 border border-slate-700 rounded-2xl p-4">
          <span className="text-xs text-slate-400 block mb-1">رقم الـ ID الخاص بك</span>
          <div className="flex items-center justify-center gap-3">
            <span className="text-4xl font-black font-mono text-amber-400 tracking-widest" dir="ltr">{info.id}</span>
            <button
              onClick={copy}
              className="w-9 h-9 rounded-xl bg-slate-700 hover:bg-slate-600 flex items-center justify-center transition"
              aria-label="نسخ الـ ID"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-300" />}
            </button>
          </div>
          {expired && info.accessUntil && (
            <p className="text-[11px] text-red-400 mt-2">
              انتهى في {new Date(info.accessUntil).toLocaleDateString('ar-EG')}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={onLogout}
            className="py-3 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-bold transition flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" /> تسجيل الخروج
          </button>
          <button
            onClick={refresh}
            disabled={busy}
            className="py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/25 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${busy ? 'animate-spin' : ''}`} /> تحديث الحالة
          </button>
        </div>
      </div>
    </div>
  );
};
