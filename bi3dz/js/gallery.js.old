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
      // التكبير عند الطلب فقط (النسخة الكبيرة)
      main.addEventListener('click', () => {
        const big = el('img', { src: src(i, 'path_large'), alt: '', style: 'max-width:100%;max-height:90vh;border-radius:12px' });
        const ov = el('div', { class: 'modal-overlay', onclick: () => ov.remove() }, big); document.body.append(ov);
      });
      container.append(wrap); if (list.length > 1) container.append(thumbs);
      show(0);
    }
  };
  window.Gallery = Gallery;
})();
