(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    const openButton = document.getElementById('buka-komen');
    const closeButton = document.getElementById('tutup-komen');
    const disqusContainer = document.getElementById('disqus_thread');

    if (!openButton || !closeButton || !disqusContainer) return;

    let disqusLoaded = false;
    const shortname = disqusContainer.getAttribute('data-disqus-shortname') || 'mydonghua';

    function loadDisqus() {
      if (disqusLoaded) return;
      disqusLoaded = true;

      window.disqus_config = function () {
        this.page.url = window.location.href;
        this.page.identifier = window.location.pathname;
      };

      const script = document.createElement('script');
      script.src = 'https://' + shortname + '.disqus.com/embed.js';
      script.setAttribute('data-timestamp', String(+new Date()));
      (document.head || document.body).appendChild(script);
    }

    openButton.addEventListener('click', function () {
      openButton.classList.add('hidden');

      window.setTimeout(function () {
        closeButton.classList.remove('hidden');
        disqusContainer.classList.remove('hidden');
        loadDisqus();
      }, 1000);
    });

    closeButton.addEventListener('click', function () {
      closeButton.classList.add('hidden');
      disqusContainer.classList.add('hidden');

      window.setTimeout(function () {
        openButton.classList.remove('hidden');
      }, 1000);
    });
  });
})();
