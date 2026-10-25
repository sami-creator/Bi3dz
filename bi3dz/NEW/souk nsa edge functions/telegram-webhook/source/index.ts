import { createClient } from 'npm:@supabase/supabase-js@2';

const BOT = Deno.env.get('TG_BOT_TOKEN')!;
const SECRET = Deno.env.get('TG_WEBHOOK_SECRET')!;
const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

const send = (chat_id: number, text: string) =>
  fetch(`https://api.telegram.org/bot${BOT}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id, text }),
  });

Deno.serve(async (req) => {
  if (req.headers.get('x-telegram-bot-api-secret-token') !== SECRET) {
    return new Response('forbidden', { status: 403 });
  }
  try {
    const update = await req.json();
    const msg = update.message;
    if (!msg || msg.chat?.type !== 'private') return new Response('ok');

    const m = (msg.text || '').match(/^\/start\s+([A-Za-z0-9]{16,64})$/);
    if (!m) {
      await send(msg.chat.id, 'مرحبًا! للربط افتح الإعدادات في التطبيق واضغط «ربط تلغرام».');
      return new Response('ok');
    }

    const { data: user } = await sb.from('users')
      .select('id').eq('telegram_link_token', m[1]).maybeSingle();

    if (!user) {
      await send(msg.chat.id, 'رمز الربط غير صالح أو منتهي. أعد المحاولة من الإعدادات.');
      return new Response('ok');
    }

    await sb.from('users')
      .update({ telegram_chat_id: msg.chat.id, telegram_link_token: null })
      .eq('id', user.id);

    await send(msg.chat.id, 'تم ربط حسابك ✅ ستصلك الإشعارات هنا.');
  } catch (e) {
    console.error(e);
  }
  return new Response('ok'); // دائمًا 200 حتى لا يكرر تلغرام الإرسال
});