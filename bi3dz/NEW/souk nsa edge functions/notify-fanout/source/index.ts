// notify-fanout — توزيع الإشعارات: إعلان جديد يطابق تنبيهات، انخفاض سعر، تم البيع (يُستدعى من الخادم فقط)
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  const url = Deno.env.get('SUPABASE_URL')!, srk = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  if (req.headers.get('Authorization') !== `Bearer ${srk}`) return new Response('forbidden', { status: 403 });
  const db = createClient(url, srk);
  try {
    const { type, ad_id } = await req.json();
    const { data: ad } = await db.from('ads').select('id,user_id,title,price,discount_pct,subcategory_id,wilaya_id').eq('id', ad_id).single();
    if (!ad) return new Response('no ad', { status: 404 });
    const final = Math.round(ad.price * (100 - (ad.discount_pct || 0)) / 100);
    const money = `${final.toLocaleString('en-US')} دج`;
    let rows: { user_id: string; type: string; ad_id: string; message: string }[] = [];

    if (type === 'new_ad') {
      const { data: subs } = await db.from('alert_subscriptions').select('user_id,wilaya_id,min_price,max_price').eq('category_id', ad.subcategory_id).neq('user_id', ad.user_id);
      const seen = new Set<string>();
      for (const s of subs ?? []) {
        if (s.wilaya_id && s.wilaya_id !== ad.wilaya_id) continue;
        if (s.min_price && final < s.min_price) continue;
        if (s.max_price && final > s.max_price) continue;
        if (seen.has(s.user_id)) continue; seen.add(s.user_id);
        rows.push({ user_id: s.user_id, type: 'alert_match', ad_id, message: `إعلان جديد يطابق تنبيهك: ${ad.title} — ${money}` });
      }
    } else if (type === 'price_drop' || type === 'sold') {
      const { data: likers } = await db.from('likes').select('user_id').eq('ad_id', ad_id).neq('user_id', ad.user_id);
      const msg = type === 'price_drop' ? `انخفض سعر «${ad.title}» إلى ${money}` : `تم بيع «${ad.title}»`;
      rows = (likers ?? []).map((l) => ({ user_id: l.user_id, type, ad_id, message: msg }));
    }
    if (rows.length) await db.from('notifications').insert(rows);
    return new Response(JSON.stringify({ sent: rows.length }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('[notify-fanout]', e);
    return new Response('error', { status: 400 });
  }
});
