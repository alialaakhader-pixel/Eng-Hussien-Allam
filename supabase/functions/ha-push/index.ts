import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import webpush from "npm:web-push@3.6.7";

// Web Push for study reminders. GET -> public VAPID key. POST {action:'dispatch', secret} -> called by pg_cron (via pg_net) when reminders are waiting.
// VAPID keys are generated once and kept in public.ha_push_config (service role only).
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};
const reply = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), { status, headers: cors });

const URL_ = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const h = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" };

async function getKeys(): Promise<{ public_key: string; private_key: string } | null> {
  const read = async () => {
    const r = await fetch(`${URL_}/rest/v1/ha_push_config?select=public_key,private_key&id=eq.1`, { headers: h });
    if (!r.ok) return null;
    const rows = await r.json();
    return rows?.[0] ?? null;
  };
  let k = await read();
  if (k) return k;
  const gen = webpush.generateVAPIDKeys();
  await fetch(`${URL_}/rest/v1/ha_push_config`, {
    method: "POST",
    headers: { ...h, Prefer: "resolution=ignore-duplicates,return=minimal" },
    body: JSON.stringify({ id: 1, public_key: gen.publicKey, private_key: gen.privateKey }),
  });
  k = await read();
  return k;
}

const rpc = (name: string, args: Record<string, unknown>) =>
  fetch(`${URL_}/rest/v1/rpc/${name}`, { method: "POST", headers: h, body: JSON.stringify(args) });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (!URL_ || !SERVICE) return reply(503, { ok: false, error: "server not configured" });

  if (req.method === "GET") {
    const k = await getKeys();
    return k ? reply(200, { ok: true, publicKey: k.public_key }) : reply(500, { ok: false });
  }
  if (req.method !== "POST") return reply(405, { ok: false });

  let body: any;
  try { body = await req.json(); } catch { return reply(400, { ok: false }); }
  if (body?.action !== "dispatch") return reply(400, { ok: false });

  const okRes = await rpc("ha_push_cron_ok", { p_secret: String(body?.secret ?? "") });
  if (!okRes.ok || (await okRes.json()) !== true) return reply(401, { ok: false });

  const keys = await getKeys();
  if (!keys) return reply(500, { ok: false });
  webpush.setVapidDetails("mailto:admin@eng-hussien-allam.vercel.app", keys.public_key, keys.private_key);

  const pr = await rpc("ha_push_pending", { p_limit: 200 });
  if (!pr.ok) return reply(500, { ok: false });
  const items: any[] = await pr.json();

  let sent = 0, failed = 0;
  const dead: string[] = [];
  for (const it of items) {
    const payload = JSON.stringify({ title: it.title, body: it.body, tag: it.kind, url: "/" });
    for (const s of it.subs ?? []) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 3600 });
        sent++;
      } catch (e: any) {
        failed++;
        if (e?.statusCode === 404 || e?.statusCode === 410) dead.push(s.endpoint);
        else console.error("push_error", e?.statusCode, String(e?.body ?? e?.message ?? e).slice(0, 200));
      }
    }
  }
  if (dead.length) await rpc("ha_push_remove", { p_endpoints: dead });
  return reply(200, { ok: true, sent, failed, removed: dead.length });
});
