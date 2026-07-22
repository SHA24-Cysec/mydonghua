/*!
  Smartlink Adsterra — trigger klik judul/kartu donghua
  ────────────────────────────────────────────────────────
  Flow:
  1. User klik kartu donghua (.donghua-card-link)
  2. Cooldown per-tab dicatat sebelum percobaan popup
  3. Smartlink terbuka di tab baru
  4. Navigasi ke halaman detail tetap berjalan normal

  Konfigurasi URL dan cooldown ada di config.toml [params.smartlink].
*/

(function () {
  'use strict';

  var SMARTLINK_URL = window.__SMARTLINK_SRC || '';
  var TRIGGER_SELECTOR = 'a.donghua-card-link';
  var SESSION_KEY = 'adsterra_smartlink_triggered';
  var DEFAULT_COOLDOWN_MS = 5 * 60 * 1000;
  var configuredCooldown = Number(window.__SMARTLINK_COOLDOWN_MS);
  var COOLDOWN_MS = Number.isFinite(configuredCooldown) && configuredCooldown >= 0
    ? configuredCooldown
    : DEFAULT_COOLDOWN_MS;
  var memoryLastTrigger = 0;

  function isProduction() {
    return window.__SMARTLINK_ENV === 'production';
  }

  function readLastTrigger() {
    try {
      var stored = parseInt(window.sessionStorage.getItem(SESSION_KEY), 10);
      if (stored > 0) {
        memoryLastTrigger = stored;
      }
    } catch (_) {
      /* Storage dapat diblokir. Gunakan fallback in-memory pada tab ini. */
    }

    return memoryLastTrigger;
  }

  function markTriggered(timestamp) {
    memoryLastTrigger = timestamp;

    try {
      window.sessionStorage.setItem(SESSION_KEY, String(timestamp));
    } catch (_) {
      /* Fallback in-memory sudah diperbarui. */
    }
  }

  function canTrigger(timestamp) {
    var last = readLastTrigger();
    if (!last) return true;
    return timestamp - last >= COOLDOWN_MS;
  }

  function openSmartlink() {
    if (!SMARTLINK_URL) return;

    var now = Date.now();
    if (!canTrigger(now)) return;

    // Catat percobaan sebelum window.open. Browser modern dapat membuka popup
    // tetapi mengembalikan null ketika noopener/noreferrer dipakai.
    markTriggered(now);

    try {
      window.open(SMARTLINK_URL, '_blank', 'noopener,noreferrer');
    } catch (_) {
      /* Navigasi card utama tetap berjalan tanpa gangguan. */
    }
  }

  function onClick(event) {
    var target = event.target;
    if (!target || typeof target.closest !== 'function') return;

    var link = target.closest(TRIGGER_SELECTOR);
    if (!link || !isProduction()) return;

    // Tidak memanggil preventDefault: navigasi card tetap berjalan normal.
    openSmartlink();
  }

  function init() {
    document.addEventListener('click', onClick);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
