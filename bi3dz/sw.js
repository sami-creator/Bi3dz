/* sw.js — Service Worker: كاش شامل (HTML + CSS + JS + بيانات) */
const VERSION = 'souk-v1';
const STATIC = [
  '/', 'index.html', 'auth.html', 'ad-details.html', 'profile.html',
  'edit-profile.html', 'post-ad.html', 'my-ads.html', 'favorites.html',
  'notifications.html', 'settings.html', 'chat.html', 'verify.html',
  'complete-profile.html', 'ad-stats.html', 'smart_agent.html', '404.html',
  'privacy.html',
  'css/base.css', 'css/components.css', 'css/themes.css', 'css/pages.css', 'css/rtl.css',
  'js/env.js', 'js/config.js', 'js/app.js', 'js/ui.js', 'js/ads.js',
  'js/ad-details.js', 'js/cards.js', 'js/search.js', 'js/filters.js',
  'js/profile.js', 'js/settings.js', 'js/notifications.js', 'js/post-ad.js',
  'js/categories.js', 'js/geo.js', 'js/i18n.js', 'js/router.js',
  'js/tracking.js', 'js/upload.js', 'js/sanitize.js', 'js/compare.js',
  'js/delivery.js', 'js/voice.js', 'js/ratings.js', 'js/banners.js',
  'js/my-ads.js', 'js/moderate.js', 'js/push.js', 'js/supabase.js',
  'js/theme.js', 'js/fingerprint.js', 'js/search-state.js', 'js/darija-dict.js',
  'js/smart-agent.js', 'js/ad-stats.js', 'js/image-search.js', 'js/logger.js',
  'js/console-logger.js', 'js/verify.js', 'js/verify-category.js',
  'data/wilayas.json', 'data/dairas.json', 'data/communes.json',
  'data/categories.json', 'data/i18n/ar.json', 'data/i18n/fr.json', 'data/i18n/en.json',
  'assets/images/favicon.png', 'assets/images/avatar.svg',
  'assets/images/placeholder.svg', 'assets/images/map-pin.svg'
];

/* تثبيت: تخزين الملفات الثابتة */
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(VERSION).then(c => c.addAll(STATIC)).then(() => self.skipWaiting())
  );
});

/* تفعيل: حذف الكاشات القديمة */
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

/* الاعتراض: استراتيجية Network-First للـ API، Cache-First للأصول */
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  /* طلبات Supabase / Edge Functions: Network-First مع fallback */
  if (url.hostname.includes('supabase.co') || url.pathname.includes('/functions/')) {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    );
    return;
  }

  /* الملفات الثابتة: Cache-First */
  if (e.request.method === 'GET') {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(res => {
          /* تخزين الاستجابات الجديدة (صور الإعلانات وغيرها) */
          if (res && res.status === 200 && res.type !== 'opaque') {
            const clone = res.clone();
            caches.open(VERSION).then(c => c.put(e.request, clone));
          }
          return res;
        }).catch(() => {
          /* إذا انقطع الإنترنت وطُلبت صفحة HTML → أعد index */
          if (e.request.headers.get('accept') && e.request.headers.get('accept').includes('text/html')) {
            return caches.match('index.html');
          }
        });
      })
    );
  }
});
