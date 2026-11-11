import React, { useEffect, useRef, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';

export interface PosterPlan {
  name: string; price: number; durationDays: number; grade: string | null; includesAi?: boolean;
  lessonCount?: number; examCount?: number;
}

const GRADE_LABEL: Record<string, string> = {
  '1ث': 'الصف الأول الثانوي', '2ث': 'الصف الثاني الثانوي', '3ث': 'الصف الثالث الثانوي', 'بكالوريا': 'البكالوريا'
};
const CUT = '/teacher-cutout.webp';
const DISPLAY = '"Lalezar","Cairo","Tajawal","Segoe UI",Tahoma,Arial,sans-serif';
const FONT = '"Cairo","Tajawal","Segoe UI",Tahoma,Arial,sans-serif';
const ar = (n: number) => n.toLocaleString('en-US');

let photoPromise: Promise<HTMLImageElement | null> | null = null;
const loadPhoto = () => {
  if (!photoPromise) {
    photoPromise = new Promise(res => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => res(null);
      i.src = CUT;
    });
  }
  return photoPromise;
};

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const W = 1080, H = 1350;
type Ctx = CanvasRenderingContext2D;

function cover(ctx: Ctx, img: HTMLImageElement | null, x: number, y: number, w: number, h: number, focusY = 0.38) {
  if (!img) { ctx.fillStyle = '#1e293b'; ctx.fillRect(x, y, w, h); return; }
  const s = Math.max(w / img.width, h / img.height);
  const iw = img.width * s, ih = img.height * s;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) * focusY, iw, ih);
}
function fitText(ctx: Ctx, text: string, maxW: number, size: number, weight = 900, min = 28) {
  let fs = size; ctx.font = `${weight} ${fs}px ${FONT}`;
  while (ctx.measureText(text).width > maxW && fs > min) { fs -= 3; ctx.font = `${weight} ${fs}px ${FONT}`; }
  return fs;
}
function bolt(ctx: Ctx, x: number, y: number, len: number, color: string, seed: number) {
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.shadowColor = color; ctx.shadowBlur = 18; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(x, y);
  let cx = x, cy = y;
  for (let i = 0; i < 7; i++) { cx += ((Math.sin(seed * 7.3 + i * 2.1) * 36)); cy += len / 7; ctx.lineTo(cx, cy); }
  ctx.stroke(); ctx.restore();
}
const gradeText = (plan: PosterPlan) => (plan.grade ? GRADE_LABEL[plan.grade] || plan.grade : 'كل الصفوف');
const priceText = (plan: PosterPlan) => (plan.price > 0 ? `${ar(plan.price)} ج.م` : 'مجاناً');
const featText = (plan: PosterPlan) => {
  const f: string[] = [];
  if (plan.lessonCount) f.push(`${ar(plan.lessonCount)} محاضرة`);
  if (plan.examCount) f.push(`${ar(plan.examCount)} امتحان`);
  if (plan.includesAi) f.push('المدرس الذكي');
  return f.join('  ·  ');
};

export type PosterTemplate = 'workshop' | 'engineer' | 'neon' | 'fire' | 'clean';
export const POSTER_TEMPLATES: { id: PosterTemplate; label: string }[] = [
  { id: 'workshop', label: 'ورشة ذهبية' }, { id: 'engineer', label: 'مهندس داكن' }, { id: 'neon', label: 'نيون تقني' },
  { id: 'fire', label: 'طاقة وشرر' }, { id: 'clean', label: 'أزرق عصري' }
];
export const templateFor = (seed: string): PosterTemplate => {
  let h = 0; for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return POSTER_TEMPLATES[h % POSTER_TEMPLATES.length].id;
};

const gradeShort = (plan: PosterPlan): string[] => {
  const m: Record<string, string[]> = { '1ث': ['أولى', 'ثانوي'], '2ث': ['تانية', 'ثانوي'], '3ث': ['تالتة', 'ثانوي'], 'بكالوريا': ['بكالوريا', 'فيزياء'] };
  return (plan.grade && m[plan.grade]) || ['ثانوية', 'عامة'];
};

// The cut-out photo is 1024x1024 with the person occupying x 0..761 (centre ~0.37h) and reaching the bottom edge.
function person(ctx: Ctx, img: HTMLImageElement | null, cx: number, bottom: number, h: number, alpha = 1) {
  if (!img) return;
  ctx.save(); ctx.globalAlpha = alpha; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, cx - 0.372 * h, bottom - h, h, h);
  ctx.restore();
}
function glowSpot(ctx: Ctx, x: number, y: number, r: number, color: string) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
}
function display(ctx: Ctx, text: string, x: number, y: number, maxW: number, size: number, fill: string | CanvasGradient, opt: { stroke?: string; sw?: number; shadow?: string; blur?: number; min?: number } = {}) {
  let fs = size; ctx.font = `400 ${fs}px ${DISPLAY}`;
  while (ctx.measureText(text).width > maxW && fs > (opt.min ?? 30)) { fs -= 3; ctx.font = `400 ${fs}px ${DISPLAY}`; }
  ctx.save();
  if (opt.shadow) { ctx.shadowColor = opt.shadow; ctx.shadowBlur = opt.blur ?? 20; }
  if (opt.stroke) { ctx.lineJoin = 'round'; ctx.lineWidth = opt.sw ?? 10; ctx.strokeStyle = opt.stroke; ctx.strokeText(text, x, y); }
  ctx.fillStyle = fill; ctx.fillText(text, x, y); ctx.restore();
  return fs;
}
// 3D-looking headline: stacked offset copies, then a white face with a thin outline.
function extruded(ctx: Ctx, text: string, x: number, y: number, maxW: number, size: number, face: string, side: string, depth = 12, min = 40) {
  let fs = size; ctx.font = `400 ${fs}px ${DISPLAY}`;
  while (ctx.measureText(text).width > maxW && fs > min) { fs -= 4; ctx.font = `400 ${fs}px ${DISPLAY}`; }
  ctx.save(); ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 28; ctx.shadowOffsetY = 14;
  ctx.fillStyle = side; ctx.strokeStyle = side; ctx.lineWidth = 14;
  for (let i = depth; i >= 1; i--) { ctx.strokeText(text, x + i * 0.7, y + i); ctx.fillText(text, x + i * 0.7, y + i); }
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  ctx.strokeStyle = side; ctx.lineWidth = 10; ctx.strokeText(text, x, y);
  ctx.fillStyle = face; ctx.fillText(text, x, y); ctx.restore();
  return fs;
}
function pill(ctx: Ctx, x: number, y: number, w: number, h: number, fill: string | CanvasGradient, stroke?: string) {
  rr(ctx, x, y, w, h, h / 2); ctx.fillStyle = fill; ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 3; ctx.stroke(); }
}

// ---------- 1) Workshop: purple/amber garage, golden cable swirl, yellow price badge, white brand card ----------
function drawWorkshop(ctx: Ctx, plan: PosterPlan, img: HTMLImageElement | null) {
  const bg = ctx.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#220a52'); bg.addColorStop(0.5, '#5b21b6'); bg.addColorStop(1, '#c2410c');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(255,255,255,0.075)';
  for (let y = 40; y < 1150; y += 56) for (let x = 28; x < W; x += 56) { ctx.beginPath(); ctx.arc(x, y, 3.2, 0, Math.PI * 2); ctx.fill(); }
  const strip = (x: number, y: number, w: number, c: string) => { ctx.save(); ctx.shadowColor = c; ctx.shadowBlur = 40; ctx.fillStyle = c; rr(ctx, x, y, w, 14, 7); ctx.fill(); ctx.restore(); };
  strip(-30, 300, 520, '#fff'); strip(620, 340, 520, '#fde68a');
  glowSpot(ctx, 540, 760, 620, 'rgba(250,204,21,0.38)');
  const swirl = (front: boolean) => {
    ctx.save();
    [[-0.34, 0], [0.34, 1]].forEach(([rot]) => {
      ctx.save(); ctx.translate(540, 800); ctx.rotate(rot as number);
      const g = ctx.createLinearGradient(-620, 0, 620, 0); g.addColorStop(0, '#b45309'); g.addColorStop(0.35, '#fde68a'); g.addColorStop(0.7, '#f59e0b'); g.addColorStop(1, '#fef3c7');
      const a0 = front ? 0 : Math.PI, a1 = front ? Math.PI : Math.PI * 2;
      ctx.beginPath(); ctx.ellipse(0, 0, 590, 215, 0, a0, a1);
      ctx.shadowColor = 'rgba(251,191,36,0.9)'; ctx.shadowBlur = 34; ctx.strokeStyle = g; ctx.lineWidth = 40; ctx.lineCap = 'round'; ctx.stroke();
      ctx.shadowBlur = 0; ctx.beginPath(); ctx.ellipse(0, -8, 590, 215, 0, a0, a1); ctx.strokeStyle = 'rgba(255,255,255,0.65)'; ctx.lineWidth = 6; ctx.stroke();
      ctx.restore();
    });
    ctx.restore();
  };
  swirl(false);
  person(ctx, img, 548, 1195, 930);
  swirl(true);
  // top texts
  ctx.font = `900 38px ${FONT}`;
  const gt = gradeText(plan); const gw = Math.min(ctx.measureText(gt).width + 100, W - 140);
  pill(ctx, W / 2 - gw / 2, 54, gw, 72, '#facc15'); ctx.fillStyle = '#1c1303'; ctx.fillText(gt, W / 2, 105);
  display(ctx, plan.name, W / 2, 232, W - 120, 104, '#ffffff', { stroke: '#2e1065', sw: 14, shadow: 'rgba(0,0,0,0.5)', blur: 24, min: 46 });
  // price badge
  ctx.save(); ctx.translate(850, 600); ctx.rotate(-0.09);
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 12;
  rr(ctx, -190, -105, 380, 215, 30); const pg = ctx.createLinearGradient(0, -105, 0, 110); pg.addColorStop(0, '#fde047'); pg.addColorStop(1, '#f59e0b'); ctx.fillStyle = pg; ctx.fill();
  ctx.shadowColor = 'transparent'; ctx.fillStyle = '#1c1303'; ctx.font = `900 38px ${FONT}`; ctx.fillText('بسعر', 0, -48);
  display(ctx, priceText(plan), 0, 66, 340, 118, '#1c1303', { min: 50 });
  ctx.restore();
  // duration chip
  ctx.save(); ctx.translate(200, 640); ctx.rotate(0.06);
  rr(ctx, -150, -62, 300, 124, 26); ctx.fillStyle = 'rgba(15,10,40,0.72)'; ctx.fill(); ctx.strokeStyle = 'rgba(250,204,21,0.8)'; ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = '#fde68a'; ctx.font = `800 28px ${FONT}`; ctx.fillText('مدة الاشتراك', 0, -10);
  ctx.fillStyle = '#fff'; ctx.font = `900 46px ${FONT}`; ctx.fillText(`${ar(plan.durationDays)} يوم`, 0, 42);
  ctx.restore();
  // bottom card
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 40; ctx.fillStyle = '#ffffff'; rr(ctx, 50, 1190, W - 100, 230, 60); ctx.fill(); ctx.restore();
  ctx.fillStyle = '#1e1b4b'; ctx.font = `900 42px ${FONT}`; ctx.fillText('م. حسين علام', 250, 1262);
  ctx.fillStyle = '#b45309'; ctx.font = `italic 700 38px Georgia, "Times New Roman", serif`; ctx.fillText('Physics', 250, 1312);
  const cta = ctx.createLinearGradient(0, 0, W, 0); cta.addColorStop(0, '#f59e0b'); cta.addColorStop(1, '#fde047');
  pill(ctx, 410, 1228, 260, 78, cta); ctx.fillStyle = '#1c1303'; ctx.font = `900 34px ${FONT}`; ctx.fillText('اشترك الآن', 540, 1279);
  const ft = featText(plan);
  ctx.fillStyle = '#334155'; ctx.font = `800 28px ${FONT}`; ctx.fillText('متاح حالياً على منصتنا', 830, 1262);
  if (ft) { ctx.fillStyle = '#64748b'; fitText(ctx, ft, 300, 25, 700, 18); ctx.fillText(ft, 830, 1306); }
}

// ---------- 2) Engineer: dark navy with orange rim light, big 3D grade headline (like the teacher's own ad) ----------
function drawEngineer(ctx: Ctx, plan: PosterPlan, img: HTMLImageElement | null) {
  const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#050816'); bg.addColorStop(0.55, '#0b1230'); bg.addColorStop(1, '#04060f');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  glowSpot(ctx, 220, 1050, 760, 'rgba(249,115,22,0.42)'); glowSpot(ctx, 880, 260, 520, 'rgba(59,130,246,0.22)');
  person(ctx, img, 830, 900, 900, 0.1);   // ghost copy behind the headline
  person(ctx, img, 300, H, 1130);
  const [l1, l2] = gradeShort(plan);
  extruded(ctx, l1, 810, 330, 440, 170, '#ffffff', '#ea580c', 12);
  extruded(ctx, l2, 810, 505, 440, 160, '#ffffff', '#ea580c', 12);
  display(ctx, 'فيزياء', 810, 640, 300, 74, '#fb923c', { stroke: '#7c2d12', sw: 10, shadow: 'rgba(249,115,22,0.8)', blur: 24 });
  ctx.strokeStyle = 'rgba(251,146,60,0.8)'; ctx.lineWidth = 4;
  [[590, 650], [970, 1030]].forEach(([a, b]) => { ctx.beginPath(); ctx.moveTo(a, 622); ctx.lineTo(b, 622); ctx.stroke(); });
  // plan name
  ctx.font = `900 46px ${FONT}`; fitText(ctx, plan.name, 400, 50, 900, 28);
  const nw = Math.min(ctx.measureText(plan.name).width + 70, 440);
  pill(ctx, 810 - nw / 2, 690, nw, 84, 'rgba(15,23,42,0.85)', '#fb923c'); ctx.fillStyle = '#fff'; ctx.fillText(plan.name, 810, 746);
  extruded(ctx, priceText(plan), 810, 930, 440, 150, '#ffffff', '#c2410c', 11, 60);
  ctx.fillStyle = '#fdba74'; ctx.font = `800 34px ${FONT}`; ctx.fillText(`مدة الاشتراك ${ar(plan.durationDays)} يوم`, 810, 1010);
  const ft = featText(plan); if (ft) { ctx.fillStyle = '#cbd5e1'; fitText(ctx, ft, 430, 28, 700, 20); ctx.fillText(ft, 810, 1056); }
  const cta = ctx.createLinearGradient(600, 0, 1040, 0); cta.addColorStop(0, '#ea580c'); cta.addColorStop(1, '#fb923c');
  ctx.save(); ctx.shadowColor = 'rgba(249,115,22,0.8)'; ctx.shadowBlur = 30; pill(ctx, 600, 1180, 440, 92, cta); ctx.restore();
  ctx.fillStyle = '#fff'; ctx.font = `900 40px ${FONT}`; ctx.fillText('اشترك الآن', 820, 1240);
  // brand
  ctx.fillStyle = '#fed7aa'; ctx.font = `900 34px ${FONT}`; ctx.fillText('المهندس حسين علام', 830, 80);
  ctx.fillStyle = 'rgba(148,163,184,0.9)'; ctx.font = `700 24px ${FONT}`; ctx.fillText('PHYSICS', 830, 118);
}

// ---------- 3 & 4) Hero layouts: centred cut-out with red/blue name boxes and a huge price ----------
function drawHero(ctx: Ctx, plan: PosterPlan, img: HTMLImageElement | null, t: 'neon' | 'fire') {
  const neon = t === 'neon';
  const c = neon
    ? { top: '#070b24', mid: '#10164a', bot: '#070a1c', glow: 'rgba(99,102,241,0.55)', accent: '#e11d48', accent2: '#1d4ed8', tag: '#0ea5e9', tagTx: '#031225', sub: '#c7d2fe', price: '#ffffff', pstroke: '#1d4ed8', pglow: '#2563eb', cta: '#e11d48', ctaTx: '#fff' }
    : { top: '#12040a', mid: '#3b0a12', bot: '#0d0306', glow: 'rgba(249,115,22,0.55)', accent: '#e11d48', accent2: '#facc15', tag: '#e11d48', tagTx: '#fff', sub: '#fecaca', price: '#fde68a', pstroke: '#7c2d12', pglow: '#f97316', cta: '#facc15', ctaTx: '#1c0a02' };
  const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, c.top); bg.addColorStop(0.5, c.mid); bg.addColorStop(1, c.bot);
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  if (neon) {
    ctx.strokeStyle = 'rgba(56,120,255,0.16)'; ctx.lineWidth = 2;
    for (let x = 0; x <= W; x += 90) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 820); ctx.stroke(); }
    for (let y = 0; y <= 820; y += 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    ctx.fillStyle = 'rgba(80,160,255,0.35)'; for (let i = 0; i < 60; i++) ctx.fillRect((i * 197) % W, (i * 331) % 780, 10, 5);
  } else {
    for (let i = 0; i < 90; i++) { ctx.fillStyle = i % 3 ? 'rgba(251,191,36,0.85)' : 'rgba(251,113,133,0.7)'; ctx.beginPath(); ctx.arc((i * 241) % W, (i * 389) % 900, 1.5 + (i % 4), 0, Math.PI * 2); ctx.fill(); }
  }
  glowSpot(ctx, W / 2, 430, 620, c.glow);
  if (neon) { bolt(ctx, 120, 70, 440, '#60a5fa', 1); bolt(ctx, 950, 60, 380, '#a78bfa', 2); bolt(ctx, 200, 580, 200, '#22d3ee', 3); }
  person(ctx, img, W / 2 + 6, 900, 860);
  const fd = ctx.createLinearGradient(0, 690, 0, 905); fd.addColorStop(0, 'rgba(0,0,0,0)'); fd.addColorStop(1, c.bot);
  ctx.fillStyle = fd; ctx.fillRect(0, 690, W, 215); ctx.fillStyle = c.bot; ctx.fillRect(0, 903, W, H - 903);
  glowSpot(ctx, W / 2, 1150, 520, neon ? 'rgba(37,99,235,0.25)' : 'rgba(249,115,22,0.22)');
  ctx.fillStyle = neon ? '#e2e8f0' : '#fde68a'; ctx.font = `800 28px ${FONT}`; ctx.fillText(neon ? 'PHYSICS BY ENG. HUSSIEN ALLAM' : 'الفيزياء مع المهندس', W / 2, 62);
  // name tags
  ctx.fillStyle = c.accent; rr(ctx, 690, 700, 310, 62, 8); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = `400 44px ${DISPLAY}`; ctx.fillText('المهندس', 845, 750);
  ctx.fillStyle = c.accent2; rr(ctx, 540, 770, 480, 96, 8); ctx.fill(); ctx.fillStyle = neon ? '#fff' : '#1c0a02'; ctx.font = `400 74px ${DISPLAY}`; ctx.fillText('حسين علام', 780, 848);
  ctx.fillStyle = c.tag; rr(ctx, 50, 790, 340, 76, 8); ctx.fill(); ctx.fillStyle = c.tagTx; fitText(ctx, gradeText(plan), 310, 38); ctx.fillText(gradeText(plan), 220, 842);
  // plan name + price
  ctx.font = `400 64px ${DISPLAY}`; const fs = display(ctx, plan.name, W / 2, 0, W - 260, 70, 'rgba(0,0,0,0)', { min: 34 });
  const nw = Math.min(ctx.measureText(plan.name).width + 90, W - 100);
  ctx.fillStyle = c.accent; rr(ctx, W / 2 - nw / 2, 900, nw, fs + 40, 8); ctx.fill();
  display(ctx, plan.name, W / 2, 900 + fs + 8, W - 260, 70, '#fff', { min: 34 });
  const pt = priceText(plan);
  ctx.save(); ctx.font = `400 150px ${DISPLAY}`; let pf = 150; while (ctx.measureText(pt).width > W - 140 && pf > 70) { pf -= 6; ctx.font = `400 ${pf}px ${DISPLAY}`; }
  ctx.lineWidth = 12; ctx.lineJoin = 'round'; ctx.strokeStyle = c.pstroke; ctx.shadowColor = c.pglow; ctx.shadowBlur = 40;
  ctx.strokeText(pt, W / 2, 1138); ctx.fillStyle = c.price; ctx.fillText(pt, W / 2, 1138); ctx.restore();
  ctx.fillStyle = c.sub; ctx.font = `800 32px ${FONT}`; const ft = featText(plan);
  ctx.fillText(`مدة الاشتراك ${ar(plan.durationDays)} يوم${ft ? '  ·  ' + ft : ''}`, W / 2, 1220);
  pill(ctx, 220, 1248, W - 440, 70, c.cta); ctx.fillStyle = c.ctaTx; ctx.font = `900 36px ${FONT}`; ctx.fillText(neon ? 'احجز مكانك واشترك الآن' : 'سجّل الآن قبل الزحمة', W / 2, 1297);
}

// ---------- 5) Clean: blue gradient, photo popping out of a white disc, white info card ----------
function drawClean(ctx: Ctx, plan: PosterPlan, img: HTMLImageElement | null) {
  const bg = ctx.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#1d4ed8'); bg.addColorStop(0.6, '#0ea5e9'); bg.addColorStop(1, '#22d3ee');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(255,255,255,0.09)'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(W, 0); ctx.lineTo(0, 520); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = 3;
  for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(W / 2, 480, 360 + i * 70, 140 + i * 40, -0.3, 0, Math.PI * 2); ctx.stroke(); }
  ctx.fillStyle = '#fff'; ctx.font = `400 58px ${DISPLAY}`; ctx.fillText('منصة المهندس حسين علام', W / 2, 92);
  ctx.fillStyle = '#e0f2fe'; ctx.font = `700 28px ${FONT}`; ctx.fillText('فيزياء · شرح · متابعة · اختبارات', W / 2, 138);
  ctx.save(); ctx.shadowColor = 'rgba(2,6,23,0.35)'; ctx.shadowBlur = 50; ctx.fillStyle = 'rgba(255,255,255,0.96)'; ctx.beginPath(); ctx.arc(W / 2, 540, 330, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  // pop-out: the person is clipped to the disc below its centre line, but free above it (helmet breaks out of the circle)
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, 540); ctx.arc(W / 2, 540, 330, 0, Math.PI * 2); ctx.clip();
  person(ctx, img, W / 2 + 4, 905, 745); ctx.restore();
  ctx.save(); ctx.shadowColor = 'rgba(2,6,23,0.35)'; ctx.shadowBlur = 40; ctx.fillStyle = '#fff'; rr(ctx, 70, 800, W - 140, 490, 48); ctx.fill(); ctx.restore();
  ctx.fillStyle = '#0f172a'; ctx.font = `400 56px ${DISPLAY}`; ctx.fillText('م. حسين علام', W / 2, 872);
  pill(ctx, W / 2 - 230, 892, 460, 66, '#0ea5e9'); ctx.fillStyle = '#fff'; fitText(ctx, gradeText(plan), 420, 36); ctx.fillText(gradeText(plan), W / 2, 937);
  ctx.fillStyle = '#1e293b'; fitText(ctx, plan.name, W - 240, 50); ctx.fillText(plan.name, W / 2, 1018);
  const pg = ctx.createLinearGradient(0, 1040, 0, 1130); pg.addColorStop(0, '#2563eb'); pg.addColorStop(1, '#0ea5e9');
  display(ctx, priceText(plan), W / 2, 1122, W - 280, 120, pg, { min: 60 });
  ctx.fillStyle = '#475569'; ctx.font = `700 30px ${FONT}`; ctx.fillText(`مدة الاشتراك ${ar(plan.durationDays)} يوم`, W / 2, 1170);
  const ft = featText(plan); if (ft) { ctx.fillStyle = '#64748b'; ctx.font = `600 26px ${FONT}`; ctx.fillText(ft, W / 2, 1208); }
  pill(ctx, W / 2 - 200, 1226, 400, 56, '#0f172a'); ctx.fillStyle = '#fff'; ctx.font = `900 32px ${FONT}`; ctx.fillText('اشترك الآن', W / 2, 1265);
}

// Draws a 1080x1350 plan card in one of several styles: teacher photo, grade, plan name, price. Pure canvas, no external service.
export async function renderPlanPoster(plan: PosterPlan, template: PosterTemplate = 'workshop'): Promise<string> {
  try {
    const f = (document as any).fonts;
    if (f?.load) await Promise.all(['900 40px Cairo', '800 30px Cairo', '400 60px Lalezar'].map(x => f.load(x, 'أبجد 123').catch(() => null)));
    await f?.ready;
  } catch { /* ignore */ }
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d')!;
  ctx.direction = 'rtl';
  ctx.textAlign = 'center';
  const img = await loadPhoto();
  if (template === 'workshop') drawWorkshop(ctx, plan, img);
  else if (template === 'engineer') drawEngineer(ctx, plan, img);
  else if (template === 'neon' || template === 'fire') drawHero(ctx, plan, img, template);
  else drawClean(ctx, plan, img);
  return c.toDataURL('image/jpeg', 0.92);
}

export const PlanPosterImg: React.FC<{ plan: PosterPlan; className?: string; download?: boolean; template?: PosterTemplate }> = ({ plan, className = '', download, template = 'workshop' }) => {
  const [src, setSrc] = useState('');
  const key = JSON.stringify([plan.name, plan.price, plan.durationDays, plan.grade, plan.includesAi, plan.lessonCount, plan.examCount, template]);
  useEffect(() => {
    let live = true;
    setSrc('');
    renderPlanPoster(plan, template as PosterTemplate).then(u => { if (live) setSrc(u); }).catch(() => { /* poster is optional */ });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  if (!src) return <div className={`flex items-center justify-center bg-slate-900 rounded-2xl aspect-[4/5] ${className}`}><Loader2 className="w-5 h-5 animate-spin text-slate-500" /></div>;
  return (
    <div className="space-y-1.5">
      <img src={src} alt={`بطاقة ${plan.name}`} loading="lazy" className={`w-full rounded-2xl border border-slate-700 ${className}`} />
      {download && (
        <a href={src} download={`بطاقة-${plan.name}-${template}.jpg`} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs font-bold hover:bg-slate-700"><Download className="w-3.5 h-3.5" /> تحميل</a>
      )}
    </div>
  );
};

// Teacher gallery: every style side by side so he can pick and download the one he likes.
export const PlanPosterGallery: React.FC<{ plan: PosterPlan }> = ({ plan }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-2">
      <button type="button" onClick={() => setOpen(o => !o)} className="px-3 py-1.5 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/30 text-xs font-bold">
        {open ? 'إخفاء التصميمات' : `عرض ${POSTER_TEMPLATES.length} تصميمات للبطاقة`}
      </button>
      {open && (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {POSTER_TEMPLATES.map(t => (
            <div key={t.id} className="space-y-1">
              <div className="text-[11px] font-bold text-slate-300">{t.label}</div>
              <PlanPosterImg plan={plan} template={t.id} download />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
