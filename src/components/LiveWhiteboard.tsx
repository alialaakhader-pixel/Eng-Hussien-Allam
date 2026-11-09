import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Circle, Download, Eraser, Minus, PenLine, Square, Trash2, Type } from 'lucide-react';

const W = 1600;
const H = 900;
const BG = '#0b1220';
const COLORS = ['#f8fafc', '#fbbf24', '#38bdf8', '#34d399', '#f87171', '#c084fc'];

type Kind = 'pen' | 'line' | 'rect' | 'ell' | 'tx';
interface Stroke { id: string; k: Kind; c: string; w: number; p: number[][]; s?: string }

export interface BoardHandle {
  apply: (m: any) => void;
  chunks: () => any[];
}

function paint(ctx: CanvasRenderingContext2D, strokes: Stroke[]) {
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const s of strokes) {
    if (!s.p.length) continue;
    ctx.strokeStyle = s.c;
    ctx.fillStyle = s.c;
    ctx.lineWidth = s.w * 2;
    const P = s.p.map(([x, y]) => [x * W, y * H]);
    if (s.k === 'pen') {
      ctx.beginPath();
      ctx.moveTo(P[0][0], P[0][1]);
      if (P.length === 1) ctx.lineTo(P[0][0] + 0.1, P[0][1]);
      for (let i = 1; i < P.length; i++) ctx.lineTo(P[i][0], P[i][1]);
      ctx.stroke();
    } else if (s.k === 'tx') {
      ctx.font = `${s.w * 8 + 18}px sans-serif`;
      ctx.textBaseline = 'top';
      ctx.fillText(s.s || '', P[0][0], P[0][1]);
    } else if (P.length >= 2) {
      const a = P[0];
      const b = P[P.length - 1];
      ctx.beginPath();
      if (s.k === 'line') { ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
      else if (s.k === 'rect') ctx.rect(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]));
      else ctx.ellipse((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.abs(b[0] - a[0]) / 2 || 1, Math.abs(b[1] - a[1]) / 2 || 1, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

const r3 = (n: number) => Math.round(n * 1000) / 1000;

export const LiveWhiteboard = forwardRef<BoardHandle, { canDraw: boolean; send?: (m: any) => void }>(({ canDraw, send }, ref) => {
  const cv = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Stroke[]>([]);
  const [tool, setTool] = useState<Kind | 'eraser'>('pen');
  const [color, setColor] = useState(COLORS[0]);
  const [width, setWidth] = useState(3);
  const cur = useRef<Stroke | null>(null);
  const lastSent = useRef(0);
  const pendingPts = useRef<number[][]>([]);

  const redraw = useCallback(() => {
    const c = cv.current;
    const ctx = c?.getContext('2d');
    if (ctx) paint(ctx, cur.current ? [...strokes.current.filter(s => s.id !== cur.current!.id), cur.current] : strokes.current);
  }, []);
  useEffect(() => { redraw(); }, [redraw]);

  useImperativeHandle(ref, () => ({
    apply: (m: any) => {
      if (m.t === 'clr') strokes.current = [];
      else if (m.t === 'seg') {
        let s = strokes.current.find(x => x.id === m.id);
        if (!s) { s = { id: m.id, k: m.k, c: m.c, w: m.w, p: [], s: m.s }; strokes.current.push(s); }
        if (m.set) s.p = m.p; else s.p.push(...m.p);
      } else if (m.t === 'snap') {
        if (m.part === 0) strokes.current = [];
        strokes.current.push(...m.strokes);
      }
      redraw();
    },
    chunks: () => {
      const out: any[] = [];
      let group: Stroke[] = [];
      let size = 0;
      for (const s of strokes.current) {
        const l = JSON.stringify(s).length;
        if (size + l > 9000 && group.length) { out.push(group); group = []; size = 0; }
        group.push(s); size += l;
      }
      out.push(group);
      return out.map((g, i) => ({ t: 'snap', part: i, strokes: g }));
    }
  }), [redraw]);

  const pos = (e: React.PointerEvent) => {
    const r = cv.current!.getBoundingClientRect();
    return [r3(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))), r3(Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)))];
  };
  const flush = (s: Stroke, force: boolean) => {
    const now = Date.now();
    if (!send || (!force && now - lastSent.current < 70) || !pendingPts.current.length) return;
    lastSent.current = now;
    send({ t: 'seg', id: s.id, k: s.k, c: s.c, w: s.w, p: pendingPts.current });
    pendingPts.current = [];
  };

  const down = (e: React.PointerEvent) => {
    if (!canDraw) return;
    e.preventDefault();
    const p = pos(e);
    const id = Math.random().toString(36).slice(2, 10);
    if (tool === 'tx') {
      const text = window.prompt('اكتب النص / المعادلة (مثال: F = m × a)');
      if (!text) return;
      const s: Stroke = { id, k: 'tx', c: color, w: width, p: [p], s: text.slice(0, 200) };
      strokes.current.push(s);
      send?.({ t: 'seg', id, k: 'tx', c: color, w: width, p: [p], s: s.s, set: true });
      redraw();
      return;
    }
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    cur.current = { id, k: tool === 'eraser' ? 'pen' : tool, c: tool === 'eraser' ? BG : color, w: tool === 'eraser' ? width * 4 : width, p: [p] };
    pendingPts.current = [p];
    flush(cur.current, true);
    redraw();
  };
  const move = (e: React.PointerEvent) => {
    const s = cur.current;
    if (!s) return;
    const p = pos(e);
    if (s.k === 'pen') { s.p.push(p); pendingPts.current.push(p); flush(s, false); }
    else s.p = [s.p[0], p];
    redraw();
  };
  const up = () => {
    const s = cur.current;
    if (!s) return;
    if (s.k === 'pen') flush(s, true);
    else send?.({ t: 'seg', id: s.id, k: s.k, c: s.c, w: s.w, p: s.p, set: true });
    strokes.current.push(s);
    cur.current = null;
    pendingPts.current = [];
    redraw();
  };

  const clear = () => { strokes.current = []; send?.({ t: 'clr' }); redraw(); };
  const save = () => {
    const a = document.createElement('a');
    a.download = `سبورة-${new Date().toISOString().slice(0, 16)}.png`;
    a.href = cv.current!.toDataURL('image/png');
    a.click();
  };

  const T = (k: Kind | 'eraser', icon: React.ReactNode, label: string) => (
    <button key={k} title={label} onClick={() => setTool(k)} className={`p-2 rounded-lg ${tool === k ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'}`}>{icon}</button>
  );

  return (
    <div className="w-full h-full flex flex-col bg-slate-950">
      {canDraw && (
        <div className="flex flex-wrap items-center gap-1.5 p-2 bg-slate-900 border-b border-slate-800">
          {T('pen', <PenLine className="w-4 h-4" />, 'قلم')}
          {T('line', <Minus className="w-4 h-4" />, 'خط مستقيم')}
          {T('rect', <Square className="w-4 h-4" />, 'مستطيل')}
          {T('ell', <Circle className="w-4 h-4" />, 'دائرة / شكل بيضاوي')}
          {T('tx', <Type className="w-4 h-4" />, 'نص ومعادلة')}
          {T('eraser', <Eraser className="w-4 h-4" />, 'ممحاة')}
          <span className="w-px h-6 bg-slate-700 mx-1" />
          {COLORS.map(c => (
            <button key={c} onClick={() => { setColor(c); if (tool === 'eraser') setTool('pen'); }} style={{ background: c }} className={`w-6 h-6 rounded-full border-2 ${color === c ? 'border-white' : 'border-transparent'}`} aria-label="لون" />
          ))}
          <input type="range" min={1} max={12} value={width} onChange={e => setWidth(+e.target.value)} className="w-20 accent-amber-500" aria-label="سمك" />
          <span className="flex-1" />
          <button onClick={save} title="حفظ كصورة" className="p-2 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700"><Download className="w-4 h-4" /></button>
          <button onClick={clear} title="مسح السبورة" className="p-2 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30"><Trash2 className="w-4 h-4" /></button>
        </div>
      )}
      <div className="flex-1 min-h-0 flex items-center justify-center p-1">
        <canvas
          ref={cv}
          width={W}
          height={H}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          style={{ touchAction: canDraw ? 'none' : 'auto', aspectRatio: '16 / 9' }}
          className="max-w-full max-h-full w-full object-contain rounded-lg bg-[#0b1220] shadow-lg"
        />
      </div>
    </div>
  );
});
LiveWhiteboard.displayName = 'LiveWhiteboard';
