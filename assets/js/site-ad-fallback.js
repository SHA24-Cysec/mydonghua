(function () {
  'use strict';

  var MOBILE_MAX = 767;
  var AD_INSPECT_TIMEOUT = 8000; // Tunggu 8 detik sebelum fallback
  var loadQueue = [];
  var queueRunning = false;

  function isMobileViewport() {
    return window.matchMedia('(max-width: ' + MOBILE_MAX + 'px)').matches;
  }

  // Render satu unit iklan di dalam iframe terisolasi miliknya sendiri.
  // Ini memastikan window.atOptions tiap unit independen, tidak saling
  // menimpa walau ada beberapa unit (bahkan dengan key yang sama) di
  // halaman yang sama.
  function injectAdIframe(unit, key, format, width, height, invokeUrl) {
    if (!unit || !invokeUrl) return;

    var iframe = document.createElement('iframe');
    iframe.setAttribute('scrolling', 'no');
    iframe.setAttribute('frameborder', '0');
    iframe.setAttribute('title', 'Advertisement');
    iframe.style.border = '0';
    iframe.style.display = 'block';
    iframe.style.overflow = 'hidden';
    iframe.style.width = (width || 300) + 'px';
    iframe.style.height = (height || 250) + 'px';
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

    if (invoke && key) {
      // Unit berbasis atOptions (300x250, 728x90/320x50): isolasi di iframe
      // sendiri supaya tidak berebut window.atOptions dengan unit lain.
      var format = unit.getAttribute('data-ad-format') || 'iframe';
      var height = parseInt(unit.getAttribute('data-ad-height') || '0', 10);
      var width = parseInt(unit.getAttribute('data-ad-width') || '0', 10);
      injectAdIframe(unit, key, format, width, height, invoke);
    } else if (invoke) {
      // Unit native/container-based: tidak pakai atOptions, aman langsung.
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
