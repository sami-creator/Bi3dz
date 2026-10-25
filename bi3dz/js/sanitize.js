/* sanitize.js — تعقيم وفلترة كل مدخلات المستخدم */
(function () {
  'use strict';
  const L = () => window.CONFIG.LIMITS;

  const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩', FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
  function toLatinDigits(s) {
    return String(s ?? '').replace(/[٠-٩۰-۹]/g, ch => {
      const i = AR_DIGITS.indexOf(ch); return i > -1 ? i : FA_DIGITS.indexOf(ch);
    });
  }

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"'`=\/]/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;', '=': '&#61;', '/': '&#47;'
    }[c]));
  }

  // نص عادي: إزالة الوسوم والمحارف الخفية وتحديد الطول
  function cleanText(s, max) {
    let t = String(s ?? '')
      .replace(/<[^>]*>/g, '')
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F​-‏‪-‮⁦-⁩﻿]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    const m = max || L().INPUT_GENERIC;
    return t.length > m ? t.slice(0, m) : t;
  }

  // رقم هاتف جزائري حتى بأشكال مموّهة (0659#088225 ...) أو 9 أرقام فأكثر
  const SEP = '[\\s.\\-_#*/|,()\\u200f\\u200e]*';
  const PHONE_RE = new RegExp('(?:(?:\\+|00)?' + SEP + '213|0)?' + SEP + '[567](?:' + SEP + '\\d){8}');
  const LONG_DIGITS_RE = new RegExp('(?:\\d' + SEP + '){9,}');
  function containsPhone(s) {
    const t = toLatinDigits(s);
    return PHONE_RE.test(t) || LONG_DIGITS_RE.test(t);
  }

  // ─── قائمة الكلمات البذيئة الموسّعة (AR + FR + EN + دارجة) ───────────
  const BAD_WORDS_BASE = [
    // English
    'fuck', 'shit', 'bitch', 'asshole', 'bastard', 'damn', 'cunt', 'dick',
    'pussy', 'whore', 'slut', 'cock', 'prick', 'wanker', 'twat', 'bollocks',
    // French
    'putain', 'merde', 'connard', 'salope', 'nique', 'enculé', 'fils de pute',
    'batard', 'fdp', 'ntm', 'tg', 'va te faire', 'pédé', 'tapette',
    // Arabic MSA + Algerian Darija
    'شرموطة', 'قحبة', 'زبي', 'نيك', 'كلب', 'حمار', 'منيوك', 'زنجي',
    'عاهرة', 'مومس', 'لواط', 'خنزير', 'ولد الكلب', 'ولد الحرام',
    'يلعن', 'لعن', 'زمل', 'زملة', 'تيس', 'حشيش', 'بوز', 'وليد قحبة',
    'كوس', 'بوزي', 'قحبتك', 'نيكها', 'كوسها', 'طيزك', 'طيزها',
    'يتنيك', 'تتنيك', 'نيكك', 'هبل', 'مهبول', 'شاذ',
    // Obfuscated variants
    'f*ck', 'sh*t', 'b*tch', 'fck', 'sht'
  ];

  const BAD_WORDS = (window.__BAD_WORDS__ || []).concat(BAD_WORDS_BASE);

  function normalizeForBad(s) {
    return toLatinDigits(s).toLowerCase()
      .replace(/[ً-ٟـ]/g, '')
      .replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
      .replace(/[*@$!0]/g, c => ({ '*': '', '@': 'a', '$': 's', '!': 'i', '0': 'o' }[c] ?? c))
      .replace(/[^a-z0-9ء-ي ]/g, '');
  }

  function containsBadWords(s) {
    const t = normalizeForBad(s);
    return BAD_WORDS.some(w => t.includes(normalizeForBad(w)));
  }

  // فحص شامل لحقل نصي: يُرجع { ok, value, error } (error = مفتاح i18n)
  function validateText(s, { max, min = 0, allowPhone = false } = {}) {
    const value = cleanText(s, max);
    if (value.length < min) return { ok: false, value, error: 'err.too_short' };
    if (!allowPhone && containsPhone(value)) return { ok: false, value, error: 'err.no_phone_in_text' };
    if (containsBadWords(value)) return { ok: false, value, error: 'err.bad_words' };
    return { ok: true, value };
  }

  // فحص رسالة المساعد الذكي (حد 200 حرف + كلمات بذيئة)
  function validateAgentMessage(s) {
    const maxLen = (window.CONFIG && window.CONFIG.LIMITS.SMART_AGENT_MSG) || 200;
    const value = cleanText(s, maxLen);
    if (!value) return { ok: false, value, error: 'err.too_short' };
    if (value.length > maxLen) return { ok: false, value, error: 'agent.err_too_long' };
    if (containsBadWords(value)) return { ok: false, value, error: 'err.bad_words' };
    return { ok: true, value };
  }

  // روابط المنصات
  const HOSTS = {
    facebook: /^(?:[a-z0-9-]+\.)?(?:facebook\.com|fb\.com|fb\.me)$/i,
    instagram: /^(?:[a-z0-9-]+\.)?instagram\.com$/i,
    tiktok: /^(?:[a-z0-9-]+\.)?tiktok\.com$/i,
    telegram: /^(?:t\.me|telegram\.me)$/i,
    maps: /^(?:(?:www\.)?google\.[a-z.]+|maps\.app\.goo\.gl|goo\.gl)$/i,
    video: /^(?:[a-z0-9-]+\.)?(?:facebook\.com|fb\.watch|tiktok\.com|instagram\.com|youtube\.com|youtu\.be)$/i
  };
  function validateUrl(url, kind) {
    const raw = String(url ?? '').trim();
    if (!raw) return { ok: true, value: '' };
    if (raw.length > 300) return { ok: false, value: '', error: 'err.invalid_url' };
    let u;
    try { u = new URL(raw); } catch { return { ok: false, value: '', error: 'err.invalid_url' }; }
    if (u.protocol !== 'https:') return { ok: false, value: '', error: 'err.invalid_url' };
    const re = HOSTS[kind];
    if (re && !re.test(u.hostname)) return { ok: false, value: '', error: 'err.wrong_platform_' + kind };
    if (kind === 'maps' && /google\.[a-z.]+$/i.test(u.hostname) && !/^\/maps/i.test(u.pathname)) {
      return { ok: false, value: '', error: 'err.wrong_platform_maps' };
    }
    return { ok: true, value: u.toString() };
  }

  function validatePrice(v) {
    const n = Number(toLatinDigits(v).replace(/[\s,]/g, ''));
    if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) return { ok: false, value: 0, error: 'err.price_invalid' };
    if (n > 100000000000) return { ok: false, value: 0, error: 'err.price_invalid' };
    return { ok: true, value: n };
  }

  // ضبط textContent بدل innerHTML دائمًا
  function setText(el, s) { if (el) el.textContent = String(s ?? ''); }

  window.Sanitize = {
    toLatinDigits, escapeHtml, cleanText, containsPhone, containsBadWords,
    validateText, validateAgentMessage, validateUrl, validatePrice, setText
  };
})();
