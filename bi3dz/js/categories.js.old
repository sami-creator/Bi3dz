/* categories.js — الأصناف والأصناف الفرعية وفلاتر كل صنف + نطاقات الأسعار من قاعدة البيانات */
(function () {
  'use strict';
  let cats = [], ranges = {}, loaded = false;

  const Categories = {
    async load() {
      if (loaded) return cats;
      try { cats = await (await fetch('data/categories.json')).json(); } catch (e) { console.error('[Categories]', e); cats = []; }
      try {
        const { data } = await SB.db.from('categories').select('id,min_price,max_price');
        (data || []).forEach(r => { ranges[r.id] = { min: r.min_price, max: r.max_price }; });
      } catch (e) { console.error('[Categories] ranges', e); }
      loaded = true; return cats;
    },
    all() { return cats; },
    main(id) { return cats.find(c => c.id === id); },
    sub(mainId, subId) { const m = this.main(mainId); return m ? m.sub.find(s => s.id === subId) : null; },
    findSub(subId) { for (const m of cats) { const s = m.sub.find(x => x.id === subId); if (s) return { main: m, sub: s }; } return null; },
    label(o) { return o ? (o[I18n.lang] || o.ar) : ''; },
    path(mainId, subId) {
      const m = this.main(mainId), s = m && m.sub.find(x => x.id === subId);
      return [m, s].filter(Boolean).map(x => this.label(x)).join(' ← ');
    },
    filtersFor(subId) { const f = this.findSub(subId); return f ? f.sub.filters || [] : []; },
    // مفاتيح تقبل اختيار عدة قيم في إعلان واحد (ألوان/مقاسات)
    MULTI: ['color', 'size', 'shoe_size'],
    isMulti(key) { return this.MULTI.includes(key); },
    keyLabel(key) {
      const L = {
        ar: { color: 'اللون', size: 'المقاس', shoe_size: 'المقاس', fabric: 'القماش', age: 'العمر', loreal_no: 'الرقم', material: 'المادة', mobility: 'التنقل', experience: 'الخبرة', price_type: 'نوع التسعير' },
        fr: { color: 'Couleur', size: 'Taille', shoe_size: 'Pointure', fabric: 'Tissu', age: 'Âge', loreal_no: 'N°', material: 'Matière', mobility: 'Déplacement', experience: 'Expérience', price_type: 'Tarification' },
        en: { color: 'Color', size: 'Size', shoe_size: 'Size', fabric: 'Fabric', age: 'Age', loreal_no: 'No.', material: 'Material', mobility: 'Mobility', experience: 'Experience', price_type: 'Pricing' }
      };
      return (L[I18n.lang] || L.ar)[key] || L.ar[key] || key;
    },
    // الخدمات: لا توصيل/مقاسات/ألوان، بل تنقل وخبرة وتسعير
    isService(mainId) { return mainId === 'services'; },
    // فلاتر على مستوى الصنف الرئيسي قبل اختيار الفرعي (اتحاد فلاتر الأصناف الفرعية بلا تكرار)
    commonFilters(mainId) {
      const m = this.main(mainId); if (!m || !this.isService(mainId)) return [];
      const seen = new Map();
      m.sub.forEach(s => (s.filters || []).forEach(f => { if (!seen.has(f.key)) seen.set(f.key, f); }));
      return [...seen.values()];
    },
    // نقطة لونية بجانب اسم اللون
    COLOR_HEX: { 'أبيض': '#ffffff', 'أسود': '#111111', 'أحمر': '#e53935', 'وردي': '#f48fb1', 'ذهبي': '#d4af37', 'أزرق': '#1e88e5', 'أخضر': '#43a047', 'بيج': '#d9c3a0', 'فضي': '#c0c0c0', 'بنفسجي': '#8e24aa', 'برتقالي': '#fb8c00', 'أصفر': '#fdd835', 'بني': '#6d4c41', 'رمادي': '#9e9e9e', 'كحلي': '#1a237e', 'تركوازي': '#00acc1', 'عنابي': '#7b1fa2', 'زهري فاتح': '#f8bbd0', 'سماوي': '#4fc3f7', 'كاكي': '#8d8a4f' },
    optLabel(key, o) { if (key === 'color') return I18n.t('color.' + o) || o; return o; },
    // ترميز القيم المتعددة داخل attrs: "/أحمر/أزرق/" (حد الخادم 30 حرفًا لكل قيمة)
    ATTR_MAX: 30,
    encodeMulti(list) { return list.length ? '/' + list.join('/') + '/' : ''; },
    decodeMulti(v) { return String(v || '').split('/').map(x => x.trim()).filter(Boolean); },
    // النطاق: الصنف الفرعي أولًا ثم الرئيسي
    range(mainId, subId) {
      const r = ranges[subId] || ranges[mainId];
      return r && (r.min != null || r.max != null) ? r : null;
    }
  };
  window.Categories = Categories;
})();
