(function () {
  'use strict';

  const SESSION_KEY = 'donghuabatch:floating-ad-closed';
  const EXIT_DURATION = 240;
  const AD_LOAD_TIMEOUT = 8000;

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
      // The close action must still work when browser storage is unavailable.
    }
  }

  function monitorProductionAd(ad) {
    const unit = ad.querySelector('[data-floating-ad-unit]');
    const fallback = ad.querySelector('[data-floating-ad-fallback]');
    const status = ad.querySelector('[data-floating-ad-status]');
    const networkScript = ad.querySelector('[data-floating-ad-network-script]');
    let observer = null;
    let timeoutId = null;
    let settled = false;

    if (!unit || !fallback) return function () {};

    function hasRenderedCreative() {
      return Boolean(unit.querySelector('iframe, object, embed'));
    }

    function stopMonitoring() {
      window.clearTimeout(timeoutId);
      if (observer) observer.disconnect();
    }

    function markLoaded() {
      if (settled) return;
      settled = true;
      stopMonitoring();
      ad.setAttribute('data-ad-status', 'loaded');
      if (status) status.textContent = 'Live';
    }

    function showFallback() {
      if (settled || hasRenderedCreative()) {
        if (hasRenderedCreative()) markLoaded();
        return;
      }

      settled = true;
      stopMonitoring();
      unit.hidden = true;
      fallback.hidden = false;
      ad.setAttribute('data-ad-status', 'fallback');
      if (status) status.textContent = 'Fallback';
    }

    function inspectUnit() {
      if (hasRenderedCreative()) markLoaded();
    }

    if (hasRenderedCreative()) {
      markLoaded();
      return stopMonitoring;
    }

    if ('MutationObserver' in window) {
      observer = new MutationObserver(inspectUnit);
      observer.observe(unit, { childList: true, subtree: true });
    }

    if (networkScript) {
      networkScript.addEventListener('error', showFallback, { once: true });
      networkScript.addEventListener('load', inspectUnit, { once: true });
    }

    timeoutId = window.setTimeout(showFallback, AD_LOAD_TIMEOUT);
    return stopMonitoring;
  }

  function initFloatingAd() {
    const ad = document.querySelector('[data-floating-ad]');
    const closeButton = ad && ad.querySelector('[data-floating-ad-close]');
    const productionUnit = ad && ad.querySelector('[data-floating-ad-unit]');

    if (!ad || !closeButton) return;

    if (getSessionValue() === '1') {
      ad.remove();
      return;
    }

    const stopMonitoring = monitorProductionAd(ad);
    ad.hidden = false;

    window.requestAnimationFrame(function () {
      ad.classList.add('is-visible');
      document.body.classList.add('has-floating-ad');
      if (productionUnit) document.body.classList.add('has-floating-production-ad');
    });

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
