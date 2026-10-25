/* push.js — تفعيل إشعارات Firebase: طلب الإذن، جلب رمز الجهاز، وحفظه في قاعدة البيانات */
(function () {
  'use strict';
  const V = '12.19.0';

  const Push = {
    supported() { return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window; },

    async enable() {
      if (!this.supported()) return { ok: false, reason: 'unsupported' };
      const cfg = window.__ENV__ && window.__ENV__.FIREBASE;
      if (!cfg) return { ok: false, reason: 'no_config' };
      if (!window.Auth || !Auth.uid()) return { ok: false, reason: 'no_user' };
      try {
        const perm = await Notification.requestPermission();
        if (perm !== 'granted') return { ok: false, reason: 'denied' };
        const [appMod, msgMod] = await Promise.all([
          import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`),
          import(`https://www.gstatic.com/firebasejs/${V}/firebase-messaging.js`)
        ]);
        const app = appMod.getApps().length ? appMod.getApp() : appMod.initializeApp(cfg);
        const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        const token = await msgMod.getToken(msgMod.getMessaging(app), { vapidKey: cfg.vapidKey, serviceWorkerRegistration: reg });
        if (!token) return { ok: false, reason: 'no_token' };
        const { error } = await SB.db.rpc('save_push_token', { p_token: token });
        return error ? { ok: false, reason: 'db' } : { ok: true };
      } catch (e) {
        console.error('[Push]', e);
        return { ok: false, reason: 'error' };
      }
    }
  };

  window.Push = Push;
})();
