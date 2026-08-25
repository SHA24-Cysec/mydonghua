(function () {
  'use strict';

  function showToast(message, type) {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.style.cssText =
      'position:fixed;bottom:1.5rem;left:50%;transform:translateX(-50%) translateY(12px);' +
      'z-index:9999;max-width:90vw;padding:0.7rem 1.2rem;border-radius:0.8rem;' +
      'font:inherit;font-size:0.85rem;font-weight:700;color:#fff;' +
      'opacity:0;transition:opacity .25s ease,transform .25s ease;pointer-events:none;' +
      'border:1px solid ' + (type === 'success' ? 'rgba(34,211,238,0.35)' : 'rgba(244,63,94,0.35)') + ';' +
      'background:' + (type === 'success' ? 'rgba(6,18,23,0.92)' : 'rgba(30,8,12,0.92)') + ';' +
      'box-shadow:0 0 18px ' + (type === 'success' ? 'rgba(34,211,238,0.18)' : 'rgba(244,63,94,0.18)') + ';';
    document.body.appendChild(toast);
    requestAnimationFrame(function () {
      toast.style.opacity = '1';
      toast.style.transform = 'translateX(-50%) translateY(0)';
    });
    setTimeout(function () {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(-50%) translateY(12px)';
      setTimeout(function () { toast.remove(); }, 300);
    }, 3000);
  }

  function legacyCopy(text) {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.cssText = 'position:absolute;left:-9999px;top:0;opacity:0;';
    document.body.appendChild(area);
    area.select();
    let copied = false;
    try {
      copied = document.execCommand('copy');
    } catch (error) {
      copied = false;
    }
    area.remove();
    return copied;
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(
        function () { return true; },
        function () { return legacyCopy(text); }
      );
    }
    return Promise.resolve(legacyCopy(text));
  }

  document.addEventListener('DOMContentLoaded', function () {
    const buttons = Array.from(document.querySelectorAll('[data-pass-copy]'));
    if (!buttons.length) return;

    buttons.forEach(function (button) {
      const label = button.querySelector('.db-pass-copy-text');
      const defaultLabel = label ? label.textContent : '';
      let resetTimer = null;

      button.addEventListener('click', function () {
        const password = button.getAttribute('data-pass-text') || '';
        if (!password) return;

        copyText(password).then(function (copied) {
          if (!copied) {
            showToast('Gagal menyalin. Salin manual: ' + password, 'error');
            return;
          }

          button.classList.add('is-copied');
          if (label) label.textContent = 'Tersalin';
          showToast('Password disalin: ' + password, 'success');

          clearTimeout(resetTimer);
          resetTimer = setTimeout(function () {
            button.classList.remove('is-copied');
            if (label) label.textContent = defaultLabel;
          }, 2000);
        });
      });
    });
  });
})();
