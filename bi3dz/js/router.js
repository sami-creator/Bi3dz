/* router.js — تنقل بلا إعادة تحميل غير ضرورية + حراسة الصفحات */
(function () {
  'use strict';
  const R = window.CONFIG.ROUTES, K = window.CONFIG.STORAGE_KEYS;

  function currentRoute() {
    const p = location.pathname.split('/').pop();
    return p ? (p.endsWith('.html') ? p : p + '.html') : R.HOME;
  }

  const Router = {
    current: currentRoute,
    // رجوع آمن: التاريخ إن وُجد، وإلا الرئيسية (الفلاتر والبحث محفوظة في Filters فلا تضيع)
    back() { if (history.length > 1 && document.referrer && new URL(document.referrer).origin === location.origin) history.back(); else Utils.go(R.HOME); },
    // الضغط على رابط صفحة أنت عليها لا يعيد التحميل
    bindNav(root = document) {
      const cur = currentRoute();
      root.querySelectorAll('[data-route]').forEach(a => {
        const target = a.dataset.route;
        if (target === cur) a.classList.add('active');
        a.addEventListener('click', e => {
          e.preventDefault();
          if (target === currentRoute()) {
            document.dispatchEvent(new CustomEvent('samepage', { detail: target }));
            return;
          }
          Utils.go(target);
        });
      });
    },
    // صفحات تحتاج تسجيل الدخول: تنتظر التحقق قبل أي عرض
    async guard({ complete = true } = {}) {
      document.body.classList.add('is-gated');
      const st = await Auth.ready();
      if (st.status === 'guest') { this.toLogin(); return null; }
      if (complete && st.status === 'partial') { Utils.go(R.COMPLETE); return null; }
      document.body.classList.remove('is-gated');
      return st;
    },
    // يحفظ الصفحة التي كان المستخدم ينوي زيارتها ثم يذهب لتسجيل الدخول
    toLogin() {
      const here = currentRoute();
      if (here !== R.AUTH && here !== R.COMPLETE) localStorage.setItem(K.RETURN_TO, here + location.search);
      Utils.go(R.AUTH);
    },
    // وجهة صالحة فقط (صفحة داخلية، وليست صفحة الدخول نفسها)
    validReturn(back) {
      if (!back || !/^[a-z0-9\-]+(\.html)?(\?[^\s]*)?$/i.test(back)) return null;
      const path = back.split('?')[0];
      return path === R.AUTH || path === R.COMPLETE ? null : back;
    },
    // بعد نجاح الدخول أو إكمال بيانات الحساب: العودة للصفحة المقصودة (مثل إضافة إعلان)
    afterLogin() {
      const fromUrl = new URLSearchParams(location.search).get('return');
      const back = this.validReturn(fromUrl) || this.validReturn(localStorage.getItem(K.RETURN_TO));
      localStorage.removeItem(K.RETURN_TO); localStorage.removeItem(K.LOGIN_PENDING);
      if (back) location.href = back; else Utils.go(R.PROFILE);
    },
    // إن عاد مزوّد الدخول إلى صفحة غير auth (مثل الرئيسية) نكمل المسار: إكمال البيانات إن لزم، ثم الصفحة المقصودة
    resumeAfterLogin(st) {
      const cur = currentRoute();
      if (cur === R.AUTH || cur === R.COMPLETE) return false;     // هاتان الصفحتان تتصرفان بنفسيهما
      const ts = Number(localStorage.getItem(K.LOGIN_PENDING) || 0);
      if (!ts) return false;
      if (Date.now() - ts > 15 * 60 * 1000 || !st || st.status === 'guest') { if (st && st.status !== 'guest') localStorage.removeItem(K.LOGIN_PENDING); return false; }
      if (st.status === 'partial') { Utils.go(R.COMPLETE); return true; }
      const back = this.validReturn(localStorage.getItem(K.RETURN_TO));
      localStorage.removeItem(K.LOGIN_PENDING); localStorage.removeItem(K.RETURN_TO);
      if (back && back.split('?')[0] !== cur) { location.href = back; return true; }
      return false;
    }
  };
  window.Router = Router;
})();
