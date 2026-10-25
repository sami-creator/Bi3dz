/* geo.js — الولايات/الدوائر/البلديات: قوائم متسلسلة، تدعم الاختيار المتعدد */
(function () {
  'use strict';
  let W = [], D = [], M = [], loaded = false;

  async function j(p) { const r = await fetch(p); return r.json(); }

  const Geo = {
    async load() {
      if (loaded) return;
      [W, D, M] = await Promise.all([j('data/wilayas.json'), j('data/dairas.json'), j('data/communes.json')]);
      loaded = true;
    },
    wilayas() { return W; },
    dairas(wid) { const ids = [].concat(wid || []).map(String); return ids.length ? D.filter(d => ids.includes(String(d.w))) : D; },
    communes(did) { const ids = [].concat(did || []).map(String); return ids.length ? M.filter(m => ids.includes(String(m.d))) : M; },
    wilaya(id) { return W.find(w => String(w.id) === String(id)); },
    daira(id) { return D.find(d => String(d.id) === String(id)); },
    commune(id) { return M.find(m => String(m.id) === String(id)); },
    label(o) { return o ? (o[I18n.lang] || o.ar) : ''; },
    // الولايات تُعرض دائمًا مرتبة ومرقمة: 1. أدرار ... 58. المنيعة
    wlabel(o) { return o ? o.id + '. ' + Geo.label(o) : ''; },
    sortedWilayas() { return W.slice().sort((a, b) => Number(a.id) - Number(b.id)); },

    fill(select, items, placeholderKey) {
      select.replaceChildren();
      if (placeholderKey) select.append(new Option(I18n.t(placeholderKey), ''));
      const isW = items === W;
      (isW ? Geo.sortedWilayas() : items).forEach(o => select.append(new Option(isW ? Geo.wlabel(o) : Geo.label(o), o.id)));
    },

    // ربط ثلاث قوائم متسلسلة (اختيار واحد) — للتسجيل ونشر الإعلان
    async bindCascade(sw, sd, sc, initial = {}) {
      await Geo.load();
      Geo.fill(sw, W, 'geo.wilaya');
      Geo.fill(sd, [], 'geo.daira'); Geo.fill(sc, [], 'geo.commune');
      sd.disabled = sc.disabled = true;
      sw.addEventListener('change', () => {
        Geo.fill(sd, sw.value ? Geo.dairas(sw.value) : [], 'geo.daira');
        Geo.fill(sc, [], 'geo.commune');
        sd.disabled = !sw.value; sc.disabled = true;
      });
      sd.addEventListener('change', () => {
        Geo.fill(sc, sd.value ? Geo.communes(sd.value) : [], 'geo.commune');
        sc.disabled = !sd.value;
      });
      if (initial.wilaya_id) {
        sw.value = initial.wilaya_id; sw.dispatchEvent(new Event('change'));
        if (initial.daira_id) { sd.value = initial.daira_id; sd.dispatchEvent(new Event('change')); }
        if (initial.commune_id) sc.value = initial.commune_id;
      }
    },
    values(sw, sd, sc) {
      return { wilaya_id: Number(sw.value) || null, daira_id: Number(sd.value) || null, commune_id: Number(sc.value) || null };
    }
  };
  window.Geo = Geo;
})();
