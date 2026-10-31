/* categories.js — الأصناف والأصناف الفرعية وفلاتر كل صنف + نطاقات الأسعار من قاعدة البيانات */
(function () {
  'use strict';
  let cats = [], ranges = {}, filtersCache = {}, loaded = false;

  const Categories = {
    async load() {
      if (loaded) return cats;
      try { cats = await (await fetch('data/categories.json')).json(); } catch (e) { console.error('[Categories]', e); cats = []; }
      try {
        const { data } = await SB.db.from('categories').select('id,min_price,max_price,filters_schema');
        (data || []).forEach(r => {
          ranges[r.id] = { min: r.min_price, max: r.max_price };
          if (r.filters_schema) filtersCache[r.id] = r.filters_schema;
        });
      } catch (e) { console.error('[Categories] ranges/filters', e); }
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
    // يرجع array [{key, type, options, label}] سواء من Supabase أو من JSON
    filtersFor(subId) {
      // أولاً: من Supabase (filters_schema object)
      if (filtersCache[subId]) {
        return Object.entries(filtersCache[subId]).map(([key, v]) => ({
          key,
          type: v.type || 'text',
          options: v.options || [],
          label: v.label || {},
          min: v.min,
          max: v.max
        }));
      }
      // ثانياً: من JSON المحلي
      const f = this.findSub(subId);
      return f ? f.sub.filters || [] : [];
    },
    // مفاتيح تقبل اختيار عدة قيم في إعلان واحد (ألوان/مقاسات)
    MULTI: ['color', 'size', 'shoe_size'],
    isMulti(key) { return this.MULTI.includes(key); },
    keyLabel(key, filterObj) {
      // إذا كان للفلتر label من Supabase نستخدمه
      if (filterObj && filterObj.label) {
        return filterObj.label[I18n.lang] || filterObj.label.ar || filterObj.label.fr || key;
      }
      const L = {
        ar: { color: 'اللون', size: 'المقاس', shoe_size: 'المقاس', fabric: 'القماش', age: 'العمر', loreal_no: 'الرقم', material: 'المادة', mobility: 'التنقل', experience: 'الخبرة', price_type: 'نوع التسعير', marque: 'الماركة', modele: 'الموديل', annee: 'السنة', carburant: 'الوقود', boite_vitesses: 'علبة السرعات', couleur: 'اللون', kilométrage: 'الكيلومترات', documents: 'الوثائق', etat: 'الحالة', prix: 'السعر', superficie: 'المساحة', ram: 'الذاكرة', stockage: 'التخزين', processeur: 'المعالج', ecran: 'الشاشة', plateforme: 'المنصة', taille: 'المقاس', sexe: 'الجنس', matiere: 'المادة', type: 'النوع', race: 'السلالة', espece: 'النوع', destination: 'الوجهة', duree: 'المدة', type_contrat: 'نوع العقد', niveau_etude: 'المستوى الدراسي', cylindree: 'سعة المحرك', charge_utile: 'الحمولة', longueur: 'الطول', puissance: 'القدرة', secteur: 'القطاع', type_sport: 'نوع الرياضة', type_service: 'نوع الخدمة' },
        fr: { color: 'Couleur', size: 'Taille', shoe_size: 'Pointure', fabric: 'Tissu', age: 'Âge', loreal_no: 'N°', material: 'Matière', mobility: 'Déplacement', experience: 'Expérience', price_type: 'Tarification', marque: 'Marque', modele: 'Modèle', annee: 'Année', carburant: 'Carburant', boite_vitesses: 'Boîte de vitesses', couleur: 'Couleur', kilométrage: 'Kilométrage', documents: 'Documents', etat: 'État', prix: 'Prix', superficie: 'Superficie', ram: 'RAM', stockage: 'Stockage', processeur: 'Processeur', ecran: 'Écran', plateforme: 'Plateforme', taille: 'Taille', sexe: 'Sexe', matiere: 'Matière', type: 'Type', race: 'Race', espece: 'Espèce', destination: 'Destination', duree: 'Durée', type_contrat: 'Type de contrat', niveau_etude: "Niveau d'étude", cylindree: 'Cylindrée', charge_utile: 'Charge utile', longueur: 'Longueur', puissance: 'Puissance', secteur: "Secteur d'activité", type_sport: 'Type de sport', type_service: 'Type de service' },
        en: { color: 'Color', size: 'Size', shoe_size: 'Size', fabric: 'Fabric', age: 'Age', loreal_no: 'No.', material: 'Material', mobility: 'Mobility', experience: 'Experience', price_type: 'Pricing', marque: 'Brand', modele: 'Model', annee: 'Year', carburant: 'Fuel', boite_vitesses: 'Gearbox', couleur: 'Color', kilométrage: 'Mileage', documents: 'Documents', etat: 'Condition', prix: 'Price', superficie: 'Area', ram: 'RAM', stockage: 'Storage', processeur: 'Processor', ecran: 'Screen', plateforme: 'Platform', taille: 'Size', sexe: 'Gender', matiere: 'Material', type: 'Type', race: 'Breed', espece: 'Species', destination: 'Destination', duree: 'Duration', type_contrat: 'Contract type', niveau_etude: 'Education level', cylindree: 'Engine size', charge_utile: 'Payload', longueur: 'Length', puissance: 'Power', secteur: 'Sector', type_sport: 'Sport type', type_service: 'Service type' }
      };
      return (L[I18n.lang] || L.ar)[key] || L.ar[key] || key;
    },
    // الخدمات: لا توصيل/مقاسات/ألوان، بل تنقل وخبرة وتسعير
    isService(mainId) { return mainId === 'services' || mainId === 'services_general'; },
    // فلاتر على مستوى الصنف الرئيسي قبل اختيار الفرعي
    commonFilters(mainId) {
      const m = this.main(mainId); if (!m || !this.isService(mainId)) return [];
      const seen = new Map();
      m.sub.forEach(s => (s.filters || []).forEach(f => { if (!seen.has(f.key)) seen.set(f.key, f); }));
      return [...seen.values()];
    },
    // نقطة لونية بجانب اسم اللون
    COLOR_HEX: { 'أبيض': '#ffffff', 'أسود': '#111111', 'أحمر': '#e53935', 'وردي': '#f48fb1', 'ذهبي': '#d4af37', 'أزرق': '#1e88e5', 'أخضر': '#43a047', 'بيج': '#d9c3a0', 'فضي': '#c0c0c0', 'بنفسجي': '#8e24aa', 'برتقالي': '#fb8c00', 'أصفر': '#fdd835', 'بني': '#6d4c41', 'رمادي': '#9e9e9e', 'كحلي': '#1a237e', 'تركوازي': '#00acc1', 'عنابي': '#7b1fa2', 'زهري فاتح': '#f8bbd0', 'سماوي': '#4fc3f7', 'كاكي': '#8d8a4f' },
    optLabel(key, o) {
      if (typeof o === 'object') return o[I18n.lang] || o.ar || o.fr || '';
      if (key === 'color') return I18n.t('color.' + o) || o;
      return o;
    },
    ATTR_MAX: 30,
    encodeMulti(list) { return list.length ? '/' + list.join('/') + '/' : ''; },
    decodeMulti(v) { return String(v || '').split('/').map(x => x.trim()).filter(Boolean); },
    range(mainId, subId) {
      const r = ranges[subId] || ranges[mainId];
      return r && (r.min != null || r.max != null) ? r : null;
    }
  };
  window.Categories = Categories;
})();
