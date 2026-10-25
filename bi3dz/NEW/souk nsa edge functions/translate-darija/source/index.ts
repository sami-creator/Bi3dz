// translate-darija/index.ts — ترجمة العنوان والوصف إلى الدارجة الجزائرية عبر Groq
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `أنت مترجم متخصص في الدارجة الجزائرية.
مهمتك: ترجمة أي نص (عربي فصحى، فرنسي، إنجليزي، أو خليط بينهم، أو دارجة مكتوبة بالحروف الفرنسية) إلى الدارجة الجزائرية مكتوبة بالحروف العربية.

القواعد:
- اكتب الدارجة كما يتكلمها الجزائريون فعلاً، وليس ترجمة حرفية.
- استخدم الكلمات الدارجة الشائعة (راني، حابة، نشري، صباط، قندورة، واش، كيفاش، بزاف...).
- إذا كان النص أصلاً بالدارجة بحروف لاتينية، حوّله لحروف عربية مباشرة.
- لا تشرح، لا تضيف تعليقات. أرجع الترجمة فقط.
- إذا كان هناك اسم علم (شخص، مكان)، اكتبه كما هو أو بحروف عربية.
- حافظ على النبرة: إذا كان النص ودياً، اجعله ودياً. إذا كان رسمياً، اجعله رسمياً قدر الإمكان في الدارجة.
- da معناه دينار جزائري.
- ترجم العنوان والوصف كل واحد على حدة وأرجعهما بصيغة JSON: {"title":"...","description":"..."}`;

// مفتاح عشوائي من المصفوفة
function pickKey(keys: string[]): string {
  return keys[Math.floor(Math.random() * keys.length)];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    // التحقق من المستخدم
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } }
    );
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    // ──── حد الاستخدام: جدول translate_rate_limit ────
    const now = new Date();
    const dayStart = new Date(now); dayStart.setHours(0, 0, 0, 0);
    const minStart = new Date(now.getTime() - 60000);

    const { data: rateRows } = await supabase
      .from('translate_rate_limit')
      .select('created_at')
      .eq('user_id', user.id)
      .gte('created_at', dayStart.toISOString());

    const dayCount = rateRows?.length ?? 0;
    const minCount = rateRows?.filter(r => new Date(r.created_at) >= minStart).length ?? 0;

    if (dayCount >= 30) {
      return new Response(JSON.stringify({ error: 'rate_limit_day' }), { status: 429, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }
    if (minCount >= 2) {
      return new Response(JSON.stringify({ error: 'rate_limit_min' }), { status: 429, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    // ──── جلب الطلب ────
    const body = await req.json();
    const { title, description } = body;
    if (!title && !description) {
      return new Response(JSON.stringify({ error: 'missing_content' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    // ──── مفاتيح Groq: اختيار عشوائي ────
    const keysRaw = Deno.env.get('GROQ_API_KEYS') ?? '';
    const keys = keysRaw.split(',').map(k => k.trim()).filter(Boolean);
    if (!keys.length) {
      return new Response(JSON.stringify({ error: 'no_api_key' }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }
    const apiKey = pickKey(keys);

    // ──── طلب Groq ────
    const userMessage = `العنوان: ${title || ''}\nالوصف: ${description || ''}`;

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.3,
        max_tokens: 1024
      })
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      console.error('[translate-darija] Groq error:', groqRes.status, errText);
      return new Response(JSON.stringify({ error: 'groq_error' }), { status: 502, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    const groqData = await groqRes.json();
    const content = groqData?.choices?.[0]?.message?.content?.trim() ?? '';

    // استخراج JSON من الرد
    let translated: { title: string; description: string };
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      translated = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    } catch {
      // fallback: إذا لم يرجع JSON، نعامل الكل كوصف
      translated = { title: title || '', description: content };
    }

    // ──── تسجيل الاستخدام ────
    await supabase.from('translate_rate_limit').insert({ user_id: user.id });

    return new Response(JSON.stringify({ title: translated.title ?? title, description: translated.description ?? description }), {
      status: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' }
    });

  } catch (e) {
    console.error('[translate-darija] unexpected:', e);
    return new Response(JSON.stringify({ error: 'server_error' }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }
});
