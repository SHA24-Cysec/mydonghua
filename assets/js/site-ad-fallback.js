(function () {
  'use strict';

  var MOBILE_MAX = 767;
  var AD_INSPECT_TIMEOUT = 7000; // Tunggu ~7 dtk sebelum memutuskan iklan gagal.
  var loadQueue = [];
  var queueRunning = false;

  function isMobileViewport() {
    return window.matchMedia('(max-width: ' + MOBILE_MAX + 'px)').matches;
  }

  /* =========================================================
     Deteksi pemblokir iklan (adblock) — metode "bait".
     Hasil di-cache di window agar dipakai bersama oleh floating-ad.
     ========================================================= */
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

  // Render satu unit iklan di dalam iframe terisolasi miliknya sendiri.
  function injectAdIframe(unit, key, format, width, height, invokeUrl) {
    if (!unit || !invokeUrl) return null;

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

  /* =========================================================
     Cek apakah unit iklan benar-benar terisi kreatif.
     ========================================================= */
  function adRendered(unit) {
    if (!unit) return false;

    // Unit native/container-based (script langsung mengisi container).
    var container = unit.querySelector('[data-ad-ignore]');
    if (container && container.childElementCount > 0) return true;

    // Unit berbasis iframe isolasi (300x250, banner).
    var iframe = unit.querySelector('iframe');
    if (iframe) {
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
        // Tidak bisa diintip (cross-origin) => anggap iklan berhasil dimuat.
        return true;
      }
    }
    return false;
  }

  /* =========================================================
     Iklan gagal tampil pada widget (adblock/no-fill/jaringan).
     Untuk unit non-floating: sembunyikan SELURUH widget (bingkai
     neon ikut hilang lewat .ad-neon-shell[hidden]). Fallback kartu
     hanya dipakai floating ad (ditangani site-floating-ad.js).
     ========================================================= */
  function showFallback(widget, kind) {
    // Buang unit iklan & placeholder demo agar tidak menyisakan ruang.
    var units = widget.querySelectorAll('[data-ad-unit]');
    for (var i = 0; i < units.length; i++) {
      if (units[i].parentNode) units[i].parentNode.removeChild(units[i]);
    }

    widget.hidden = true;
    widget.setAttribute('aria-hidden', 'true');
    widget.setAttribute('data-ad-status', 'hidden-' + kind);

    // Banner responsif punya wrapper luar (mt-4) — sembunyikan juga
    // supaya tidak menyisakan celah kosong.
    var wrapper = widget.closest ? widget.closest('[data-ad-banner-wrapper]') : null;
    if (wrapper) wrapper.hidden = true;
  }

  function injectWidget(widget, adBlocked, done) {
    // Adblock terdeteksi: jangan minta iklan, langsung fallback sopan.
    if (adBlocked) {
      showFallback(widget, 'adblock');
      if (done) window.setTimeout(done, 60);
      return;
    }

    var unit = pickResponsiveUnit(widget);
    if (!unit) {
      showFallback(widget, 'house');
      if (done) window.setTimeout(done, 60);
      return;
    }

    var invoke = unit.getAttribute('data-ad-invoke');
    var key = unit.getAttribute('data-ad-key');

    if (invoke && key) {
      var format = unit.getAttribute('data-ad-format') || 'iframe';
      var height = parseInt(unit.getAttribute('data-ad-height') || '0', 10);
      var width = parseInt(unit.getAttribute('data-ad-width') || '0', 10);
      injectAdIframe(unit, key, format, width, height, invoke);
    } else if (invoke) {
      var script = document.createElement('script');
      script.src = invoke;
      script.async = true;
      script.setAttribute('data-cfasync', 'false');
      script.onerror = function () {
        showFallback(widget, 'house');
      };
      unit.appendChild(script);
    }

    unit.hidden = false;
    widget.hidden = false;
    widget.setAttribute('data-ad-status', 'loading');

    // Beri waktu network mengisi kreatif, lalu inspeksi.
    window.setTimeout(function () {
      if (widget.getAttribute('data-ad-status') === 'loading') {
        if (adRendered(unit)) {
          widget.setAttribute('data-ad-status', 'loaded');
        } else {
          showFallback(widget, 'house');
        }
      }
      if (done) done();
    }, AD_INSPECT_TIMEOUT);
  }

  function enqueueWidget(widget, adBlocked) {
    loadQueue.push({ widget: widget, blocked: adBlocked });
    if (!queueRunning) pumpQueue();
  }

  function pumpQueue() {
    var next = loadQueue.shift();
    if (!next) {
      queueRunning = false;
      return;
    }
    queueRunning = true;
    // Saat adblock, langsung lanjut (tanpa menunggu timeout penuh).
    injectWidget(next.widget, next.blocked, function () {
      pumpQueue();
    });
    if (next.blocked) {
      // Fallback adblock instan: jangan blok antrean menunggu timeout.
      window.setTimeout(pumpQueue, 0);
      queueRunning = false;
    }
  }

  function initAdFallbacks() {
    var widgets = document.querySelectorAll('[data-ad-widget]:not([data-floating-ad])');
    if (!widgets.length) return;

    detectAdBlock(function (blocked) {
      for (var i = 0; i < widgets.length; i++) {
        if (blocked) {
          // Adblock: tampilkan fallback serentak, tak perlu antrean network.
          showFallback(widgets[i], 'adblock');
        } else {
          enqueueWidget(widgets[i], false);
        }
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAdFallbacks, { once: true });
  } else {
    initAdFallbacks();
  }
})();
