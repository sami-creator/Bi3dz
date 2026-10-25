// send-push — يرسل إشعار Firebase (FCM) عند إضافة صف جديد في جدول notifications (عبر Database Webhook)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SITE = 'https://souk-nsa.vercel.app';
const SA = JSON.parse(Deno.env.get('FCM_SERVICE_ACCOUNT') || '{}');

function b64url(data) {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data);
  let s = '';
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  const unsigned = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' })) + '.' + b64url(JSON.stringify({
    iss: SA.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  }));
  const pem = SA.private_key.replace(/-----[^-]+-----/g, '').replace(/\s/g, '');
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: unsigned + '.' + b64url(sig) })
  });
  const j = await res.json();
  if (!j.access_token) throw new Error('FCM_TOKEN_FAILED ' + JSON.stringify(j));
  return j.access_token;
}

Deno.serve(async (req) => {
  if (req.headers.get('x-webhook-secret') !== Deno.env.get('PUSH_WEBHOOK_SECRET')) {
    return new Response('forbidden', { status: 403 });
  }
  try {
    const body = await req.json();
    const n = body.record;
    if (!n || !n.user_id) return new Response('no record');

    const sb = createClient(Deno.env.get('SUPABASE_URL') || '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '');
    const { data: rows } = await sb.from('push_tokens').select('token').eq('user_id', n.user_id);
    if (!rows || !rows.length) return new Response('no tokens');

    const accessToken = await getAccessToken();
    const link = SITE + (n.ad_id ? '/ad-details.html?id=' + n.ad_id : '/notifications.html');
    let sent = 0;

    for (const r of rows) {
      const res = await fetch('https://fcm.googleapis.com/v1/projects/' + SA.project_id + '/messages:send', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            token: r.token,
            notification: { title: 'souk nsa', body: n.message || 'لديك إشعار جديد' },
            webpush: { fcm_options: { link } }
          }
        })
      });
      if (res.ok) sent++;
      else {
        const err = await res.text();
        console.error('[send-push]', res.status, err);
        // رمز لم يعد صالحًا (تطبيق محذوف أو إذن ملغى): نحذفه
        if (res.status === 404 || /UNREGISTERED|INVALID_ARGUMENT/.test(err)) {
          await sb.from('push_tokens').delete().eq('token', r.token);
        }
      }
    }
    return new Response(JSON.stringify({ sent }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('[send-push]', e);
    return new Response('error', { status: 500 });
  }
});
