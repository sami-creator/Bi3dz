import { createClient } from 'npm:@supabase/supabase-js@2';

const BOT = Deno.env.get('TG_BOT_TOKEN')!;
const SECRET = Deno.env.get('TG_WEBHOOK_SECRET')!;
const SITE = (Deno.env.get('SITE_URL') || '').replace(/\/$/, '');
const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

Deno.serve(async (req) => {
  if (req.headers.get('x-notify-secret') !== SECRET) {
    return new Response('forbidden', { status: 403 });
  }
  try {
    const { record } = await req.json();
    if (!record?.user_id || !record?.message) return new Response('skip');

    const { data: u } = await sb.from('users')
      .select('telegram_chat_id').eq('id', record.user_id).maybeSingle();
    if (!u?.telegram_chat_id) return new Response('not linked');

    let text = String(record.message).slice(0, 900);
    if (SITE) {
      if (record.ad_id) text += `\n\n🔗 رابط الإعلان:\n${SITE}/ad-details.html?id=${record.ad_id}`;
      else if (record.type === 'verification') text += `\n\n🔗 ${SITE}/verify.html`;
    }

    const r = await fetch(`https://api.telegram.org/bot${BOT}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: u.telegram_chat_id, text }),
    });

    // المستخدم حظر البوت: فك الربط تلقائيًا
    if (r.status === 403) {
      await sb.from('users').update({ telegram_chat_id: null }).eq('id', record.user_id);
    }
  } catch (e) {
    console.error(e);
  }
  return new Response('ok');
});