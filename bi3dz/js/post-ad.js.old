/* post-ad.js — نشر/تعديل إعلان بـ4 خطوات مرقمة، الزر التالي يتلوّن عند اكتمال شروط الخطوة، والتحقق يتكرر في Edge Function (submit-ad)
   + إصلاح 1: ربط نتائج الفحص بالملف نفسه (it.mod)
   + إصلاح 2: لا يُسمح بالنشر حتى تكون كل صورة جديدة قد انتهى فحصها فعليًا
   + إصلاح 3: تمرير ملف الصورة إلى نافذة التحذير لعرض صورة مصغّرة */
(function () {
  'use strict';
  const el = Utils.el, t = k => I18n.t(k), L = window.CONFIG.LIMITS, R = window.CONFIG.ROUTES;
  const $ = s => document.querySelector(s);
  const TOTAL = 4;
  const MAXV = () => Categories.ATTR_MAX - 2; // مساحة الشرطتين المائلتين في الترميز "/أ/ب/"

  App.pages['post-ad'] = async function () {
    const st = await App.boot({ guard: true });
    if (!st) return;
    await Promise.all([Categories.load(), Geo.load()]);
    const root = $('#wizard'), stepper = $('#stepper'), label = $('#step-label'), next = $('#btn-next');
    const editId = Utils.qs('id');
    // delivery: غير متوفر افتراضيًا، والناشرة تغيّره عند الحاجة
    const S = { category_id: '', subcategory_id: '', attrs: {}, title: '', description: '', price: '', discount_pct: 0, negotiable: false, delivery: false, show_phone: false, video_url: '', faq: [], lat: null, lng: null, wilaya_id: st.profile.wilaya_id, daira_id: st.profile.daira_id, commune_id: st.profile.commune_id, used: false, grade: 9, deal: 'sale', rent_price: '' };
    let imgs = [], step = 1, orig = null, imgDirty = false;   // imgs: [{ old } | { file, mod }]
    let _modPromise = null;   // Promise ينتهي عند اكتمال فحص كل الصور الجارية

    // الحقول الإضافية المخزّنة داخل attrs تُفصل عن سمات الصنف
    const splitExtras = a => {
      const out = Object.assign({}, a);
      if (out.condition) { S.used = true; S.grade = parseInt(out.condition, 10) || 9; }
      if (out.deal) S.deal = out.deal;
      if (out.rent_price) S.rent_price = out.rent_price;
      delete out.condition; delete out.deal; delete out.rent_price;
      return out;
    };

    if (editId) {
      orig = await Ads.get(editId);
      if (!orig || orig.user_id !== Auth.uid() || orig.status === 'deleted') return Utils.go(R.MY_ADS);
      Object.assign(S, { category_id: orig.category_id, subcategory_id: orig.subcategory_id, attrs: splitExtras(orig.attrs || {}), title: orig.title, description: orig.description, price: orig.price, discount_pct: orig.discount_pct || 0, negotiable: !!orig.negotiable, delivery: !!orig.delivery, show_phone: !!orig.show_phone, video_url: orig.video_url || '', faq: orig.faq || [], wilaya_id: orig.wilaya_id, daira_id: orig.daira_id, commune_id: orig.commune_id });
      // الصور الحالية تظهر عند التعديل (حذف / إضافة / تغيير الغلاف)
      imgs = (await Ads.images(orig.id)).map(r => ({ old: r }));
    } else {
      const d = Utils.Store.get(window.CONFIG.STORAGE_KEYS.DRAFT); if (d) Object.assign(S, d);
    }
    const saveDraft = Utils.debounce(() => { if (!editId) { Utils.Store.set(window.CONFIG.STORAGE_KEYS.DRAFT, S); } }, 800);

    const opt = () => el('span', { class: 'opt', text: t('common.optional') });
    const field = (lbl, node, extra, optional) => el('div', { class: 'field' }, [el('label', {}, [lbl, optional ? opt() : null]), node, extra || null]);
    const bind = (input, key, fn) => input.addEventListener('input', () => { S[key] = fn ? fn(input.value) : input.value; saveDraft(); });
    const counter = (input, max) => { const c = el('div', { class: 'char-count' }); const u = () => { c.textContent = input.value.length + ' / ' + max; }; input.addEventListener('input', u); u(); return c; };

    /* ---- الخطوة 1: الصنف + السمات (ألوان/مقاسات متعددة) + العنوان والوصف ---- */
    function multiPick(f) {
      const raw = S.attrs[f.key], dec = Categories.decodeMulti(raw);
      const cur = new Set(dec.length ? dec : (raw ? [raw] : []));
      const box = el('div', { class: 'opts' });
      f.options.forEach(o => {
        const c = el('input', { type: 'checkbox', value: o }); c.checked = cur.has(o);
        c.addEventListener('change', () => {
          c.checked ? cur.add(o) : cur.delete(o);
          const enc = Categories.encodeMulti([...cur]);
          if (enc.length > Categories.ATTR_MAX) { cur.delete(o); c.checked = false; UI.toastKey('ad.multi_limit', 'error'); return; }
          enc ? S.attrs[f.key] = enc : delete S.attrs[f.key]; saveDraft();
        });
        const hex = f.key === 'color' && Categories.COLOR_HEX[o];
        box.append(el('label', {}, [c, hex ? el('i', { style: 'background:' + hex }) : null, o]));
      });
      return box;
    }
    function step1() {
      const c = el('select', { class: 'input' }), s = el('select', { class: 'input' }), attrs = el('div');
      c.append(new Option(t('filters.category'), '')); Categories.all().forEach(m => c.append(new Option(Categories.label(m), m.id))); c.value = S.category_id;
      const fillSub = () => {
        s.replaceChildren(new Option(t('filters.subcategory'), ''));
        const m = Categories.main(c.value); (m ? m.sub : []).forEach(x => s.append(new Option(Categories.label(x), x.id))); s.value = S.subcategory_id; fillAttrs();
      };
      const fillAttrs = () => {
        attrs.replaceChildren();
        Categories.filtersFor(s.value).forEach(f => {
          if (Categories.isMulti(f.key) && f.type === 'select') { attrs.append(field(Categories.keyLabel(f.key) + ' (' + t('ad.multi_hint') + ')', multiPick(f), null, true)); return; }
          const i = f.type === 'select' ? el('select', { class: 'input' }) : el('input', { class: 'input', maxlength: f.max || 30 });
          if (f.type === 'select') { i.append(new Option('—', '')); f.options.forEach(o => i.append(new Option(o, o))); }
          i.value = S.attrs[f.key] || '';
          i.addEventListener('input', () => { const v = Sanitize.cleanText(i.value, 30); v ? S.attrs[f.key] = v : delete S.attrs[f.key]; saveDraft(); });
          attrs.append(field(Categories.keyLabel(f.key), i, null, true));
        });
      };
      let vc = null;
      c.addEventListener('change', () => { S.category_id = c.value; S.subcategory_id = ''; S.attrs = {}; fillSub(); saveDraft(); if (vc) vc.refresh(); });
      s.addEventListener('change', () => { S.subcategory_id = s.value; S.attrs = {}; fillAttrs(); saveDraft(); if (vc) vc.refresh(); });
      const ti = el('input', { class: 'input', maxlength: L.TITLE, value: S.title }); bind(ti, 'title');
      const de = el('textarea', { class: 'input', maxlength: L.DESCRIPTION }); de.value = S.description; bind(de, 'description');
      fillSub();
      const hintT = VerifyCategory.hintEl(), hintD = VerifyCategory.hintEl();
      vc = VerifyCategory.attach({ title: ti, desc: de, hintTitle: hintT, hintDesc: hintD, getSel: () => ({ main: S.category_id, sub: S.subcategory_id }) });
      const mic = (input, max) => (Voice.supported() ? Voice.dictateButton(input, max) : null);
      const catVoice = Voice.supported() ? el('button', { class: 'btn btn--ghost voice-cat', type: 'button' }, '🎙 ' + t('voice.category')) : null;
      if (catVoice) catVoice.addEventListener('click', () => {
        if (Voice.active) return Voice.stop();
        catVoice.classList.add('is-rec');
        Voice.start({
          onFinal: tx => {
            const m = Voice.matchCategory(tx);
            if (!m) return UI.toastKey('voice.no_cat', 'error');
            c.value = m.cat; S.category_id = m.cat; S.subcategory_id = m.sub; S.attrs = {}; fillSub(); saveDraft(); refreshNext(); if (vc) vc.refresh();
          },
          onEnd: () => catVoice.classList.remove('is-rec')
        });
      });
      return [catVoice, field(t('filters.category'), c), field(t('filters.subcategory'), s), attrs,
        field(t('ad.title'), el('div', { class: 'row' }, [el('div', { class: 'grow' }, [ti]), mic(ti, L.TITLE)]), el('div', {}, [counter(ti, L.TITLE), hintT])),
        field(t('ad.description'), el('div', { class: 'row', style: 'align-items:flex-start' }, [el('div', { class: 'grow' }, [de]), mic(de, L.DESCRIPTION)]), el('div', {}, [counter(de, L.DESCRIPTION), hintD]))].filter(Boolean);
    }
    const ok1 = () => !!(S.category_id && S.subcategory_id && String(S.title).trim().length >= 3 && String(S.description).trim().length >= 5);
    async function check1() {
      if (!S.category_id || !S.subcategory_id) return 'err.category_required';
      const a = Sanitize.validateText(S.title, { max: L.TITLE, min: 3 }); if (!a.ok) return a.error; S.title = a.value;
      const b = Sanitize.validateText(S.description, { max: L.DESCRIPTION, min: 5 }); if (!b.ok) return b.error; S.description = b.value;
      const unchanged = !!(orig && orig.category_id === S.category_id && orig.subcategory_id === S.subcategory_id && orig.title === S.title && orig.description === S.description);
      return await VerifyCategory.gate({
        title: S.title, desc: S.description, main: S.category_id, sub: S.subcategory_id, S, unchanged,
        apply: (m, sb) => { S.category_id = m; S.subcategory_id = sb; S.attrs = {}; saveDraft(); render(); },
        onApproved: () => saveDraft()
      });
    }

    /* ---- الخطوة 2: السعر، الحالة، بيع/كراء، التوصيل ---- */
    function step2() {
      const box = el('div');
      const paint = () => {
        box.replaceChildren();
        const rentOnly = S.deal === 'rent';
        const pr = el('input', { class: 'input', type: 'number', inputmode: 'numeric', min: 1, value: S.price }); bind(pr, 'price');
        const r = Categories.range(S.category_id, S.subcategory_id);
        const hint = el('div', { class: 'hint', text: r ? Utils.formatNumber(r.min ?? 0) + ' - ' + (r.max != null ? Utils.formatNumber(r.max) : '∞') : '' });
        const dealBox = el('div', { class: 'opts' }, [['sale', 'ad.deal_sale'], ['both', 'ad.deal_both'], ['rent', 'ad.deal_rent_only']].map(([v, k]) => {
          const i = el('input', { type: 'radio', name: 'deal' }); i.checked = S.deal === v;
          i.addEventListener('change', () => { S.deal = v; saveDraft(); paint(); refreshNext(); });
          return el('label', {}, [i, t(k)]);
        }));
        box.append(field(t('ad.deal_type'), dealBox, null, true), field(rentOnly ? t('ad.rent_price') + ' (' + t('currency') + ')' : t('ad.price'), pr, hint));
        if (S.deal === 'both') {
          const rp = el('input', { class: 'input', type: 'number', inputmode: 'numeric', min: 1, value: S.rent_price }); bind(rp, 'rent_price');
          box.append(field(t('ad.rent_price') + ' (' + t('currency') + ')', rp));
        }
        const svc = Categories.isService(S.category_id);
        if (svc) { S.delivery = false; S.used = false; }
        const dc = el('input', { class: 'input', type: 'number', min: 0, max: 90, inputmode: 'numeric', value: S.discount_pct }); bind(dc, 'discount_pct', v => Math.min(90, Math.max(0, parseInt(v, 10) || 0)));
        const ng = el('input', { type: 'checkbox' }); ng.checked = S.negotiable; ng.addEventListener('change', () => { S.negotiable = ng.checked; saveDraft(); });
        const gr = el('select', { class: 'input', style: 'width:auto' }); for (let n = 10; n >= 1; n--) gr.append(new Option(n + '/10', n)); gr.value = S.grade; gr.disabled = !S.used;
        gr.addEventListener('change', () => { S.grade = Number(gr.value); saveDraft(); });
        const us = el('input', { type: 'checkbox' }); us.checked = S.used; us.addEventListener('change', () => { S.used = us.checked; gr.disabled = !us.checked; saveDraft(); });
        const dl = el('input', { type: 'checkbox' }); dl.checked = !!S.delivery; dl.addEventListener('change', () => { S.delivery = dl.checked; saveDraft(); paint(); });
        const sp = el('input', { type: 'checkbox' }); sp.checked = S.show_phone; sp.addEventListener('change', () => { S.show_phone = sp.checked; saveDraft(); });
        const dprices = Delivery.clean((st.profile && st.profile.delivery_prices) || {});
        const dCount = Object.keys(dprices).length;
        const dBox = (!svc && S.delivery) ? el('div', { class: 'card-box deliv-box' }, [
          el('div', { class: 'hint', text: dCount ? t('delivery.configured').replace('{n}', dCount) : t('delivery.none_configured') }),
          el('div', { class: 'hint', text: t('delivery.saved_hint') }),
          el('button', { class: 'btn btn--ghost', type: 'button', onclick: () => Delivery.openEditor(dprices, pr2 => { if (st.profile) st.profile.delivery_prices = pr2; paint(); }) }, '🚚 ' + t(dCount ? 'delivery.edit' : 'delivery.set'))
        ]) : null;
        box.append(field(t('ad.discount'), dc, null, true),
          el('label', { class: 'row' }, [ng, t('ad.negotiable')]),
          svc ? null : field(t('ad.condition'), el('div', { class: 'row' }, [el('label', { class: 'row' }, [us, t('ad.used')]), gr]), el('div', { class: 'hint', text: t('ad.condition_hint') }), true),
          svc ? null : el('label', { class: 'row', style: 'margin:10px 0' }, [dl, t('ad.delivery_yes')]),
          dBox,
          el('label', { class: 'row' }, [sp, t('ad.show_phone')]));
      };
      paint();
      return [box];
    }
    const ok2 = () => Price.validate(S.price, S.category_id, S.subcategory_id).ok && (S.deal !== 'both' || Number(S.rent_price) > 0);
    async function check2() {
      const v = Price.validate(S.price, S.category_id, S.subcategory_id);
      if (!v.ok) return v.vars ? t(v.error).replace('{min}', v.vars.min).replace('{max}', v.vars.max) : v.error;
      S.price = v.value;
      if (S.deal === 'both') { const rp = Sanitize.validatePrice(S.rent_price); if (!rp.ok) return rp.error; S.rent_price = rp.value; }
      if (orig && Number(S.price) !== Number(orig.price)) {
        const left = Price.editsLeft(orig);
        if (left <= 0) return 'err.price_edits_max';
        if (left === 1 && !(await UI.confirmDialog(t('ad.price_edit_last')))) return 'common.cancel';
      }
    }

    /* ---- الخطوة 3: الصور (القديمة تظهر عند التعديل) + فيديو + أسئلة ---- */
    function step3() {
      const prev = el('div', { class: 'img-preview' });
      const paint = () => {
        prev.replaceChildren();
        imgs.forEach((it, i) => {
          const src = it.old ? Utils.imgUrl(it.old.path_thumb, 'thumb') : URL.createObjectURL(it.file);
          const ph = el('div', { class: 'ph' }, [el('img', { src, alt: '' }), el('button', { type: 'button', 'aria-label': t('common.delete'), onclick: () => {
            const removed = imgs.splice(i, 1)[0];
            if (removed && removed.file && Upload.clearModerationWarningsFor) Upload.clearModerationWarningsFor(removed.file);
            imgDirty = true; paint(); refreshNext();
          } }, '×')]);
          if (i === 0) ph.append(el('span', { style: 'position:absolute;bottom:2px;inset-inline-start:2px;background:var(--c-primary);color:#fff;font-size:9px;padding:1px 6px;border-radius:8px', text: t('ad.cover') }));
          else ph.append(el('button', { type: 'button', style: 'top:auto;bottom:2px;inset-inline-end:2px;background:rgba(0,0,0,.6)', title: t('ad.make_cover'), onclick: () => { imgs.unshift(imgs.splice(i, 1)[0]); imgDirty = true; paint(); } }, '★'));

          // شارة حالة الفحص لكل صورة جديدة
          if (it.file) {
            let badgeText = '', badgeBg = '';
            if (it.mod === null || it.mod === undefined) { badgeText = '⏳'; badgeBg = 'rgba(0,0,0,.55)'; }
            else if (it.mod.ok === false) { badgeText = it.mod.verdict === 'UNSAFE' ? '🚫' : '⚠️'; badgeBg = it.mod.verdict === 'UNSAFE' ? 'rgba(200,0,0,.9)' : 'rgba(230,138,0,.9)'; }
            else if (!it.mod.skipped) { badgeText = '✓'; badgeBg = 'rgba(34,139,34,.9)'; }
            if (badgeText) ph.append(el('span', { style: 'position:absolute;top:2px;inset-inline-end:2px;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:13px;font-weight:bold;background:' + badgeBg, text: badgeText }));
          }

          prev.append(ph);
        });
      };
      const fi = el('input', { class: 'input', type: 'file', accept: 'image/jpeg,image/png,image/webp', multiple: true });
      fi.addEventListener('change', async () => {
        const newFiles = [];
        for (const f of [...fi.files]) {
          if (imgs.length >= L.IMAGES_MAX) { UI.toastKey('err.image_count', 'error'); break; }
          const v = await Upload.validate(f); if (!v.ok) { UI.toastKey(v.error, 'error'); continue; }
          imgs.push({ file: f, mod: null }); imgDirty = true; newFiles.push(f);
        }
        fi.value = ''; paint(); refreshNext();

        if (!newFiles.length) return;

        /* بدء الفحص في الخلفية فور اختيار الصور */
        UI.toastKey('ad.images_reviewing', 'info', 3000);

        const { promise } = Upload.startModeration(newFiles, (i, file, res) => {
          const item = imgs.find(it => it.file === file);
          if (item) item.mod = res;
          paint();
          if (!res.ok) {
            Upload.showModerationWarning(
              file.name, res.verdict, res.reasons,
              () => { /* المستخدم اختار المتابعة */ },
              () => {
                const idx = imgs.findIndex(it => it.file === file);
                if (idx !== -1) { imgs.splice(idx, 1); imgDirty = true; paint(); refreshNext(); }
              },
              file   // ← لتمرير الصورة المصغّرة إلى النافذة
            );
          }
        });
        // تراكم الوعود الجارية بدل استبدالها (يمنع انتهاء العلم مبكرًا)
        _modPromise = _modPromise ? _modPromise.then(() => promise) : promise;
      });
      const vd = el('input', { class: 'input', type: 'url', inputmode: 'url', maxlength: 300, value: S.video_url }); bind(vd, 'video_url');
      const faqBox = el('div');
      const paintFaq = () => {
        faqBox.replaceChildren();
        S.faq.forEach((q, i) => {
          const qi = el('input', { class: 'input', maxlength: L.FAQ_Q, placeholder: t('ad.faq_q'), value: q.q }), ai = el('input', { class: 'input', maxlength: L.FAQ_A, placeholder: t('ad.faq_a'), value: q.a });
          qi.addEventListener('input', () => { q.q = qi.value; saveDraft(); }); ai.addEventListener('input', () => { q.a = ai.value; saveDraft(); });
          faqBox.append(el('div', { class: 'card-box' }, [qi, ai, el('button', { class: 'btn btn--ghost', type: 'button', onclick: () => { S.faq.splice(i, 1); paintFaq(); } }, t('common.delete'))]));
        });
        if (S.faq.length < L.FAQ_MAX) faqBox.append(el('button', { class: 'btn btn--ghost', type: 'button', onclick: () => { S.faq.push({ q: '', a: '' }); paintFaq(); } }, t('ad.faq_add')));
      };
      paint(); paintFaq();
      return [field(t('ad.images'), fi, el('div', { class: 'hint', text: t('ad.cover_hint') })), prev, field(t('ad.video'), vd, null, true), el('h3', { text: t('ad.faq') }), faqBox];
    }
    const ok3 = () => imgs.length >= L.IMAGES_MIN && imgs.length <= L.IMAGES_MAX;
    function check3() {
      if (!ok3()) return 'err.image_count';
      const v = Sanitize.validateUrl(S.video_url, 'video'); if (!v.ok) return v.error; S.video_url = v.value;
      const faq = [];
      for (const q of S.faq) {
        if (!q.q && !q.a) continue;
        const a = Sanitize.validateText(q.q, { max: L.FAQ_Q, min: 2 }), b = Sanitize.validateText(q.a, { max: L.FAQ_A, min: 1 });
        if (!a.ok) return a.error; if (!b.ok) return b.error; faq.push({ q: a.value, a: b.value });
      }
      S.faq = faq.slice(0, L.FAQ_MAX);
    }

    /* ---- الخطوة 4: الموقع + وسائل التواصل الغير مضبوطة ---- */
    let sw, sd, sc;
    function step4() {
      sw = el('select', { class: 'input' }); sd = el('select', { class: 'input' }); sc = el('select', { class: 'input' });
      Geo.bindCascade(sw, sd, sc, { wilaya_id: S.wilaya_id, daira_id: S.daira_id, commune_id: S.commune_id });
      const gps = el('button', { class: 'btn btn--ghost', type: 'button' }, S.lat ? t('ad.gps_done') : t('ad.use_gps'));
      gps.addEventListener('click', () => navigator.geolocation && navigator.geolocation.getCurrentPosition(p => { S.lat = p.coords.latitude; S.lng = p.coords.longitude; gps.textContent = t('ad.gps_done'); saveDraft(); }, () => UI.toastKey('geo.locate_denied', 'error'), { timeout: 8000 }));

      const p = st.profile;
      const SOCIAL_ICONS = { phone: '📞', facebook: 'f', instagram: '📷', tiktok: '♪', telegram: '✈', maps_url: '📍' };
      const missing = [
        !p.phone && 'phone',
        !p.facebook && 'facebook',
        !p.instagram && 'instagram',
        !p.tiktok && 'tiktok',
        !p.telegram && 'telegram',
        !p.maps_url && 'maps_url',
      ].filter(Boolean);

      const contactSection = missing.length ? el('div', { class: 'card-box', style: 'margin-top:16px' }, [
        el('div', { class: 'hint', style: 'margin-bottom:8px', text: t('ad.contact_setup') + ':' }),
        el('div', { class: 'row', style: 'flex-wrap:wrap;gap:8px;margin-bottom:10px' },
          missing.map(k => el('span', { class: 'badge', text: (SOCIAL_ICONS[k] || '') + ' ' + (k === 'maps_url' ? 'Maps' : k === 'phone' ? t('ad.phone') : k.charAt(0).toUpperCase() + k.slice(1)) }))
        ),
        el('button', { class: 'btn btn--ghost', type: 'button', onclick: () => {
          const returnUrl = location.href;
          Utils.Store.set('post_ad_return', returnUrl);
          Utils.go(R.EDIT_PROFILE);
        }}, t('ad.contact_setup_go'))
      ]) : null;

      return [field(t('geo.wilaya'), sw), field(t('geo.daira'), sd), field(t('geo.commune'), sc), gps, contactSection].filter(Boolean);
    }
    const ok4 = () => !!(sw && Number(sw.value) && Number(sd.value) && Number(sc.value));
    function check4() {
      const g = Geo.values(sw, sd, sc); if (!g.wilaya_id || !g.daira_id || !g.commune_id) return 'err.location_required';
      Object.assign(S, g);
    }

    const builders = [null, step1, step2, step3, step4], checks = [null, check1, check2, check3, check4], oks = [null, ok1, ok2, ok3, ok4];
    const refreshNext = () => next.classList.toggle('ready', !!oks[step]());
    root.addEventListener('input', refreshNext); root.addEventListener('change', refreshNext);

    function render() {
      root.replaceChildren(...builders[step]());
      stepper.replaceChildren(...Array.from({ length: TOTAL }, (_, i) => el('div', { class: 'st' + (i + 1 < step ? ' done' : i + 1 === step ? ' cur' : '') }, [el('span', { class: 'n', text: String(i + 1) }), i < TOTAL - 1 ? el('span', { class: 'ln' }) : null])));
      label.textContent = t('ad.step').replace('{n}', step).replace('{total}', TOTAL);
      $('#btn-back').hidden = step === 1;
      next.textContent = t(step === TOTAL ? (editId ? 'ad.update' : 'ad.publish') : 'common.next');
      window.scrollTo({ top: 0 });
      setTimeout(refreshNext, 0);
    }

    const buildAttrs = () => {
      const out = {}, A = S.attrs;
      ['size', 'shoe_size', 'color'].forEach(k => { if (A[k]) out[k] = A[k]; });
      if (S.used && !Categories.isService(S.category_id)) out.condition = S.grade + '/10';
      if (S.deal !== 'sale') out.deal = S.deal;
      if (S.deal === 'both' && S.rent_price) out.rent_price = String(S.rent_price);
      Object.keys(A).forEach(k => { if (!(k in out)) out[k] = A[k]; });
      return out;
    };

    $('#btn-back').addEventListener('click', () => { step--; render(); });
    next.addEventListener('click', async () => {
      const err = await checks[step]();
      if (err === 'verify.blocked') return;
      if (err) return UI.toast(t(err) === err ? err : t(err), 'error');
      if (step < TOTAL) { step++; return render(); }
      UI.setLoading(next, true);
      try {
        const id = editId || Utils.uuid();
        let images = null;
        const changed = !editId || imgDirty;
        if (changed) {
          /* 1) انتظر أي فحص جارٍ */
          if (_modPromise) {
            UI.toastKey('ad.waiting_moderation', 'info', 0);
            try { await _modPromise; } catch { /* fail-open */ }
          }

          /* 2) لا تُسمح كل صورة جديدة بالمرور حتى ينتهي فحصها فعلًا */
          const unchecked = imgs.some(it => it.file && !it.mod);
          if (unchecked) { UI.toastKey('ad.waiting_moderation', 'error'); UI.setLoading(next, false); return; }

          /* 3) منع النشر إن وُجدت صور UNSAFE */
          const hasUnsafe = imgs.some(it => it.file && it.mod && it.mod.ok === false && it.mod.verdict === 'UNSAFE');
          if (hasUnsafe) { UI.toastKey('ad.blocked_images_exist', 'error'); UI.setLoading(next, false); return; }

          UI.toast(t('ad.uploading'), 'info', 1500);
          const files = [];
          const modResults = [];
          for (const it of imgs) {
            if (it.file) {
              files.push(it.file);
              modResults.push(it.mod && it.mod.ok !== false ? { ok: true, description: it.mod.description, tags: it.mod.tags } : { ok: true });
              continue;
            }
            const url = Utils.imgUrl(it.old.path_large || it.old.path_medium, 'large');
            const blob = await (await fetch(url)).blob();
            files.push(new File([blob], 'old.' + (blob.type.split('/')[1] || 'webp'), { type: blob.type || 'image/webp' }));
            modResults.push({ ok: true });
          }
          /* جمع fileIds الصور الممنوعة لحذفها من ImageKit بعد النشر */
          const bannedFileIds = [];
          for (const it of imgs) {
            if (it.file && it.mod && it.mod.ok === false && it.mod.verdict === 'UNSAFE' && it._imagekitFileId) {
              bannedFileIds.push(it._imagekitFileId);
            }
          }
          images = await Upload.putAdImages(id, files, null, _modPromise, modResults);
          console.log('[DEBUG] images:', JSON.stringify(images));
          /* حذف الصور الممنوعة من ImageKit بشكل غير متزامن */
          if (bannedFileIds.length) {
            SB.fn('imagekit-delete', { fileIds: bannedFileIds }).catch(e => console.warn('[PostAd] imagekit-delete', e));
          }
        }
        const ad = { category_id: S.category_id, subcategory_id: S.subcategory_id, attrs: buildAttrs(), title: S.title, description: S.description, price: S.price, discount_pct: S.discount_pct, negotiable: S.negotiable, delivery: Categories.isService(S.category_id) ? false : !!S.delivery, show_phone: S.show_phone, video_url: S.video_url, faq: S.faq, wilaya_id: S.wilaya_id, daira_id: S.daira_id, commune_id: S.commune_id, lat: S.lat, lng: S.lng };
        const { data, error } = await SB.fn('submit-ad', { mode: editId ? 'update' : 'create', id, ad, images });
        if (error || (data && data.error)) throw error || new Error(data.error);
        Utils.Store.remove(window.CONFIG.STORAGE_KEYS.DRAFT);
        UI.toastKey(editId ? 'ad.updated' : 'ad.published', 'success');
        setTimeout(() => Utils.go(R.AD, { id }), 700);
      } catch (e) { console.error('[PostAd]', e?.message, e?.context, JSON.stringify(e)); UI.toastKey(UI.errKey(e), 'error'); }
      finally { UI.setLoading(next, false); }
    });
    render();
    if (!editId && S.title) UI.toastKey('ad.saved_draft', 'info', 1800);

    const returnUrl = Utils.Store.get('post_ad_return');
    if (returnUrl) { Utils.Store.remove('post_ad_return'); }
  };
})();