-- ============================================================
-- SCHEMA.SQL — souk_nsa
-- توليد تلقائي — قابل للتطبيق على مشروع Supabase جديد
-- الترتيب مهم: الجداول المرجعية أولاً ثم التابعة
-- ============================================================

-- ============================================================
-- 1. EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS postgis;


-- ============================================================
-- 2. TABLES — المرجعية (بدون foreign keys خارجية)
-- ============================================================

CREATE TABLE wilayas (
  id        integer PRIMARY KEY,
  name_ar   text NOT NULL,
  name_fr   text NOT NULL
);

CREATE TABLE dairas (
  id         integer PRIMARY KEY,
  wilaya_id  integer NOT NULL REFERENCES wilayas(id),
  name_ar    text NOT NULL
);

CREATE TABLE communes (
  id        integer PRIMARY KEY,
  daira_id  integer NOT NULL REFERENCES dairas(id),
  name_ar   text NOT NULL,
  name_fr   text
);

CREATE TABLE categories (
  id              text PRIMARY KEY,
  parent_id       text REFERENCES categories(id),
  name_ar         text NOT NULL,
  name_fr         text NOT NULL,
  name_en         text NOT NULL,
  min_price       bigint,
  max_price       bigint,
  filters_schema  jsonb
);


-- ============================================================
-- 3. TABLES — المستخدمون
-- ============================================================

CREATE TABLE users (
  id                    uuid PRIMARY KEY,   -- يطابق auth.uid()
  email                 text,
  name                  text,
  avatar_url            text,
  gender                text,
  birth_year            integer,
  wilaya_id             integer REFERENCES wilayas(id),
  daira_id              integer REFERENCES dairas(id),
  commune_id            integer REFERENCES communes(id),
  phone                 text,
  show_phone            boolean NOT NULL DEFAULT false,
  facebook              text,
  instagram             text,
  tiktok                text,
  telegram              text,
  maps_url              text,
  is_verified           boolean NOT NULL DEFAULT false,
  registration_complete boolean NOT NULL DEFAULT false,
  last_seen             timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  followers             integer DEFAULT 0,
  bio                   text,
  delivery_prices       jsonb DEFAULT '{}'::jsonb,
  telegram_chat_id      bigint,
  telegram_link_token   text
);


-- ============================================================
-- 4. TABLES — الإعلانات
-- ============================================================

CREATE TABLE ads (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES users(id),
  category_id      text REFERENCES categories(id),
  subcategory_id   text REFERENCES categories(id),
  title            text NOT NULL,
  description      text,
  price            bigint,
  discount_pct     integer,
  negotiable       boolean NOT NULL DEFAULT false,
  delivery         boolean NOT NULL DEFAULT false,
  show_phone       boolean NOT NULL DEFAULT false,
  video_url        text,
  wilaya_id        integer REFERENCES wilayas(id),
  daira_id         integer REFERENCES dairas(id),
  commune_id       integer REFERENCES communes(id),
  location         geography(Point, 4326),
  lat              double precision,
  lng              double precision,
  attrs            jsonb,
  faq              jsonb,
  status           text NOT NULL DEFAULT 'active',
  is_edited        boolean NOT NULL DEFAULT false,
  price_edit_count integer NOT NULL DEFAULT 0,
  click_count      integer NOT NULL DEFAULT 0,
  likes_count      integer NOT NULL DEFAULT 0,
  rating_avg       numeric NOT NULL DEFAULT 0,
  rating_count     integer NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  fts              tsvector
);

CREATE TABLE ad_images (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_id             uuid NOT NULL REFERENCES ads(id) ON DELETE CASCADE,
  path_thumb        text,
  path_medium       text,
  path_large        text,
  position          integer NOT NULL DEFAULT 0,
  imagekit_file_id  text,
  ai_description    text,
  ai_tags           text[]
);

CREATE TABLE ad_reviews (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES users(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  category_id    text,
  subcategory_id text,
  result         jsonb
);

CREATE TABLE price_history (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_id      uuid NOT NULL REFERENCES ads(id) ON DELETE CASCADE,
  old_price  bigint,
  new_price  bigint,
  changed_at timestamptz NOT NULL DEFAULT now()
);


-- ============================================================
-- 5. TABLES — التفاعل الاجتماعي
-- ============================================================

CREATE TABLE likes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id),
  ad_id      uuid NOT NULL REFERENCES ads(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, ad_id)
);

CREATE TABLE follows (
  follower_id  uuid NOT NULL REFERENCES users(id),
  following_id uuid NOT NULL REFERENCES users(id),
  created_at   timestamptz DEFAULT now(),
  PRIMARY KEY (follower_id, following_id)
);

CREATE TABLE blocks (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL REFERENCES users(id),
  blocked_id uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (blocker_id, blocked_id)
);

CREATE TABLE ratings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id),
  target_type text NOT NULL,
  target_id   uuid NOT NULL,
  stars       integer NOT NULL,
  comment     text,
  device_id   text,
  created_at  timestamptz NOT NULL DEFAULT now()
);


-- ============================================================
-- 6. TABLES — المحادثات والرسائل
-- ============================================================

CREATE TABLE conversations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_id      uuid NOT NULL REFERENCES ads(id),
  buyer_id   uuid NOT NULL REFERENCES users(id),
  seller_id  uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       uuid NOT NULL REFERENCES users(id),
  content         text NOT NULL,
  is_read         boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);


-- ============================================================
-- 7. TABLES — الإشعارات والتنبيهات
-- ============================================================

CREATE TABLE notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id),
  type       text NOT NULL,
  ad_id      uuid REFERENCES ads(id),
  message    text,
  is_read    boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE alert_subscriptions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id),
  category_id text NOT NULL REFERENCES categories(id),
  wilaya_id   integer REFERENCES wilayas(id),
  min_price   bigint,
  max_price   bigint,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE push_tokens (
  token      text PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES users(id),
  created_at timestamptz DEFAULT now()
);


-- ============================================================
-- 8. TABLES — التحقق والأمان
-- ============================================================

CREATE TABLE verification_requests (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id),
  phone         text,
  id_front_path text,
  id_back_path  text,
  status        text NOT NULL DEFAULT 'pending',
  reject_reason text,
  reference_no  text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  reviewed_at   timestamptz
);

CREATE TABLE phone_otps (
  phone      text PRIMARY KEY,
  user_id    uuid REFERENCES users(id),
  code_hash  text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts   integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE device_fingerprints (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id),
  device_id  text NOT NULL,
  screen     text,
  network    text,
  created_at timestamptz NOT NULL DEFAULT now()
);


-- ============================================================
-- 9. TABLES — الإحصاء والتتبع
-- ============================================================

CREATE TABLE clicks_raw (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_id      uuid NOT NULL REFERENCES ads(id) ON DELETE CASCADE,
  user_id    uuid REFERENCES users(id),
  wilaya_id  integer,
  daira_id   integer,
  commune_id integer,
  age        integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE clicks_daily (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_id     uuid NOT NULL REFERENCES ads(id) ON DELETE CASCADE,
  day       date NOT NULL,
  wilaya_id integer,
  age_range text,
  count     integer NOT NULL DEFAULT 0,
  UNIQUE (ad_id, day, wilaya_id, age_range)
);

CREATE TABLE interest_scores (
  user_id     uuid NOT NULL REFERENCES users(id),
  category_id text NOT NULL REFERENCES categories(id),
  wilaya_id   integer NOT NULL,
  score       numeric NOT NULL DEFAULT 0,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, category_id, wilaya_id)
);

CREATE TABLE user_activity (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id  uuid NOT NULL REFERENCES users(id),
  page     text,
  duration integer,
  day      date NOT NULL DEFAULT CURRENT_DATE
);

CREATE TABLE image_search_logs (
  user_id     uuid NOT NULL REFERENCES users(id),
  search_date date NOT NULL DEFAULT CURRENT_DATE,
  count       integer NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, search_date)
);

CREATE TABLE agent_rate_logs (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     uuid REFERENCES users(id),
  fingerprint text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE error_logs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid REFERENCES users(id),
  page         text,
  message      text,
  device_model text,
  created_at   timestamptz NOT NULL DEFAULT now()
);


-- ============================================================
-- 10. TABLES — أخرى
-- ============================================================

CREATE TABLE banners (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url  text NOT NULL,
  link       text,
  text       text,
  active     boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0
);

CREATE TABLE reports (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid REFERENCES users(id),
  target_type text NOT NULL,
  target_id   uuid NOT NULL,
  reasons     text[],
  note        text,
  device_id   text,
  status      text NOT NULL DEFAULT 'pending',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE search_cache (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query       text NOT NULL,
  json_result jsonb,
  hits        integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE onboarding_survey (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id),
  source     text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE seller_waitlist (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at   timestamptz NOT NULL DEFAULT now(),
  name         text NOT NULL,
  contact_type text NOT NULL,
  contact      text NOT NULL,
  wilaya       text NOT NULL,
  category     text NOT NULL,
  consent      boolean NOT NULL DEFAULT false
);


-- ============================================================
-- 11. VIEWS
-- ============================================================

CREATE OR REPLACE VIEW ads_feed AS
  SELECT
    a.id, a.user_id, a.title, a.price, a.discount_pct, a.negotiable,
    a.delivery, a.status, a.is_edited, a.category_id, a.subcategory_id,
    a.wilaya_id, a.daira_id, a.commune_id, a.rating_avg, a.rating_count,
    a.likes_count, a.click_count, a.created_at,
    (SELECT i.path_medium FROM ad_images i
     WHERE i.ad_id = a.id AND i.position = 0 LIMIT 1) AS thumb_path,
    u.name AS user_name,
    u.avatar_url AS user_avatar,
    u.is_verified,
    a.lat, a.lng, a.attrs
  FROM ads a
  JOIN users u ON u.id = a.user_id;

CREATE OR REPLACE VIEW seller_public AS
  SELECT
    u.id, u.name, u.avatar_url, u.is_verified, u.last_seen, u.show_phone,
    CASE WHEN u.show_phone THEN u.phone ELSE NULL END AS phone,
    u.facebook, u.instagram, u.tiktok, u.telegram, u.maps_url,
    COALESCE(AVG(r.stars), 0)::numeric(3,2) AS rating_avg,
    COUNT(r.id)::integer AS rating_count,
    u.bio, u.delivery_prices
  FROM users u
  LEFT JOIN ratings r ON r.target_id = u.id AND r.target_type = 'user'
  GROUP BY u.id;


-- ============================================================
-- 12. FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
      AND id = ANY(ARRAY['84468270-415a-4111-9205-9baa9b41e8b0']::uuid[])
  );
$$;
-- ⚠️ غيّري الـ UUID هذا بـ UUID حسابك الجديد

CREATE OR REPLACE FUNCTION fn_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.users (id, email, created_at)
  VALUES (NEW.id, NEW.email, now())
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION fn_click_count()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE ads SET click_count = click_count + 1 WHERE id = NEW.ad_id;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION fn_likes_count()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE ads SET likes_count = likes_count + 1 WHERE id = NEW.ad_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE ads SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.ad_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION fn_messages_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_buyer  uuid;
  v_seller uuid;
BEGIN
  SELECT buyer_id, seller_id INTO v_buyer, v_seller
  FROM conversations WHERE id = NEW.conversation_id;

  IF EXISTS (
    SELECT 1 FROM blocks
    WHERE (blocker_id = v_buyer  AND blocked_id = v_seller)
       OR (blocker_id = v_seller AND blocked_id = v_buyer)
  ) THEN
    RAISE EXCEPTION 'BLOCKED';
  END IF;

  IF char_length(NEW.content) > 300 THEN
    RAISE EXCEPTION 'MSG_TOO_LONG';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION fn_alerts_max()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (SELECT COUNT(*) FROM alert_subscriptions WHERE user_id = NEW.user_id) >= 3 THEN
    RAISE EXCEPTION 'ALERTS_MAX';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_followers_count()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE users SET followers = followers + 1 WHERE id = NEW.following_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE users SET followers = followers - 1 WHERE id = OLD.following_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION notify_alert_match()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF new.status = 'active' AND (tg_op = 'INSERT' OR old.status IS DISTINCT FROM 'active') THEN
    INSERT INTO notifications (user_id, type, ad_id, message)
    SELECT DISTINCT s.user_id, 'alert', new.id,
           '🔔 إعلان جديد يطابق تنبيهك: ' || left(new.title, 60) || ' — ' || new.price || ' دج'
    FROM alert_subscriptions s
    WHERE s.category_id = new.subcategory_id
      AND s.user_id <> new.user_id
      AND (s.wilaya_id IS NULL OR s.wilaya_id = new.wilaya_id)
      AND (s.min_price IS NULL OR new.price >= s.min_price)
      AND (s.max_price IS NULL OR new.price <= s.max_price);
  END IF;
  RETURN new;
END;
$$;

CREATE OR REPLACE FUNCTION notify_price_drop()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF new.price IS NOT NULL AND old.price IS NOT NULL
     AND new.price < old.price AND new.status = 'active' THEN
    INSERT INTO notifications (user_id, type, ad_id, message)
    SELECT l.user_id, 'price_drop', new.id,
           '📉 انخفض سعر إعلان في مفضلتك: ' || left(new.title, 60)
           || ' — من ' || old.price || ' إلى ' || new.price || ' دج'
    FROM likes l
    WHERE l.ad_id = new.id AND l.user_id <> new.user_id;
  END IF;
  RETURN new;
END;
$$;

CREATE OR REPLACE FUNCTION mark_ad_sold(p_ad uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE ads SET status = 'sold', updated_at = now()
  WHERE id = p_ad AND user_id = auth.uid();

  INSERT INTO notifications (user_id, type, ad_id, message)
  SELECT l.user_id, 'ad_sold', p_ad, 'تم بيع إعلان في مفضلتك'
  FROM likes l WHERE l.ad_id = p_ad AND l.user_id <> auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION mark_read(p_conv uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE messages
  SET is_read = true
  WHERE conversation_id = p_conv
    AND sender_id <> auth.uid()
    AND is_read = false;
$$;

CREATE OR REPLACE FUNCTION get_or_create_conversation(p_ad uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_seller uuid;
  v_conv   uuid;
BEGIN
  SELECT user_id INTO v_seller FROM ads WHERE id = p_ad;
  IF v_seller = auth.uid() THEN RAISE EXCEPTION 'OWN_AD'; END IF;
  IF EXISTS (
    SELECT 1 FROM blocks
    WHERE (blocker_id = auth.uid() AND blocked_id = v_seller)
       OR (blocker_id = v_seller   AND blocked_id = auth.uid())
  ) THEN RAISE EXCEPTION 'BLOCKED'; END IF;
  SELECT id INTO v_conv FROM conversations
  WHERE ad_id = p_ad AND buyer_id = auth.uid();
  IF v_conv IS NULL THEN
    INSERT INTO conversations (ad_id, buyer_id, seller_id)
    VALUES (p_ad, auth.uid(), v_seller)
    RETURNING id INTO v_conv;
  END IF;
  RETURN v_conv;
END;
$$;

CREATE OR REPLACE FUNCTION block_status(p_conv uuid)
RETURNS TABLE(i_blocked_them bool, they_blocked_me bool, other_id uuid)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    EXISTS (SELECT 1 FROM blocks WHERE blocker_id = auth.uid() AND blocked_id = other.id),
    EXISTS (SELECT 1 FROM blocks WHERE blocker_id = other.id   AND blocked_id = auth.uid()),
    other.id
  FROM (
    SELECT CASE WHEN buyer_id = auth.uid() THEN seller_id ELSE buyer_id END AS id
    FROM conversations WHERE id = p_conv
  ) AS other;
$$;

CREATE OR REPLACE FUNCTION add_interest(p_category text, p_wilaya integer, p_action text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_points int := CASE p_action
    WHEN 'click'       THEN 1
    WHEN 'like'        THEN 3
    WHEN 'message'     THEN 5
    WHEN 'buy_or_rate' THEN 8
    ELSE 0
  END;
BEGIN
  IF auth.uid() IS NULL OR v_points = 0 THEN RETURN; END IF;
  INSERT INTO interest_scores (user_id, category_id, wilaya_id, score, updated_at)
  VALUES (auth.uid(), p_category, p_wilaya, v_points, now())
  ON CONFLICT (user_id, category_id, wilaya_id)
  DO UPDATE SET score = interest_scores.score + v_points, updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION decay_interests()
RETURNS void LANGUAGE sql AS $$
  UPDATE interest_scores SET score = score * 0.9, updated_at = now() WHERE score > 0.01;
  DELETE FROM interest_scores WHERE score <= 0.01;
$$;

CREATE OR REPLACE FUNCTION aggregate_clicks()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO clicks_daily (ad_id, day, wilaya_id, age_range, count)
  SELECT ad_id, date_trunc('day', created_at)::date, wilaya_id,
    CASE WHEN age < 18 THEN '<18' WHEN age < 25 THEN '18-24'
         WHEN age < 35 THEN '25-34' WHEN age < 45 THEN '35-44' ELSE '45+' END,
    COUNT(*)
  FROM clicks_raw
  WHERE created_at < date_trunc('day', now())
  GROUP BY 1, 2, 3, 4
  ON CONFLICT DO NOTHING;
  DELETE FROM clicks_raw WHERE created_at < date_trunc('day', now());
END;
$$;

CREATE OR REPLACE FUNCTION search_ad_ids(p_q text)
RETURNS TABLE(id uuid) LANGUAGE sql STABLE AS $$
  SELECT a.id FROM ads a
  WHERE a.status = 'active'
    AND (
      to_tsvector('simple', unaccent(a.title))       @@ plainto_tsquery('simple', unaccent(p_q))
   OR to_tsvector('simple', unaccent(a.description)) @@ plainto_tsquery('simple', unaccent(p_q))
   OR a.title       ILIKE '%' || p_q || '%'
   OR a.description ILIKE '%' || p_q || '%'
    )
  ORDER BY CASE WHEN a.title ILIKE '%' || p_q || '%' THEN 0 ELSE 1 END, a.created_at DESC
  LIMIT 200;
$$;

CREATE OR REPLACE FUNCTION did_you_mean(p_q text)
RETURNS TABLE(term text) LANGUAGE sql STABLE AS $$
  SELECT term FROM (
    SELECT DISTINCT title AS term,
           similarity(unaccent(lower(title)), unaccent(lower(p_q))) AS sim
    FROM ads WHERE status = 'active'
      AND similarity(unaccent(lower(title)), unaccent(lower(p_q))) > 0.2
  ) sub
  ORDER BY sim DESC LIMIT 5;
$$;

CREATE OR REPLACE FUNCTION profile_stats(p_user uuid)
RETURNS TABLE(followers bigint, ads_count bigint, rating_avg numeric, rating_count bigint)
LANGUAGE sql STABLE AS $$
  SELECT
    (SELECT COUNT(*) FROM follows WHERE following_id = p_user)::bigint,
    (SELECT COUNT(*) FROM ads WHERE user_id = p_user AND status <> 'deleted')::bigint,
    COALESCE((SELECT AVG(stars) FROM ratings WHERE target_id = p_user AND target_type = 'user'), 0)::numeric(3,2),
    (SELECT COUNT(*) FROM ratings WHERE target_id = p_user AND target_type = 'user')::bigint;
$$;

CREATE OR REPLACE FUNCTION admin_overview()
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  RETURN json_build_object(
    'users',                 (SELECT COUNT(*) FROM users),
    'ads',                   (SELECT COUNT(*) FROM ads),
    'active_ads',            (SELECT COUNT(*) FROM ads WHERE status = 'active'),
    'reports_pending',       (SELECT COUNT(*) FROM reports WHERE status = 'pending'),
    'verifications_pending', (SELECT COUNT(*) FROM verification_requests WHERE status = 'pending')
  );
END;
$$;

CREATE OR REPLACE FUNCTION save_push_token(p_token text)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  INSERT INTO push_tokens(token, user_id) VALUES (p_token, auth.uid())
  ON CONFLICT (token) DO UPDATE SET user_id = auth.uid(), created_at = now();
$$;

CREATE OR REPLACE FUNCTION increment_image_search_log(p_user uuid, p_date date)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO image_search_logs (user_id, search_date, count) VALUES (p_user, p_date, 1)
  ON CONFLICT (user_id, search_date)
  DO UPDATE SET count = image_search_logs.count + 1;
END;
$$;

CREATE OR REPLACE FUNCTION search_by_image_tags(p_tags text[])
RETURNS TABLE(ad_id uuid, match_count bigint) LANGUAGE sql STABLE AS $$
  SELECT i.ad_id, COUNT(*) AS match_count
  FROM ad_images i
  WHERE i.ai_tags && p_tags
    AND EXISTS (SELECT 1 FROM ads a WHERE a.id = i.ad_id AND a.status = 'active')
  GROUP BY i.ad_id ORDER BY match_count DESC LIMIT 50;
$$;

CREATE OR REPLACE FUNCTION claim_ad_review(p_user uuid, p_limit int)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE used int; rid uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('ad_review:' || p_user::text));
  SELECT count(*) INTO used FROM public.ad_reviews
   WHERE user_id = p_user AND created_at > now() - interval '24 hours';
  IF used >= p_limit THEN
    RETURN jsonb_build_object('allowed', false, 'remaining', 0);
  END IF;
  INSERT INTO public.ad_reviews (user_id) VALUES (p_user) RETURNING id INTO rid;
  RETURN jsonb_build_object('allowed', true, 'remaining', p_limit - used - 1, 'review_id', rid);
END;
$$;

CREATE OR REPLACE FUNCTION request_phone_otp(p_phone text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_code text := lpad(floor(random() * 1000000)::text, 6, '0');
BEGIN
  INSERT INTO phone_otps (phone, user_id, code_hash, expires_at, attempts)
  VALUES (p_phone, auth.uid(), crypt(v_code, gen_salt('bf')), now() + interval '10 minutes', 0)
  ON CONFLICT (phone) DO UPDATE
    SET code_hash = crypt(v_code, gen_salt('bf')),
        expires_at = now() + interval '10 minutes',
        attempts = 0;
  RAISE NOTICE 'OTP for %: %', p_phone, v_code;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION home_feed(p_limit int DEFAULT 20, p_offset int DEFAULT 0)
RETURNS TABLE(
  id uuid, user_id uuid, title text, price bigint, discount_pct integer,
  negotiable boolean, delivery boolean, status text, is_edited boolean,
  category_id text, subcategory_id text, wilaya_id integer, daira_id integer,
  commune_id integer, rating_avg numeric, rating_count integer, likes_count integer,
  click_count integer, created_at timestamptz, thumb_path text,
  user_name text, user_avatar text, is_verified boolean
) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH cand AS (
    SELECT af.* FROM ads_feed af
    WHERE af.status = 'active' AND af.user_id IS DISTINCT FROM auth.uid()
    ORDER BY af.created_at DESC LIMIT 2000
  ),
  cat AS (
    SELECT category_id, SUM(score) AS total
    FROM interest_scores WHERE user_id = auth.uid() GROUP BY category_id
  ),
  scored AS (
    SELECT c.*,
           COALESCE(ct.total, 0) + 0.5 * COALESCE(w.score, 0)
             + CASE WHEN c.is_verified THEN 2 ELSE 0 END AS _score
    FROM cand c
    LEFT JOIN cat ct ON ct.category_id = c.subcategory_id
    LEFT JOIN interest_scores w
           ON w.user_id = auth.uid()
          AND w.category_id = c.subcategory_id AND w.wilaya_id = c.wilaya_id
  ),
  ranked AS (
    SELECT s.*,
           ROW_NUMBER() OVER (ORDER BY s._score DESC, s.created_at DESC, s.id) AS ra,
           ROW_NUMBER() OVER (ORDER BY hashtext(s.id::text || COALESCE(auth.uid()::text, '') || current_date::text), s.id) AS rb
    FROM scored s
  )
  SELECT id, user_id, title, price, discount_pct, negotiable, delivery,
         status, is_edited, category_id, subcategory_id, wilaya_id,
         daira_id, commune_id, rating_avg, rating_count, likes_count,
         click_count, created_at, thumb_path, user_name, user_avatar, is_verified
  FROM ranked
  ORDER BY LEAST(
    ((ra - 1) / 7) * 10 + ((ra - 1) % 7),
    ((rb - 1) / 3) * 10 + 7 + ((rb - 1) % 3)
  ), id
  LIMIT p_limit OFFSET p_offset;
$$;

CREATE OR REPLACE FUNCTION nearby_ads(p_lat double precision, p_lng double precision, p_limit int DEFAULT 20, p_offset int DEFAULT 0)
RETURNS TABLE(
  id uuid, user_id uuid, title text, price bigint, discount_pct integer,
  negotiable boolean, delivery boolean, status text, is_edited boolean,
  category_id text, subcategory_id text, wilaya_id integer, daira_id integer,
  commune_id integer, rating_avg numeric, rating_count integer, likes_count integer,
  click_count integer, created_at timestamptz, thumb_path text,
  user_name text, user_avatar text, is_verified boolean, lat double precision,
  lng double precision, attrs jsonb, distance_km double precision
) LANGUAGE sql STABLE AS $$
  SELECT af.*, ST_Distance(a.location::geometry,
         ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)) / 1000 AS distance_km
  FROM ads_feed af JOIN ads a ON a.id = af.id
  WHERE af.status = 'active' AND a.location IS NOT NULL
  ORDER BY a.location <-> ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)
  LIMIT p_limit OFFSET p_offset;
$$;

CREATE OR REPLACE FUNCTION my_conversations()
RETURNS TABLE(
  id uuid, other_name text, other_avatar text, ad_title text,
  last_message text, unread bigint
) LANGUAGE sql SECURITY DEFINER AS $$
  SELECT c.id, u.name, u.avatar_url, a.title,
    (SELECT content FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1),
    (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND m.sender_id <> auth.uid() AND m.is_read = false)
  FROM conversations c
  JOIN ads a ON a.id = c.ad_id
  JOIN users u ON u.id = CASE WHEN c.buyer_id = auth.uid() THEN c.seller_id ELSE c.buyer_id END
  WHERE c.buyer_id = auth.uid() OR c.seller_id = auth.uid()
  ORDER BY (SELECT created_at FROM messages m WHERE m.conversation_id = c.id ORDER BY created_at DESC LIMIT 1) DESC NULLS LAST;
$$;

CREATE OR REPLACE FUNCTION ad_stats_v2(p_ad uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_result jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM ads WHERE id = p_ad AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  SELECT jsonb_build_object(
    'totals', jsonb_build_object(
      'clicks',   (SELECT click_count FROM ads WHERE id = p_ad),
      'likes',    (SELECT likes_count FROM ads WHERE id = p_ad),
      'messages', (SELECT count(*) FROM messages m JOIN conversations c ON c.id = m.conversation_id WHERE c.ad_id = p_ad)
    ),
    'clicks_by_wilaya', COALESCE((SELECT jsonb_agg(jsonb_build_object('wilaya_id', t.wilaya_id, 'count', t.n))
      FROM (SELECT wilaya_id, count(*) n FROM clicks_raw WHERE ad_id = p_ad GROUP BY wilaya_id) t), '[]'),
    'clicks_by_age', COALESCE((SELECT jsonb_agg(jsonb_build_object('age_range', t.r, 'count', t.n))
      FROM (SELECT CASE WHEN age < 18 THEN '<18' WHEN age < 25 THEN '18-24' WHEN age < 35 THEN '25-34'
                        WHEN age < 45 THEN '35-44' ELSE '45+' END r, count(*) n
            FROM clicks_raw WHERE ad_id = p_ad AND age IS NOT NULL GROUP BY 1) t), '[]'),
    'likes_by_wilaya', COALESCE((SELECT jsonb_agg(jsonb_build_object('wilaya_id', t.wilaya_id, 'count', t.n))
      FROM (SELECT u.wilaya_id, count(*) n FROM likes l JOIN users u ON u.id = l.user_id WHERE l.ad_id = p_ad GROUP BY u.wilaya_id) t), '[]'),
    'messages_by_wilaya', COALESCE((SELECT jsonb_agg(jsonb_build_object('wilaya_id', t.wilaya_id, 'count', t.n))
      FROM (SELECT u.wilaya_id, count(*) n FROM messages m JOIN conversations c ON c.id = m.conversation_id
            JOIN users u ON u.id = m.sender_id WHERE c.ad_id = p_ad AND m.sender_id <> auth.uid() GROUP BY u.wilaya_id) t), '[]')
  ) INTO v_result;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION orphan_image_paths(p_hours int DEFAULT 24)
RETURNS TABLE(name text) LANGUAGE sql SECURITY DEFINER AS $$
  SELECT o.name FROM storage.objects o
  WHERE o.bucket_id = 'ad-images'
    AND o.created_at < now() - (p_hours || ' hours')::interval
    AND NOT EXISTS (
      SELECT 1 FROM ad_images ai
      WHERE ai.path_thumb = o.name OR ai.path_medium = o.name OR ai.path_large = o.name
    );
$$;


-- ============================================================
-- 13. TRIGGERS
-- ============================================================

-- مستخدم جديد (على جدول auth.users)
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION fn_new_user();

-- عدّاد النقرات
CREATE OR REPLACE TRIGGER trg_click_count
  AFTER INSERT ON clicks_raw
  FOR EACH ROW EXECUTE FUNCTION fn_click_count();

-- عدّاد الإعجابات
CREATE OR REPLACE TRIGGER trg_likes_count
  AFTER INSERT OR DELETE ON likes
  FOR EACH ROW EXECUTE FUNCTION fn_likes_count();

-- حارس الرسائل
CREATE OR REPLACE TRIGGER trg_messages_guard
  BEFORE INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION fn_messages_guard();

-- حد التنبيهات
CREATE OR REPLACE TRIGGER trg_alerts_max
  BEFORE INSERT ON alert_subscriptions
  FOR EACH ROW EXECUTE FUNCTION fn_alerts_max();

-- عداد المتابعين
CREATE OR REPLACE TRIGGER trg_followers_count
  AFTER INSERT OR DELETE ON follows
  FOR EACH ROW EXECUTE FUNCTION update_followers_count();

-- إشعار تنبيه إعلان جديد
CREATE OR REPLACE TRIGGER trg_notify_alert
  AFTER INSERT OR UPDATE OF status ON ads
  FOR EACH ROW EXECUTE FUNCTION notify_alert_match();

-- إشعار انخفاض السعر
CREATE OR REPLACE TRIGGER trg_notify_price_drop
  AFTER UPDATE OF price ON ads
  FOR EACH ROW EXECUTE FUNCTION notify_price_drop();


-- ============================================================
-- 14. ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE users               ENABLE ROW LEVEL SECURITY;
ALTER TABLE ads                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_images           ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_reviews          ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes               ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows             ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocks              ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings             ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages            ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications       ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_tokens         ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE phone_otps          ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_fingerprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE clicks_raw          ENABLE ROW LEVEL SECURITY;
ALTER TABLE clicks_daily        ENABLE ROW LEVEL SECURITY;
ALTER TABLE interest_scores     ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activity       ENABLE ROW LEVEL SECURITY;
ALTER TABLE image_search_logs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_rate_logs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE error_logs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE banners             ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports             ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_cache        ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_survey   ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_history       ENABLE ROW LEVEL SECURITY;
ALTER TABLE wilayas             ENABLE ROW LEVEL SECURITY;
ALTER TABLE dairas              ENABLE ROW LEVEL SECURITY;
ALTER TABLE communes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories          ENABLE ROW LEVEL SECURITY;

-- users
CREATE POLICY "user can insert own row" ON users FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "own read"   ON users FOR SELECT USING (id = auth.uid());
CREATE POLICY "own update" ON users FOR UPDATE USING (id = auth.uid());

-- ads
CREATE POLICY "public read active" ON ads FOR SELECT USING (status = ANY (ARRAY['active','sold']));
CREATE POLICY "owner read own"     ON ads FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "auth insert"        ON ads FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "owner update"       ON ads FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "owner delete"       ON ads FOR DELETE USING (user_id = auth.uid());

-- ad_images
CREATE POLICY "public read"    ON ad_images FOR SELECT USING (true);
CREATE POLICY "owner insert"   ON ad_images FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM ads WHERE ads.id = ad_images.ad_id AND ads.user_id = auth.uid()));
CREATE POLICY "owner delete"   ON ad_images FOR DELETE USING (EXISTS (SELECT 1 FROM ads WHERE ads.id = ad_images.ad_id AND ads.user_id = auth.uid()));

-- likes
CREATE POLICY "own read"   ON likes FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "own insert" ON likes FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "own delete" ON likes FOR DELETE USING (user_id = auth.uid());

-- follows
CREATE POLICY "الكل يقرأ"           ON follows FOR SELECT USING (true);
CREATE POLICY "يمكن للمستخدم المتابعة" ON follows FOR ALL USING (auth.uid() = follower_id);

-- blocks
CREATE POLICY "own read"   ON blocks FOR SELECT USING (blocker_id = auth.uid());
CREATE POLICY "own insert" ON blocks FOR INSERT WITH CHECK (blocker_id = auth.uid());
CREATE POLICY "own delete" ON blocks FOR DELETE USING (blocker_id = auth.uid());

-- ratings
CREATE POLICY "public read" ON ratings FOR SELECT USING (true);
CREATE POLICY "owner delete" ON ratings FOR DELETE USING (user_id = auth.uid());

-- conversations
CREATE POLICY "participant read"  ON conversations FOR SELECT USING (buyer_id = auth.uid() OR seller_id = auth.uid());
CREATE POLICY "buyer insert"      ON conversations FOR INSERT WITH CHECK (buyer_id = auth.uid());

-- messages
CREATE POLICY "participant read"   ON messages FOR SELECT USING (EXISTS (SELECT 1 FROM conversations c WHERE c.id = messages.conversation_id AND (c.buyer_id = auth.uid() OR c.seller_id = auth.uid())));
CREATE POLICY "participant insert" ON messages FOR INSERT WITH CHECK (sender_id = auth.uid() AND EXISTS (SELECT 1 FROM conversations c WHERE c.id = messages.conversation_id AND (c.buyer_id = auth.uid() OR c.seller_id = auth.uid())));

-- notifications
CREATE POLICY "own read"   ON notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "own update" ON notifications FOR UPDATE USING (user_id = auth.uid());

-- alert_subscriptions
CREATE POLICY "own all"    ON alert_subscriptions FOR ALL USING (user_id = auth.uid());
CREATE POLICY "own insert" ON alert_subscriptions FOR INSERT WITH CHECK (user_id = auth.uid());

-- push_tokens
CREATE POLICY "own tokens read"   ON push_tokens FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "own tokens delete" ON push_tokens FOR DELETE USING (user_id = auth.uid());

-- verification_requests
CREATE POLICY "own read"   ON verification_requests FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "own insert" ON verification_requests FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "admin all"  ON verification_requests FOR ALL USING (is_admin());

-- phone_otps
CREATE POLICY "own read" ON phone_otps FOR SELECT USING (user_id = auth.uid());

-- device_fingerprints
CREATE POLICY "own all"    ON device_fingerprints FOR ALL USING (user_id = auth.uid());
CREATE POLICY "own insert" ON device_fingerprints FOR INSERT WITH CHECK (user_id = auth.uid());

-- interest_scores
CREATE POLICY "own all" ON interest_scores FOR ALL USING (user_id = auth.uid());

-- clicks_raw
CREATE POLICY "auth insert" ON clicks_raw FOR INSERT WITH CHECK (true);

-- clicks_daily
CREATE POLICY "admin read" ON clicks_daily FOR SELECT USING (is_admin());

-- user_activity
CREATE POLICY "own insert" ON user_activity FOR INSERT WITH CHECK (user_id = auth.uid());

-- image_search_logs
CREATE POLICY "user_own_logs_select" ON image_search_logs FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "user_own_logs_insert" ON image_search_logs FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "user_own_logs_update" ON image_search_logs FOR UPDATE USING (user_id = auth.uid());

-- agent_rate_logs
CREATE POLICY "no_public_access" ON agent_rate_logs FOR ALL USING (false);

-- error_logs
CREATE POLICY "auth insert" ON error_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "admin read"  ON error_logs FOR SELECT USING (is_admin());

-- banners
CREATE POLICY "public read" ON banners FOR SELECT USING (active = true);
CREATE POLICY "admin all"   ON banners FOR ALL USING (is_admin());

-- reports
CREATE POLICY "auth insert" ON reports FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "admin read"  ON reports FOR SELECT USING (is_admin());
CREATE POLICY "admin update" ON reports FOR UPDATE USING (is_admin());

-- search_cache
CREATE POLICY "public read" ON search_cache FOR SELECT USING (true);
CREATE POLICY "admin all"   ON search_cache FOR ALL USING (is_admin());

-- onboarding_survey
CREATE POLICY "own insert" ON onboarding_survey FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "admin read" ON onboarding_survey FOR SELECT USING (is_admin());

-- price_history
CREATE POLICY "public read" ON price_history FOR SELECT USING (true);

-- geographic tables
CREATE POLICY "public read" ON wilayas   FOR SELECT USING (true);
CREATE POLICY "public read" ON dairas    FOR SELECT USING (true);
CREATE POLICY "public read" ON communes  FOR SELECT USING (true);
CREATE POLICY "public read" ON categories FOR SELECT USING (true);
CREATE POLICY "admin insert categories" ON categories FOR INSERT WITH CHECK ((auth.jwt() ->> 'role') = 'admin');
CREATE POLICY "admin update categories" ON categories FOR UPDATE USING ((auth.jwt() ->> 'role') = 'admin') WITH CHECK ((auth.jwt() ->> 'role') = 'admin');

-- seller_waitlist
CREATE POLICY "public can submit seller interest" ON seller_waitlist FOR INSERT WITH CHECK (consent = true);


-- ============================================================
-- 15. STORAGE BUCKETS (شغّليها يدوياً من Dashboard أو API)
-- ============================================================
-- INSERT INTO storage.buckets (id, name, public) VALUES ('ad-images', 'ad-images', true);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('verifications', 'verifications', false);


-- ============================================================
-- ⚠️  تذكير: بعد تطبيق هذا الملف
-- 1. غيّري UUID في is_admin() بـ UUID حسابك الجديد
-- 2. أنشئي Storage Buckets من Dashboard
-- 3. أنشئي Edge Functions: smart-agent
-- 4. أضيفي بيانات wilayas/dairas/communes من ملفات data/
-- ============================================================
