/* search.js — خانة البحث: جمل مقترحة متحركة، إكمال تلقائي، سجل بحث، بحث صوتي، تحليل محلي فوري + بحث ذكي (AI) عند الحاجة فقط */
(function () {
  'use strict';
  const el = Utils.el, t = k => I18n.t(k), L = window.CONFIG.LIMITS, MAXQ = 100;
  let input, sugBox, dymBox, btn, voiceBtn, phBox, phSpan, onSearch = () => {};
  let busy = false, busyTimer = null, current = '', phTimer = null, phAnim = null, phIdx = 0;

  /* ---------- الجملة الشفافة المتحركة ---------- */
  const samples = () => [1, 2, 3, 4].map(i => t('search.sample' + i)).filter(s => s && !/^search\.sample/.test(s));
  function phStop() { clearTimeout(phTimer); if (phAnim) { phAnim.cancel(); phAnim = null; } }
  function phShow() {
    phStop();
    if (!phBox) return;
    if (input.value) { phBox.hidden = true; return; }
    const list = samples(); if (!list.length) return;
    const txt = list[phIdx % list.length]; phIdx++;
    current = txt; phBox.hidden = false;
    const rtl = /[\u0600-\u06FF]/.test(txt);
    phBox.dir = rtl ? 'rtl' : 'ltr';
    phSpan.textContent = txt; phSpan.style.transform = 'none';
    const bw = phBox.clientWidth, tw = phSpan.scrollWidth;
    if (tw > bw + 2 && phSpan.animate) {
      const from = rtl ? tw : -tw, to = rtl ? -bw : bw;
      phAnim = phSpan.animate([{ transform: 'translateX(' + from + 'px)' }, { transform: 'translateX(' + to + 'px)' }], { duration: Math.max(4000, (bw + tw) / 45 * 1000), easing: 'linear' });
      phAnim.onfinish = phShow;
    } else phTimer = setTimeout(phShow, 3200);
  }
  const togglePh = () => { if (!phBox) return; if (input.value) { phStop(); phBox.hidden = true; } else if (phBox.hidden) phShow(); };

  function keepTail() {
    requestAnimationFrame(() => {
      if (input.selectionStart !== input.value.length) return;
      const rtl = getComputedStyle(input).direction === 'rtl';
      input.scrollLeft = rtl ? -input.scrollWidth : input.scrollWidth;
    });
  }

  function setBusy(on) {
    busy = !!on; clearTimeout(busyTimer);
    if (btn) { btn.classList.toggle('is-loading', busy); btn.setAttribute('aria-busy', busy ? 'true' : 'false'); }
    if (busy) busyTimer = setTimeout(() => setBusy(false), 8000);
  }

  /* ---------- الاقتراحات ---------- */
  const mark = (txt, q) => {
    const i = Dict.norm(txt).indexOf(Dict.norm(q));
    if (i < 0 || !q) return [document.createTextNode(txt)];
    return [document.createTextNode(txt.slice(0, i)), el('b', { text: txt.slice(i, i + q.length) }), document.createTextNode(txt.slice(i + q.length))];
  };
  function renderRows(rows, q) {
    sugBox.replaceChildren();
    if (!rows.length) { sugBox.hidden = true; return; }
    rows.slice(0, 8).forEach(r => {
      const row = el('div', { class: 'suggest__row' });
      const main = el('button', { type: 'button', class: 'suggest__item' }, [el('span', { class: 'suggest__ico', text: r.kind === 'hist' ? '🕘' : '🔎' }), el('span', { class: 'suggest__txt' }, q ? mark(r.text, q) : [document.createTextNode(r.text)])]);
      main.addEventListener('click', () => { input.value = r.text; togglePh(); Search.submit(); });
      row.append(main);
      if (r.kind === 'hist') row.append(el('button', { type: 'button', class: 'suggest__act', 'aria-label': t('common.delete'), onclick: e => { e.stopPropagation(); SearchState.removeHistory(r.text); Search.suggest(); } }, '×'));
      else row.append(el('button', { type: 'button', class: 'suggest__act', 'aria-label': t('search.fill'), onclick: e => { e.stopPropagation(); input.value = r.text + ' '; input.focus(); keepTail(); Search.suggest(); } }, '↖'));
      sugBox.append(row);
    });
    sugBox.hidden = false;
  }

  const Search = {
    mount({ input: i, suggest, didYouMean, button, voiceButton, placeholder, onSubmit }) {
      input = i; sugBox = suggest; dymBox = didYouMean; btn = button; voiceBtn = voiceButton; onSearch = onSubmit;
      phBox = placeholder; phSpan = placeholder && placeholder.firstElementChild;
      input.maxLength = MAXQ; input.setAttribute('dir', 'auto'); input.setAttribute('enterkeyhint', 'search');
      input.setAttribute('autocapitalize', 'off'); input.setAttribute('autocorrect', 'off'); input.setAttribute('spellcheck', 'false');
      const st = window.Filters && Filters.get();
      if (st && (st.qraw || st.q)) input.value = st.qraw || st.q;
      phIdx = 0; phShow();
      document.addEventListener('langchange', () => { phIdx = 0; phShow(); });
      input.addEventListener('input', () => { togglePh(); keepTail(); this.suggestSoon(); });
      input.addEventListener('focus', () => this.suggest());
      input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); this.submit(); } });
      input.addEventListener('search', () => {
        if (!input.value && window.Filters && (Filters.get().q || Filters.get().qraw)) { SearchState.clearScroll(); onSearch({ q: '', qx: [], qraw: '' }); }
      });
      if (btn) btn.addEventListener('click', () => this.submit());
      document.addEventListener('click', e => { if (!sugBox.contains(e.target) && e.target !== input) sugBox.hidden = true; });
      document.addEventListener('feeddone', () => setBusy(false));
      if (voiceBtn) {
        if (!Voice.supported()) voiceBtn.hidden = true;
        else voiceBtn.addEventListener('click', () => this.voice());
      }
    },

    suggestSoon: Utils.debounce(function () { Search.suggest(); }, L.SEARCH_DEBOUNCE_MS),

    async submit() {
      if (busy) return;
      let raw = Sanitize.cleanText(input.value, MAXQ);
      if (!raw) raw = current;
      if (!raw) return;
      if (Sanitize.containsBadWords(raw)) { UI.toastKey('err.bad_words', 'error'); return; }
      input.value = raw; togglePh(); sugBox.hidden = true; input.blur();
      setBusy(true);
      document.dispatchEvent(new CustomEvent('searchstart'));
      let f;
      try { f = await this.interpret(raw); }
      catch (e) { console.error('[Search] interpret', e); f = Object.assign(this.fresh(), { q: raw, qraw: raw }); }
      SearchState.addHistory(raw); SearchState.clearScroll();
      onSearch(f);
      this.didYouMean(raw);
    },

    fresh() {
      return { q: '', qx: [], qraw: '', category_id: '', subcategory_id: '', wilaya_ids: [], daira_ids: [], commune_ids: [], min_price: null, max_price: null, delivery: false, condition: '', attrs: {} };
    },

    async interpret(raw) {
      const p = Dict.parse(raw), v = Dict.queryVariants(p), f = this.fresh();
      Object.assign(f, { q: v.q, qx: v.qx, qraw: raw, min_price: p.min || null, max_price: p.max || null, wilaya_ids: p.wilayaIds, commune_ids: p.communeIds, condition: p.condition, delivery: p.delivery });
      if (p.colors.length) f.attrs.color = p.colors;
      if (p.size) f.attrs.size_any = [p.size];
      if (p.rent) f.attrs.deal = ['rent', 'both'];
      if (!f.q && !p.recognized && !Object.keys(f.attrs).length && !f.wilaya_ids.length && !f.min_price && !f.max_price && !f.condition) f.q = raw;
      if (this.needAI(p)) { const ai = await this.ai(raw); if (ai) this.merge(f, ai, p); }
      return f;
    },

    needAI(p) {
      if (p.tokens < 3) return false;
      return p.unknownPlace > 0 || p.leftover >= 3 || (!p.recognized && p.leftover >= 2);
    },
    async ai(raw) {
      const key = Dict.norm(raw), hit = SearchState.aiGet(key);
      if (hit) return hit;
      const call = SB.fn('smart-search', { q: raw }).then(({ data, error }) => { if (error || !data || !data.filters) throw error || new Error('no filters'); return data.filters; });
      const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), L.AI_TIMEOUT_MS));
      try { const r = await Promise.race([call, timeout]); SearchState.aiSet(key, r); return r; }
      catch (e) { call.then(r => SearchState.aiSet(key, r)).catch(() => {}); return null; }
    },
    merge(f, ai, p) {
      if (!f.wilaya_ids.length && ai.wilaya) { const w = Number(ai.wilaya); if (w) f.wilaya_ids = [w]; }
      if (!f.commune_ids.length && ai.commune && Geo.communes) {
        const m = Geo.communes().find(c => Geo.label(c).toLowerCase().includes(String(ai.commune).toLowerCase()));
        if (m) f.commune_ids = [m.id];
      }
      if (f.min_price == null && ai.min_price) f.min_price = ai.min_price;
      if (f.max_price == null && ai.max_price) f.max_price = ai.max_price;
      if (!f.attrs.color && Array.isArray(ai.colors) && ai.colors.length) f.attrs.color = ai.colors;
      if (!f.attrs.size_any && Array.isArray(ai.sizes) && ai.sizes.length) f.attrs.size_any = ai.sizes;
      if (!p.recognized && (ai.category || ai.subcategory)) {
        f.category_id = ai.category || ''; f.subcategory_id = ai.subcategory || ''; f.q = ''; f.qx = [];
        if (!f.subcategory_id && ai.keywords) f.q = Sanitize.cleanText(ai.keywords, MAXQ);
      } else if (!f.q && ai.keywords) f.q = Sanitize.cleanText(ai.keywords, MAXQ);
    },

    voice() {
      if (Voice.active) { Voice.stop(); return; }
      voiceBtn.classList.add('is-rec'); input.value = ''; togglePh();
      Voice.start({
        onInterim: tx => { input.value = tx; togglePh(); keepTail(); },
        onFinal: tx => {
          const route = Voice.command(tx);
          if (route) { input.value = ''; togglePh(); return Utils.go(route); }
          input.value = tx; this.submit();
        },
        onEnd: () => voiceBtn.classList.remove('is-rec')
      });
    },

    async suggest() {
      const q = Sanitize.cleanText(input.value, MAXQ);
      if (!q) {
        const hist = SearchState.history().slice(0, 6).map(x => ({ text: x, kind: 'hist' }));
        return renderRows(hist.length ? hist : samples().map(x => ({ text: x, kind: 'srv' })), '');
      }
      const nq = Dict.norm(q), seen = new Set([nq]), rows = [];
      const add = (text, kind) => { const n = Dict.norm(text); if (!text || seen.has(n)) return; seen.add(n); rows.push({ text, kind }); };
      SearchState.history().filter(h => Dict.norm(h).includes(nq)).slice(0, 3).forEach(h => add(h, 'hist'));
      Dict.autocomplete(q, 3).forEach(w => add(w, 'dict'));
      const cached = q.length >= 2 ? SearchState.suggestGet(q) : null;
      if (cached) cached.forEach(x => add(x, 'srv'));
      renderRows(rows, q);
      if (q.length < 2 || cached) return;
      try {
        const { data } = await SB.db.rpc('suggest_terms', { p_q: q });
        const list = (data || []).slice(0, 6).map(r => r.term);
        SearchState.suggestSet(q, list);
        if (Sanitize.cleanText(input.value, MAXQ) !== q) return;
        list.forEach(x => add(x, 'srv')); renderRows(rows, q);
      } catch (e) { console.warn('[Search] suggest', e); }
    },

    /* ===== البحث بالصورة ===== */
    mountImageSearch({ btn: imgBtn, fileInput, onResults }) {
      if (!imgBtn || !fileInput) return;
      imgBtn.addEventListener('click', () => {
        /* اشتراط تسجيل الدخول — توجيه مباشر مع حفظ العودة */
        if (!Auth.isLogged()) { Router.toLogin(); return; }
        fileInput.click();
      });
      fileInput.addEventListener('change', async () => {
        const file = fileInput.files && fileInput.files[0];
        fileInput.value = '';
        if (!file) return;

        const valid = await Upload.validate(file);
        if (!valid.ok) { UI.toastKey(valid.error, 'error'); return; }

        setBusy(true);
        imgBtn.classList.add('is-loading');

        try {
          /* إرسال الصورة للـ Edge Function كـ base64 داخل JSON */
          const buffer  = await file.arrayBuffer();
          const bytes   = new Uint8Array(buffer);
          let bin = '';
          bytes.forEach(b => { bin += String.fromCharCode(b); });
          const b64 = btoa(bin);

          const { data, error } = await SB.fn('image-search', {
            image: b64,
            mime:  file.type || 'image/jpeg'
          });

          if (error) throw error;

          if (data && data.error === 'LIMIT_REACHED') {
            UI.toastKey('search.image_limit', 'error'); return;
          }

          if (data && data.ok === false) {
            Upload.showModerationWarning(file.name, data.verdict, data.reasons, null, () => {}, file); return;
          }

          const remaining = data && typeof data.remaining === 'number' ? data.remaining : null;
          if (remaining !== null) {
            if (remaining > 0) UI.toast(I18n.t('search.image_remaining').replace('{n}', remaining), 'info', 3000);
            else UI.toastKey('search.image_last', 'info', 3000);
          }

          const results = (data && data.results) || [];
          if (!results.length) { UI.toastKey('empty.no_match', 'info'); return; }
          if (onResults) onResults(results);

        } catch (e) {
          console.error('[ImageSearch] ERROR:', e, e && e.message, e && e.stack);
          UI.toastKey('err.generic', 'error');
        } finally {
          setBusy(false);
          imgBtn.classList.remove('is-loading');
        }
      });
    },

    async didYouMean(q) {
      dymBox.replaceChildren();
      try {
        const { data } = await SB.db.rpc('did_you_mean', { p_q: q });
        const s = data && data[0] && data[0].term;
        if (!s || s === q) return;
        dymBox.append(t('search.did_you_mean') + ' ', el('button', { type: 'button', onclick: () => { input.value = s; togglePh(); this.submit(); } }, s));
      } catch (e) { console.warn('[Search] dym', e); }
    }
  };
  window.Search = Search;
})();
