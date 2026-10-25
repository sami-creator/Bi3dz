/* verify-category.js — فحص لحظي لتطابق عنوان/وصف الإعلان مع التصنيف المختار (قاموس 3 لغات: data/verify_category.json)
   - تنبيه أحمر صغير أسفل العنوان/الوصف أثناء الكتابة
   - عند الضغط على "التالي": نافذة (تعديل التصنيف / التصنيف صحيح / إزالة التنبيه) والنشر ممنوع حتى يُصحَّح التصنيف
   - "التصنيف صحيح" ← طلب مراجعة إلى Edge Function اسمها review-ad (حد 3 طلبات في اليوم)
   الكلمات البذيئة لا تُفحص هنا: تبقى عبر Sanitize.containsBadWords */
(function () {
  'use strict';
  const el = Utils.el, t = k => I18n.t(k);
  const LANGS = ['ar', 'fr', 'en'];
  // عتبات القرار: العنوان أكثر حساسية من الوصف (الوصف أطول وفيه كلمات عابرة)
  const RULE = { title: { th: 2.5, ratio: 0.5 }, desc: { th: 4, ratio: 0.4 } };

  let loadP = null, ready = false;
  let phraseWords = new Map(), firstWord = new Map(), phraseSubs = new Map(), phraseMains = new Map();

  /* ---------- توحيد النص (يعمل على كل اللغات معًا بلا تحديد لغة) ---------- */
  function norm(s) {
    return String(s == null ? '' : s).toLowerCase()
      .replace(/[٠-٩]/g, c => '٠١٢٣٤٥٦٧٨٩'.indexOf(c))
      .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
      .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
      .replace(/[éèêë]/g, 'e').replace(/[àâä]/g, 'a').replace(/[îï]/g, 'i').replace(/[ôö]/g, 'o').replace(/[ùûü]/g, 'u').replace(/ç/g, 'c')
      .replace(/[^a-z0-9\u0621-\u064A\s]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  const isLatin = w => /^[a-z0-9]+$/.test(w);
  // صيغة موحّدة للكلمة: إزالة "ال" في العربية، وجمع s في اللاتينية
  function canon(w) {
    if (isLatin(w)) return w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w;
    return w.length > 4 && w.startsWith('ال') ? w.slice(2) : w;
  }
  // احتمالات الكلمة بعد إزالة السوابق الملتصقة (و/ب/ك/ل/ف + ال، لل)
  const PREF = ['وال', 'بال', 'كال', 'فال', 'لل'], PREF1 = ['و', 'ب', 'ك', 'ل', 'ف'];
  function cands(tok) {
    const set = new Set([canon(tok)]);
    if (!isLatin(tok)) {
      PREF.forEach(p => { if (tok.startsWith(p) && tok.length > p.length + 2) set.add(canon(tok.slice(p.length))); });
      PREF1.forEach(p => { if (tok.startsWith(p) && tok.length > p.length + 2) set.add(canon(tok.slice(p.length))); });
    }
    return set;
  }

  /* ---------- بناء الفهرس ---------- */
  function build(data) {
    phraseWords = new Map(); firstWord = new Map(); phraseSubs = new Map(); phraseMains = new Map();
    Object.entries(data.subs || {}).forEach(([subId, langs]) => {
      const fs = Categories.findSub(subId); if (!fs) return;
      LANGS.forEach(l => (langs[l] || []).forEach(raw => {
        const words = norm(raw).split(' ').filter(Boolean).map(canon);
        if (!words.length || (words.length === 1 && words[0].length < 2)) return;
        const key = words.join(' ');
        phraseWords.set(key, words);
        if (!phraseSubs.has(key)) phraseSubs.set(key, new Set());
        if (!phraseMains.has(key)) phraseMains.set(key, new Set());
        phraseSubs.get(key).add(subId); phraseMains.get(key).add(fs.main.id);
        if (!firstWord.has(words[0])) firstWord.set(words[0], new Set());
        firstWord.get(words[0]).add(key);
      }));
    });
    ready = true;
  }
  function load() {
    if (loadP) return loadP;
    loadP = Categories.load()
      .then(() => fetch('data/verify_category.json'))
      .then(r => r.json())
      .then(d => { build(d); return true; })
      .catch(e => { console.warn('[VerifyCategory] load', e); return false; });
    return loadP;
  }

  /* ---------- التحليل: أطول عبارة أولًا، ثم أوزان لكل صنف فرعي ورئيسي ---------- */
  function analyze(text) {
    const toks = norm(text).split(' ').filter(Boolean), cs = toks.map(cands);
    const matched = [], out = { main: {}, sub: {}, matched };
    const at = (i, w) => { for (let k = 0; k < w.length; k++) { if (i + k >= toks.length || !cs[i + k].has(w[k])) return false; } return true; };
    for (let i = 0; i < toks.length;) {
      let best = null;
      cs[i].forEach(c => {
        const keys = firstWord.get(c); if (!keys) return;
        keys.forEach(key => { const w = phraseWords.get(key); if ((!best || w.length > best.len) && at(i, w)) best = { key, len: w.length }; });
      });
      if (best) { matched.push(best.key); i += best.len; } else i++;
    }
    new Set(matched).forEach(key => {
      const subs = phraseSubs.get(key), mains = phraseMains.get(key);
      subs.forEach(s => { out.sub[s] = (out.sub[s] || 0) + 3 / subs.size; });
      mains.forEach(m => { out.main[m] = (out.main[m] || 0) + 3 / mains.size; });
    });
    return out;
  }
  function bestSubIn(subScores, mainId) {
    const m = Categories.main(mainId); if (!m) return '';
    let best = '', bs = 0;
    m.sub.forEach(s => { const v = subScores[s.id] || 0; if (v > bs) { bs = v; best = s.id; } });
    return best;
  }

  // null = لا مشكلة، وإلا { type:'main'|'sub', main, sub, field }
  function verdict(text, main, sub, field) {
    if (!ready || !main || !text || String(text).trim().length < 3) return null;
    const r = RULE[field], a = analyze(text), ranked = Object.entries(a.main).sort((x, y) => y[1] - x[1]);
    if (!ranked.length) return null;
    const [topMain, topScore] = ranked[0], chosen = a.main[main] || 0;
    if (topMain !== main && topScore >= r.th && chosen <= topScore * r.ratio) {
      return { type: 'main', main: topMain, sub: bestSubIn(a.sub, topMain), field };
    }
    if (sub) {
      const bs = bestSubIn(a.sub, main);
      if (bs && bs !== sub) {
        const s1 = a.sub[bs] || 0, s0 = a.sub[sub] || 0;
        if (s1 >= r.th && s0 <= s1 * r.ratio) return { type: 'sub', main, sub: bs, field };
      }
    }
    return null;
  }
  const catText = v => Categories.path(v.main, v.sub);

  /* ---------- التنبيه الأحمر تحت الحقول ---------- */
  function showHint(h, v) {
    if (!v) { h.hidden = true; h.textContent = ''; return; }
    h.textContent = t(v.field === 'title' ? 'verify.title_looks' : 'verify.desc_looks').replace('{cat}', catText(v));
    h.hidden = false;
  }

  /* ---------- نافذة "التالي" ---------- */
  function approvalKey(main, sub, title, desc) {
    const s = [main, sub, norm(title), norm(desc)].join('|'); let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  }

  function dialog(v, ctx) {
    return new Promise(resolve => {
      const ov = el('div', { class: 'modal-overlay' }), box = el('div', { class: 'modal' });
      let target = { main: v.main, sub: v.sub };
      const close = r => { ov.remove(); resolve(r); };
      const msg = el('p', { class: 'verify-msg' });
      const setMsg = () => {
        msg.textContent = t('verify.dialog_body').replace('{what}', t(v.field === 'title' ? 'verify.what_title' : 'verify.what_desc')).replace('{cat}', Categories.path(target.main, target.sub)).replace('{cur}', Categories.path(ctx.main, ctx.sub));
      };
      setMsg();
      const note = el('p', { class: 'verify-note', hidden: true });
      const fix = el('button', { class: 'btn btn--primary', type: 'button' }, t('verify.fix'));
      const ok = el('button', { class: 'btn btn--ghost', type: 'button' }, t('verify.correct'));
      const dismiss = el('button', { class: 'btn btn--ghost', type: 'button' }, t('verify.dismiss'));

      fix.addEventListener('click', () => {
        ctx.apply(target.main, target.sub);
        UI.toast(t('verify.fixed').replace('{cat}', Categories.path(target.main, target.sub)), 'success');
        close('fixed');
      });
      dismiss.addEventListener('click', () => close('closed'));
      ov.addEventListener('click', e => { if (e.target === ov) close('closed'); });

      // "التصنيف صحيح": مراجعة عبر Edge Function (مفتاح Groq عشوائي، حد 3 يوميًا)
      ok.addEventListener('click', async () => {
        const show = (k, extra) => { note.textContent = t(k).replace('{cat}', extra || '').replace('{n}', extra || ''); note.hidden = false; };
        UI.setLoading(ok, true); show('verify.reviewing');
        let res = null, failed = false;
        try {
          const { data, error } = await SB.fn('review-ad', { title: ctx.title, description: ctx.desc, category_id: ctx.main, subcategory_id: ctx.sub });
          if (error) failed = true; else res = data;
        } catch (e) { console.warn('[VerifyCategory] review', e); failed = true; }
        UI.setLoading(ok, false);
        if (failed || !res) return show('verify.review_failed');
        if (res.error === 'LIMIT') { ok.disabled = true; return show('verify.limit', String(res.limit || 3)); }
        if (!res.ok) return show('verify.review_failed');
        if (res.correct) {
          ctx.S.verify_ok = ctx.key; if (ctx.onApproved) ctx.onApproved();
          UI.toastKey('verify.review_ok', 'success'); return close('approved');
        }
        // المراجعة ترى أن التصنيف خاطئ: نقترح تصنيفها ونوقف إعادة الطلب (لا نستهلك الحصة عبثًا)
        const d = res.detected;
        if (d && d.category_id && d.subcategory_id && Categories.findSub(d.subcategory_id)) { target = { main: d.category_id, sub: d.subcategory_id }; setMsg(); }
        ok.disabled = true; show('verify.review_bad', Categories.path(target.main, target.sub));
        if (typeof res.remaining === 'number') note.textContent += ' · ' + t('verify.remaining').replace('{n}', res.remaining);
      });

      box.append(el('h3', { text: t('verify.dialog_title') }), msg, note, el('div', { class: 'verify-actions' }, [fix, ok, dismiss]));
      ov.append(box); document.body.append(ov);
    });
  }

  const VerifyCategory = {
    load,
    norm,
    hintEl() { const h = el('div', { class: 'verify-hint', role: 'alert' }); h.hidden = true; return h; },

    // يفحص العنوان ثم الوصف ويُرجع أول مشكلة (أو null)
    check(title, desc, main, sub) { return verdict(title, main, sub, 'title') || verdict(desc, main, sub, 'desc'); },

    // ربط التنبيه اللحظي بالحقول. يُرجع { refresh } لاستدعائه عند تغيّر التصنيف
    attach({ title, desc, hintTitle, hintDesc, getSel }) {
      const update = () => {
        const s = getSel();
        showHint(hintTitle, verdict(title.value, s.main, s.sub, 'title'));
        showHint(hintDesc, verdict(desc.value, s.main, s.sub, 'desc'));
      };
      const soon = Utils.debounce(update, 250);
      title.addEventListener('input', soon); desc.addEventListener('input', soon);
      load().then(update);
      return { refresh: update };
    },

    // بوابة زر "التالي": تُرجع null إن سُمح بالمتابعة، أو 'verify.blocked' عند المنع
    async gate({ title, desc, main, sub, S, unchanged, apply, onApproved }) {
      await load();
      if (unchanged || !ready) return null;
      const key = approvalKey(main, sub, title, desc);
      if (S.verify_ok === key) return null;                    // سبق أن اعتمدته المراجعة لهذا المحتوى بالضبط
      const v = this.check(title, desc, main, sub);
      if (!v) return null;
      const r = await dialog(v, { title, desc, main, sub, S, key, apply, onApproved });
      return r === 'approved' ? null : 'verify.blocked';
    }
  };
  window.VerifyCategory = VerifyCategory;
})();
