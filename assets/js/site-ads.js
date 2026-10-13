(function () {
  'use strict';

  /* =========================================================
     Pemuat slot iklan inline (300x250 sidebar, banner responsif
     728x90/320x50, dan native di halaman posting).

     Berisi mesin pemuat dari berkas lama site-ad-fallback.js, tanpa
     kartu fallback dan tanpa deteksi adblock (keduanya dihapus atas
     permintaan pemilik situs). Iklan dianggap gagal hanya dari bukti
     nyata di halaman: skrip vendor memicu error, atau tidak ada
     kreatif yang terisi sampai batas waktu inspeksi.

     Perilaku saat gagal: slot ditutup senyap, tanpa kartu pengganti
     dan tanpa menyisakan ruang kosong.

     atOptions adalah variabel global milik jaringan iklan, jadi unit
     dengan key berbeda dimuat berurutan lewat antrean di bawah.
     ========================================================= */

  var MOBILE_MAX = 767;
  // Jendela inspeksi isi kreatif. Polling dipakai agar kreatif yang
  // terisi sedikit telat tetap dihormati sebelum slot dianggap gagal
  // (audit 2026-10-13: dulu satu kali cek di 7 detik, lalu slot
  // dianggap gagal walau kreatif datang belakangan).
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
     Pemuatan unit iklan langsung di halaman (audit 2026-10-13,
     Opsi A). Sebelumnya skrip dimuat di iframe sandbox ber-origin
     buram; skrip Adsterra tidak kompatibel dengan konteks itu
     (gate jendela atas, cookie, storage, anti-emulasi) sehingga
     kreatif tidak pernah terisi. Sekarang invoke.js dijalankan di
     dokumen halaman, sama seperti unit native dan social bar.
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

  // Pembungkus banner hanya berisi slot iklan; bila slot ditutup,
  // pembungkusnya ikut disembunyikan supaya tidak ada celah margin.
  function closestAdWrapper(widget) {
    var node = widget.parentNode;
    while (node && node.nodeType === 1 && node !== document.body) {
      if (typeof node.getAttribute === 'function' && node.getAttribute('data-ad-banner-wrapper') !== null) {
        return node;
      }
      node = node.parentNode;
    }
    return null;
  }

  /* =========================================================
     Iklan tidak terisi (no-fill, galat skrip, atau pemblokir iklan
     yang menggagalkan permintaan skrip). Slot ditutup senyap: widget
     dan pembungkusnya disembunyikan, tanpa kartu pengganti.
     data-ad-status disimpan sebagai jejak saat memeriksa halaman.
     ========================================================= */
  function hideWidget(widget) {
    var wrapper = closestAdWrapper(widget);
    if (wrapper) wrapper.hidden = true;

    widget.hidden = true;
    widget.setAttribute('aria-hidden', 'true');
    widget.setAttribute('data-ad-status', 'hidden-nofill');
  }

  /* =========================================================
     Pantau isi unit sampai AD_INSPECT_TIMEOUT. Selama status
     masih "loading", kreatif yang terisi kapan pun akan mengubah
     status menjadi "loaded" dan membatalkan penutupan slot.
     ========================================================= */
  function watchUnit(widget, unit) {
    var started = Date.now();
    var timer = window.setInterval(function () {
      if (widget.hidden || widget.getAttribute('data-ad-status') !== 'loading') {
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
          hideWidget(widget);
        }
      }
    }, AD_POLL_INTERVAL);
  }

  function injectWidget(widget, done) {
    var unit = pickResponsiveUnit(widget);
    if (!unit) {
      hideWidget(widget);
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
      hideWidget(widget);
      if (done) done();
      return;
    }

    var script = injectAdScript(unit, key, format, width, height, invoke);
    if (!script) {
      hideWidget(widget);
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
      hideWidget(widget);
      advance();
    });
    window.setTimeout(advance, QUEUE_ADVANCE_TIMEOUT);

    watchUnit(widget, unit);
  }

  function enqueueWidget(widget) {
    loadQueue.push({ widget: widget });
    if (!queueRunning) pumpQueue();
  }

  function pumpQueue() {
    var next = loadQueue.shift();
    if (!next) {
      queueRunning = false;
      return;
    }
    queueRunning = true;
    injectWidget(next.widget, function () {
      pumpQueue();
    });
  }

  function initAds() {
    var widgets = document.querySelectorAll('[data-ad-widget]:not([data-floating-ad])');
    if (!widgets.length) return;

    for (var i = 0; i < widgets.length; i++) {
      enqueueWidget(widgets[i]);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAds, { once: true });
  } else {
    initAds();
  }
})();
