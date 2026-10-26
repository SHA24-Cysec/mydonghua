(function () {
  'use strict';

  function init() {
    var openButton = document.getElementById('buka-komen');
    var closeButton = document.getElementById('tutup-komen');
    var disqusContainer = document.getElementById('disqus_thread');
    var loadingEl = document.getElementById('disqus-loading');
    var errorEl = document.getElementById('disqus-error');
    var retryButton = document.getElementById('disqus-retry');

    if (!openButton || !closeButton || !disqusContainer) return;

    var shortname = disqusContainer.getAttribute('data-disqus-shortname') || 'mydonghua';
    var disqusLoaded = false;
    var disqusFailed = false;
    var loadTimeout = null;
    var renderTimeout = null;

    function showLoading() {
      if (loadingEl) loadingEl.classList.remove('hidden');
      if (errorEl) errorEl.classList.add('hidden');
    }

    function showError() {
      if (loadingEl) loadingEl.classList.add('hidden');
      if (errorEl) errorEl.classList.remove('hidden');
    }

    function hideContainer() {
      if (loadingEl) loadingEl.classList.add('hidden');
      if (errorEl) errorEl.classList.add('hidden');
    }

    function loadDisqus() {
      if (disqusLoaded && !disqusFailed) return;
      if (loadTimeout) { clearTimeout(loadTimeout); loadTimeout = null; }
      if (renderTimeout) { clearTimeout(renderTimeout); renderTimeout = null; }
      disqusFailed = false;
      showLoading();

      window.disqus_config = function () {
        this.page.url = window.location.href;
        this.page.identifier = window.location.pathname;
        this.page.title = document.title;
      };

      var script = document.createElement('script');
      script.src = 'https://' + shortname + '.disqus.com/embed.js';
      script.setAttribute('data-timestamp', String(+new Date()));
      script.setAttribute('data-shortname', shortname);

      script.onload = function () {
        disqusLoaded = true;
        disqusFailed = false;
        if (loadingEl) loadingEl.classList.add('hidden');
      };

      script.onerror = function () {
        disqusFailed = true;
        showError();
      };

      (document.head || document.body).appendChild(script);

      loadTimeout = setTimeout(function () {
        if (!disqusLoaded && !disqusFailed) {
          disqusFailed = true;
          showError();
        }
      }, 8000);

      renderTimeout = setTimeout(function () {
        if (disqusLoaded && !disqusFailed) {
          var thread = disqusContainer.querySelector('#disqus_thread, .disqus-thread, iframe, .disqus-comments');
          if (!thread) {
            disqusFailed = true;
            showError();
          }
        }
      }, 5000);
    }

    function reloadDisqus() {
      if (typeof window.DISQUS !== 'undefined' && typeof window.DISQUS.reset === 'function') {
        window.DISQUS.reset({
          reload: true,
          config: function () {
            this.page.url = window.location.href;
            this.page.identifier = window.location.pathname;
            this.page.title = document.title;
          }
        });
      } else {
        if (disqusContainer) disqusContainer.innerHTML = '';
        rebuildPlaceholders();
        disqusLoaded = false;
        disqusFailed = false;
        loadDisqus();
      }
    }

    function rebuildPlaceholders() {
      var loading = document.createElement('div');
      loading.id = 'disqus-loading';
      loading.className = 'text-center py-8 text-slate-400';
      loading.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-2xl text-cyan-400"></i>' +
        '<p class="mt-3 text-sm">Memuat komentar...</p>';

      var error = document.createElement('div');
      error.id = 'disqus-error';
      error.className = 'hidden text-center py-8';
      error.innerHTML = '<i class="fa-solid fa-triangle-exclamation text-2xl text-amber-400"></i>' +
        '<p class="mt-3 text-sm text-slate-300">Komentar tidak dapat dimuat.</p>' +
        '<button class="mt-2 text-cyan-300 hover:text-cyan-200 underline underline-offset-2 text-sm" type="button" id="disqus-retry">Coba Lagi</button>';

      disqusContainer.appendChild(loading);
      disqusContainer.appendChild(error);

      loadingEl = loading;
      errorEl = error;
      retryButton = document.getElementById('disqus-retry');
      if (retryButton) {
        retryButton.addEventListener('click', function (e) {
          e.preventDefault();
          reloadDisqus();
        });
      }
    }

    if (retryButton) {
      retryButton.addEventListener('click', function (e) {
        e.preventDefault();
        reloadDisqus();
      });
    }

    openButton.addEventListener('click', function () {
      openButton.classList.add('hidden');

      window.setTimeout(function () {
        closeButton.classList.remove('hidden');
        disqusContainer.classList.remove('hidden');

        if (!disqusLoaded) {
          loadDisqus();
        } else if (disqusFailed) {
          reloadDisqus();
        }
      }, 1000);
    });

    closeButton.addEventListener('click', function () {
      closeButton.classList.add('hidden');
      hideContainer();

      window.setTimeout(function () {
        openButton.classList.remove('hidden');
      }, 1000);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
