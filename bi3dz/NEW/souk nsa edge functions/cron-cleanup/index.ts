// cron-cleanup — يومي: صور الهوية المتبقية، صور إعلانات يتيمة، وسجلات قديمة
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.headers.get('x-cron-secret') !== Deno.env.get('CRON_SECRET')) return new Response('forbidden', { status: 403 });
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const day = (n: number) => new Date(Date.now() - n * 86400000).toISOString();
  const out: Record<string, number> = {};
  try {
    // 1) صور هوية لطلبات تم البتّ فيها ولم تُحذف
    const { data: ids } = await db.from('verification_requests').select('id,id_front_path,id_back_path').neq('status', 'pending').or('id_front_path.not.is.null,id_back_path.not.is.null').lt('reviewed_at', day(1));
    const idPaths = (ids ?? []).flatMap((r) => [r.id_front_path, r.id_back_path]).filter(Boolean) as string[];
    if (idPaths.length) await db.storage.from('id-docs').remove(idPaths);
    for (const r of ids ?? []) await db.from('verification_requests').update({ id_front_path: null, id_back_path: null }).eq('id', r.id);
    out.id_images = idPaths.length;

    // 2) صور إعلانات لا يرتبط بها ad_images (فشل النشر)
    const { data: orphans } = await db.rpc('orphan_image_paths', { p_hours: 24 });
    const op = (orphans ?? []) as string[];
    for (let i = 0; i < op.length; i += 100) await db.storage.from('ad-images').remove(op.slice(i, i + 100));
    out.orphan_images = op.length;

    // 3) سجلات قديمة
    await db.from('error_logs').delete().lt('created_at', day(30));
    await db.from('search_cache').delete().lt('created_at', day(30));
    await db.from('user_activity').delete().lt('day', day(90).slice(0, 10));
  } catch (e) { console.error('[cron-cleanup]', e); return new Response('error', { status: 500 }); }
  return new Response(JSON.stringify(out), { headers: { 'Content-Type': 'application/json' } });
});
