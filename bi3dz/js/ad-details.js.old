/* ad-details.js — صفحة الإعلان بالتصميم الجديد: شريط علوي، معرض، سعر، بطاقات معلومات، ناشرة، تواصل، وصف، مشابهة، شريط شراء */
(function () {
  'use strict';
  async function openAdCache() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('souk-ads', 1);
    r.onupgradeneeded = e => e.target.result.createObjectStore('ads');
    r.onsuccess = e => res(e.target.result);
    r.onerror = rej;
  });
}
  const el = Utils.el, t = k => I18n.t(k), R = window.CONFIG.ROUTES;
  const $ = s => document.querySelector(s);
  const ONLINE_MS = 5 * 60 * 1000;
  const NS = 'http://www.w3.org/2000/svg';

  // روابط خارجية: https فقط
  function safeLink(u) { try { const x = new URL(u); return x.protocol === 'https:' ? x.toString() : null; } catch { return null; } }
  // أيقونات SVG ثابتة (نصوص مكتوبة في الكود فقط، لا مدخلات مستخدم)
  const svg = (inner, attrs = {}) => { const s = document.createElementNS(NS, 'svg'); s.setAttribute('viewBox', '0 0 24 24'); Object.entries(attrs).forEach(([k, v]) => s.setAttribute(k, v)); s.innerHTML = inner; return s; };
  const lineIcon = inner => svg(inner, { fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });

  const ICON = {
    back: '<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>',
    heart: '<path d="M12 21s-6.7-4.35-9.33-8.02C.86 10.6 1.2 7.3 3.6 5.4 5.8 3.66 8.9 4.1 10.6 6.1L12 7.7l1.4-1.6c1.7-2 4.8-2.44 7-.7 2.4 1.9 2.74 5.2 0.93 7.58C18.7 16.65 12 21 12 21z"/>',
    share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>',
    compare: '<path d="M7 4v14M3 14l4 4 4-4M17 20V6M13 10l4-4 4 4"/>',
    speaker: '<path d="M11 5L6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>',
    video: '<polygon points="7 4 20 12 7 20" fill="currentColor"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    pin: '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
    shirt: '<path d="M8 3L3 6l2 4 3-1v11h8V9l3 1 2-4-5-3a4 4 0 0 1-8 0z"/>',
    star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
    truck: '<rect x="1" y="6" width="13" height="10" rx="1"/><path d="M14 9h4l4 4v3h-8z"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>',
    chevron: '<polyline points="9 18 15 12 9 6"/>',
    chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/><path d="M8 11h8M8 14h5"/>',
    dots: '<circle cx="12" cy="5" r="1.8" fill="currentColor"/><circle cx="12" cy="12" r="1.8" fill="currentColor"/><circle cx="12" cy="19" r="1.8" fill="currentColor"/>'
  };

  // أيقونات التواصل: دوائر ملونة بشعارات مبسّطة
  const BRAND = {
    chat: ['var(--c-primary)', '<path d="M7 9h10M7 13h6" stroke="#fff" stroke-width="2" stroke-linecap="round"/>'],
    whatsapp: ['#25D366', '<path d="M8.5 7.5c-.6.6-.9 1.6-.3 2.9.9 1.9 2.6 3.4 4.4 4.1 1.1.4 1.9 0 2.4-.6l.3-.7-1.6-.8-.6.6c-.6-.2-1.8-1.1-2.1-1.9l.5-.6-.7-1.6-.8.2z" fill="#fff"/>'],
    phone: ['#4B5563', '<path d="M8.5 7.5l1.4 2.4-1 1c.7 1.4 1.7 2.4 3 3l1-1 2.4 1.4c-.3 1.2-1.3 1.7-2.4 1.5-3-.6-5.6-3.2-6.2-6.2-.2-1.1.3-2.1 1.8-2.1z" fill="#fff"/>'],
    facebook: ['#1877F2', '<path d="M13.5 18v-5h1.8l.3-2h-2.1V9.7c0-.6.2-1 1-1h1.1V7c-.2 0-.9-.1-1.6-.1-1.6 0-2.7 1-2.7 2.7V11H9.5v2h1.8v5z" fill="#fff"/>'],
    instagram: ['#E1306C', '<rect x="7" y="7" width="10" height="10" rx="3" fill="none" stroke="#fff" stroke-width="1.8"/><circle cx="12" cy="12" r="2.4" fill="none" stroke="#fff" stroke-width="1.8"/><circle cx="15" cy="9" r=".8" fill="#fff"/>'],
    tiktok: ['#111', '<path d="M13 7v7.2a2.2 2.2 0 1 1-2-2.2M13 7c.3 1.6 1.4 2.6 3 2.8" fill="none" stroke="#fff" stroke-width="1.9" stroke-linecap="round"/>'],
    telegram: ['#229ED9', '<path d="M17 8l-1.6 8.2c-.1.5-.5.7-.9.4l-2.5-1.8-1.2 1.2c-.1.1-.3.2-.5.2l.2-2.6 4.8-4.3c.2-.2 0-.3-.3-.1l-5.9 3.7-2.5-.8c-.5-.2-.5-.5.1-.7L16.1 7.1c.5-.2.9.1.9.9z" fill="#fff"/>'],
    maps: ['#EA4335', '<path d="M12 6.5a3.8 3.8 0 0 0-3.8 3.8c0 2.7 3.8 6.7 3.8 6.7s3.8-4 3.8-6.7A3.8 3.8 0 0 0 12 6.5z" fill="#fff"/><circle cx="12" cy="10.3" r="1.4" fill="#EA4335"/>']
  };
  function brandBtn(name, attrs, label) {
    const [bg, inner] = BRAND[name];
    const node = el(attrs.href ? 'a' : 'button', Object.assign({ class: 'icon-btn', title: label, 'aria-label': label, type: attrs.href ? null : 'button' }, attrs));
    node.append(svg('<circle cx="12" cy="12" r="11" fill="' + bg + '"/>' + inner));
    return node;
  }

  // أرقام الوصف بخط عريض
  function boldNumbers(text) {
    const f = document.createDocumentFragment();
    String(text || '').split(/(\d[\d\s.,]*\d|\d)/).forEach((p, i) => f.append(i % 2 ? el('strong', { text: p }) : document.createTextNode(p)));
    return f;
  }

  // الحقول الإضافية المخزّنة داخل attrs (حالة، بيع/كراء، سعر الكراء، ألوان، مقاسات)
  function extras(ad) {
    const a = ad.attrs || {};
    return {
      condition: a.condition || '', deal: a.deal || 'sale', rent: Number(a.rent_price) || 0,
      colors: Categories.decodeMulti(a.color), sizes: Categories.decodeMulti(a.size || a.shoe_size)
    };
  }

  function shareMenu(ad) {
    const url = location.origin + location.pathname.replace(/[^/]*$/, '') + R.AD + '?id=' + ad.id;
    const ov = el('div', { class: 'modal-overlay' }), box = el('div', { class: 'modal' });
    const copy = async () => {
      try { await navigator.clipboard.writeText(url); } catch { const i = el('input', { value: url }); document.body.append(i); i.select(); document.execCommand('copy'); i.remove(); }
      UI.toastKey('ad.link_copied', 'success'); ov.remove();
    };
    box.append(el('h3', { text: t('ad.share') }),
      el('button', { class: 'menu-opt', type: 'button', onclick: copy }, [t('ad.copy_link'), '🔗']));
    if (navigator.share) box.append(el('button', { class: 'menu-opt', type: 'button', onclick: () => { ov.remove(); navigator.share({ title: ad.title, text: ad.title, url }).catch(() => {}); } }, [t('ad.share_out'), '📤']));
    ov.append(box); ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); }); document.body.append(ov);
  }

  // بطاقة معلومة صغيرة: أيقونة + عنوان + قيمة
  function factCard(icon, label, valueNode, mod) {
    const ic = el('span', { class: 'fact-card__icon' }); ic.append(lineIcon(icon));
    return el('div', { class: 'fact-card' + (mod ? ' ' + mod : '') }, [ic, el('div', { class: 'fact-card__txt' }, [el('span', { class: 'fact-card__label', text: label }), el('div', { class: 'fact-card__val' }, [valueNode])])]);
  }

  App.pages['ad-details'] = async function () {
    await App.boot();
    const id = Utils.qs('id');
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return Utils.go(R.HOME);
    await Promise.all([Categories.load(), Geo.load()]);
    const info = $('#info');

    // ───────── Skeleton: مربع تحميل متحرك ريثما يُجلب الإعلان ─────────
    const galleryEl = $('#gallery');
    const skeletonGallery = el('div', { class: 'skeleton skeleton--gallery', 'aria-hidden': 'true' });
    const skeletonInfo = el('div', { class: 'skeleton skeleton--info', 'aria-hidden': 'true' }, [
      el('div', { class: 'skeleton__line skeleton__line--title' }),
      el('div', { class: 'skeleton__line skeleton__line--sub' }),
      el('div', { class: 'skeleton__line skeleton__line--price' }),
    ]);
    if (galleryEl) galleryEl.append(skeletonGallery);
    if (info) info.append(skeletonInfo);

    let ad;
    try {
      ad = await Ads.get(id);
      if (ad) { try { const db = await openAdCache(); await db.put('ads', ad, id); } catch {} }
} catch (e) {
  console.warn('[AdDetails] network fail, trying cache', e);
  try { const db = await openAdCache(); ad = await db.get('ads', id); } catch {}
}

    // إزالة skeleton بعد التحميل
    skeletonGallery.remove();
    skeletonInfo.remove();

    if (!ad || ad.status === 'deleted') return UI.emptyState($('#gallery'), 'ad.unavailable', 'empty.sub');
    document.title = ad.title + ' — souk nsa';
    // المشاهدة تُحتسب هنا (فتح صفحة الإعلان فعلًا) وتظهر فورًا في العدّاد
    if (Tracking.view(ad)) ad.click_count = (ad.click_count || 0) + 1;

    const [imgs, hist, sellerRes] = await Promise.all([
      Ads.images(id), Ads.priceHistory(id),
      SB.db.from('seller_public').select('*').eq('id', ad.user_id).maybeSingle()
    ]);
    const seller = sellerRes.data || {};
    const mine = Auth.uid() === ad.user_id, sold = ad.status === 'sold', paused = ad.status === 'paused';
    const x = extras(ad);
    const svc = Categories.isService(ad.category_id);
    const video = ad.video_url && safeLink(ad.video_url);

    // ───────── المعرض + طبقات فوق الصورة (فيديو، مشاهدات، إعجابات) ─────────
    Gallery.mount($('#gallery'), imgs);

    // ───────── انتقال تلقائي بين الصور (يبدأ فوراً، يتوقف عند ضغط thumbnail) ─────────
    (function startPhotoAutoScroll() {
      if (!imgs || imgs.length < 2) return;
      const thumbsEl = document.querySelector('#gallery .gallery__thumbs');
      const mainImg  = document.querySelector('#gallery .gallery__main');
      const navNext  = document.querySelector('#gallery .gallery__nav--next');
      if (!navNext) return; // Gallery لم يرسم بعد أو صورة واحدة فقط

      let scrollTimer = null;
      const INTERVAL = 3000; // 3 ثوانٍ بين كل صورة

      function advance() { navNext.click(); }
      function startScroll() { if (scrollTimer) return; scrollTimer = setInterval(advance, INTERVAL); }
      function stopScroll() { clearInterval(scrollTimer); scrollTimer = null; }

      // يبدأ التلقائي فوراً
      startScroll();

      // يتوقف نهائياً عند ضغط أي thumbnail
      if (thumbsEl) {
        thumbsEl.addEventListener('click', e => {
          if (e.target.tagName === 'IMG') stopScroll();
        }, { once: false });
      }

      // يتوقف عند ضغط الصورة الرئيسية (lightbox) أو أزرار التنقل اليدوية
      if (mainImg) mainImg.addEventListener('click', stopScroll, { once: true });

      // تنظيف عند مغادرة الصفحة
      window.addEventListener('pagehide', stopScroll, { once: true });
    })();

    const g = $('#gallery .gallery');
    if (g) {
      // أيقونة الفيديو: تظهر فقط إذا يوجد فيديو (بدون نص)
      const views = el('span', { class: 'ov-pill ov-pill--views' }); views.append(lineIcon(ICON.eye), el('span', { text: String(ad.click_count || 0) }));
      const likesPill = el('span', { class: 'ov-pill ov-pill--likes', 'data-likes': ad.id, text: '♥ ' + (ad.likes_count || 0) });
      if (video) {
        const vid = el('button', { class: 'ov-pill ov-pill--video', type: 'button', title: t('ad.video'), 'aria-label': t('ad.video'), onclick: () => window.open(video, '_blank', 'noopener') });
        vid.append(svg(ICON.video, { fill: 'currentColor' }));
        g.append(vid);
      }
      g.append(views, likesPill);
    }

    // ───────── شريط الأزرار العلوي: مفضلة، مقارنة، مشاركة، قراءة صوتية، إبلاغ ─────────
    const topbar = $('#ad-topbar');
    const like = el('button', { class: 'icon-action', type: 'button', title: t('ad.likes'), 'aria-label': t('ad.likes'), 'data-like': ad.id });
    like.append(lineIcon(ICON.heart));
    like.addEventListener('click', () => {
      if (mine) { UI.toastKey('ad.cannot_like_own', 'info'); return; }
      Likes.toggle(ad, like);
    });
    like.disabled = sold;

    const cmpAd = Object.assign({}, ad, { thumb_path: imgs[0] && (imgs[0].path_thumb || imgs[0].path_medium), is_verified: !!seller.is_verified, rating_count: ad.rating_count || 0 });
    const cmpBtn = el('button', { class: 'icon-action', type: 'button', title: t('compare.title'), 'aria-label': t('compare.title'), onclick: () => Compare.open(cmpAd) });
    cmpBtn.append(lineIcon(ICON.compare));

    const shareBtn = el('button', { class: 'icon-action', type: 'button', title: t('ad.share'), 'aria-label': t('ad.share'), onclick: () => shareMenu(ad) });
    shareBtn.append(lineIcon(ICON.share));

    // قراءة مواصفات الإعلان بصوت عالٍ
    const readBtn = el('button', { class: 'icon-action', type: 'button', title: t('voice.read'), 'aria-label': t('voice.read') });
    readBtn.append(lineIcon(ICON.speaker));
    readBtn.addEventListener('click', () => {
      const attrsTxt = Object.entries(ad.attrs || {}).filter(([k]) => !['condition', 'deal', 'rent_price'].includes(k)).map(([k, v]) => Categories.keyLabel(k) + ' ' + (Categories.isMulti(k) ? Categories.decodeMulti(v).join(' ') : v)).join('. ');
      const place = [ad.wilaya_id && Geo.label(Geo.wilaya(ad.wilaya_id)), ad.commune_id && Geo.label(Geo.commune(ad.commune_id))].filter(Boolean).join(' ');
      const on = Voice.speak([ad.title, Price.display(ad).text, place, x.condition ? t('ad.used') + ' ' + x.condition : '', attrsTxt, ad.description].filter(Boolean).join('. '));
      readBtn.classList.toggle('is-rec', !!on);
    });
    window.addEventListener('pagehide', () => Voice.stopSpeak());

    const actions = el('div', { class: 'ad-topbar__actions' }, [like, cmpBtn, shareBtn, readBtn]);
    if (!mine) {
      const kb = el('button', { class: 'icon-action kebab-inline', type: 'button', title: t('report.title'), 'aria-label': t('report.title'), onclick: () => Reports.openMenu(ad.id, ad.user_id) });
      kb.append(svg(ICON.dots, { fill: 'currentColor' }));
      actions.append(kb);
    }
    topbar.replaceChildren(actions);   // الرجوع والعنوان تضيفهما ترويسة الصفحة العامة (.page-header) من app.js

    // ───────── العنوان + الشارات + السعر + الموقع ─────────
    const p = Price.display(ad);
    const loc = [ad.wilaya_id && Geo.wlabel(Geo.wilaya(ad.wilaya_id)), ad.daira_id && Geo.label(Geo.daira(ad.daira_id)), ad.commune_id && Geo.label(Geo.commune(ad.commune_id))].filter(Boolean).join('، ');
    const badges = el('div', { class: 'ad-badges' }, [
      x.condition ? el('span', { class: 'badge badge--used', text: t('ad.used') + ' ' + x.condition }) : null,
      x.deal === 'rent' ? el('span', { class: 'badge badge--nego', text: t('ad.deal_rent_only') }) : null,
      x.deal === 'both' ? el('span', { class: 'badge badge--nego', text: t('ad.deal_both') }) : null,
      ad.is_edited ? el('span', { class: 'badge badge--edited', text: t('ad.edited') }) : null,
      sold ? el('span', { class: 'badge badge--sale', text: t('ad.sold') }) : null
    ].filter(Boolean));
    const priceEl = el('div', { class: 'detail-price' }, [
      p.old ? el('span', { class: 'old-price', text: p.oldText }) : null, p.text,
      p.pct > 0 ? el('span', { class: 'pct', text: ' -' + p.pct + '%' }) : null,
      el('div', { class: 'price-santim', text: p.santim })
    ]);
    const nego = el('div', { class: 'nego-detail' + (ad.negotiable ? '' : ' fixed'), text: ad.negotiable ? t('ad.negotiable') : t('ad.fixed_price') });
    const rentLine = x.deal === 'both' && x.rent ? el('div', { class: 'rent-price', text: t('ad.rent_price') + ': ' + Utils.formatPrice(x.rent) }) : null;
    const locLine = loc ? el('div', { class: 'ad-loc' }, [lineIcon(ICON.pin), el('span', { text: loc })]) : null;

    info.replaceChildren(...[
      el('h2', { class: 'detail-title', text: ad.title }),
      badges.children.length ? badges : null,
      priceEl, nego, rentLine, locLine
    ].filter(Boolean));

    // ───────── بطاقات المعلومات السريعة: المقاس / الحالة / التوصيل (أو التنقل للخدمات) ─────────
    const prices = seller.delivery_prices || null;
    let deliveryNode;
    if (svc) deliveryNode = (ad.attrs && ad.attrs.mobility) ? el('span', { class: 'delivery-available', text: ad.attrs.mobility }) : null;
    else if (ad.delivery && Delivery.isFree(prices)) deliveryNode = el('span', { class: 'delivery-available', text: t('delivery.free') });
    else if (ad.delivery && Delivery.has(prices)) deliveryNode = el('button', { class: 'delivery-btn', type: 'button', onclick: () => Delivery.openInfo(prices) }, t('delivery.info'));
    else deliveryNode = el('span', { class: ad.delivery ? 'delivery-available' : 'delivery-unavailable', text: ad.delivery ? t('ad.available') : t('ad.unavailable_short') });

    const facts = $('#ad-facts');
    const cards = [];
    if (x.sizes.length) cards.push(factCard(ICON.shirt, Categories.keyLabel(ad.attrs && ad.attrs.size ? 'size' : 'shoe_size'), document.createTextNode(x.sizes.join(' / '))));
    cards.push(factCard(ICON.star, t('ad.condition'), document.createTextNode(x.condition ? t('ad.used') + ' ' + x.condition : t('compare.new'))));
    if (deliveryNode) cards.push(factCard(ICON.truck, svc ? Categories.keyLabel('mobility') : t('ad.delivery'), deliveryNode));
    // بقية السمات (ألوان…) كشارات
    const HIDE = ['condition', 'deal', 'rent_price', 'size', 'shoe_size'];
    const COLOR_HEX = window.CONFIG.COLOR_HEX || {};
    const attrChips = Object.entries(ad.attrs || {}).filter(([k]) => !HIDE.includes(k) && !(svc && k === 'mobility')).map(([k, v]) => {
      const vals = Categories.isMulti(k) ? Categories.decodeMulti(v) : [v];
      if (k === 'color') {
        // عرض الألوان بصرياً كدوائر ملوّنة
        const wrap = el('span', { class: 'attr-chip attr-chip--colors' });
        wrap.append(document.createTextNode(Categories.keyLabel(k) + ': '));
        vals.forEach(colorVal => {
          const hex = COLOR_HEX[colorVal] || colorVal;
          const dot = el('span', { class: 'color-dot', title: colorVal, style: `background:${hex};display:inline-block;width:16px;height:16px;border-radius:50%;margin-inline:2px;border:1px solid rgba(0,0,0,.2);vertical-align:middle` });
          wrap.append(dot);
        });
        return wrap;
      }
      const val = vals.join(' / ');
      return el('span', { class: 'attr-chip', text: Categories.keyLabel(k) + ': ' + val });
    });
    facts.replaceChildren(el('div', { class: 'fact-grid' }, cards), ...(attrChips.length ? [el('div', { class: 'detail-attrs' }, attrChips)] : []));
    facts.hidden = false;

    // ───────── بطاقة الناشرة (قابلة للضغط → صفحة حسابها) ─────────
    const online = seller.last_seen && (Date.now() - new Date(seller.last_seen).getTime() < ONLINE_MS);
    const rate = el('span', { class: 'seller-rate', text: '⭐ ' + Number(seller.rating_avg || ad.rating_avg || 0).toFixed(1) });
    const sellerHead = el('div', { class: 'seller-head', role: 'link', tabindex: 0 }, [
      el('div', { class: 'seller-avatar' }, [el('img', { src: Utils.imgUrl(seller.avatar_url || 'assets/images/avatar.svg', 'thumb'), alt: '' }), el('div', { class: 'mini-dot' + (online ? ' online' : '') })]),
      el('div', { class: 'seller-head__txt' }, [
        el('span', { class: 'seller-name' }, [seller.name || ad.user_name || '', seller.is_verified ? el('span', { class: 'verified-tick', text: ' ✓' }) : null]),
        el('div', { class: 'hint', text: online ? t('ad.online') : (seller.last_seen ? t('ad.last_seen') + ' ' + Utils.timeAgo(seller.last_seen) : '') })
      ]),
      rate
    ]);
    sellerHead.append(lineIcon(ICON.chevron));
    const goSeller = () => Utils.go(R.PROFILE, { u: ad.user_id });
    sellerHead.addEventListener('click', goSeller);
    sellerHead.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goSeller(); } });

    const stat = (n, label) => { const v = el('b', { text: String(n) }); return { v, node: el('div', { class: 'seller-stat' }, [v, el('span', { text: label })]) }; };
    const stFollowers = stat(0, t('profile.followers'));
    const stRating = stat(Number(seller.rating_avg || 0).toFixed(1), t('profile.rating'));
    const stCount = stat(seller.rating_count || 0, t('ad.rate_seller'));
    const sellerBox = $('#seller-card');
    sellerBox.replaceChildren(sellerHead, el('div', { class: 'seller-stats' }, [stFollowers.node, stRating.node, stCount.node]));
    sellerBox.hidden = false;
    // إحصائيات الناشرة تُحمَّل في الخلفية دون تعطيل الصفحة
    SB.db.rpc('profile_stats', { p_user: ad.user_id }).then(({ data }) => {
      const s = (data && data[0]) || {};
      stFollowers.v.textContent = String(s.followers || 0);
      if (s.rating_count != null) stCount.v.textContent = String(s.rating_count);
      if (s.rating_avg != null) stRating.v.textContent = Number(s.rating_avg).toFixed(1);
    }).catch(() => {});

    // ───────── أزرار التواصل ─────────
    const showPhone = ad.show_phone && seller.show_phone && seller.phone;
    const digits = showPhone ? seller.phone.replace(/\D/g, '') : '';
    const waUrl = showPhone ? 'https://wa.me/' + (digits.startsWith('0') ? '213' + digits.slice(1) : digits) : null;
    const links = [];
    if (showPhone) {
      links.push(brandBtn('whatsapp', { href: waUrl, target: '_blank', rel: 'noopener noreferrer' }, 'WhatsApp'));
      links.push(brandBtn('phone', { href: 'tel:' + seller.phone.replace(/[^\d+]/g, '') }, t('ad.phone')));
    }
    [['facebook', 'Facebook'], ['instagram', 'Instagram'], ['tiktok', 'TikTok'], ['telegram', 'Telegram'], ['maps_url', 'Maps']].forEach(([k, n]) => {
      const u = k === 'maps_url'
        ? (ad.lat && ad.lng ? 'https://www.google.com/maps?q=' + encodeURIComponent(ad.lat) + ',' + encodeURIComponent(ad.lng) : seller[k] && safeLink(seller[k]))
        : seller[k] && safeLink(seller[k]);
      if (u) links.push(brandBtn(k === 'maps_url' ? 'maps' : k, { href: u, target: '_blank', rel: 'noopener noreferrer' }, n));
    });
    const contactBox = $('#contact');
    const contactNodes = [];
    if (!mine && !sold && !paused) {
      const chatBtn = el('button', { class: 'btn-chat', type: 'button', onclick: () => Chat.start(ad.id, ad.user_id) });
      chatBtn.append(lineIcon(ICON.chat), el('span', { text: t('ad.chat') }));
      contactNodes.push(chatBtn);
    }
    if (links.length) contactNodes.push(el('div', { class: 'detail-contact-row' }, links));
    if (showPhone) contactNodes.push(el('div', { class: 'phones' }, [
      el('a', { href: 'tel:' + seller.phone.replace(/[^\d+]/g, ''), text: '📞 ' + seller.phone }),
      el('a', { href: waUrl, target: '_blank', rel: 'noopener noreferrer', text: '💬 WhatsApp ' + seller.phone })
    ]));
    if (contactNodes.length) { contactBox.replaceChildren(...contactNodes); contactBox.hidden = false; }

    // ───────── الوصف: أول سطور مع "عرض المزيد" + الأسعار السابقة + الأسئلة الشائعة ─────────
    const desc = el('p', { class: 'detail-desc is-clamped' }); desc.append(boldNumbers(ad.description));
    const more = el('button', { class: 'more-btn', type: 'button', text: t('ad.show_more') });
    more.addEventListener('click', () => { const open = desc.classList.toggle('is-clamped'); more.textContent = open ? t('ad.show_more') : t('ad.show_less'); });
    const oldPrices = hist.length ? el('div', { class: 'ad-sub' }, [el('b', { text: t('ad.old_prices') }), el('ul', { class: 'price-hist' }, hist.map(h => el('li', { text: Utils.formatPrice(h.old_price) + ' → ' + Utils.formatPrice(h.new_price) + ' · ' + Utils.formatDate(h.changed_at) })))]) : null;
    const faq = (ad.faq || []).length ? el('div', { class: 'ad-sub' }, [el('h3', { text: t('ad.faq') }), ...ad.faq.map(q => el('div', { class: 'faq-item' }, [el('b', { text: q.q }), el('span', { text: q.a })]))]) : null;
    $('#ad-desc-body').replaceChildren(...[
      desc, more, oldPrices, faq,
      el('div', { class: 'hint', text: Categories.path(ad.category_id, ad.subcategory_id) }),
      el('div', { class: 'hint', text: t('ad.published_on') + ' ' + Utils.formatDate(ad.created_at) })
    ].filter(Boolean));
    $('#ad-desc').hidden = false;
    requestAnimationFrame(() => { if (desc.scrollHeight <= desc.clientHeight + 2) { more.hidden = true; desc.classList.remove('is-clamped'); } });
    Likes.load().then(() => Likes.paint(document));

    // ───────── شريط سفلي ثابت: رجوع + طلب شراء (أو تعديل/إحصائيات لصاحبة الإعلان) ─────────
    const foot = $('#detail-footer');
    const back = el('button', { class: 'btn-back-small', type: 'button', title: t('common.back'), 'aria-label': t('common.back'), onclick: () => Router.back() });
    back.append(svg(ICON.back, { fill: 'none', stroke: 'currentColor' }));
    const row = el('div', { class: 'buy-row' }, [back]);
    if (mine) row.append(el('a', { class: 'btn-buy-full', href: R.POST + '?id=' + encodeURIComponent(ad.id), text: t('ad.edit') }), el('a', { class: 'btn-buy-full ghost', href: R.STATS + '?id=' + encodeURIComponent(ad.id), text: t('ad.stats') }));
    else if (!sold && !paused) {
      const order = el('button', { class: 'btn-buy-full', type: 'button', text: '🛒 ' + t('ad.order') });
      order.addEventListener('click', async () => {
        await Auth.ready(); if (!Auth.isLogged()) return Router.toLogin();
        order.disabled = true; order.classList.add('is-busy');      // تفاعل فوري عند الضغط
        const { data, error } = await SB.db.rpc('get_or_create_conversation', { p_ad: ad.id });
        if (error) { order.disabled = false; order.classList.remove('is-busy'); return UI.toastKey(UI.errKey(error), 'error'); }
        await SB.db.from('messages').insert({ conversation_id: data, sender_id: Auth.uid(), content: t('ad.order_msg') });
        Utils.go(R.CHAT, { c: data });
      });
      row.append(order);
    }
    foot.append(row); foot.hidden = false;

    // ───────── التقييمات ─────────
    if (!sold) {
      Ratings.mount($('#ratings-ad'), { type: 'ad', id: ad.id, ownerId: ad.user_id });
      Ratings.mount($('#ratings-user'), { type: 'user', id: ad.user_id, ownerId: ad.user_id });
    }

    // ───────── إعلانات مشابهة (نفس الصنف الفرعي أولًا ثم الصنف) — شريط أفقي ─────────
    try {
      let list = (await Ads.list({ category_id: ad.category_id, subcategory_id: ad.subcategory_id }, 0)).items.filter(a => a.id !== ad.id);
      if (list.length < 6) {
        const extra = (await Ads.list({ category_id: ad.category_id }, 0)).items.filter(a => a.id !== ad.id && !list.some(b => b.id === a.id));
        list = list.concat(extra);
      }
      list = list.slice(0, 8);
      if (list.length) {
        const box = $('#similar');
        box.append(el('h3', { text: t('ad.similar') }), el('div', { class: 'similar-grid similar-scroll' }, list.map(sa => {
          const im = el('img', { src: Utils.imgUrl(sa.thumb_path, 'thumb'), alt: sa.title, loading: 'lazy' });
          im.addEventListener('error', () => { im.src = 'assets/images/placeholder.svg'; }, { once: true });
          const c = el('div', { class: 'similar-card', role: 'link', tabindex: 0 }, [el('div', { class: 'similar-img' }, [im, el('span', { class: 'similar-pricepill', text: Price.display(sa).text })]), el('h4', { text: sa.title })]);
          const open = () => Utils.go(R.AD, { id: sa.id });
          c.addEventListener('click', open);
          c.addEventListener('keydown', e => { if (e.key === 'Enter') open(); });
          return c;
        })));
        box.hidden = false;
      }
    } catch (e) { console.warn('[AdDetails] similar', e); }
    console.log('[AdDetails] ready', id);
  };
})();
