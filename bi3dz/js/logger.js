/* logger.js — كونسول تشخيص عائم للتطوير
   أضيفي هذا السطر قبل </body> في كل صفحة:
   <script src="js/logger.js"></script>
   احذفيه أو علّقيه قبل النشر الإنتاجي */
(function() {
  'use strict';
  
  /* ── الحالة ── */
  const LOG = [];
  let visible = false;
  
  /* ── CSS ── */
  const style = document.createElement('style');
  style.textContent = `
    #__logger-fab {
      position: fixed;
      bottom: calc(84px + env(safe-area-inset-bottom, 0px));
      left: 16px;
      z-index: 99998;
      width: 44px; height: 44px;
      border-radius: 50%;
      background: var(--c-primary, #c2607a);
      color: #fff;
      font-size: 20px;
      border: none;
      box-shadow: 0 2px 10px rgba(0,0,0,.3);
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: transform .2s;
    }
    #__logger-fab:active { transform: scale(.9); }

    #__logger-panel {
      position: fixed;
      bottom: calc(140px + env(safe-area-inset-bottom, 0px));
      left: 8px; right: 8px;
      z-index: 99997;
      background: #1a1a1a;
      color: #f0f0f0;
      border-radius: 12px;
      font-family: monospace;
      font-size: 12px;
      box-shadow: 0 4px 24px rgba(0,0,0,.5);
      display: flex; flex-direction: column;
      max-height: 55vh;
      overflow: hidden;
      transition: opacity .2s, transform .2s;
    }
    #__logger-panel.hidden { opacity: 0; pointer-events: none; transform: translateY(12px); }

    #__logger-toolbar {
      display: flex; gap: 8px; padding: 8px 10px;
      border-bottom: 1px solid #333;
      flex-shrink: 0;
    }
    #__logger-toolbar button {
      flex: 1; padding: 6px 4px;
      background: #2a2a2a; color: #ddd;
      border: 1px solid #444; border-radius: 6px;
      font-size: 11px; cursor: pointer;
    }
    #__logger-toolbar button:active { background: #3a3a3a; }

    #__logger-output {
      flex: 1; overflow-y: auto;
      padding: 8px 10px;
    }
    #__logger-output .log-line {
      padding: 3px 0;
      border-bottom: 1px solid #2a2a2a;
      word-break: break-all;
      white-space: pre-wrap;
    }
    #__logger-output .log-line.error  { color: #ff6b6b; }
    #__logger-output .log-line.warn   { color: #ffd93d; }
    #__logger-output .log-line.info   { color: #6bcbff; }
    #__logger-output .log-line.log    { color: #e0e0e0; }

    #__logger-input-wrap {
      display: flex; gap: 6px; padding: 8px 10px;
      border-top: 1px solid #333;
      flex-shrink: 0;
    }
    #__logger-input {
      flex: 1; background: #2a2a2a; color: #fff;
      border: 1px solid #444; border-radius: 6px;
      padding: 6px 8px; font-size: 12px; font-family: monospace;
    }
    #__logger-run {
      background: var(--c-primary, #c2607a); color: #fff;
      border: none; border-radius: 6px;
      padding: 6px 12px; font-size: 12px; cursor: pointer;
    }
  `;
  document.head.appendChild(style);
  
  /* ── HTML ── */
  const fab = document.createElement('button');
  fab.id = '__logger-fab';
  fab.title = 'Logger';
  fab.textContent = '🐛';
  
  const panel = document.createElement('div');
  panel.id = '__logger-panel';
  panel.className = 'hidden';
  panel.innerHTML = `
    <div id="__logger-toolbar">
      <button id="__logger-clear">🗑 مسح</button>
      <button id="__logger-copy">📋 نسخ</button>
    </div>
    <div id="__logger-output"></div>
    <div id="__logger-input-wrap">
      <input id="__logger-input" placeholder="كود JS..." />
      <button id="__logger-run">▶</button>
    </div>
  `;
  
  document.body.appendChild(panel);
  fab.style.display = localStorage.getItem('__logger_on') === '1' ? 'flex' : 'none';
  document.body.appendChild(fab);
  window.__enableLogger = () => { localStorage.setItem('__logger_on','1'); fab.style.display='flex'; };
  
  const output = panel.querySelector('#__logger-output');
  
  /* ── إضافة سطر ── */
  function addLine(type, args) {
    const text = args.map(a => {
      try { return typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a); }
      catch { return String(a); }
    }).join(' ');
    
    const time = new Date().toLocaleTimeString('ar', { hour12: false });
    const entry = { type, text, time };
    LOG.push(entry);
    
    const div = document.createElement('div');
    div.className = `log-line ${type}`;
    div.textContent = `[${time}] ${text}`;
    output.appendChild(div);
    output.scrollTop = output.scrollHeight;
  }
  
  /* ── اعتراض console ── */
  ['log', 'info', 'warn', 'error'].forEach(type => {
    const orig = console[type].bind(console);
    console[type] = (...args) => { orig(...args);
      addLine(type, args); };
  });
  
  window.addEventListener('error', e => {
    addLine('error', [`${e.message} (${e.filename}:${e.lineno})`]);
  });
  
  window.addEventListener('unhandledrejection', e => {
    addLine('error', ['UnhandledPromise:', e.reason]);
  });
  
  /* ── أزرار ── */
  fab.addEventListener('click', () => {
    visible = !visible;
    panel.classList.toggle('hidden', !visible);
    fab.textContent = visible ? '✖' : '🐛';
  });
  
  panel.querySelector('#__logger-clear').addEventListener('click', () => {
    output.innerHTML = '';
    LOG.length = 0;
  });
  
  panel.querySelector('#__logger-copy').addEventListener('click', () => {
    const text = LOG.map(l => `[${l.time}][${l.type}] ${l.text}`).join('\n');
    navigator.clipboard.writeText(text).then(() => {
      console.info('✅ تم نسخ الكونسول');
    });
  });
  
  /* ── تنفيذ كود JS ── */
  const input = panel.querySelector('#__logger-input');
  const run = panel.querySelector('#__logger-run');
  
  function execCode() {
    const code = input.value.trim();
    if (!code) return;
    addLine('info', ['▶ ' + code]);
    try {
      // eslint-disable-next-line no-eval
      const result = eval(code);
      if (result !== undefined) addLine('log', ['← ' + result]);
    } catch (e) {
      addLine('error', ['✖ ' + e.message]);
    }
    input.value = '';
  }
  
  run.addEventListener('click', execCode);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') execCode(); });
  
})();