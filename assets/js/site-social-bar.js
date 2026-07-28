/*!
  Social Bar Adsterra — pemuatan lazy
  ────────────────────────────────────────────────────────
  Script Social Bar merender overlay-nya sendiri di atas halaman, jadi tidak ada
  slot markup yang perlu disediakan. Modul ini hanya mengatur kapan script
  dipasang dan memberi ruang di bawah layar supaya tombol Back to Top serta
  floating ad tidak tertutup.

  Pemicu (mana yang lebih dulu):
  1. requestIdleCallback setelah halaman siap
  2. interaksi pertama: scroll, klik, sentuh, atau tombol
  3. timeout data-social-bar-delay

  Konfigurasi ada di config.toml [params.socialBar] dan dibaca lewat
  layouts/partials/widget/social-bar.html.
*/

(function () {
  'use strict';

  var OFFSET_PROPERTY = '--social-bar-height';
  var BODY_CLASS = 'has-social-bar';
  var INTERACTION_EVENTS = ['scroll', 'pointerdown', 'touchstart', 'keydown'];
  var loaded = false;
  var timerId = null;
  var idleId = null;

  function readConfig() {
    var node = document.querySelector('[data-social-bar]');
    if (!node) return null;

    var src = node.getAttribute('data-social-bar-src') || '';
    if (!src) return null;

    var delay = parseInt(node.getAttribute('data-social-bar-delay') || '', 10);
    var offset = parseInt(node.getAttribute('data-social-bar-offset') || '', 10);

    return {
      node: node,
      src: src,
      delay: isFinite(delay) && delay >= 0 ? delay : 3500,
      offset: isFinite(offset) && offset >= 0 ? offset : 56
    };
  }

  function applyOffset(offset) {
    if (!offset) return;
    document.documentElement.style.setProperty(OFFSET_PROPERTY, offset + 'px');
    if (document.body) document.body.classList.add(BODY_CLASS);
  }

  function clearOffset() {
    document.documentElement.style.removeProperty(OFFSET_PROPERTY);
    if (document.body) document.body.classList.remove(BODY_CLASS);
  }

  function detachTriggers(handler) {
    for (var i = 0; i < INTERACTION_EVENTS.length; i++) {
      window.removeEventListener(INTERACTION_EVENTS[i], handler);
    }
    if (timerId) {
      window.clearTimeout(timerId);
      timerId = null;
    }
    if (idleId && typeof window.cancelIdleCallback === 'function') {
      window.cancelIdleCallback(idleId);
      idleId = null;
    }
  }

  function injectScript(config) {
    var script = document.createElement('script');
    script.src = config.src;
    script.async = true;
    script.setAttribute('data-cfasync', 'false');
    script.setAttribute('data-social-bar-script', '');

    script.onload = function () {
      applyOffset(config.offset);
    };
    script.onerror = function () {
      // Script diblokir atau jaringan gagal: kembalikan ruang bawah layar.
      clearOffset();
    };

    (document.body || document.documentElement).appendChild(script);
  }

  function initSocialBar() {
    var config = readConfig();
    if (!config) return;

    // Adblock sudah terdeteksi oleh site-ad-fallback.js atau site-floating-ad.js.
    // Kalau iklan diblokir, melempar request tambahan hanya membuang bandwidth.
    if (window.__siteAdBlocked === true) return;

    function load() {
      if (loaded) return;
      loaded = true;
      detachTriggers(load);
      injectScript(config);
    }

    for (var i = 0; i < INTERACTION_EVENTS.length; i++) {
      window.addEventListener(INTERACTION_EVENTS[i], load, { passive: true, once: true });
    }

    if (typeof window.requestIdleCallback === 'function') {
      idleId = window.requestIdleCallback(load, { timeout: config.delay });
    }

    timerId = window.setTimeout(load, config.delay);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSocialBar, { once: true });
  } else {
    initSocialBar();
  }
})();
