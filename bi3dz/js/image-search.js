/* image-search.js — ربط زر البحث بالصورة بـ Search.mountImageSearch
   يُحمَّل بعد search.js في index.html */
(function () {
  'use strict';

  function init() {
    const imgBtn    = document.getElementById('btn-img-search');
    const fileInput = document.getElementById('img-search-input');
    if (!imgBtn || !fileInput) return;

    const setLabel = () => {
      const lbl = I18n && I18n.t ? I18n.t('search.image_btn') : 'بحث بصورة';
      imgBtn.setAttribute('aria-label', lbl);
      imgBtn.title = lbl;
    };
    setLabel();
    document.addEventListener('langchange', setLabel);

    Search.mountImageSearch({
      btn: imgBtn,
      fileInput,
      onResults(results) {
        if (!results || !results.length) { UI.toastKey('empty.no_match', 'info'); return; }
        const ids = results.map(r => r.ad_id);
        Ads.listByIds(ids).then(({ items }) => {
          const grid = document.getElementById('grid');
          if (!grid) return;
          grid.replaceChildren();
          Cards.renderList(grid, items);
          Likes.paint(grid);
          window.scrollTo({ top: 0 });
        }).catch(e => {
          console.error('[ImageSearch] listByIds', e);
          UI.toastKey('err.generic', 'error');
        });
      }
    });
  }

  window.addEventListener('load', init);
})();
