/* offline-cache.js — كاش للتصفح فقط (صور/عناوين سابقة)، وليس لقرار شراء */
(function () {
  'use strict';
  const P = window.CONFIG.STORAGE_KEYS.CACHE_PREFIX;
  const OfflineCache = {
    set(key, val, ttlMs = 24 * 3600 * 1000) { Utils.Store.set(P + key, { v: val, exp: Date.now() + ttlMs }); },
    get(key) {
      const o = Utils.Store.get(P + key); if (!o) return null;
      if (o.exp < Date.now()) { Utils.Store.remove(P + key); return null; }
      return o.v;
    },
    // نحتفظ بأول 20 إعلانًا فقط وبحقول العرض
    saveFeed(items) {
      this.set('feed', items.slice(0, 20).map(a => ({ id: a.id, user_id: a.user_id, title: a.title, price: a.price, discount_pct: a.discount_pct, negotiable: a.negotiable, thumb_path: a.thumb_path, user_name: a.user_name, is_verified: a.is_verified, rating_avg: a.rating_avg, rating_count: a.rating_count, likes_count: a.likes_count, status: a.status })), 3 * 24 * 3600 * 1000);
    },
    loadFeed() { return this.get('feed') || []; }
  };
  window.OfflineCache = OfflineCache;
})();
