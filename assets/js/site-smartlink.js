/*!
  Smartlink Adsterra — Interstitial sebelum redirect download
  ──────────────────────────────────────────────────────────
  Flow:
  1. User klik tombol download (.db-button)
  2. Event default ditunda — overlay interstitial muncul
  3. Smartlink Adsterra di-trigger di background
  4. Progress bar berjalan (~2 detik)
  5. Safelinku dibuka di tab baru
  6. Overlay ditutup

  Konfigurasi URL ada di config.toml [params.smartlink].
*/

(function () {
  'use strict';

  /* ------------------------------------------------------------------ */
  /*  Config                                                             */
  /* ------------------------------------------------------------------ */
  var SMARTLINK_URL = window.__SMARTLINK_SRC || '';
  var TRIGGER_SELECTOR = '.db-button:not(.is-locked):not(.is-disabled)';
  var SESSION_KEY = 'adsterra_smartlink_triggered';
  var COOLDOWN_MS = 5 * 60 * 1000; // 5 menit antar trigger
  var INTERSTITIAL_DELAY = 1800;    // ms — durasi overlay tampil
  var PROGRESS_INTERVAL = 50;       // ms — update progress bar

  /* ------------------------------------------------------------------ */
  /*  State                                                              */
  /* ------------------------------------------------------------------ */
  var overlay = null;
  var progressBar = null;
  var skipBtn = null;
  var currentHref = null;
  var isProcessing = false;

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

  function getOverlay() {
    if (overlay) return overlay;
    overlay = document.getElementById('smartlink-overlay');
    if (overlay) {
      progressBar = overlay.querySelector('[data-smartlink-progress]');
      skipBtn = overlay.querySelector('[data-smartlink-skip]');
    }
    return overlay;
  }

  function openSmartlink() {
    if (!SMARTLINK_URL) return;
    if (!canTrigger()) return;

    try {
      var win = window.open(SMARTLINK_URL, '_blank', 'noopener,noreferrer');
      if (win) {
        // Berhasil — tandai agar tidak cooldown
        markTriggered();
      }
      // Jika null (popup blocker), tetap lanjut — tidak usah ditahan
      return win !== null;
    } catch (_) {
      return false;
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Interstitial UI                                                    */
  /* ------------------------------------------------------------------ */
  function showInterstitial(href) {
    var el = getOverlay();
    if (!el) return false;

    currentHref = href;
    isProcessing = true;
    el.removeAttribute('hidden');
    el.setAttribute('aria-hidden', 'false');

    // Reset progress
    if (progressBar) {
      progressBar.style.width = '0%';
      progressBar.parentElement.setAttribute('aria-valuenow', '0');
    }

    // Sembunyikan skip button dulu
    if (skipBtn) skipBtn.setAttribute('hidden', '');

    // Safety: munculkan skip button setelah 4 detik (antisipasi macet)
    setTimeout(function () {
      if (isProcessing && skipBtn) {
        skipBtn.removeAttribute('hidden');
      }
    }, 4000);

    return true;
  }

  function hideInterstitial() {
    var el = getOverlay();
    if (!el) return;

    el.setAttribute('hidden', '');
    el.setAttribute('aria-hidden', 'true');
    isProcessing = false;
    currentHref = null;
  }

  function runProgress(callback) {
    var start = Date.now();
    var timer = setInterval(function () {
      var elapsed = Date.now() - start;
      var pct = Math.min((elapsed / INTERSTITIAL_DELAY) * 100, 100);

      if (progressBar) {
        progressBar.style.width = pct + '%';
        progressBar.parentElement.setAttribute('aria-valuenow', String(Math.round(pct)));
      }

      if (elapsed >= INTERSTITIAL_DELAY) {
        clearInterval(timer);
        if (typeof callback === 'function') callback();
      }
    }, PROGRESS_INTERVAL);
  }

  function proceedToDownload() {
    if (!currentHref) return;

    // Buka link safelinku di tab baru (seperti default tombol)
    window.open(currentHref, '_blank', 'noopener,noreferrer');
    hideInterstitial();
  }

  /* ------------------------------------------------------------------ */
  /*  Click handler                                                      */
  /* ------------------------------------------------------------------ */
  function onClick(e) {
    var btn = e.target.closest(TRIGGER_SELECTOR);
    if (!btn) return;
    if (isProcessing) return;

    // Hanya aktif di production
    if (!isProduction()) return;

    var href = btn.getAttribute('href');
    if (!href) return;

    // Cegah default — kita handle manual via interstitial
    e.preventDefault();
    e.stopPropagation();

    // Trigger smartlink (background — popup blocker mungkin menangkal)
    openSmartlink();

    // Tampilkan overlay interstitial
    var shown = showInterstitial(href);
    if (!shown) {
      // Overlay tidak ditemukan — fallback: buka langsung
      window.open(href, '_blank', 'noopener,noreferrer');
      return;
    }

    // Progress bar lalu redirect
    runProgress(function () {
      proceedToDownload();
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Skip button handler                                                */
  /* ------------------------------------------------------------------ */
  function onSkip() {
    if (!isProcessing) return;
    proceedToDownload();
  }

  /* ------------------------------------------------------------------ */
  /*  Init                                                               */
  /* ------------------------------------------------------------------ */
  function init() {
    document.addEventListener('click', onClick);

    // Skip button via event delegation
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-smartlink-skip]');
      if (!btn) return;
      if (btn.hasAttribute('hidden')) return;
      onSkip();
    });

    // Escape key — skip
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && isProcessing) {
        proceedToDownload();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
