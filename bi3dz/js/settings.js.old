/* settings.js — صفحة الإعدادات */
(function () {
  'use strict';
  const C = window.CONFIG, K = C.STORAGE_KEYS;
  const el = window.Utils.el;
  const $ = s => document.querySelector(s);
  const t = k => I18n.t(k);

  window.Settings = {
    async init() {
      const root = $('#settings-root');
      if (!root) return;

      const lang = el('select', { class: 'input', style: 'width:auto' });
      C.LANGS.forEach(l => lang.append(new Option(l.toUpperCase(), l)));
      lang.value = I18n.lang;
      lang.addEventListener('change', async () => {
        await I18n.set(lang.value);
        const r = document.querySelector('#settings-root');
        r.innerHTML = '';
        await Settings.init();
      });

      const darkToggle = el('label', { class: 'toggle' }, [
        el('input', { type: 'checkbox', id: 'dark-toggle' }),
        el('span', { class: 'toggle__track' })
      ]);
      const darkInput = darkToggle.querySelector('input');
      darkInput.checked = (document.documentElement.dataset.theme || C.DEFAULTS.THEME) === 'dark';
      darkInput.addEventListener('change', () => {
        Theme.setMode(darkInput.checked ? 'dark' : 'light');
        darkInput.checked = document.documentElement.dataset.theme === 'dark';
      });

      const sw = el('div', { class: 'color-swatches' });
      C.COLORS.forEach(c => {
        const s = el('button', { class: 'swatch', type: 'button', style: `background:${C.COLOR_HEX[c]}`, 'data-color': c, 'aria-label': c });
        s.addEventListener('click', () => { Theme.setColor(c); sw.querySelectorAll('.swatch').forEach(x => x.classList.toggle('active', x.dataset.color === c)); });
        if ((document.documentElement.dataset.color || C.DEFAULTS.COLOR) === c) s.classList.add('active');
        sw.append(s);
      });

      const font = el('select', { class: 'input', style: 'width:auto' });
      Object.entries(C.FONTS).forEach(([k, n]) => font.append(new Option(n, k)));
      font.value = document.documentElement.dataset.font || C.DEFAULTS.FONT;
      font.addEventListener('change', () => Theme.setFont(font.value));

      // ── أزرار الدعم الثلاثة ──────────────────────────────────────────
      const wa = C.SUPPORT.WHATSAPP ? 'https://wa.me/' + encodeURIComponent(C.SUPPORT.WHATSAPP) : null;
      const tg = C.SUPPORT.TELEGRAM ? 'https://t.me/' + encodeURIComponent(C.SUPPORT.TELEGRAM) : null;

      const supportBtns = el('div', { class: 'contact-links' });

      // زر المساعد الذكي — يفتح smart_agent.html
      const agentBtn = el('a', {
        href: C.ROUTES.SMART_AGENT,
        class: 'btn btn--ghost contact-link contact-link--agent',
        'aria-label': t('settings.support')
      });
      agentBtn.textContent = t('settings.support');
      supportBtns.append(agentBtn);

      if (wa) {
        const waBtn = el('a', { href: wa, target: '_blank', rel: 'noopener noreferrer', class: 'btn btn--ghost contact-link contact-link--whatsapp' });
        waBtn.textContent = 'WhatsApp';
        supportBtns.append(waBtn);
      }
      if (tg) {
        const tgBtn = el('a', { href: tg, target: '_blank', rel: 'noopener noreferrer', class: 'btn btn--ghost contact-link contact-link--telegram' });
        tgBtn.textContent = 'Telegram';
        supportBtns.append(tgBtn);
      }

      function row(label, ctrl) {
        return el('div', { class: 'settings-row' }, [
          el('span', { text: label }),
          ctrl
        ]);
      }

      root.append(
        row(t('settings.language'), lang),
        row(t('settings.dark'), darkToggle),
        row(t('settings.color'), sw),
        row(t('settings.font'), font),
        row(t('settings.support'), supportBtns),
        el('div', { class: 'settings-row' }, [el('a', { href: C.ROUTES.PRIVACY, text: t('settings.privacy') })]),
        el('div', { class: 'settings-row' }, [el('button', { class: 'btn btn--ghost', type: 'button', onclick: () => this.reportBug(), text: t('settings.report_bug') })])
      );
    },

    reportBug() {
      const ov = el('div', { class: 'modal-overlay' }), box = el('div', { class: 'modal' });
      const ta = el('textarea', { class: 'input', maxlength: C.LIMITS.INPUT_GENERIC });
      const send = el('button', { class: 'btn btn--primary grow', type: 'button' }, t('common.send'));
      send.addEventListener('click', async () => {
        const v = Sanitize.validateText(ta.value, { max: C.LIMITS.INPUT_GENERIC, min: 3, allowPhone: true });
        if (!v.ok) return UI.toastKey(v.error, 'error');
        UI.setLoading(send, true);
        const { error } = await SB.db.from('error_logs').insert({ user_id: Auth.uid(), page: 'settings', message: '[user_report] ' + v.value, device_model: navigator.userAgent.slice(0, 120) });
        UI.setLoading(send, false);
        if (error) return UI.toastKey('err.generic', 'error');
        UI.toastKey('report.done', 'success'); ov.remove();
      });
      box.append(el('h3', { text: t('settings.report_bug') }), ta, el('div', { class: 'modal__row' }, [send, el('button', { class: 'btn btn--ghost', type: 'button', onclick: () => ov.remove() }, t('common.cancel'))]));
      ov.append(box); ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); }); document.body.append(ov);
    },

    // يُستدعى من profile.js بعد حفظ تعديلات الملف الشخصي
        handlePostAdReturn() {
      const key = C.STORAGE_KEYS.RETURN_TO;
      const ret = Utils.Store.get(key);
      if (ret) { Utils.Store.remove(key); Router.go(ret); }
    },
    render() { return this.init(); }
  };
})();
