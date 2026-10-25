/* voice.js — البحث الصوتي، الإملاء (عنوان/وصف)، اختيار الصنف بالصوت، الأوامر الصوتية، وقراءة مواصفات الإعلان.
   يعتمد على Web Speech API في المتصفح (لا يحتاج خادمًا). */
(function () {
  'use strict';
  const el = Utils.el, t = k => I18n.t(k), R = window.CONFIG.ROUTES;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const LANG = { ar: 'ar-DZ', fr: 'fr-FR', en: 'en-US' };
  let rec = null, active = false;

  // أوامر التنقل: كلمات التفعيل ثم اسم القسم
  const VERBS = ['افتح', 'اذهب الي', 'اذهب', 'روح الي', 'روح', 'خذني الي', 'ouvre', 'ouvrir', 'va a', 'aller a', 'go to', 'open'];
  const COMMANDS = [
    [R.HOME, ['الرئيسيه', 'الصفحه الرئيسيه', 'accueil', 'home']],
    [R.SETTINGS, ['الاعدادات', 'اعدادات', 'parametres', 'settings']],
    [R.POST, ['اضافه اعلان', 'اضف اعلان', 'انشر اعلان', 'ajouter annonce', 'publier annonce', 'post ad', 'add ad']],
    [R.FAVS, ['المفضله', 'المفضلات', 'تفضيلاتي', 'favoris', 'favorites']],
    [R.NOTIFS, ['الاشعارات', 'اشعارات', 'التنبيهات', 'notifications', 'alerts']],
    [R.PROFILE, ['حسابي', 'الحساب', 'mon compte', 'my account', 'profile']],
    [R.CHAT, ['الرسائل', 'المحادثات', 'messages', 'chats']]
  ];

  function stripVerb(n) {
    for (const v of VERBS) { if (n.startsWith(v + ' ')) return { n: n.slice(v.length + 1).trim(), verb: true }; }
    return { n, verb: false };
  }

  const Voice = {
    supported() { return !!SR; },
    get active() { return active; },

    // يبدأ الاستماع. callbacks: onInterim(text) onFinal(text) onEnd() onError(code)
    start({ onInterim, onFinal, onEnd, onError } = {}) {
      if (!SR) { UI.toastKey('voice.unsupported', 'error'); return false; }
      this.stop();
      try {
        rec = new SR();
        rec.lang = LANG[I18n.lang] || 'ar-DZ';
        rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 1;
        let finalText = '';
        rec.onresult = e => {
          let interim = '';
          for (let i = e.resultIndex; i < e.results.length; i++) {
            const tr = e.results[i][0].transcript;
            if (e.results[i].isFinal) finalText += tr + ' '; else interim += tr;
          }
          if (onInterim) onInterim((finalText + interim).trim());
        };
        rec.onerror = e => {
          if (e.error === 'not-allowed' || e.error === 'service-not-allowed') UI.toastKey('voice.denied', 'error');
          else if (e.error === 'no-speech') UI.toastKey('voice.nospeech', 'info');
          else if (e.error === 'audio-capture') UI.toastKey('voice.nomic', 'error');
          else if (e.error !== 'aborted') UI.toastKey('err.generic', 'error');
          if (onError) onError(e.error);
        };
        rec.onend = () => {
          active = false; rec = null;
          if (finalText.trim() && onFinal) onFinal(finalText.trim());
          if (onEnd) onEnd();
        };
        rec.start(); active = true;
        return true;
      } catch (e) {
        console.error('[Voice] start', e); active = false; rec = null;
        UI.toastKey('err.generic', 'error'); return false;
      }
    },
    stop() { if (rec) { try { rec.stop(); } catch { /* ignore */ } } },

    // أمر تنقل صوتي؟ يُرجع مسار الصفحة أو null (لا يلتقط جمل البحث العادية)
    command(text) {
      const { n, verb } = stripVerb(Dict.norm(text));
      if (!n) return null;
      for (const [route, keys] of COMMANDS) {
        for (const k of keys) { if (n === k || (verb && n.includes(k))) return route; }
      }
      return null;
    },

    // مطابقة صنف/صنف فرعي من جملة منطوقة
    matchCategory(text) {
      const n = Dict.norm(text); if (!n) return null;
      let best = null, bl = 0;
      Categories.all().forEach(m => {
        const test = (o, sub) => ['ar', 'fr', 'en'].forEach(l => {
          const lab = Dict.norm(o[l] || ''); if (lab.length < 2) return;
          if ((n.includes(lab) || lab.includes(n)) && lab.length > bl) { bl = lab.length; best = { cat: m.id, sub: sub ? o.id : '' }; }
        });
        test(m, false); m.sub.forEach(s => test(s, true));
      });
      return best;
    },

    // زر ميكروفون لإملاء النص داخل حقل (عنوان/وصف) — يُلحق النص بدل استبداله
    dictateButton(input, max) {
      const b = el('button', { class: 'mic-btn', type: 'button', title: t('voice.dictate'), 'aria-label': t('voice.dictate') }, '🎙');
      b.addEventListener('click', () => {
        if (active) { this.stop(); return; }
        b.classList.add('is-rec');
        const base = input.value ? input.value.trim() + ' ' : '';
        this.start({
          onInterim: tx => { input.value = (base + tx).slice(0, max || input.maxLength || 500); },
          onFinal: tx => { input.value = (base + tx).slice(0, max || input.maxLength || 500); input.dispatchEvent(new Event('input', { bubbles: true })); },
          onEnd: () => b.classList.remove('is-rec'),
          onError: () => b.classList.remove('is-rec')
        });
      });
      return b;
    },

    // قراءة نص بصوت عالٍ (مواصفات الإعلان). الضغط ثانية يوقف القراءة
    speak(text) {
      const ss = window.speechSynthesis;
      if (!ss) { UI.toastKey('voice.unsupported', 'error'); return false; }
      if (ss.speaking) { ss.cancel(); return false; }
      const u = new SpeechSynthesisUtterance(String(text || ''));
      u.lang = LANG[I18n.lang] || 'ar-DZ'; u.rate = 0.95;
      ss.speak(u); return true;
    },
    stopSpeak() { if (window.speechSynthesis) window.speechSynthesis.cancel(); }
  };
  window.Voice = Voice;
})();
