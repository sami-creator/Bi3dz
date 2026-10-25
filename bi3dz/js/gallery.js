/* gallery.js — معرض الصور مع تحميل مسبق للصورة التالية (لا انتظار عند التمرير) */
(function () {
  'use strict';
  const el = Utils.el, t = k => I18n.t(k);
  const cache = new Set();
  function preload(src) { if (!src || cache.has(src)) return; cache.add(src); const i = new Image(); i.decoding = 'async'; i.src = src; }

  const Gallery = {
    mount(container, images) {
      container.replaceChildren();
      const list = images.length ? images : [{ path_medium: null, path_large: null, path_thumb: null }];
      let i = 0;
      const main = el('img', { class: 'gallery__main', alt: '' });
      main.addEventListener('error', () => { main.src = 'assets/images/placeholder.svg'; });
      const count = el('span', { class: 'gallery__count' });
      const thumbs = el('div', { class: 'gallery__thumbs' });
      const src = (n, k) => Utils.imgUrl(list[n][k] || list[n].path_medium, k === 'path_large' ? 'large' : 'medium');

      list.forEach((im, n) => {
        const th = el('img', { alt: '', loading: 'lazy', src: Utils.imgUrl(im.path_thumb, 'thumb') });
        th.addEventListener('click', () => show(n)); thumbs.append(th);
      });
      const show = n => {
        i = (n + list.length) % list.length;
        main.src = src(i, 'path_medium');
        count.textContent = (i + 1) + ' / ' + list.length;
        thumbs.querySelectorAll('img').forEach((x, k) => x.classList.toggle('active', k === i));
        // تحميل الصورة التالية فورًا في الخلفية
        preload(src((i + 1) % list.length, 'path_medium'));
        if (list.length > 2) preload(src((i + 2) % list.length, 'path_medium'));
      };
      const nav = (cls, txt, d) => el('button', { class: 'gallery__nav ' + cls, type: 'button', 'aria-label': txt, onclick: () => show(i + d) }, d > 0 ? '›' : '‹');
      const wrap = el('div', { class: 'gallery' }, [main, count]);
      if (list.length > 1) wrap.append(nav('gallery__nav--prev', t('common.back'), -1), nav('gallery__nav--next', t('common.next'), 1));

      // سحب باللمس
      let x0 = null;
      wrap.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
      wrap.addEventListener('touchend', e => {
        if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null;
        if (Math.abs(dx) > 40) show(i + ((dx < 0) === (document.dir !== 'rtl' && document.documentElement.dir !== 'rtl') ? 1 : -1));
      }, { passive: true });
      // الصورة الكاملة (النسخة الكبيرة) مع تنقل بالسحب والأسهم ولوحة المفاتيح
      const isRtl = () => document.dir === 'rtl' || document.documentElement.dir === 'rtl';
      const openLightbox = start => {
        let k = start;
        const big = el('img', { class: 'gallery-lb__img', alt: '', draggable: 'false' });
        big.addEventListener('error', () => { if (!big.dataset.fb) { big.dataset.fb = '1'; big.src = src(k, 'path_medium'); } });
        const lbCount = el('span', { class: 'gallery-lb__count' });
        const ov = el('div', { class: 'gallery-lb', role: 'dialog', 'aria-modal': 'true' }, [big]);
        const close = () => {
          document.removeEventListener('keydown', onKey);
          document.body.style.overflow = prevOverflow;
          ov.remove();
          show(k); // الإطار الصغير يتبع آخر صورة شوهدت
        };
        const go = n => {
          k = (n + list.length) % list.length;
          big.dataset.fb = '';
          big.src = src(k, 'path_large');
          lbCount.textContent = (k + 1) + ' / ' + list.length;
          if (list.length > 1) {
            preload(src((k + 1) % list.length, 'path_large'));
            preload(src((k - 1 + list.length) % list.length, 'path_large'));
          }
        };
        const onKey = e => {
          if (e.key === 'Escape') close();
          else if (e.key === 'ArrowRight') go(k + (isRtl() ? -1 : 1));
          else if (e.key === 'ArrowLeft') go(k + (isRtl() ? 1 : -1));
        };
        const btn = (cls, label, txt, fn) => el('button', { class: 'gallery-lb__btn ' + cls, type: 'button', 'aria-label': label, onclick: e => { e.stopPropagation(); fn(); } }, txt);
        ov.append(btn('gallery-lb__close', t('common.close') || 'close', '✕', close), lbCount);
        if (list.length > 1) ov.append(btn('gallery-lb__prev', t('common.back'), '‹', () => go(k - 1)), btn('gallery-lb__next', t('common.next'), '›', () => go(k + 1)));
        // النقر على الخلفية يغلق، والنقر على الصورة لا يغلق
        ov.addEventListener('click', e => { if (e.target === ov) close(); });
        // السحب يمين/يسار (نفس اتجاه الإطار الصغير)
        let sx = null, sy = null;
        ov.addEventListener('touchstart', e => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
        ov.addEventListener('touchend', e => {
          if (sx === null) return;
          const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy; sx = null;
          if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) go(k + ((dx < 0) === !isRtl() ? 1 : -1));
        }, { passive: true });
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        document.addEventListener('keydown', onKey);
        document.body.append(ov);
        go(start);
      };
      main.addEventListener('click', () => openLightbox(i));
      container.append(wrap); if (list.length > 1) container.append(thumbs);
      show(0);
    }
  };
  window.Gallery = Gallery;
})();
