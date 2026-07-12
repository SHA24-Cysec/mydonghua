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
})();
