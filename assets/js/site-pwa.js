(function () {
  'use strict';

  var installPrompt = null;
  var installButtons = [];
  var statusRegion = null;

  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true;
  }

  function syncInstallControls() {
    var canInstall = Boolean(installPrompt) && !isStandalone();
    installButtons.forEach(function (button) {
      button.hidden = !canInstall;
      button.disabled = !canInstall;
    });
  }

  function setStatus(message) {
    if (statusRegion) statusRegion.textContent = message;
  }

  async function requestInstall() {
    if (!installPrompt || isStandalone()) return;

    if (window.DonghuaNavbar && typeof window.DonghuaNavbar.close === 'function') {
      window.DonghuaNavbar.close(false);
    }

    var promptEvent = installPrompt;
    installPrompt = null;
    syncInstallControls();

    await promptEvent.prompt();
    var choice = await promptEvent.userChoice;
    setStatus(choice.outcome === 'accepted' ? 'Pemasangan DonghuaBatch dimulai.' : 'Pemasangan dibatalkan.');
  }

  window.addEventListener('beforeinstallprompt', function (event) {
    event.preventDefault();
    installPrompt = event;
    syncInstallControls();
  });

  window.addEventListener('appinstalled', function () {
    installPrompt = null;
    syncInstallControls();
    setStatus('DonghuaBatch sudah terpasang.');
  });

  document.addEventListener('DOMContentLoaded', function () {
    installButtons = Array.prototype.slice.call(document.querySelectorAll('[data-pwa-install]'));
    statusRegion = document.querySelector('[data-pwa-status]');

    installButtons.forEach(function (button) {
      button.addEventListener('click', requestInstall);
    });

    syncInstallControls();
  });

  if ('serviceWorker' in navigator && window.isSecureContext) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'none'
      }).then(function (registration) {
        registration.update();
        document.addEventListener('visibilitychange', function () {
          if (document.visibilityState === 'visible') registration.update();
        });
      }).catch(function () {
        setStatus('Mode offline belum dapat diaktifkan pada browser ini.');
      });
    });
  }
}());
