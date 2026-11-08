import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// AI tutor. Secrets (server side only): any of a Groq (gsk_...), xAI (xai-...) or OpenAI (sk-...) key; optional GROQ_MODEL / XAI_MODEL / OPENAI_MODEL.
// Student identity + rate limits are enforced by the ha_ai_gate RPC (code+device, or the email-account JWT).
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: cors });

// The provider is detected from the key itself (gsk_ = Groq, xai- = xAI Grok, sk- = OpenAI), not from the secret's name,
// so any secret name works. Preference order: Groq, xAI, OpenAI; a provider that is out of credit falls through to the next.
type Provider = { id: "groq" | "xai" | "openai"; key: string; url: string; models: string[] };

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
    models: m(Deno.env.get("GROQ_MODEL"), "openai/gpt-oss-120b", "llama-3.3-70b-versatile") });
  if (found.xai) list.push({ id: "xai", key: found.xai, url: "https://api.x.ai/v1/chat/completions",
    models: m(Deno.env.get("XAI_MODEL"), "grok-4", "grok-3") });
  if (found.openai) list.push({ id: "openai", key: found.openai, url: "https://api.openai.com/v1/chat/completions",
    models: m(Deno.env.get("OPENAI_MODEL"), "gpt-4o") });
  return list;
};

const GRADE_NAMES: Record<string, string> = {
  "1ث": "الصف الأول الثانوي",
  "2ث": "الصف الثاني الثانوي",
  "3ث": "الصف الثالث الثانوي (الثانوية العامة)",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  // Health check: reports only whether the secrets exist (never their values).
  if (req.method === "GET") {
    return reply(200, {
      ok: true,
      service: "ha-ai-tutor",
      providers: providers().map((p) => ({ id: p.id, models: p.models })),
      supabaseUrlConfigured: !!Deno.env.get("SUPABASE_URL"),
    });
  }
  if (req.method !== "POST") return reply(405, { ok: false, error: "الطريقة غير مسموحة." });

  const chain = providers();
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
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

  if (!code || !device) return reply(401, { ok: false, error: "سجّل دخول الطالب أولاً حتى نتحقق من حسابك." });
  if (question.length < 2 || question.length > 2500) return reply(400, { ok: false, error: "اكتب سؤالاً من 2 إلى 2500 حرف." });

  const auth = req.headers.get("authorization") ?? "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  const userToken = bearer && bearer !== anonKey ? bearer : anonKey;

  try {
    const gate = await fetch(`${supabaseUrl}/rest/v1/rpc/ha_ai_gate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: anonKey, Authorization: `Bearer ${userToken}` },
      body: JSON.stringify({ p_code: code, p_device: device }),
    });
    if (!gate.ok) return reply(401, { ok: false, error: "تعذر التحقق من حساب الطالب." });
    const g = await gate.json();
    if (!g?.ok) {
      if (g?.error === "RATE_LIMIT") return reply(429, { ok: false, code: "RATE_LIMIT", error: "بعتّ أسئلة كتير بسرعة. استنى دقيقة وحاول تاني." });
      if (g?.error === "DAILY_LIMIT") return reply(429, { ok: false, code: "DAILY_LIMIT", error: "وصلت للحد اليومي من أسئلة المدرس الذكي. كمّل بكرة." });
      return reply(401, { ok: false, error: "بيانات الدخول غير صحيحة أو هذا الجهاز غير مسجل." });
    }

    const safeHistory = history
      .filter((m: any) => m && ["user", "assistant"].includes(m.role) && typeof m.content === "string")
      .map((m: any) => ({ role: m.role, content: m.content.slice(0, 2500) }));

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

الأسلوب: بالعربية المصرية المبسّطة، صبور ومشجّع، فقرات قصيرة وقوانين واضحة. إذا كان السؤال خارج الدراسة والفيزياء فأجب باختصار ووجّه الطالب للموضوع التعليمي.`;

    const messages = [{ role: "system", content: systemPrompt }, ...safeHistory, { role: "user", content: question }];
    let sawRateLimit = false;
    for (const prov of chain) {
      for (const model of prov.models) {
        const response = await fetch(prov.url, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${prov.key}` },
          body: JSON.stringify({ model, temperature: 0.3, messages, max_tokens: 2500 }),
        });
        const result = await response.json().catch(() => null);
        if (response.ok) {
          const answer = result?.choices?.[0]?.message?.content;
          if (typeof answer === "string" && answer.trim()) {
            return reply(200, { ok: true, answer: answer.trim(), model, provider: prov.id, remainingToday: g.remainingToday });
          }
          continue; // empty answer: try the next model
        }
        console.error("ai_error", prov.id, model, response.status, JSON.stringify(result?.error ?? {}).slice(0, 300));
        if (response.status === 429) sawRateLimit = true;
        if (response.status === 401 || response.status === 402 || response.status === 403 || response.status === 429) break; // key/credit/limit: next provider
        // 400/404 (unknown or retired model) or 5xx: try the next model
      }
    }
    return sawRateLimit
      ? reply(429, { ok: false, error: "الضغط على المدرس الذكي كبير حالياً. حاول بعد دقيقة." })
      : reply(502, { ok: false, error: "حصلت مشكلة أثناء توليد الشرح. حاول مرة أخرى." });
  } catch (_e) {
    return reply(502, { ok: false, error: "تعذّر الوصول للخدمة. حاول مرة أخرى." });
  }
});
