(function () {
  'use strict';

  /* =========================================================
     Floating bottom ad (728x90 desktop / 320x50 mobile).

     Kartu fallback dan deteksi adblock sudah dihapus atas permintaan
     pemilik situs. Iklan dianggap gagal hanya dari bukti nyata di
     halaman: skrip vendor memicu error, atau tidak ada kreatif yang
     terisi sampai batas waktu inspeksi. Perilaku saat gagal: panel
     ditutup senyap, tanpa kartu pengganti, tanpa menyisakan ruang.
     ========================================================= */

  var SESSION_KEY = 'site_floating_ad_closed';
  var MOBILE_MAX = 767;
  // Jendela inspeksi isi kreatif dengan polling (audit 2026-10-13).
  // Dulu satu kali cek di 6,5 detik; kreatif yang terisi belakangan
  // dianggap gagal. Sekarang dihormati sampai 15 detik.
  var AD_INSPECT_TIMEOUT = 15000;
  var AD_POLL_INTERVAL = 500;
  var BTT_OFFSET_PROPERTY = '--btt-ad-height';
  var bttResizeObserver = null;
  var bttResizeHandler = null;

  function isMobileViewport() {
    return window.matchMedia('(max-width: ' + MOBILE_MAX + 'px)').matches;
  }

  /* =========================================================
     Pemuatan unit floating langsung di halaman (audit 2026-10-13,
     Opsi A). Iframe sandbox ber-origin buram dihapus karena skrip
     Adsterra tidak kompatibel dengan konteks itu; invoke.js kini
     dijalankan di dokumen halaman. Lihat catatan di site-ads.js
     untuk detail alasan dan atOptions.
     ========================================================= */
  function injectAdScript(unit, key, format, width, height, invokeUrl) {
    if (!unit || !invokeUrl) return null;

    if (key) {
      window.atOptions = {
        key: key,
        format: format || 'iframe',
        height: height,
        width: width,
        params: {}
      };
    }

    var script = document.createElement('script');
    script.src = invokeUrl;
    script.async = false;
    script.setAttribute('data-cfasync', 'false');
    script.setAttribute('data-ad-script', '1');
    unit.appendChild(script);
    return script;
  }

  function pickResponsiveUnit(ad) {
    var units = ad.querySelectorAll('[data-floating-ad-unit]');
    if (!units.length) return null;

    var want = isMobileViewport() ? 'mobile' : 'desktop';
    var chosen = null;

    for (var i = 0; i < units.length; i++) {
      if ((units[i].getAttribute('data-ad-variant') || '') === want) {
        chosen = units[i];
        break;
      }
    }

    if (!chosen) chosen = units[0];

    // Hide other units
    for (var j = 0; j < units.length; j++) {
      if (units[j] === chosen) {
        units[j].hidden = false;
      } else if (units[j].parentNode) {
        units[j].parentNode.removeChild(units[j]);
      }
    }

    return chosen;
  }

  // Kreatif dianggap mulai terisi bila vendor menyisipkan node
  // non-skrif (iframe/ins/img/wrapper) ke dalam unit. Node
  // placeholder (data-ad-ignore) tidak dihitung.
  function adRendered(unit) {
    if (!unit) return false;
    var kids = unit.children;
    for (var i = 0; i < kids.length; i++) {
      if (kids[i].tagName === 'SCRIPT') continue;
      if (kids[i].getAttribute && kids[i].getAttribute('data-ad-ignore') !== null) continue;
      return true;
    }
    return false;
  }

  function isHidden(ad) {
    return !!(ad && ad.hidden);
  }

  function syncBackToTopOffset(ad) {
    if (!ad) return;
    var panel = ad.querySelector('.site-floating-ad__panel');
    if (!panel) return;

    var height = Math.ceil(panel.getBoundingClientRect().height);
    if (height > 0) {
      document.documentElement.style.setProperty(BTT_OFFSET_PROPERTY, height + 'px');
    }
  }

  function clearBackToTopOffset() {
    document.documentElement.style.removeProperty(BTT_OFFSET_PROPERTY);

    if (bttResizeObserver) {
      bttResizeObserver.disconnect();
      bttResizeObserver = null;
    }

    if (bttResizeHandler) {
      window.removeEventListener('resize', bttResizeHandler);
      bttResizeHandler = null;
    }
  }

  function watchBackToTopOffset(ad) {
    var panel = ad && ad.querySelector('.site-floating-ad__panel');
    if (!panel) return;

    clearBackToTopOffset();
    syncBackToTopOffset(ad);

    if ('ResizeObserver' in window) {
      bttResizeObserver = new ResizeObserver(function () {
        syncBackToTopOffset(ad);
      });
      bttResizeObserver.observe(panel);
    }

    bttResizeHandler = function () {
      syncBackToTopOffset(ad);
    };
    window.addEventListener('resize', bttResizeHandler, { passive: true });
  }

  /* =========================================================
     Iklan floating tidak terisi (no-fill atau galat skrip).
     Panel ditutup senyap: unit gagal dibuang, kelas tampil dilepas,
     bagian kembali tersembunyi, dan offset tombol back-to-top
     dibersihkan supaya tidak ada sisa ruang di layar.
     ========================================================= */
  function dismiss(ad) {
    if (!ad) return;

    var units = ad.querySelectorAll('[data-floating-ad-unit]');
    for (var i = 0; i < units.length; i++) {
      if (units[i].parentNode) units[i].parentNode.removeChild(units[i]);
    }

    ad.classList.remove('is-visible');
    ad.hidden = true;
    ad.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('has-floating-ad');
    clearBackToTopOffset();
  }

  function reveal(ad) {
    ad.hidden = false;
    ad.classList.add('is-visible');
    document.body.classList.add('has-floating-ad');
    watchBackToTopOffset(ad);
  }

  // Pantau isi unit sampai AD_INSPECT_TIMEOUT. Bila kreatif terisi
  // kapan pun dalam jendela itu, panel dipertahankan. Bila tetap
  // kosong sampai batas waktu, panel ditutup senyap.
  function watchUnit(ad, unit) {
    var started = Date.now();
    var timer = window.setInterval(function () {
      if (isHidden(ad)) {
        window.clearInterval(timer);
        return;
      }
      if (adRendered(unit)) {
        window.clearInterval(timer);
        return;
      }
      if (Date.now() - started >= AD_INSPECT_TIMEOUT) {
        window.clearInterval(timer);
        if (!isHidden(ad)) {
          dismiss(ad);
        }
      }
    }, AD_POLL_INTERVAL);
  }

  function injectFloating(ad) {
    var unit = pickResponsiveUnit(ad);
    if (!unit) {
      dismiss(ad);
      return;
    }

    var invoke = unit.getAttribute('data-ad-invoke');
    var key = unit.getAttribute('data-ad-key');
    var format = unit.getAttribute('data-ad-format') || 'iframe';
    var height = parseInt(unit.getAttribute('data-ad-height') || '50', 10);
    var width = parseInt(unit.getAttribute('data-ad-width') || '320', 10);

    unit.hidden = false;

    if (!invoke) {
      dismiss(ad);
      return;
    }

    var script = injectAdScript(unit, key, format, width, height, invoke);
    if (script) {
      script.addEventListener('error', function () {
        dismiss(ad);
      });
    } else {
      dismiss(ad);
      return;
    }

    reveal(ad);
    watchUnit(ad, unit);
  }

  function initFloatingAd() {
    var ad = document.querySelector('[data-floating-ad]');
    if (!ad || window.sessionStorage.getItem(SESSION_KEY) === '1') {
      clearBackToTopOffset();
      document.body.classList.remove('has-floating-ad');
      if (ad) ad.remove();
      return;
    }

    setTimeout(function () {
      injectFloating(ad);
    }, 1800);

    var closeButton = ad.querySelector('[data-floating-ad-close]');
    if (closeButton) {
      closeButton.addEventListener('click', function () {
        window.sessionStorage.setItem(SESSION_KEY, '1');
        ad.classList.remove('is-visible');

        setTimeout(function () {
          ad.hidden = true;
          document.body.classList.remove('has-floating-ad');
          clearBackToTopOffset();
        }, 280);
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFloatingAd, { once: true });
  } else {
    initFloatingAd();
  }
})();
