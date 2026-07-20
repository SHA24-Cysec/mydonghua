/*!
  Smartlink Adsterra — trigger klik tombol Download Batch
  ────────────────────────────────────────────────────────
  Ketika user mengklik tombol download ( .db-button ),
  smartlink Adsterra terbuka di tab baru secara parallel,
  tanpa mengganggu alur safelinku yang sudah berjalan.

  Konfigurasi URL ada di config.toml [params.smartlink].

  Catatan:
  - Tidak memblokir event default (safelinku tetap jalan).
  - Hanya aktif di environment production (hugo.IsProduction).
  - Menggunakan flag sessionStorage agar tidak terlalu agresif
    (hanya 1x smartlink per sesi klik, bisa disesuaikan).
*/

(function () {
  'use strict';

  /* ------------------------------------------------------------------ */
  /*  Config                                                             */
  /* ------------------------------------------------------------------ */
  var SMARTLINK_URL = window.__SMARTLINK_SRC || '';
  var TRIGGER_SELECTOR = '.db-button:not(.is-locked):not(.is-disabled)';
  var SESSION_KEY = 'adsterra_smartlink_triggered';
  var COOLDOWN_MS = 30 * 1000; // 30 detik antar trigger

  /* ------------------------------------------------------------------ */
  /*  Helpers                                                            */
  /* ------------------------------------------------------------------ */
  function isProduction() {
    return window.__SMARTLINK_ENV === 'production';
  }

  function canTrigger() {
    var last = parseInt(sessionStorage.getItem(SESSION_KEY), 10);
    if (!last) return true;
    return Date.now() - last > COOLDOWN_MS;
  }

  function markTriggered() {
    try {
      sessionStorage.setItem(SESSION_KEY, String(Date.now()));
    } catch (_) { /* storage penuh — skip */ }
  }

  function openSmartlink() {
    if (!SMARTLINK_URL) return;
    if (!canTrigger()) return;

    try {
      window.open(SMARTLINK_URL, '_blank', 'noopener,noreferrer');
      markTriggered();
    } catch (_) {
      /* Pop-up blocker — fallback diam-diam, tidak usah toast */
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Click handler — delegasi ke document                              */
  /* ------------------------------------------------------------------ */
  function onClick(e) {
    var btn = e.target.closest(TRIGGER_SELECTOR);
    if (!btn) return;

    // Smartlink hanya aktif di production
    if (!isProduction()) return;

    openSmartlink();
  }

  /* ------------------------------------------------------------------ */
  /*  Init                                                               */
  /* ------------------------------------------------------------------ */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      document.addEventListener('click', onClick);
    });
  } else {
    document.addEventListener('click', onClick);
  }
})();
