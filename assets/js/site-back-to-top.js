(function () {
  'use strict';

  const THRESHOLD = 200;

  function initBackToTop() {
    const wrapper = document.getElementById('btt-wrapper');
    const btn = document.getElementById('btt-btn');
    const gauge = document.getElementById('btt-gauge-fill');
    const pctLabel = document.getElementById('btt-pct');

    if (!wrapper || !btn || !gauge || !pctLabel) return;

    let isVisible = false;
    let ticking = false;

    function getScrollPercent() {
      const doc = document.documentElement;
      const body = document.body;
      const scrollTop = window.pageYOffset || doc.scrollTop || body.scrollTop || 0;
      const scrollHeight = Math.max(
        body.scrollHeight, doc.scrollHeight,
        body.offsetHeight, doc.offsetHeight,
        body.clientHeight, doc.clientHeight
      );
      const clientHeight = doc.clientHeight;
      const maxScroll = scrollHeight - clientHeight;

      if (maxScroll <= 0) return 0;
      return Math.min(100, Math.round((scrollTop / maxScroll) * 100));
    }

    function update() {
      const scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
      const pct = getScrollPercent();
      const shouldBeVisible = scrollY > THRESHOLD;

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
