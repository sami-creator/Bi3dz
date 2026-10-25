/* fingerprint.js — بصمة الجهاز (تُخزَّن في قاعدة البيانات، ويتكرر التحقق في الخادم) */
(function () {
  'use strict';
  let cached = null;

  function webglRenderer() {
    try {
      const gl = document.createElement('canvas').getContext('webgl');
      const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
      return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : '';
    } catch { return ''; }
  }
  async function sha256(s) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  }
  const conn = () => { const c = navigator.connection; return c ? [c.effectiveType, c.type].filter(Boolean).join('/') : ''; };

  const Fingerprint = {
    info() {
      return {
        screen: `${screen.width}x${screen.height}@${window.devicePixelRatio || 1}`,
        network: conn(),
        ua: navigator.userAgent.slice(0, 160)
      };
    },
    // بصمة ثابتة لا تعتمد على التخزين المحلي (لا تتغير بحذف بيانات التطبيق)
    async get() {
      if (cached) return cached;
      const parts = [
        screen.width, screen.height, screen.colorDepth, window.devicePixelRatio,
        Intl.DateTimeFormat().resolvedOptions().timeZone, navigator.language, navigator.platform,
        navigator.hardwareConcurrency, navigator.deviceMemory, navigator.maxTouchPoints, webglRenderer()
      ].join('|');
      cached = await sha256(parts);
      return cached;
    },
    async register() {
      if (!Auth.uid() || sessionStorage.getItem('sn_fp_done')) return;
      sessionStorage.setItem('sn_fp_done', '1');
      const i = this.info();
      const { error } = await SB.db.from('device_fingerprints').insert({ user_id: Auth.uid(), device_id: await this.get(), screen: i.screen, network: i.network });
      if (error && error.code !== '23505') console.warn('[Fingerprint]', error.message);
    }
  };
  window.Fingerprint = Fingerprint;
})();
