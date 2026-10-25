// smart-search — يحوّل جملة البحث إلى فلاتر عبر Mistral، مع كاش في search_cache.
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
const J = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

// ===== مصفوفة المفاتيح =====
const KEYS = [
  Deno.env.get('MISTRAL_API_KEY_1'),
  Deno.env.get('MISTRAL_API_KEY_2'),
  Deno.env.get('MISTRAL_API_KEY_3'),
  Deno.env.get('MISTRAL_API_KEY_4'),
].filter(Boolean) as string[];

function getKey(exclude: Set<string>): string {
  const available = KEYS.filter(k => !exclude.has(k));
  if (!available.length) throw new Error('NO_KEYS_AVAILABLE');
  return available[Math.floor(Math.random() * available.length)];
}

// ===== الأصناف =====
const CATS: Record<string, string[]> = {
  clothes_wedding: ['karakou', 'gandoura_thakila', 'gandoura_constantine', 'chedda', 'takchita', 'bridal'],
  clothes_work:    ['suit', 'shirt', 'abaya'],
  clothes_beach:   ['swim', 'burkini', 'cover'],
  clothes_evening: ['dress', 'jump'],
  clothes_girls:   ['g_dress', 'g_set'],
  shoes:           ['heels', 'flats', 'sneakers', 'wedding_shoes'],
  products:        ['face_wash', 'shampoo', 'makeup_p', 'hair_dye', 'wig', 'nails_p'],
  services:        ['haircut', 'nails', 'care', 'makeup', 'dj', 'cooking', 'events', 'rental', 'sweets']
};

const ALLOWED_COLORS = ['أبيض','أسود','أحمر','وردي','ذهبي','أزرق','أخضر','بيج','فضي','بنفسجي','برتقالي','أصفر','بني','رمادي','كحلي','تركوازي'];
const ALLOWED_SIZES  = ['xs','s','m','l','xl','xxl','xxxl','36','37','38','39','40','41','42','43','44','45'];

// ===== System Prompt =====
const SYSTEM = `You convert an Algerian marketplace search sentence (Arabic/French/English/Darija) into JSON filters.
Return ONLY a JSON object with these fields:
{
  "category": string|null,
  "subcategory": string|null,
  "min_price": number|null,
  "max_price": number|null,
  "wilaya": number|null,
  "commune": string|null,
  "colors": string[],
  "sizes": string[],
  "keywords": string
}
Allowed categories and subcategories: ${JSON.stringify(CATS)}.
Allowed sizes (use only these, lowercase): ${JSON.stringify(ALLOWED_SIZES)}.

CRITICAL: colors must ALWAYS be in Arabic only, chosen from this exact list: ${JSON.stringify(ALLOWED_COLORS)}.
Examples: "noire" → "أسود", "rouge" → "أحمر", "blanche" → "أبيض", "bleue" → "أزرق", "verte" → "أخضر", "rose" → "وردي", "orange" → "برتقالي", "jaune" → "أصفر", "marron" → "بني", "grise" → "رمادي", "violette" → "بنفسجي", "dorée" → "ذهبي", "argentée" → "فضي", "turquoise" → "تركوازي", "navy" → "كحلي", "beige" → "بيج".

Prices are in Algerian dinars (DA). "مليون"/"million" in Algerian speech = centimes (1 million centimes = 10000 DA). A number followed by "دج"/"DA" is already dinars. Written numbers like "ثلاث مية وخمسين" = 350.
"wilaya" is the official wilaya number 1-58 if a place name (wilaya or daira) is mentioned.
"commune" is the commune/municipality name in lowercase latin if mentioned (e.g. "sidi ammar").
"colors" and "sizes" are arrays — include multiple values if mentioned.
"keywords" keeps only the meaningful item words (max 100 chars).
Use null or [] when unknown. No extra text.`;

const pos = (v: unknown) => { const n = Number(v); return Number.isFinite(n) && n > 0 && n < 1e11 ? Math.round(n) : null; };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const { q } = await req.json();
    const query = String(q ?? '').replace(/\s+/g, ' ').trim().slice(0, 100);
    if (query.length < 2) return J({ error: 'EMPTY' }, 400);
    const key = query.toLowerCase();
    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // كاش
    const { data: hit } = await db.from('search_cache').select('id,json_result,hits').eq('query', key).maybeSingle();
    if (hit) {
      db.from('search_cache').update({ hits: (hit.hits ?? 0) + 1 }).eq('id', hit.id).then(() => {});
      return J({ filters: hit.json_result, cached: true });
    }

    // استدعاء Mistral مع تدوير المفاتيح
    const tried = new Set<string>();
    let raw: Record<string, unknown> | null = null;

    while (tried.size < KEYS.length) {
      const apiKey = getKey(tried);
      tried.add(apiKey);
      try {
        const ctl = new AbortController();
        const to = setTimeout(() => ctl.abort(), 8000);
        const r = await fetch('https://api.mistral.ai/v1/chat/completions', {
          method: 'POST', signal: ctl.signal,
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: 'ministral-14b-latest', temperature: 0, max_tokens: 200,
            response_format: { type: 'json_object' },
            messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: query }]
          })
        });
        clearTimeout(to);
        if (r.ok) { raw = JSON.parse((await r.json()).choices[0].message.content); break; }
        console.warn('[smart-search] key failed status:', r.status);
      } catch (err) {
        console.warn('[smart-search] key error:', (err as Error).message);
      }
    }

    if (!raw) throw new Error('ALL_KEYS_FAILED');

    // التحقق من كل حقل
    const category    = CATS[raw.category as string] ? (raw.category as string) : null;
    const subcategory = category && CATS[category].includes(raw.subcategory as string) ? (raw.subcategory as string) : null;
    let min_price = pos(raw.min_price), max_price = pos(raw.max_price);
    if (min_price && max_price && min_price > max_price) [min_price, max_price] = [max_price, min_price];
    const w = Number(raw.wilaya);
    const colors = Array.isArray(raw.colors) ? (raw.colors as string[]).filter(c => ALLOWED_COLORS.includes(c)) : [];
    const sizes  = Array.isArray(raw.sizes)  ? (raw.sizes  as string[]).filter(s => ALLOWED_SIZES.includes(String(s).toLowerCase())) : [];
    const commune = raw.commune ? String(raw.commune).toLowerCase().replace(/<[^>]*>/g, '').slice(0, 80) : null;

    const filters = {
      category, subcategory, min_price, max_price,
      wilaya:   Number.isInteger(w) && w >= 1 && w <= 58 ? w : null,
      commune, colors, sizes,
      keywords: String(raw.keywords ?? '').replace(/<[^>]*>/g, '').slice(0, 100)
    };

    await db.from('search_cache').insert({ query: key, json_result: filters, hits: 1 });
    return J({ filters });

  } catch (e) {
    console.error('[smart-search]', e);
    return J({ error: 'FAILED', detail: (e as Error).message }, 502);
  }
});
