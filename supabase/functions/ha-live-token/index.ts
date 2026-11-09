import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Issues short-lived LiveKit access tokens. Authorization is decided by the database RPCs (grade / plan / ban / invite),
// never by the client. LIVEKIT_* secrets live only in Supabase secrets.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};
const reply = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), { status, headers: cors });

const SB = Deno.env.get("SUPABASE_URL") ?? "";
const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const LK_URL = (Deno.env.get("LIVEKIT_URL") ?? "").trim();
const LK_KEY = (Deno.env.get("LIVEKIT_API_KEY") ?? "").trim();
const LK_SECRET = (Deno.env.get("LIVEKIT_API_SECRET") ?? "").trim();

const enc = new TextEncoder();
const b64u = (b: ArrayBuffer | Uint8Array | string) => {
  const bytes = typeof b === "string" ? enc.encode(b) : new Uint8Array(b);
  let s = "";
  for (const x of bytes) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
async function sign(claims: Record<string, unknown>): Promise<string> {
  const head = b64u(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64u(JSON.stringify(claims));
  const key = await crypto.subtle.importKey("raw", enc.encode(LK_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(`${head}.${body}`));
  return `${head}.${body}.${b64u(sig)}`;
}

async function rpc(name: string, args: Record<string, unknown>, auth: string | null) {
  const r = await fetch(`${SB}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { apikey: ANON, Authorization: auth || `Bearer ${ANON}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  if (!r.ok) return { ok: false, error: r.status === 401 || r.status === 403 ? "FORBIDDEN" : "SERVER" } as Record<string, unknown>;
  return (await r.json()) as Record<string, unknown>;
}

function httpBase() {
  return LK_URL.replace(/^wss:/, "https:").replace(/^ws:/, "http:").replace(/\/$/, "");
}
async function admin(method: string, body: Record<string, unknown>, room: string) {
  const tok = await sign({ iss: LK_KEY, sub: "server", nbf: Math.floor(Date.now() / 1000) - 10, exp: Math.floor(Date.now() / 1000) + 60, video: { roomAdmin: true, room } });
  return fetch(`${httpBase()}/twirp/livekit.RoomService/${method}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method === "GET") return reply(200, { ok: true, configured: !!(LK_URL && LK_KEY && LK_SECRET) });
  if (req.method !== "POST") return reply(405, { ok: false, error: "METHOD" });
  if (!(LK_URL && LK_KEY && LK_SECRET)) return reply(503, { ok: false, error: "NOT_CONFIGURED" });

  let b: Record<string, any>;
  try { b = await req.json(); } catch { return reply(400, { ok: false, error: "BAD_JSON" }); }
  const auth = req.headers.get("Authorization");
  const mode = String(b.mode || "");
  let info: Record<string, any>;

  if (mode === "teacher") {
    info = (await rpc("ha_live_teacher_join", { p_class: b.classId }, auth)) as any;
  } else if (mode === "student") {
    info = (await rpc("ha_live_join", { p_code: String(b.code || ""), p_device: String(b.device || ""), p_class: b.classId }, auth)) as any;
  } else if (mode === "invite") {
    info = (await rpc("ha_live_invite_join", { p_token: String(b.token || ""), p_name: String(b.name || "") }, null)) as any;
  } else if (mode === "admin") {
    // teacher-only moderation of live participants: remove | mute | camoff
    const j = (await rpc("ha_live_teacher_join", { p_class: b.classId }, auth)) as any;
    if (!j.ok) return reply(403, { ok: false, error: "FORBIDDEN" });
    const identity = String(b.identity || "");
    if (!identity || identity === "teacher") return reply(400, { ok: false, error: "INVALID" });
    const action = String(b.action || "");
    if (action === "remove") {
      const r = await admin("RemoveParticipant", { room: j.room, identity }, j.room);
      return reply(r.ok ? 200 : 502, { ok: r.ok });
    }
    if (action === "mute" || action === "camoff") {
      const pr = await admin("GetParticipant", { room: j.room, identity }, j.room);
      if (!pr.ok) return reply(502, { ok: false, error: "NOT_IN_ROOM" });
      const p = await pr.json();
      const want = action === "mute" ? "AUDIO" : "VIDEO";
      let n = 0;
      for (const t of p.tracks || []) {
        if (t.type === want && !t.muted) {
          const r = await admin("MutePublishedTrack", { room: j.room, identity, track_sid: t.sid, muted: true }, j.room);
          if (r.ok) n++;
        }
      }
      return reply(200, { ok: true, muted: n });
    }
    return reply(400, { ok: false, error: "INVALID" });
  } else {
    return reply(400, { ok: false, error: "INVALID" });
  }

  if (!info || !info.ok) return reply(info?.error === "FORBIDDEN" ? 403 : 200, { ok: false, error: info?.error || "DENIED" });

  const role = String(info.role);
  const sources = role === "student" ? [] : role === "teacher" ? ["camera", "microphone", "screen_share", "screen_share_audio"] : (info.allowGuestScreen ? ["camera", "microphone", "screen_share"] : ["camera", "microphone"]);
  const now = Math.floor(Date.now() / 1000);
  const jwt = await sign({
    iss: LK_KEY,
    sub: info.identity,
    name: info.name,
    nbf: now - 10,
    exp: now + (role === "teacher" ? 6 * 3600 : 3 * 3600),
    metadata: JSON.stringify({ role }),
    video: {
      roomJoin: true,
      room: info.room,
      canSubscribe: true,
      canPublish: role !== "student",
      canPublishData: role === "teacher",
      canPublishSources: sources,
      hidden: false,
    },
  });
  return reply(200, { ok: true, token: jwt, url: LK_URL, role, identity: info.identity, name: info.name, room: info.room, classId: info.classId ?? b.classId, title: info.title });
});
