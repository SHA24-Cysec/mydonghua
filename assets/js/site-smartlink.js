/*!
  Smartlink Adsterra — trigger klik judul/kartu donghua
  ────────────────────────────────────────────────────────
  Flow:
  1. User klik kartu donghua (.donghua-card-link)
  2. Smartlink Adsterra terbuka di tab baru (background)
  3. Navigasi ke halaman detail tetap berjalan normal
     — tidak ada block, tidak ada delay, tidak ada overlay.

  Konfigurasi URL ada di config.toml [params.smartlink].
  Cooldown 5 menit agar tidak terlalu agresif.
*/

(function () {
  'use strict';

  /* ------------------------------------------------------------------ */
  /*  Config                                                             */
  /* ------------------------------------------------------------------ */
  var SMARTLINK_URL = window.__SMARTLINK_SRC || '';
  var TRIGGER_SELECTOR = 'a.donghua-card-link';
  var SESSION_KEY = 'adsterra_smartlink_triggered';
  var COOLDOWN_MS = 5 * 60 * 1000; // 5 menit antar trigger

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
      var win = window.open(SMARTLINK_URL, '_blank', 'noopener,noreferrer');
      if (win) {
        markTriggered();
      }
      // Popup blocker — tidak usah feedback, navigasi tetap jalan
    } catch (_) {}
  }

  /* ------------------------------------------------------------------ */
  /*  Click handler — delegasi ke document                              */
  /* ------------------------------------------------------------------ */
  function onClick(e) {
    var link = e.target.closest(TRIGGER_SELECTOR);
    if (!link) return;

    // Hanya aktif di production
    if (!isProduction()) return;

    // Trigger smartlink — navigasi ke detail tetap jalan normal
    openSmartlink();
  }

  /* ------------------------------------------------------------------ */
  /*  Init                                                               */
  /* ------------------------------------------------------------------ */
  function init() {
    document.addEventListener('click', onClick);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
