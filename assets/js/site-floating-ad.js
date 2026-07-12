(function () {
  'use strict';

  var SESSION_KEY = 'donghuabatch:floating-ad-closed';
  var EXIT_DURATION = 240;
  var AD_LOAD_TIMEOUT = 12000;
  /* MutationObserver handles normal ad injection; this is a fallback only. */
  var INSPECT_INTERVAL = 1200;
  var MIN_CREATIVE_AREA = 80;
  /* Delay start so in-page widgets can claim atOptions first. */
  /* Do not compete with initial rendering and the user's first scroll. */
  var START_DELAY = 2200;
  var MOBILE_MAX = 767;

  function getSessionValue() {
    try {
      return window.sessionStorage.getItem(SESSION_KEY);
    } catch (error) {
      return null;
    }
  }

  function rememberClosed() {
    try {
      window.sessionStorage.setItem(SESSION_KEY, '1');
    } catch (error) {
      // Close must still work when storage is unavailable.
    }
  }

  function isMobileViewport() {
    return window.matchMedia('(max-width: ' + MOBILE_MAX + 'px)').matches;
  }

  function isVisibleSize(el) {
    if (!el || !el.getBoundingClientRect) return false;
    var rect = el.getBoundingClientRect();
    var w = rect.width || el.offsetWidth || 0;
    var h = rect.height || el.offsetHeight || 0;
    return w >= 2 && h >= 2 && w * h >= MIN_CREATIVE_AREA;
  }

  function hasRenderedCreative(unit) {
    if (!unit) return false;

    var nodes = unit.querySelectorAll('iframe, object, embed, img, video, ins');
    for (var i = 0; i < nodes.length; i++) {
      if (isVisibleSize(nodes[i])) return true;
    }

    var kids = unit.children;
    for (var k = 0; k < kids.length; k++) {
      var child = kids[k];
      if (child.tagName === 'SCRIPT') continue;
      if (isVisibleSize(child) && (child.childElementCount > 0 || (child.textContent || '').trim().length > 0)) {
        return true;
      }
    }

    return false;
  }

  function pickResponsiveFloatingUnit(ad) {
    var units = ad.querySelectorAll('[data-floating-ad-unit]');
    if (!units.length) return null;
    if (units.length === 1) {
      units[0].hidden = false;
      return units[0];
    }

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

    ad.setAttribute('data-ad-viewport', want);
    ad.setAttribute(
      'data-ad-active-size',
      (chosen.getAttribute('data-ad-width') || '') + 'x' + (chosen.getAttribute('data-ad-height') || '')
    );
    return chosen;
  }

  function injectNetworkScript(unit) {
    if (!unit) return null;
    var existing = unit.querySelector('[data-floating-ad-network-script]');
    if (existing) return existing;

    var invoke = unit.getAttribute('data-ad-invoke');
    var key = unit.getAttribute('data-ad-key');
    if (!invoke) return null;

    try {
      if (key) {
        window.atOptions = {
          key: key,
          format: unit.getAttribute('data-ad-format') || 'iframe',
          height: parseInt(unit.getAttribute('data-ad-height') || '50', 10),
          width: parseInt(unit.getAttribute('data-ad-width') || '320', 10),
          params: {}
        };
      }
    } catch (e) {
      /* ignore */
    }

    var script = document.createElement('script');
    script.src = invoke;
    script.async = true;
    script.setAttribute('data-floating-ad-network-script', '');
    unit.appendChild(script);
    return script;
  }

  function fitUnit(unit) {
    if (!unit || unit.hidden) return;
    var cw = parseInt(unit.getAttribute('data-ad-width') || '0', 10) || 320;
    var ch = parseInt(unit.getAttribute('data-ad-height') || '0', 10) || 50;
    unit.style.setProperty('--ad-creative-width', cw + 'px');
    unit.style.setProperty('--ad-creative-height', ch + 'px');

    var available = unit.clientWidth || (unit.parentElement && unit.parentElement.clientWidth) || window.innerWidth || cw;
    var scale = Math.min(1, available / cw);
    if (!isFinite(scale) || scale <= 0) scale = 1;
    unit.style.setProperty('--ad-scale', String(scale));
    unit.style.height = (ch * scale) + 'px';
  }

  function monitorProductionAd(ad, unit) {
    var fallback = ad.querySelector('[data-floating-ad-fallback]');
    var status = ad.querySelector('[data-floating-ad-status]');
    var observer = null;
    var timeoutId = null;
    var intervalId = null;
    var settled = false;

    if (!unit) {
      return function () {};
    }

    function stopMonitoring() {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
      if (observer) observer.disconnect();
    }

    function markLoaded() {
      if (settled) return;
      settled = true;
      stopMonitoring();
      unit.hidden = false;
      if (fallback) fallback.hidden = true;
      ad.setAttribute('data-ad-status', 'loaded');
      if (status) status.textContent = 'Live';
      fitUnit(unit);
    }

    function hideAdCompletely() {
      if (settled) return;
      if (hasRenderedCreative(unit)) {
        markLoaded();
        return;
      }

      settled = true;
      stopMonitoring();
      unit.hidden = true;
      if (fallback) fallback.hidden = true;
      ad.setAttribute('data-ad-status', 'failed');
      if (status) status.textContent = 'Hidden';
      ad.classList.remove('is-visible');
      ad.classList.add('is-closing');
      document.body.classList.remove('has-floating-ad', 'has-floating-production-ad');
      window.setTimeout(function () {
        ad.hidden = true;
        ad.setAttribute('aria-hidden', 'true');
        ad.classList.remove('is-closing');
      }, EXIT_DURATION);
    }

    function inspectUnit() {
      if (hasRenderedCreative(unit)) markLoaded();
    }

    var networkScript = injectNetworkScript(unit);

    if (hasRenderedCreative(unit)) {
      markLoaded();
      return stopMonitoring;
    }

    if ('MutationObserver' in window) {
      observer = new MutationObserver(inspectUnit);
      observer.observe(unit, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class', 'src', 'hidden']
      });
    }

    intervalId = window.setInterval(inspectUnit, INSPECT_INTERVAL);

    if (networkScript) {
      networkScript.addEventListener('error', hideAdCompletely, { once: true });
      networkScript.addEventListener('load', inspectUnit, { once: true });
    }

    timeoutId = window.setTimeout(hideAdCompletely, AD_LOAD_TIMEOUT);
    return stopMonitoring;
  }

  function initFloatingAd() {
    var ad = document.querySelector('[data-floating-ad]');
    var closeButton = ad && ad.querySelector('[data-floating-ad-close]');

    if (!ad || !closeButton) return;

    if (getSessionValue() === '1') {
      ad.remove();
      return;
    }

    var productionUnit = pickResponsiveFloatingUnit(ad);
    var stopMonitoring = function () {};

    function revealAndMonitor() {
      stopMonitoring = monitorProductionAd(ad, productionUnit);
      ad.hidden = false;
      ad.removeAttribute('aria-hidden');

      window.requestAnimationFrame(function () {
        ad.classList.add('is-visible');
        document.body.classList.add('has-floating-ad');
        if (productionUnit) document.body.classList.add('has-floating-production-ad');
        fitUnit(productionUnit);
      });
    }

    if (productionUnit) {
      window.setTimeout(revealAndMonitor, START_DELAY);
    } else {
      /* Dev placeholder path */
      ad.hidden = false;
      window.requestAnimationFrame(function () {
        ad.classList.add('is-visible');
        document.body.classList.add('has-floating-ad');
      });
    }

    window.addEventListener('resize', function () {
      fitUnit(productionUnit);
    }, { passive: true });
    window.addEventListener('orientationchange', function () {
      fitUnit(productionUnit);
    }, { passive: true });

    /* Tombol close selalu aktif selama floating tampil (bukan hanya setelah ad loaded). */
    closeButton.hidden = false;
    closeButton.removeAttribute('aria-hidden');
    closeButton.disabled = false;

    closeButton.addEventListener('click', function (event) {
      if (event && event.preventDefault) event.preventDefault();
      if (event && event.stopPropagation) event.stopPropagation();

      rememberClosed();
      stopMonitoring();
      ad.classList.remove('is-visible');
      ad.classList.add('is-closing');
      document.body.classList.remove('has-floating-ad', 'has-floating-production-ad');
      closeButton.disabled = true;

      window.setTimeout(function () {
        ad.hidden = true;
        ad.setAttribute('aria-hidden', 'true');
        ad.classList.remove('is-closing');
      }, EXIT_DURATION);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFloatingAd, { once: true });
  } else {
    initFloatingAd();
  }
})();
