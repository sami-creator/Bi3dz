/* console-logger.js — يجمع الأخطاء فقط (ليس كل console.log) ويرسلها دفعة لتوفير Bandwidth */
(function () {
  'use strict';
  const MAX_PER_SESSION = 20, FLUSH_MS = 30000;
  const queue = [], seen = new Set();
  let sent = 0, model = '', busy = false;

  try {
    if (navigator.userAgentData && navigator.userAgentData.getHighEntropyValues) {
      navigator.userAgentData.getHighEntropyValues(['model', 'platform']).then(v => { model = [v.platform, v.model].filter(Boolean).join(' '); }).catch(() => {});
    }
  } catch { /* ignore */ }

  function push(level, args) {
    if (sent + queue.length >= MAX_PER_SESSION) return;
    let msg = args.map(a => { try { return a instanceof Error ? a.message + ' ' + (a.stack || '').slice(0, 200) : typeof a === 'object' ? JSON.stringify(a) : String(a); } catch { return '[unserializable]'; } }).join(' ').slice(0, 500);
    msg = `[${level}] ${msg}`;
    if (seen.has(msg)) return; seen.add(msg);
    queue.push({ page: location.pathname.split('/').pop() || 'index', message: msg, device_model: (model || navigator.userAgent).slice(0, 120) });
  }

  async function flush() {
    if (busy || !queue.length || !window.SB || !SB.ready) return;
    busy = true;
    const batch = queue.splice(0, queue.length);
    try {
      const uid = window.Auth && Auth.uid ? Auth.uid() : null;
      const { error } = await SB.db.from('error_logs').insert(batch.map(r => Object.assign({ user_id: uid }, r)));
      if (!error) sent += batch.length;
    } catch { /* لا نسجّل خطأ الخطأ */ }
    busy = false;
  }

  // مقاييس أداء بسيطة مرة واحدة لكل صفحة
  window.addEventListener('load', () => {
    setTimeout(() => {
      try {
        const n = performance.getEntriesByType('navigation')[0]; if (!n) return;
        const bytes = performance.getEntriesByType('resource').reduce((s, r) => s + (r.transferSize || 0), n.transferSize || 0);
        push('perf', [`load=${Math.round(n.loadEventEnd)}ms bytes=${bytes}`]);
      } catch { /* ignore */ }
    }, 0);
  });

  const origErr = console.error.bind(console), origWarn = console.warn.bind(console);
  console.error = (...a) => { origErr(...a); push('error', a); };
  console.warn = (...a) => { origWarn(...a); push('warn', a); };
  window.addEventListener('error', e => push('error', [e.message, (e.filename || '').split('/').pop() + ':' + e.lineno]));
  window.addEventListener('unhandledrejection', e => push('promise', [e.reason]));

  setInterval(flush, FLUSH_MS);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
  window.ConsoleLogger = { flush };
})();
