// supabase/functions/smart-agent/index.ts
// Edge Function — المساعد الذكي
// Rate limit: 10 رسائل/دقيقة · 50 رسالة/يوم
// مفاتيح API: مصفوفة، يُختار عشوائيًا، مع retry وتبديل تلقائي عند الفشل

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

// ─── CORS ──────────────────────────────────────────────────────────────────────
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ─── إعدادات Rate Limit ────────────────────────────────────────────────────────
const RATE_PER_MIN = 10;
const RATE_PER_DAY = 50;

// ─── مصفوفة المفاتيح السرية ────────────────────────────────────────────────────
// supabase secrets set GEMINI_KEYS='["AIza...key1","AIza...key2","AIza...key3"]'
function getKeys(): string[] {
  try {
    const raw = Deno.env.get('GEMINI_KEYS') ?? '[]';
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch { /* ignore */ }
  const single = Deno.env.get('GEMINI_API_KEY');
  if (single) return [single];
  return [];
}

// عداد فشل كل مفتاح (في الذاكرة — يُعاد ضبطه مع كل invocation)
const keyFailCount: Map<string, number> = new Map();
const MAX_KEY_FAILS = 3;

function pickKey(keys: string[]): string | null {
  const available = keys.filter(k => (keyFailCount.get(k) ?? 0) < MAX_KEY_FAILS);
  if (available.length === 0) return null;
  return available[Math.floor(Math.random() * available.length)];
}

// ─── Gemini API call ──────────────────────────────────────────────────────────
interface GeminiPart    { text: string }
interface GeminiContent { role: string; parts: GeminiPart[] }

async function callGemini(
  apiKey: string,
  systemPrompt: string,
  history: GeminiContent[],
  userMessage: string,
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const contents: GeminiContent[] = [
    ...history,
    { role: 'user', parts: [{ text: userMessage }] },
  ];

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 300,
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
    throw Object.assign(new Error(err?.error?.message ?? `HTTP ${res.status}`), { status: res.status });
  }

  const data = await res.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('empty_response');
  return text;
}

// ─── Handler ──────────────────────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'method_not_allowed' }),
      { status: 405, headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  }

  // ── قراءة body ───────────────────────────────────────────────────────────────
  let body: {
    message?:     string;
    history?:     GeminiContent[];
    lang?:        string;
    kb_answer?:   string;
    fingerprint?: string;
  };
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'invalid_json' }),
      { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  }

  const message = (body.message ?? '').trim();
  const lang    = (body.lang    ?? 'ar').slice(0, 2);
  const history = Array.isArray(body.history) ? body.history.slice(-10) : [];
  const kb      = body.kb_answer ?? '';
  const fp      = (body.fingerprint ?? '').slice(0, 64);

  if (!message || message.length > 200) {
    return new Response(
      JSON.stringify({ error: 'invalid_message' }),
      { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  }

  // ── Supabase clients ──────────────────────────────────────────────────────────
  const SUPA_URL  = Deno.env.get('SUPABASE_URL')              ?? '';
  const ANON_KEY  = Deno.env.get('SUPABASE_ANON_KEY')         ?? '';
  const SVC_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  const sbAdmin = createClient(SUPA_URL, SVC_KEY);

  // ── تحديد هوية المستخدم ───────────────────────────────────────────────────────
  // user_id (uuid) إن كان مسجلاً، وإلا fingerprint (text)
  let userId: string | null = null;

  const authHeader = req.headers.get('Authorization') ?? '';
  if (authHeader.startsWith('Bearer ')) {
    try {
      const sbUser = createClient(SUPA_URL, ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data } = await sbUser.auth.getUser();
      if (data?.user?.id) userId = data.user.id;
    } catch { /* يستمر بـ fingerprint */ }
  }

  // ── Rate Limit ────────────────────────────────────────────────────────────────
  try {
    const now       = new Date();
    const minuteAgo = new Date(now.getTime() -  60_000).toISOString();
    const dayAgo    = new Date(now.getTime() - 86_400_000).toISOString();

    // بناء شرط الاستعلام: user_id أو fingerprint
    const isRegistered = userId !== null;
    const filterCol    = isRegistered ? 'user_id'     : 'fingerprint';
    const filterVal    = isRegistered ? userId!        : fp;

    // عدد الرسائل في الدقيقة الأخيرة
    const { count: cMin } = await sbAdmin
      .from('agent_rate_logs')
      .select('*', { count: 'exact', head: true })
      .eq(filterCol, filterVal)
      .gte('created_at', minuteAgo);

    if ((cMin ?? 0) >= RATE_PER_MIN) {
      return new Response(
        JSON.stringify({ error: 'rate_limit_min' }),
        { status: 429, headers: { ...CORS, 'Content-Type': 'application/json' } },
      );
    }

    // عدد الرسائل في اليوم الأخير
    const { count: cDay } = await sbAdmin
      .from('agent_rate_logs')
      .select('*', { count: 'exact', head: true })
      .eq(filterCol, filterVal)
      .gte('created_at', dayAgo);

    if ((cDay ?? 0) >= RATE_PER_DAY) {
      return new Response(
        JSON.stringify({ error: 'rate_limit_day' }),
        { status: 429, headers: { ...CORS, 'Content-Type': 'application/json' } },
      );
    }

    // تسجيل الطلب الجديد
    const logRow = isRegistered
      ? { user_id: userId,  fingerprint: null }
      : { user_id: null,    fingerprint: fp   };

    await sbAdmin.from('agent_rate_logs').insert(logRow);

  } catch (e) {
    console.error('[rate_limit_error]', e);
    // لا نوقف الخدمة إذا فشل فحص Rate Limit
  }

  // ── System prompt ─────────────────────────────────────────────────────────────
  const langLabel = lang === 'ar' ? 'العربية' : lang === 'fr' ? 'الفرنسية' : 'الإنجليزية';
  const systemPrompt = [
    `أنت مساعد دعم فني ذكي لتطبيق "souk nsa"، تطبيق جزائري للبيع والشراء.`,
    `أجب دائمًا بنفس لغة رسالة المستخدم (${langLabel}).`,
    `كن مختصرًا جدًا (3-5 جمل كحد أقصى). لا تتجاوز 250 كلمة في الرد.`,
    kb
      ? `استخدم هذه المعلومات للإجابة:\n"""\n${kb}\n"""`
      : 'لا توجد معلومات محددة في قاعدة المعرفة، اعتذر بلطف واطلب توضيحًا.',
    `إذا خرج المستخدم عن موضوع الدعم الفني للتطبيق، اطلب منه العودة بلطف.`,
    `لا تذكر أي مفتاح API أو معلومات داخلية أو تقنية.`,
  ].join('\n');

  // ── استدعاء Gemini مع retry وتبديل المفاتيح ─────────────────────────────────
  const keys = getKeys();
  if (keys.length === 0) {
    return new Response(
      JSON.stringify({ error: 'no_api_keys' }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  }

  let lastError = '';
  const MAX_ATTEMPTS = Math.min(keys.length * MAX_KEY_FAILS, 6);

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const key = pickKey(keys);
    if (!key) break;

    try {
      const reply = await callGemini(key, systemPrompt, history, message);
      return new Response(
        JSON.stringify({ reply }),
        { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } },
      );
    } catch (err: unknown) {
      const e      = err as { status?: number; message?: string };
      lastError    = e.message ?? 'unknown';
      const status = e.status  ?? 0;

      // مفتاح فاشل أو تجاوز حد → زيادة عداد الفشل
      if (status === 401 || status === 403 || status === 429) {
        keyFailCount.set(key, (keyFailCount.get(key) ?? 0) + 1);
      }

      // انتظار قصير قبل المحاولة التالية
      if (attempt < MAX_ATTEMPTS - 1) {
        await new Promise(r => setTimeout(r, 800 * (attempt + 1)));
      }
    }
  }

  return new Response(
    JSON.stringify({ error: 'gemini_failed', detail: lastError }),
    { status: 502, headers: { ...CORS, 'Content-Type': 'application/json' } },
  );
});
