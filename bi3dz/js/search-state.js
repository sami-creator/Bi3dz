/* search-state.js — سجل البحث، كاش النتائج والاقتراحات، وحفظ موضع التمرير (حتى لا تضيع حالة البحث) */
(function () {
  'use strict';
  const HK = window.CONFIG.STORAGE_KEYS.SEARCH_HISTORY, SK = window.CONFIG.STORAGE_KEYS.SEARCH_STATE;
  const H_MAX = window.CONFIG.LIMITS.SEARCH_HISTORY_MAX, SCROLL_TTL = 30 * 60 * 1000;

  function hash(s) { let h = 5381; s = String(s); for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }

  // كاش بحد أقصى للمفاتيح (الأقدم يُحذف) كي لا يمتلئ التخزين
  function put(prefix, key, val, ttl, max) {
    const idxKey = 'sn_idx_' + prefix, idx = Utils.Store.get(idxKey, []) || [], k = prefix + hash(key);
    OfflineCache.set(k, val, ttl);
    const next = idx.filter(x => x !== k); next.push(k);
    while (next.length > max) Utils.Store.remove(window.CONFIG.STORAGE_KEYS.CACHE_PREFIX + next.shift());
    Utils.Store.set(idxKey, next);
  }
  const get = (prefix, key) => OfflineCache.get(prefix + hash(key));

  const SLIM = ['id', 'user_id', 'title', 'price', 'discount_pct', 'negotiable', 'delivery', 'status', 'is_edited', 'thumb_path', 'category_id', 'subcategory_id', 'wilaya_id', 'daira_id', 'commune_id', 'user_name', 'user_avatar', 'is_verified', 'rating_avg', 'rating_count', 'likes_count', 'click_count', 'created_at'];
  const slim = a => { const o = {}; SLIM.forEach(k => { if (a[k] !== undefined) o[k] = a[k]; }); return o; };

  const mem = new Map(); // اقتراحات الكتابة داخل الجلسة

  const SearchState = {
    hash,
    history() { const h = Utils.Store.get(HK, []); return Array.isArray(h) ? h : []; },
    addHistory(q) {
      q = String(q || '').trim(); if (q.length < 2) return;
      const h = this.history().filter(x => x !== q); h.unshift(q); Utils.Store.set(HK, h.slice(0, H_MAX));
    },
    removeHistory(q) { Utils.Store.set(HK, this.history().filter(x => x !== q)); },
    clearHistory() { Utils.Store.remove(HK); },

    // موضع التمرير وعدد الصفحات المحمّلة (تُستعاد عند العودة للرئيسية من أي مكان خلال 30 دقيقة)
    saveScroll(y, pages) { Utils.Store.set(SK, { y, pages, ts: Date.now() }); },
    loadScroll() { const s = Utils.Store.get(SK, null); return s && Date.now() - s.ts < SCROLL_TTL ? s : null; },
    clearScroll() { Utils.Store.remove(SK); },

    // كاش الصفحة الأولى من نتائج البحث (10 دقائق، أحدث 8 عمليات بحث)
    resultsGet(key) { return get('sr_', key); },
    resultsSet(key, items) { put('sr_', key, items.map(slim), 10 * 60 * 1000, 8); },

    // كاش الاقتراحات والتحليل الذكي
    suggestGet(q) { if (mem.has(q)) return mem.get(q); const v = get('sg_', q); if (v) mem.set(q, v); return v; },
    suggestSet(q, list) { mem.set(q, list); put('sg_', q, list, 24 * 3600 * 1000, 40); },
    aiGet(q) { return get('ai_', q); },
    aiSet(q, filters) { put('ai_', q, filters, 7 * 24 * 3600 * 1000, 40); }
  };
  window.SearchState = SearchState;
})();
