/* ad-stats.js — إحصائيات الإعلان لصاحبته فقط (النقرات/الإعجابات/الرسائل حسب الولاية والعمر) */
(function () {
  'use strict';
  const el = Utils.el, t = k => I18n.t(k), R = window.CONFIG.ROUTES;
  const $ = s => document.querySelector(s);

  function bars(rows, labelFn) {
    const max = Math.max(1, ...rows.map(r => r.count));
    return el('div', {}, rows.map(r => el('div', { class: 'row', style: 'margin:4px 0' }, [
      el('span', { style: 'min-width:90px;font-size:12px', text: labelFn(r) }),
      el('div', { class: 'grow', style: 'background:var(--surface-2);border-radius:6px;height:10px' }, el('div', { style: 'height:10px;border-radius:6px;background:var(--c-primary);width:' + Math.round(r.count / max * 100) + '%' })),
      el('b', { text: r.count })
    ])));
  }

  App.pages['ad-stats'] = async function () {
    if (!(await App.boot({ guard: true }))) return;
    const id = Utils.qs('id');
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return Utils.go(R.MY_ADS);
    await Geo.load();
    const { data, error } = await SB.db.rpc('ad_stats_v2', { p_ad: id });
    if (error || !data) { console.error('[Stats]', error); return Utils.go(R.MY_ADS); }
    const s = typeof data === 'string' ? JSON.parse(data) : data;
    const tot = s.totals || {};
    $('#boxes').replaceChildren(
      ...[['ad.clicks', tot.clicks], ['ad.likes', tot.likes], ['ad.messages', tot.messages]].map(([k, v]) => el('div', { class: 'stat-box' }, [el('b', { text: v || 0 }), el('span', { text: t(k) })]))
    );
    const sections = [['ad.clicks', 'clicks'], ['ad.likes', 'likes'], ['ad.messages', 'messages']];
    const wrap = $('#tables'); wrap.replaceChildren();
    sections.forEach(([k, key]) => {
      const w = s[key + '_by_wilaya'] || [], a = key === 'clicks' ? (s.clicks_by_age || []) : [];
      if (!w.length && !a.length) return;
      wrap.append(el('div', { class: 'card-box' }, [
        el('h3', { text: t(k) }),
        w.length ? el('div', {}, [el('div', { class: 'hint', text: t('ad.by_wilaya') }), bars(w, r => Geo.label(Geo.wilaya(r.wilaya_id)) || '—')]) : null,
        a.length ? el('div', {}, [el('div', { class: 'hint', text: t('ad.by_age') }), bars(a, r => r.age_range)]) : null
      ]));
    });
    if (!wrap.children.length) UI.emptyState(wrap);
  };
})();
