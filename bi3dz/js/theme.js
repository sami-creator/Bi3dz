/* theme.js — الوضع الليلي (افتراضي) + 14 لونًا + الخط (الافتراضي = خط البروتوتايب) */
(function () {
  'use strict';
  const C = window.CONFIG, K = C.STORAGE_KEYS;
  const GF = {
    proto: 'Poppins:wght@400;500;600;700', cairo: 'Cairo:wght@400;600;700', tajawal: 'Tajawal:wght@400;500;700',
    almarai: 'Almarai:wght@400;700', amiri: 'Amiri:wght@400;700', plex: 'IBM+Plex+Sans+Arabic:wght@400;500;700'
  };
  const STACK = {
    proto: "'Poppins','Segoe UI',system-ui,-apple-system,sans-serif",
    times: "'Times New Roman',Times,serif",
    system: 'system-ui,sans-serif'
  };

  function loadFont(f) {
    if (!GF[f] || document.getElementById('font-' + f)) return;
    const l = document.createElement('link');
    l.id = 'font-' + f; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=' + GF[f] + '&display=swap';
    document.head.append(l);
  }

  const Theme = {
    init() {
      // الليلي افتراضي دائمًا، ولا يتبع إعداد الجهاز إلا إذا اختار المستخدم غير ذلك
      this.setMode(Utils.Store.get(K.THEME, C.DEFAULTS.THEME), false);
      this.setColor(Utils.Store.get(K.COLOR, C.DEFAULTS.COLOR), false);
      this.setFont(Utils.Store.get(K.FONT, C.DEFAULTS.FONT), false);
    },
    setMode(m, save = true) {
      m = m === 'light' ? 'light' : 'dark';
      document.documentElement.dataset.theme = m;
      if (save) Utils.Store.set(K.THEME, m);
    },
    toggleMode() { this.setMode(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'); },
    setColor(c, save = true) {
      if (!C.COLORS.includes(c)) c = C.DEFAULTS.COLOR;
      document.documentElement.dataset.color = c;
      if (save) Utils.Store.set(K.COLOR, c);
    },
    setFont(f, save = true) {
      if (!C.FONTS[f]) f = C.DEFAULTS.FONT;
      loadFont(f);
      document.documentElement.dataset.font = f;
      const fam = STACK[f] || ("'" + C.FONTS[f] + "','Segoe UI',system-ui,sans-serif");
      document.documentElement.style.setProperty('--font', fam);
      if (save) Utils.Store.set(K.FONT, f);
    }
  };
  window.Theme = Theme;
})();
