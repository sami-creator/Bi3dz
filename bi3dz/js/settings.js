/* settings.js — صفحة الإعدادات */
(function () {
  'use strict';
  const C = window.CONFIG, K = C.STORAGE_KEYS;
  const el = window.Utils.el;
  const $ = s => document.querySelector(s);
  const t = k => I18n.t(k);
  // نص احتياطي إن لم تُضف مفاتيح الترجمة بعد
  const tx = (k, fb) => { const v = I18n.t(k); return (!v || v === k) ? fb : v; };

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

      // ── ربط إشعارات تلغرام ───────────────────────────────────────────
      const tgNotify = this.buildTelegramNotify();

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
        row(t('settings.support'), supportBtns)
      );
      if (tgNotify) root.append(row(tx('settings.tg_notify', 'إشعارات تلغرام'), tgNotify));
      root.append(
        el('div', { class: 'settings-row' }, [el('a', { href: C.ROUTES.PRIVACY, text: t('settings.privacy') })]),
        el('div', { class: 'settings-row' }, [el('button', { class: 'btn btn--ghost', type: 'button', onclick: () => this.reportBug(), text: t('settings.report_bug') })])
      );
    },

    // زر ربط/فك ربط تلغرام (يظهر فقط للمستخدم المسجّل وعند ضبط اسم البوت)
    buildTelegramNotify() {
      const bot = window.__ENV__ && window.__ENV__.TELEGRAM_BOT_USERNAME;
      if (!bot || !window.Auth || !Auth.uid()) return null;

      const btn = el('button', { class: 'btn btn--ghost', type: 'button' });
      const setState = linked => {
        btn.dataset.linked = linked ? '1' : '0';
        btn.textContent = linked ? tx('settings.tg_unlink', 'فك الربط') : tx('settings.tg_link', 'ربط تلغرام');
      };
      btn.textContent = '…';
      btn.disabled = true;

      // حالة الربط الحالية
      SB.db.from('users').select('telegram_chat_id').eq('id', Auth.uid()).maybeSingle().then(({ data }) => {
        setState(!!(data && data.telegram_chat_id));
        btn.disabled = false;
      });

      btn.addEventListener('click', async () => {
        UI.setLoading(btn, true);
        if (btn.dataset.linked === '1') {
          // فك الربط
          const { error } = await SB.db.from('users').update({ telegram_chat_id: null, telegram_link_token: null }).eq('id', Auth.uid());
          UI.setLoading(btn, false);
          if (error) return UI.toastKey('err.generic', 'error');
          setState(false);
          UI.toast(tx('settings.tg_unlinked', 'تم فك ربط تلغرام'), 'success');
          return;
        }
        // ربط: رمز عشوائي ثم فتح البوت
        const token = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(36).slice(2)).replace(/-/g, '');
        const { error } = await SB.db.from('users').update({ telegram_link_token: token }).eq('id', Auth.uid());
        UI.setLoading(btn, false);
        if (error) return UI.toastKey('err.generic', 'error');
        window.open('https://t.me/' + encodeURIComponent(bot) + '?start=' + token, '_blank', 'noopener');
        UI.toast(tx('settings.tg_hint', 'اضغط Start في تلغرام ثم عد وأعد فتح الإعدادات'), 'info', 6000);
      });

      return btn;
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
