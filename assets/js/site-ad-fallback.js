(function () {
  'use strict';

  var AD_LOAD_TIMEOUT = 8000;

  function hasRenderedCreative(unit) {
    return Boolean(unit.querySelector('iframe, object, embed'));
  }

  function monitorWidget(widget) {
    var unit = widget.querySelector('[data-ad-unit]');
    var fallback = widget.querySelector('[data-ad-fallback]');
    var networkScript = widget.querySelector('[data-ad-network-script]');
    var observer = null;
    var timeoutId = null;
    var settled = false;

    if (!unit || !fallback) return;

    function stopMonitoring() {
      window.clearTimeout(timeoutId);
      if (observer) observer.disconnect();
    }

    function markLoaded() {
      if (settled) return;
      settled = true;
      stopMonitoring();
      widget.setAttribute('data-ad-status', 'loaded');
    }

    function showFallback() {
      if (settled || hasRenderedCreative(unit)) {
        if (hasRenderedCreative(unit)) markLoaded();
        return;
      }
      settled = true;
      stopMonitoring();
      unit.hidden = true;
      fallback.hidden = false;
      widget.setAttribute('data-ad-status', 'fallback');
    }

    function inspectUnit() {
      if (hasRenderedCreative(unit)) markLoaded();
    }

    if (hasRenderedCreative(unit)) {
      markLoaded();
      return;
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
  }

  function initAdFallbacks() {
    var widgets = document.querySelectorAll('[data-ad-widget]');
    for (var i = 0; i < widgets.length; i++) {
      monitorWidget(widgets[i]);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAdFallbacks, { once: true });
  } else {
    initAdFallbacks();
  }
})();
