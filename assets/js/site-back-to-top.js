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
    let maxScroll = 0;
    let lastPercent = -1;

    /*
     * Reading every document dimension for every scroll frame can force layout
     * on long pages. Keep the metric cached and refresh it only when the
     * viewport or the document's load state can change its dimensions.
     */
    function refreshScrollMetrics() {
      const doc = document.documentElement;
      const body = document.body;
      const scrollHeight = Math.max(doc.scrollHeight, body ? body.scrollHeight : 0);
      maxScroll = Math.max(0, scrollHeight - doc.clientHeight);
    }

    function update() {
      const scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
      const pct = maxScroll > 0 ? Math.min(100, Math.round((scrollY / maxScroll) * 100)) : 0;
      const shouldBeVisible = scrollY > THRESHOLD;

      /* Avoid DOM writes when the displayed progress has not changed. */
      if (pct !== lastPercent) {
        gauge.style.width = pct + '%';
        pctLabel.textContent = pct + '%';
        lastPercent = pct;
      }

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

    function refreshAndUpdate() {
      refreshScrollMetrics();
      onScroll();
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
    window.addEventListener('resize', refreshAndUpdate, { passive: true });
    window.addEventListener('orientationchange', refreshAndUpdate, { passive: true });
    window.addEventListener('load', refreshAndUpdate, { once: true });

    refreshScrollMetrics();
    update();
  }

  document.addEventListener('DOMContentLoaded', initBackToTop);
})();
