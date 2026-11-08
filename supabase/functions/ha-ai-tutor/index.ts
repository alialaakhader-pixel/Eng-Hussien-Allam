import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// AI tutor. Secrets (server side only): OPENAI_API_KEY, optional OPENAI_MODEL (default gpt-4o-mini).
// Student identity + rate limits are enforced by the ha_ai_gate RPC (code+device, or the email-account JWT).
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: cors });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply(405, { ok: false, error: "الطريقة غير مسموحة." });

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  // The publishable key is public; fall back to the one the browser sent if the env var is not injected.
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || req.headers.get("apikey") || "";
  if (!apiKey) return reply(503, { ok: false, code: "NO_OPENAI_KEY", error: "خدمة المدرس الذكي لم تُفعّل بعد. يلزم ضبط مفتاح OpenAI في أسرار الخادم." });
  if (!supabaseUrl || !anonKey) return reply(503, { ok: false, code: "NO_SUPABASE_ENV", error: "إعدادات التحقق من الطالب غير مكتملة على الخادم." });

  let body: any;
  try { body = await req.json(); } catch { return reply(400, { ok: false, error: "تعذر قراءة الطلب." }); }

  const code = String(body?.code ?? "").trim().slice(0, 80);
  const device = String(body?.device ?? "").trim().slice(0, 120);
  const question = String(body?.question ?? "").trim();
  const grade = String(body?.grade ?? "").trim().slice(0, 80);
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

    const systemPrompt = `أنت "المعلم الذكي" داخل منصة المهندس حسين علام، مدرس فيزياء لطلاب المرحلة الثانوية في مصر. تحدث بالعربية المصرية الواضحة، وكن صبوراً ومشجعاً. مستوى الطالب: ${grade || "ثانوي"}.\nاشرح المفاهيم من الصفر عند الحاجة، وقسّم الحل إلى خطوات مرتبة، واكتب القانون ثم عوّض بالأرقام ثم اذكر الوحدة وتحقق من الناتج. لا تخترع معلومات من منهج المدرس غير الموجودة في السؤال. إذا كانت المسألة ناقصة المعطيات فاسأل عن الناقص بدلاً من التخمين. لا تعطِ الإجابة النهائية فقط؛ اشرح طريقة التفكير ثم اختم بسؤال قصير يتأكد من الفهم. إذا كان السؤال خارج الدراسة والفيزياء فأجب باختصار ووجّه الطالب للموضوع التعليمي. لا تدّعِ أنك اطلعت على فيديو أو ملف أو درجات الطالب ما لم تُرسل لك صراحةً.`;

    const model = Deno.env.get("OPENAI_MODEL") || "gpt-4o-mini";
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: systemPrompt }, ...safeHistory, { role: "user", content: question }],
        max_tokens: 1100,
      }),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) {
      console.error("openai_error", response.status, JSON.stringify(result?.error ?? {}).slice(0, 300));
      return response.status === 429
        ? reply(429, { ok: false, error: "الضغط على المدرس الذكي كبير حالياً. حاول بعد دقيقة." })
        : reply(502, { ok: false, error: "حصلت مشكلة أثناء توليد الشرح. حاول مرة أخرى." });
    }
    const answer = result?.choices?.[0]?.message?.content;
    if (typeof answer !== "string" || !answer.trim()) return reply(502, { ok: false, error: "لم يصل رد صالح من نموذج الذكاء الاصطناعي." });
    return reply(200, { ok: true, answer: answer.trim(), model, remainingToday: g.remainingToday });
  } catch (_e) {
    return reply(502, { ok: false, error: "تعذّر الوصول للخدمة. حاول مرة أخرى." });
  }
});
