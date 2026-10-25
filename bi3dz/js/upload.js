/* upload.js — تحقق (MIME + امتداد + magic bytes + حجم) وضغط WebP بـ3 أحجام قبل الرفع إلى ImageKit
   + فحص محتوى الصور عبر moderate.js (fail-open: الفشل لا يوقف الرفع)
   + نافذة تحذير موحّدة تعرض جميع الصور المشبوهة/الممنوعة كقائمة واحدة قابلة للتمرير */
(function () {
  'use strict';
  const C = window.CONFIG, U = C.UPLOAD, L = C.LIMITS;

  async function magicOk(file) {
    const b = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    const jpg  = b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF;
    const png  = b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47;
    const webp = b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
                 b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50;
    return jpg || png || webp;
  }

  function toBlob(canvas, type, q) { return new Promise(r => canvas.toBlob(r, type, q)); }

  async function resize(bitmap, maxSide) {
    const s  = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const w  = Math.round(bitmap.width * s), h = Math.round(bitmap.height * s);
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    cv.getContext('2d').drawImage(bitmap, 0, 0, w, h);
    let blob = await toBlob(cv, 'image/webp', U.WEBP_QUALITY);
    if (!blob || blob.type !== 'image/webp') blob = await toBlob(cv, 'image/jpeg', U.WEBP_QUALITY);
    return blob;
  }

  /* ---- ImageKit ---- */
  async function uploadToImageKit(blob, fileName) {
    const env = window.__ENV__ || {};
    const publicKey   = env.IMAGEKIT_PUBLIC_KEY;
    const urlEndpoint = env.IMAGEKIT_URL_ENDPOINT;
    if (!publicKey || !urlEndpoint) throw new Error('ImageKit غير مضبوط في env.js');

    const { data: authData, error: authError } = await SB.db.functions.invoke('imagekit-auth');
    if (authError) throw authError;

    const formData = new FormData();
    formData.append('file',      blob, fileName);
    formData.append('fileName',  fileName);
    formData.append('publicKey', publicKey);
    formData.append('signature', authData.signature);
    formData.append('expire',    authData.expire);
    formData.append('token',     authData.token);
    formData.append('folder',    authData.folder || '/ads');

    const res = await fetch('https://upload.imagekit.io/api/v1/files/upload', {
      method: 'POST', body: formData
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.message || 'ImageKit upload failed'); }
    const r = await res.json();
    return { url: r.url, fileId: r.fileId };
  }

  /* ================================================================
     نافذة تحذير موحّدة (queue) لجميع الصور المشبوهة/الممنوعة
     ================================================================ */
  let _modItems = [];   // { id, fileName, verdict, reasons, file, previewUrl, onContinue, onRemove, resolved }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function injectModStyles() {
    if (document.getElementById('mod-styles')) return;
    const style = document.createElement('style');
    style.id = 'mod-styles';
    style.textContent = `
      .mod-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.7); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 16px; }
      .mod-dialog { background: #fff; border-radius: 12px; max-width: 560px; width: 100%; max-height: 88vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,.35); }
      .mod-header { padding: 14px 18px; font-weight: bold; color: #fff; display: flex; align-items: center; gap: 8px; font-size: 1rem; }
      .mod-header--unsafe { background: #c00; }
      .mod-header--warning { background: #e68a00; }
      .mod-header--mixed { background: #8a2be2; }
      .mod-body { padding: 12px; overflow-y: auto; flex: 1; -webkit-overflow-scrolling: touch; }
      .mod-body::-webkit-scrollbar { width: 8px; }
      .mod-body::-webkit-scrollbar-thumb { background: #ccc; border-radius: 4px; }
      .mod-item { display: flex; gap: 12px; padding: 12px; border-radius: 10px; border: 1px solid #eee; margin-bottom: 10px; background: #fafafa; }
      .mod-item--unsafe { border-color: #c00; background: rgba(200,0,0,.04); }
      .mod-item--warning { border-color: #e68a00; background: rgba(230,138,0,.06); }
      .mod-thumb { width: 76px; height: 76px; object-fit: cover; border-radius: 8px; flex-shrink: 0; border: 1px solid #ddd; background: #f0f0f0; }
      .mod-item-content { flex: 1; min-width: 0; }
      .mod-item-name { font-size: .78rem; color: #666; margin-bottom: 4px; word-break: break-all; }
      .mod-item-verdict { font-weight: bold; font-size: .92rem; margin-bottom: 6px; }
      .mod-item-verdict--unsafe { color: #c00; }
      .mod-item-verdict--warning { color: #b36b00; }
      .mod-reasons { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 8px; }
      .mod-reason-tag { background: #eaeaea; color: #333; font-size: .72rem; padding: 2px 8px; border-radius: 10px; }
      .mod-item-actions { display: flex; gap: 8px; flex-wrap: wrap; }
      .mod-item-actions .btn { padding: 6px 12px; font-size: .8rem; }
    `;
    document.head.appendChild(style);
  }

  function renderModDialog() {
    injectModStyles();
    let overlay = document.getElementById('mod-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'mod-overlay';
      overlay.className = 'mod-overlay';
      document.body.appendChild(overlay);
    }

    const pending = _modItems.filter(it => !it.resolved);
    if (!pending.length) {
      // نظّف الروابط والأحداث
      _modItems.forEach(it => { if (it.previewUrl) { try { URL.revokeObjectURL(it.previewUrl); } catch {} } });
      _modItems = [];
      overlay.remove();
      return;
    }

    const unsafeCount  = pending.filter(it => it.verdict === 'UNSAFE').length;
    const warningCount = pending.filter(it => it.verdict === 'WARNING').length;
    let headerCls, headerIcon, headerText;
    if (unsafeCount > 0 && warningCount > 0) {
      headerCls = 'mixed'; headerIcon = '🚫⚠️';
      headerText = `${unsafeCount} صورة ممنوعة + ${warningCount} صورة مشبوهة`;
    } else if (unsafeCount > 0) {
      headerCls = 'unsafe'; headerIcon = '🚫';
      headerText = unsafeCount === 1 ? 'صورة ممنوعة' : `${unsafeCount} صور ممنوعة`;
    } else {
      headerCls = 'warning'; headerIcon = '⚠️';
      headerText = warningCount === 1 ? 'صورة مشبوهة' : `${warningCount} صور مشبوهة`;
    }

    overlay.innerHTML = `
      <div class="mod-dialog" role="dialog" aria-modal="true">
        <div class="mod-header mod-header--${headerCls}">
          <span class="mod-icon">${headerIcon}</span>
          <span>${headerText}</span>
        </div>
        <div class="mod-body">
          ${pending.map((it, idx) => {
            const isUnsafe = it.verdict === 'UNSAFE';
            const cls = isUnsafe ? 'unsafe' : 'warning';
            return `
              <div class="mod-item mod-item--${cls}" data-id="${it.id}">
                ${it.previewUrl ? `<img class="mod-thumb" src="${it.previewUrl}" alt="">` : ''}
                <div class="mod-item-content">
                  <div class="mod-item-name">${idx + 1}. ${escapeHtml(it.fileName)}</div>
                  <div class="mod-item-verdict mod-item-verdict--${cls}">
                    ${isUnsafe ? '🚫 صورة ممنوعة — يجب إزالتها' : '⚠️ صورة مشبوهة — تخضع للمراجعة'}
                  </div>
                  <div class="mod-reasons">${(it.reasons || []).map(r => `<span class="mod-reason-tag">${escapeHtml(r)}</span>`).join('')}</div>
                  <div class="mod-item-actions">
                    <button class="btn btn--ghost mod-btn-remove" data-id="${it.id}">🗑 إزالة</button>
                    ${isUnsafe ? '' : `<button class="btn btn--primary mod-btn-continue" data-id="${it.id}">متابعة</button>`}
                  </div>
                </div>
              </div>`;
          }).join('')}
        </div>
      </div>`;

    overlay.querySelectorAll('.mod-btn-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const it = _modItems.find(x => x.id === id);
        if (it && !it.resolved) { it.resolved = true; try { it.onRemove && it.onRemove(); } catch (e) { console.error(e); } }
        renderModDialog();
      });
    });
    overlay.querySelectorAll('.mod-btn-continue').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const it = _modItems.find(x => x.id === id);
        if (it && !it.resolved) { it.resolved = true; try { it.onContinue && it.onContinue(); } catch (e) { console.error(e); } }
        renderModDialog();
      });
    });
  }

  /* إضافة عنصر إلى نافذة التحذير — التوقيع متوافق مع الاستدعاءات القديمة
     الوسيط السادس (file) اختياري: إن مُرِّر تُعرض صورة مصغّرة */
  function showModerationWarning(fileName, verdict, reasons, onContinue, onRemove, file) {
    const previewUrl = file && window.URL && URL.createObjectURL ? URL.createObjectURL(file) : null;
    const id = 'mod-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    _modItems.push({ id, fileName, verdict, reasons: reasons || [], file, previewUrl, onContinue, onRemove, resolved: false });
    renderModDialog();
  }

  /* إزالة كل تحذيرات ملف معيّن (مفيد عند حذف الصورة من المعاينة) */
  function clearModerationWarningsFor(file) {
    let changed = false;
    _modItems.forEach(it => {
      if (!it.resolved && it.file === file) { it.resolved = true; changed = true; }
    });
    if (changed) renderModDialog();
  }

  /* ================================================================
     بدء فحص مجموعة ملفات في الخلفية فور اختيارها
     onResult(index, file, result) يُستدعى عند انتهاء فحص كل صورة
     يُعيد { promise, results }
     ================================================================ */
  function startModeration(files, onResult) {
    const results = [];
    const promise = Promise.all(
      Array.from(files).map(async (file, i) => {
        const res = await Moderate.checkFile(file);
        results[i] = res;
        if (onResult) { try { onResult(i, file, res); } catch (e) { console.error(e); } }
      })
    );
    return { promise, results };
  }

  /* ================================================================
     واجهة Upload العامة
     ================================================================ */
  const Upload = {

    async validate(file) {
      if (!file) return { ok: false, error: 'err.image_type' };
      const name  = String(file.name || '').toLowerCase();
      const parts = name.split('.');
      const ext   = parts.pop();
      if (parts.length > 1 && parts.slice(1).some(p => /^(php|js|html?|exe|sh|svg|phtml)/.test(p)))
        return { ok: false, error: 'err.image_type' };
      if (!U.ALLOWED_EXT.includes(ext) || !U.ALLOWED_MIME.includes(file.type))
        return { ok: false, error: 'err.image_type' };
      if (file.size > L.IMAGE_MAX_BYTES) return { ok: false, error: 'err.image_size' };
      if (!(await magicOk(file))) return { ok: false, error: 'err.image_type' };
      return { ok: true };
    },

    async compress(file) {
      const bmp = await createImageBitmap(file);
      const out = {};
      for (const [k, px] of Object.entries(U.SIZES)) out[k] = await resize(bmp, px);
      if (bmp.close) bmp.close();
      return out;
    },

    startModeration,
    showModerationWarning,
    clearModerationWarningsFor,

    /* رفع صور الإعلان مع احترام نتائج الفحص */
    async putAdImages(adId, files, onProgress, modPromise, modResults) {
      /* انتظر انتهاء الفحص إن كان لا يزال جاريًا */
      if (modPromise) { try { await modPromise; } catch { /* fail-open */ } }

      const uid = Auth.uid(), res = [];
      for (let i = 0; i < files.length; i++) {
        const modRes = (modResults && modResults[i]) || { ok: true };
        /* تخطّ الصور الممنوعة صراحةً (UNSAFE) */
        if (modRes.ok === false && modRes.verdict === 'UNSAFE') continue;

        const blobs = await this.compress(files[i]);
        const rec   = { position: i };
        for (const k of Object.keys(blobs)) {
          const fileName = `${uid}_${adId}_${i}_${k}.webp`;
          const { url, fileId } = await uploadToImageKit(blobs[k], fileName);
          rec['path_' + k] = url;
          if (k === 'large') rec.imagekit_file_id = fileId;
        }
        /* حفظ وصف وكلمات مفتاحية من نتيجة الفحص */
        const thisModRes = Array.isArray(modRes) ? modRes[i] : modRes;
        if (thisModRes && thisModRes.ok !== false) {
        if (thisModRes.description) rec.ai_description = thisModRes.description;
        if (thisModRes.tags && thisModRes.tags.length) rec.ai_tags = thisModRes.tags;
        }
        res.push(rec);
        console.log('[putAdImages] rec:', JSON.stringify(rec));
        console.log('[putAdImages] modRes:', JSON.stringify(modRes));
        if (onProgress) onProgress(i + 1, files.length);
      }
      return res;
    },

    /* مستند خاص (هوية) — يبقى في Supabase Storage */
    async putPrivate(bucket, path, file) {
      const blob = await resize(await createImageBitmap(file), 1600);
      const { error } = await SB.db.storage.from(bucket).upload(path, blob, { contentType: blob.type, upsert: true });
      if (error) throw error;
      return path;
    }
  };

  window.Upload = Upload;
})();