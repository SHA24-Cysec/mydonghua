(function () {
  'use strict';

  /* =========================================================
     SMARTLINK — 1x per session, click-initiated
     =========================================================
     Strategi:
     - Hanya trigger 1 kali per session (tab close = session baru)
     - Hanya trigger saat user KLIK elemen tertentu
       (bukan auto-open seperti popunder)
     - Tidak mencegah navigasi asli user
     - Safelinku tetap jalan, tidak saling ganggu
     - Skip bots/crawlers

     Lokasi trigger:
     1. Tombol Download Batch (a.db-button, bukan .is-locked)
     2. Link Kartu Donghua (a.donghua-card-link)
     3. Slider "Buka Donghua" CTA (a.home-rec-slider-button.secondary)

     Flow:
     - User klik trigger → Smartlink buka di tab baru
     - Navigasi asli tetap jalan (same-tab atau new-tab)
     - Session flag diset → tidak trigger lagi sampai tab ditutup

     =========================================================
     BUG FIXES (v2):
     ────────────────
     BUG 1 — Popup blocker kill window.open() saat <a target="_blank">
       Penjelasan: Download button punya target="_blank", jadi saat
       diklik, browser BUKA href di tab baru. Lalu Smartlink JS coba
       window.open() → popup blocker melihat 2 tab baru dari 1 klik
       → BLOCK window.open(). Solusi: e.preventDefault() lalu buka
       kedua URL manual via window.open() secara sinkron.

     BUG 2 — Fallback a.click() adalah synthetic click → PASTI blocked
       Penjelasan: Ketika window.open() gagal, fallback bikin <a>
       hidden lalu .click(). Tapi .click() programmatic BUKAN user
       gesture → popup blocker block. Lebih parah: markFired()
       tetap dipanggil → Smartlink dianggap sudah fire padahal gagal.
       Solusi: Hapus fallback, hanya markFired() jika window.open()
       benar-benar return window reference.

     BUG 3 — Safelinku + target="_blank" double new-tab
       Penjelasan: Safelinku replace href download link jadi shortlink
       di page load. Saat diklik + target="_blank" → shortlink buka
       di tab baru. Smartlink coba window.open() → block.
       Solusi: Tangkap href SEBELUM preventDefault (sudah termasuk
       Safelinku shortlink), lalu buka manual.
     ========================================================= */

  // ─── CONFIG ────────────────────────────────────────────────
  var CONFIG = {
    // Smartlink URL
    smartlinkUrl: 'https://bendspecimen.com/td7zxakvmh?key=72a4fb839fdab976a2aec02aa04b2be4',

    // Session storage key untuk track status
    sessionKey: 'db_smartlink_fired',

    // Max trigger per session (1 = sangat aman, tidak spam)
    maxPerSession: 1,

    // CSS selector untuk elemen yang trigger Smartlink
    triggers: [
      'a.db-button:not(.is-locked)',           // Download batch buttons (active only)
      'a.donghua-card-link',                    // Donghua card links (semua halaman)
      'a.home-rec-slider-button.secondary'      // Slider "Buka Donghua" CTA
    ]
  };
  // ─── END CONFIG ────────────────────────────────────────────

  /** Cek apakah Smartlink sudah pernah trigger di session ini */
  function hasFired() {
    try {
      return sessionStorage.getItem(CONFIG.sessionKey) === '1';
    } catch (e) { return false; }
  }

  /** Tandai Smartlink sudah trigger di session ini */
  function markFired() {
    try {
      sessionStorage.setItem(CONFIG.sessionKey, '1');
    } catch (e) { /* sessionStorage unavailable */ }
  }

  /** Deteksi bot/crawler — jangan pernah trigger untuk bot */
  function isCrawler() {
    var ua = (navigator.userAgent || '').toLowerCase();
    return /googlebot|bingbot|yandexbot|baiduspider|duckduckbot|slurp|sogou|exabot|facebot|facebookexternalhit|twitterbot|rogerbot|linkedinbot|embedly|quora link preview|showyoubot|outbrain|pinterest|developers\.google\.com\/\+\/web\/snippet|slackbot|vkshare|w3c_validator|ahrefsbot|semrushbot/i.test(ua);
  }

  /**
   * Buka Smartlink di tab baru.
   * Return true HANYA jika window.open() berhasil (return valid reference).
   * Tidak ada fallback — jika popup blocker block, return false.
   */
  function openSmartlink() {
    try {
      var win = window.open(CONFIG.smartlinkUrl, '_blank');
      // window.open() return null jika popup blocked
      // return valid Window object jika berhasil
      if (win && !win.closed) {
        markFired();
        return true;
      }
    } catch (e) {
      // SecurityError atau lainnya
    }
    return false;
  }

  /**
   * Buka URL di tab baru secara sinkron (dalam user gesture context).
   * Return true jika berhasil.
   */
  function openInNewTab(url) {
    if (!url) return false;
    try {
      var win = window.open(url, '_blank');
      return !!(win && !win.closed);
    } catch (e) {
      return false;
    }
  }

  /** Inisialisasi Smartlink listener */
  function init() {
    // Skip jika sudah trigger session ini
    if (hasFired()) return;

    // Skip bots/crawlers
    if (isCrawler()) return;

    // Gabungkan semua selector
    var selector = CONFIG.triggers.join(', ');

    // ─── STRATEGY ───────────────────────────────────────────
    // Untuk <a> dengan target="_blank" (download buttons):
    //   - Browser default action: buka href di tab baru
    //   - window.open() juga coba buka tab baru
    //   - Popup blocker melihat 2 new-tab dari 1 klik → BLOCK
    //   - SOLUSI: e.preventDefault() → buka kedua URL manual
    //
    // Untuk <a> tanpa target="_blank" (card links, slider CTA):
    //   - Browser navigasi di current tab (bukan popup)
    //   - window.open() buka Smartlink di tab baru (1 popup)
    //   - Tidak ada konflik → biarkan browser handle default
    // ────────────────────────────────────────────────────────

    document.addEventListener('click', function (e) {
      // Double-check: mungkin sudah di-trigger oleh klik sebelumnya
      if (hasFired()) return;

      // Cari elemen trigger terdekat dari klik target
      var target = e.target.closest(selector);
      if (!target) return;

      // Deteksi apakah link ini buka di tab baru
      var isNewTab = target.getAttribute('target') === '_blank';

      if (isNewTab) {
        // ─── TARGET="_BLANK" (Download Buttons) ────────────
        // CRITICAL: preventDefault WAJIB untuk hindari popup blocker
        // Tanpa preventDefault: browser buka href di tab baru +
        // window.open() coba buka tab lain → popup blocked!
        e.preventDefault();

        // Simpan href SEBELUM preventDefault (sudah termasuk Safelinku shortlink)
        var originalHref = target.href;

        // Step 1: Buka Smartlink di tab baru (prioritas revenue)
        var smartlinkOk = openSmartlink();

        // Step 2: Buka original href di tab baru
        // Ini termasuk Safelinku shortlink jika domain cocok
        if (originalHref) {
          var downloadOk = openInNewTab(originalHref);

          // Jika KEDUA window.open gagal (popup blocker ketat),
          // gunakan last resort: navigasi current tab ke download link
          if (!smartlinkOk && !downloadOk) {
            window.location.href = originalHref;
          }
        }
      } else {
        // ─── SAME-TAB LINKS (Card, Slider CTA) ─────────────
        // Browser handle navigasi di current tab (bukan popup),
        // jadi window.open() cuma buka 1 tab baru → tidak block
        openSmartlink();
        // Jangan preventDefault — biarkan browser navigasi normal
      }
    });
  }

  // ─── RUN ───────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
