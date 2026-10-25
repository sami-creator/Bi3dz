/**
 * moderate-image — Supabase Edge Function
 * تستقبل صورة (binary body) وتُعيد وصفًا نصيًا من نموذج الرؤية
 * ثم يُحلَّل الوصف على جانب العميل بـ moderate.js
 *
 * استخدام: POST /functions/v1/moderate-image
 *   body : binary (الصورة الخام — JPEG / PNG / WebP)
 *   رد   : { ok, description?, error? }
 *
 * متغيرات البيئة المطلوبة (Supabase Secrets):
 *   OPENAI_API_KEY   — مفتاح OpenAI لاستخدام GPT-4o-mini Vision
 *   (اختياري) MODERATE_SECRET — secret header للتحقق من الطالب
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const OPENAI_URL  = 'https://api.openai.com/v1/chat/completions';
const MODEL       = 'gpt-4o-mini';
const MAX_TOKENS  = 300;
const TIMEOUT_MS  = 10_000;

const SYSTEM_PROMPT = `You are a content moderation assistant.
Analyze the image and write a concise English description (2-5 sentences) of what you see.
Focus on: nudity/sexual content, violence/gore, weapons, drugs/drug paraphernalia,
alcohol, tobacco, hate symbols, disturbing or graphic content.
Be factual and objective. Do not censor words — use precise terminology.
If the image is benign, just describe it normally.`;

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-moderate-secret',
};

serve(async (req: Request) => {

  /* ---- CORS preflight ---- */
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ ok: false, error: 'Method not allowed' }, 405);
  }

  /* ---- اختياري: التحقق من secret ---- */
  const secret = Deno.env.get('MODERATE_SECRET');
  if (secret) {
    const provided = req.headers.get('x-moderate-secret') || '';
    if (provided !== secret) return json({ ok: false, error: 'Forbidden' }, 403);
  }

  /* ---- قراءة الصورة ---- */
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) return json({ ok: false, error: 'Server misconfigured' }, 500);

  let imageBytes: Uint8Array;
  try {
    const buf = await req.arrayBuffer();
    if (!buf.byteLength) return json({ ok: false, error: 'Empty body' }, 400);
    imageBytes = new Uint8Array(buf);
  } catch {
    return json({ ok: false, error: 'Failed to read body' }, 400);
  }

  /* ---- تحديد نوع الصورة من magic bytes ---- */
  const mime = detectMime(imageBytes);
  if (!mime) return json({ ok: false, error: 'Unsupported image type' }, 415);

  /* ---- تحويل إلى base64 ---- */
  const b64 = toBase64(imageBytes);

  /* ---- استدعاء GPT-4o-mini Vision ---- */
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const openaiRes = await fetch(OPENAI_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              { type: 'text',      text: 'Describe this image for content moderation.' },
              { type: 'image_url', image_url: { url: `data:${mime};base64,${b64}`, detail: 'low' } }
            ]
          }
        ]
      })
    });
    clearTimeout(timer);

    if (!openaiRes.ok) {
      const err = await openaiRes.text();
      console.error('[moderate-image] OpenAI error:', err);
      /* فشل النموذج → نسمح بالرفع (fail-open) */
      return json({ ok: true, skipped: true, description: '' });
    }

    const data  = await openaiRes.json();
    const description: string = data?.choices?.[0]?.message?.content?.trim() ?? '';

    return json({ ok: true, result: { description } });

  } catch (e) {
    clearTimeout(timer);
    console.error('[moderate-image] fetch error:', e);
    /* فشل الشبكة / timeout → fail-open */
    return json({ ok: true, skipped: true, description: '' });
  }
});

/* ---- helpers ---- */
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

function detectMime(bytes: Uint8Array): string | null {
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return 'image/jpeg';
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return 'image/png';
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return 'image/webp';
  return null;
}

function toBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
