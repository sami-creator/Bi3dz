/* moderate.js — فحص محتوى الصور عبر worker خارجي + تحليل نصي بالأوزان
   لا يتطلب أي مفاتيح أو edge functions
   الفشل → fail-open (يُسمح بالرفع)
   + إضافة: score و description في النتيجة للتشخيص */
(function () {
  'use strict';

  const WORKER_URL = 'https://nsfw-checker.houssemhoussam25.workers.dev';
  const TIMEOUT_MS = 45000;

  /* ================================================================
     قاموس الكلمات المحظورة مع أوزانها
     ================================================================ */
  const CATEGORIES = {

    sexual: {
      label: 'محتوى إباحي',
      words: {
        nude:10, nudity:10, naked:10, explicit:9, pornographic:10,
        pornography:10, porn:10, genitals:10, penis:10, vagina:10,
        vulva:10, phallus:10, scrotum:10, anus:9, buttocks:8,
        nipple:9, nipples:9, areola:9, topless:9, bottomless:9,
        intercourse:10, orgasm:10, masturbation:10, ejaculation:10,
        erection:10, blowjob:10, fellatio:10, cunnilingus:10,
        anal:9, penetration:10, threesome:10, orgy:10,
        erotic:8, sexual:8, sex:8, seductive:6, provocative:6,
        revealing:5, skimpy:5, lingerie:6, bikini:3, underwear:5,
        cleavage:6, breast:7, breasts:7, bra:4, thong:6,
        intimate:5, sensual:6, aroused:7, lust:7, lustful:7,
        suggestive:6, seduction:6, voyeur:9,
        onlyfans:9, escort:8, prostitute:10, prostitution:10,
        stripper:8, striptease:9,
      }
    },

    drugs: {
      label: 'مخدرات',
      words: {
        cocaine:10, heroin:10, marijuana:9, cannabis:9, weed:8,
        meth:10, methamphetamine:10, crack:9, ecstasy:9, mdma:10,
        lsd:10, ketamine:9, fentanyl:10, oxycodone:9,
        amphetamine:9, morphine:8, opium:9, hashish:9, khat:7,
        shrooms:8, psychedelics:8, dmt:10,
        snort:8, inject:7, overdose:9,
        syringe:8, needle:6, bong:7,
        drug:9, drugs:9, narcotic:9, narcotics:9, dope:7,
        pills:6, pill:5, powder:4,
      }
    },

    violence: {
      label: 'عنف',
      words: {
        blood:7, bloody:7, gore:10, gory:9, wound:7, wounds:7,
        injury:6, bleeding:7, bruise:5, laceration:7,
        severed:9, decapitated:10, dismembered:10, mutilated:10,
        gun:6, rifle:7, pistol:6, shotgun:7,
        knife:6, machete:8, grenade:8, bomb:8, explosive:8,
        weapon:7, weapons:7,
        murder:9, kill:7, killing:8, slaughter:9, massacre:10,
        execution:9, torture:10, assault:7,
        stab:8, stabbing:8, shooting:7,
        dead:6, corpse:9, skull:6,
        violence:8, brutal:8, beating:7,
      }
    },

    meds: {
      label: 'أدوية مشبوهة',
      words: {
        xanax:8, valium:7, tramadol:8, codeine:7,
        oxycontin:9, hydrocodone:9,
        counterfeit:8, fake_pills:9,
      }
    },

    hate: {
      label: 'كراهية وتمييز',
      words: {
        racist:9, racism:9, nazi:10, fascist:8,
        antisemitic:9, kkk:10, genocide:10,
        hate_speech:9, bigot:7, xenophobic:8,
        islamophobic:8, homophobic:8,
      }
    },

    politics: {
      label: 'محتوى سياسي',
      words: {
        propaganda:7, extremist:8, terrorist:9, terrorism:9,
        jihad:8, radical:6, insurgent:7,
      }
    },

    alcohol: {
      label: 'كحول',
      words: {
        alcohol:5, drunk:6, intoxicated:7,
        beer:4, wine:4, vodka:5, whiskey:5, liquor:5,
      }
    },

    tobacco: {
      label: 'تبغ',
      words: {
        cigarette:5, cigarettes:5, smoking:5,
        tobacco:5, cigar:5, vape:4, vaping:5,
        hookah:4, shisha:4,
      }
    },

    other: {
      label: 'محتوى مزعج',
      words: {
        disturbing:6, graphic:5, offensive:5,
        disgusting:5, grotesque:7, shocking:5, inappropriate:5,
      }
    }
  };

  const THRESHOLD_UNSAFE  = 10;
  const THRESHOLD_WARNING =  4;

  /* ================================================================
     تحليل الوصف النصي المُعاد من الـ worker
     يُعيد: { verdict, reasons, score, foundWords }
     ================================================================ */
  function analyzeText(text) {
    const lower = text.toLowerCase();
    let totalScore = 0;
    const reasons = [];
    const foundWords = [];

    for (const [, cat] of Object.entries(CATEGORIES)) {
      let catScore = 0;
      for (const [word, weight] of Object.entries(cat.words)) {
        const matches = lower.match(new RegExp(`\\b${word.replace(/_/g, '\\s+')}\\b`, 'g'));
        if (matches) {
          catScore += weight * matches.length;
          matches.forEach(() => foundWords.push(word + '(' + weight + ')'));
        }
      }
      if (catScore > 0) { totalScore += catScore; reasons.push(cat.label); }
    }

    let verdict = 'SAFE';
    if      (totalScore >= THRESHOLD_UNSAFE)  verdict = 'UNSAFE';
    else if (totalScore >= THRESHOLD_WARNING) verdict = 'WARNING';

    return { verdict, reasons, score: totalScore, foundWords };
  }

  /* ================================================================
     فحص ملف واحد: إرسال للـ worker → تحليل الوصف
     الفشل دائمًا → { ok: true, skipped: true }
     ================================================================ */
  async function checkFile(file) {
    try {
      const buffer = await file.arrayBuffer();
      const ctrl   = new AbortController();
      const timer  = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

      const res = await fetch(WORKER_URL, {
        method: 'POST',
        body:   buffer,
        signal: ctrl.signal
      }).finally(() => clearTimeout(timer));

      if (!res.ok) return { ok: true, skipped: true };

      const data        = await res.json();
      const description = (data.result && data.result.description) || '';
      if (!description) return { ok: true, skipped: true };

      const { verdict, reasons, score, foundWords } = analyzeText(description);
      if (verdict === 'SAFE') return { ok: true, score, description };
      return { ok: false, verdict, reasons, score, description, foundWords };

    } catch {
      return { ok: true, skipped: true };   // timeout أو خطأ شبكة → fail-open
    }
  }

  /* فحص عدة ملفات بالتوازي */
  function checkFiles(files) {
    return Promise.all(Array.from(files).map(f => checkFile(f)));
  }

  window.Moderate = { checkFile, checkFiles, analyzeText };
})();