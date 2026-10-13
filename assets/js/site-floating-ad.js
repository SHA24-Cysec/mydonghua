(function () {
  'use strict';

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

  // Deteksi adblock; pakai cache bersama dengan site-ad-fallback.js bila ada.
  function detectAdBlock(cb) {
    if (typeof window.__siteAdBlocked === 'boolean') {
      cb(window.__siteAdBlocked);
      return;
    }
    var bait = document.createElement('div');
    bait.className = 'ad ads adsbox ad-banner ad-placement pub_300x250 text-ad textAd';
    bait.style.cssText =
      'position:absolute!important;left:-9999px!important;top:-9999px!important;' +
      'width:1px!important;height:1px!important;pointer-events:none!important;';
    bait.setAttribute('aria-hidden', 'true');
    (document.body || document.documentElement).appendChild(bait);

    window.setTimeout(function () {
      var blocked;
      try {
        var cs = window.getComputedStyle ? window.getComputedStyle(bait) : null;
        blocked =
          bait.offsetParent === null ||
          bait.offsetHeight === 0 ||
          bait.clientHeight === 0 ||
          (cs && (cs.display === 'none' || cs.visibility === 'hidden'));
      } catch (e) {
        blocked = false;
      }
      if (bait.parentNode) bait.parentNode.removeChild(bait);
      window.__siteAdBlocked = !!blocked;
      cb(window.__siteAdBlocked);
    }, 130);
  }

  /* =========================================================
     Pemuatan unit floating langsung di halaman (audit 2026-10-13,
     Opsi A). Iframe sandbox ber-origin buram dihapus karena skrip
     Adsterra tidak kompatibel dengan konteks itu; invoke.js kini
     dijalankan di dokumen halaman. Lihat catatan di
     site-ad-fallback.js untuk detail alasan dan atOptions.
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

  function isFallbackShown(ad) {
    var fallback = ad.querySelector('[data-ad-fallback]');
    return !!(fallback && !fallback.hidden);
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

  function showFallback(ad, kind) {
    var fallback = ad.querySelector('[data-ad-fallback]');
    if (!fallback) return false;

    var units = ad.querySelectorAll('[data-floating-ad-unit]');
    for (var i = 0; i < units.length; i++) {
      if (units[i].parentNode) units[i].parentNode.removeChild(units[i]);
    }

    var variants = fallback.querySelectorAll('[data-ad-fallback-variant]');
    for (var v = 0; v < variants.length; v++) {
      var match = variants[v].getAttribute('data-ad-fallback-variant') === kind;
      variants[v].hidden = !match;
    }

    fallback.hidden = false;
    fallback.setAttribute('aria-hidden', 'false');

    if (ad.classList.contains('is-visible')) {
      window.requestAnimationFrame(function () {
        syncBackToTopOffset(ad);
      });
    }
    return true;
  }

  function reveal(ad) {
    ad.hidden = false;
    ad.classList.add('is-visible');
    document.body.classList.add('has-floating-ad');
    watchBackToTopOffset(ad);
  }

  // Pantau isi unit sampai AD_INSPECT_TIMEOUT. Bila kreatif terisi
  // kapan pun dalam jendela itu, fallback dibatalkan. Bila tetap
  // kosong sampai batas waktu, kartu fallback house ditampilkan.
  function watchUnit(ad, unit) {
    var started = Date.now();
    var timer = window.setInterval(function () {
      if (isFallbackShown(ad)) {
        window.clearInterval(timer);
        return;
      }
      if (adRendered(unit)) {
        window.clearInterval(timer);
        return;
      }
      if (Date.now() - started >= AD_INSPECT_TIMEOUT) {
        window.clearInterval(timer);
        if (!isFallbackShown(ad)) {
          showFallback(ad, 'house');
        }
      }
    }, AD_POLL_INTERVAL);
  }

  function injectFloating(ad) {
    detectAdBlock(function (blocked) {
      if (blocked) {
        showFallback(ad, 'adblock');
        reveal(ad);
        return;
      }

      var unit = pickResponsiveUnit(ad);
      if (!unit) {
        showFallback(ad, 'house');
        reveal(ad);
        return;
      }

      var invoke = unit.getAttribute('data-ad-invoke');
      var key = unit.getAttribute('data-ad-key');
      var format = unit.getAttribute('data-ad-format') || 'iframe';
      var height = parseInt(unit.getAttribute('data-ad-height') || '50', 10);
      var width = parseInt(unit.getAttribute('data-ad-width') || '320', 10);

      unit.hidden = false;

      if (!invoke) {
        showFallback(ad, 'house');
        reveal(ad);
        return;
      }

      var script = injectAdScript(unit, key, format, width, height, invoke);
      if (script) {
        script.addEventListener('error', function () {
          showFallback(ad, 'house');
        });
      } else {
        showFallback(ad, 'house');
      }

      reveal(ad);
      watchUnit(ad, unit);
    });
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
