/* delivery.js — أسعار التوصيل لكل ولاية: تُحفظ في حساب الناشر (users.delivery_prices) وتُنشر تلقائيًا على كل إعلاناته.
   الشكل: { "16": 400, "23": 0 }  (المفتاح = رقم الولاية، القيمة = السعر بالدينار، 0 = مجاني) */
(function () {
  'use strict';
  const el = Utils.el, t = k => I18n.t(k);

  function clean(obj) {
    const out = {};
    if (!obj || typeof obj !== 'object') return out;
    Object.entries(obj).forEach(([k, v]) => {
      const id = Number(k), n = Number(v);
      if (Number.isInteger(id) && id >= 1 && id <= 58 && v !== '' && v !== null && Number.isFinite(n) && n >= 0 && n <= 1000000) out[id] = Math.round(n);
    });
    return out;
  }
  const count = p => Object.keys(clean(p)).length;
  const isFree = p => { const c = clean(p), v = Object.values(c); return v.length > 0 && v.every(x => x === 0); };

  function overlay(box) {
    const ov = el('div', { class: 'modal-overlay' });
    ov.append(box); ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); }); document.body.append(ov); return ov;
  }

  const Delivery = {
    clean, count, isFree,
    // هل توجد قائمة صالحة للعرض (سعر ولاية واحدة على الأقل)
    has(p) { return count(p) > 0; },

    // نافذة معلومات التوصيل (للمشتري): سعر التوصيل إلى المكتب لكل ولاية
    async openInfo(prices) {
      await Geo.load();
      const c = clean(prices), box = el('div', { class: 'modal' }), list = el('div', { class: 'deliv-list' });
      Geo.sortedWilayas().filter(w => c[w.id] !== undefined).forEach(w => {
        list.append(el('div', { class: 'deliv-row' }, [
          el('span', { text: Geo.wlabel(w) }),
          el('b', { class: c[w.id] === 0 ? 'free' : '', text: c[w.id] === 0 ? t('delivery.free_short') : Utils.formatPrice(c[w.id]) })
        ]));
      });
      box.append(el('h3', { text: t('delivery.info_title') }), el('div', { class: 'hint', text: t('delivery.to_office') }), list,
        el('div', { class: 'modal__row' }, [el('button', { class: 'btn btn--ghost', type: 'button', onclick: () => box.parentElement.remove() }, t('common.close'))]));
      overlay(box);
    },

    // حفظ القائمة في حساب الناشر
    async save(prices) {
      const c = clean(prices);
      const { error } = await SB.db.from('users').update({ delivery_prices: c }).eq('id', Auth.uid());
      if (error) { console.error('[Delivery] save', error); return { error: 'delivery.save_failed' }; }
      if (Auth.state && Auth.state.profile) Auth.state.profile.delivery_prices = c;
      return { ok: true, prices: c };
    },

    // محرّر القائمة (ناشر): حقل لكل ولاية، الفارغ = لا توصيل، 0 = مجاني
    async openEditor(current, onSaved) {
      await Geo.load();
      const c = clean(current), inputs = new Map();
      const box = el('div', { class: 'modal modal--tall' }), list = el('div', { class: 'deliv-list' });
      Geo.sortedWilayas().forEach(w => {
        const i = el('input', { class: 'input deliv-input', type: 'number', inputmode: 'numeric', min: 0, max: 1000000, placeholder: '—', value: c[w.id] !== undefined ? c[w.id] : '' });
        inputs.set(w.id, i);
        list.append(el('label', { class: 'deliv-row' }, [el('span', { text: Geo.wlabel(w) }), i]));
      });
      const all = el('input', { class: 'input', type: 'number', inputmode: 'numeric', min: 0, max: 1000000, placeholder: t('delivery.same_price') });
      const applyAll = el('button', { class: 'btn btn--ghost', type: 'button', onclick: () => { if (all.value === '') return; inputs.forEach(i => { i.value = all.value; }); } }, t('delivery.apply_all'));
      const clear = el('button', { class: 'btn btn--ghost', type: 'button', onclick: () => inputs.forEach(i => { i.value = ''; }) }, t('delivery.clear_all'));
      const save = el('button', { class: 'btn btn--primary grow', type: 'button' }, t('common.save'));
      const cancel = el('button', { class: 'btn btn--ghost', type: 'button', onclick: () => box.parentElement.remove() }, t('common.cancel'));
      save.addEventListener('click', async () => {
        const next = {}; inputs.forEach((i, id) => { if (i.value !== '') next[id] = i.value; });
        UI.setLoading(save, true);
        const r = await this.save(next);
        UI.setLoading(save, false);
        if (r.error) return UI.toastKey(r.error, 'error');
        UI.toastKey('edit.saved', 'success');
        box.parentElement.remove();
        if (onSaved) onSaved(r.prices);
      });
      box.append(el('h3', { text: t('delivery.editor_title') }), el('div', { class: 'hint', text: t('delivery.editor_hint') }),
        el('div', { class: 'row', style: 'margin:10px 0' }, [all, applyAll, clear]), list,
        el('div', { class: 'modal__row modal__row--sticky' }, [save, cancel]));
      overlay(box);
    }
  };
  window.Delivery = Delivery;
})();
