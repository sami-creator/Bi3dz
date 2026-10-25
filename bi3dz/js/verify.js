/* verify.js — توثيق الهوية: صورتا الهوية (Bucket خاص) + رقم هاتف مع كود تحقق، ثم مراجعة من الأدمن */
(function () {
  'use strict';
  const el = Utils.el, t = k => I18n.t(k);
  const $ = s => document.querySelector(s);
  const PHONE_RE = /^(?:\+213|0)[567]\d{8}$/;
  const normPhone = v => Sanitize.toLatinDigits(v).replace(/[\s.\-()]/g, '');

  App.pages.verify = async function () {
    const st = await App.boot({ guard: true });
    if (!st) return;
    const state = $('#state'), form = $('#form-verify');
    const show = (msg, extra) => { state.hidden = false; state.replaceChildren(el('p', { text: msg }), extra || ''); };

    if (st.profile.is_verified) return show(t('verify.already'));
    const { data: last } = await SB.db.from('verification_requests').select('status,reject_reason').eq('user_id', Auth.uid()).order('created_at', { ascending: false }).limit(1);
    const req = last && last[0];
    if (req && req.status === 'pending') return show(t('verify.pending'));
    if (req && req.status === 'rejected') show(t('admin.reject') + ': ' + (req.reject_reason || ''));
    form.hidden = false;

    const phone = $('#phone'), code = $('#code'), btnCode = $('#btn-code');
    let cooldown = 0;
    btnCode.addEventListener('click', async () => {
      const p = normPhone(phone.value);
      if (!PHONE_RE.test(p)) return UI.toastKey('verify.bad_phone', 'error');
      if (cooldown > Date.now()) return UI.toastKey('err.rate_limited', 'error');
      UI.setLoading(btnCode, true);
      const { error } = await SB.db.rpc('request_phone_otp', { p_phone: p });
      UI.setLoading(btnCode, false);
      if (error) return UI.toastKey(UI.errKey(error), 'error');
      cooldown = Date.now() + 60000; UI.toastKey('verify.code_sent', 'success');
    });

    form.addEventListener('submit', async e => {
      e.preventDefault();
      const front = $('#id-front').files[0], back = $('#id-back').files[0];
      if (!front || !back) return UI.toastKey('verify.need_images', 'error');
      const p = normPhone(phone.value);
      if (!PHONE_RE.test(p)) return UI.toastKey('verify.bad_phone', 'error');
      const btn = $('#btn-submit'); UI.setLoading(btn, true);
      try {
        for (const f of [front, back]) { const v = await Upload.validate(f); if (!v.ok) return UI.toastKey(v.error, 'error'); }
        const ok = await SB.db.rpc('verify_phone_otp', { p_phone: p, p_code: Sanitize.toLatinDigits(code.value).trim() });
        if (ok.error || ok.data !== true) return UI.toastKey('verify.bad_code', 'error');
        const id = Utils.uuid(), base = `${Auth.uid()}/${id}`;
        const fp = await Upload.putPrivate('id-docs', base + '_front.webp', front);
        const bp = await Upload.putPrivate('id-docs', base + '_back.webp', back);
        const { error } = await SB.db.from('verification_requests').insert({ user_id: Auth.uid(), phone: p, id_front_path: fp, id_back_path: bp, status: 'pending' });
        if (error) throw error;
        form.hidden = true; show(t('verify.sent'));
      } catch (err) { console.error('[Verify]', err); UI.toastKey(UI.errKey(err), 'error'); }
      finally { UI.setLoading(btn, false); }
    });
  };
})();
