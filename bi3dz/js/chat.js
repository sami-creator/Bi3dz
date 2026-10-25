/* chat.js — دردشة نصية فقط (Supabase Realtime)، 300 حرف، منع الأرقام، حظر شفاف */
(function () {
  'use strict';
  const el = Utils.el, t = k => I18n.t(k), MAX = () => window.CONFIG.LIMITS.CHAT_MESSAGE;
  let channel = null;

  const Chat = {
    async start(adId, sellerId) {
      await Auth.ready();
      if (!Auth.isLogged()) { UI.toastKey('auth.need_login', 'info'); return Router.toLogin(); }
      if (sellerId === Auth.uid()) return UI.toastKey('rate.own', 'info');
      const { data, error } = await SB.db.rpc('get_or_create_conversation', { p_ad: adId });
      if (error) return UI.toastKey(UI.errKey(error), 'error');
      Interests.record('message', { subcategory_id: null });
      Utils.go(window.CONFIG.ROUTES.CHAT, { c: data });
    },

    async list(container) {
      container.replaceChildren();
      const { data, error } = await SB.db.rpc('my_conversations');
      if (error) { UI.toastKey(UI.errKey(error), 'error'); return; }
      if (!data || !data.length) return UI.emptyState(container, 'notif.none', 'empty.sub');
      const box = el('div', { class: 'chat-list' });
      data.forEach(c => box.append(el('a', { class: 'chat-item', href: window.CONFIG.ROUTES.CHAT + '?c=' + encodeURIComponent(c.id) }, [
        el('img', { class: 'avatar-xs', style: 'width:42px;height:42px', src: Utils.imgUrl(c.other_avatar || 'assets/images/avatar.svg', 'thumb'), alt: '' }),
        el('div', { class: 'grow' }, [el('b', { text: c.other_name || '' }), el('div', { class: 'hint', text: c.ad_title || '' }), el('div', { class: 'muted', text: c.last_message || '' })]),
        c.unread ? el('span', { class: 'dot-badge', style: 'position:static', text: c.unread }) : null
      ])));
      container.append(box);
    },

    async open(convId, container) {
      const msgs = el('div', { class: 'chat-msgs' }), foot = el('div');
      const adSlot = el('div'), presetSlot = el('div');
      const peerBar = el('div', { class: 'chat-peer' });
      const box = el('div', { class: 'chat-box' }, [peerBar, adSlot, msgs, presetSlot, foot]);
      container.replaceChildren(box);

      // بطاقة الإعلان أعلى المحادثة (تظهر للمشتري والناشر ليفهم كل طرف عن أي إعلان يتحدثان)
      let conv = null;
      try {
        const { data: c } = await SB.db.from('conversations').select('ad_id,buyer_id,seller_id').eq('id', convId).maybeSingle();
        conv = c;
        if (c && c.ad_id) {
          const { data: ad } = await SB.db.from('ads_feed').select(Ads.LIST_COLS).eq('id', c.ad_id).maybeSingle();
          if (ad) {
            const im = el('img', { src: Utils.imgUrl(ad.thumb_path, 'thumb'), alt: '' });
            im.addEventListener('error', () => { im.src = 'assets/images/placeholder.svg'; }, { once: true });
            const card = el('div', { class: 'chat-ad', role: 'link' }, [im, el('div', { class: 'grow' }, [el('b', { text: ad.title }), el('div', { class: 'p', text: Price.display(ad).text })])]);
            card.addEventListener('click', () => Utils.go(window.CONFIG.ROUTES.AD, { id: ad.id }));
            adSlot.append(card);
          }
        }
      } catch (e) { console.warn('[Chat] ad card', e); }

      const { data: st } = await SB.db.rpc('block_status', { p_conv: convId });
      const status = (st && st[0]) || {};
      // حالة الطرف الآخر: متصل الآن / آخر ظهور منذ ... (تُحدَّث كل 30 ثانية)
      clearInterval(Chat._pt);
      const paintPeer = async () => {
        if (!status.other_id) return;
        const { data: u } = await SB.db.from('seller_public').select('name,avatar_url,last_seen').eq('id', status.other_id).maybeSingle();
        if (!u) return;
        const on = !!u.last_seen && Date.now() - new Date(u.last_seen).getTime() < 5 * 60 * 1000;
        const im = el('img', { class: 'avatar-xs', style: 'width:36px;height:36px', src: Utils.imgUrl(u.avatar_url || 'assets/images/avatar.svg', 'thumb'), alt: '' });
        im.addEventListener('error', () => { im.src = 'assets/images/avatar.svg'; }, { once: true });
        peerBar.replaceChildren(im, el('div', { class: 'grow' }, [
          el('b', { text: u.name || '' }),
          el('div', { class: 'chat-peer__st' + (on ? ' on' : '') }, [el('span', { class: 'presence' + (on ? ' on' : '') }), on ? t('chat.online') : (u.last_seen ? t('chat.last_seen') + ' ' + Utils.timeAgo(u.last_seen) : '')])
        ]));
      };
      paintPeer().catch(e => console.warn('[Chat] peer', e));
      const renderMsg = m => {
        const me = m.sender_id === Auth.uid();
        msgs.append(el('div', { class: 'msg' + (me ? ' msg--me' : '') }, [el('span', { text: m.content }), el('small', { text: Utils.timeAgo(m.created_at) })]));
        msgs.scrollTop = msgs.scrollHeight;
      };

      // عند الحظر تختفي الرسائل ويظهر إشعار لكلا الطرفين
      const blocked = status.blocked_by_me || status.blocked_me;
      if (blocked) {
        msgs.replaceChildren();
        foot.append(el('div', { class: 'chat-note', text: t(status.blocked_by_me ? 'chat.blocked_by_me' : 'chat.blocked_me') }));
        if (status.blocked_by_me) foot.append(el('button', { class: 'btn btn--ghost btn--block', type: 'button', onclick: async () => { await SB.db.from('blocks').delete().eq('blocker_id', Auth.uid()).eq('blocked_id', status.other_id); this.open(convId, container); } }, t('chat.unblock')));
        return;
      }

      const { data } = await SB.db.from('messages').select('id,sender_id,content,created_at').eq('conversation_id', convId).order('created_at', { ascending: false }).limit(50);
      (data || []).reverse().forEach(renderMsg);
      SB.db.rpc('mark_read', { p_conv: convId });

      Chat._pt = setInterval(() => paintPeer().catch(() => {}), 30000);
      if (channel) SB.db.removeChannel(channel);
      channel = SB.db.channel('conv-' + convId).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: 'conversation_id=eq.' + convId }, p => { if (p.new.sender_id !== Auth.uid()) renderMsg(p.new); }).subscribe();

      const input = el('input', { class: 'input', maxlength: MAX(), placeholder: t('chat.placeholder') });
      const send = el('button', { class: 'btn btn--primary', type: 'button' }, t('common.send'));
      const blockBtn = el('button', { class: 'btn btn--ghost', type: 'button', onclick: async () => {
        if (!(await UI.confirmDialog(t('chat.block') + '؟'))) return;
        await SB.db.from('blocks').insert({ blocker_id: Auth.uid(), blocked_id: status.other_id }); this.open(convId, container);
      } }, t('chat.block'));

      const sendText = async raw => {
        const v = Sanitize.validateText(raw, { max: MAX(), min: 1 });
        if (!v.ok) return UI.toastKey(v.error, 'error');
        presetSlot.replaceChildren();
        renderMsg({ sender_id: Auth.uid(), content: v.value, created_at: new Date().toISOString() });
        const { error } = await SB.db.from('messages').insert({ conversation_id: convId, sender_id: Auth.uid(), content: v.value });
        if (error) UI.toastKey(UI.errKey(error), 'error');
      };
      const submit = async () => { const v = input.value; input.value = ''; await sendText(v); };
      // رسائل جاهزة للمشتري قبل أول رسالة
      if (conv && conv.buyer_id === Auth.uid() && !(data || []).length) {
        presetSlot.append(el('div', { class: 'presets' }, ['chat.preset_buy', 'chat.preset_available'].map(k => el('button', { type: 'button', onclick: () => sendText(t(k)) }, t(k)))));
      }
      send.addEventListener('click', submit);
      input.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
      foot.append(el('div', { class: 'chat-input' }, [input, send, blockBtn]));
    },
    close() { clearInterval(Chat._pt); if (channel) { SB.db.removeChannel(channel); channel = null; } }
  };
  window.Chat = Chat;
})();
