/* smart-agent.js — منطق صفحة المساعد الذكي */
(function () {
  'use strict';

  const C     = window.CONFIG;
  const K     = C.STORAGE_KEYS;
  const MAX   = C.LIMITS.SMART_AGENT_MSG;  // 200 حرف

  // ─── DOM refs (تُعيَّن بعد DOMContentLoaded) ─────────────────────────────────
  let chatEl, inputEl, sendBtn, charCount, clearBtn;

  // ─── حالة المحادثة ────────────────────────────────────────────────────────────
  let history = [];    // [{ role, parts }] لـ Gemini
  let sending = false;

  // ─── قاعدة المعرفة (kb.json) ─────────────────────────────────────────────────
  let KB = [];
  async function loadKB() {
    try {
      const r = await fetch('data/kb.json', { cache: 'default' });
      KB = await r.json();
    } catch { KB = []; }
  }

  function findKB(text) {
    const lang = (window.I18n?.lang ?? 'ar').slice(0, 2);
    const lower = text.toLowerCase();
    let bestScore = 0, bestAnswer = null;

    for (const entry of KB) {
      const kws = entry.keywords?.[lang] ?? entry.keywords?.ar ?? [];
      let score = 0;
      for (const kw of kws) {
        if (lower.includes(kw.toLowerCase())) score++;
      }
      if (score > bestScore) {
        bestScore = score;
        bestAnswer = entry.answer?.[lang] ?? entry.answer?.ar ?? null;
      }
    }
    return bestScore > 0 ? bestAnswer : null;
  }

  // ─── localStorage helpers ─────────────────────────────────────────────────────
  function saveHistory() {
    try { localStorage.setItem(K.SMART_AGENT_HISTORY, JSON.stringify(history.slice(-30))); } catch { /* ignore */ }
  }
  function loadHistory() {
    try {
      const raw = localStorage.getItem(K.SMART_AGENT_HISTORY);
      if (raw) history = JSON.parse(raw);
    } catch { history = []; }
  }
  function saveDraft(val) {
    try { localStorage.setItem(K.SMART_AGENT_DRAFT, val); } catch { /* ignore */ }
  }
  function loadDraft() {
    try { return localStorage.getItem(K.SMART_AGENT_DRAFT) ?? ''; } catch { return ''; }
  }
  function clearDraft() {
    try { localStorage.removeItem(K.SMART_AGENT_DRAFT); } catch { /* ignore */ }
  }

  // ─── UI helpers ───────────────────────────────────────────────────────────────
  function t(key) { return window.I18n?.t?.(key) ?? key; }
  function tpl(key, vars) {
    let s = t(key);
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, v);
    return s;
  }

  function addBubble(text, role) {
    const div = document.createElement('div');
    div.className = `sa-bubble sa-bubble--${role}`;
    // escapeHtml لمنع XSS — النص فقط
    div.textContent = text;
    chatEl.appendChild(div);
    chatEl.scrollTop = chatEl.scrollHeight;
    return div;
  }

  function addTyping() {
    const div = document.createElement('div');
    div.className = 'sa-bubble sa-bubble--bot sa-bubble--typing';
    div.innerHTML = '<span></span><span></span><span></span>';
    chatEl.appendChild(div);
    chatEl.scrollTop = chatEl.scrollHeight;
    return div;
  }

  function showError(msgKey) {
    const div = document.createElement('div');
    div.className = 'sa-bubble sa-bubble--error';
    div.textContent = t(msgKey);
    chatEl.appendChild(div);
    chatEl.scrollTop = chatEl.scrollHeight;
  }

  function updateCharCount() {
    const len = inputEl.value.length;
    const left = MAX - len;
    charCount.textContent = tpl('agent.chars_left', { n: left });
    charCount.classList.toggle('sa-chars--warn', left <= 20);
    charCount.classList.toggle('sa-chars--over', left < 0);
  }

  // ─── Supabase URL ─────────────────────────────────────────────────────────────
  function getEdgeUrl() {
    // يستخدم window.ENV.SUPABASE_URL إن وُجد، وإلا الثابت
    const base = (window.__ENV__?.SUPABASE_URL ?? '').replace(/\/$/, '');
    return base ? base + C.SMART_AGENT.EDGE_FUNCTION_URL : C.SMART_AGENT.EDGE_FUNCTION_URL;
  }

  // ─── استدعاء Edge Function ───────────────────────────────────────────────────
  async function callAgent(message, kbAnswer) {
  const lang = (window.I18n?.lang ?? 'ar').slice(0, 2);
  const fp = (window.__FP__ ?? '').slice(0, 64);
  
  const payload = {
    message,
    lang,
    history: history.slice(-10),
    kb_answer: kbAnswer ?? '',
    fingerprint: fp,
  };
  
  const { data, error } = await SB.fn('smart-agent', payload);
  
  if (error) throw Object.assign(new Error('agent.err_generic'), { i18nKey: 'agent.err_generic' });
  
  if (data.error === 'rate_limit_min' || data.error === 'rate_limit_day') {
    const key = data.error === 'rate_limit_min' ? 'agent.err_rate_min' : 'agent.err_rate_day';
    throw Object.assign(new Error(key), { i18nKey: key });
  }
  
  if (data.error) throw Object.assign(new Error('agent.err_generic'), { i18nKey: 'agent.err_generic' });
  
  return data.reply;
}

  // ─── إرسال الرسالة ────────────────────────────────────────────────────────────
  async function send() {
    if (sending) return;
    const raw = inputEl.value;
    const v   = Sanitize.validateAgentMessage(raw);
    if (!v.ok) { showError(v.error); return; }

    const text = v.value;
    sending = true;
    sendBtn.disabled = true;
    inputEl.value = '';
    clearDraft();
    updateCharCount();

    addBubble(text, 'user');
    const typingEl = addTyping();

    const kbAnswer = findKB(text);
    let reply;

    try {
      reply = await callAgent(text, kbAnswer);
    } catch (err) {
      typingEl.remove();
      showError(err.i18nKey ?? 'agent.err_generic');
      sending = false;
      sendBtn.disabled = false;
      inputEl.focus();
      return;
    }

    typingEl.remove();
    addBubble(reply, 'bot');

    // حفظ في history لـ Gemini
    history.push({ role: 'user',  parts: [{ text }] });
    history.push({ role: 'model', parts: [{ text: reply }] });
    saveHistory();

    sending = false;
    sendBtn.disabled = false;
    inputEl.focus();
  }

  // ─── مسح المحادثة ─────────────────────────────────────────────────────────────
  async function clearChat() {
    const ok = await UI.confirmDialog(t('agent.clear_confirm'), 'common.ok', 'common.cancel');
    if (!ok) return;
    history = [];
    saveHistory();
    chatEl.innerHTML = '';
    addBubble(t('agent.welcome'), 'bot');
  }

  // ─── init ─────────────────────────────────────────────────────────────────────
  window.SmartAgent = {
    async init() {
      chatEl   = document.getElementById('sa-chat');
      inputEl  = document.getElementById('sa-input');
      sendBtn  = document.getElementById('sa-send');
      charCount = document.getElementById('sa-chars');
      clearBtn  = document.getElementById('sa-clear');

      if (!chatEl || !inputEl) return;

      await loadKB();
      loadHistory();

      // عرض الرسالة الترحيبية إن لم يكن هناك تاريخ
      if (history.length === 0) {
        addBubble(t('agent.welcome'), 'bot');
      } else {
        // إعادة رسم المحادثة المحفوظة
        for (const msg of history) {
          const role  = msg.role === 'model' ? 'bot' : 'user';
          const text  = msg.parts?.[0]?.text ?? '';
          if (text) addBubble(text, role);
        }
      }

      // استعادة المسودة
      const draft = loadDraft();
      if (draft) { inputEl.value = draft; updateCharCount(); }

      // أحداث
      sendBtn.addEventListener('click', send);
      clearBtn?.addEventListener('click', clearChat);

      inputEl.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
      });

      inputEl.addEventListener('input', () => {
        updateCharCount();
        saveDraft(inputEl.value);
      });

      updateCharCount();
    }
  };
})();
