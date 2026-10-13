(function () {
  'use strict';

  var MOBILE_MAX = 767;
  // Jendela inspeksi isi kreatif. Polling dipakai agar kreatif yang
  // terisi sedikit telat tetap dihormati sebelum dianggap gagal
  // (audit 2026-10-13: dulu satu kali cek di 7 detik, lalu slot
  // disembunyikan permanen walau kreatif datang belakangan).
  var AD_INSPECT_TIMEOUT = 15000;
  var AD_POLL_INTERVAL = 500;
  // Jaring pengaman antrean: skrip vendor yang tidak memunculkan
  // load/error tidak boleh menghentikan unit berikutnya.
  var QUEUE_ADVANCE_TIMEOUT = 8000;

  var loadQueue = [];
  var queueRunning = false;

  function isMobileViewport() {
    return window.matchMedia('(max-width: ' + MOBILE_MAX + 'px)').matches;
  }

  /* =========================================================
     Deteksi pemblokir iklan (adblock) dengan metode "bait".
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
      var blocked;
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

  /* =========================================================
     Pemuatan unit iklan langsung di halaman (audit 2026-10-13,
     Opsi A). Sebelumnya skrip dimuat di iframe sandbox ber-origin
     buram; skrip Adsterra tidak kompatibel dengan konteks itu
     (gate jendela atas, cookie, storage, anti-emulasi) sehingga
     kreatif tidak pernah terisi. Sekarang invoke.js dijalankan di
     dokumen halaman, sama seperti unit native dan social bar.

     atOptions adalah variabel global, jadi unit dengan key
     berbeda harus dimuat berurutan (lihat antrean di bawah).
     ========================================================= */
  function injectAdScript(unit, key, format, width, height, invokeUrl) {
    if (!unit || !invokeUrl) return null;

    if (key) {
      window.atOptions = {
        key: key,
        format: format || 'iframe',
        height: height,
        width: width,
        params: {}
      };
    }

    var script = document.createElement('script');
    script.src = invokeUrl;
    script.async = false;
    script.setAttribute('data-cfasync', 'false');
    script.setAttribute('data-ad-script', '1');
    unit.appendChild(script);
    return script;
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
     Cek apakah unit iklan benar-benar mulai terisi kreatif.
     - Unit native/container: jaringan mengisi elemen container.
     - Unit lain: skrip vendor menyisipkan node kreatif (iframe,
       ins, img, atau wrapper) ke dalam unit di dekat tag skripnya.
     Kehadiran node non-skrif dianggap render dimulai.
     ========================================================= */
  function adRendered(unit) {
    if (!unit) return false;

    var container = unit.querySelector('[data-ad-ignore]');
    if (container && container.childElementCount > 0) return true;

    var kids = unit.children;
    for (var i = 0; i < kids.length; i++) {
      if (kids[i].tagName === 'SCRIPT') continue;
      // Kontainer placeholder unit native (data-ad-ignore) sudah ada
      // sejak awal dan bukan bukti kreatif terisi.
      if (kids[i].getAttribute && kids[i].getAttribute('data-ad-ignore') !== null) continue;
      return true;
    }
    return false;
  }

  /* =========================================================
     Iklan gagal tampil pada widget (adblock/no-fill/galat skrip).
     Kartu fallback (varian adblock/house) ditampilkan menggantikan
     unit, sehingga slot tidak pernah kosong tanpa keterangan
     (audit 2026-10-13, sebelumnya widget disembunyikan total).
     ========================================================= */
  function showFallback(widget, kind) {
    // Buang unit iklan agar tidak menyisakan ruang kosong.
    var units = widget.querySelectorAll('[data-ad-unit]');
    for (var i = 0; i < units.length; i++) {
      if (units[i].parentNode) units[i].parentNode.removeChild(units[i]);
    }

    var fallback = widget.querySelector('[data-ad-fallback]');
    if (fallback) {
      var variants = fallback.querySelectorAll('[data-ad-fallback-variant]');
      for (var v = 0; v < variants.length; v++) {
        var match = variants[v].getAttribute('data-ad-fallback-variant') === kind;
        variants[v].hidden = !match;
      }
      fallback.hidden = false;
      fallback.setAttribute('aria-hidden', 'false');
      widget.setAttribute('data-ad-status', 'fallback-' + kind);
      return;
    }

    // Widget lama tanpa markup kartu: sembunyikan total.
    widget.hidden = true;
    widget.setAttribute('aria-hidden', 'true');
    widget.setAttribute('data-ad-status', 'hidden-' + kind);
  }

  /* =========================================================
     Pantau isi unit sampai AD_INSPECT_TIMEOUT. Selama status
     masih "loading", kreatif yang terisi kapan pun akan
     mengubah status menjadi "loaded" dan membatalkan fallback.
     ========================================================= */
  function watchUnit(widget, unit) {
    var started = Date.now();
    var timer = window.setInterval(function () {
      if (widget.getAttribute('data-ad-status') !== 'loading') {
        window.clearInterval(timer);
        return;
      }
      if (adRendered(unit)) {
        window.clearInterval(timer);
        widget.setAttribute('data-ad-status', 'loaded');
        return;
      }
      if (Date.now() - started >= AD_INSPECT_TIMEOUT) {
        window.clearInterval(timer);
        if (widget.getAttribute('data-ad-status') === 'loading') {
          showFallback(widget, 'house');
        }
      }
    }, AD_POLL_INTERVAL);
  }

  function injectWidget(widget, adBlocked, done) {
    // Adblock terdeteksi: jangan minta iklan, langsung fallback sopan.
    if (adBlocked) {
      showFallback(widget, 'adblock');
      if (done) done();
      return;
    }

    var unit = pickResponsiveUnit(widget);
    if (!unit) {
      showFallback(widget, 'house');
      if (done) done();
      return;
    }

    var invoke = unit.getAttribute('data-ad-invoke');
    var key = unit.getAttribute('data-ad-key');
    var format = unit.getAttribute('data-ad-format') || 'iframe';
    var height = parseInt(unit.getAttribute('data-ad-height') || '0', 10);
    var width = parseInt(unit.getAttribute('data-ad-width') || '0', 10);

    unit.hidden = false;
    widget.hidden = false;
    widget.setAttribute('data-ad-status', 'loading');

    if (!invoke) {
      showFallback(widget, 'house');
      if (done) done();
      return;
    }

    var script = injectAdScript(unit, key, format, width, height, invoke);
    if (!script) {
      showFallback(widget, 'house');
      if (done) done();
      return;
    }

    // Antrean boleh lanjut setelah skrip dieksekusi (load/error),
    // bukan menunggu inspeksi selesai, agar unit berikutnya tidak
    // tertunda sampai 15 detik per slot.
    var advanced = false;
    function advance() {
      if (advanced) return;
      advanced = true;
      if (done) done();
    }
    script.addEventListener('load', advance);
    script.addEventListener('error', function () {
      showFallback(widget, 'house');
      advance();
    });
    window.setTimeout(advance, QUEUE_ADVANCE_TIMEOUT);

    watchUnit(widget, unit);
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
    injectWidget(next.widget, next.blocked, function () {
      pumpQueue();
    });
  }

  function initAdFallbacks() {
    var widgets = document.querySelectorAll('[data-ad-widget]:not([data-floating-ad])');
    if (!widgets.length) return;

    detectAdBlock(function (blocked) {
      for (var i = 0; i < widgets.length; i++) {
        if (blocked) {
          // Adblock: tampilkan kartu fallback serentak, tanpa antrean network.
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
