import React, { useState } from 'react';
import { X, KeyRound, User, Phone, CheckCircle2, AlertCircle, ShieldCheck, Mail, Lock } from 'lucide-react';
import { GradeType } from '../types';

interface StudentLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAttemptLogin: (name: string, phone: string, grade: GradeType, code: string) => Promise<{ ok: boolean; error?: string }>;
  onAccountLogin: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  onAccountSignup: (email: string, password: string, name: string, phone: string, grade: GradeType) => Promise<{ ok: boolean; error?: string }>;
}

type Mode = 'login' | 'signup' | 'code';

const inputCls =
  'w-full bg-slate-800/90 border border-slate-700 rounded-xl pr-10 pl-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition';

export const StudentLoginModal: React.FC<StudentLoginModalProps> = ({
  isOpen,
  onClose,
  onAttemptLogin,
  onAccountLogin,
  onAccountSignup
}) => {
  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [grade, setGrade] = useState<GradeType>('3ث');
  const [code, setCode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const switchMode = (m: Mode) => {
    setMode(m);
    setError('');
  };

  const finish = (r: { ok: boolean; error?: string }) => {
    setLoading(false);
    if (!r.ok) {
      setError(r.error || 'تعذر تسجيل الدخول');
      return;
    }
    setSuccess(true);
    setTimeout(() => {
      onClose();
      setSuccess(false);
      setPassword('');
    }, 450);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (mode === 'login') {
      if (!email.trim() || !password) {
        setError('اكتب الإيميل وكلمة المرور.');
        return;
      }
      setLoading(true);
      finish(await onAccountLogin(email.trim(), password));
      return;
    }

    if (!name.trim() || name.trim().length < 3) {
      setError('يرجى كتابة اسم الطالب ثلاثي على الأقل');
      return;
    }
    if (!phone.trim() || phone.trim().length < 10) {
      setError('يرجى إدخال رقم هاتف صحيح للتواصل');
      return;
    }

    if (mode === 'signup') {
      if (!email.trim()) {
        setError('اكتب الإيميل.');
        return;
      }
      if (password.length < 6) {
        setError('كلمة المرور لازم تكون 6 أحرف أو أرقام على الأقل.');
        return;
      }
      setLoading(true);
      finish(await onAccountSignup(email.trim(), password, name.trim(), phone.trim(), grade));
      return;
    }

    if (!code.trim()) {
      setError('يرجى إدخال كود التفعيل المسلم لك من المدرس');
      return;
    }
    setLoading(true);
    finish(await onAttemptLogin(name.trim(), phone.trim(), grade, code.trim()));
  };

  const tabCls = (m: Mode) =>
    `flex-1 py-2 rounded-xl text-xs font-bold transition ${
      mode === m ? 'bg-amber-500 text-slate-950 font-black shadow' : 'text-slate-300 hover:text-white'
    }`;

  const title =
    mode === 'login' ? 'تسجيل دخول الطالب' : mode === 'signup' ? 'إنشاء حساب طالب جديد' : 'دخول بكود الاشتراك';
  const subtitle =
    mode === 'login'
      ? 'ادخل بإيميلك وكلمة المرور لتفتح محاضراتك وتشوف نتايجك'
      : mode === 'signup'
        ? 'سجّل بإيميلك، وبعدها هتاخد رقم ID تديه للمهندس حسين علام لتفعيل حسابك'
        : 'أدخل كود الاشتراك المسلم لك من المهندس حسين علام';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 text-white my-auto">
        <button
          onClick={onClose}
          className="absolute top-5 left-5 w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition"
          aria-label="إغلاق"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3.5 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shadow-inner">
            {mode === 'code' ? <KeyRound className="w-6 h-6" /> : <Mail className="w-6 h-6" />}
          </div>
          <div>
            <h2 className="text-xl font-display font-black text-white">{title}</h2>
            <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
          </div>
        </div>

        <div className="flex gap-1 bg-slate-800/70 border border-slate-700/60 p-1 rounded-2xl mb-5">
          <button type="button" onClick={() => switchMode('login')} className={tabCls('login')}>دخول بالإيميل</button>
          <button type="button" onClick={() => switchMode('signup')} className={tabCls('signup')}>حساب جديد</button>
          <button type="button" onClick={() => switchMode('code')} className={tabCls('code')}>دخول بكود</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode !== 'login' && (
            <>
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  المرحلة الدراسية <span className="text-amber-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { val: '1ث', label: 'أولى ثانوي' },
                    { val: '2ث', label: 'ثانية ثانوي' },
                    { val: '3ث', label: 'ثالثة ثانوي' }
                  ].map(g => (
                    <button
                      key={g.val}
                      type="button"
                      onClick={() => setGrade(g.val as GradeType)}
                      className={`p-2.5 rounded-xl border text-center transition ${
                        grade === g.val
                          ? 'bg-amber-500 border-amber-400 text-slate-950 font-black shadow-lg shadow-amber-500/20'
                          : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:border-amber-500/50 hover:text-white'
                      }`}
                    >
                      <span className="block text-xs font-bold leading-tight">{g.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  اسم الطالب ثلاثي <span className="text-amber-500">*</span>
                </label>
                <div className="relative">
                  <User className="absolute right-3.5 top-3 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="اكتب اسم الطالب بالكامل"
                    className={inputCls}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  رقم الهاتف / واتساب الطالب <span className="text-amber-500">*</span>
                </label>
                <div className="relative">
                  <Phone className="absolute right-3.5 top-3 w-4 h-4 text-slate-500" />
                  <input
                    type="tel"
                    dir="ltr"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="010XXXXXXXX"
                    className={inputCls + ' text-right'}
                  />
                </div>
              </div>
            </>
          )}

          {mode !== 'code' && (
            <>
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  البريد الإلكتروني <span className="text-amber-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="absolute right-3.5 top-3 w-4 h-4 text-amber-500" />
                  <input
                    type="email"
                    dir="ltr"
                    autoComplete="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="name@gmail.com"
                    className={inputCls + ' text-left'}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  كلمة المرور <span className="text-amber-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="absolute right-3.5 top-3 w-4 h-4 text-amber-500" />
                  <input
                    type="password"
                    dir="ltr"
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder={mode === 'signup' ? '6 أحرف أو أرقام على الأقل' : 'كلمة المرور'}
                    className={inputCls + ' text-left'}
                  />
                </div>
              </div>
            </>
          )}

          {mode === 'code' && (
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                كود التفعيل الخاص بك <span className="text-amber-500">*</span>
              </label>
              <div className="relative">
                <KeyRound className="absolute right-3.5 top-3 w-4 h-4 text-amber-500" />
                <input
                  type="text"
                  dir="ltr"
                  value={code}
                  onChange={e => setCode(e.target.value.toUpperCase())}
                  placeholder="PHYS-XXXX-XXXX"
                  className={inputCls + ' text-amber-300 font-mono font-bold tracking-wider'}
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>يتم إصدار هذا الكود رسمياً من قِبل المهندس حسين علام للطالب.</span>
              </p>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>تم بنجاح! جاري فتح حسابك...</span>
            </div>
          )}

          <button
            type="submit"
            disabled={success || loading}
            className="w-full mt-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black py-3 rounded-xl text-sm shadow-lg shadow-amber-500/25 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
          >
            {loading
              ? 'جاري التحقق...'
              : mode === 'login'
                ? 'تسجيل الدخول 🚀'
                : mode === 'signup'
                  ? 'إنشاء الحساب 🚀'
                  : 'تأكيد الدخول وعرض المحاضرات 🚀'}
          </button>
        </form>
      </div>
    </div>
  );
};
