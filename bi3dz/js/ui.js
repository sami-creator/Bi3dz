/* ui.js — Toast، Skeleton، الحالة الفارغة، النوافذ، التحميل الجزئي */
(function () {
  'use strict';
  const t = k => (window.I18n ? I18n.t(k) : k);

  function toastHost() {
    let h = document.getElementById('toast-host');
    if (!h) { h = document.createElement('div'); h.id = 'toast-host'; h.setAttribute('aria-live', 'polite'); document.body.append(h); }
    return h;
  }
  function toast(msg, type = 'info', ms = 3000) {
    const n = document.createElement('div');
    n.className = 'toast toast--' + type;
    n.textContent = String(msg);
    toastHost().append(n);
    requestAnimationFrame(() => n.classList.add('show'));
    setTimeout(() => { n.classList.remove('show'); setTimeout(() => n.remove(), 250); }, ms);
  }
  const toastKey = (k, type, ms) => toast(t(k), type, ms);

  function skeletonCards(n = 6) {
    const f = document.createDocumentFragment();
    for (let i = 0; i < n; i++) {
      const c = document.createElement('div'); c.className = 'card card--skeleton';
      c.innerHTML = '<div class="sk sk-img"></div><div class="sk sk-line"></div><div class="sk sk-line sk-short"></div>';
      f.append(c);
    }
    return f;
  }

  const EMPTY_SVG = '<svg viewBox="0 0 120 120" width="120" height="120" aria-hidden="true"><circle cx="60" cy="60" r="50" fill="var(--c-soft)"/><path d="M38 70c6 10 38 10 44 0" stroke="var(--c-primary)" stroke-width="5" fill="none" stroke-linecap="round"/><circle cx="46" cy="52" r="5" fill="var(--c-primary)"/><circle cx="74" cy="52" r="5" fill="var(--c-primary)"/></svg>';
  function emptyIcon() { const d = document.createElement('div'); d.className = 'empty-ico'; d.innerHTML = EMPTY_SVG; return d; }

  // رسمة لطيفة بدل الصفحة الفارغة
  function emptyState(container, titleKey = 'empty.title', subKey = 'empty.sub') {
    container.replaceChildren();
    const d = document.createElement('div'); d.className = 'empty';
    d.innerHTML = '<svg viewBox="0 0 120 120" width="120" height="120" aria-hidden="true"><circle cx="60" cy="60" r="50" fill="var(--c-soft)"/><path d="M38 70c6 10 38 10 44 0" stroke="var(--c-primary)" stroke-width="5" fill="none" stroke-linecap="round"/><circle cx="46" cy="52" r="5" fill="var(--c-primary)"/><circle cx="74" cy="52" r="5" fill="var(--c-primary)"/></svg>';
    const h = document.createElement('h3'); h.textContent = t(titleKey);
    const p = document.createElement('p'); p.textContent = t(subKey);
    d.append(h, p); container.append(d);
  }

  function confirmDialog(msg, okKey = 'common.ok', cancelKey = 'common.cancel') {
    return new Promise(res => {
      const ov = document.createElement('div'); ov.className = 'modal-overlay';
      const box = document.createElement('div'); box.className = 'modal'; box.setAttribute('role', 'dialog');
      const p = document.createElement('p'); p.textContent = msg;
      const row = document.createElement('div'); row.className = 'modal__row';
      const ok = document.createElement('button'); ok.className = 'btn btn--primary'; ok.textContent = t(okKey);
      const no = document.createElement('button'); no.className = 'btn btn--ghost'; no.textContent = t(cancelKey);
      const close = v => { ov.remove(); res(v); };
      ok.onclick = () => close(true); no.onclick = () => close(false);
      ov.onclick = e => { if (e.target === ov) close(false); };
      row.append(ok, no); box.append(p, row); ov.append(box); document.body.append(ov);
      ok.focus();
    });
  }

  function setLoading(btn, on) {
    if (!btn) return;
    btn.disabled = !!on;
    btn.classList.toggle('is-loading', !!on);
  }

  // إخفاء المحتوى حتى تتحقق الحالة (لتفادي وميض زر تسجيل الدخول)
  function gate(el, ready) { if (el) el.hidden = !ready; document.body.classList.toggle('is-gated', !ready); }

  function fadeEdge(scroller) {
    const wrap = scroller.parentElement; if (!wrap) return;
    const upd = () => {
      const max = scroller.scrollWidth - scroller.clientWidth;
      const x = Math.abs(scroller.scrollLeft);
      wrap.classList.toggle('has-more', x < max - 4);
    };
    scroller.addEventListener('scroll', upd, { passive: true }); upd();
  }

  // ترجمة أكواد أخطاء الخادم (RPC/RLS) إلى مفاتيح i18n
  function errKey(error) {
    const m = String((error && (error.message || error.details || error.hint)) || error || '');
    if (/DEVICE_DONE|ALREADY/i.test(m)) return 'rate.device_done';
    if (/OWN_AD|OWN/i.test(m)) return 'rate.own';
    if (/PRICE_EDITS/i.test(m)) return 'err.price_edits_max';
    if (/ALERTS_MAX/i.test(m)) return 'err.alerts_max';
    if (/RATE_LIMIT|429/i.test(m)) return 'err.rate_limited';
    if (/NOT_VERIFIED/i.test(m)) return 'err.verify_required';
    if (/Failed to fetch|NetworkError/i.test(m)) return 'err.network';
    return 'err.generic';
  }

  window.UI = { errKey, toast, toastKey, skeletonCards, emptyState, emptyIcon, confirmDialog, setLoading, gate, fadeEdge };
})();
