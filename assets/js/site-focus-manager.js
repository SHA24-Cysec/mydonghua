(function () {
  'use strict';

  const FOCUSABLE_SELECTOR = [
    'a[href]:not([tabindex="-1"])',
    'button:not([disabled]):not([tabindex="-1"])',
    'input:not([disabled]):not([type="hidden"]):not([tabindex="-1"])',
    'select:not([disabled]):not([tabindex="-1"])',
    'textarea:not([disabled]):not([tabindex="-1"])',
    '[contenteditable="true"]:not([tabindex="-1"])',
    '[tabindex]:not([tabindex="-1"])'
  ].join(',');

  function isVisible(element) {
    if (!element || !element.isConnected || element.hidden) return false;
    if (element.closest('[hidden], [inert]')) return false;

    const style = window.getComputedStyle(element);
    return style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      element.getClientRects().length > 0;
  }

  function getFocusable(container) {
    if (!container) return [];
    return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter(isVisible);
  }

  function setInteractive(container, interactive) {
    if (!container) return;
    container.inert = !interactive;
    container.setAttribute('aria-hidden', interactive ? 'false' : 'true');
  }

  function focusElement(element) {
    if (!isVisible(element) || typeof element.focus !== 'function') return false;
    try {
      element.focus({ preventScroll: true });
    } catch (error) {
      element.focus();
    }
    return document.activeElement === element;
  }

  function focusFirst(container, preferredSelector) {
    if (!container) return false;
    const preferred = preferredSelector ? container.querySelector(preferredSelector) : null;
    if (focusElement(preferred)) return true;

    const focusable = getFocusable(container);
    if (focusable.length && focusElement(focusable[0])) return true;
    return focusElement(container);
  }

  function scheduleFocus(container, preferredSelector) {
    window.setTimeout(function () {
      focusFirst(container, preferredSelector);
    }, 40);
  }

  function restoreFocus(target, fallbackSelector) {
    window.setTimeout(function () {
      if (focusElement(target)) return;
      const fallback = fallbackSelector ? document.querySelector(fallbackSelector) : null;
      focusElement(fallback);
    }, 0);
  }

  function trapFocus(event, container) {
    if (!container || event.key !== 'Tab') return false;

    const focusable = getFocusable(container);
    if (!focusable.length) {
      event.preventDefault();
      focusElement(container);
      return true;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (!container.contains(active)) {
      event.preventDefault();
      focusElement(event.shiftKey ? last : first);
      return true;
    }

    if (event.shiftKey && active === first) {
      event.preventDefault();
      focusElement(last);
      return true;
    }

    if (!event.shiftKey && active === last) {
      event.preventDefault();
      focusElement(first);
      return true;
    }

    return false;
  }

  window.DonghuaFocusManager = {
    getFocusable: getFocusable,
    setInteractive: setInteractive,
    focusFirst: focusFirst,
    scheduleFocus: scheduleFocus,
    restoreFocus: restoreFocus,
    trapFocus: trapFocus
  };
})();
