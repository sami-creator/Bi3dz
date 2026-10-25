/* price.js — التحقق من السعر وعرضه (دج + سنتيم على الصفحة نفسها) */
(function () {
  'use strict';
  const Price = {
    validate(raw, mainId, subId) {
      const v = Sanitize.validatePrice(raw);
      if (!v.ok) return v;
      const r = Categories.range(mainId, subId);
      if (r && ((r.min != null && v.value < r.min) || (r.max != null && v.value > r.max))) {
        return { ok: false, value: v.value, error: 'err.price_range', vars: { min: Utils.formatNumber(r.min ?? 0), max: r.max != null ? Utils.formatNumber(r.max) : '∞' } };
      }
      return v;
    },
    display(ad) {
      const pct = Number(ad.discount_pct) || 0;
      const final = Utils.applyDiscount(ad.price, pct);
      return {
        final, pct,
        old: pct > 0 ? ad.price : null,
        text: Utils.formatPrice(final),
        oldText: pct > 0 ? Utils.formatPrice(ad.price) : '',
        santim: Utils.toSantim(final)
      };
    },
    editsLeft(ad) { return Math.max(0, window.CONFIG.LIMITS.PRICE_EDITS_MAX - (ad.price_edit_count || 0)); }
  };
  window.Price = Price;
})();
