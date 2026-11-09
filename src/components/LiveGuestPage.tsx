import React, { useState } from 'react';
import { Radio } from 'lucide-react';
import { LiveRoom } from './LiveRoom';

// Opened from an invite link: /?invite=<token>. No account; the server validates the token and issues a short-lived room token.
export const LiveGuestPage: React.FC<{ token: string }> = ({ token }) => {
  const [name, setName] = useState('');
  const [joined, setJoined] = useState(false);
  if (joined) return <LiveRoom mode="invite" classId="" inviteToken={token} guestName={name.trim()} title="محاضرة مباشرة" onExit={() => { window.location.href = '/'; }} />;
  return (
    <div dir="rtl" className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <form onSubmit={e => { e.preventDefault(); if (name.trim()) setJoined(true); }} className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 text-center">
        <Radio className="w-9 h-9 mx-auto text-red-400" />
        <h1 className="text-xl font-black text-white">دعوة للمشاركة كضيف</h1>
        <p className="text-sm text-slate-300">المهندس حسين علام دعاك للمشاركة في محاضرة مباشرة. اكتب اسمك وادخل. الكاميرا والميكروفون مش هيفتحوا إلا بعد ما توافق.</p>
        <p className="text-xs text-amber-300">قد يظهر صوتك وصورتك في تسجيل المحاضرة.</p>
        <input value={name} onChange={e => setName(e.target.value)} maxLength={60} placeholder="اسمك" className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm" />
        <button disabled={!name.trim()} className="w-full py-2.5 rounded-xl bg-amber-500 text-slate-950 font-black disabled:opacity-50">دخول المحاضرة</button>
      </form>
    </div>
  );
};
