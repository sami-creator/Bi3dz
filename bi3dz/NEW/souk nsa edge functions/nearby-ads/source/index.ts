// nearby-ads — "الأقرب مني": الإحداثيات الدقيقة لا تغادر الخادم، والمسافة تُقرَّب للكيلومتر
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const J = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });
const PAGE = 20;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const { lat, lng, page, filters } = await req.json();
    const la = Number(lat), lo = Number(lng), pg = Math.max(0, parseInt(page, 10) || 0);
    if (!(la >= -90 && la <= 90) || !(lo >= -180 && lo <= 180)) return J({ error: 'BAD_COORDS' }, 400);
    const f = filters ?? {};
    const clean = {
      category_id: String(f.category_id ?? ''), subcategory_id: String(f.subcategory_id ?? ''),
      wilaya_ids: (f.wilaya_ids ?? []).map(Number).filter(Boolean), min_price: Number(f.min_price) || null, max_price: Number(f.max_price) || null,
      delivery: !!f.delivery, verified_only: !!f.verified_only
    };
    const c = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
    const { data, error } = await c.rpc('nearby_ads', { p_lat: la, p_lng: lo, p_limit: PAGE, p_offset: pg * PAGE, p_filters: clean });
    if (error) throw error;
    const items = (data ?? []).map((r: Record<string, unknown>) => ({ ...r, distance_km: Math.max(1, Math.round(Number(r.distance_km) || 0)) }));
    return J({ items, hasMore: items.length >= PAGE });
  } catch (e) {
    console.error('[nearby-ads]', e);
    return J({ error: 'FAILED' }, 500);
  }
});
