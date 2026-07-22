(function () {
  'use strict';

  const THRESHOLD = 200;
  const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

  function initBackToTop() {
    const wrapper = document.getElementById('btt-wrapper');
    const btn = document.getElementById('btt-btn');
    const focusTarget = document.getElementById('main-content');

    if (!wrapper || !btn) return;

    let isVisible = false;
    let ticking = false;

    function focusMainContent() {
      if (!focusTarget || typeof focusTarget.focus !== 'function') return;

      try {
        focusTarget.focus({ preventScroll: true });
      } catch (error) {
        focusTarget.focus();
      }
    }

    function update() {
      const scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
      const shouldBeVisible = scrollY > THRESHOLD;

      if (shouldBeVisible !== isVisible) {
        isVisible = shouldBeVisible;
        wrapper.classList.toggle('is-visible', isVisible);
        wrapper.setAttribute('aria-hidden', isVisible ? 'false' : 'true');

        if (!isVisible && document.activeElement === btn) {
          focusMainContent();
        }
      }

      ticking = false;
    }

    function onScroll() {
      if (ticking) return;
      window.requestAnimationFrame(update);
      ticking = true;
    }

    function returnToTop() {
      const reduceMotion = window.matchMedia && window.matchMedia(REDUCED_MOTION_QUERY).matches;

      focusMainContent();

      if (reduceMotion) {
        const rootStyle = document.documentElement.style;
        const previousBehavior = rootStyle.getPropertyValue('scroll-behavior');
        const previousPriority = rootStyle.getPropertyPriority('scroll-behavior');

        rootStyle.setProperty('scroll-behavior', 'auto', 'important');
        window.scrollTo({ top: 0, behavior: 'auto' });

        window.requestAnimationFrame(function () {
          if (previousBehavior) {
            rootStyle.setProperty('scroll-behavior', previousBehavior, previousPriority);
          } else {
            rootStyle.removeProperty('scroll-behavior');
          }
        });
        return;
      }

      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    btn.addEventListener('click', returnToTop);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    window.addEventListener('load', update, { once: true });

    update();
  }

  document.addEventListener('DOMContentLoaded', initBackToTop);
})();
