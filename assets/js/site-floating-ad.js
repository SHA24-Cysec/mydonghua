(function () {
  'use strict';

  var SESSION_KEY = 'site_floating_ad_closed';
  var MOBILE_MAX = 767;
  var AD_INSPECT_TIMEOUT = 6500;

  function isMobileViewport() {
    return window.matchMedia('(max-width: ' + MOBILE_MAX + 'px)').matches;
  }

  // Render unit floating ad di dalam iframe terisolasi miliknya sendiri,
  // supaya window.atOptions tidak berebut dengan unit iklan lain di
  // halaman yang sama (mis. banner 728x90 yang memakai key sama).
  function injectAdIframe(unit, key, format, width, height, invokeUrl) {
    if (!unit || !invokeUrl) return;

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
    if (!doc) return;

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

  function injectFloating(ad) {
    var unit = pickResponsiveUnit(ad);
    if (!unit) return;

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
      unit.appendChild(script);
    }

    ad.hidden = false;
    ad.classList.add('is-visible');
    document.body.classList.add('has-floating-ad');
  }

  function initFloatingAd() {
    var ad = document.querySelector('[data-floating-ad]');
    if (!ad || window.sessionStorage.getItem(SESSION_KEY) === '1') {
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
        document.body.classList.remove('has-floating-ad');
        setTimeout(function() { ad.hidden = true; }, 280);
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFloatingAd, { once: true });
  } else {
    initFloatingAd();
  }
})();
