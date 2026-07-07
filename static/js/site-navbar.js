(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    const container = document.querySelector('[data-site-nav-container]');
    if (!container) return;

    const toggleButton = container.querySelector('[data-nav-open]');
    const toggleIcon = toggleButton ? toggleButton.querySelector('i') : null;
    const desktopQuery = window.matchMedia('(min-width: 1024px)');

    function isOpen() {
      return container.classList.contains('is-open');
    }

    function syncToggleButton(open) {
      if (!toggleButton) return;
      toggleButton.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggleButton.setAttribute('aria-label', open ? 'Tutup menu navigasi' : 'Buka menu navigasi');

      if (toggleIcon) {
        toggleIcon.className = open ? 'fa-solid fa-xmark' : 'fa-solid fa-bars';
      }
    }

    function openNav() {
      container.classList.add('is-open');
      document.body.classList.add('site-nav-lock');
      syncToggleButton(true);
    }

    function closeNav() {
      container.classList.remove('is-open');
      document.body.classList.remove('site-nav-lock');
      syncToggleButton(false);
    }

    function toggleNav() {
      isOpen() ? closeNav() : openNav();
    }

    if (toggleButton) {
      toggleButton.addEventListener('click', function (event) {
        event.preventDefault();
        toggleNav();
      });
    }

    container.addEventListener('click', function (event) {
      const isBackdrop = event.target.closest('[data-nav-close]');
      const isNavLink = event.target.closest('[data-nav-link]');

      if (isBackdrop || isNavLink) {
        closeNav();
      }
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && isOpen()) closeNav();
    });

    desktopQuery.addEventListener('change', function (event) {
      if (event.matches) closeNav();
    });

    window.addEventListener('beforeunload', closeNav);
    syncToggleButton(false);
  });
})();
