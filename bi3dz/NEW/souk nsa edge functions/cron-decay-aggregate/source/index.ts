// cron-decay-aggregate — يومي: تخفيف نقاط الاهتمام + تجميع النقرات الأقدم من 30 يومًا في clicks_daily وحذف الخام
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.headers.get('x-cron-secret') !== Deno.env.get('CRON_SECRET')) return new Response('forbidden', { status: 403 });
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const out: Record<string, unknown> = {};
  for (const fn of ['decay_interests', 'aggregate_clicks']) {
    const { data, error } = await db.rpc(fn);
    out[fn] = error ? 'ERROR: ' + error.message : (data ?? 'ok');
    if (error) console.error('[cron-decay-aggregate]', fn, error);
  }
  return new Response(JSON.stringify(out), { headers: { 'Content-Type': 'application/json' } });
});
