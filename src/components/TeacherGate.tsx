import React, { useState } from 'react';
import { ShieldCheck, KeyRound, Lock, CheckCircle2, AlertCircle, ShieldAlert } from 'lucide-react';
import { teacherLoginWithCode } from '../services/api';

interface TeacherGateProps {
  onUnlock: () => void;
  onCancel: () => void;
}

export const TeacherGate: React.FC<TeacherGateProps> = ({ onUnlock, onCancel }) => {
  const [passcode, setPasscode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(false);
    setErrorMessage('');
    if (!passcode.trim()) {
      setError(true);
      setErrorMessage('اكتب كود المدرس.');
      return;
    }
    setBusy(true);
    try {
      await teacherLoginWithCode(passcode);
      setSuccess(true);
      setTimeout(() => { onUnlock(); }, 500);
    } catch (err: any) {
      setError(true);
      setErrorMessage(
        err?.message === 'NOT_TEACHER'
          ? 'هذا الحساب غير مصرح له بدخول لوحة المدرس.'
          : 'كود المدرس غير صحيح.'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-[75vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-8 text-center text-white relative overflow-hidden">
        
        {/* Glow behind icon */}
        <div className="absolute top-0 right-1/2 translate-x-1/2 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Lock / Security Icon */}
        <div className="relative mx-auto w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-600 flex items-center justify-center text-slate-950 shadow-xl shadow-amber-500/25 mb-6">
          <ShieldCheck className="w-8 h-8" />
          <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-slate-950 border-2 border-amber-500 flex items-center justify-center">
            <Lock className="w-2.5 h-2.5 text-amber-400" />
          </div>
        </div>

        <h2 className="text-2xl font-display font-black text-white">
          بوابة دخول المدرس
        </h2>
        <p className="text-sm text-slate-400 mt-1 mb-6">
          قسم خاص بإدارة المنصة ونشر الفيديوهات وتوليد أكواد الطلبة
        </p>

        {/* Confidentiality Notice */}
        <div className="mb-6 p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700/80 text-xs text-right flex items-center gap-2.5 text-slate-300">
          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
          <span>منطقة محظورة: الدخول مصرح به للمهندس حسين علام فقط بكود المدرس.</span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-2 text-right">
              كود المدرس:
            </label>
            <div className="relative">
              <KeyRound className="absolute right-3.5 top-3.5 w-5 h-5 text-amber-500" />
              <input
                type="password"
                autoComplete="off"
                value={passcode}
                onChange={e => {
                  setPasscode(e.target.value);
                  setError(false);
                }}
                placeholder="اكتب كود المدرس"
                className={`w-full bg-slate-800/90 border rounded-2xl pr-12 pl-4 py-3 text-center text-base font-mono font-bold text-amber-300 placeholder-slate-500 focus:outline-none transition ${
                  error 
                    ? 'border-red-500 focus:ring-1 focus:ring-red-500' 
                    : 'border-slate-700 focus:border-amber-500 focus:ring-1 focus:ring-amber-500'
                }`}
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs text-right">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs text-right">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>تم التحقق بنجاح! جاري فتح لوحة التحكم للمهندس حسين علام...</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="py-3 px-4 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-bold transition"
            >
              الرجوع للرئيسية
            </button>
            <button
              type="submit"
              disabled={success || busy}
              className="py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/25 transition disabled:opacity-50"
            >
              {busy ? 'جاري التحقق...' : 'دخول كمعلم 🚀'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
