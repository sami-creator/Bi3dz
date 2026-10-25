/* interests.js — تسجيل تفاعلات لبناء ملف الاهتمام (النقاط تُحسب في الخادم فقط) */
(function () {
  'use strict';
  const Interests = {
    // action: click | like | message | buy_or_rate
    async record(action, ad) {
      if (!Auth.uid() || !ad || !window.CONFIG.INTEREST_POINTS[action]) return;
      const { error } = await SB.db.rpc('add_interest', {
        p_category: ad.subcategory_id || ad.category_id, p_wilaya: ad.wilaya_id || null, p_action: action
      });
      if (error) console.warn('[Interests]', error.message);
    }
  };
  window.Interests = Interests;
})();
