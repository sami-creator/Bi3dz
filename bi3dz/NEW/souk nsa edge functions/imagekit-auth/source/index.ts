// imagekit-auth — توليد توقيع ImageKit الأمني
// ضعي هذا الملف في: supabase/functions/imagekit-auth/index.ts

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const privateKey = Deno.env.get('IMAGEKIT_PRIVATE_KEY');
    if (!privateKey) throw new Error('IMAGEKIT_PRIVATE_KEY غير موجود');

    const token = crypto.randomUUID();
    const expire = Math.floor(Date.now() / 1000) + 600; // 10 دقائق

    // توليد HMAC-SHA1
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(privateKey),
      { name: 'HMAC', hash: 'SHA-1' },
      false,
      ['sign']
    );

    const message = token + expire;
    const sigBuffer = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
    const signature = Array.from(new Uint8Array(sigBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    return new Response(JSON.stringify({ token, expire, signature, folder: '/ads' }), {
      status: 200,
      headers: { ...cors, 'Content-Type': 'application/json' }
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' }
    });
  }
});
