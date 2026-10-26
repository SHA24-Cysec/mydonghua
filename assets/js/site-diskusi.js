(function () {
  'use strict';

  function init() {
    var panel = document.getElementById('ruang-diskusi');
    var toggle = document.getElementById('diskusi-toggle');
    var pane = document.getElementById('diskusi-pane');
    var thread = document.getElementById('disqus_thread');
    if (!panel || !toggle || !pane || !thread) return;

    var shortname = panel.getAttribute('data-disqus-shortname') || 'mydonghua';
    var forumURL = panel.getAttribute('data-disqus-forum') || 'https://disqus.com/';
    var identifier = window.location.pathname;
    var countSource = document.getElementById('diskusi-count-sumber');
    var countText = document.getElementById('diskusi-count-text');
    var badge = document.getElementById('diskusi-badge');
    var forumLink = document.getElementById('diskusi-forum-link');
    var statusEl = document.getElementById('diskusi-status');
    var statusText = document.getElementById('diskusi-status-text');
    var skeleton = document.getElementById('diskusi-skeleton');
    var errorBox = document.getElementById('diskusi-error');
    var reloadBtn = document.getElementById('diskusi-reload');
    var retryBtn = document.getElementById('diskusi-coba-lagi');
    var toggleLabel = document.getElementById('diskusi-toggle-label');
    var toast = document.getElementById('diskusi-toast');

    if (forumLink && !forumLink.getAttribute('href')) forumLink.href = forumURL;
    if (countSource) countSource.setAttribute('data-disqus-identifier', identifier);

    var state = 'idle';
    var scriptInjected = false;
    var scriptOk = false;
    var countInjected = false;
    var loadTimer = null;
    var toastTimer = null;
    var pollTimer = null;
    var threadObserver = null;
    var countObserver = null;

    function disqusConfig() {
      this.page.url = window.location.href;
      this.page.identifier = identifier;
      this.page.title = document.title;
      this.callbacks = this.callbacks || {};
      this.callbacks.onNewComment = [function () {
        showToast('Komentar baru terkirim. Jumlah komentar diperbarui.');
        refreshCount();
      }];
    }

    function showToast(message) {
      if (!toast) return;
      toast.textContent = message;
      toast.classList.add('is-visible');
      if (toastTimer) window.clearTimeout(toastTimer);
      toastTimer = window.setTimeout(function () {
        toast.classList.remove('is-visible');
      }, 3200);
    }

    function updateCount() {
      if (!countSource || !countText) return;
      var raw = countSource.textContent || '';
      var match = raw.match(/\d[\d.,]*/);
      if (!match) return;
      var number = match[0].replace(/[^0-9]/g, '');
      if (!number) return;
      countText.textContent = number + ' komentar';
      if (badge) badge.classList.add('has-count');
    }

    function refreshCount() {
      try {
        if (window.DISQUSWIDGETS && typeof window.DISQUSWIDGETS.getCount === 'function') {
          window.DISQUSWIDGETS.getCount({ reset: true });
        }
      } catch (error) {
        updateCount();
      }
      updateCount();
    }

    function observeCount() {
      if (!countSource || countObserver) return;
      if (typeof window.MutationObserver !== 'function') return;
      countObserver = new window.MutationObserver(function () {
        updateCount();
      });
      countObserver.observe(countSource, { childList: true, characterData: true, subtree: true });
    }

    function clearLoadTimer() {
      if (loadTimer) {
        window.clearTimeout(loadTimer);
        loadTimer = null;
      }
    }

    function clearPoll() {
      if (pollTimer) {
        window.clearInterval(pollTimer);
        pollTimer = null;
      }
    }

    function setState(next) {
      state = next;
      if (next === 'loading') {
        if (skeleton) skeleton.hidden = false;
        if (errorBox) errorBox.hidden = true;
        if (statusEl) statusEl.className = 'diskusi-status is-loading';
        if (statusText) statusText.textContent = 'Menyiapkan diskusi';
        if (reloadBtn) reloadBtn.disabled = true;
      } else if (next === 'ready') {
        if (skeleton) skeleton.hidden = true;
        if (errorBox) errorBox.hidden = true;
        if (statusEl) statusEl.className = 'diskusi-status is-ready';
        if (statusText) statusText.textContent = 'Diskusi siap';
        if (reloadBtn) reloadBtn.disabled = false;
      } else if (next === 'error') {
        if (skeleton) skeleton.hidden = true;
        if (errorBox) errorBox.hidden = false;
        if (statusEl) statusEl.className = 'diskusi-status is-error';
        if (statusText) statusText.textContent = 'Gagal memuat';
        if (reloadBtn) reloadBtn.disabled = false;
      }
    }

    function hasReset() {
      return !!(window.DISQUS && typeof window.DISQUS.reset === 'function');
    }

    function finishReady() {
      if (state !== 'loading') return;
      scriptOk = true;
      clearLoadTimer();
      clearPoll();
      setState('ready');
      refreshCount();
    }

    function showError() {
      if (state !== 'loading') return;
      clearLoadTimer();
      clearPoll();
      setState('error');
    }

    function observeThread() {
      if (threadObserver) return;
      if (typeof window.MutationObserver === 'function') {
        threadObserver = new window.MutationObserver(function () {
          if (state === 'loading' && thread.querySelector('iframe')) finishReady();
        });
        threadObserver.observe(thread, { childList: true, subtree: true });
      }
      clearPoll();
      pollTimer = window.setInterval(function () {
        if (state === 'loading' && thread.querySelector('iframe')) finishReady();
      }, 600);
    }

    function armTimeout() {
      clearLoadTimer();
      loadTimer = window.setTimeout(function () {
        showError();
      }, 12000);
    }

    function injectCount() {
      if (countInjected) return;
      countInjected = true;
      if (!document.getElementById('dsq-count-scr')) {
        var countScript = document.createElement('script');
        countScript.id = 'dsq-count-scr';
        countScript.src = 'https://' + shortname + '.disqus.com/count.js';
        countScript.async = true;
        (document.head || document.body).appendChild(countScript);
      }
      window.setTimeout(updateCount, 1200);
      window.setTimeout(updateCount, 4000);
    }

    function injectEmbed() {
      if (scriptInjected) return;
      scriptInjected = true;
      var script = document.createElement('script');
      script.id = 'diskusi-embed';
      script.src = 'https://' + shortname + '.disqus.com/embed.js';
      script.setAttribute('data-timestamp', String(+new Date()));
      script.setAttribute('data-shortname', shortname);
      script.async = true;
      script.onload = function () {
        scriptOk = true;
        if (state === 'loading' && thread.querySelector('iframe')) finishReady();
      };
      script.onerror = function () {
        scriptOk = false;
        showError();
      };
      (document.head || document.body).appendChild(script);
    }

    function removeEmbedScript() {
      var old = document.getElementById('diskusi-embed');
      if (old && old.parentNode) old.parentNode.removeChild(old);
      scriptInjected = false;
      scriptOk = false;
    }

    function startLoad() {
      if (state === 'loading') return;
      setState('loading');
      armTimeout();
      observeCount();
      observeThread();
      window.disqus_shortname = shortname;
      window.disqus_config = disqusConfig;
      injectCount();
      if (!scriptInjected) {
        injectEmbed();
      } else if (hasReset()) {
        window.DISQUS.reset({ reload: true, config: disqusConfig });
      } else {
        showError();
      }
    }

    function reload() {
      if (state === 'loading') return;
      if (hasReset()) {
        startLoad();
        return;
      }
      removeEmbedScript();
      thread.textContent = '';
      startLoad();
    }

    toggle.addEventListener('click', function () {
      var open = toggle.getAttribute('aria-expanded') !== 'true';
      toggle.setAttribute('aria-expanded', String(open));
      toggle.classList.toggle('is-open', open);
      if (toggleLabel) toggleLabel.textContent = open ? 'Tutup diskusi' : 'Buka diskusi';
      pane.hidden = !open;
      if (open && state === 'idle') startLoad();
    });

    if (reloadBtn) reloadBtn.addEventListener('click', reload);
    if (retryBtn) retryBtn.addEventListener('click', reload);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
