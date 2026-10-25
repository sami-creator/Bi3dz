/* compare.js — نظام الترشيح ("مقترح لك") ومقارنة إعلانين: سعر + تقييم + قرب + حالة (جديد/مستعمل) + توثيق + حداثة */
(function () {
  'use strict';
  const el = Utils.el, t = k => I18n.t(k), R = window.CONFIG.ROUTES;

  // أوزان الترشيح (مجموعها 100)
  const W = { price: 28, rating: 22, near: 20, condition: 12, verified: 8, fresh: 6, delivery: 4 };

  function me() { return (window.Auth && Auth.state && Auth.state.profile) || null; }

  // قرب نسبي (0..1): نفس البلدية 1، نفس الدائرة .85، نفس الولاية .65، غير ذلك .25؛ ومع distance_km إن وُجدت
  function nearScore(ad) {
    if (ad.distance_km != null) return Math.max(0, 1 - Number(ad.distance_km) / 600);
    const p = me(); if (!p || !ad.wilaya_id) return 0.5;
    if (ad.commune_id && ad.commune_id === p.commune_id) return 1;
    if (ad.daira_id && ad.daira_id === p.daira_id) return 0.85;
    if (ad.wilaya_id === p.wilaya_id) return 0.65;
    return 0.25;
  }
  function nearLabel(ad) {
    if (ad.distance_km != null) return t('ad.distance_km').replace('{n}', ad.distance_km);
    const p = me(); if (!p || !ad.wilaya_id) return '—';
    if (ad.commune_id && ad.commune_id === p.commune_id) return t('compare.same_commune');
    if (ad.daira_id && ad.daira_id === p.daira_id) return t('compare.same_daira');
    if (ad.wilaya_id === p.wilaya_id) return t('compare.same_wilaya');
    return Geo.label(Geo.wilaya(ad.wilaya_id)) || '—';
  }
  // الحالة: جديد = 1، مستعمل = درجة/10 × 0.8 (وزن مختلف عن الجديد)
  function conditionScore(ad) {
    const c = ad.attrs && ad.attrs.condition;
    if (c === undefined) return null; // غير معروفة (بطاقات القائمة لا تحمل attrs)
    if (!c) return 1;
    const g = parseInt(c, 10); return Number.isFinite(g) ? Math.min(1, g / 10) * 0.8 : 0.6;
  }
  function freshScore(ad) { const days = (Date.now() - new Date(ad.created_at).getTime()) / 86400000; return Math.exp(-Math.max(0, days) / 45); }

  const Compare = {
    W,
    nearLabel,
    // ctx: { min, max } نطاق أسعار المجموعة المقارَنة (لتقييم السعر نسبيًا)
    score(ad, ctx) {
      const price = Price.display(ad).final;
      let ps = 0.5;
      if (ctx && ctx.max > ctx.min) ps = 1 - (price - ctx.min) / (ctx.max - ctx.min);
      const rating = ad.rating_count > 0 ? (Number(ad.rating_avg || 0) / 5) * Math.min(1, 0.5 + ad.rating_count / 10) : 0.4;
      const cond = conditionScore(ad);
      const parts = { price: ps, rating, near: nearScore(ad), condition: cond == null ? 0.7 : cond, verified: ad.is_verified ? 1 : 0, fresh: freshScore(ad), delivery: ad.delivery ? 1 : 0 };
      let total = 0; Object.keys(W).forEach(k => { total += parts[k] * W[k]; });
      return { total: Math.round(total), parts };
    },

    // شارة "مقترح لك" لأفضل بطاقات الصفحة (تُقارَن داخل نفس الصنف الفرعي فقط)
    badge(items) {
      const groups = new Map();
      items.forEach(a => { const k = a.subcategory_id || a.category_id || '_'; (groups.get(k) || groups.set(k, []).get(k)).push(a); });
      const winners = new Set();
      groups.forEach(list => {
        if (list.length < 3) return;
        const prices = list.map(a => Price.display(a).final), ctx = { min: Math.min(...prices), max: Math.max(...prices) };
        const ranked = list.map(a => ({ a, s: this.score(a, ctx).total })).sort((x, y) => y.s - x.s);
        ranked.slice(0, Math.max(1, Math.floor(list.length / 6))).forEach(r => { if (r.s >= 62) winners.add(r.a.id); });
      });
      return winners;
    },

    // ===== شاشة المقارنة =====
    async open(adA) {
      const ov = el('div', { class: 'modal-overlay modal-overlay--full' }), box = el('div', { class: 'modal modal--tall' });
      ov.append(box); ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); }); document.body.append(ov);
      box.append(el('h3', { text: t('compare.pick') }), el('div', { class: 'hint', text: t('compare.pick_hint') }), UI.skeletonCards(2));
      let cands = [];
      try {
        const same = (await Ads.list({ category_id: adA.category_id, subcategory_id: adA.subcategory_id }, 0)).items;
        cands = same.filter(a => a.id !== adA.id);
        if (cands.length < 8) {
          const more = (await Ads.list({ category_id: adA.category_id }, 0)).items;
          more.forEach(a => { if (a.id !== adA.id && !cands.some(b => b.id === a.id)) cands.push(a); });
        }
        if (Auth.isLogged()) {
          await Likes.load(); const fav = await Likes.listMine();
          fav.forEach(a => { if (a.id !== adA.id && !cands.some(b => b.id === a.id)) cands.push(a); });
        }
      } catch (e) { console.warn('[Compare] candidates', e); }
      cands = cands.slice(0, 16);
      box.replaceChildren(el('h3', { text: t('compare.pick') }), el('div', { class: 'hint', text: t('compare.pick_hint') }));
      if (!cands.length) { box.append(el('p', { class: 'muted', text: t('compare.none') })); }
      const list = el('div', { class: 'cmp-pick' });
      cands.forEach(a => {
        const im = el('img', { src: Utils.imgUrl(a.thumb_path, 'thumb'), alt: '' });
        im.addEventListener('error', () => { im.src = 'assets/images/placeholder.svg'; }, { once: true });
        const row = el('button', { class: 'cmp-pick__item', type: 'button' }, [im, el('div', { class: 'grow' }, [el('b', { text: a.title }), el('div', { class: 'hint', text: Price.display(a).text })])]);
        row.addEventListener('click', async () => { UI.setLoading(row, true); try { await this.show(adA, a, ov); } finally { UI.setLoading(row, false); } });
        list.append(row);
      });
      box.append(list, el('div', { class: 'modal__row' }, [el('button', { class: 'btn btn--ghost', type: 'button', onclick: () => ov.remove() }, t('common.close'))]));
    },

    async show(adA, rowB, ov) {
      const full = await Ads.get(rowB.id); if (!full) return UI.toastKey('ad.unavailable', 'error');
      const A = adA, B = Object.assign({}, rowB, { attrs: full.attrs || {}, delivery: full.delivery, description: full.description });
      const prices = [Price.display(A).final, Price.display(B).final], ctx = { min: Math.min(...prices), max: Math.max(...prices) };
      const sa = this.score(A, ctx), sb = this.score(B, ctx);
      // نسب الترشيح تُطبَّع لتكون مجموعها 100 بين الإعلانين
      const sum = Math.max(1, sa.total + sb.total), pa = Math.round(sa.total / sum * 100), pb = 100 - pa;
      const winner = pa === pb ? null : (pa > pb ? 'a' : 'b');
      const box = ov.firstChild; box.replaceChildren();

      const cell = (ad, pct, isWin) => {
        const im = el('img', { src: Utils.imgUrl(ad.thumb_path || (ad.images && ad.images[0]), 'thumb'), alt: '' });
        im.addEventListener('error', () => { im.src = 'assets/images/placeholder.svg'; }, { once: true });
        return el('div', { class: 'cmp-col' + (isWin ? ' win' : '') }, [
          isWin ? el('div', { class: 'cmp-best', text: '★ ' + t('compare.best') }) : el('div', { class: 'cmp-best cmp-best--ghost', text: '·' }),
          el('div', { class: 'cmp-img' }, [im]), el('b', { class: 'cmp-title', text: ad.title }),
          el('div', { class: 'cmp-pct', text: pct + '%' }), el('div', { class: 'hint', text: t('compare.match') })
        ]);
      };
      const cond = ad => { const c = ad.attrs && ad.attrs.condition; return c ? t('ad.used') + ' ' + c : t('compare.new'); };
      const rows = [
        [t('ad.price'), Price.display(A).text, Price.display(B).text, Price.display(A).final === Price.display(B).final ? 0 : (Price.display(A).final < Price.display(B).final ? -1 : 1)],
        [t('profile.rating'), (A.rating_count ? Number(A.rating_avg).toFixed(1) + ' (' + A.rating_count + ')' : '—'), (B.rating_count ? Number(B.rating_avg).toFixed(1) + ' (' + B.rating_count + ')' : '—'), (A.rating_avg || 0) === (B.rating_avg || 0) ? 0 : ((A.rating_avg || 0) > (B.rating_avg || 0) ? -1 : 1)],
        [t('compare.near'), nearLabel(A), nearLabel(B), nearScore(A) === nearScore(B) ? 0 : (nearScore(A) > nearScore(B) ? -1 : 1)],
        [t('ad.condition'), cond(A), cond(B), 0],
        [t('filters.delivery'), A.delivery ? '✅' : '—', B.delivery ? '✅' : '—', 0],
        [t('filters.verified'), A.is_verified ? '✓' : '—', B.is_verified ? '✓' : '—', 0],
        [t('compare.published'), Utils.timeAgo(A.created_at), Utils.timeAgo(B.created_at), 0]
      ];
      const table = el('div', { class: 'cmp-table' });
      rows.forEach(([label, va, vb, better]) => table.append(el('div', { class: 'cmp-row' }, [
        el('div', { class: 'cmp-v' + (better === -1 ? ' good' : ''), text: va }), el('div', { class: 'cmp-k', text: label }), el('div', { class: 'cmp-v' + (better === 1 ? ' good' : ''), text: vb })
      ])));

      // أسباب الترشيح
      const why = [];
      const pA = Price.display(A).final, pB = Price.display(B).final;
      if (pA !== pB) why.push(t('compare.cheaper').replace('{n}', Utils.formatPrice(Math.abs(pA - pB))).replace('{w}', pA < pB ? t('compare.first') : t('compare.second')));
      if ((A.rating_avg || 0) !== (B.rating_avg || 0)) why.push(t('compare.rated').replace('{w}', (A.rating_avg || 0) > (B.rating_avg || 0) ? t('compare.first') : t('compare.second')));
      if (nearScore(A) !== nearScore(B)) why.push(t('compare.closer').replace('{w}', nearScore(A) > nearScore(B) ? t('compare.first') : t('compare.second')));

      box.append(el('h3', { text: t('compare.title') }),
        el('div', { class: 'cmp-head' }, [cell(A, pa, winner === 'a'), cell(B, pb, winner === 'b')]),
        el('div', { class: 'cmp-verdict', text: winner ? t('compare.verdict').replace('{w}', winner === 'a' ? t('compare.first') : t('compare.second')) : t('compare.tie') }),
        why.length ? el('ul', { class: 'cmp-why' }, why.map(x => el('li', { text: x }))) : null, table,
        el('div', { class: 'modal__row' }, [
          el('button', { class: 'btn btn--primary', type: 'button', onclick: () => Utils.go(R.AD, { id: (winner === 'b' ? B : A).id }) }, t('compare.open_best')),
          el('button', { class: 'btn btn--ghost', type: 'button', onclick: () => ov.remove() }, t('common.close'))
        ]));
    }
  };
  window.Compare = Compare;
})();
