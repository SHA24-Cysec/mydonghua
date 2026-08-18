(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    const container = document.querySelector('[data-site-nav-container]');
    if (!container) return;

    const focusManager = window.DonghuaFocusManager;
    const toggleButton = container.querySelector('[data-nav-open]');
    const toggleIcon = toggleButton ? toggleButton.querySelector('i') : null;
    const navSheet = container.querySelector('.site-nav-sheet');
    let previousFocus = null;

    function isOpen() {
      return container.classList.contains('is-open');
    }

    function setSheetInteractive(interactive) {
      if (!navSheet) return;
      if (focusManager) {
        focusManager.setInteractive(navSheet, interactive);
      } else {
        navSheet.inert = !interactive;
        navSheet.setAttribute('aria-hidden', interactive ? 'false' : 'true');
      }
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
      if (isOpen()) return;
      previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : toggleButton;
      setSheetInteractive(true);
      container.classList.add('is-open');
      document.body.classList.add('site-nav-lock');
      syncToggleButton(true);

      if (focusManager) {
        focusManager.scheduleFocus(navSheet, '.site-nav-close');
      }
    }

    function closeNav(restoreFocus) {
      const wasOpen = isOpen();
      container.classList.remove('is-open');
      document.body.classList.remove('site-nav-lock');
      setSheetInteractive(false);
      syncToggleButton(false);

      if (wasOpen && restoreFocus !== false && focusManager) {
        focusManager.restoreFocus(previousFocus, '[data-nav-open]');
      }
      previousFocus = null;
    }

    function toggleNav() {
      isOpen() ? closeNav(true) : openNav();
    }

    if (toggleButton) {
      toggleButton.addEventListener('click', function (event) {
        event.preventDefault();
        toggleNav();
      });
    }

    container.addEventListener('click', function (event) {
      const closeControl = event.target.closest('[data-nav-close]');
      const navLink = event.target.closest('[data-nav-link]');

      if (closeControl || navLink) {
        closeNav(true);
      }
    });

    document.addEventListener('keydown', function (event) {
      if (!isOpen()) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        closeNav(true);
        return;
      }

      if (focusManager) focusManager.trapFocus(event, navSheet);
    });

    window.addEventListener('beforeunload', function () {
      closeNav(false);
    });

    window.DonghuaNavbar = {
      close: closeNav,
      open: openNav,
      isOpen: isOpen
    };

    closeNav(false);
  });
})();
