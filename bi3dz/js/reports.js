/* reports.js — الإبلاغ عن ناشر/إعلان (مرة واحدة، بلا إجراء تلقائي) مع أسباب رئيسية وفروع */
(function () {
  'use strict';
  const el = Utils.el, t = k => I18n.t(k);
  const USER_REASONS = ['fake_account', 'scammer', 'unsafe'];
  // أسباب الإعلان: كل سبب رئيسي له فروع (تُرسل بصيغة main:sub)
  const AD_REASONS = {
    drugs: ['cannabis', 'pills', 'hard', 'other'],
    weapons: ['firearm', 'blade', 'spray', 'explosive', 'other'],
    pharma: ['prescription', 'psychotropic', 'stimulants', 'other'],
    sexual: ['image', 'text', 'services', 'other'],
    hate: ['religion', 'race', 'group', 'violence'],
    political: ['propaganda', 'incitement', 'fake_news', 'other'],
    other: []
  };

  function overlay(box) {
    const ov = el('div', { class: 'modal-overlay' });
    ov.append(box); ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); }); document.body.append(ov); return ov;
  }

  async function submit(type, id, reasons, note, btn, ov) {
    UI.setLoading(btn, true);
    const { error } = await SB.db.rpc('submit_report', { p_type: type, p_id: id, p_reasons: reasons, p_note: note, p_device: await Fingerprint.get() });
    UI.setLoading(btn, false);
    if (error) return UI.toastKey(UI.errKey(error), 'error');
    UI.toastKey('report.done', 'success'); ov.remove();
  }

  const Reports = {
    async open(type, id) {
      await Auth.ready();
      if (!Auth.isLogged()) { UI.toastKey('auth.need_login', 'info'); return Router.toLogin(); }
      return type === 'ad' ? this.openAd(id) : this.openUser(id);
    },

    openUser(id) {
      const box = el('div', { class: 'modal' }), list = el('div', { class: 'check-list' });
      USER_REASONS.forEach(r => list.append(el('label', {}, [el('input', { type: 'checkbox', value: r }), t('report.' + r)])));
      const note = el('textarea', { class: 'input', maxlength: window.CONFIG.LIMITS.REPORT_NOTE });
      const send = el('button', { class: 'btn btn--primary grow', type: 'button' }, t('common.send'));
      let ov;
      send.addEventListener('click', () => {
        const reasons = [...list.querySelectorAll('input:checked')].map(i => i.value);
        if (!reasons.length) return;
        const n = Sanitize.validateText(note.value, { max: window.CONFIG.LIMITS.REPORT_NOTE, allowPhone: true });
        submit('user', id, reasons, n.value, send, ov);
      });
      box.append(el('h3', { text: t('report.user') }), list, note, el('div', { class: 'modal__row' }, [send, el('button', { class: 'btn btn--ghost', type: 'button', onclick: () => ov.remove() }, t('common.cancel'))]));
      ov = overlay(box);
    },

    openAd(id) {
      const box = el('div', { class: 'modal' }), list = el('div');
      const note = el('textarea', { class: 'input', maxlength: window.CONFIG.LIMITS.REPORT_NOTE, placeholder: t('report.other_hint') });
      const noteWrap = el('div', { hidden: true }, [note]);
      let main = '';
      Object.entries(AD_REASONS).forEach(([key, subs]) => {
        const radio = el('input', { type: 'radio', name: 'rmain', value: key });
        const subBox = el('div', { class: 'check-list', style: 'margin:0 22px 6px', hidden: true }, subs.map(s => el('label', {}, [el('input', { type: 'checkbox', value: s }), t('report.' + key + '.' + s)])));
        radio.addEventListener('change', () => {
          main = key;
          list.querySelectorAll('.check-list').forEach(b => { b.hidden = true; });
          subBox.hidden = !subs.length; noteWrap.hidden = key !== 'other';
        });
        list.append(el('label', { class: 'rmain', style: 'display:flex;gap:8px;align-items:center;padding:8px 0;font-weight:600' }, [radio, t('report.' + key)]), subBox);
      });
      const send = el('button', { class: 'btn btn--primary grow', type: 'button' }, t('common.send'));
      let ov;
      send.addEventListener('click', () => {
        if (!main) return;
        const subs = [...list.querySelectorAll('.check-list:not([hidden]) input:checked')].map(i => main + ':' + i.value);
        const n = Sanitize.validateText(main === 'other' ? note.value : '', { max: window.CONFIG.LIMITS.REPORT_NOTE, allowPhone: true });
        if (main === 'other' && !n.value) return UI.toastKey('report.other_hint', 'error');
        submit('ad', id, [main].concat(subs), n.value || '', send, ov);
      });
      box.append(el('h3', { text: t('report.ad') }), list, noteWrap, el('div', { class: 'modal__row' }, [send, el('button', { class: 'btn btn--ghost', type: 'button', onclick: () => ov.remove() }, t('common.cancel'))]));
      ov = overlay(box);
    },

    // زر إبلاغ بقائمتين: الإعلان والناشر
    openMenu(adId, sellerId) {
      const box = el('div', { class: 'modal' });
      let ov;
      const b = (k, fn) => el('button', { class: 'menu-opt', type: 'button', onclick: () => { ov.remove(); fn(); } }, [t(k), '🚩']);
      box.append(b('report.ad', () => this.open('ad', adId)), b('report.user', () => this.open('user', sellerId)));
      ov = overlay(box);
    }
  };
  window.Reports = Reports;
})();
