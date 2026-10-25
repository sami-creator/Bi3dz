/* notifications.js — إشعارات داخل التطبيق (Realtime) + مؤشر غير المقروء */
(function () {
  'use strict';
  const el = Utils.el, t = k => I18n.t(k);
  let unread = 0, ch = null;

  function paintBadge() {
    document.querySelectorAll('[data-notif-badge]').forEach(b => { b.textContent = unread > 99 ? '99+' : unread; b.hidden = unread <= 0; });
  }

  const Notifications = {
    async init() {
      if (!Auth.uid()) return;
      const { count } = await SB.db.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', Auth.uid()).eq('is_read', false);
      unread = count || 0; paintBadge();
      if (ch) SB.db.removeChannel(ch);
      ch = SB.db.channel('notif-' + Auth.uid()).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: 'user_id=eq.' + Auth.uid() }, p => {
        unread++; paintBadge(); UI.toast(p.new.message || t('notif.title'), 'info', 4000);
        document.dispatchEvent(new CustomEvent('newnotif', { detail: p.new }));
        if ('Notification' in window && Notification.permission === 'granted' && document.hidden) new Notification(t('app.name'), { body: p.new.message || '' });
      }).subscribe();
    },
    async requestPermission() { if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission(); },

    async render(container) {
      container.replaceChildren(UI.skeletonCards(2));
      const { data, error } = await SB.db.from('notifications').select('id,type,ad_id,message,is_read,created_at').eq('user_id', Auth.uid()).order('created_at', { ascending: false }).limit(50);
      container.replaceChildren();
      if (error) return UI.toastKey(UI.errKey(error), 'error');
      if (!data.length) return UI.emptyState(container, 'notif.none', 'empty.sub');
      data.forEach(n => {
        const item = el('div', { class: 'notif-item' + (n.is_read ? '' : ' unread'), role: 'button', tabindex: 0 }, [
          el('div', { class: 'grow' }, [el('div', { text: n.message || n.type }), el('div', { class: 'hint', text: Utils.timeAgo(n.created_at) })])
        ]);
        item.addEventListener('click', () => { if (n.ad_id) Utils.go(window.CONFIG.ROUTES.AD, { id: n.ad_id }); });
        container.append(item);
      });
      await SB.db.from('notifications').update({ is_read: true }).eq('user_id', Auth.uid()).eq('is_read', false);
      unread = 0; paintBadge();
    }
  };
  window.Notifications = Notifications;
})();
