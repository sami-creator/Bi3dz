/* i18n.js — ترجمة نصوص التطبيق فقط (ar/fr/en)، ومحتوى المستخدم لا يُترجم */
(function () {
  'use strict';
  const C = window.CONFIG, K = C.STORAGE_KEYS;
  let dict = {}, lang = C.DEFAULTS.LANG;

  const I18n = {
    get lang() { return lang; },
    async init() {
      const saved = Utils.Store.get(K.LANG, C.DEFAULTS.LANG);
      lang = C.LANGS.includes(saved) ? saved : C.DEFAULTS.LANG;
      await this.load(lang);
      this.applyDir();
      this.apply();
    },
    async load(l) {
      try {
        const r = await fetch(`data/i18n/${l}.json`, { cache: 'default' });
        dict = await r.json();
      } catch (e) { console.error('[i18n] load failed', e); dict = {}; }
    },
    t(key, vars) {
      let v = dict[key];
      if (v === undefined) return key;
      if (vars) for (const [k, x] of Object.entries(vars)) v = v.replace(`{${k}}`, x);
      return v;
    },
    applyDir() {
      const h = document.documentElement;
      h.lang = lang; h.dir = lang === 'ar' ? 'rtl' : 'ltr';
    },
    apply(root = document) {
      root.querySelectorAll('[data-i18n]').forEach(e => { e.textContent = this.t(e.dataset.i18n); });
      root.querySelectorAll('[data-i18n-placeholder]').forEach(e => { e.placeholder = this.t(e.dataset.i18nPlaceholder); });
      root.querySelectorAll('[data-i18n-title]').forEach(e => { e.title = this.t(e.dataset.i18nTitle); });
      root.querySelectorAll('[data-i18n-aria]').forEach(e => { e.setAttribute('aria-label', this.t(e.dataset.i18nAria)); });
    },
    async set(l) {
      if (!C.LANGS.includes(l)) return;
      Utils.Store.set(K.LANG, l);
      lang = l; await this.load(l); this.applyDir(); this.apply();
      document.dispatchEvent(new CustomEvent('langchange', { detail: l }));
    },
    // اسم من كائن {ar,fr,en}
    name(o) { return o ? (o[lang] || o.ar || o.fr || '') : ''; }
  };
  window.I18n = I18n;
})();
