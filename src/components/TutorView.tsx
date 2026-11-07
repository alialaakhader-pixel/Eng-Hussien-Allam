import React, { useEffect, useRef, useState } from 'react';
import { Bot, Send, RotateCcw, Trash2, Loader2, AlertCircle } from 'lucide-react';
import { StudentUser, TutorMessage } from '../types';
import * as api from '../services/api';

interface Props { student: StudentUser }

export const TutorView: React.FC<Props> = ({ student }) => {
  const [messages, setMessages] = useState<TutorMessage[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ msg: string; retryable: boolean; question: string } | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inflight = useRef(false);

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [messages, busy]);

  const send = async (question: string, base: TutorMessage[]) => {
    if (inflight.current) return; // no duplicate submissions
    inflight.current = true;
    setBusy(true);
    setError(null);
    const r = await api.askTutor(student.codeUsed, student.grade, question, base);
    inflight.current = false;
    setBusy(false);
    if (r.ok) {
      setMessages([...base, { role: 'user', content: question }, { role: 'assistant', content: r.answer }].slice(-20));
    } else {
      setMessages([...base, { role: 'user', content: question }].slice(-20));
      const f = r as { error: string; retryable: boolean };
      setError({ msg: f.error, retryable: f.retryable, question });
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = text.trim();
    if (q.length < 2 || busy) return;
    setText('');
    send(q, messages);
  };

  const retry = () => {
    if (!error) return;
    // drop the unanswered question and resend it
    const base = messages.slice(0, -1);
    setMessages(base);
    send(error.question, base);
  };

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 min-h-[22rem] max-h-[32rem] overflow-y-auto space-y-3">
        {messages.length === 0 && !busy && (
          <div className="text-center text-slate-400 text-sm py-10 space-y-2">
            <Bot className="w-10 h-10 mx-auto text-amber-400" />
            <p>اسأل المدرس الذكي عن أي قانون أو مسألة فيزياء، وهيشرحلك خطوة بخطوة.</p>
            <p className="text-[11px]">الحد: 5 أسئلة في الدقيقة و40 في اليوم.</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-start' : 'justify-end'}`}>
            <div className={`max-w-[88%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
              m.role === 'user' ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-100 border border-slate-700'
            }`}>{m.content}</div>
          </div>
        ))}
        {busy && (
          <div className="flex justify-end">
            <div className="rounded-2xl px-4 py-2.5 bg-slate-800 border border-slate-700 text-slate-300 text-sm flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> المدرس الذكي بيجهز الشرح…
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {error && (
        <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs">
          <span className="flex items-center gap-2"><AlertCircle className="w-4 h-4 shrink-0" />{error.msg}</span>
          {error.retryable && (
            <button onClick={retry} disabled={busy} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 font-bold">
              <RotateCcw className="w-3.5 h-3.5" /> إعادة المحاولة
            </button>
          )}
        </div>
      )}

      <form onSubmit={submit} className="flex gap-2">
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(e); } }}
          maxLength={2500}
          rows={2}
          placeholder="اكتب سؤالك هنا…"
          className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
        />
        <div className="flex flex-col gap-1.5">
          <button type="submit" disabled={busy || text.trim().length < 2}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs disabled:opacity-50 inline-flex items-center gap-1.5">
            <Send className="w-3.5 h-3.5" /> إرسال
          </button>
          {messages.length > 0 && (
            <button type="button" onClick={() => { setMessages([]); setError(null); }}
              className="px-4 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 text-[11px] inline-flex items-center justify-center gap-1">
              <Trash2 className="w-3 h-3" /> مسح
            </button>
          )}
        </div>
      </form>
    </div>
  );
};
