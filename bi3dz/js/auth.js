/* auth.js — تسجيل الدخول عبر Google + حالة الحساب (guest/partial/complete) */
(function () {
  'use strict';
  const K = window.CONFIG.STORAGE_KEYS, LIM = window.CONFIG.LIMITS;
  let state = null, pending = null;

  async function fetchProfile(uid) {
    const BASE = 'id,email,name,avatar_url,gender,birth_year,wilaya_id,daira_id,commune_id,phone,show_phone,facebook,instagram,tiktok,telegram,maps_url,is_verified,registration_complete,created_at';
    // الأعمدة الجديدة (bio, delivery_prices): إن لم تكن موجودة بعد في قاعدة البيانات نرجع للأعمدة الأساسية دون كسر الدخول
    let { data, error } = await SB.db.from('users').select(BASE + ',bio,delivery_prices').eq('id', uid).maybeSingle();
    if (error) {
      const r = await SB.db.from('users').select(BASE).eq('id', uid).maybeSingle();
      data = r.data; error = r.error;
    }
    if (error) console.error('[Auth] profile', error);
    return data || null;
  }

  const Auth = {
    // ينتظر التحقق مرة واحدة، فلا يظهر زر الدخول قبل معرفة الحالة
    ready() {
      if (state) return Promise.resolve(state);
      if (pending) return pending;
      pending = this.refresh();
      return pending;
    },
    async refresh() {
      const c = SB.db;
      if (!c) { state = { status: 'guest', user: null, profile: null }; return state; }
      const { data: { session } } = await c.auth.getSession();
      if (!session) {
        Utils.Store.remove(K.SESSION_HINT);
        state = { status: 'guest', user: null, profile: null };
      } else {
        let profile = await fetchProfile(session.user.id);
        if (!profile) {
          const m = session.user.user_metadata || {};
          const row = { id: session.user.id, email: session.user.email, name: Sanitize.cleanText(m.full_name || '', LIM.NAME), avatar_url: m.avatar_url || null, registration_complete: false };
          const { error } = await c.from('users').upsert(row, { onConflict: 'id' });
          if (error) console.error('[Auth] upsert', error);
          profile = await fetchProfile(session.user.id);
        }
        const status = profile && profile.registration_complete ? 'complete' : 'partial';
        Utils.Store.set(K.SESSION_HINT, status);
        state = { status, user: session.user, profile };
      }
      pending = null;
      return state;
    },
    hint() { return Utils.Store.get(K.SESSION_HINT, 'guest'); },
    get state() { return state; },
    isLogged() { return !!state && state.status !== 'guest'; },
    uid() { return state && state.user ? state.user.id : null; },

    async signInGoogle() {
      // الوجهة المقصودة محفوظة في localStorage (تبقى بعد العودة من Google)، وعنوان العودة بلا معاملات كي يطابق قائمة Redirect URLs
      localStorage.setItem(K.LOGIN_PENDING, String(Date.now()));
      const { error } = await SB.db.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: location.origin + location.pathname.replace(/[^/]*$/, '') + 'auth.html' }
      });
      if (error) { localStorage.removeItem(K.LOGIN_PENDING); console.error('[Auth] google', error); UI.toastKey('err.login_failed', 'error'); }
    },

    async signOut() {
      await SB.db.auth.signOut();
      Utils.Store.remove(K.SESSION_HINT);
      state = { status: 'guest', user: null, profile: null };
      Utils.go(window.CONFIG.ROUTES.HOME);
    },

    validateBirthYear(y) {
      return Auth.ageOk(Utils.ageFromYear(y));
    },
    ageOk(age) { return Number.isFinite(age) && age >= LIM.MIN_AGE; },

    // إكمال بيانات التسجيل (يُكرَّر التحقق في RLS/الخادم)
    async completeProfile({ name, gender, birth_year, wilaya_id, daira_id, commune_id }) {
      const n = Sanitize.validateText(name, { max: LIM.NAME, min: 2 });
      if (!n.ok) return { error: n.error };
      if (!['male', 'female'].includes(gender)) return { error: 'err.gender_required' };
      if (!Auth.validateBirthYear(birth_year)) return { error: 'err.age_min' };
      if (!wilaya_id || !daira_id || !commune_id) return { error: 'err.location_required' };
      const { error } = await SB.db.from('users').update({
        name: n.value, gender, birth_year: Number(birth_year),
        wilaya_id, daira_id, commune_id, registration_complete: true
      }).eq('id', Auth.uid());
      if (error) { console.error('[Auth] complete', error); return { error: 'err.generic' }; }
      state = null; await Auth.refresh();
      return { ok: true };
    },

    async updateLastSeen() {
      if (Auth.uid()) await SB.db.from('users').update({ last_seen: new Date().toISOString() }).eq('id', Auth.uid());
    }
  };
  window.Auth = Auth;
})();
