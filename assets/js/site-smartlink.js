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

  /** Buka Smartlink di tab baru. Return true jika berhasil. */
  function fireSmartlink() {
    if (hasFired()) return false;

    // Method 1: window.open — paling reliable dalam click handler
    var win = window.open(CONFIG.smartlinkUrl, '_blank');

    if (win) {
      markFired();
      return true;
    }

    // Method 2: Fallback — buat <a> hidden lalu klik
    try {
      var a = document.createElement('a');
      a.href = CONFIG.smartlinkUrl;
      a.target = '_blank';
      a.rel = 'noopener';
      a.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0;pointer-events:none;';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { if (a.parentNode) a.parentNode.removeChild(a); }, 100);
      markFired();
      return true;
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

    // Event delegation di document level
    // Satu listener untuk semua trigger — hemat memory
    document.addEventListener('click', function (e) {
      // Double-check: mungkin sudah di-trigger oleh klik sebelumnya
      if (hasFired()) return;

      // Cari elemen trigger terdekat dari klik target
      var target = e.target.closest(selector);
      if (!target) return;

      // Fire the Smartlink
      fireSmartlink();
    });
  }

  // ─── RUN ───────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
