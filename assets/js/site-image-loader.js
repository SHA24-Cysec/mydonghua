(function () {
  'use strict';

  /*
   * Fallback image handler:
   * Ensures that any image that fails to load is replaced with a
   * neutral placeholder SVG (Icon only) to maintain visual consistency.
   */
  var FALLBACK_IMAGE = 'data:image/svg+xml;charset=UTF-8,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="300" viewBox="0 0 200 300"%3E%3Crect width="200" height="300" fill="%230F172A"/%3E%3Cg fill="%231E293B" stroke="%231E293B" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"%3E%3Crect x="60" y="110" width="80" height="80" rx="8" fill="none"/%3E%3Ccircle cx="120" cy="135" r="8" fill="%231E293B"/%3E%3Cpath d="M75 170l20-15 20 15" fill="none"/%3E%3C/g%3E%3C/svg%3E';

  function handleImageError(event) {
    var img = event.target;
    if (img.tagName === 'IMG' && img.src !== FALLBACK_IMAGE) {
      img.src = FALLBACK_IMAGE;
      img.onerror = null;
    }
  }

  window.addEventListener('error', handleImageError, true);

  /*
   * SCROLL-FLASH FIX:
   * Pasang class .is-loaded setelah image decode selesai. Pasangan CSS
   * di main.css transisi opacity 0->1 sehingga background gradient
   * .donghua-card-poster tidak langsung kelihatan "hitam" saat decode
   * dibatalkan oleh scroll cepat. Image yang sudah ada di cache
   * ditandai lewat 'complete' check; yang baru di-load lewat
   * decode() promise + load event sebagai fallback.
   */
  function markLoaded(img) {
    if (img && img.classList && !img.classList.contains('is-loaded')) {
      img.classList.add('is-loaded');
    }
  }

  function processImage(img) {
    if (!img || img.tagName !== 'IMG') return;
    if (img.classList && img.classList.contains('is-loaded')) return;
    if (img.complete && img.naturalWidth > 0) {
      markLoaded(img);
      return;
    }
    var done = false;
    function finish() {
      if (done) return;
      done = true;
      markLoaded(img);
    }
    img.addEventListener('load', finish, { once: true });
    img.addEventListener('error', finish, { once: true });
    if (typeof img.decode === 'function') {
      img.decode().then(finish, finish);
    }
  }

  function processAll(root) {
    var scope = root || document;
    var imgs = scope.querySelectorAll('img.donghua-card-img');
    for (var i = 0; i < imgs.length; i++) {
      processImage(imgs[i]);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { processAll(); });
  } else {
    processAll();
  }

  // Tangkap card yang disuntik JS lain (recently-viewed, search, favorites)
  var observer = new MutationObserver(function (mutations) {
    for (var i = 0; i < mutations.length; i++) {
      var added = mutations[i].addedNodes;
      for (var j = 0; j < added.length; j++) {
        var node = added[j];
        if (node.nodeType !== 1) continue;
        if (node.tagName === 'IMG' && node.classList && node.classList.contains('donghua-card-img')) {
          processImage(node);
        } else if (node.querySelectorAll) {
          processAll(node);
        }
      }
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
