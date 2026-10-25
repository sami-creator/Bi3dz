/* app.js — الهيكل المشترك (ترويسة/شريط سفلي/زر عائم) + متحكمات الصفحات: الرئيسية، المفضلة، الإشعارات، الدردشة، الإعدادات */
(function () {
  'use strict';
  const el = Utils.el, t = k => I18n.t(k), R = window.CONFIG.ROUTES;
  const $ = s => document.querySelector(s);
  const NS = 'http://www.w3.org/2000/svg';

  const ICONS = {
    home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
    heart: '<path d="M12 21s-6.7-4.35-9.33-8.02C.86 10.6 1.2 7.3 3.6 5.4 5.8 3.66 8.9 4.1 10.6 6.1L12 7.7l1.4-1.6c1.7-2 4.8-2.44 7-.7 2.4 1.9 2.74 5.2 0.93 7.58C18.7 16.65 12 21 12 21z"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>'
  };
  const icon = k => { const s = document.createElementNS(NS, 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '2'); s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round'); s.innerHTML = ICONS[k]; return s; };
  const TITLES = { 'ad-details': 'ad.details', profile: 'nav.account', auth: 'nav.account', complete: 'nav.account' };

  const App = {
    async boot({ guard = false, complete = true } = {}) {
      Theme.init();
      await I18n.init();
      SB.init();
      this.mountChrome();
      Router.bindNav();
      const st = guard ? await Router.guard({ complete }) : await Auth.ready();
      if (!st) return null;
      this.paintAccount(st);
      // بعد تسجيل الدخول: العودة تلقائيًا للصفحة التي كان المستخدم ينوي زيارتها
      if (Router.resumeAfterLogin(st)) return null;
      if (Auth.isLogged()) {
        Likes.load().then(() => Likes.paint());
        Notifications.init(); Fingerprint.register(); Auth.updateLastSeen(); this.heartbeat();
      }
      Tracking.init();
      Banners.mount($('#banner-slot'));
      document.addEventListener('langchange', () => I18n.apply());
      document.body.classList.remove('is-gated');
      return st;
    },

    // نبضة حضور: تحديث "آخر ظهور" كل دقيقتين ما دامت الصفحة مرئية (لتظهر حالة "متصل" بدقة في المحادثة)
    heartbeat() {
      if (this._hb) return; this._hb = true;
      setInterval(() => { if (!document.hidden) Auth.updateLastSeen(); }, 120000);
      document.addEventListener('visibilitychange', () => { if (!document.hidden) Auth.updateLastSeen(); });
    },

    mountChrome() {
      const page = document.body.dataset.page;
      // الصفحات الداخلية: بانر (إن وُجد) ثم ترويسة بزر رجوع + عنوان بنفس تصميم prototype
      if (page !== 'home' && !$('.page-header')) {
        if (!$('#banner-slot')) document.body.prepend(el('div', { class: 'banner-slot banner-top', id: 'banner-slot', hidden: true }));
        const h1 = document.querySelector('main h1.page-title');
        const title = h1 || el('h1', { class: 'page-title', 'data-i18n': TITLES[page] || 'app.name' });
        const back = el('button', { class: 'back', type: 'button', 'aria-label': t('common.back'), text: '‹' });
        back.addEventListener('click', () => Router.back());
        const header = el('header', { class: 'page-header' }, [back, title]);
        const slot = $('#banner-slot');
        slot.after(header);
      }

      if (!$('.bottom-bar')) {
        const bar = el('nav', { class: 'bottom-bar', id: 'bottomBar', 'aria-label': 'main' });
        const item = (route, key, ic, badge) => {
          const a = el('a', { class: 'nav-item', href: route, 'data-route': route, 'aria-label': t(key) }, [badge ? el('span', { class: 'dot-badge', 'data-notif-badge': '', hidden: true }) : null]);
          a.prepend(icon(ic)); return a;
        };
        // RTL: الرئيسية أقصى اليمين ← المفضلة ← (زر +) ← الإشعارات ← حسابي أقصى اليسار
        const account = el('button', { class: 'nav-item', id: 'btn-account', type: 'button', 'aria-label': t('nav.account') }, [
          el('div', { class: 'nav-profile' }, [el('img', { alt: '', src: 'assets/images/avatar.svg' }), el('div', { class: 'nav-dot off' })])
        ]);
        if (page === 'profile') account.classList.add('active');
        account.addEventListener('click', () => Utils.go(Auth.isLogged() ? R.PROFILE : R.AUTH));
        bar.append(item(R.HOME, 'nav.home', 'home'), item(R.FAVS, 'nav.favs', 'heart'), el('div', { class: 'fab-spacer' }), item(R.NOTIFS, 'nav.notifs', 'bell', true), account);
        const fab = el('a', { class: 'fab', id: 'fab', href: R.POST, 'aria-label': t('nav.add') });
        fab.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
        fab.addEventListener('click', e => { e.preventDefault(); Utils.go(R.POST); });
        const top = el('button', { class: 'to-top', id: 'toTop', type: 'button', 'aria-label': 'top' });
        top.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>';
        top.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
        document.body.append(bar, fab, top);
        this.bindScroll(bar, fab, top); this.syncNotch(bar);
      }
      I18n.apply();
    },

    // الأشرطة العلوية والسفلية: تختفي فورًا عند النزول وتعود فورًا عند الصعود (حد 4px تراكمي لتفادي الارتجاج)
    bindScroll(bar, fab, top) {
      const head = document.querySelector('.top-bar, .page-header');
      let last = Math.max(0, window.scrollY), acc = 0, hidden = false;
      const set = h => {
        if (h === hidden) return; hidden = h;
        bar.classList.toggle('hidden', h); fab.classList.toggle('hidden', h);
        if (head) head.classList.toggle('is-hidden', h);
        if (h) { const sg = document.getElementById('suggest'); if (sg) sg.hidden = true; }
      };
      window.addEventListener('scroll', () => {
        const y = Math.max(0, window.scrollY), d = y - last; last = y;
        top.classList.toggle('show', y > 700);
        if (!d) return;
        if ((d > 0) !== (acc > 0)) acc = 0;
        acc += d;
        // لا نُخفي الشريط العلوي أثناء الكتابة في خانة البحث
        const typing = head && document.activeElement && document.activeElement.tagName === 'INPUT' && head.contains(document.activeElement);
        if (y <= 8) set(false);
        else if (acc > 4 && !typing) set(true);
        else if (acc < -4) set(false);
      }, { passive: true });
    },

    // الحفرة المنحنية خلف الزر العائم (مطابقة لـ prototype)
    syncNotch(bar) {
      const draw = () => {
        const w = bar.offsetWidth, h = bar.offsetHeight; if (!w) return;
        const m = w / 2, hs = 28, dp = 14, x1 = m - hs, x2 = m + hs;
        const path = `M0,0 L${x1},0 C${m - hs * .55},0 ${m - hs * .65},${dp} ${m},${dp} C${m + hs * .65},${dp} ${m + hs * .55},0 ${x2},0 L${w},0 L${w},${h} L0,${h} Z`;
        bar.style.clipPath = bar.style.webkitClipPath = `path('${path}')`;
      };
      new ResizeObserver(draw).observe(bar); draw();
    },

    paintAccount(st) {
      const img = $('#btn-account img'), dot = $('#btn-account .nav-dot');
      if (dot) dot.classList.toggle('off', !Auth.isLogged());
      if (img && st.profile && st.profile.avatar_url) { img.src = Utils.imgUrl(st.profile.avatar_url, 'avatar'); img.addEventListener('error', () => { img.src = 'assets/images/avatar.svg'; }, { once: true }); }
    },

    pages: {}
  };

  /* ===== الصفحة الرئيسية ===== */
  App.pages.home = async function () {
    await App.boot();
    const grid = $('#grid'), tags = $('#active-tags'), chips = $('#chips'), subWrap = $('#sub-wrap'), sub = $('#sub-chips');
    let page = 0, loading = false, done = false, token = 0;
    // نبدأ جلب الإعلانات فورًا بالتوازي مع تحميل الأصناف والولايات (بدل الانتظار حتى تنتهي)
    grid.replaceChildren(UI.skeletonCards(6));
    let prefetch = { key: JSON.stringify(Filters.get()), promise: Ads.feed(Filters.get(), 0) };
    prefetch.promise.catch(() => { /* يُعالَج الخطأ داخل load() */ });
    await Promise.all([Categories.load(), Geo.load()]);
    // آخر صنف/صنف فرعي مفعّل (محفوظ) يظهر مفتوحًا عند الدخول
    let subOpen = Filters.get().subcategory_id ? Filters.get().category_id : null;

    Search.mount({ input: $('#q'), suggest: $('#suggest'), didYouMean: $('#dym'), button: $('#btn-search'), voiceButton: $('#btn-voice'), placeholder: $('#ph'), onSubmit: f => Filters.set(f) });
    const actions = $('#search-actions');
    // تفاعل فوري عند الضغط على بحث: هياكل تحميل وصعود لأعلى القائمة
    document.addEventListener('searchstart', () => { grid.replaceChildren(UI.skeletonCards(6)); $('#dym').replaceChildren(); window.scrollTo({ top: 0 }); });
    $('#btn-filters').addEventListener('click', () => Filters.openPanel());
    const paintFilterBtn = () => $('#btn-filters').classList.toggle('has-filters', Filters.hasActive());

    const closeSub = () => { subOpen = null; subWrap.hidden = true; };
    const chip = (label, active, onClick, arrow, rotated) => {
      const b = el('button', { class: 'chip' + (active ? ' active' : ''), type: 'button' }, [label, arrow ? el('span', { class: 'arrow' + (rotated ? ' rotated' : ''), text: '▼' }) : null]);
      b.addEventListener('click', e => { e.stopPropagation(); onClick(); }); return b;
    };
    function paintChips() {
      const s = Filters.get(); chips.replaceChildren();
      chips.append(chip(t('common.all'), !s.category_id, () => { closeSub(); Filters.set({ category_id: '', subcategory_id: '', attrs: {} }); }));
      Categories.all().forEach(c => chips.append(chip(Categories.label(c), s.category_id === c.id, () => {
        if (subOpen === c.id) { closeSub(); return paintChips(); }
        subOpen = c.id; Filters.set({ category_id: c.id, subcategory_id: '', attrs: {} });
      }, true, subOpen === c.id)));
      sub.replaceChildren();
      const m = Categories.main(subOpen);
      if (m) {
        sub.append(chip(t('common.all'), s.category_id === m.id && !s.subcategory_id, () => { Filters.set({ category_id: m.id, subcategory_id: '', attrs: {} }); }));
        m.sub.forEach(x => sub.append(chip(Categories.label(x), s.subcategory_id === x.id, () => { Filters.set({ category_id: m.id, subcategory_id: x.id, attrs: {} }); })));
        subWrap.hidden = false;
      } else subWrap.hidden = true;
    }
    // أي ضغطة خارج الأزرار تُخفي قائمة الأصناف الفرعية
    document.addEventListener('click', e => { if (subOpen && !e.target.closest('#chips-wrap') && !e.target.closest('#sub-wrap')) { closeSub(); paintChips(); } });

    // عند عدم وجود نتائج: رسالة مفيدة + نصائح + اقتراح نتائج قريبة (ولاية أخرى/بدون حد السعر/...)
    async function renderEmpty(f) {
      const my = token;
      grid.replaceChildren();
      const box = el('div', { class: 'empty empty--rich' });
      const btns = el('div', { class: 'empty-actions' });
      if (Filters.hasActive()) btns.append(el('button', { class: 'btn btn--ghost', type: 'button', onclick: () => Filters.set({ category_id: '', subcategory_id: '', wilaya_ids: [], daira_ids: [], commune_ids: [], min_price: null, max_price: null, delivery: false, verified_only: false, condition: '', attrs: {} }) }, t('empty.remove_filters')));
      if (f.min_price || f.max_price) btns.append(el('button', { class: 'btn btn--ghost', type: 'button', onclick: () => Filters.set({ min_price: f.min_price ? Math.round(f.min_price * 0.7) : null, max_price: f.max_price ? Math.round(f.max_price * 1.3) : null }) }, t('empty.widen_price')));
      if (f.q || f.qraw) btns.append(el('button', { class: 'btn btn--primary', type: 'button', onclick: e => Alerts.fromSearch(Filters.get(), e.currentTarget) }, '🔔 ' + t('alert.from_search')));
      const sug = el('div', { class: 'empty-sug' });
      box.append(UI.emptyIcon(), el('h3', { text: t('empty.no_match') }), el('p', { text: t('empty.try') }),
        el('ul', { class: 'empty-tips' }, ['empty.tip_price', 'empty.tip_filters', 'empty.tip_words'].map(k => el('li', { text: t(k) }))), sug, btns);
      grid.append(box);
      let fb = null;
      try { fb = await Ads.fallback(f); } catch (e) { console.warn('[Home] fallback', e); }
      if (!fb || my !== token) return;
      const where = f.commune_ids && f.commune_ids[0] ? Geo.label(Geo.commune(f.commune_ids[0])) : (f.wilaya_ids && f.wilaya_ids[0] ? Geo.label(Geo.wilaya(f.wilaya_ids[0])) : '');
      const msg = fb.type === 'wilaya'
        ? t('empty.near_wilaya').replace('{from}', where).replace('{n}', fb.count).replace('{to}', Geo.label(Geo.wilaya(fb.wilaya_id)))
        : t('empty.near_' + fb.type).replace('{n}', fb.count);
      sug.append(el('div', { class: 'empty-sug__msg', text: msg }), el('button', { class: 'btn btn--primary', type: 'button', onclick: () => Filters.set(fb.patch) }, t('empty.show')));
    }

    function paintSearchActions() {
      actions.replaceChildren();
      const f = Filters.get();
      if (!(f.q || f.qraw)) return;
      actions.append(el('button', { class: 'chip chip--alert', type: 'button', onclick: e => Alerts.fromSearch(Filters.get(), e.currentTarget) }, '🔔 ' + t('alert.from_search')));
    }

    async function load(reset) {
      if (loading && !reset) return;
      if (reset) { page = 0; done = false; token++; }
      loading = true; const my = token, f = Filters.get();
      // استخدام نتيجة الجلب المبكر مرة واحدة فقط وإن بقيت الفلاتر كما هي
      const pf = prefetch; prefetch = null;
      const cacheable = !Filters.isDefault() && f.sort !== 'near';
      const ckey = JSON.stringify(Object.assign({}, f, { coords: undefined }));
      let cachedSig = null;
      if (reset) {
        // كاش البحث: نعرض آخر نتائج هذا البحث فورًا ثم نحدّثها بالنتائج الحديثة
        const cached = cacheable ? SearchState.resultsGet(ckey) : null;
        if (cached && cached.length) { grid.replaceChildren(); Cards.renderList(grid, cached, { append: true }); Likes.paint(grid); cachedSig = cached.map(a => a.id).join(','); }
        else if (!pf) grid.replaceChildren(UI.skeletonCards(6));
        paintSearchActions();
      }
      try {
        const res = (page === 0 && pf && pf.key === JSON.stringify(f)) ? await pf.promise : await Ads.feed(f, page);
        if (my !== token) return;
        const sig = res.items.map(a => a.id).join(',');
        if (!(reset && cachedSig !== null && cachedSig === sig)) {
          if (reset) grid.replaceChildren();
          Cards.renderList(grid, res.items, { append: true }); Likes.paint(grid);
        }
        if (page === 0 && Filters.isDefault() && res.items.length) OfflineCache.saveFeed(res.items);
        if (page === 0 && cacheable && res.items.length) SearchState.resultsSet(ckey, res.items);
        if (reset && !res.items.length) renderEmpty(f);
        done = !res.hasMore; page++;
      } catch (e) {
        console.error('[Home] load', e);
        if (reset && cachedSig === null) {
          grid.replaceChildren(); const c = OfflineCache.loadFeed();
          if (c.length) { Cards.renderList(grid, c); UI.toastKey('err.network', 'error'); } else UI.emptyState(grid, 'err.network', 'common.retry');
        }
      } finally { loading = false; if (my === token) document.dispatchEvent(new CustomEvent('feeddone')); }
    }

    Filters.onChange(() => { paintChips(); paintFilterBtn(); Filters.renderTags(tags); load(true); });
    new IntersectionObserver(es => { if (es[0].isIntersecting && !done && !loading && grid.children.length) load(false); }, { rootMargin: '400px' }).observe($('#sentinel'));
    document.addEventListener('samepage', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    document.addEventListener('likechange', () => Likes.paint(grid));
    document.addEventListener('langchange', () => { paintChips(); Filters.renderTags(tags); });

    // حفظ حالة البحث وموضع التمرير عند الخروج من التطبيق/الصفحة؛ تُستعاد عند العودة (حتى من قسم آخر) خلال 30 دقيقة
    const saveScroll = () => SearchState.saveScroll(window.scrollY, page);
    window.addEventListener('pagehide', saveScroll);
    document.addEventListener('visibilitychange', () => { if (document.hidden) saveScroll(); });
    paintChips(); paintFilterBtn(); Filters.renderTags(tags);
    await load(true);
    try {
      const sv = SearchState.loadScroll(), nav = performance.getEntriesByType('navigation')[0];
      const back = !!(nav && nav.type === 'back_forward');
      if (sv && sv.y > 0 && (Filters.isSearching() || back)) {
        while (page < Math.min(sv.pages, 6) && !done) await load(false);
        window.scrollTo({ top: sv.y });
      }
      SearchState.clearScroll();
    } catch { /* ignore */ }
  };

  /* ===== المفضلة ===== */
  App.pages.favorites = async function () {
    if (!(await App.boot({ guard: true }))) return;
    const grid = $('#grid'); grid.replaceChildren(UI.skeletonCards(4));
    try {
      await Likes.load(); const items = await Likes.listMine(); grid.replaceChildren();
      if (!items.length) return UI.emptyState(grid);
      Cards.renderList(grid, items); Likes.paint(grid);
    } catch (e) { console.error('[Favs]', e); UI.emptyState(grid, 'err.generic', 'common.retry'); }
  };

  /* ===== الإشعارات + التنبيه المخصص ===== */
  App.pages.notifications = async function () {
    if (!(await App.boot({ guard: true }))) return;
    Notifications.requestPermission(); Notifications.render($('#list'));
    document.addEventListener('newnotif', () => Notifications.render($('#list')));
    const box = $('#alerts-root'); if (box) Alerts.render(box);
  };

  /* ===== الدردشة ===== */
  App.pages.chat = async function () {
    if (!(await App.boot({ guard: true }))) return;
    const c = Utils.qs('c'), root = $('#chat-root');
    if (c && /^[0-9a-f-]{36}$/i.test(c)) Chat.open(c, root); else Chat.list(root);
    window.addEventListener('pagehide', () => Chat.close());
  };

  /* ===== الإعدادات ===== */
  App.pages.settings = async function () {
    await App.boot(); Settings.render($('#settings-root'));
    document.addEventListener('langchange', () => Settings.render($('#settings-root')));
  };

  /* ===== صفحات ثابتة (خصوصية / 404) ===== */
  App.pages.static = async function () { await App.boot(); };

  window.App = App;
  document.addEventListener('DOMContentLoaded', () => {
    const p = document.body.dataset.page;
    if (p && App.pages[p]) App.pages[p]().catch(e => console.error('[App] page', p, e));
  });
})();
