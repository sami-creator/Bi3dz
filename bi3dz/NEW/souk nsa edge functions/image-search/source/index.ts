/**
 * image-search — Supabase Edge Function
 * تستقبل صورة كـ base64 داخل JSON، تتحقق من المستخدم والحصة اليومية (10/يوم)،
 * ترسل الصورة لـ Cloudflare worker، تُعيد tags + results
 *
 * POST /functions/v1/image-search
 *   body : { image: string (base64), mime: string }
 *   رد   : { ok, remaining, tags, results } | { error }
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

const WORKER_URL  = 'https://nsfw-checker.houssemhoussam25.workers.dev';
const DAILY_LIMIT = 10;
const TIMEOUT_MS  = 45_000;

const cors = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const J = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

/* ================================================================
   قاموس الكلمات المحظورة (نفس moderate.js)
   ================================================================ */
const CATEGORIES: Record<string, { label: string; words: Record<string, number> }> = {
  sexual:  { label: 'محتوى إباحي',  words: { nude:10,nudity:10,naked:10,explicit:9,pornographic:10,pornography:10,porn:10,genitals:10,penis:10,vagina:10,vulva:10,phallus:10,scrotum:10,anus:9,buttocks:8,nipple:9,nipples:9,areola:9,topless:9,bottomless:9,intercourse:10,orgasm:10,masturbation:10,ejaculation:10,erection:10,blowjob:10,fellatio:10,cunnilingus:10,anal:9,penetration:10,threesome:10,orgy:10,erotic:8,sexual:8,sex:8,seductive:6,provocative:6,revealing:5,skimpy:5,lingerie:6,bikini:3,underwear:5,cleavage:6,breast:7,breasts:7,bra:4,thong:6,intimate:5,sensual:6,aroused:7,lust:7,lustful:7,suggestive:6,seduction:6,voyeur:9,onlyfans:9,escort:8,prostitute:10,prostitution:10,stripper:8,striptease:9 } },
  drugs:   { label: 'مخدرات',       words: { cocaine:10,heroin:10,marijuana:9,cannabis:9,weed:8,meth:10,methamphetamine:10,crack:9,ecstasy:9,mdma:10,lsd:10,ketamine:9,fentanyl:10,oxycodone:9,amphetamine:9,morphine:8,opium:9,hashish:9,khat:7,shrooms:8,psychedelics:8,dmt:10,snort:8,inject:7,overdose:9,syringe:8,needle:6,bong:7,drug:9,drugs:9,narcotic:9,narcotics:9,dope:7,pills:6,pill:5,powder:4 } },
  violence:{ label: 'عنف',          words: { blood:7,bloody:7,gore:10,gory:9,wound:7,wounds:7,injury:6,bleeding:7,bruise:5,laceration:7,severed:9,decapitated:10,dismembered:10,mutilated:10,gun:6,rifle:7,pistol:6,shotgun:7,knife:6,machete:8,grenade:8,bomb:8,explosive:8,weapon:7,weapons:7,murder:9,kill:7,killing:8,slaughter:9,massacre:10,execution:9,torture:10,assault:7,stab:8,stabbing:8,shooting:7,dead:6,corpse:9,skull:6,violence:8,brutal:8,beating:7 } },
  meds:    { label: 'أدوية مشبوهة', words: { xanax:8,valium:7,tramadol:8,codeine:7,oxycontin:9,hydrocodone:9,counterfeit:8 } },
  hate:    { label: 'كراهية',       words: { racist:9,racism:9,nazi:10,fascist:8,antisemitic:9,kkk:10,genocide:10,hate_speech:9,bigot:7,xenophobic:8,islamophobic:8,homophobic:8 } },
  alcohol: { label: 'كحول',         words: { alcohol:5,drunk:6,intoxicated:7,beer:4,wine:4,vodka:5,whiskey:5,liquor:5 } },
  tobacco: { label: 'تبغ',          words: { cigarette:5,cigarettes:5,smoking:5,tobacco:5,cigar:5,vape:4,vaping:5,hookah:4,shisha:4 } },
  other:   { label: 'محتوى مزعج',  words: { disturbing:6,graphic:5,offensive:5,disgusting:5,grotesque:7,shocking:5,inappropriate:5 } },
};

const STOP_WORDS = new Set(['the','a','an','is','are','was','were','be','been','being','have','has','had','do','does','did','will','would','could','should','may','might','shall','can','it','its','this','that','these','those','i','we','you','he','she','they','me','him','her','us','them','my','your','his','our','their','what','which','who','when','where','why','how','all','each','every','both','few','more','most','other','some','such','no','not','only','same','so','than','too','very','just','as','at','by','for','in','of','on','to','up','and','but','or','if','with','about','into','through','before','after','above','below','from','out','off','over','under','image','features','shows','wearing','placed','surface','possibly','making','sitting','standing','lying','seen','appears','looks','seem','showing']);

function analyzeText(text: string): { verdict: string; reasons: string[] } {
  const lower = text.toLowerCase();
  let totalScore = 0; const reasons: string[] = [];
  for (const cat of Object.values(CATEGORIES)) {
    let catScore = 0;
    for (const [word, weight] of Object.entries(cat.words)) {
      const matches = lower.match(new RegExp(`\\b${word.replace(/_/g, '\\s+')}\\b`, 'g'));
      if (matches) catScore += (weight as number) * matches.length;
    }
    if (catScore > 0) { totalScore += catScore; reasons.push(cat.label); }
  }
  let verdict = 'SAFE';
  if      (totalScore >= 10) verdict = 'UNSAFE';
  else if (totalScore >= 4)  verdict = 'WARNING';
  return { verdict, reasons };
}

function extractTags(text: string): string[] {
  if (!text) return [];
  const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !STOP_WORDS.has(w));
  const freq: Record<string, number> = {};
  words.forEach(w => { freq[w] = (freq[w] || 0) + 1; });
  return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([w]) => w);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return J({ error: 'METHOD_NOT_ALLOWED' }, 405);

  /* ---- التحقق من المستخدم ---- */
  const url  = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const srk  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const uc = createClient(url, anon, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
  const { data: { user } } = await uc.auth.getUser();
  if (!user) return J({ error: 'UNAUTH' }, 401);

  /* ---- قراءة الجسم ---- */
  let b64 = '', mime = 'image/jpeg';
  try {
    const body = await req.json();
    b64  = body.image || '';
    mime = body.mime  || 'image/jpeg';
    if (!b64) return J({ error: 'EMPTY_BODY' }, 400);
  } catch {
    return J({ error: 'INVALID_JSON' }, 400);
  }

  /* ---- التحقق من الحصة اليومية ---- */
  const db    = createClient(url, srk);
  const today = new Date().toISOString().slice(0, 10);

  const { data: log } = await db.from('image_search_logs')
    .select('count').eq('user_id', user.id).eq('search_date', today).maybeSingle();

  const used      = log ? Number(log.count) : 0;
  const remaining = Math.max(0, DAILY_LIMIT - used);
  if (remaining <= 0) return J({ error: 'LIMIT_REACHED', remaining: 0 }, 429);

  /* ---- تحويل base64 إلى Uint8Array ---- */
  const bin = atob(b64);
  const imageBytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) imageBytes[i] = bin.charCodeAt(i);

  /* ---- إرسال الصورة للـ Cloudflare worker ---- */
  let description = '';
  try {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const res   = await fetch(WORKER_URL, {
      method: 'POST',
      body:   imageBytes,
      headers: { 'Content-Type': mime },
      signal: ctrl.signal
    }).finally(() => clearTimeout(timer));
    if (res.ok) {
      const data = await res.json();
      description = (data.result && data.result.description) || '';
    }
  } catch {
    /* fail-open */
  }

  /* ---- تحليل الوصف ---- */
  if (description) {
    const { verdict, reasons } = analyzeText(description);
    if (verdict === 'UNSAFE') return J({ ok: false, verdict, reasons, remaining });
  }

  const tags = extractTags(description);

  /* ---- تسجيل المحاولة ---- */
  await db.rpc('increment_image_search_log', { p_user: user.id, p_date: today });
  const newRemaining = remaining - 1;

  /* ---- البحث بالكلمات المفتاحية ---- */
  let results: { ad_id: string; match_count: number }[] = [];
  if (tags.length) {
    const { data, error } = await db.rpc('search_by_image_tags', { p_tags: tags });
    if (!error) results = data || [];
  }

  return J({ ok: true, remaining: newRemaining, tags, results });
});
