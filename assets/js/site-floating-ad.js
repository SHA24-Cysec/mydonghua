(function () {
  'use strict';

  var SESSION_KEY = 'site_floating_ad_closed';
  var MOBILE_MAX = 767;
  var AD_INSPECT_TIMEOUT = 8000;

  function isMobileViewport() {
    return window.matchMedia('(max-width: ' + MOBILE_MAX + 'px)').matches;
  }

  function hasRenderedCreative(unit) {
    if (!unit) return false;
    var nodes = unit.querySelectorAll('iframe, img, ins, div:not([data-ad-ignore])');
    for (var i = 0; i < nodes.length; i++) {
      var rect = nodes[i].getBoundingClientRect();
      if (rect.width > 10 && rect.height > 10) return true;
    }
    return false;
  }

  function pickResponsiveUnit(ad) {
    var units = ad.querySelectorAll('[data-floating-ad-unit]');
    var want = isMobileViewport() ? 'mobile' : 'desktop';
    var chosen = null;

    for (var i = 0; i < units.length; i++) {
      if ((units[i].getAttribute('data-ad-variant') || '') === want) {
        chosen = units[i];
        break;
      }
    }
    if (!chosen) chosen = units[0];

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
    var fallback = ad.querySelector('[data-floating-ad-fallback]');
    if (!unit) return;

    var invoke = unit.getAttribute('data-ad-invoke');
    var key = unit.getAttribute('data-ad-key');

    if (key) {
      window.atOptions = {
        key: key,
        format: unit.getAttribute('data-ad-format') || 'iframe',
        height: parseInt(unit.getAttribute('data-ad-height') || '50', 10),
        width: parseInt(unit.getAttribute('data-ad-width') || '320', 10),
        params: {}
      };
    }

    if (invoke) {
      var script = document.createElement('script');
      script.src = invoke;
      script.async = true;
      script.setAttribute('data-cfasync', 'false');
      unit.appendChild(script);
    }

    ad.hidden = false;
    ad.classList.add('is-visible');
    document.body.classList.add('has-floating-ad');

    // Fallback detection
    setTimeout(function() {
        if (!hasRenderedCreative(unit)) {
            unit.hidden = true;
            if (fallback) {
                fallback.hidden = false;
                fallback.style.display = 'flex';
            }
        }
    }, AD_INSPECT_TIMEOUT);
  }

  function initFloatingAd() {
    var ad = document.querySelector('[data-floating-ad]');
    if (!ad || window.sessionStorage.getItem(SESSION_KEY) === '1') {
      if (ad) ad.remove();
      return;
    }

    setTimeout(function() {
      injectFloating(ad);
    }, 2000);

    var closeButton = ad.querySelector('[data-floating-ad-close]');
    if (closeButton) {
      closeButton.addEventListener('click', function () {
        window.sessionStorage.setItem(SESSION_KEY, '1');
        ad.classList.remove('is-visible');
        document.body.classList.remove('has-floating-ad');
        setTimeout(function() { ad.hidden = true; }, 300);
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFloatingAd, { once: true });
  } else {
    initFloatingAd();
  }
})();
