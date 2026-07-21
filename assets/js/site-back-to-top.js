(function () {
  'use strict';

  const THRESHOLD = 200;

  function initBackToTop() {
    const wrapper = document.getElementById('btt-wrapper');
    const btn = document.getElementById('btt-btn');

    if (!wrapper || !btn) return;

    let isVisible = false;
    let ticking = false;

    function update() {
      const scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
      const shouldBeVisible = scrollY > THRESHOLD;

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
    window.addEventListener('resize', onScroll, { passive: true });
    window.addEventListener('load', update, { once: true });

    update();
  }

  document.addEventListener('DOMContentLoaded', initBackToTop);
})();
