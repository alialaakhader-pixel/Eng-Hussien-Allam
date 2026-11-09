import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  ArrowUpRight, ChevronLeft, ChevronRight, Circle, Download, Eraser, Grid3x3, Minus, MousePointer2, PenLine, Plus, Redo2, Square, Trash2, Triangle, Type, Undo2
} from 'lucide-react';

const W = 1600;
const H = 900;
const BG = '#0b1220';
const COLORS = ['#f8fafc', '#fbbf24', '#38bdf8', '#34d399', '#f87171', '#c084fc', '#fb923c'];
const SYMBOLS = ['²', '³', '√', 'π', 'Ω', 'Δ', 'θ', 'α', 'β', 'λ', 'μ', '×', '÷', '±', '≈', '≠', '≤', '≥', '→', '∞', '°', '⁻¹', 'ε', 'ρ', 'ω', 'Φ'];

type Kind = 'pen' | 'line' | 'rect' | 'ell' | 'tx' | 'arrow' | 'tri' | 'res' | 'bat' | 'bulb' | 'sw' | 'axes' | 'er';
type Tool = Kind | 'laser';
interface Stroke { id: string; k: Kind; c: string; w: number; p: number[][]; s?: string; pg?: number }

export interface BoardHandle {
  apply: (m: any) => void;
  chunks: () => any[];
}

const TOOLS: { k: Tool; label: string; group: 'draw' | 'shape' | 'phys' }[] = [
  { k: 'pen', label: 'قلم', group: 'draw' }, { k: 'tx', label: 'نص', group: 'draw' }, { k: 'er', label: 'ممحاة', group: 'draw' }, { k: 'laser', label: 'مؤشر', group: 'draw' },
  { k: 'line', label: 'خط', group: 'shape' }, { k: 'arrow', label: 'سهم / متجه', group: 'shape' }, { k: 'rect', label: 'مستطيل', group: 'shape' }, { k: 'ell', label: 'دائرة', group: 'shape' }, { k: 'tri', label: 'مثلث', group: 'shape' },
  { k: 'axes', label: 'محاور x-y', group: 'phys' }, { k: 'res', label: 'مقاومة', group: 'phys' }, { k: 'bat', label: 'بطارية', group: 'phys' }, { k: 'bulb', label: 'مصباح', group: 'phys' }, { k: 'sw', label: 'مفتاح', group: 'phys' }
];
const ICON: Record<string, React.ReactNode> = {
  pen: <PenLine className="w-4 h-4" />, tx: <Type className="w-4 h-4" />, er: <Eraser className="w-4 h-4" />, laser: <MousePointer2 className="w-4 h-4" />,
  line: <Minus className="w-4 h-4" />, arrow: <ArrowUpRight className="w-4 h-4" />, rect: <Square className="w-4 h-4" />, ell: <Circle className="w-4 h-4" />, tri: <Triangle className="w-4 h-4" />
};
const Txt = ({ t }: { t: string }) => <span className="text-[11px] font-black px-0.5">{t}</span>;
ICON.axes = <Txt t="x‑y" />; ICON.res = <Txt t="Ω" />; ICON.bat = <Txt t="+‑" />; ICON.bulb = <Txt t="💡" />; ICON.sw = <Txt t="/ ‑" />;

function drawSymbol(ctx: CanvasRenderingContext2D, k: Kind, a: number[], b: number[]) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const L = Math.hypot(dx, dy) || 1;
  const u = [dx / L, dy / L];
  const n = [-u[1], u[0]];
  const at = (t: number, off = 0) => [a[0] + u[0] * L * t + n[0] * off, a[1] + u[1] * L * t + n[1] * off];
  const line = (p: number[], q: number[]) => { ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); };
  ctx.beginPath();
  if (k === 'arrow') {
    line(a, b);
    const h = Math.min(40, L * 0.35);
    line(b, [b[0] - u[0] * h + n[0] * h * 0.45, b[1] - u[1] * h + n[1] * h * 0.45]);
    line(b, [b[0] - u[0] * h - n[0] * h * 0.45, b[1] - u[1] * h - n[1] * h * 0.45]);
  } else if (k === 'tri') {
    const x1 = Math.min(a[0], b[0]), x2 = Math.max(a[0], b[0]), y1 = Math.min(a[1], b[1]), y2 = Math.max(a[1], b[1]);
    ctx.moveTo(x1, y2); ctx.lineTo(x2, y2); ctx.lineTo((x1 + x2) / 2, y1); ctx.closePath();
  } else if (k === 'res') {
    line(a, at(0.2));
    const peaks = 6;
    ctx.moveTo(...(at(0.2) as [number, number]));
    for (let i = 0; i < peaks; i++) {
      const t0 = 0.2 + (0.6 * (i + 0.5)) / peaks;
      ctx.lineTo(...(at(t0, i % 2 === 0 ? -L * 0.07 : L * 0.07) as [number, number]));
    }
    ctx.lineTo(...(at(0.8) as [number, number]));
    line(at(0.8), b);
  } else if (k === 'bat') {
    line(a, at(0.42));
    line(at(0.42, -L * 0.16), at(0.42, L * 0.16));
    line(at(0.58, -L * 0.08), at(0.58, L * 0.08));
    line(at(0.58), b);
  } else if (k === 'bulb') {
    line(a, at(0.35));
    ctx.moveTo(...(at(0.65) as [number, number]));
    line(at(0.65), b);
    const c = at(0.5);
    ctx.moveTo(c[0] + L * 0.15, c[1]);
    ctx.arc(c[0], c[1], L * 0.15, 0, Math.PI * 2);
    line(at(0.5 - 0.106, -L * 0.106), at(0.5 + 0.106, L * 0.106));
    line(at(0.5 - 0.106, L * 0.106), at(0.5 + 0.106, -L * 0.106));
  } else if (k === 'sw') {
    line(a, at(0.3));
    line(at(0.3), at(0.72, -L * 0.28));
    line(at(0.75), b);
  } else if (k === 'axes') {
    const x1 = Math.min(a[0], b[0]), x2 = Math.max(a[0], b[0]), y1 = Math.min(a[1], b[1]), y2 = Math.max(a[1], b[1]);
    line([x1, y2], [x2, y2]);
    line([x1, y2], [x1, y1]);
    line([x2, y2], [x2 - 14, y2 - 8]); line([x2, y2], [x2 - 14, y2 + 8]);
    line([x1, y1], [x1 - 8, y1 + 14]); line([x1, y1], [x1 + 8, y1 + 14]);
  }
  ctx.stroke();
}

function paintStrokes(ctx: CanvasRenderingContext2D, strokes: Stroke[]) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const s of strokes) {
    if (!s.p.length) continue;
    ctx.globalCompositeOperation = s.k === 'er' ? 'destination-out' : 'source-over';
    ctx.strokeStyle = s.k === 'er' ? '#000' : s.c;
    ctx.fillStyle = s.c;
    ctx.lineWidth = s.k === 'er' ? s.w * 8 : s.w * 2;
    const P = s.p.map(([x, y]) => [x * W, y * H]);
    if (s.k === 'pen' || s.k === 'er') {
      ctx.beginPath();
      ctx.moveTo(P[0][0], P[0][1]);
      if (P.length === 1) ctx.lineTo(P[0][0] + 0.1, P[0][1]);
      for (let i = 1; i < P.length - 1; i++) {
        const mx = (P[i][0] + P[i + 1][0]) / 2;
        const my = (P[i][1] + P[i + 1][1]) / 2;
        ctx.quadraticCurveTo(P[i][0], P[i][1], mx, my);
      }
      if (P.length > 1) ctx.lineTo(P[P.length - 1][0], P[P.length - 1][1]);
      ctx.stroke();
    } else if (s.k === 'tx') {
      ctx.font = `${s.w * 8 + 18}px "Segoe UI", Tahoma, sans-serif`;
      ctx.textBaseline = 'top';
      s.s?.split('\n').forEach((ln, i) => ctx.fillText(ln, P[0][0], P[0][1] + i * (s.w * 8 + 24)));
    } else if (P.length >= 2) {
      const a = P[0];
      const b = P[P.length - 1];
      if (s.k === 'line') { ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
      else if (s.k === 'rect') { ctx.beginPath(); ctx.rect(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])); ctx.stroke(); }
      else if (s.k === 'ell') { ctx.beginPath(); ctx.ellipse((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.abs(b[0] - a[0]) / 2 || 1, Math.abs(b[1] - a[1]) / 2 || 1, 0, 0, Math.PI * 2); ctx.stroke(); }
      else drawSymbol(ctx, s.k, a, b);
    }
  }
  ctx.globalCompositeOperation = 'source-over';
}

const r3 = (n: number) => Math.round(n * 1000) / 1000;

export const LiveWhiteboard = forwardRef<BoardHandle, { canDraw: boolean; send?: (m: any) => void }>(({ canDraw, send }, ref) => {
  const cv = useRef<HTMLCanvasElement>(null);
  const layer = useRef<HTMLCanvasElement | null>(null);
  const pages = useRef<Stroke[][]>([[]]);
  const redo = useRef<Stroke[][]>([[]]);
  const [page, setPageState] = useState(0);
  const pageRef = useRef(0);
  const [pageCount, setPageCount] = useState(1);
  const [grid, setGridState] = useState(false);
  const gridRef = useRef(false);
  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState(COLORS[0]);
  const [width, setWidth] = useState(3);
  const [textAt, setTextAt] = useState<{ x: number; y: number } | null>(null);
  const [textVal, setTextVal] = useState('');
  const cur = useRef<Stroke | null>(null);
  const lastSent = useRef(0);
  const lastLaser = useRef(0);
  const pending = useRef<number[][]>([]);
  const laser = useRef<{ x: number; y: number; t: number } | null>(null);
  const laserTimer = useRef<any>(null);
  const [, force] = useState(0);

  const redraw = useCallback(() => {
    const c = cv.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    if (!layer.current) { layer.current = document.createElement('canvas'); layer.current.width = W; layer.current.height = H; }
    const lctx = layer.current.getContext('2d')!;
    lctx.clearRect(0, 0, W, H);
    const list = pages.current[pageRef.current] || [];
    paintStrokes(lctx, cur.current ? [...list.filter(s => s.id !== cur.current!.id), cur.current] : list);
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);
    if (gridRef.current) {
      ctx.strokeStyle = 'rgba(148,163,184,0.16)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x <= W; x += 100) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
      for (let y = 0; y <= H; y += 100) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
      ctx.stroke();
    }
    ctx.drawImage(layer.current, 0, 0);
    const l = laser.current;
    if (l && Date.now() - l.t < 1200) {
      const g = ctx.createRadialGradient(l.x * W, l.y * H, 2, l.x * W, l.y * H, 26);
      g.addColorStop(0, 'rgba(255,60,60,1)'); g.addColorStop(1, 'rgba(255,60,60,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(l.x * W, l.y * H, 26, 0, Math.PI * 2); ctx.fill();
    }
  }, []);
  useEffect(() => { redraw(); }, [redraw]);

  const ensure = (pg: number) => { while (pages.current.length <= pg) { pages.current.push([]); redo.current.push([]); } setPageCount(pages.current.length); };
  const gotoPage = (i: number) => { ensure(i); pageRef.current = i; setPageState(i); redraw(); };
  const setGrid = (on: boolean) => { gridRef.current = on; setGridState(on); redraw(); };

  useImperativeHandle(ref, () => ({
    apply: (m: any) => {
      const pg = m.pg ?? 0;
      if (m.t === 'clr') { ensure(pg); pages.current[pg] = []; }
      else if (m.t === 'seg') {
        ensure(pg);
        let s = pages.current[pg].find(x => x.id === m.id);
        if (!s) { s = { id: m.id, k: m.k, c: m.c, w: m.w, p: [], s: m.s, pg }; pages.current[pg].push(s); }
        if (m.set) s.p = m.p; else s.p.push(...m.p);
      } else if (m.t === 'undo') { ensure(pg); pages.current[pg].pop(); }
      else if (m.t === 'snap') {
        if (m.part === 0) { pages.current = [[]]; redo.current = [[]]; }
        ensure(pg);
        pages.current[pg].push(...m.strokes);
      } else if (m.t === 'page') gotoPage(m.i);
      else if (m.t === 'grid') setGrid(!!m.on);
      else if (m.t === 'laser') {
        laser.current = { x: m.x, y: m.y, t: Date.now() };
        clearTimeout(laserTimer.current);
        laserTimer.current = setTimeout(() => { laser.current = null; redraw(); }, 1300);
      }
      redraw();
    },
    chunks: () => {
      const out: any[] = [];
      let part = 0;
      pages.current.forEach((list, pg) => {
        let group: Stroke[] = [];
        let size = 0;
        const flush = () => { out.push({ t: 'snap', part: part++, pg, strokes: group }); group = []; size = 0; };
        for (const s of list) {
          const l = JSON.stringify(s).length;
          if (size + l > 9000 && group.length) flush();
          group.push(s); size += l;
        }
        if (group.length || pg === 0) flush();
      });
      out.push({ t: 'grid', on: gridRef.current });
      out.push({ t: 'page', i: pageRef.current });
      return out;
    }
  }), [redraw]);

  const pos = (e: React.PointerEvent) => {
    const r = cv.current!.getBoundingClientRect();
    return [r3(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))), r3(Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)))];
  };
  const flush = (s: Stroke, force: boolean) => {
    const now = Date.now();
    if (!send || (!force && now - lastSent.current < 70) || !pending.current.length) return;
    lastSent.current = now;
    send({ t: 'seg', id: s.id, k: s.k, c: s.c, w: s.w, p: pending.current, pg: pageRef.current });
    pending.current = [];
  };
  const commit = (s: Stroke) => {
    pages.current[pageRef.current].push(s);
    redo.current[pageRef.current] = [];
    force(x => x + 1);
  };

  const down = (e: React.PointerEvent) => {
    if (!canDraw) return;
    e.preventDefault();
    const p = pos(e);
    if (tool === 'laser') { laser.current = { x: p[0], y: p[1], t: Date.now() }; send?.({ t: 'laser', x: p[0], y: p[1] }); (e.target as HTMLElement).setPointerCapture?.(e.pointerId); cur.current = { id: 'laser', k: 'pen', c: '', w: 0, p: [] }; redraw(); return; }
    const id = Math.random().toString(36).slice(2, 10);
    if (tool === 'tx') { setTextAt({ x: p[0], y: p[1] }); setTextVal(''); return; }
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    cur.current = { id, k: tool as Kind, c: color, w: width, p: [p] };
    pending.current = [p];
    if (tool === 'pen' || tool === 'er') flush(cur.current, true);
    redraw();
  };
  const move = (e: React.PointerEvent) => {
    const s = cur.current;
    if (!s) return;
    const p = pos(e);
    if (s.id === 'laser') {
      laser.current = { x: p[0], y: p[1], t: Date.now() };
      const now = Date.now();
      if (now - lastLaser.current > 40) { lastLaser.current = now; send?.({ t: 'laser', x: p[0], y: p[1] }); }
      redraw();
      return;
    }
    if (s.k === 'pen' || s.k === 'er') { s.p.push(p); pending.current.push(p); flush(s, false); }
    else s.p = [s.p[0], p];
    redraw();
  };
  const up = () => {
    const s = cur.current;
    if (!s) return;
    cur.current = null;
    if (s.id === 'laser') { laserTimerClear(); return; }
    if (s.k === 'pen' || s.k === 'er') flush(s, true);
    else send?.({ t: 'seg', id: s.id, k: s.k, c: s.c, w: s.w, p: s.p, set: true, pg: pageRef.current });
    commit(s);
    pending.current = [];
    redraw();
  };
  const laserTimerClear = () => { clearTimeout(laserTimer.current); laserTimer.current = setTimeout(() => { laser.current = null; redraw(); }, 900); };

  const addText = () => {
    const t = textVal.trim();
    if (t && textAt) {
      const s: Stroke = { id: Math.random().toString(36).slice(2, 10), k: 'tx', c: color, w: width, p: [[textAt.x, textAt.y]], s: t.slice(0, 300) };
      send?.({ t: 'seg', id: s.id, k: 'tx', c: color, w: width, p: s.p, s: s.s, set: true, pg: pageRef.current });
      commit(s);
      redraw();
    }
    setTextAt(null); setTextVal('');
  };

  const undo = () => {
    const l = pages.current[pageRef.current];
    const s = l.pop();
    if (!s) return;
    redo.current[pageRef.current].push(s);
    send?.({ t: 'undo', pg: pageRef.current });
    redraw(); force(x => x + 1);
  };
  const redoIt = () => {
    const s = redo.current[pageRef.current].pop();
    if (!s) return;
    pages.current[pageRef.current].push(s);
    send?.({ t: 'seg', id: s.id, k: s.k, c: s.c, w: s.w, p: s.p, s: s.s, set: true, pg: pageRef.current });
    redraw(); force(x => x + 1);
  };
  const clear = () => {
    if (!confirm('مسح الصفحة الحالية من السبورة؟')) return;
    pages.current[pageRef.current] = []; redo.current[pageRef.current] = [];
    send?.({ t: 'clr', pg: pageRef.current });
    redraw(); force(x => x + 1);
  };
  const flip = (i: number) => {
    if (i < 0) return;
    gotoPage(i);
    send?.({ t: 'page', i });
  };
  const toggleGrid = () => { const v = !gridRef.current; setGrid(v); send?.({ t: 'grid', on: v }); };
  const save = () => {
    const a = document.createElement('a');
    a.download = `سبورة-صفحة${pageRef.current + 1}-${new Date().toISOString().slice(0, 16)}.png`;
    a.href = cv.current!.toDataURL('image/png');
    a.click();
  };

  const Tb: React.FC<{ k: Tool; label: string }> = ({ k, label }) => (
    <button key={k} title={label} aria-label={label} onClick={() => setTool(k)} className={`min-w-9 h-9 px-1.5 flex items-center justify-center rounded-lg ${tool === k ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'}`}>{ICON[k]}</button>
  );
  const Sep = () => <span className="w-px h-6 bg-slate-700 mx-0.5" />;
  const list = pages.current[page] || [];

  return (
    <div className="w-full h-full flex flex-col bg-slate-950">
      {canDraw && (
        <div className="flex flex-wrap items-center gap-1 p-1.5 bg-slate-900 border-b border-slate-800">
          {TOOLS.filter(t => t.group === 'draw').map(t => <Tb key={t.k} k={t.k} label={t.label} />)}<Sep />
          {TOOLS.filter(t => t.group === 'shape').map(t => <Tb key={t.k} k={t.k} label={t.label} />)}<Sep />
          {TOOLS.filter(t => t.group === 'phys').map(t => <Tb key={t.k} k={t.k} label={t.label} />)}<Sep />
          {COLORS.map(c => (
            <button key={c} onClick={() => { setColor(c); if (tool === 'er' || tool === 'laser') setTool('pen'); }} style={{ background: c }} className={`w-6 h-6 rounded-full border-2 ${color === c ? 'border-white' : 'border-transparent'}`} aria-label="لون" />
          ))}
          <input type="range" min={1} max={12} value={width} onChange={e => setWidth(+e.target.value)} className="w-16 accent-amber-500" aria-label="سمك" />
          <Sep />
          <button onClick={undo} disabled={!list.length} title="تراجع" className="h-9 w-9 flex items-center justify-center rounded-lg bg-slate-800 text-slate-200 disabled:opacity-40"><Undo2 className="w-4 h-4" /></button>
          <button onClick={redoIt} disabled={!redo.current[page]?.length} title="إعادة" className="h-9 w-9 flex items-center justify-center rounded-lg bg-slate-800 text-slate-200 disabled:opacity-40"><Redo2 className="w-4 h-4" /></button>
          <button onClick={toggleGrid} title="شبكة" className={`h-9 w-9 flex items-center justify-center rounded-lg ${grid ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-200'}`}><Grid3x3 className="w-4 h-4" /></button>
          <Sep />
          <button onClick={() => flip(page - 1)} disabled={page === 0} title="الصفحة السابقة" className="h-9 w-8 flex items-center justify-center rounded-lg bg-slate-800 text-slate-200 disabled:opacity-40"><ChevronRight className="w-4 h-4" /></button>
          <span className="text-xs text-slate-300 tabular-nums px-0.5">{page + 1}/{pageCount}</span>
          <button onClick={() => flip(page + 1)} disabled={page + 1 >= pageCount} title="الصفحة التالية" className="h-9 w-8 flex items-center justify-center rounded-lg bg-slate-800 text-slate-200 disabled:opacity-40"><ChevronLeft className="w-4 h-4" /></button>
          <button onClick={() => { ensure(pages.current.length); flip(pages.current.length - 1); }} title="صفحة جديدة" className="h-9 w-9 flex items-center justify-center rounded-lg bg-slate-800 text-emerald-300"><Plus className="w-4 h-4" /></button>
          <span className="flex-1" />
          <button onClick={save} title="حفظ الصفحة كصورة" className="h-9 w-9 flex items-center justify-center rounded-lg bg-slate-800 text-slate-200"><Download className="w-4 h-4" /></button>
          <button onClick={clear} title="مسح الصفحة" className="h-9 w-9 flex items-center justify-center rounded-lg bg-red-500/20 text-red-300"><Trash2 className="w-4 h-4" /></button>
        </div>
      )}
      {!canDraw && pageCount > 1 && <div className="text-center text-[11px] text-slate-500 py-0.5">صفحة {page + 1} من {pageCount}</div>}
      <div className="flex-1 min-h-0 flex items-center justify-center p-1">
        <div className="relative w-full max-h-full" style={{ aspectRatio: '16 / 9' }}>
          <canvas
            ref={cv}
            width={W}
            height={H}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
            style={{ touchAction: canDraw ? 'none' : 'auto' }}
            className="absolute inset-0 w-full h-full rounded-lg bg-[#0b1220] shadow-lg"
          />
          {textAt && canDraw && (
            <div className="absolute z-10 bg-slate-900/95 border border-amber-500/50 rounded-lg p-1.5 space-y-1 w-64 max-w-[80%]" style={{ left: `${Math.min(textAt.x * 100, 55)}%`, top: `${Math.min(textAt.y * 100, 60)}%` }} dir="rtl">
              <textarea autoFocus value={textVal} onChange={e => setTextVal(e.target.value)} rows={2} placeholder="اكتب النص أو المعادلة (F = m × a)" className="w-full bg-slate-800 rounded px-2 py-1 text-sm text-white" dir="auto" />
              <div className="flex flex-wrap gap-0.5">
                {SYMBOLS.map(s => <button key={s} type="button" onClick={() => setTextVal(v => v + s)} className="w-6 h-6 text-xs rounded bg-slate-700 text-white hover:bg-slate-600">{s}</button>)}
              </div>
              <div className="flex gap-1">
                <button onClick={addText} className="px-3 py-1 rounded bg-amber-500 text-slate-950 text-xs font-black">إضافة</button>
                <button onClick={() => { setTextAt(null); setTextVal(''); }} className="px-3 py-1 rounded bg-slate-700 text-white text-xs">إلغاء</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
LiveWhiteboard.displayName = 'LiveWhiteboard';
