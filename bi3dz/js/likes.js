/* likes.js — الإعجاب: تحديث فوري (Optimistic UI) مع تراجع عند الفشل */
(function () {
  'use strict';
  const K = window.CONFIG.STORAGE_KEYS;
  let set = new Set(), loaded = false;

  const Likes = {
    async load() {
      if (loaded || !Auth.uid()) return;
      const { data } = await SB.db.from('likes').select('ad_id').eq('user_id', Auth.uid());
      set = new Set((data || []).map(r => r.ad_id)); loaded = true;
    },
    has(id) { return set.has(id); },
    paint(root = document) { root.querySelectorAll('[data-like]').forEach(b => b.classList.toggle('liked', set.has(b.dataset.like))); },

    async toggle(ad, btn) {
      await Auth.ready();
      if (!Auth.isLogged()) { UI.toastKey('auth.need_login', 'info'); return Router.toLogin(); }
      if (ad.user_id === Auth.uid()) return UI.toastKey('ad.own_like', 'info');
      if (ad.status === 'sold') return;
      const was = set.has(ad.id);
      // تحديث فوري
      was ? set.delete(ad.id) : set.add(ad.id);
      btn.classList.toggle('liked', !was);
      const { error } = was
        ? await SB.db.from('likes').delete().eq('ad_id', ad.id).eq('user_id', Auth.uid())
        : await SB.db.from('likes').insert({ user_id: Auth.uid(), ad_id: ad.id });
      if (error) {
        was ? set.add(ad.id) : set.delete(ad.id);
        btn.classList.toggle('liked', was);
        return UI.toastKey(UI.errKey(error), 'error');
      }
      if (!was) {
        Interests.record('like', ad);
        if (!Utils.Store.get(K.LIKE_TOAST)) { Utils.Store.set(K.LIKE_TOAST, true); UI.toastKey('ad.like_toast', 'success', 5000); }
      }
      document.querySelectorAll('[data-likes="' + ad.id + '"]').forEach(s => {
  const n = Math.max(0, (parseInt(s.textContent.replace(/\D/g, '')) || 0) + (was ? -1 : 1));
  s.textContent = s.hasAttribute('data-plain') ? n : '♥ ' + n;});
      document.dispatchEvent(new CustomEvent('likechange', { detail: { id: ad.id, liked: !was } }));
    },

    async listMine() {
      const { data, error } = await SB.db.from('likes').select('ads_feed(' + Ads.LIST_COLS + ')').eq('user_id', Auth.uid()).order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map(r => r.ads_feed).filter(Boolean);
    }
  };
  window.Likes = Likes;
})();
