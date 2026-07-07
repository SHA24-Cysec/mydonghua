(function () {
  'use strict';

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }

    return new Promise(function (resolve, reject) {
      var textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      textarea.style.top = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();

      try {
        document.execCommand('copy') ? resolve() : reject();
      } catch (error) {
        reject(error);
      } finally {
        document.body.removeChild(textarea);
      }
    });
  }

  document.addEventListener('click', function (event) {
    var button = event.target.closest('[data-copy-url]');
    if (!button) return;

    var component = button.closest('[data-share-component]');
    var feedback = component ? component.querySelector('.share-copy-feedback') : null;
    var icon = button.querySelector('i');
    var url = button.getAttribute('data-copy-url') || window.location.href;

    copyText(url).then(function () {
      button.classList.add('is-copied');
      if (icon) {
        icon.className = 'fa-solid fa-check';
      }
      if (feedback) {
        feedback.textContent = 'Link berhasil disalin!';
        feedback.classList.add('is-visible');
      }

      window.setTimeout(function () {
        button.classList.remove('is-copied');
        if (icon) {
          icon.className = 'fa-regular fa-copy';
        }
        if (feedback) {
          feedback.classList.remove('is-visible');
        }
      }, 1800);
    }).catch(function () {
      if (feedback) {
        feedback.textContent = 'Gagal menyalin link.';
        feedback.classList.add('is-visible');
      }
    });
  });
})();
