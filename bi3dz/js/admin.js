/* admin.js — لوحة الأدمن (استخدام شخصي). التحقق الحقيقي من الصلاحية في RLS/الدوال، وهنا فقط لإخفاء الواجهة */
(function () {
  'use strict';
  const el = Utils.el, t = k => I18n.t(k);
  const $ = s => document.querySelector(s);

  function table(heads, rows) {
    return el('div', { class: 'table-wrap' }, el('table', {}, [
      el('thead', {}, el('tr', {}, heads.map(h => el('th', { text: h })))),
      el('tbody', {}, rows.map(r => el('tr', {}, r.map(c => el('td', {}, c == null ? '' : c)))))
    ]));
  }
  const pill = s => el('span', { class: 'pill ' + (s === 'pending' ? 'pill--pending' : s === 'accepted' || s === 'reviewed' ? 'pill--ok' : s === 'rejected' ? 'pill--bad' : ''), text: s });
  const btn = (txt, fn, cls = 'btn btn--ghost') => el('button', { class: cls, type: 'button', onclick: fn }, txt);
  const safeHttps = u => { try { return new URL(u).protocol === 'https:'; } catch { return false; } };

  const TABS = {
    async overview(p) {
      const { data } = await SB.db.rpc('admin_overview');
      const o = data || {};
      p.append(el('div', { class: 'admin-grid' }, Object.entries(o).map(([k, v]) => el('div', { class: 'stat-box' }, [el('b', { text: v }), el('span', { text: k })]))));
    },

    async reports(p) {
      const { data } = await SB.db.from('reports').select('id,reporter_id,target_type,target_id,reasons,device_id,status,created_at').order('created_at', { ascending: false }).limit(100);
      p.append(table(['#', t('admin.reports'), t('ad.category'), '', ''], (data || []).map(r => [
        Utils.formatDate(r.created_at), (r.reasons || []).map(x => t('report.' + x)).join('، '),
        r.target_type === 'ad' ? el('a', { href: 'ad-details?id=' + r.target_id, text: 'ad' }) : el('span', { text: 'user ' + String(r.target_id).slice(0, 8) }),
        pill(r.status),
        el('div', { class: 'actions' }, [
          btn('✓', async () => { await SB.db.from('reports').update({ status: 'reviewed' }).eq('id', r.id); this.reports(clear(p)); }),
          r.target_type === 'ad' ? btn(t('common.delete'), async () => { if (await UI.confirmDialog(t('ad.confirm_delete'))) { await SB.db.from('ads').update({ status: 'deleted' }).eq('id', r.target_id); UI.toast('OK', 'success'); } }, 'btn btn--danger') : null
        ])
      ])));
    },

    async verifications(p) {
      const { data } = await SB.db.from('verification_requests').select('id,user_id,phone,id_front_path,id_back_path,status,reject_reason,reference_no,created_at').eq('status', 'pending').order('created_at').limit(50);
      if (!data || !data.length) return UI.emptyState(p, 'notif.none', 'empty.sub');
      for (const r of data) {
        const sign = async path => (await SB.db.storage.from('id-docs').createSignedUrl(path, 300)).data;
        const [f, b] = await Promise.all([sign(r.id_front_path), sign(r.id_back_path)]);
        const reason = el('input', { class: 'input', maxlength: 200, placeholder: t('admin.reason') });
        const decide = async d => {
          const { error } = await SB.fn('verification-decision', { id: r.id, decision: d, reason: reason.value });
          if (error) return UI.toastKey(UI.errKey(error), 'error');
          UI.toast('OK', 'success'); this.verifications(clear(p));
        };
        p.append(el('div', { class: 'card-box' }, [
          el('div', { text: r.phone + ' · ' + Utils.formatDate(r.created_at) }),
          el('div', { class: 'row' }, [f && el('img', { src: f.signedUrl, alt: '', style: 'width:48%;border-radius:8px' }), b && el('img', { src: b.signedUrl, alt: '', style: 'width:48%;border-radius:8px' })]),
          reason, el('div', { class: 'actions', style: 'margin-top:8px' }, [btn(t('admin.accept'), () => decide('accepted'), 'btn btn--primary'), btn(t('admin.reject'), () => decide('rejected'), 'btn btn--danger')])
        ]));
      }
    },

    async banners(p) {
      const { data } = await SB.db.from('banners').select('id,image_url,link,text,active,sort_order').order('sort_order');
      const f = { img: el('input', { class: 'input', placeholder: 'image https://' }), link: el('input', { class: 'input', placeholder: 'link https://' }), text: el('input', { class: 'input', maxlength: 60, placeholder: 'text' }), ord: el('input', { class: 'input', type: 'number', value: 0 }) };
      const add = btn(t('common.save'), async () => {
        if ((f.img.value && !safeHttps(f.img.value)) || (f.link.value && !safeHttps(f.link.value))) return UI.toastKey('err.invalid_url', 'error');
        const { error } = await SB.db.from('banners').insert({ image_url: f.img.value || null, link: f.link.value || null, text: Sanitize.cleanText(f.text.value, 60) || null, sort_order: Number(f.ord.value) || 0, active: true });
        if (error) return UI.toastKey('err.generic', 'error'); localStorage.removeItem(window.CONFIG.STORAGE_KEYS.CACHE_PREFIX + 'banners'); this.banners(clear(p));
      }, 'btn btn--primary');
      p.append(el('div', { class: 'card-box' }, [f.img, f.link, f.text, f.ord, add]));
      p.append(table(['#', 'image', 'link', 'text', '', ''], (data || []).map(b => [b.sort_order, b.image_url || '', b.link || '', b.text || '', pill(b.active ? 'active' : 'off'),
        el('div', { class: 'actions' }, [btn(b.active ? 'off' : 'on', async () => { await SB.db.from('banners').update({ active: !b.active }).eq('id', b.id); this.banners(clear(p)); }), btn(t('common.delete'), async () => { await SB.db.from('banners').delete().eq('id', b.id); this.banners(clear(p)); }, 'btn btn--danger')])])));
    },

    async errors(p) {
      const { data } = await SB.db.from('error_logs').select('id,page,message,device_model,created_at').order('created_at', { ascending: false }).limit(100);
      p.append(table(['date', 'page', 'message', 'device'], (data || []).map(e => [Utils.formatDate(e.created_at), e.page, el('div', { class: 'err-msg', text: e.message }), e.device_model || ''])));
    },

    async survey(p) {
      const { data } = await SB.db.from('onboarding_survey').select('source').limit(5000);
      const c = {}; (data || []).forEach(r => { c[r.source] = (c[r.source] || 0) + 1; });
      p.append(table(['source', '#'], Object.entries(c).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, v])));
    },

    // حدود الأسعار لكل صنف رئيسي/فرعي
    async prices(p) {
      await Categories.load();
      const rows = [];
      Categories.all().forEach(m => { rows.push([m, null]); m.sub.forEach(s => rows.push([s, m.id])); });
      const { data } = await SB.db.from('categories').select('id,min_price,max_price');
      const cur = Object.fromEntries((data || []).map(r => [r.id, r]));
      p.append(table(['category', 'min', 'max', ''], rows.map(([c, parent]) => {
        const mn = el('input', { class: 'input', type: 'number', min: 0, value: (cur[c.id] || {}).min_price ?? '' });
        const mx = el('input', { class: 'input', type: 'number', min: 0, value: (cur[c.id] || {}).max_price ?? '' });
        return [(parent ? '— ' : '') + Categories.label(c), mn, mx, btn(t('common.save'), async () => {
          const { error } = await SB.db.from('categories').update({ min_price: mn.value === '' ? null : Number(mn.value), max_price: mx.value === '' ? null : Number(mx.value) }).eq('id', c.id);
          UI.toast(error ? 'ERR' : 'OK', error ? 'error' : 'success');
        })];
      })));
    }
  };
  const clear = p => { p.replaceChildren(); return p; };

  App.pages.admin = async function () {
    if (!(await App.boot({ guard: true }))) return;
    const { data: ok } = await SB.db.rpc('is_admin');
    if (ok !== true) return Utils.go(window.CONFIG.ROUTES.HOME);
    const tabs = $('#tabs'), panel = $('#panel');
    const names = { overview: 'admin.title', reports: 'admin.reports', verifications: 'admin.verifications', banners: 'admin.banners', errors: 'admin.errors', survey: 'admin.survey', prices: 'admin.prices' };
    const open = async k => {
      tabs.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.k === k));
      clear(panel); panel.append(UI.skeletonCards(1));
      const holder = el('div'); try { await TABS[k].call(TABS, holder); } catch (e) { console.error('[Admin]', k, e); }
      panel.replaceChildren(holder);
    };
    Object.keys(TABS).forEach(k => tabs.append(el('button', { type: 'button', 'data-k': k, onclick: () => open(k) }, t(names[k]))));
    open('overview');
  };
})();
