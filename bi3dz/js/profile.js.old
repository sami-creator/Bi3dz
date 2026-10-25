/* profile.js — صفحات الحساب: auth، complete-profile، profile، edit-profile
   + تصحيح: انتظار انتهاء فحص الأفاتار قبل الحفظ (يمنع تجاوز الفحص) */
(function () {
  'use strict';
  const el = Utils.el, t = k => I18n.t(k), R = window.CONFIG.ROUTES, L = window.CONFIG.LIMITS;
  const $ = s => document.querySelector(s);
  const P = App.pages;

  function fillYears(sel, chosen) {
    sel.replaceChildren(new Option(t('auth.birth_year'), ''));
    Utils.birthYears().forEach(y => sel.append(new Option(y, y)));
    if (chosen) sel.value = chosen;
  }
  function showErr(input, key) {
    input.classList.toggle('is-invalid', !!key);
    const slot = input.parentElement.querySelector('.error-text');
    if (slot) slot.textContent = key ? t(key) : '';
  }

  // مشاركة رابط حساب (من صاحبه أو من الزوار)
  async function shareProfile(uid, name) {
    const url = location.origin + location.pathname.replace(/[^/]*$/, '') + R.PROFILE + '?u=' + uid;
    if (navigator.share) { try { await navigator.share({ title: name || t('app.name'), url }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
    try { await navigator.clipboard.writeText(url); } catch { const i = el('input', { value: url }); document.body.append(i); i.select(); document.execCommand('copy'); i.remove(); }
    UI.toastKey('ad.link_copied', 'success');
  }
  const wordCount = s => String(s || '').trim().split(/\s+/).filter(Boolean).length;
  function paintBio(text) { const b = $('#p-bio'); if (!b) return; b.textContent = text || ''; b.hidden = !text; }

  /* ---------- تسجيل الدخول ---------- */
  P.auth = async function () {
    const st = await App.boot();
    if (!st) return;
    if (st.status === 'complete') return Router.afterLogin();
    if (st.status === 'partial') return Utils.go(R.COMPLETE);
    const btn = $('#btn-google');
    btn.addEventListener('click', async () => { UI.setLoading(btn, true); await Auth.signInGoogle(); UI.setLoading(btn, false); });
  };

  /* ---------- إكمال البيانات ---------- */
  P.complete = async function () {
    const st = await App.boot({ guard: true, complete: false });
    if (!st) return;
    if (st.status === 'complete') return Router.afterLogin();
    const f = { name: $('#name'), gender: $('#gender'), year: $('#year'), w: $('#wilaya'), d: $('#daira'), c: $('#commune') };
    f.name.value = st.profile.name || ''; f.name.maxLength = L.NAME;
    fillYears(f.year);
    await Geo.bindCascade(f.w, f.d, f.c);

    $('#form-complete').addEventListener('submit', async e => {
      e.preventDefault();
      const btn = $('#btn-save'); UI.setLoading(btn, true);
      const r = await Auth.completeProfile(Object.assign({ name: f.name.value, gender: f.gender.value, birth_year: f.year.value }, Geo.values(f.w, f.d, f.c)));
      UI.setLoading(btn, false);
      if (r.error) return UI.toastKey(r.error, 'error');
      // استبيان اختياري بعد أول تسجيل
      $('#form-complete').hidden = true; $('#survey').hidden = false;
    });
    const done = () => Router.afterLogin();
    $('#btn-survey-skip').addEventListener('click', done);
    $('#btn-survey-send').addEventListener('click', async () => {
      const sel = document.querySelector('input[name="src"]:checked');
      if (sel) {
        const other = Sanitize.cleanText($('#src-other').value, 100);
        await SB.db.from('onboarding_survey').insert({ user_id: Auth.uid(), source: sel.value === 'other' && other ? other : sel.value });
      }
      done();
    });
  };

  /* ---------- حسابي ---------- */
  // صفحة ناشرة أخرى (?u=): اسمها، تقييمها، روابطها وإعلاناتها النشطة
  async function publicProfile(uid) {
    $('#own-actions').hidden = true; $('#own-menu').hidden = true;
    const { data: sp } = await SB.db.from('seller_public').select('*').eq('id', uid).maybeSingle();
    if (!sp) return Utils.go(R.HOME);
    $('#p-avatar').src = Utils.imgUrl(sp.avatar_url || 'assets/images/avatar.svg', 'medium');
    $('#p-avatar').addEventListener('error', e => { e.target.src = 'assets/images/avatar.svg'; }, { once: true });
    $('#p-name').textContent = sp.name || ''; $('#p-tick').hidden = !sp.is_verified;
    paintBio(sp.bio);
    $('#btn-share-profile').addEventListener('click', () => shareProfile(uid, sp.name));
    const { data } = await SB.db.rpc('profile_stats', { p_user: uid });
    const s = (data && data[0]) || {};
    $('#s-followers').textContent = s.followers || 0;
    $('#s-rating').textContent = Number(sp.rating_avg || s.rating_avg || 0).toFixed(1) + ' (' + (s.rating_count || sp.rating_count || 0) + ')';
    const links = [];
    const safe = u => { try { const x = new URL(u); return x.protocol === 'https:' ? x.toString() : null; } catch { return null; } };
    if (sp.phone && sp.show_phone) {
      const d = sp.phone.replace(/\D/g, '');
      links.push(el('a', { href: 'tel:' + sp.phone.replace(/[^\d+]/g, ''), text: '📞 ' + sp.phone }));
      links.push(el('a', { href: 'https://wa.me/' + (d.startsWith('0') ? '213' + d.slice(1) : d), target: '_blank', rel: 'noopener noreferrer', text: 'WhatsApp' }));
    }
    [['facebook', 'Facebook'], ['instagram', 'Instagram'], ['tiktok', 'TikTok'], ['telegram', 'Telegram'], ['maps_url', 'Maps']].forEach(([k, n]) => { const u = sp[k] && safe(sp[k]); if (u) links.push(el('a', { href: u, target: '_blank', rel: 'noopener noreferrer', text: n })); });
    if (links.length) { $('#public-links').append(...links); $('#public-links').hidden = false; }

    // زر المتابعة
    if (Auth.isLogged() && Auth.uid() !== uid) {
      const { data: existingFollow } = await SB.db.from('follows').select('follower_id').eq('follower_id', Auth.uid()).eq('following_id', uid).maybeSingle();
      let isFollowing = !!existingFollow;
      const btnFollow = el('button', { class: 'btn btn--primary', type: 'button' });
      const updateBtn = () => { btnFollow.textContent = isFollowing ? t('profile.unfollow') : t('profile.follow'); };
      updateBtn();
      btnFollow.addEventListener('click', async () => {
        UI.setLoading(btnFollow, true);
        if (isFollowing) {
          await SB.db.from('follows').delete().eq('follower_id', Auth.uid()).eq('following_id', uid);
          isFollowing = false;
          $('#s-followers').textContent = Math.max(0, Number($('#s-followers').textContent) - 1);
        } else {
          await SB.db.from('follows').insert({ follower_id: Auth.uid(), following_id: uid });
          isFollowing = true;
          $('#s-followers').textContent = Number($('#s-followers').textContent) + 1;
        }
        updateBtn();
        UI.setLoading(btnFollow, false);
      });
      btnFollow.style.display = 'block';
      btnFollow.style.margin = '12px auto 0';
      $('.profile-stats').after(btnFollow);
    }

    await Promise.all([Categories.load(), Geo.load()]);
    const grid = $('#grid'); $('#user-ads').hidden = false; grid.replaceChildren(UI.skeletonCards(4));
    const { data: ads, error } = await SB.db.from('ads_feed').select(Ads.LIST_COLS).eq('user_id', uid).eq('status', 'active').order('created_at', { ascending: false }).limit(40);
    grid.replaceChildren();
    $('#s-ads').textContent = (ads || []).length;
    if (error || !(ads || []).length) return UI.emptyState(grid, 'ad.no_ads', 'empty.sub');
    Cards.renderList(grid, ads); Likes.paint(grid);
  }

  P.profile = async function () {
    const uParam = Utils.qs('u');
    if (uParam && /^[0-9a-f-]{36}$/i.test(uParam)) {
      const st0 = await App.boot();
      if (!st0) return;
      if (!Auth.isLogged() || Auth.uid() !== uParam) return publicProfile(uParam);
    }
    const st = uParam ? await Auth.ready() : await App.boot({ guard: true });
    if (!st) return;
    const p = st.profile;
    $('#p-avatar').src = Utils.imgUrl(p.avatar_url || 'assets/images/avatar.svg', 'medium');
    $('#p-avatar').addEventListener('error', e => { e.target.src = 'assets/images/avatar.svg'; }, { once: true });
    $('#p-name').textContent = p.name || '';
    $('#p-tick').hidden = !p.is_verified;
    paintBio(p.bio);
    $('#btn-share-profile').addEventListener('click', () => shareProfile(p.id, p.name));
    const { data } = await SB.db.rpc('profile_stats', { p_user: p.id });
    const s = (data && data[0]) || {};
    $('#s-followers').textContent = s.followers || 0;
    $('#s-ads').textContent = s.ads_count || 0;
    $('#s-rating').textContent = Number(s.rating_avg || 0).toFixed(1) + ' (' + (s.rating_count || 0) + ')';
    $('#verify-label').textContent = p.is_verified ? t('profile.verified') : t('profile.verify');

    const sub = $('#ads-sub'); $('#btn-ads').addEventListener('click', () => { sub.hidden = !sub.hidden; });
    $('#btn-upgrade').addEventListener('click', () => {
      const ov = el('div', { class: 'modal-overlay' }), box = el('div', { class: 'modal' });
      const C = window.CONFIG.SUPPORT;
      box.append(el('p', { text: t('profile.upgrade_text') }), el('div', { class: 'contact-links' }, [
        C.WHATSAPP ? el('a', { href: 'https://wa.me/' + encodeURIComponent(C.WHATSAPP), target: '_blank', rel: 'noopener noreferrer', text: 'WhatsApp' }) : null,
        C.TELEGRAM ? el('a', { href: 'https://t.me/' + encodeURIComponent(C.TELEGRAM), target: '_blank', rel: 'noopener noreferrer', text: 'Telegram' }) : null
      ]), el('div', { class: 'modal__row' }, [el('button', { class: 'btn btn--ghost', type: 'button', onclick: () => ov.remove() }, t('common.close'))]));
      ov.append(box); ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); }); document.body.append(ov);
    });
    $('#btn-logout').addEventListener('click', () => Auth.signOut());
  };

  /* ---------- تعديل المعلومات ---------- */
  P['edit-profile'] = async function () {
    const st = await App.boot({ guard: true });
    if (!st) return;
    const p = st.profile;
    const f = { name: $('#name'), gender: $('#gender'), year: $('#year'), w: $('#wilaya'), d: $('#daira'), c: $('#commune'), avatar: $('#avatar-file'), show: $('#show-phone'), phone: $('#phone') };
    // نبذة (حتى 100 كلمة)
    const bio = $('#bio'), bioCount = $('#bio-count');
    bio.maxLength = L.BIO_CHARS; bio.value = p.bio || '';
    const paintCount = () => { const n = wordCount(bio.value); bioCount.textContent = n + ' / ' + L.BIO_WORDS; bioCount.style.color = n > L.BIO_WORDS ? 'var(--danger)' : ''; };
    bio.addEventListener('input', paintCount); paintCount();
    // أسعار التوصيل لكل ولاية (تُحفظ في الحساب وتظهر تلقائيًا في كل إعلاناتك)
    const paintDeliv = () => { const n = Delivery.count(p.delivery_prices); $('#delivery-sum').textContent = n ? t('delivery.configured').replace('{n}', n) : t('delivery.none_configured'); };
    paintDeliv();
    $('#btn-delivery').addEventListener('click', () => Delivery.openEditor(p.delivery_prices, pr => { p.delivery_prices = pr; paintDeliv(); }));
    const links = ['facebook', 'instagram', 'tiktok', 'telegram'].map(k => ({ k, i: $('#l-' + k) }));
    const maps = $('#l-maps');
    f.name.value = p.name || ''; f.name.maxLength = L.NAME; f.gender.value = p.gender || '';
    fillYears(f.year, p.birth_year);
    await Geo.bindCascade(f.w, f.d, f.c, p);
    links.forEach(x => { x.i.value = p[x.k] || ''; x.i.maxLength = 300; }); maps.value = p.maps_url || ''; maps.maxLength = 300;
    f.phone.value = p.phone || ''; f.phone.maxLength = 16; f.phone.disabled = !!p.is_verified;
    f.show.checked = !!p.show_phone;
    $('#avatar-prev').src = Utils.imgUrl(p.avatar_url || 'assets/images/avatar.svg', 'thumb');

    let newAvatar = null;
    let _avatarBlocked = false;   // true إن كانت الصورة UNSAFE
    let _avatarToken = 0;         // لمنع سباق النتائج القديمة
    let _avatarPromise = null;    // ← جديد: Promise الفحص الجاري (يمنع تجاوز الفحص عند الحفظ السريع)

    f.avatar.addEventListener('change', async () => {
      const file = f.avatar.files[0];
      const v = await Upload.validate(file);
      if (!v.ok) { f.avatar.value = ''; return UI.toastKey(v.error, 'error'); }
      // ابدأ جلسة جديدة: أي نتيجة قديمة ستُتجاهل
      const myToken = ++_avatarToken;
      newAvatar = file; _avatarBlocked = false;
      $('#avatar-prev').src = URL.createObjectURL(file);

      /* فحص في الخلفية فور الاختيار */
      UI.toastKey('ad.images_reviewing', 'info', 3000);
      const { promise } = Upload.startModeration([file], (i, f2, res) => {
        if (myToken !== _avatarToken) return;   // تجاهل نتيجة جلسة قديمة
        if (!res.ok) {
          _avatarBlocked = res.verdict === 'UNSAFE';
          Upload.showModerationWarning(
            f2.name, res.verdict, res.reasons,
            () => { if (myToken === _avatarToken) _avatarBlocked = false; },   // متابعة
            () => {
              if (myToken !== _avatarToken) return;
              newAvatar = null; _avatarBlocked = false;
              f.avatar.value = '';
              $('#avatar-prev').src = p.avatar_url || 'assets/images/avatar.svg';
            }
          );
        }
      });
      // ← نحفظ الـ promise حتى يستطيع زر الحفظ انتظاره
      _avatarPromise = promise.catch(() => { if (myToken === _avatarToken) _avatarBlocked = false; /* fail-open */ });
    });

    $('#form-edit').addEventListener('submit', async e => {
      e.preventDefault();
      const btn = $('#btn-save'); UI.setLoading(btn, true);
      try {
        const name = Sanitize.validateText(f.name.value, { max: L.NAME, min: 2 });
        if (!name.ok) return UI.toastKey(name.error, 'error');
        if (!Auth.validateBirthYear(f.year.value)) return UI.toastKey('err.age_min', 'error');
        const g = Geo.values(f.w, f.d, f.c);
        if (!g.wilaya_id || !g.daira_id || !g.commune_id) return UI.toastKey('err.location_required', 'error');
        const rawPhone = Sanitize.toLatinDigits(f.phone.value).replace(/[\s.\-()]/g, '');
        if (!p.is_verified && rawPhone && !/^(?:\+213|0)[567]\d{8}$/.test(rawPhone)) return UI.toastKey('verify.bad_phone', 'error');
        const phoneNow = p.is_verified ? p.phone : (rawPhone || null);
        const bioV = Sanitize.validateText(bio.value, { max: L.BIO_CHARS, min: 0 });
        if (!bioV.ok) { $('#bio-err').textContent = t(bioV.error); return UI.toastKey(bioV.error, 'error'); }
        if (wordCount(bioV.value) > L.BIO_WORDS) { $('#bio-err').textContent = t('profile.bio_too_long'); return UI.toastKey('profile.bio_too_long', 'error'); }
        $('#bio-err').textContent = '';
        const patch = { bio: bioV.value || null, name: name.value, gender: f.gender.value, birth_year: Number(f.year.value), show_phone: f.show.checked && !!phoneNow };
        if (!p.is_verified) patch.phone = phoneNow;
        Object.assign(patch, g);
        for (const x of links) { const v = Sanitize.validateUrl(x.i.value, x.k); if (!v.ok) { showErr(x.i, v.error); return UI.toastKey(v.error, 'error'); } showErr(x.i, null); patch[x.k] = v.value || null; }
        const m = Sanitize.validateUrl(maps.value, 'maps'); if (!m.ok) return UI.toastKey(m.error, 'error'); patch.maps_url = m.value || null;
        if (newAvatar) {
          /* ← انتظر انتهاء الفحص إن كان لا يزال جاريًا */
          if (_avatarPromise) {
            UI.toastKey('ad.waiting_moderation', 'info', 0);
            try { await _avatarPromise; } catch { /* fail-open */ }
          }
          if (_avatarBlocked) { UI.toastKey('ad.blocked_images_exist', 'error'); return; }
          const blobs = await Upload.compress(newAvatar); const path = `${Auth.uid()}/avatar.webp`;
          const up = await SB.db.storage.from('avatars').upload(path, blobs.medium, { contentType: blobs.medium.type, upsert: true });
          if (up.error) throw up.error; patch.avatar_url = SB.db.storage.from('avatars').getPublicUrl(path).data.publicUrl + '?v=' + Date.now();
        }
        let { error } = await SB.db.from('users').update(patch).eq('id', Auth.uid());
        // إن لم يكن عمود bio موجودًا بعد في قاعدة البيانات: نحفظ بقية البيانات ونُنبّه بدل أن يفشل الحفظ كله
        if (error && /bio|column|schema cache/i.test(String(error.message || ''))) {
          const { bio: _omit, ...rest } = patch;
          ({ error } = await SB.db.from('users').update(rest).eq('id', Auth.uid()));
          if (!error) UI.toastKey('edit.bio_unavailable', 'info', 4500);
        }
        if (error) throw error;
        UI.toastKey('edit.saved', 'success'); setTimeout(() => Utils.go(R.PROFILE), 700);
      } catch (err) { console.error('[Edit]', err); UI.toastKey(UI.errKey(err), 'error'); }
      finally { UI.setLoading(btn, false); }
    });
  };
})();