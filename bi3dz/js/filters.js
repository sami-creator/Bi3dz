/* filters.js — حالة الفلاتر (محفوظة تلقائيًا) + اللوحة المنبثقة + شارات الفلاتر النشطة */
(function () {
  'use strict';
  const el = Utils.el, t = k => I18n.t(k), KEY = window.CONFIG.STORAGE_KEYS.FILTERS;
  const EMPTY = () => ({ q: '', qx: [], qraw: '', condition: '', category_id: '', subcategory_id: '', wilaya_ids: [], daira_ids: [], commune_ids: [], min_price: null, max_price: null, sort: '', order: 'desc', delivery: false, verified_only: false, attrs: {} });
  // مفاتيح تقبل اختيار أكثر من قيمة (ألوان / مقاسات)
  const MULTI = ['color', 'size', 'shoe_size'];

  function load() {
    const saved = Utils.Store.get(KEY, null), base = EMPTY();
    if (!saved || typeof saved !== 'object') return base;
    const s = Object.assign(base, saved);
    ['wilaya_ids', 'daira_ids', 'commune_ids'].forEach(k => { if (!Array.isArray(s[k])) s[k] = []; });
    if (!s.attrs || typeof s.attrs !== 'object') s.attrs = {};
    if (!Array.isArray(s.qx)) s.qx = [];
    return s;
  }
  let state = load(), cb = () => {};
  const save = () => Utils.Store.set(KEY, state);
  const arr = v => (Array.isArray(v) ? v : (v ? [v] : []));

  async function ensureLocation() {
    return new Promise(res => {
      if (!navigator.geolocation) return res(null);
      navigator.geolocation.getCurrentPosition(
        p => res({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => res(null), { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 });
    });
  }

  function checks(name, items, selected, labelFn, cls) {
    const box = el('div', { class: 'multi' + (cls ? ' ' + cls : '') });
    items.forEach(o => {
      const c = el('input', { type: 'checkbox', value: o.id, name });
      c.checked = selected.map(String).includes(String(o.id));
      box.append(el('label', {}, [c, el('span', { text: labelFn(o) })]));
    });
    return box;
  }
  const picked = box => [...box.querySelectorAll('input:checked')].map(i => Number(i.value));

  const Filters = {
    get() { return state; },
    set(patch) { state = Object.assign(state, patch); save(); cb(state); },
    reset() { state = EMPTY(); save(); cb(state); },
    onChange(fn) { cb = fn; },
    isDefault() { return JSON.stringify(state) === JSON.stringify(EMPTY()); },
    // هل هناك أي فلتر مفعّل (البحث النصي وحده لا يُحسب فلترًا)
    hasActive() { return JSON.stringify(Object.assign({}, state, { q: '', qx: [], qraw: '' })) !== JSON.stringify(EMPTY()); },
    // هل هناك بحث نصي أو فلاتر (لحفظ/استعادة حالة نتائج البحث)
    isSearching() { return !!state.q || !!state.qraw || this.hasActive(); },
    async location() { return ensureLocation(); },

    renderTags(container) {
      container.replaceChildren();
      const done = () => { save(); cb(state); Filters.renderTags(container); };
      const add = (text, clear) => container.append(el('span', { class: 'tag' }, [text, el('button', { type: 'button', 'aria-label': t('filters.remove'), onclick: () => { clear(); done(); } }, '×')]));
      if (state.category_id) add(Categories.label(Categories.main(state.category_id)), () => { state.category_id = ''; state.subcategory_id = ''; state.attrs = {}; });
      if (state.subcategory_id) { const s = Categories.findSub(state.subcategory_id); add(Categories.label(s && s.sub), () => { state.subcategory_id = ''; state.attrs = {}; }); }
      state.wilaya_ids.forEach(id => add(Geo.wlabel(Geo.wilaya(id)), () => { state.wilaya_ids = state.wilaya_ids.filter(x => x !== id); }));
      state.daira_ids.forEach(id => add(Geo.label(Geo.daira(id)), () => { state.daira_ids = state.daira_ids.filter(x => x !== id); }));
      state.commune_ids.forEach(id => add(Geo.label(Geo.commune(id)), () => { state.commune_ids = state.commune_ids.filter(x => x !== id); }));
      if (state.min_price) add(t('filters.price_from') + ' ' + Utils.formatNumber(state.min_price), () => { state.min_price = null; });
      if (state.max_price) add(t('filters.price_to') + ' ' + Utils.formatNumber(state.max_price), () => { state.max_price = null; });
      if (state.condition) add(t(state.condition === 'used' ? 'ad.used' : 'compare.new'), () => { state.condition = ''; });
      if (state.delivery) add(t('filters.delivery'), () => { state.delivery = false; });
      if (state.verified_only) add(t('filters.verified'), () => { state.verified_only = false; });
      if (state.sort) add(t('filters.sort') + ': ' + t('filters.sort_' + (state.sort === 'near' ? 'near' : state.sort)), () => { state.sort = ''; });
      Object.entries(state.attrs).forEach(([k, v]) => {
        if (k === 'deal') { add(t('search.rent'), () => { delete state.attrs.deal; }); return; }
        arr(v).forEach(x => add(k === 'size_any' ? t('filters.size') + ' ' + x : x, () => {
        const left = arr(state.attrs[k]).filter(y => y !== x);
          if (left.length) state.attrs[k] = left; else delete state.attrs[k];
        }));
      });
    },

    async openPanel() {
      await Promise.all([Geo.load(), Categories.load()]);
      const ov = el('div', { class: 'filters-panel' }), sheet = el('div', { class: 'filters-panel__sheet' });
      const field = (label, node) => el('div', { class: 'field' }, [el('label', { text: label }), node]);
      const tmp = JSON.parse(JSON.stringify(state));

      const selCat = el('select', { class: 'input' });
      selCat.append(new Option(t('common.all'), ''));
      Categories.all().forEach(c => selCat.append(new Option(Categories.label(c), c.id)));
      selCat.value = tmp.category_id;
      const selSub = el('select', { class: 'input' });
      const attrsBox = el('div');
      const fillSub = () => {
        selSub.replaceChildren(new Option(t('common.all'), ''));
        const m = Categories.main(selCat.value);
        (m ? m.sub : []).forEach(s => selSub.append(new Option(Categories.label(s), s.id)));
        selSub.value = tmp.subcategory_id || ''; fillAttrs();
      };
      // فلاتر الصنف الفرعي: الألوان والمقاسات متعددة الاختيار (مثال: أزرق/أحمر + 34/36)
      const fillAttrs = () => {
        attrsBox.replaceChildren();
        const list = selSub.value ? Categories.filtersFor(selSub.value) : Categories.commonFilters(selCat.value);
        list.forEach(f => {
          if (f.type !== 'select') { attrsBox.append(field(f.key, el('input', { class: 'input', 'data-attr': f.key, maxlength: f.max || 30, value: arr(tmp.attrs[f.key])[0] || '' }))); return; }
          if (MULTI.includes(f.key)) {
            const sel = arr(tmp.attrs[f.key]).map(String), box = el('div', { class: 'multi', 'data-multi': f.key });
            f.options.forEach(o => {
              const c = el('input', { type: 'checkbox', value: o }); c.checked = sel.includes(o);
              box.append(el('label', {}, [c, el('span', { text: Categories.optLabel(f.key, o) })]));
            });
            attrsBox.append(field(Categories.keyLabel(f.key), box));
          } else {
            const s = el('select', { class: 'input', 'data-attr': f.key }); s.append(new Option(t('common.all'), ''));
            f.options.forEach(o => s.append(new Option(o, o))); s.value = arr(tmp.attrs[f.key])[0] || '';
            attrsBox.append(field(Categories.keyLabel(f.key), s));
          }
        });
      };
      selCat.addEventListener('change', () => { tmp.subcategory_id = ''; tmp.attrs = {}; fillSub(); syncKind(); });
      selSub.addEventListener('change', () => { tmp.attrs = {}; fillAttrs(); });
      fillSub();

      // الولايات: مصغّرة، مرتبة ومرقمة 1 → 58
      const wBox = checks('w', Geo.sortedWilayas(), tmp.wilaya_ids, o => Geo.wlabel(o), 'multi--compact');
      const dBox = el('div'), cBox = el('div');
      const refreshD = () => {
        const w = picked(wBox); dBox.replaceChildren(); cBox.replaceChildren();
        if (w.length) dBox.append(checks('d', Geo.dairas(w), tmp.daira_ids, o => Geo.label(o)));
        refreshC();
      };
      const refreshC = () => {
        const d = picked(dBox); cBox.replaceChildren();
        if (d.length) cBox.append(checks('c', Geo.communes(d), tmp.commune_ids, o => Geo.label(o)));
      };
      wBox.addEventListener('change', refreshD); dBox.addEventListener('change', refreshC); refreshD();

      const pMin = el('input', { class: 'input', type: 'number', inputmode: 'numeric', min: 1, value: tmp.min_price || '' });
      const pMax = el('input', { class: 'input', type: 'number', inputmode: 'numeric', min: 1, value: tmp.max_price || '' });
      const sort = el('select', { class: 'input' });
      [['', 'filters.sort_best'], ['views', 'filters.sort_views'], ['rating', 'filters.sort_rating'], ['price', 'filters.sort_price'], ['new', 'filters.sort_new'], ['near', 'filters.sort_near']]
        .forEach(([v, k]) => sort.append(new Option(t(k), v))); sort.value = tmp.sort;
      const order = el('select', { class: 'input' });
      order.append(new Option(t('filters.desc'), 'desc'), new Option(t('filters.asc'), 'asc')); order.value = tmp.order;
      const cond = el('select', { class: 'input' });
      cond.append(new Option(t('common.all'), ''), new Option(t('compare.new'), 'new'), new Option(t('ad.used'), 'used')); cond.value = tmp.condition || '';
      const dl = el('input', { type: 'checkbox' }); dl.checked = tmp.delivery;
      const dlRow = el('label', { class: 'row' }, [dl, t('filters.delivery')]);
      // الخدمات: لا توصيل (بل التنقل ضمن الفلاتر) ولا حالة جديد/مستعمل
      const condField = field(t('ad.condition'), cond);
      const syncKind = () => { const svc = Categories.isService(selCat.value); dlRow.hidden = svc; condField.hidden = svc; if (svc) { dl.checked = false; cond.value = ''; } };
      const vf = el('input', { type: 'checkbox' }); vf.checked = tmp.verified_only;

      const apply = el('button', { class: 'btn btn--primary grow', type: 'button' }, t('filters.apply'));
      const reset = el('button', { class: 'btn btn--ghost', type: 'button' }, t('filters.reset'));
      apply.addEventListener('click', async () => {
        const next = {
          category_id: selCat.value, subcategory_id: selSub.value,
          wilaya_ids: picked(wBox), daira_ids: picked(dBox), commune_ids: picked(cBox),
          min_price: Number(pMin.value) || null, max_price: Number(pMax.value) || null,
          sort: sort.value, order: order.value, delivery: dl.checked, verified_only: vf.checked, condition: cond.value, attrs: {}
        };
        // مفاتيح من البحث الذكي ليست في اللوحة (مقاس غير محدد النوع، كراء) تبقى ما دام الصنف نفسه
        if (selCat.value === state.category_id && selSub.value === state.subcategory_id) ['size_any', 'deal'].forEach(k => { if (tmp.attrs[k]) next.attrs[k] = tmp.attrs[k]; });
        attrsBox.querySelectorAll('[data-multi]').forEach(b => {
          const v = [...b.querySelectorAll('input:checked')].map(i => i.value);
          if (v.length) next.attrs[b.dataset.multi] = v;
        });
        attrsBox.querySelectorAll('[data-attr]').forEach(i => { const v = Sanitize.cleanText(i.value, 30); if (v) next.attrs[i.dataset.attr] = v; });
        if (next.sort === 'near') {
          const c = await ensureLocation();
          if (!c) { UI.toastKey('geo.locate_denied', 'error'); return; }
          next.coords = c;
        }
        Filters.set(next); ov.remove();
      });
      reset.addEventListener('click', () => { Filters.reset(); ov.remove(); });
      ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });

      sheet.append(
        el('h3', { text: t('filters.title') }),
        field(t('filters.category'), selCat), field(t('filters.subcategory'), selSub), attrsBox,
        field(t('geo.wilaya'), wBox), field(t('geo.daira'), dBox), field(t('geo.commune'), cBox),
        el('div', { class: 'row' }, [field(t('filters.price_from'), pMin), field(t('filters.price_to'), pMax)]),
        el('div', { class: 'row' }, [field(t('filters.sort'), sort), field('', order)]),
        condField, dlRow,
        el('label', { class: 'row' }, [vf, t('filters.verified')]),
        el('div', { class: 'filters-panel__foot' }, [apply, reset])
      );
      syncKind();
      ov.append(sheet); document.body.append(ov);
    }
  };
  window.Filters = Filters;
})();
