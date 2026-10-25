/* ratings.js — تقييم إعلان/حساب: 5 نجوم، تعليق واحد لكل حساب، حماية ببصمة الجهاز (تتكرر في الخادم) */
(function () {
  'use strict';
  const el = Utils.el, t = k => I18n.t(k);

  async function list(type, id) {
    const { data } = await SB.db.from('ratings').select('id,user_id,stars,comment,created_at,users(name,avatar_url)').eq('target_type', type).eq('target_id', id).order('created_at', { ascending: false }).limit(30);
    return data || [];
  }

  const Ratings = {
    async mount(container, { type, id, ownerId }) {
      container.replaceChildren();
      const listBox = el('div'), formBox = el('div', { class: 'card-box' });
      container.append(listBox, formBox);

      const paint = async () => {
        const rows = await list(type, id);
        listBox.replaceChildren();
        rows.forEach(r => {
          const mine = r.user_id === Auth.uid();
          listBox.append(el('div', { class: 'faq-item' }, [
            el('div', { class: 'row' }, [el('b', { text: (r.users && r.users.name) || '' }), el('span', { class: 'stars', text: '★'.repeat(r.stars) }), el('span', { class: 'hint', text: Utils.formatDate(r.created_at) })]),
            r.comment ? el('div', { text: r.comment }) : null,
            // الحذف لصاحب التقييم فقط، ولا تستطيع صاحبة الإعلان حذف تقييمات غيرها
            mine ? el('button', { class: 'btn btn--ghost', type: 'button', onclick: async () => { await SB.db.from('ratings').delete().eq('id', r.id).eq('user_id', Auth.uid()); paint(); } }, t('common.delete')) : null
          ]));
        });
        formBox.hidden = rows.some(r => r.user_id === Auth.uid());
      };

      let stars = 0;
      const sBox = el('div', { class: 'rate-stars' });
      for (let n = 1; n <= 5; n++) sBox.append(el('button', { type: 'button', 'aria-label': n + '', onclick: () => { stars = n; [...sBox.children].forEach((b, k) => b.classList.toggle('on', k < n)); } }, '★'));
      const cm = el('textarea', { class: 'input', maxlength: window.CONFIG.LIMITS.FAQ_A, placeholder: t('rate.comment') });
      const send = el('button', { class: 'btn btn--primary', type: 'button' }, t('common.send'));
      formBox.append(el('b', { text: t('rate.title') }), sBox, cm, send);

      send.addEventListener('click', async () => {
        await Auth.ready();
        if (!Auth.isLogged()) return Router.toLogin();
        if (Auth.uid() === ownerId) return UI.toastKey('rate.own', 'error');
        if (!stars) return;
        const c = Sanitize.validateText(cm.value, { max: window.CONFIG.LIMITS.FAQ_A });
        if (!c.ok) return UI.toastKey(c.error, 'error');
        UI.setLoading(send, true);
        const { error } = await SB.db.rpc('submit_rating', { p_type: type, p_id: id, p_stars: stars, p_comment: c.value, p_device: await Fingerprint.get() });
        UI.setLoading(send, false);
        if (error) return UI.toastKey(UI.errKey(error), 'error');
        Interests.record('buy_or_rate', { subcategory_id: null });
        paint();
      });
      paint();
    }
  };
  window.Ratings = Ratings;
})();
