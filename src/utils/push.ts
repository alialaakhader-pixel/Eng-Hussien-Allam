import * as api from '../services/api';

export const pushSupported = (): boolean =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

function b64ToBytes(b64url: string): Uint8Array {
  const pad = '='.repeat((4 - (b64url.length % 4)) % 4);
  const raw = atob((b64url + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}

export async function currentPushEndpoint(): Promise<string | null> {
  if (!pushSupported()) return null;
  try {
    const reg = await navigator.serviceWorker.getRegistration('/sw.js') || await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    return sub?.endpoint ?? null;
  } catch { return null; }
}

export async function enablePush(code: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!pushSupported()) return { ok: false, error: 'المتصفح أو الجهاز ده مش بيدعم إشعارات الويب. في آيفون لازم تضيف المنصة للشاشة الرئيسية الأول.' };
  try {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return { ok: false, error: 'لازم تسمح بالإشعارات من إعدادات المتصفح عشان توصلك التذكيرات.' };
    const reg = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
    const key = await api.pushPublicKey();
    if (!key) return { ok: false, error: 'خدمة الإشعارات غير متاحة الآن. حاول لاحقاً.' };
    const sub = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) as unknown as BufferSource });
    const j = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
    if (!j.endpoint || !j.keys?.p256dh || !j.keys?.auth) return { ok: false, error: 'تعذر تسجيل الجهاز للإشعارات.' };
    const r = await api.pushSubscribe(code, j.endpoint, j.keys.p256dh, j.keys.auth);
    return r ? { ok: true } : { ok: false, error: 'تعذر حفظ الاشتراك في الإشعارات.' };
  } catch (e: any) {
    return { ok: false, error: 'تعذر تفعيل الإشعارات على هذا الجهاز.' };
  }
}

export async function disablePush(code: string): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.getRegistration('/sw.js');
    const sub = await reg?.pushManager.getSubscription();
    if (sub) { await api.pushUnsubscribe(code, sub.endpoint); await sub.unsubscribe(); }
  } catch { /* ignore */ }
}
