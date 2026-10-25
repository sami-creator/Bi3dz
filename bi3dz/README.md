# souk nsa — سوق نسا

تطبيق ويب ثابت (HTML/CSS/JS) + Supabase + Edge Functions، يعمل على أي استضافة ملفات ثابتة.

## التشغيل
1. أنشئي مشروع Supabase وقاعدة البيانات حسب `DB_SCHEMA.md` (الجداول، Views، RPC، RLS، Buckets).
2. فعّلي تسجيل الدخول عبر Google، وأضيفي رابط الموقع في Redirect URLs (`https://موقعك/auth`).
3. انسخي `js/env.example.js` إلى `js/env.js` وضعي `SUPABASE_URL` و`SUPABASE_ANON_KEY` (لا ترفعيه إلى git).
4. انشري الدوال: `supabase functions deploy <name>` لكل مجلد داخل `supabase/functions/`، وضعي الأسرار المذكورة في DB_SCHEMA.
5. ضعي الصور يدويًا في `assets/images/` (مثل `favicon.png`)، وعدّلي أرقام الدعم في `js/config.js` (`SUPPORT`).
6. شغّليه عبر أي خادم ويب عادي (مثل Live Server أو `python -m http.server`) أو ارفعيه لأي استضافة ملفات ثابتة.

## بنية الملفات
- `*.html` صفحات، `css/` تنسيقات، `js/` منطق، `data/` (ولايات، أصناف، ترجمات ar/fr/en).
- `js/app.js` الهيكل المشترك ومتحكمات: الرئيسية، المفضلة، الإشعارات، الدردشة، الإعدادات.
- `supabase/functions/` سبع دوال: submit-ad, smart-search, nearby-ads, verification-decision, notify-fanout, cron-decay-aggregate, cron-cleanup.

## ما يحتاج إكمالك
- `data/dairas.json` و`data/communes.json`: هيكل ونماذج فقط؛ املئيهما من مصدر رسمي (الولايات الـ58 كاملة).
- إرسال OTP (واتساب/Firebase) داخل `request_phone_otp`/`verify_phone_otp`.
- الإشعارات الخلفية (Push) تحتاج Service Worker وFirebase؛ الموجود إشعارات داخل التطبيق فقط.
- نظام المتابعة غير موصوف، لذا `followers` = 0.
- `privacy.html` نص أولي بالعربية، وقائمة الكلمات المسيئة في `sanitize.js` و`submit-ad` قابلة للتوسعة.

## تحديثات البحث والتجربة (v1.1.0)
- ملفات جديدة: `js/darija-dict.js` (قاموس الدارجة + محلل الجمل)، `js/search-state.js` (سجل/كاش/استعادة)، `js/voice.js` (البحث والإملاء والقراءة الصوتية)، `js/compare.js` (الترشيح والمقارنة)، `js/delivery.js` (أسعار التوصيل لكل ولاية).
- أعمدة قاعدة بيانات مطلوبة في جدول `users`: `bio text`, `delivery_prices jsonb` (وإظهارهما في العرض `seller_public`).
