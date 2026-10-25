/* supabase.js — عميل Supabase (بدون أي مفاتيح داخل الكود) */
(function () {
  'use strict';
  const env = window.__ENV__ || {};
  const SB = {
    client: null,
    ready: false,
    init() {
      if (this.ready) return this.client;
      if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
        console.error('[Supabase] js/env.js غير موجود أو ناقص');
        return null;
      }
      if (!window.supabase || !window.supabase.createClient) {
        console.error('[Supabase] SDK غير محمّل');
        return null;
      }
      this.client = window.supabase.createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });
      this.ready = true;
      return this.client;
    },
    get db() { return this.init(); },
    async fn(name, body) {
      const c = this.init();
      if (!c) return { data: null, error: new Error('no client') };
      return c.functions.invoke(name, { body });
    }
  };
  window.SB = SB;
})();
