/* alerts.js — التنبيهات المخصصة (حد أقصى 3): صنف فرعي + ولاية + مجال سعر */
(function () {
  'use strict';
  const el = Utils.el, t = k => I18n.t(k), MAX = () => window.CONFIG.LIMITS.ALERTS_MAX;

  // تحميل push.js عند الحاجة فقط ثم تفعيل إشعارات Firebase (طلب الإذن + حفظ رمز الجهاز)
  async function enablePush() {
    if (!window.Push) {
      await new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = 'js/push.js'; s.onload = res; s.onerror = rej;
        document.head.append(s);
      });
    }
    return window.Push.enable();
  }

  const Alerts = {
    async list() {
      const { data } = await SB.db.from('alert_subscriptions').select('id,category_id,wilaya_id,min_price,max_price').eq('user_id', Auth.uid()).order('created_at');
      return data || [];
    },
    async add({ subcategory_id, wilaya_id, min_price, max_price }) {
      if ((await this.list()).length >= MAX()) return { error: 'err.alerts_max' };
      if (!subcategory_id) return { error: 'err.category_required' };
      const { error } = await SB.db.from('alert_subscriptions').insert({ user_id: Auth.uid(), category_id: subcategory_id, wilaya_id: wilaya_id || null, min_price: min_price || null, max_price: max_price || null });
      return error ? { error: UI.errKey(error) } : { ok: true };
    },
    async remove(id) { return SB.db.from('alert_subscriptions').delete().eq('id', id).eq('user_id', Auth.uid()); },

    // تحويل نتيجة بحث إلى تنبيه (مثل إضافته من قسم التنبيهات): الصنف الفرعي + الولاية + مجال السعر المفهوم من البحث
    async fromSearch(f, btn) {
      await Auth.ready();
      if (!Auth.isLogged()) { UI.toastKey('auth.need_login', 'info'); return Router.toLogin(); }
      await Promise.all([Categories.load(), Geo.load()]);
      let sub = f.subcategory_id;
      if (!sub && window.Dict) { const p = Dict.parse(f.qraw || f.q || ''); sub = (p.hint && p.hint.sub) || ''; }
      const base = { wilaya_id: (f.wilaya_ids || [])[0] || null, min_price: f.min_price || null, max_price: f.max_price || null };
      const save = async (subId, b) => {
        UI.setLoading(b, true);
        const r = await this.add(Object.assign({ subcategory_id: subId }, base));
        UI.setLoading(b, false);
        if (r.error) { UI.toastKey(r.error, 'error'); return false; }
        UI.toastKey('alert.added', 'success');
        enablePush().catch(e => console.error('[Alerts] push', e));
        return true;
      };
      if (sub) return save(sub, btn);
      // لم نتعرف على الصنف الفرعي: نسأل المستخدم عنه
      const ov = el('div', { class: 'modal-overlay' }), box = el('div', { class: 'modal' });
      const sel = el('select', { class: 'input' }); sel.append(new Option(t('filters.subcategory'), ''));
      Categories.all().forEach(m => { const g = el('optgroup', { label: Categories.label(m) }); m.sub.forEach(x => g.append(new Option(Categories.label(x), x.id))); sel.append(g); });
      const ok = el('button', { class: 'btn btn--primary grow', type: 'button' }, t('notif.add_alert'));
      ok.addEventListener('click', async () => { if (!sel.value) return UI.toastKey('err.category_required', 'error'); if (await save(sel.value, ok)) ov.remove(); });
      box.append(el('h3', { text: t('alert.choose_sub') }), el('p', { class: 'hint', text: [f.qraw || f.q, base.wilaya_id ? Geo.label(Geo.wilaya(base.wilaya_id)) : ''].filter(Boolean).join(' · ') }), sel,
        el('div', { class: 'modal__row' }, [ok, el('button', { class: 'btn btn--ghost', type: 'button', onclick: () => ov.remove() }, t('common.cancel'))]));
      ov.append(box); ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); }); document.body.append(ov);
    },

    async render(container) {
      await Promise.all([Categories.load(), Geo.load()]);
      const paint = async () => {
        container.replaceChildren();
        const rows = await this.list();
        container.append(el('p', { class: 'hint', text: t('notif.alerts_max') + ' (' + rows.length + '/' + MAX() + ')' }));
        rows.forEach(a => {
          const s = Categories.findSub(a.category_id);
          container.append(el('div', { class: 'settings-row' }, [
            el('span', { text: [Categories.label(s && s.sub), a.wilaya_id ? Geo.label(Geo.wilaya(a.wilaya_id)) : '', (a.min_price || a.max_price) ? Utils.formatNumber(a.min_price || 0) + ' - ' + (a.max_price ? Utils.formatNumber(a.max_price) : '∞') : ''].filter(Boolean).join(' · ') }),
            el('button', { class: 'btn btn--ghost', type: 'button', onclick: async () => { await this.remove(a.id); paint(); } }, t('common.delete'))
          ]));
        });
        if (rows.length >= MAX()) return;
        const sub = el('select', { class: 'input' }); sub.append(new Option(t('filters.subcategory'), ''));
        Categories.all().forEach(m => { const g = el('optgroup', { label: Categories.label(m) }); m.sub.forEach(s => g.append(new Option(Categories.label(s), s.id))); sub.append(g); });
        const w = el('select', { class: 'input' }); Geo.fill(w, Geo.wilayas(), 'geo.wilaya');
        const min = el('input', { class: 'input', type: 'number', min: 1, inputmode: 'numeric', placeholder: t('filters.price_from') });
        const max = el('input', { class: 'input', type: 'number', min: 1, inputmode: 'numeric', placeholder: t('filters.price_to') });
        const add = el('button', { class: 'btn btn--primary', type: 'button' }, t('notif.add_alert'));
        add.addEventListener('click', async () => {
          const r = await this.add({ subcategory_id: sub.value, wilaya_id: Number(w.value) || null, min_price: Number(min.value) || null, max_price: Number(max.value) || null });
          if (r.error) return UI.toastKey(r.error, 'error');
          await enablePush().catch(e => console.error('[Alerts] push', e)); paint();
        });
        container.append(el('div', { class: 'card-box' }, [sub, w, el('div', { class: 'row' }, [min, max]), add]));
      };
      paint();
    }
  };
  window.Alerts = Alerts;
})();
