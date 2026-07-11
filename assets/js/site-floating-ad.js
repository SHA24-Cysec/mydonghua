(function () {
  'use strict';

  var SESSION_KEY = 'donghuabatch:floating-ad-closed';
  var EXIT_DURATION = 240;
  var AD_LOAD_TIMEOUT = 12000;
  var INSPECT_INTERVAL = 400;
  var MIN_CREATIVE_AREA = 80;
  /* Delay start so in-page widgets can claim atOptions first. */
  var START_DELAY = 700;

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
          height: parseInt(unit.getAttribute('data-ad-height') || '90', 10),
          width: parseInt(unit.getAttribute('data-ad-width') || '728', 10),
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

  function monitorProductionAd(ad) {
    var unit = ad.querySelector('[data-floating-ad-unit]');
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
    var productionUnit = ad && ad.querySelector('[data-floating-ad-unit]');

    if (!ad || !closeButton) return;

    if (getSessionValue() === '1') {
      ad.remove();
      return;
    }

    var stopMonitoring = function () {};

    function revealAndMonitor() {
      stopMonitoring = monitorProductionAd(ad);
      ad.hidden = false;
      ad.removeAttribute('aria-hidden');

      window.requestAnimationFrame(function () {
        ad.classList.add('is-visible');
        document.body.classList.add('has-floating-ad');
        if (productionUnit) document.body.classList.add('has-floating-production-ad');
      });
    }

    if (productionUnit) {
      window.setTimeout(revealAndMonitor, START_DELAY);
    } else {
      revealAndMonitor();
    }

    closeButton.addEventListener('click', function () {
      rememberClosed();
      stopMonitoring();
      ad.classList.remove('is-visible');
      ad.classList.add('is-closing');
      document.body.classList.remove('has-floating-ad', 'has-floating-production-ad');
      closeButton.disabled = true;

      window.setTimeout(function () {
        ad.hidden = true;
        ad.classList.remove('is-closing');
      }, EXIT_DURATION);
    }, { once: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFloatingAd, { once: true });
  } else {
    initFloatingAd();
  }
})();
