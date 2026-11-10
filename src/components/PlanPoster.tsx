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

// Draws a 1080x1350 plan card: teacher photo, grade, plan name, price. Pure canvas, no external service.
export async function renderPlanPoster(plan: PosterPlan): Promise<string> {
  try { await (document as any).fonts?.ready; } catch { /* ignore */ }
  const W = 1080, H = 1350;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d')!;
  ctx.direction = 'rtl';
  ctx.textAlign = 'center';

  // background
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#0a1020'); bg.addColorStop(0.55, '#111c33'); bg.addColorStop(1, '#0b1326');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, 430, 40, W / 2, 430, 560);
  glow.addColorStop(0, 'rgba(245,158,11,0.34)'); glow.addColorStop(1, 'rgba(245,158,11,0)');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);

  // physics decoration: orbits + dots
  ctx.save();
  ctx.translate(W / 2, 430);
  ctx.strokeStyle = 'rgba(251,191,36,0.16)'; ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    ctx.rotate(Math.PI / 3);
    ctx.beginPath(); ctx.ellipse(0, 0, 470, 170, 0, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = 'rgba(56,189,248,0.55)';
  [[130, 250, 7], [940, 330, 6], [170, 640, 5], [915, 610, 8], [520, 120, 5]].forEach(([x, y, r]) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); });

  // header
  ctx.fillStyle = '#fbbf24';
  ctx.font = `900 46px ${FONT}`;
  ctx.fillText('منصة المهندس حسين علام للفيزياء', W / 2, 92);
  ctx.fillStyle = 'rgba(203,213,225,0.85)';
  ctx.font = `600 27px ${FONT}`;
  ctx.fillText('ثانوية عامة · أزهر · بكالوريا', W / 2, 140);

  // photo with golden ring
  const cx = W / 2, cy = 430, R = 215;
  ctx.save();
  ctx.shadowColor = 'rgba(245,158,11,0.55)'; ctx.shadowBlur = 50;
  ctx.beginPath(); ctx.arc(cx, cy, R + 12, 0, Math.PI * 2);
  const ring = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
  ring.addColorStop(0, '#fde68a'); ring.addColorStop(0.5, '#f59e0b'); ring.addColorStop(1, '#b45309');
  ctx.fillStyle = ring; ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip();
  const img = await loadPhoto();
  if (img) {
    const s = Math.max((R * 2) / img.width, (R * 2) / img.height);
    const w = img.width * s, h = img.height * s;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, cx - w / 2, cy - h / 2 + 12, w, h);
  } else {
    ctx.fillStyle = '#1e293b'; ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
  }
  ctx.restore();

  // name
  ctx.fillStyle = '#ffffff';
  ctx.font = `900 62px ${FONT}`;
  ctx.fillText('م. حسين علام', W / 2, 740);
  ctx.fillStyle = '#7dd3fc';
  ctx.font = `700 31px ${FONT}`;
  ctx.fillText('مدرس الفيزياء', W / 2, 785);

  // grade pill
  const grade = plan.grade ? GRADE_LABEL[plan.grade] || plan.grade : 'كل الصفوف';
  ctx.font = `900 40px ${FONT}`;
  const gw = Math.min(ctx.measureText(grade).width + 110, W - 120);
  const pg = ctx.createLinearGradient(W / 2 - gw / 2, 0, W / 2 + gw / 2, 0);
  pg.addColorStop(0, '#0ea5e9'); pg.addColorStop(1, '#38bdf8');
  ctx.fillStyle = pg; rr(ctx, W / 2 - gw / 2, 825, gw, 84, 42); ctx.fill();
  ctx.fillStyle = '#04111f';
  ctx.fillText(grade, W / 2, 884);

  // plan name
  ctx.fillStyle = '#f8fafc';
  let fs = 58;
  ctx.font = `900 ${fs}px ${FONT}`;
  while (ctx.measureText(plan.name).width > W - 140 && fs > 30) { fs -= 3; ctx.font = `900 ${fs}px ${FONT}`; }
  ctx.fillText(plan.name, W / 2, 985);

  // price block
  const priceTxt = plan.price > 0 ? `${ar(plan.price)} ج.م` : 'مجاناً';
  ctx.save();
  ctx.shadowColor = 'rgba(245,158,11,0.5)'; ctx.shadowBlur = 30;
  const pgd = ctx.createLinearGradient(0, 1020, 0, 1150);
  pgd.addColorStop(0, '#fde68a'); pgd.addColorStop(1, '#f59e0b');
  ctx.fillStyle = pgd;
  ctx.font = `900 108px ${FONT}`;
  ctx.fillText(priceTxt, W / 2, 1098);
  ctx.restore();
  ctx.fillStyle = 'rgba(226,232,240,0.9)';
  ctx.font = `700 33px ${FONT}`;
  ctx.fillText(`مدة الاشتراك ${ar(plan.durationDays)} يوم`, W / 2, 1182);

  // features
  const feats: string[] = [];
  if (plan.lessonCount) feats.push(`${ar(plan.lessonCount)} محاضرة`);
  if (plan.examCount) feats.push(`${ar(plan.examCount)} امتحان`);
  if (plan.includesAi) feats.push('المدرس الذكي');
  if (feats.length) {
    ctx.fillStyle = 'rgba(148,163,184,0.95)';
    ctx.font = `600 29px ${FONT}`;
    ctx.fillText(feats.join('  ·  '), W / 2, 1228);
  }

  // CTA
  const cta = ctx.createLinearGradient(0, 0, W, 0);
  cta.addColorStop(0, '#f59e0b'); cta.addColorStop(1, '#fbbf24');
  ctx.fillStyle = cta; rr(ctx, 160, 1258, W - 320, 64, 32); ctx.fill();
  ctx.fillStyle = '#1b1304';
  ctx.font = `900 34px ${FONT}`;
  ctx.fillText('اشترك الآن', W / 2, 1303);

  return c.toDataURL('image/jpeg', 0.92);
}

export const PlanPosterImg: React.FC<{ plan: PosterPlan; className?: string; download?: boolean }> = ({ plan, className = '', download }) => {
  const [src, setSrc] = useState('');
  const key = JSON.stringify([plan.name, plan.price, plan.durationDays, plan.grade, plan.includesAi, plan.lessonCount, plan.examCount]);
  const last = useRef('');
  useEffect(() => {
    if (last.current === key) return;
    last.current = key;
    let live = true;
    renderPlanPoster(plan).then(u => { if (live) setSrc(u); }).catch(() => { /* poster is optional */ });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  if (!src) return <div className={`flex items-center justify-center bg-slate-900 rounded-2xl aspect-[4/5] ${className}`}><Loader2 className="w-5 h-5 animate-spin text-slate-500" /></div>;
  return (
    <div className="space-y-1.5">
      <img src={src} alt={`بطاقة ${plan.name}`} loading="lazy" className={`w-full rounded-2xl border border-slate-700 ${className}`} />
      {download && (
        <a href={src} download={`بطاقة-${plan.name}.jpg`} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs font-bold hover:bg-slate-700"><Download className="w-3.5 h-3.5" /> تحميل البطاقة</a>
      )}
    </div>
  );
};
