import React, { useEffect, useRef, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';

export interface PosterPlan {
  name: string; price: number; durationDays: number; grade: string | null; includesAi?: boolean;
  lessonCount?: number; examCount?: number;
}

const GRADE_LABEL: Record<string, string> = {
  '1ث': 'الصف الأول الثانوي', '2ث': 'الصف الثاني الثانوي', '3ث': 'الصف الثالث الثانوي', 'بكالوريا': 'البكالوريا'
};
const PHOTO = '/teacher-photo.jpg';
const FONT = '"Cairo","Tajawal","Segoe UI",Tahoma,Arial,sans-serif';
const ar = (n: number) => n.toLocaleString('en-US');

let photoPromise: Promise<HTMLImageElement | null> | null = null;
const loadPhoto = () => {
  if (!photoPromise) {
    photoPromise = new Promise(res => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => res(null);
      i.src = PHOTO;
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

export type PosterTemplate = 'gold' | 'neon' | 'sky' | 'fire' | 'glass';
export const POSTER_TEMPLATES: { id: PosterTemplate; label: string }[] = [
  { id: 'neon', label: 'نيون تقني' }, { id: 'gold', label: 'ذهبي فاخر' }, { id: 'sky', label: 'أزرق عصري' },
  { id: 'fire', label: 'طاقة وشرر' }, { id: 'glass', label: 'زجاجي' }
];
export const templateFor = (seed: string): PosterTemplate => {
  let h = 0; for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return POSTER_TEMPLATES[h % POSTER_TEMPLATES.length].id;
};

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

function drawGold(ctx: Ctx, plan: PosterPlan, img: HTMLImageElement | null) {
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#0a1020'); bg.addColorStop(0.55, '#111c33'); bg.addColorStop(1, '#0b1326');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, 430, 40, W / 2, 430, 560);
  glow.addColorStop(0, 'rgba(245,158,11,0.34)'); glow.addColorStop(1, 'rgba(245,158,11,0)');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.translate(W / 2, 430); ctx.strokeStyle = 'rgba(251,191,36,0.16)'; ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) { ctx.rotate(Math.PI / 3); ctx.beginPath(); ctx.ellipse(0, 0, 470, 170, 0, 0, Math.PI * 2); ctx.stroke(); }
  ctx.restore();
  ctx.fillStyle = 'rgba(56,189,248,0.55)';
  [[130, 250, 7], [940, 330, 6], [170, 640, 5], [915, 610, 8], [520, 120, 5]].forEach(([x, y, r]) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); });
  ctx.fillStyle = '#fbbf24'; ctx.font = `900 46px ${FONT}`; ctx.fillText('منصة المهندس حسين علام للفيزياء', W / 2, 92);
  ctx.fillStyle = 'rgba(203,213,225,0.85)'; ctx.font = `600 27px ${FONT}`; ctx.fillText('ثانوية عامة · أزهر · بكالوريا', W / 2, 140);
  const cx = W / 2, cy = 430, R = 215;
  ctx.save(); ctx.shadowColor = 'rgba(245,158,11,0.55)'; ctx.shadowBlur = 50;
  ctx.beginPath(); ctx.arc(cx, cy, R + 12, 0, Math.PI * 2);
  const ring = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
  ring.addColorStop(0, '#fde68a'); ring.addColorStop(0.5, '#f59e0b'); ring.addColorStop(1, '#b45309');
  ctx.fillStyle = ring; ctx.fill(); ctx.restore();
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip(); cover(ctx, img, cx - R, cy - R, R * 2, R * 2, 0.5); ctx.restore();
  ctx.fillStyle = '#ffffff'; ctx.font = `900 62px ${FONT}`; ctx.fillText('م. حسين علام', W / 2, 740);
  ctx.fillStyle = '#7dd3fc'; ctx.font = `700 31px ${FONT}`; ctx.fillText('مدرس الفيزياء', W / 2, 785);
  const grade = gradeText(plan);
  ctx.font = `900 40px ${FONT}`;
  const gw = Math.min(ctx.measureText(grade).width + 110, W - 120);
  const pg = ctx.createLinearGradient(W / 2 - gw / 2, 0, W / 2 + gw / 2, 0); pg.addColorStop(0, '#0ea5e9'); pg.addColorStop(1, '#38bdf8');
  ctx.fillStyle = pg; rr(ctx, W / 2 - gw / 2, 825, gw, 84, 42); ctx.fill();
  ctx.fillStyle = '#04111f'; ctx.fillText(grade, W / 2, 884);
  ctx.fillStyle = '#f8fafc'; fitText(ctx, plan.name, W - 140, 58); ctx.fillText(plan.name, W / 2, 985);
  ctx.save(); ctx.shadowColor = 'rgba(245,158,11,0.5)'; ctx.shadowBlur = 30;
  const pgd = ctx.createLinearGradient(0, 1020, 0, 1150); pgd.addColorStop(0, '#fde68a'); pgd.addColorStop(1, '#f59e0b');
  ctx.fillStyle = pgd; ctx.font = `900 108px ${FONT}`; ctx.fillText(priceText(plan), W / 2, 1098); ctx.restore();
  ctx.fillStyle = 'rgba(226,232,240,0.9)'; ctx.font = `700 33px ${FONT}`; ctx.fillText(`مدة الاشتراك ${ar(plan.durationDays)} يوم`, W / 2, 1182);
  const ft = featText(plan);
  if (ft) { ctx.fillStyle = 'rgba(148,163,184,0.95)'; ctx.font = `600 29px ${FONT}`; ctx.fillText(ft, W / 2, 1228); }
  const cta = ctx.createLinearGradient(0, 0, W, 0); cta.addColorStop(0, '#f59e0b'); cta.addColorStop(1, '#fbbf24');
  ctx.fillStyle = cta; rr(ctx, 160, 1258, W - 320, 64, 32); ctx.fill();
  ctx.fillStyle = '#1b1304'; ctx.font = `900 34px ${FONT}`; ctx.fillText('اشترك الآن', W / 2, 1303);
}

// Inspired by tech-style teacher ads: dark server-room blue, lightning, red/blue label boxes, huge headline.
function drawNeon(ctx: Ctx, plan: PosterPlan, img: HTMLImageElement | null) {
  const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#070b24'); bg.addColorStop(0.5, '#10164a'); bg.addColorStop(1, '#070a1c');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  // rack lines
  ctx.strokeStyle = 'rgba(56,120,255,0.16)'; ctx.lineWidth = 2;
  for (let x = 0; x <= W; x += 90) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 800); ctx.stroke(); }
  for (let y = 0; y <= 800; y += 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  ctx.fillStyle = 'rgba(80,160,255,0.35)';
  for (let i = 0; i < 60; i++) { ctx.fillRect(((i * 197) % W), ((i * 331) % 760), 10, 5); }
  const g1 = ctx.createRadialGradient(W / 2, 360, 50, W / 2, 360, 560); g1.addColorStop(0, 'rgba(99,102,241,0.55)'); g1.addColorStop(1, 'rgba(99,102,241,0)');
  ctx.fillStyle = g1; ctx.fillRect(0, 0, W, 900);
  bolt(ctx, 140, 80, 420, '#60a5fa', 1); bolt(ctx, 930, 60, 360, '#a78bfa', 2); bolt(ctx, 220, 560, 200, '#22d3ee', 3);
  // photo block with fade
  const px = 190, py = 120, pw = 700, ph = 655;
  ctx.save(); rr(ctx, px, py, pw, ph, 36); ctx.clip(); cover(ctx, img, px, py, pw, ph, 0.3);
  ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = 'rgba(70,90,255,0.35)'; ctx.fillRect(px, py, pw, ph); ctx.globalCompositeOperation = 'source-over';
  const fade = ctx.createLinearGradient(0, py + ph - 260, 0, py + ph); fade.addColorStop(0, 'rgba(7,10,28,0)'); fade.addColorStop(1, 'rgba(7,10,28,1)');
  ctx.fillStyle = fade; ctx.fillRect(px, py, pw, ph); ctx.restore();
  ctx.save(); ctx.strokeStyle = '#60a5fa'; ctx.lineWidth = 4; ctx.shadowColor = '#3b82f6'; ctx.shadowBlur = 26; rr(ctx, px, py, pw, ph, 36); ctx.stroke(); ctx.restore();
  // top labels
  ctx.fillStyle = '#e2e8f0'; ctx.font = `800 28px ${FONT}`; ctx.fillText('PHYSICS BY ENG. HUSSIEN ALLAM', W / 2, 74);
  // name tags
  ctx.fillStyle = '#e11d48'; rr(ctx, 700, 660, 300, 64, 6); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = `900 40px ${FONT}`; ctx.fillText('المهندس', 850, 706);
  ctx.fillStyle = '#1d4ed8'; rr(ctx, 560, 730, 470, 90, 6); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = `900 58px ${FONT}`; ctx.fillText('حسين علام', 795, 797);
  // grade tag left
  ctx.fillStyle = '#0ea5e9'; rr(ctx, 50, 700, 330, 76, 6); ctx.fill();
  ctx.fillStyle = '#031225'; fitText(ctx, gradeText(plan), 300, 38); ctx.fillText(gradeText(plan), 215, 752);
  // plan name red box
  ctx.font = `900 54px ${FONT}`; const fs = fitText(ctx, plan.name, W - 260, 66, 900, 32);
  const nw = Math.min(ctx.measureText(plan.name).width + 80, W - 100);
  ctx.fillStyle = '#e11d48'; rr(ctx, W / 2 - nw / 2, 850, nw, fs + 36, 6); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.fillText(plan.name, W / 2, 850 + fs + 4);
  // huge price
  ctx.save(); ctx.font = `900 160px ${FONT}`; ctx.fillStyle = '#ffffff'; ctx.shadowColor = '#2563eb'; ctx.shadowBlur = 40; ctx.lineWidth = 12; ctx.strokeStyle = '#1d4ed8';
  const pt = priceText(plan); fitText(ctx, pt, W - 120, 160, 900, 60); ctx.strokeText(pt, W / 2, 1110); ctx.fillText(pt, W / 2, 1110); ctx.restore();
  ctx.fillStyle = '#c7d2fe'; ctx.font = `800 32px ${FONT}`; ctx.fillText(`مدة الاشتراك ${ar(plan.durationDays)} يوم${featText(plan) ? '  ·  ' + featText(plan) : ''}`, W / 2, 1210);
  ctx.fillStyle = '#e11d48'; rr(ctx, 220, 1245, W - 440, 70, 35); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = `900 36px ${FONT}`; ctx.fillText('احجز مكانك واشترك الآن', W / 2, 1294);
}

function drawSky(ctx: Ctx, plan: PosterPlan, img: HTMLImageElement | null) {
  const bg = ctx.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#1d4ed8'); bg.addColorStop(0.6, '#0ea5e9'); bg.addColorStop(1, '#22d3ee');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(255,255,255,0.09)';
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(W, 0); ctx.lineTo(0, 520); ctx.fill();
  ctx.beginPath(); ctx.arc(W - 80, 700, 260, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 3;
  for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(W / 2, 440, 330 + i * 70, 120 + i * 38, -0.35, 0, Math.PI * 2); ctx.stroke(); }
  ctx.fillStyle = '#fff'; ctx.font = `900 42px ${FONT}`; ctx.fillText('منصة المهندس حسين علام', W / 2, 92);
  ctx.fillStyle = '#e0f2fe'; ctx.font = `700 28px ${FONT}`; ctx.fillText('فيزياء · شرح · متابعة · اختبارات', W / 2, 138);
  const cx = W / 2, cy = 430, R = 250;
  ctx.save(); ctx.shadowColor = 'rgba(2,6,23,0.4)'; ctx.shadowBlur = 40; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx, cy, R + 16, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip(); cover(ctx, img, cx - R, cy - R, R * 2, R * 2, 0.45); ctx.restore();
  // white bottom card
  ctx.save(); ctx.shadowColor = 'rgba(2,6,23,0.35)'; ctx.shadowBlur = 40; ctx.fillStyle = '#fff'; rr(ctx, 70, 760, W - 140, 520, 48); ctx.fill(); ctx.restore();
  ctx.fillStyle = '#0f172a'; ctx.font = `900 54px ${FONT}`; ctx.fillText('م. حسين علام', W / 2, 840);
  ctx.fillStyle = '#0ea5e9'; rr(ctx, W / 2 - 230, 865, 460, 70, 35); ctx.fill();
  ctx.fillStyle = '#fff'; fitText(ctx, gradeText(plan), 420, 38); ctx.fillText(gradeText(plan), W / 2, 914);
  ctx.fillStyle = '#1e293b'; fitText(ctx, plan.name, W - 240, 52); ctx.fillText(plan.name, W / 2, 1000);
  const pg = ctx.createLinearGradient(0, 1020, 0, 1140); pg.addColorStop(0, '#2563eb'); pg.addColorStop(1, '#0ea5e9');
  ctx.fillStyle = pg; fitText(ctx, priceText(plan), W - 280, 108, 900, 60); ctx.fillText(priceText(plan), W / 2, 1112);
  ctx.fillStyle = '#475569'; ctx.font = `700 31px ${FONT}`; ctx.fillText(`مدة الاشتراك ${ar(plan.durationDays)} يوم`, W / 2, 1186);
  const ft = featText(plan); if (ft) { ctx.fillStyle = '#64748b'; ctx.font = `600 26px ${FONT}`; ctx.fillText(ft, W / 2, 1226); }
  ctx.fillStyle = '#0f172a'; rr(ctx, W / 2 - 200, 1250, 400, 62, 31); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = `900 32px ${FONT}`; ctx.fillText('اشترك الآن', W / 2, 1293);
}

function drawFire(ctx: Ctx, plan: PosterPlan, img: HTMLImageElement | null) {
  const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#12040a'); bg.addColorStop(0.6, '#3b0a12'); bg.addColorStop(1, '#0d0306');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  const g = ctx.createRadialGradient(W / 2, 520, 30, W / 2, 520, 640); g.addColorStop(0, 'rgba(249,115,22,0.5)'); g.addColorStop(1, 'rgba(249,115,22,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // sparks
  for (let i = 0; i < 90; i++) {
    const x = (i * 241) % W, y = (i * 389) % 900, r = 1.5 + (i % 4);
    ctx.fillStyle = i % 3 ? 'rgba(251,191,36,0.85)' : 'rgba(251,113,133,0.7)'; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  // diagonal photo panel
  ctx.save(); ctx.beginPath(); ctx.moveTo(120, 110); ctx.lineTo(W - 60, 70); ctx.lineTo(W - 120, 760); ctx.lineTo(60, 800); ctx.closePath(); ctx.clip();
  cover(ctx, img, 60, 70, W - 60, 740, 0.3);
  ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = 'rgba(255,120,60,0.4)'; ctx.fillRect(0, 0, W, 900); ctx.globalCompositeOperation = 'source-over';
  const fd = ctx.createLinearGradient(0, 520, 0, 800); fd.addColorStop(0, 'rgba(13,3,6,0)'); fd.addColorStop(1, 'rgba(13,3,6,0.95)');
  ctx.fillStyle = fd; ctx.fillRect(0, 0, W, 900); ctx.restore();
  ctx.save(); ctx.strokeStyle = '#fb923c'; ctx.lineWidth = 6; ctx.shadowColor = '#f97316'; ctx.shadowBlur = 30;
  ctx.beginPath(); ctx.moveTo(120, 110); ctx.lineTo(W - 60, 70); ctx.lineTo(W - 120, 760); ctx.lineTo(60, 800); ctx.closePath(); ctx.stroke(); ctx.restore();
  ctx.fillStyle = '#fde68a'; ctx.font = `900 40px ${FONT}`; ctx.fillText('الفيزياء مع المهندس', W / 2, 62);
  ctx.fillStyle = '#facc15'; rr(ctx, 560, 700, 440, 100, 8); ctx.fill();
  ctx.fillStyle = '#1c0a02'; ctx.font = `900 62px ${FONT}`; ctx.fillText('حسين علام', 780, 773);
  ctx.fillStyle = '#e11d48'; rr(ctx, 60, 720, 380, 70, 8); ctx.fill();
  ctx.fillStyle = '#fff'; fitText(ctx, gradeText(plan), 340, 36); ctx.fillText(gradeText(plan), 250, 770);
  ctx.fillStyle = '#fff'; fitText(ctx, plan.name, W - 140, 66); ctx.fillText(plan.name, W / 2, 905);
  ctx.save(); const pgd = ctx.createLinearGradient(0, 950, 0, 1120); pgd.addColorStop(0, '#fef08a'); pgd.addColorStop(1, '#f97316');
  ctx.font = `900 170px ${FONT}`; fitText(ctx, priceText(plan), W - 120, 170, 900, 60); ctx.lineWidth = 10; ctx.strokeStyle = '#7c2d12'; ctx.shadowColor = '#f97316'; ctx.shadowBlur = 40;
  ctx.strokeText(priceText(plan), W / 2, 1090); ctx.fillStyle = pgd; ctx.fillText(priceText(plan), W / 2, 1090); ctx.restore();
  ctx.fillStyle = '#fecaca'; ctx.font = `700 33px ${FONT}`; ctx.fillText(`مدة الاشتراك ${ar(plan.durationDays)} يوم${featText(plan) ? '  ·  ' + featText(plan) : ''}`, W / 2, 1170);
  ctx.fillStyle = '#facc15'; rr(ctx, 200, 1225, W - 400, 78, 39); ctx.fill();
  ctx.fillStyle = '#1c0a02'; ctx.font = `900 38px ${FONT}`; ctx.fillText('سجّل الآن قبل الزحمة', W / 2, 1278);
}

function drawGlass(ctx: Ctx, plan: PosterPlan, img: HTMLImageElement | null) {
  const bg = ctx.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#1e1b4b'); bg.addColorStop(0.5, '#4c1d95'); bg.addColorStop(1, '#0f766e');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  const blob = (x: number, y: number, r: number, c: string) => { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, c); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); };
  blob(200, 200, 520, 'rgba(236,72,153,0.55)'); blob(900, 520, 520, 'rgba(34,211,238,0.5)'); blob(300, 1100, 520, 'rgba(250,204,21,0.28)');
  ctx.fillStyle = '#fff'; ctx.font = `900 40px ${FONT}`; ctx.fillText('منصة المهندس حسين علام', W / 2, 84);
  // photo squircle
  const px = W / 2 - 250, py = 120, ps = 500;
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 50; ctx.fillStyle = 'rgba(255,255,255,0.9)'; rr(ctx, px - 12, py - 12, ps + 24, ps + 24, 90); ctx.fill(); ctx.restore();
  ctx.save(); rr(ctx, px, py, ps, ps, 80); ctx.clip(); cover(ctx, img, px, py, ps, ps, 0.4); ctx.restore();
  // glass card
  const cy0 = 560, ch = 700;
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 50;
  const gl = ctx.createLinearGradient(0, cy0, 0, cy0 + ch); gl.addColorStop(0, 'rgba(255,255,255,0.28)'); gl.addColorStop(1, 'rgba(255,255,255,0.10)');
  ctx.fillStyle = gl; rr(ctx, 70, cy0, W - 140, ch, 56); ctx.fill(); ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2.5; rr(ctx, 70, cy0, W - 140, ch, 56); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.font = `900 56px ${FONT}`; ctx.fillText('م. حسين علام', W / 2, cy0 + 150);
  ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.font = `700 30px ${FONT}`; ctx.fillText('مدرس الفيزياء', W / 2, cy0 + 196);
  ctx.fillStyle = '#facc15'; rr(ctx, W / 2 - 240, cy0 + 225, 480, 70, 35); ctx.fill();
  ctx.fillStyle = '#2b1b00'; fitText(ctx, gradeText(plan), 440, 38); ctx.fillText(gradeText(plan), W / 2, cy0 + 274);
  ctx.fillStyle = '#fff'; fitText(ctx, plan.name, W - 240, 54); ctx.fillText(plan.name, W / 2, cy0 + 360);
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 20; ctx.fillStyle = '#fff'; fitText(ctx, priceText(plan), W - 280, 116, 900, 60); ctx.fillText(priceText(plan), W / 2, cy0 + 472); ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.font = `700 32px ${FONT}`; ctx.fillText(`مدة الاشتراك ${ar(plan.durationDays)} يوم`, W / 2, cy0 + 548);
  const ft = featText(plan); if (ft) { ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.font = `600 27px ${FONT}`; ctx.fillText(ft, W / 2, cy0 + 588); }
  ctx.fillStyle = '#fff'; rr(ctx, W / 2 - 210, cy0 + 615, 420, 62, 31); ctx.fill();
  ctx.fillStyle = '#4c1d95'; ctx.font = `900 32px ${FONT}`; ctx.fillText('اشترك الآن', W / 2, cy0 + 658);
}

// Draws a 1080x1350 plan card in one of several styles: teacher photo, grade, plan name, price. Pure canvas, no external service.
export async function renderPlanPoster(plan: PosterPlan, template: PosterTemplate = 'gold'): Promise<string> {
  try { await (document as any).fonts?.ready; } catch { /* ignore */ }
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d')!;
  ctx.direction = 'rtl';
  ctx.textAlign = 'center';
  const img = await loadPhoto();
  ({ gold: drawGold, neon: drawNeon, sky: drawSky, fire: drawFire, glass: drawGlass })[template](ctx, plan, img);
  return c.toDataURL('image/jpeg', 0.92);
}

export const PlanPosterImg: React.FC<{ plan: PosterPlan; className?: string; download?: boolean; template?: PosterTemplate }> = ({ plan, className = '', download, template = 'gold' }) => {
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
