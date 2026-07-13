(function () {
  'use strict';

  var SESSION_KEY = 'site_floating_ad_closed';
  var AD_INSPECT_TIMEOUT = 6000; // 6 detik

  function hasRenderedCreative(container) {
    if (!container) return false;
    var nodes = container.querySelectorAll('iframe, img, ins, div[id*="container"]');
    for (var i = 0; i < nodes.length; i++) {
      var rect = nodes[i].getBoundingClientRect();
      if (rect.width > 50 && rect.height > 30) return true;
    }
    return false;
  }

  function initFloatingAd() {
    var ad = document.querySelector('[data-floating-ad]');
    if (!ad || window.sessionStorage.getItem(SESSION_KEY) === '1') {
      if (ad) ad.remove();
      return;
    }

    // Native ad sudah di-inject langsung di HTML (Adsterra script #3)
    // Jadi kita hanya perlu menunggu dan cek apakah muncul
    ad.hidden = false;
    ad.classList.add('is-visible');
    document.body.classList.add('has-floating-ad');

    var nativeContainer = ad.querySelector('#container-4aab23755134ef6ae6e4d517e0c554dc');
    var fallback = ad.querySelector('[data-floating-ad-fallback]');

    // Fallback jika native ad gagal render
    setTimeout(function() {
      if (nativeContainer && !hasRenderedCreative(nativeContainer)) {
        if (fallback) {
          fallback.hidden = false;
          fallback.style.display = 'flex';
        }
      }
    }, AD_INSPECT_TIMEOUT);

    var closeButton = ad.querySelector('[data-floating-ad-close]');
    if (closeButton) {
      closeButton.addEventListener('click', function () {
        window.sessionStorage.setItem(SESSION_KEY, '1');
        ad.classList.remove('is-visible');
        document.body.classList.remove('has-floating-ad');
        setTimeout(function() { ad.hidden = true; }, 300);
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFloatingAd, { once: true });
  } else {
    initFloatingAd();
  }
})();
