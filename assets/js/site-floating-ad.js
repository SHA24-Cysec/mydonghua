(function () {
  'use strict';

  var SESSION_KEY = 'site_floating_ad_closed';
  var MOBILE_MAX = 767;
  var AD_INSPECT_TIMEOUT = 6500;
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
      var blocked = false;
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

  // Render unit floating ad di dalam iframe terisolasi miliknya sendiri.
  function injectAdIframe(unit, key, format, width, height, invokeUrl) {
    if (!unit || !invokeUrl) return null;

    var iframe = document.createElement('iframe');
    iframe.setAttribute('scrolling', 'no');
    iframe.setAttribute('frameborder', '0');
    iframe.setAttribute('title', 'Advertisement');
    iframe.style.border = '0';
    iframe.style.display = 'block';
    iframe.style.overflow = 'hidden';
    iframe.style.width = (width || 320) + 'px';
    iframe.style.height = (height || 50) + 'px';
    iframe.style.maxWidth = '100%';
    unit.appendChild(iframe);

    var doc = iframe.contentWindow && iframe.contentWindow.document;
    if (!doc) return iframe;

    var atOptionsJson = JSON.stringify({
      key: key,
      format: format || 'iframe',
      height: height,
      width: width,
      params: {}
    });

    doc.open();
    doc.write(
      '<!doctype html><html><head><style>html,body{margin:0;padding:0;overflow:hidden;background:transparent;}</style></head>' +
      '<body>' +
      '<script>window.atOptions = ' + atOptionsJson + ';<' + '/script>' +
      '<script src="' + invokeUrl + '"><' + '/script>' +
      '</body></html>'
    );
    doc.close();
    return iframe;
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

  function adRendered(unit) {
    if (!unit) return false;
    var iframe = unit.querySelector('iframe');
    if (!iframe) return false;
    try {
      var idoc = iframe.contentWindow && iframe.contentWindow.document;
      if (idoc && idoc.body) {
        var kids = idoc.body.children;
        var real = 0;
        for (var i = 0; i < kids.length; i++) {
          if (kids[i].tagName !== 'SCRIPT') real++;
        }
        if (real > 0) return true;
        if (idoc.body.scrollHeight > 12) return true;
        return false;
      }
    } catch (e) {
      // Cross-origin => anggap berhasil.
      return true;
    }
    return false;
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

      if (invoke && key) {
        injectAdIframe(unit, key, format, width, height, invoke);
      } else if (invoke) {
        var script = document.createElement('script');
        script.src = invoke;
        script.async = true;
        script.setAttribute('data-cfasync', 'false');
        script.onerror = function () { showFallback(ad, 'house'); };
        unit.appendChild(script);
      }

      reveal(ad);

      // Inspeksi apakah kreatif benar-benar tampil; kalau tidak -> house ad.
      window.setTimeout(function () {
        if (!adRendered(unit)) {
          showFallback(ad, 'house');
        }
      }, AD_INSPECT_TIMEOUT);
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

    setTimeout(function() {
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
