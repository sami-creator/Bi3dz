/* my-ads.js - My ads management: ad image + five action buttons on one row */
(function () {
  'use strict';
  const el = Utils.el, t = k => I18n.t(k), R = window.CONFIG.ROUTES;
  const $ = s => document.querySelector(s);

  // Style of the five buttons: one row, equal width
  const ROW_STYLE = 'display:flex;flex-wrap:nowrap;gap:5px;margin-top:10px;width:100%';
  const BTN_STYLE = 'flex:1 1 0;min-width:0;padding:8px 2px;min-height:38px;font-size:11px;font-weight:700;border-radius:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';

  App.pages['my-ads'] = async function () {
    if (!(await App.boot({ guard: true }))) return;
    await Categories.load();
    const box = $('#list');

    // Cover image (first image of the ad)
    function cover(adId) {
      const img = el('img', { alt: '', loading: 'lazy', src: 'assets/images/placeholder.svg', style: 'width:100%;height:100%;object-fit:cover;display:block' });
      Ads.images(adId).then(list => {
        if (list && list[0]) img.src = Utils.imgUrl(list[0].path_medium || list[0].path_large || list[0].path_thumb, 'medium');
      }).catch(() => {});
      img.addEventListener('error', () => { img.src = 'assets/images/placeholder.svg'; }, { once: true });
      return el('div', { style: 'width:100%;aspect-ratio:16/10;border-radius:14px;overflow:hidden;background:var(--surface-2);margin-bottom:10px' }, [img]);
    }

    async function paint() {
      box.replaceChildren(UI.skeletonCards(2));
      let items;
      try { items = await Ads.mine(); } catch (e) { console.error('[MyAds]', e); box.replaceChildren(); return UI.emptyState(box, 'err.generic', 'common.retry'); }
      box.replaceChildren();
      if (!items.length) return UI.emptyState(box, 'ad.no_ads', 'ad.add');
      items.forEach(a => {
        const sold = a.status === 'sold', paused = a.status === 'paused';
        const act = (key, fn, cls = 'btn btn--ghost') => el('button', { class: cls, style: BTN_STYLE, type: 'button', onclick: fn }, t(key));
        const actions = el('div', { class: 'actions', style: ROW_STYLE }, [
          act('common.edit', () => Utils.go(R.POST, { id: a.id })),
          act('ad.stats', () => Utils.go(R.STATS, { id: a.id })),
          sold ? null : act(paused ? 'ad.activate' : 'ad.pause', async () => { await Ads.setStatus(a.id, paused ? 'active' : 'paused'); paint(); }),
          sold ? null : act('ad.mark_sold', async () => { if (!(await UI.confirmDialog(t('ad.confirm_sold')))) return; const { error } = await Ads.markSold(a.id); if (error) return UI.toastKey(UI.errKey(error), 'error'); paint(); }),
          act('ad.delete', async () => { if (!(await UI.confirmDialog(t('ad.confirm_delete')))) return; await Ads.remove(a.id); paint(); }, 'btn btn--danger')
        ]);
        box.append(el('div', { class: 'card-box' }, [
          cover(a.id),
          el('div', { class: 'row' }, [el('b', { class: 'grow', text: a.title }), el('span', { class: 'pill' + (sold ? '' : paused ? ' pill--pending' : ' pill--ok'), text: t(sold ? 'ad.sold' : paused ? 'ad.status_paused' : 'ad.status_active') })]),
          el('div', { class: 'muted', text: Utils.formatPrice(a.price) + ' \u00b7 ' + Categories.path(a.category_id, a.subcategory_id) }),
          el('div', { class: 'hint', text: t('ad.clicks') + ': ' + (a.click_count || 0) + ' \u00b7 \u2665 ' + (a.likes_count || 0) + ' \u00b7 ' + Utils.formatDate(a.created_at) }),
          actions
        ]));
      });
    }
    paint();
  };
})();
