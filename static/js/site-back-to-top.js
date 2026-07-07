(function () {
  'use strict';

  var THRESHOLD = 200;

  function initBackToTop() {
    var wrapper = document.getElementById('btt-wrapper');
    var btn = document.getElementById('btt-btn');
    var gauge = document.getElementById('btt-gauge-fill');
    var pctLabel = document.getElementById('btt-pct');

    if (!wrapper || !btn || !gauge || !pctLabel) return;

    var isVisible = false;
    var ticking = false;

    function getScrollPercent() {
      var doc = document.documentElement;
      var body = document.body;
      var scrollTop = window.pageYOffset || doc.scrollTop || body.scrollTop || 0;
      var scrollHeight = Math.max(
        body.scrollHeight, doc.scrollHeight,
        body.offsetHeight, doc.offsetHeight,
        body.clientHeight, doc.clientHeight
      );
      var clientHeight = doc.clientHeight;
      var maxScroll = scrollHeight - clientHeight;

      if (maxScroll <= 0) return 0;
      return Math.min(100, Math.round((scrollTop / maxScroll) * 100));
    }

    function update() {
      var scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
      var pct = getScrollPercent();
      var shouldBeVisible = scrollY > THRESHOLD;

      gauge.style.width = pct + '%';
      pctLabel.textContent = pct + '%';

      if (shouldBeVisible !== isVisible) {
        isVisible = shouldBeVisible;
        wrapper.classList.toggle('is-visible', isVisible);
        wrapper.setAttribute('aria-hidden', isVisible ? 'false' : 'true');
      }

      ticking = false;
    }

    function onScroll() {
      if (!ticking) {
        window.requestAnimationFrame(update);
        ticking = true;
      }
    }

    btn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    btn.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });

    window.addEventListener('scroll', onScroll, { passive: true });
    update();
  }

  document.addEventListener('DOMContentLoaded', initBackToTop);
})();
