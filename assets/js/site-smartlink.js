(function () {
  'use strict';

  /* =========================================================
     SMARTLINK — 1x per session, click-initiated
     =========================================================
     Strategi:
     - Hanya trigger 1 kali per session (tab close = session baru)
     - Hanya trigger saat user KLIK elemen tertentu
       (bukan auto-open seperti popunder)
     - Hanya klik kiri polos — Ctrl/Cmd+click (= buka di tab baru)
       diabaikan supaya tidak dobel tab
     - Tab iklan dibuka dengan 'noopener,noreferrer'
       (anti reverse-tabnabbing + cegah Referer leak)
     - Tidak mencegah navigasi asli user
     - Safelinku tetap jalan, tidak saling ganggu
     - Skip bots/crawlers
     - SKIP TOTAL jika sessionStorage tidak tersedia (mencegah
       spam tab iklan di mode privat / storage disabled)
     - URL dibaca dari data-attribute (base64, di-render Hugo)
       bukan hardcoded di JS — memudahkan rotasi tanpa rebuild JS

     Lokasi trigger:
     1. Link Kartu Donghua (a.donghua-card-link)
     2. Slider "Buka Donghua" CTA (a.home-rec-slider-button.secondary)

     Flow:
     - User klik trigger → Smartlink buka di tab baru
     - Navigasi asli tetap jalan di current tab
     - Session flag diset → tidak trigger lagi sampai tab ditutup

     Catatan:
     - Tombol Download Batch TIDAK di-hook karena punya
       target="_blank" + Safelinku shortlink → konflik popup blocker
     ========================================================= */

  // ─── CONFIG ────────────────────────────────────────────────
  var CONFIG = {
    // Smartlink URL — diisi oleh loadConfig() dari data-attribute
    // yang di-render server-side oleh Hugo (base64 encoded).
    // Tidak lagi hardcoded di file JS.
    smartlinkUrl: '',

    // Session storage key untuk track status
    sessionKey: 'db_smartlink_fired',

    // CSS selector untuk elemen yang trigger Smartlink
    triggers: [
      'a.donghua-card-link',                    // Donghua card links (semua halaman)
      'a.home-rec-slider-button.secondary'      // Slider "Buka Donghua" CTA
    ]
  };
  // ─── END CONFIG ────────────────────────────────────────────

  /**
   * Baca & decode Smartlink URL dari data-attribute di <html>.
   * URL di-encode base64 oleh Hugo template (config.toml → base64Encode).
   * Return true jika URL berhasil dimuat.
   */
  function loadConfig() {
    var el = document.documentElement;
    var encoded = el && el.dataset && el.dataset.slc;
    if (!encoded) return false;
    try {
      CONFIG.smartlinkUrl = atob(encoded);
      return !!CONFIG.smartlinkUrl;
    } catch (e) {
      return false;
    }
  }

  /**
   * Cek apakah sessionStorage benar-benar tersedia & berfungsi.
   * Mencegah spam tab iklan di browser yang memblokir storage
   * (mode privat Safari, enterprise policy, setting ketat, dll).
   */
  function isSessionStorageAvailable() {
    try {
      var k = '__sl_test';
      sessionStorage.setItem(k, '1');
      sessionStorage.removeItem(k);
      return true;
    } catch (e) {
      return false;
    }
  }

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
    return /googlebot|bingbot|yandexbot|baiduspider|duckduckbot|slurp|sogou|exabot|facebot|facebookexternalhit|twitterbot|rogerbot|linkedinbot|embedly|quora link prefix|showyoubot|outbrain|pinterest|developers\.google\.com\/\+\/web\/snippet|slackbot|vkshare|w3c_validator|ahrefsbot|semrushbot/i.test(ua);
  }

  /** Buka Smartlink di tab baru. Return true jika berhasil. */
  function fireSmartlink() {
    if (hasFired()) return false;

    try {
      // 'noopener': tab iklan tidak dapat mengakses window.opener
      //   → anti reverse-tabnabbing dari rantai redirect Smartlink
      // 'noreferrer': jangan kirim Referer header ke domain iklan
      //   → cegah kebocoran URL halaman & data navigasi user
      var win = window.open(CONFIG.smartlinkUrl, '_blank', 'noopener,noreferrer');
      if (win && !win.closed) {
        markFired();
        return true;
      }
    } catch (e) {
      // SecurityError atau lainnya
    }
    return false;
  }

  /** Inisialisasi Smartlink listener */
  function init() {
    // [C2] Baca URL dari data-attribute (server-side rendered)
    if (!loadConfig()) return;

    // [C1] Skip TOTAL jika sessionStorage tidak tersedia.
    // Tanpa ini, smartlink akan fire SETIAP klik → spam tab iklan
    // → browser crash / user pergi.
    if (!isSessionStorageAvailable()) return;

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

      // Hanya klik kiri polos. Ctrl/Cmd+click = user sengaja buka
      // link di tab baru; jangan tambah tab iklan kedua.
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      // Cari elemen trigger terdekat dari klik target
      var target = e.target.closest(selector);
      if (!target) return;

      // Fire the Smartlink
      fireSmartlink();
      // Jangan preventDefault — biarkan browser navigasi normal
    });
  }

  // ─── RUN ───────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
