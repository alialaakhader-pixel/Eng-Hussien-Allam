import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// AI tutor (text + photos of problems). Secrets (server side only): a Groq (gsk_...), xAI (xai-...) or OpenAI (sk-...) key;
// optional GROQ_MODEL / GROQ_VISION_MODEL / XAI_MODEL / OPENAI_MODEL. Student identity, subscription and rate limits are enforced by the
// ha_ai_gate2 RPC (code+device, or the email-account JWT). Photos are stored in the private bucket `ha-ai-images` (service role only).
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: cors });

// Provider is detected from the key itself (gsk_ = Groq, xai- = xAI Grok, sk- = OpenAI), not from the secret's name.
type Provider = { id: "groq" | "xai" | "openai"; key: string; url: string; models: string[]; vision: string[] };

const providers = (): Provider[] => {
  const found: Record<string, string> = {};
  let all: Record<string, string> = {};
  try { all = Deno.env.toObject(); } catch { /* ignore */ }
  for (const [name, raw] of Object.entries(all)) {
    const v = (raw || "").trim();
    if (!v || name.startsWith("SUPABASE_") || name.startsWith("SB_") || name === "DENO_DEPLOYMENT_ID") continue;
    if (v.startsWith("gsk_")) found.groq = v;
    else if (v.startsWith("xai-")) found.xai = v;
    else if (/^sk-[A-Za-z0-9_-]{20,}/.test(v)) found.openai = v;
  }
  const list: Provider[] = [];
  const m = (v: string | undefined, ...d: string[]) => [v, ...d].filter((x): x is string => !!x);
  if (found.groq) list.push({ id: "groq", key: found.groq, url: "https://api.groq.com/openai/v1/chat/completions",
    models: m(Deno.env.get("GROQ_MODEL"), "openai/gpt-oss-120b", "llama-3.3-70b-versatile"),
    vision: m(Deno.env.get("GROQ_VISION_MODEL"), "qwen/qwen3.8-27b", "meta-llama/llama-4-scout-17b-16e-instruct") });
  if (found.xai) list.push({ id: "xai", key: found.xai, url: "https://api.x.ai/v1/chat/completions",
    models: m(Deno.env.get("XAI_MODEL"), "grok-4", "grok-3"), vision: m(Deno.env.get("XAI_MODEL"), "grok-4") });
  if (found.openai) list.push({ id: "openai", key: found.openai, url: "https://api.openai.com/v1/chat/completions",
    models: m(Deno.env.get("OPENAI_MODEL"), "gpt-4o"), vision: m(Deno.env.get("OPENAI_MODEL"), "gpt-4o") });
  return list;
};

const GRADE_NAMES: Record<string, string> = {
  "1ث": "الصف الأول الثانوي",
  "2ث": "الصف الثاني الثانوي",
  "3ث": "الصف الثالث الثانوي (الثانوية العامة)",
};

const MAX_IMAGES = 3;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const IMG_RE = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

async function storeImage(code: string, idx: number, mime: string, b64: string): Promise<string | null> {
  if (!SUPABASE_URL || !SERVICE) return null;
  try {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const ext = mime === "png" ? "png" : mime === "webp" ? "webp" : "jpg";
    const path = `${code.replace(/[^A-Za-z0-9_-]/g, "_")}/${Date.now()}-${idx}.${ext}`;
    const r = await fetch(`${SUPABASE_URL}/storage/v1/object/ha-ai-images/${path}`, {
      method: "POST",
      headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": `image/${mime === "jpeg" ? "jpeg" : mime}`, "x-upsert": "false" },
      body: bytes,
    });
    return r.ok ? path : null;
  } catch { return null; }
}

async function logChat(code: string, question: string, answer: string, paths: string[]) {
  if (!SUPABASE_URL || !SERVICE) return;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/rpc/ha_ai_log_service`, {
      method: "POST",
      headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_code: code, p_question: question, p_answer: answer, p_paths: paths }),
    });
  } catch { /* logging must never break the answer */ }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  // Health check: reports only which providers are configured (never the keys).
  if (req.method === "GET") {
    return reply(200, {
      ok: true,
      service: "ha-ai-tutor",
      providers: providers().map((p) => ({ id: p.id, models: p.models, vision: p.vision })),
      supabaseUrlConfigured: !!SUPABASE_URL,
    });
  }
  if (req.method !== "POST") return reply(405, { ok: false, error: "الطريقة غير مسموحة." });

  const chain = providers();
  const supabaseUrl = SUPABASE_URL;
  // The publishable key is public; fall back to the one the browser sent if the env var is not injected.
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || req.headers.get("apikey") || "";
  if (chain.length === 0) return reply(503, { ok: false, code: "NO_AI_KEY", error: "خدمة المدرس الذكي لم تُفعّل بعد. يلزم ضبط مفتاح الذكاء الاصطناعي في أسرار الخادم." });
  if (!supabaseUrl || !anonKey) return reply(503, { ok: false, code: "NO_SUPABASE_ENV", error: "إعدادات التحقق من الطالب غير مكتملة على الخادم." });

  let body: any;
  try { body = await req.json(); } catch { return reply(400, { ok: false, error: "تعذر قراءة الطلب." }); }

  const code = String(body?.code ?? "").trim().slice(0, 80);
  const device = String(body?.device ?? "").trim().slice(0, 120);
  const question = String(body?.question ?? "").trim();
  const gradeRaw = String(body?.grade ?? "").trim().slice(0, 80);
  const grade = GRADE_NAMES[gradeRaw] || "المرحلة الثانوية";
  const history = Array.isArray(body?.history) ? body.history.slice(-8) : [];

  const rawImages: string[] = Array.isArray(body?.images) ? body.images.filter((x: unknown) => typeof x === "string") : [];
  if (rawImages.length > MAX_IMAGES) return reply(400, { ok: false, error: `أقصى عدد للصور ${MAX_IMAGES} في السؤال الواحد.` });
  const images: { mime: string; b64: string; url: string }[] = [];
  for (const d of rawImages) {
    const mt = IMG_RE.exec(d);
    if (!mt) return reply(400, { ok: false, error: "صيغة الصورة غير مدعومة. استخدم JPG أو PNG أو WebP." });
    if (Math.floor((mt[2].length * 3) / 4) > MAX_IMAGE_BYTES) return reply(400, { ok: false, error: "الصورة كبيرة جداً (الحد 2 ميجا). صوّرها بجودة أقل أو قصّها." });
    images.push({ mime: mt[1], b64: mt[2], url: d });
  }

  if (!code || !device) return reply(401, { ok: false, error: "سجّل دخول الطالب أولاً حتى نتحقق من حسابك." });
  if (question.length > 2500 || (images.length === 0 && question.length < 2)) return reply(400, { ok: false, error: "اكتب سؤالاً من 2 إلى 2500 حرف، أو أرسل صورة." });

  const auth = req.headers.get("authorization") ?? "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  const userToken = bearer && bearer !== anonKey ? bearer : anonKey;

  try {
    const gate = await fetch(`${supabaseUrl}/rest/v1/rpc/ha_ai_gate2`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: anonKey, Authorization: `Bearer ${userToken}` },
      body: JSON.stringify({ p_code: code, p_device: device, p_images: images.length }),
    });
    if (!gate.ok) return reply(401, { ok: false, error: "تعذر التحقق من حساب الطالب." });
    const g = await gate.json();
    if (!g?.ok) {
      if (g?.error === "RATE_LIMIT") return reply(429, { ok: false, code: "RATE_LIMIT", error: "بعتّ أسئلة كتير بسرعة. استنى دقيقة وحاول تاني." });
      if (g?.error === "DAILY_LIMIT") return reply(429, { ok: false, code: "DAILY_LIMIT", error: "وصلت للحد اليومي من أسئلة المدرس الذكي. كمّل بكرة." });
      if (g?.error === "IMAGE_LIMIT") return reply(429, { ok: false, code: "IMAGE_LIMIT", error: "وصلت للحد اليومي لإرسال الصور (15 صورة). كمّل بكرة أو اكتب المسألة نصاً." });
      if (g?.error === "SUBSCRIPTION_REQUIRED") return reply(403, { ok: false, code: "SUBSCRIPTION_REQUIRED", error: "المدرس الذكي ضمن باقة اشتراك. فعّل اشتراكك من لوحة الطالب ← اشتراكي." });
      return reply(401, { ok: false, error: "بيانات الدخول غير صحيحة أو هذا الجهاز غير مسجل." });
    }

    const safeHistory = history
      .filter((m: any) => m && ["user", "assistant"].includes(m.role) && typeof m.content === "string")
      .map((m: any) => ({ role: m.role, content: m.content.slice(0, 2500) }));

    const imageRules = images.length > 0
      ? `

الصور:
- الطالب أرسل ${images.length === 1 ? "صورة" : images.length + " صور"} لمسألة أو سؤال. اقرأ نص المسألة من الصورة أولاً، ثم اكتب المعطيات والمطلوب كما فهمتها (بالرموز والوحدات) قبل الحل.
- افهم الرسومات والدوائر الكهربائية والرسوم البيانية قدر الإمكان، واذكر ما رأيته فيها (مثل قيم المقاومات وترتيبها أو ميل الخط).
- إذا كانت الصورة غير واضحة أو مقصوصة أو بها جزء لا يُقرأ، فاطلب صورة أوضح ولا تخترع أي بيانات أو أرقام. وإذا كانت المسألة ناقصة فاسأل عن الناقص.`
      : "";

    const systemPrompt = `أنت "المعلم الذكي" داخل منصة المهندس حسين علام، مدرس فيزياء لطلاب المرحلة الثانوية في مصر. الطالب في: ${grade}.

المنهج والمصطلحات:
- التزم بمنهج الفيزياء الرسمي لوزارة التربية والتعليم المصرية للصف الذي ذُكر، واستخدم المصطلحات والرموز والوحدات كما تُكتب في الكتاب المدرسي المصري (النظام الدولي SI).
- لا تشرح من خارج منهج الصف إلا إذا طلب الطالب ذلك صراحةً؛ وإذا كان السؤال خارج منهج صفه فاذكر ذلك بوضوح ثم اشرح باختصار أو وجّهه للدرس المناسب.
- لا تنسب معلومة إلى رقم صفحة أو درس أو امتحان معيّن في الكتاب ولا تدّعِ أنك اطلعت على كتاب الوزارة أو فيديوهات المدرس أو درجات الطالب؛ إن لم تكن متأكداً من موضع نقطة في المنهج فقل ذلك.

طريقة الحل (فكّر بدقة قبل الإجابة):
1. حدّد المطلوب والمعطيات ووحداتها، وحوّل الوحدات إلى SI عند اللزوم.
2. اكتب القانون المناسب واذكر سبب اختياره، ثم عوّض بالأرقام خطوة بخطوة.
3. احسب بدقة وراجع الناتج: الوحدة، منطقية القيمة، واتجاه الكميات المتجهة.
4. اذكر الإجابة النهائية بوضوح مع الوحدة.
5. اختم بسؤال قصير أو مسألة مشابهة تتأكد بها من فهم الطالب.
- إذا كانت المسألة ناقصة المعطيات أو غير واضحة فاسأل عن الناقص بدلاً من التخمين. وإذا لم تُعطَ قيمة عجلة الجاذبية فاذكر القيمة التي تفترضها (9.8 م/ث²).
- إذا طلب الطالب الحل مباشرة فاشرح أسلوب التفكير مع الحل ولا تكتفِ بالناتج.

الأسلوب: بالعربية المصرية المبسّطة، صبور ومشجّع، فقرات قصيرة وقوانين واضحة. إذا كان السؤال خارج الدراسة والفيزياء فأجب باختصار ووجّه الطالب للموضوع التعليمي.${imageRules}`;

    const userText = question || "اقرأ المسألة في الصورة واشرح حلها خطوة بخطوة.";
    const userContent = images.length > 0
      ? [{ type: "text", text: userText }, ...images.map((im) => ({ type: "image_url", image_url: { url: im.url } }))]
      : userText;
    const messages = [{ role: "system", content: systemPrompt }, ...safeHistory, { role: "user", content: userContent }];

    let sawRateLimit = false;
    let answer = "";
    let usedModel = "";
    let usedProvider = "";
    outer:
    for (const prov of chain) {
      for (const model of (images.length > 0 ? prov.vision : prov.models)) {
        const response = await fetch(prov.url, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${prov.key}` },
          body: JSON.stringify({ model, temperature: 0.3, messages, max_tokens: 2500 }),
        });
        const result = await response.json().catch(() => null);
        if (response.ok) {
          const a = result?.choices?.[0]?.message?.content;
          if (typeof a === "string" && a.trim()) { answer = a.trim(); usedModel = model; usedProvider = prov.id; break outer; }
          continue; // empty answer: try the next model
        }
        console.error("ai_error", prov.id, model, response.status, JSON.stringify(result?.error ?? {}).slice(0, 300));
        if (response.status === 429) sawRateLimit = true;
        if (response.status === 401 || response.status === 402 || response.status === 403 || response.status === 429) break; // key/credit/limit: next provider
        // 400/404 (unknown, retired or non-vision model) or 5xx: try the next model
      }
    }

    if (!answer) {
      return sawRateLimit
        ? reply(429, { ok: false, error: "الضغط على المدرس الذكي كبير حالياً. حاول بعد دقيقة." })
        : reply(502, { ok: false, error: images.length > 0 ? "تعذّر تحليل الصورة الآن. جرّب صورة أوضح أو اكتب المسألة نصاً." : "حصلت مشكلة أثناء توليد الشرح. حاول مرة أخرى." });
    }

    const paths: string[] = [];
    for (let i = 0; i < images.length; i++) {
      const p = await storeImage(code, i, images[i].mime, images[i].b64);
      if (p) paths.push(p);
    }
    await logChat(code, question || "(سؤال بصورة)", answer, paths);
    return reply(200, { ok: true, answer, model: usedModel, provider: usedProvider, remainingToday: g.remainingToday });
  } catch (_e) {
    return reply(502, { ok: false, error: "تعذّر الوصول للخدمة. حاول مرة أخرى." });
  }
});
