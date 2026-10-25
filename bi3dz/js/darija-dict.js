/* darija-dict.js — قاموس الدارجة (ألوان/أشياء/أسعار/أماكن) + محلل جملة البحث محليًا (فوري، بلا شبكة) */
(function () {
  'use strict';
  const AR_D = '٠١٢٣٤٥٦٧٨٩', FA_D = '۰۱۲۳۴۵۶۷۸۹';

  // توحيد الكتابة: أرقام لاتينية، إزالة التشكيل، توحيد الهمزات والتاء المربوطة والألف المقصورة، إزالة لواحق اللاتينية
  function norm(s) {
    return String(s == null ? '' : s).toLowerCase()
      .replace(/[٠-٩۰-۹]/g, c => { const i = AR_D.indexOf(c); return i > -1 ? i : FA_D.indexOf(c); })
      .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
      .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
      .replace(/[éèêë]/g, 'e').replace(/[àâä]/g, 'a').replace(/[îï]/g, 'i').replace(/[ôö]/g, 'o').replace(/[ùûü]/g, 'u').replace(/ç/g, 'c')
      .replace(/[^a-z0-9\u0621-\u064A\s]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  const words = s => s.split(/\s+/).filter(Boolean);

  // ===== الألوان (الاسم الرسمي = نفس قيم الأصناف في categories.json) =====
  const COLORS = {
    'أسود': 'اسود سوداء سود نوار نواغ نوير نوارة كحل كحلة كحلا كحلاء noir noire noirs noires black',
    'أبيض': 'ابيض بيضاء بيضا بيض بلانش blanc blanche blancs white',
    'أحمر': 'احمر حمراء حمرا حمر حمره روج rouge rouges red',
    'وردي': 'وردي وردية ورديه روز rose pink',
    'ذهبي': 'ذهبي ذهبية دهبي دوري dore doree gold golden',
    'أزرق': 'ازرق زرقاء زرقا زرق بلو bleu blue',
    'أخضر': 'اخضر خضراء خضرا خضر فيرت vert verte green',
    'بيج': 'بيج beige',
    'فضي': 'فضي فضية argent argente silver',
    'بنفسجي': 'بنفسجي بنفسجية موف mauve violet violette purple',
    'برتقالي': 'برتقالي برتقالية اورنج orange',
    'أصفر': 'اصفر صفراء صفرا صفر جون jaune yellow',
    'بني': 'بني مارون ماروني marron brown',
    'رمادي': 'رمادي غري gris grise grey gray',
    'كحلي': 'كحلي navy',
    'تركوازي': 'تركوازي تركواز turquoise',
    'عنابي': 'عنابي عنابى bordeaux grenat',
    'سماوي': 'سماوي سيال ciel',
    'كاكي': 'كاكي kaki khaki'
  };

  // ===== الأشياء: [كلمات متكافئة بالعربية/الدارجة/الفرنسية/الإنجليزية، الصنف الفرعي، الصنف الرئيسي] =====
  // الكلمة الأولى في المجموعة تُستعمل كصيغة أساسية للاقتراحات
  const ITEMS = [
    ['روبة robe فستان dress روب روبات robes dresses فساتين', 'dress', 'clothes_evening'],
    ['قندورة gandoura قندورا gandora قنادر', 'gandoura_thakila', 'clothes_wedding'],
    ['كراكو karakou كراكوا caracou karako', 'karakou', 'clothes_wedding'],
    ['طالون talon كعب heels طالونات talons كعوب heel', 'heels', 'shoes'],
    ['صباط سباط صبابط سبابط chaussure chaussures sabot حذاء احذية أحذية shoes shoe', '', 'shoes'],
    ['كونفارس converse كونفرس sneakers baskets sneaker basket', 'sneakers', 'shoes'],
    ['قفطان caftan kaftan', 'caftan', 'clothes_wedding'],
    ['تكشيطة takchita tekchita', 'takchita', 'clothes_wedding'],
    ['شدة chedda', 'chedda', 'clothes_wedding'],
    ['عروس عروسة mariee bridal', 'bridal', 'clothes_wedding'],
    ['عباية abaya', 'abaya', 'clothes_work'],
    ['جبادور jabador', 'jabador', 'clothes_wedding'],
    ['ملحفة melhfa', 'melhfa', 'clothes_wedding'],
    ['مايو maillot swimsuit', 'swim', 'clothes_beach'],
    ['بوركيني burkini', 'burkini', 'clothes_beach'],
    ['باروكة perruque wig', 'wig', 'products'],
    ['عطر عطور parfum perfume', 'perfume', 'products'],
    ['مكياج maquillage makeup', 'makeup', 'services'],
    ['حلاقة coiffure haircut', 'haircut', 'services']
  ];

  const UNIT_DA = new Set(['دج', 'دينار', 'دنانير', 'da', 'dzd', 'dinar', 'dinars', 'dh']);
  const UNIT_K = new Set(['الف', 'الاف', 'mille', 'ملف']);
  const UNIT_M = new Set(['مليون', 'ملاين', 'ملايين', 'million', 'millions', 'مليونين']);
  const MAXK = new Set(words('اقل مايفوتش يفوتش مايتعداش يتعداش حتي لحد moins max maximum under below jusqu jusqua'));
  const MINK = new Set(words('اكثر اكتر فوق plus min minimum over above'));
  const APPK = new Set(words('بسعر سعر prix price around environ تقريبا ب'));
  const SIZEK = new Set(words('مقاس مقاسي لاطاي لطاي taille pointure size نمره نمرو رقم numero t'));
  const SIZE_LET = new Set(words('xs s m l xl xxl xxxl'));
  const RANGEK = new Set(words('من بين de entre from'));
  const CONNECT = new Set(words('الي و a et to'));
  const ORK = new Set(words('او ولا ou or'));
  const PLACEK = new Set(words('في fi dans in'));
  const STOP = new Set(words(
    'في ب من الي علي ولا او و مع عند ل ما هل اي اريد ابغي نبغي نحب بغيت عندكم واش كاين كاينه ابحث دور نبحث عن لي ' +
    'je veux cherche un une des de du le la les a en pour et ou avec sur chez dans au aux il est ' +
    'i want the in for and or with looking need to'
  ));
  const RENT = new Set(['كراء', 'للكراء', 'كرا', 'location', 'louer', 'rent', 'rental', 'ايجار', 'للايجار'].map(norm));
  const USED = new Set(['مستعمل', 'مستعملة', 'مستعمله', 'occasion', 'used'].map(norm));
  const NEW = new Set(['جديد', 'جديدة', 'neuf', 'neuve', 'neufs', 'new'].map(norm));
  const DELIV = new Set(['توصيل', 'livraison', 'delivery'].map(norm));

  // ===== فهارس =====
  const COLOR_IDX = new Map();
  Object.entries(COLORS).forEach(([canon, list]) => words(list).forEach(w => COLOR_IDX.set(norm(w), canon)));
  const ITEM_IDX = new Map(), VOCAB = new Map(); // VOCAB: كلمة موحّدة ← الكلمة الأصلية (للتصحيح الإملائي)
  ITEMS.forEach((it, gi) => words(it[0]).forEach(w => { ITEM_IDX.set(norm(w), gi); VOCAB.set(norm(w), { raw: w, gi }); }));
  COLOR_IDX.forEach((canon, k) => { if (!VOCAB.has(k)) VOCAB.set(k, { raw: k, color: canon }); });

  // مسافة التعديل (Levenshtein) مع قطع مبكر
  function lev(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i]; let rowMin = i;
      for (let j = 1; j <= b.length; j++) {
        const v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        cur.push(v); if (v < rowMin) rowMin = v;
      }
      if (rowMin > max) return max + 1;
      prev = cur;
    }
    return prev[b.length];
  }
  function fuzzy(n) {
    if (n.length < 4) return null;
    const max = n.length >= 8 ? 2 : 1;
    let best = null, bd = max + 1;
    VOCAB.forEach((v, k) => { if (k.length < 4) return; const d = lev(n, k, max); if (d < bd) { bd = d; best = v; } });
    return best;
  }

  // ===== الولايات والبلديات (تُبنى عند أول استعمال بعد تحميل Geo) =====
  let WIL = null, COM = null;
  const stripAl = s => (s.startsWith('ال') && s.length > 4 ? s.slice(2) : s);
  function buildGeo() {
    if (WIL) return;
    const G = window.Geo;
    if (!G || !G.wilayas().length) return;        // لم تُحمَّل بيانات الأماكن بعد: نعيد المحاولة في الاستدعاء التالي
    WIL = new Map(); COM = new Map();
    G.wilayas().forEach(w => ['ar', 'fr', 'en'].forEach(l => {
      if (!w[l]) return; const n = norm(w[l]); if (!n) return;
      WIL.set(n, w.id); WIL.set(stripAl(n), w.id);
    }));
    [['الجزائر', 16], ['العاصمه', 16], ['alger', 16], ['algiers', 16]].forEach(([k, id]) => { if (!WIL.has(k)) WIL.set(k, id); });
    G.communes().forEach(c => ['ar', 'fr'].forEach(l => {
      if (!c[l]) return; const n = norm(c[l]); if (!n) return;
      COM.set(n, c); COM.set(stripAl(n), c);
    }));
  }
  // يجرّب 3 ثم 2 ثم 1 كلمة، مع إزالة بادئة ب/ل الملتصقة (بعنابة، لعنابة)
  function matchPlace(toks, i) {
    for (let len = Math.min(3, toks.length - i); len >= 1; len--) {
      const g = toks.slice(i, i + len).map(t => t.n).join(' ');
      const cands = [g];
      if (/^[بل]/.test(g) && g.length > 4) cands.push(g.slice(1));
      for (const c of cands) {
        if (c.length < 3) continue;
        if (WIL.has(c)) return { type: 'w', id: WIL.get(c), len };
        if (COM.has(c)) return { type: 'c', c: COM.get(c), len };
      }
    }
    return null;
  }

  // ===== المحلل =====
  function prep(text) {
    return String(text == null ? '' : text).toLowerCase()
      .replace(/[٠-٩۰-۹]/g, c => { const i = AR_D.indexOf(c); return i > -1 ? i : FA_D.indexOf(c); })
      .replace(/(\d)[.,](\d{3})(?!\d)/g, '$1$2')
      .replace(/3\s?xl/g, 'xxxl')
      .replace(/['’`´\-_]/g, ' ')
      .replace(/[،؛؟?!.,:;()\[\]{}"«»\/\\|+*=<>~#@]/g, ' ')
      .replace(/(\d)([^\d\s])/g, '$1 $2').replace(/([^\d\s])(\d)/g, '$1 $2')
      .replace(/\s+/g, ' ').trim();
  }

  function parse(text) {
    buildGeo();
    const raw = prep(text);
    const toks = raw ? raw.split(' ').map(w => ({ w, n: norm(w) })).filter(t => t.n) : [];
    const out = {
      colors: [], size: null, min: null, max: null, approx: null, wilayaIds: [], communeIds: [],
      rent: false, condition: '', delivery: false, hint: null, recognized: false, leftover: 0,
      segments: [], tokens: toks.length
    };
    let mode = null, modeAt = -9, seg = [], unknownPlace = 0;
    const segs = [];

    const amountAt = idx => {
      const t = toks[idx]; if (!t) return null;
      if (/^\d+$/.test(t.n)) {
        const num = Number(t.n), nx = toks[idx + 1] ? toks[idx + 1].n : '';
        if (UNIT_DA.has(nx)) return { num, unit: 'da', val: num, next: idx + 2 };
        if (UNIT_K.has(nx)) return { num, unit: 'k', val: num * 10, next: idx + 2 };
        if (UNIT_M.has(nx)) return { num, unit: 'm', val: num * 10000 * (nx === 'مليونين' ? 2 : 1), next: idx + 2 };
        return { num, unit: null, val: num, next: idx + 1 };
      }
      if (UNIT_M.has(t.n)) return { num: 1, unit: 'm', val: 10000 * (t.n === 'مليونين' ? 2 : 1), next: idx + 1 };
      return null;
    };
    const isColor = n => COLOR_IDX.has(n) || (n.length >= 4 && (() => { const f = fuzzy(n); return !!(f && f.color); })());

    for (let i = 0; i < toks.length; i++) {
      const { w, n } = toks[i];

      // مجال سعر: من X إلى Y
      if (RANGEK.has(n)) {
        const a1 = amountAt(i + 1);
        if (a1 && toks[a1.next] && CONNECT.has(toks[a1.next].n)) {
          const a2 = amountAt(a1.next + 1);
          if (a2) {
            let v1 = a1.val; if (!a1.unit && a2.unit === 'k') v1 = a1.num * 10; if (!a1.unit && a2.unit === 'm') v1 = a1.num * 10000;
            out.min = Math.min(v1, a2.val); out.max = Math.max(v1, a2.val);
            i = a2.next - 1; continue;
          }
        }
      }

      if (MAXK.has(n)) { mode = 'max'; modeAt = i; continue; }
      if (MINK.has(n)) { mode = 'min'; modeAt = i; continue; }
      if (SIZEK.has(n)) { mode = 'size'; modeAt = i; continue; }
      if (APPK.has(n)) { mode = 'approx'; modeAt = i; if (n === 'ب') continue; continue; }

      const am = amountAt(i);
      if (am) {
        const active = mode && i - modeAt <= 3;
        if (active && mode === 'size' && !am.unit) out.size = String(am.num);
        else if (active && mode === 'max') out.max = am.val;
        else if (active && mode === 'min') out.min = am.val;
        else if (active && mode === 'approx') out.approx = am.val;
        else if (am.unit) out.approx = am.val;
        else if (am.num >= 30 && am.num <= 60) out.size = String(am.num);
        else if (am.num >= 500 && !(am.num >= 1990 && am.num <= 2100)) out.approx = am.val;
        else seg.push({ w, n });
        if (active) mode = null;
        i = am.next - 1; continue;
      }

      if (mode === 'size' && SIZE_LET.has(n) && i - modeAt <= 2) { out.size = n === 'xxxl' ? '3XL' : n.toUpperCase(); mode = null; continue; }
      if (SIZE_LET.has(n) && n.length >= 2 && n !== 'xs' + 'x') { // XL/XXL/XXXL/XS وحدها
        if (['xl', 'xxl', 'xxxl', 'xs'].includes(n)) { out.size = n === 'xxxl' ? '3XL' : n.toUpperCase(); continue; }
      }

      if (ORK.has(n)) {
        const nx = toks[i + 1];
        if (seg.length && nx && !isColor(nx.n) && !/^\d+$/.test(nx.n)) { segs.push(seg); seg = []; }
        continue;
      }
      if (STOP.has(n)) continue;

      // مكان: ولاية/بلدية
      if (n.length >= 3 && WIL) {
        const pm = matchPlace(toks, i);
        if (pm) {
          if (pm.type === 'w') out.wilayaIds.push(pm.id);
          else {
            out.communeIds.push(pm.c.id);
            const d = window.Geo.daira(pm.c.d); if (d && d.w) out.wilayaIds.push(d.w);
          }
          i += pm.len - 1; continue;
        }
      }

      if (COLOR_IDX.has(n)) { const c = COLOR_IDX.get(n); if (!out.colors.includes(c)) out.colors.push(c); continue; }
      if (RENT.has(n)) { out.rent = true; continue; }
      if (USED.has(n)) { out.condition = 'used'; continue; }
      if (NEW.has(n)) { out.condition = 'new'; continue; }
      if (DELIV.has(n)) { out.delivery = true; continue; }

      if (ITEM_IDX.has(n)) { seg.push({ w, n, gi: ITEM_IDX.get(n) }); continue; }

      // تصحيح إملائي بسيط على قاموس الأشياء والألوان
      const fz = fuzzy(n);
      if (fz) {
        if (fz.color) { if (!out.colors.includes(fz.color)) out.colors.push(fz.color); continue; }
        seg.push({ w: fz.raw, n: norm(fz.raw), gi: fz.gi }); continue;
      }

      // كلمة غير معروفة بعد "في" ← غالبًا مكان لم نتعرف عليه
      if (i > 0 && PLACEK.has(toks[i - 1].n)) { unknownPlace++; continue; }
      seg.push({ w, n });
    }
    if (seg.length) segs.push(seg);

    // حذف الكلمات العامة (حذاء/صباط) إن وُجدت كلمة أدق في نفس المقطع
    segs.forEach(s => {
      const specific = s.some(t => t.gi != null && ITEMS[t.gi][1]);
      const kept = specific ? s.filter(t => !(t.gi != null && !ITEMS[t.gi][1])) : s;
      if (kept.length) out.segments.push(kept);
    });
    const firstItem = out.segments.flat().find(t => t.gi != null);
    if (firstItem) { out.recognized = true; out.hint = { sub: ITEMS[firstItem.gi][1] || '', cat: ITEMS[firstItem.gi][2] || '' }; }
    out.leftover = out.segments.flat().filter(t => t.gi == null).length + unknownPlace;
    out.unknownPlace = unknownPlace;
    if (out.approx) { out.min = Math.round(out.approx * 0.85); out.max = Math.round(out.approx * 1.15); }
    out.wilayaIds = [...new Set(out.wilayaIds)];
    return out;
  }

  // كل صيغ الاستعلام النصي: الأساسية + المترادفات (حد أقصى 4 صيغ إضافية)
  function queryVariants(p) {
    const strs = p.segments.map(s => s.map(t => t.w).join(' '));
    if (!strs.length) return { q: '', qx: [] };
    const extra = [];
    strs.slice(1).forEach(s => extra.push(s));
    const first = p.segments[0];
    first.forEach((t, idx) => {
      if (t.gi == null) return;
      words(ITEMS[t.gi][0]).forEach(alt => {
        if (norm(alt) === t.n) return;
        const copy = first.map(x => x.w); copy[idx] = alt; extra.push(copy.join(' '));
      });
    });
    const uniq = [...new Set(extra)].filter(x => x && x !== strs[0]).slice(0, 5);
    return { q: strs[0], qx: uniq };
  }

  // اقتراحات إكمال تلقائي من القاموس (الكلمات الأساسية فقط)
  function autocomplete(prefix, limit = 4) {
    const p = norm(prefix); if (p.length < 1) return [];
    const last = p.split(' ').pop(); if (!last) return [];
    const head = String(prefix).trim().split(/\s+/).slice(0, -1).join(' ');
    const out = [];
    ITEMS.forEach(it => words(it[0]).slice(0, 3).forEach(w => {
      if (norm(w).startsWith(last) && norm(w) !== last) out.push((head ? head + ' ' : '') + w);
    }));
    return [...new Set(out)].slice(0, limit);
  }

  window.Dict = { norm, parse, queryVariants, autocomplete, lev, items: ITEMS, colors: COLORS };
})();
