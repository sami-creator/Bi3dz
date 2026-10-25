/* config.js — كل الثوابت والحدود في مكان واحد */
(function () {
  'use strict';
  window.CONFIG = Object.freeze({
    LIMITS: {
      TITLE: 100, DESCRIPTION: 500, INPUT_GENERIC: 500, CHAT_MESSAGE: 300,
      NAME: 60, FAQ_Q: 120, FAQ_A: 300, FAQ_MAX: 5, REPORT_NOTE: 300,
      IMAGES_MIN: 1, IMAGES_MAX: 10, IMAGE_MAX_BYTES: 5 * 1024 * 1024,
      PRICE_EDITS_MAX: 3, ALERTS_MAX: 3, MIN_AGE: 18,
      PAGE_SIZE: 20, SEARCH_DEBOUNCE_MS: 250, SEARCH_HISTORY_MAX: 10, BIO_WORDS: 100, BIO_CHARS: 800,
      RESULTS_CAP: 200, PRICE_BAND: 0.15, AI_TIMEOUT_MS: 1600,
      SMART_AGENT_MSG: 200
    },
    UPLOAD: {
      ALLOWED_MIME: ['image/jpeg', 'image/png', 'image/webp'],
      ALLOWED_EXT: ['jpg', 'jpeg', 'png', 'webp'],
      SIZES: { thumb: 150, medium: 600, large: 1600 },
      WEBP_QUALITY: 0.8
    },
    STORAGE_KEYS: {
      LANG: 'sn_lang', THEME: 'sn_theme', COLOR: 'sn_color', FONT: 'sn_font',
      SESSION_HINT: 'sn_session_hint', PROFILE_STATE: 'sn_profile_state',
      LIKE_TOAST: 'sn_like_toast_seen', DRAFT: 'sn_ad_draft', DEVICE: 'sn_device_id', FILTERS: 'sn_filters', RECENT: 'sn_recent_ads',
      CACHE_PREFIX: 'sn_cache_', SEARCH_HISTORY: 'sn_search_hist', SEARCH_STATE: 'sn_search_state',
      RETURN_TO: 'sn_return', LOGIN_PENDING: 'sn_login_pending', VIEWED: 'sn_viewed',
      SMART_AGENT_HISTORY: 'sn_agent_history', SMART_AGENT_DRAFT: 'sn_agent_draft'
    },
    DEFAULTS: { LANG: 'ar', THEME: 'dark', COLOR: 'rose', FONT: 'proto' },
    LANGS: ['ar', 'fr', 'en'],
    COLORS: ['rose', 'fuchsia', 'red', 'orange', 'gold', 'green', 'teal', 'sky', 'blue', 'indigo', 'violet', 'brown', 'beige', 'slate'],
    COLOR_HEX: { rose: '#F472B6', fuchsia: '#D946EF', red: '#EF4444', orange: '#F97316', gold: '#D4A017', green: '#16A34A', teal: '#0D9488', sky: '#0EA5E9', blue: '#2563EB', indigo: '#4F46E5', violet: '#8B5CF6', brown: '#92613A', beige: '#B89B72', slate: '#475569', white: '#FFFFFF',
  black: '#111111' },
    FONTS: { proto: 'Poppins', times: 'Times New Roman', cairo: 'Cairo', tajawal: 'Tajawal', almarai: 'Almarai', amiri: 'Amiri', plex: 'IBM Plex Sans Arabic', system: 'system-ui' },
    INTEREST_POINTS: { click: 1, like: 3, message: 5, buy_or_rate: 8 },
    CLICK_RAW_DAYS: 30,
    SUPPORT: { WHATSAPP: '+213659088226', TELEGRAM: 'Nawalquee' },
    SMART_AGENT: {
      EDGE_FUNCTION_URL: '/functions/v1/smart-agent',
      RATE_PER_MIN: 10,
      RATE_PER_DAY: 50
    },
    ROUTES: {
      HOME: 'index.html', AUTH: 'auth.html', COMPLETE: 'complete-profile.html', PROFILE: 'profile.html',
      EDIT_PROFILE: 'edit-profile.html', VERIFY: 'verify.html', POST: 'post-ad.html', MY_ADS: 'my-ads.html',
      STATS: 'ad-stats.html', AD: 'ad-details.html', FAVS: 'favorites.html', NOTIFS: 'notifications.html',
      CHAT: 'chat.html', SETTINGS: 'settings.html', PRIVACY: 'privacy.html',
      SMART_AGENT: 'smart_agent.html'
    }
  });
})();
