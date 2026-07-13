(function () {
  'use strict';

  var MOBILE_MAX = 767;
  var AD_INSPECT_TIMEOUT = 8000; // Tunggu 8 detik sebelum fallback
  var loadQueue = [];
  var queueRunning = false;

  function isMobileViewport() {
    return window.matchMedia('(max-width: ' + MOBILE_MAX + 'px)').matches;
  }

  // Fallback detection removed as per request
  function hasRenderedCreative(unit) {
    return true; // Always assume success (fallback disabled)
  }

  function applyBannerBodySize(widget, unit) {
    if (!widget || !unit) return;
    var body = widget.querySelector('[data-ad-banner-body]');
    if (!body) return;

    var width = parseInt(unit.getAttribute('data-ad-width') || '0', 10) || 320;
    var height = parseInt(unit.getAttribute('data-ad-height') || '0', 10) || 50;
    var variant = unit.getAttribute('data-ad-variant') || '';

    body.style.setProperty('--ad-creative-width', width + 'px');
    body.style.setProperty('--ad-creative-height', height + 'px');
    body.classList.toggle('is-mobile-banner', variant === 'mobile' || width <= 320);
    body.classList.toggle('is-desktop-banner', variant === 'desktop' || width >= 728);
  }

  function pickResponsiveUnit(widget) {
    var units = widget.querySelectorAll('[data-ad-unit]');
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

    for (var j = 0; j < units.length; j++) {
      if (units[j] === chosen) {
        units[j].hidden = false;
      } else {
        if (units[j].parentNode) units[j].parentNode.removeChild(units[j]);
      }
    }

    applyBannerBodySize(widget, chosen);
    return chosen;
  }

  function injectWidget(widget, done) {
    var unit = pickResponsiveUnit(widget);
    var fallback = widget.querySelector('[data-ad-fallback]');
    if (!unit) { if (done) done(); return; }

    var invoke = unit.getAttribute('data-ad-invoke');
    var key = unit.getAttribute('data-ad-key');
    
    if (key) {
      window.atOptions = {
        key: key,
        format: unit.getAttribute('data-ad-format') || 'iframe',
        height: parseInt(unit.getAttribute('data-ad-height') || '0', 10),
        width: parseInt(unit.getAttribute('data-ad-width') || '0', 10),
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
    
    unit.hidden = false;
    widget.hidden = false;
    
    // Fallback logic removed
    widget.setAttribute('data-ad-status', 'loaded');

    setTimeout(function() {
      if (done) done();
    }, 150);
  }

  function enqueueWidget(widget) {
    loadQueue.push(widget);
    if (!queueRunning) pumpQueue();
  }

  function pumpQueue() {
    var next = loadQueue.shift();
    if (!next) {
      queueRunning = false;
      return;
    }
    queueRunning = true;
    injectWidget(next, function () {
      pumpQueue();
    });
  }

  function initAdFallbacks() {
    var widgets = document.querySelectorAll('[data-ad-widget]:not([data-floating-ad])');
    for (var i = 0; i < widgets.length; i++) {
      enqueueWidget(widgets[i]);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAdFallbacks, { once: true });
  } else {
    initAdFallbacks();
  }
})();
