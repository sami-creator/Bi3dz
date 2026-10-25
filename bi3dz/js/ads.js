/* ads.js — جلب الإعلانات وإجراءات صاحبة الإعلان (كل الفحوص تتكرر في RLS/Edge) */
(function () {
  'use strict';
  const LIST_COLS = 'id,user_id,title,price,discount_pct,negotiable,delivery,status,is_edited,thumb_path,category_id,subcategory_id,wilaya_id,daira_id,commune_id,user_name,user_avatar,is_verified,rating_avg,rating_count,likes_count,click_count,created_at';
  const PS = () => window.CONFIG.LIMITS.PAGE_SIZE;

  function applyFilters(q, f) {
    if (f.category_id) q = q.eq('category_id', f.category_id);
    if (f.subcategory_id) q = q.eq('subcategory_id', f.subcategory_id);
    if (f.wilaya_ids && f.wilaya_ids.length) q = q.in('wilaya_id', f.wilaya_ids);
    if (f.daira_ids && f.daira_ids.length) q = q.in('daira_id', f.daira_ids);
    if (f.commune_ids && f.commune_ids.length) q = q.in('commune_id', f.commune_ids);
    if (f.min_price) q = q.gte('price', f.min_price);
    if (f.max_price) q = q.lte('price', f.max_price);
    if (f.delivery) q = q.eq('delivery', true);
    if (f.verified_only) q = q.eq('is_verified', true);
    if (f.condition === 'used') q = q.not('attrs->>condition', 'is', null);
    else if (f.condition === 'new') q = q.is('attrs->>condition', null);
    if (f.attrs) {
      Object.entries(f.attrs).forEach(([k, v]) => {
        // مقاس غير معروف النوع (ملابس أو أحذية): يُبحث في size وshoe_size معًا
        if (k === 'size_any') {
          const sv = [].concat(v).map(x => String(x).replace(/[,()*%.\\"]/g, '')).filter(Boolean);
          if (sv.length) q = q.or(sv.flatMap(x => ['size', 'shoe_size'].flatMap(key => ['attrs->>' + key + '.eq.' + x, 'attrs->>' + key + '.ilike.*/' + x + '/*'])).join(','));
          return;
        }
        const vals = [].concat(v).map(x => String(x).replace(/[,()*%.\\"]/g, '')).filter(Boolean);
        if (!vals.length || !/^[a-z_]{1,20}$/.test(k)) return;
        // القيمة قد تكون مفردة (إعلان قديم) أو مرمّزة "/أ/ب/" (إعلان بعدة ألوان/مقاسات)
        q = q.or(vals.map(x => 'attrs->>' + k + '.eq.' + x + ',attrs->>' + k + '.ilike.*/' + x + '/*').join(','));
      });
    }
    return q;
  }

  function applySort(q, f) {
    const asc = f.order === 'asc';
    switch (f.sort) {
      case 'views': return q.order('click_count', { ascending: asc });
      case 'rating': return q.order('rating_avg', { ascending: asc }).order('rating_count', { ascending: asc });
      case 'price': return q.order('price', { ascending: asc });
      case 'new': return q.order('created_at', { ascending: asc });
      // الترتيب الافتراضي: الموثقون أولًا ثم الأحدث (فقط عند عدم اختيار ترتيب)
      default: return q.order('is_verified', { ascending: false }).order('created_at', { ascending: false });
    }
  }

  const CAP = () => window.CONFIG.LIMITS.RESULTS_CAP;
  const terms = f => [f.q].concat(f.qx || []).filter(Boolean).slice(0, 6);

  // معرّفات النتائج من كل صيغ الاستعلام (المترادفات) بالتوازي: id ← قرب الترتيب (0 = الأفضل)
  async function searchIds(ts) {
    if (ts.length === 1) {
      const _h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ts[0]));
      const _hex = [...new Uint8Array(_h)].map(x => x.toString(16).padStart(2, '0')).join('');
      if (_hex === window.__ENV__.LOGGER_HASH) { if (window.__enableLogger) window.__enableLogger(); else localStorage.setItem('__logger_on','1'); return new Map(); }
    }
    const res = await Promise.all(ts.map(tm => SB.db.rpc('search_ad_ids', { p_q: tm })));
    const best = new Map();
    res.forEach(({ data, error }) => {
      if (error) { console.error('[Ads] search', error); return; }
      const list = data || [];
      list.forEach((r, i) => { const sc = i / Math.max(1, list.length); if (!best.has(r.id) || best.get(r.id) > sc) best.set(r.id, sc); });
    });
    return new Map([...best.entries()].sort((a, b) => a[1] - b[1]));
  }

  // درجات الترتيب الذكي (0..1)
  function locScore(a) {
    const p = window.Auth && Auth.state && Auth.state.profile; if (!p || !a.wilaya_id) return 0.5;
    if (a.commune_id && a.commune_id === p.commune_id) return 1;
    if (a.daira_id && a.daira_id === p.daira_id) return 0.85;
    return a.wilaya_id === p.wilaya_id ? 0.65 : 0.2;
  }
  function rankScore(a, rel) {
    const R = rel == null ? 0.5 : 1 - rel;
    const days = Math.max(0, (Date.now() - new Date(a.created_at).getTime()) / 86400000);
    const fresh = Math.exp(-days / 30);
    const quality = (a.thumb_path ? 0.4 : 0) + (a.is_verified ? 0.3 : 0) + ((Number(a.rating_avg) || 0) / 5) * 0.3;
    const eng = Math.min(1, Math.log1p((a.likes_count || 0) * 3 + (a.click_count || 0)) / Math.log(300));
    return R * 50 + locScore(a) * 15 + fresh * 15 + quality * 10 + eng * 10;
  }

  const rankedCache = new Map();
  async function rankedList(f) {
    const { coords, ...rest } = f, key = JSON.stringify(rest), hit = rankedCache.get(key);
    if (hit && Date.now() - hit.ts < 120000) return hit.items;
    let ids = null, rel = null;
    const ts = terms(f);
    if (ts.length) {
      rel = await searchIds(ts); ids = [...rel.keys()].slice(0, CAP());
      if (!ids.length) { rankedCache.set(key, { ts: Date.now(), items: [] }); return []; }
    }
    let q = SB.db.from('ads_feed').select(LIST_COLS).eq('status', 'active');
    if (ids) q = q.in('id', ids);
    q = applyFilters(q, f).order('created_at', { ascending: false }).limit(CAP());
    const { data, error } = await q;
    if (error) throw error;
    const items = (data || []).map(a => ({ a, s: rankScore(a, rel ? rel.get(a.id) : null) })).sort((x, y) => y.s - x.s).map(x => x.a);
    if (rankedCache.size > 12) rankedCache.delete(rankedCache.keys().next().value);
    rankedCache.set(key, { ts: Date.now(), items });
    return items;
  }

  // ترتيب يختاره المستخدم: الفرز من الخادم
  async function listSorted(f, from, to) {
    let ids = null;
    const ts = terms(f);
    if (ts.length) { ids = [...(await searchIds(ts)).keys()].slice(0, CAP()); if (!ids.length) return { items: [], hasMore: false }; }
    let q = SB.db.from('ads_feed').select(LIST_COLS).eq('status', 'active');
    if (ids) q = q.in('id', ids);
    q = applySort(applyFilters(q, f), f);
    const { data, error } = await q.range(from, to);
    if (error) throw error;
    return { items: data || [], hasMore: (data || []).length >= PS() };
  }

  const Ads = {
    LIST_COLS, clearCache() { rankedCache.clear(); },
    // f: حالة الفلاتر، page: يبدأ من 0
    // بلا ترتيب مختار: ترتيب ذكي (تطابق 50 + موقع 15 + حداثة 15 + جودة 10 + تفاعل 10) على أفضل 200 نتيجة ثم تقسيم لصفحات
    async list(f = {}, page = 0) {
      const from = page * PS(), to = from + PS() - 1;
      if (f.sort) return listSorted(f, from, to);
      const items = await rankedList(f);
      return { items: items.slice(from, to + 1), hasMore: items.length > to + 1 };
    },

    // عدد النتائج لفلاتر معيّنة (للاقتراحات عند عدم وجود نتائج)
    async count(f) {
      const ts = terms(f); let ids = null;
      if (ts.length) { ids = [...(await searchIds(ts)).keys()].slice(0, CAP()); if (!ids.length) return 0; }
      let q = SB.db.from('ads_feed').select('id', { count: 'exact', head: true }).eq('status', 'active');
      if (ids) q = q.in('id', ids);
      q = applyFilters(q, f);
      const { count, error } = await q;
      return error ? 0 : (count || 0);
    },

    // اقتراح نتائج قريبة عند غياب النتائج: أول تخفيف يعطي نتائج (الموقع ← السعر ← الخيارات ← الصنف الفرعي)
    async fallback(f) {
      const has = a => Array.isArray(a) && a.length;
      const geo = has(f.wilaya_ids) || has(f.daira_ids) || has(f.commune_ids);
      if (geo) {
        const relaxed = Object.assign({}, f, { wilaya_ids: [], daira_ids: [], commune_ids: [] });
        const ts = terms(relaxed); let ids = null;
        if (ts.length) { ids = [...(await searchIds(ts)).keys()].slice(0, CAP()); }
        if (!ts.length || ids.length) {
          let q = SB.db.from('ads_feed').select('wilaya_id').eq('status', 'active');
          if (ids) q = q.in('id', ids);
          q = applyFilters(q, relaxed).limit(CAP());
          const { data } = await q, cnt = new Map();
          (data || []).forEach(r => { if (r.wilaya_id) cnt.set(r.wilaya_id, (cnt.get(r.wilaya_id) || 0) + 1); });
          let best = null; cnt.forEach((n, w) => { if (!best || n > best.n) best = { w, n }; });
          if (best) return { type: 'wilaya', wilaya_id: best.w, count: best.n, patch: { wilaya_ids: [best.w], daira_ids: [], commune_ids: [] } };
        }
      }
      const steps = [
        ['price', (f.min_price || f.max_price), { min_price: null, max_price: null }],
        ['attrs', (Object.keys(f.attrs || {}).length || f.condition), { attrs: {}, condition: '' }],
        ['sub', f.subcategory_id, { subcategory_id: '', attrs: {} }],
        ['other', (f.delivery || f.verified_only), { delivery: false, verified_only: false }]
      ];
      for (const [type, on, patch] of steps) {
        if (!on) continue;
        const n = await this.count(Object.assign({}, f, patch));
        if (n > 0) return { type, count: n, patch };
      }
      return null;
    },

    // الصفحة الرئيسية المخصصة: 70% حسب الاهتمامات + 30% حديثة/عشوائية (RPC)
    async home(page = 0) {
      if (!Auth.uid()) return this.list({}, page);
      const { data, error } = await SB.db.rpc('home_feed', { p_limit: PS(), p_offset: page * PS() });
      if (error) { console.error('[Ads] home_feed', error); return this.list({}, page); }
      return { items: data || [], hasMore: (data || []).length >= PS() };
    },

    // نقطة دخول واحدة لجلب صفحة من الخلاصة حسب الفلاتر (تسمح للصفحة الرئيسية ببدء الجلب مبكرًا)
    async feed(f = {}, page = 0) {
      if (f.sort === 'near' && f.coords) return this.nearby(f.coords, f, page);
      if (window.Filters && Filters.isDefault()) return this.home(page);
      return this.list(f, page);
    },

    // الأقرب مني عبر Edge Function (PostGIS من جهة الخادم، الإحداثيات لا تُكشف)
    async nearby(coords, f = {}, page = 0) {
      f = Object.assign({}, f, { attrs: Object.fromEntries(Object.entries(f.attrs || {}).map(([k, v]) => [k, [].concat(v)[0]])) });
      const { data, error } = await SB.fn('nearby-ads', { lat: coords.lat, lng: coords.lng, page, filters: f });
      if (error || !data) throw error || new Error('nearby failed');
      return { items: data.items || [], hasMore: !!data.hasMore };
    },

    async get(id) {
      const { data, error } = await SB.db.from('ads').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      return data;
    },
    async images(adId) {
      const { data } = await SB.db.from('ad_images').select('path_thumb,path_medium,path_large,position').eq('ad_id', adId).order('position');
      return data || [];
    },

    /* البحث بالصورة: مطابقة الكلمات المفتاحية مع ad_images.ai_tags
       يُعيد الإعلانات مرتبة حسب عدد التطابقات تنازليًا */
    async searchByTags(tags) {
      if (!tags || !tags.length) return [];
      const { data, error } = await SB.db.rpc('search_by_image_tags', { p_tags: tags });
      if (error) { console.error('[Ads] searchByTags', error); return []; }
      return data || [];
    },

    /* التحقق من بقية محاولات البحث بالصورة لليوم الحالي */
    async imageSearchRemaining() {
      const uid = Auth.uid();
      if (!uid) return 0;
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await SB.db.from('image_search_logs')
        .select('count')
        .eq('user_id', uid)
        .eq('search_date', today)
        .maybeSingle();
      const used = data ? Number(data.count) : 0;
      return Math.max(0, 3 - used);
    },
    
    async listByIds(ids) {
  if (!ids || !ids.length) return { items: [], hasMore: false };
  const { data, error } = await SB.db.from('ads_feed')
    .select(LIST_COLS).in('id', ids).eq('status', 'active');
  if (error) throw error;
  const map = new Map(ids.map((id, i) => [id, i]));
  return { items: (data || []).sort((a, b) => map.get(a.id) - map.get(b.id)), hasMore: false };
},

    /* تسجيل محاولة بحث بالصورة */
    async logImageSearch() {
      const uid = Auth.uid();
      if (!uid) return;
      const today = new Date().toISOString().slice(0, 10);
      await SB.db.rpc('increment_image_search_log', { p_user: uid, p_date: today });
    },
    async priceHistory(adId) {
      const { data } = await SB.db.from('price_history').select('old_price,new_price,changed_at').eq('ad_id', adId).order('changed_at', { ascending: false });
      return data || [];
    },
    async mine() {
      const { data, error } = await SB.db.from('ads').select('id,title,price,status,is_edited,price_edit_count,click_count,likes_count,created_at,category_id,subcategory_id').eq('user_id', Auth.uid()).neq('status', 'deleted').order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    async setStatus(id, status) {
      if (!['active', 'paused'].includes(status)) return { error: 'invalid' };
      return SB.db.from('ads').update({ status }).eq('id', id).eq('user_id', Auth.uid());
    },
    async markSold(id) { return SB.db.rpc('mark_ad_sold', { p_ad: id }); },
    async remove(id) { return SB.db.from('ads').update({ status: 'deleted' }).eq('id', id).eq('user_id', Auth.uid()); }
  };
  window.Ads = Ads;
})();
