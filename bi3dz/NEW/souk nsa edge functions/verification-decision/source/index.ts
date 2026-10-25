// verification-decision — قرار الأدمن على طلب التوثيق: تحديث الحالة + بريد Gmail + إشعار + حذف صور الهوية فورًا
import { createClient } from 'npm:@supabase/supabase-js@2';
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const J = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const url = Deno.env.get('SUPABASE_URL')!, srk = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, anon = Deno.env.get('SUPABASE_ANON_KEY')!;
    const uc = createClient(url, anon, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
    const { data: isAdmin } = await uc.rpc('is_admin');
    if (isAdmin !== true) return J({ error: 'FORBIDDEN' }, 403);

    const { id, decision, reason } = await req.json();
    if (!['accepted', 'rejected'].includes(decision)) return J({ error: 'BAD_DECISION' }, 400);
    const why = String(reason ?? '').replace(/<[^>]*>/g, '').slice(0, 200);
    const db = createClient(url, srk);
    const { data: r } = await db.from('verification_requests').select('id,user_id,phone,id_front_path,id_back_path,status').eq('id', id).single();
    if (!r || r.status !== 'pending') return J({ error: 'NOT_PENDING' }, 400);
    const ref = 'SN-' + crypto.randomUUID().slice(0, 6).toUpperCase();

    await db.from('verification_requests').update({ status: decision, reject_reason: decision === 'rejected' ? why : null, reference_no: ref, reviewed_at: new Date().toISOString(), id_front_path: null, id_back_path: null }).eq('id', id);
    if (decision === 'accepted') await db.from('users').update({ is_verified: true, phone: r.phone }).eq('id', r.user_id);
    // حذف الصور فورًا بعد القرار
    const paths = [r.id_front_path, r.id_back_path].filter(Boolean) as string[];
    if (paths.length) await db.storage.from('id-docs').remove(paths);

    const msg = decision === 'accepted' ? 'تم توثيق حسابك بنجاح ✓' : `تم رفض طلب التوثيق. السبب: ${why || '—'}`;
    await db.from('notifications').insert({ user_id: r.user_id, type: 'verification_' + decision, ad_id: null, message: msg });

    const { data: u } = await db.from('users').select('email,name').eq('id', r.user_id).single();
    if (u?.email && Deno.env.get('GMAIL_USER')) {
      try {
        const smtp = new SMTPClient({ connection: { hostname: 'smtp.gmail.com', port: 465, tls: true, auth: { username: Deno.env.get('GMAIL_USER')!, password: Deno.env.get('GMAIL_APP_PASSWORD')! } } });
        await smtp.send({ from: Deno.env.get('GMAIL_USER')!, to: u.email, subject: `souk nsa — ${decision === 'accepted' ? 'تم توثيق حسابك' : 'طلب التوثيق'} (${ref})`, content: msg, html: `<div dir="rtl"><p>مرحبًا ${esc(u.name ?? '')}،</p><p>${esc(msg)}</p><p>الرقم المرجعي: ${ref}</p></div>` });
        await smtp.close();
      } catch (e) { console.error('[verification-decision] mail', e); }
    }
    return J({ ok: true, ref });
  } catch (e) {
    console.error('[verification-decision]', e);
    return J({ error: 'FAILED' }, 500);
  }
});
