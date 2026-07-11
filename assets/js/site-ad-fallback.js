(function () {
  'use strict';

  /* Timeout long enough for slow ad networks; progressive inspect avoids false fail. */
  var AD_LOAD_TIMEOUT = 12000;
  var INSPECT_INTERVAL = 400;
  var MIN_CREATIVE_AREA = 80;

  var loadQueue = [];
  var queueRunning = false;

  function isVisibleSize(el) {
    if (!el || !el.getBoundingClientRect) return false;
    var rect = el.getBoundingClientRect();
    var w = rect.width || el.offsetWidth || 0;
    var h = rect.height || el.offsetHeight || 0;
    return w >= 2 && h >= 2 && w * h >= MIN_CREATIVE_AREA;
  }

  function hasRenderedCreative(unit) {
    if (!unit) return false;

    var nodes = unit.querySelectorAll('iframe, object, embed, img, video, ins');
    for (var i = 0; i < nodes.length; i++) {
      if (isVisibleSize(nodes[i])) return true;
    }

    /* Native / container-based creatives often inject plain divs. */
    var kids = unit.querySelectorAll('div, section, article, aside, a, span');
    for (var k = 0; k < kids.length; k++) {
      var child = kids[k];
      if (child.tagName === 'SCRIPT') continue;
      /* Empty mount points (before network fill) are ignored. */
      if (child.hasAttribute('data-ad-ignore') && child.childElementCount === 0 && !(child.textContent || '').trim()) {
        continue;
      }
      if (isVisibleSize(child) && (child.childElementCount > 0 || (child.textContent || '').trim().length > 8)) {
        return true;
      }
    }

    return false;
  }

  function hideShell(widget, status) {
    if (!widget) return;
    widget.hidden = true;
    widget.setAttribute('aria-hidden', 'true');
    widget.setAttribute('data-ad-status', status || 'failed');
  }

  function markLoaded(widget, unit, fallback) {
    widget.setAttribute('data-ad-status', 'loaded');
    widget.hidden = false;
    widget.removeAttribute('aria-hidden');
    if (unit) unit.hidden = false;
    if (fallback) fallback.hidden = true;
  }

  function failWidget(widget, unit, fallback) {
    /* Prefer clean UI: hide entire ad shell when creative fails. */
    if (unit) unit.hidden = true;
    if (fallback) fallback.hidden = true;
    hideShell(widget, 'failed');
  }

  function readOptions(unit) {
    if (!unit) return null;
    var key = unit.getAttribute('data-ad-key');
    if (!key) return null;
    var height = parseInt(unit.getAttribute('data-ad-height') || '0', 10);
    var width = parseInt(unit.getAttribute('data-ad-width') || '0', 10);
    return {
      key: key,
      format: unit.getAttribute('data-ad-format') || 'iframe',
      height: height || undefined,
      width: width || undefined,
      params: {}
    };
  }

  function ensureNetworkScript(unit, done) {
    var existing = unit.querySelector('[data-ad-network-script]');
    var invoke = unit.getAttribute('data-ad-invoke');
    var options = readOptions(unit);

    if (options) {
      try {
        window.atOptions = options;
      } catch (e) {
        /* ignore */
      }
    }

    if (existing) {
      if (existing.getAttribute('data-ad-script-bound') === '1') {
        done(existing);
        return;
      }
      existing.setAttribute('data-ad-script-bound', '1');
      done(existing);
      return;
    }

    if (!invoke) {
      done(null);
      return;
    }

    /* Native units may need cfasync=false for Cloudflare Rocket Loader. */
    var script = document.createElement('script');
    script.src = invoke;
    script.async = true;
    script.setAttribute('data-cfasync', 'false');
    script.setAttribute('data-ad-network-script', '');
    script.setAttribute('data-ad-script-bound', '1');
    unit.appendChild(script);
    done(script);
  }

  function monitorWidget(widget, onSettled) {
    var unit = widget.querySelector('[data-ad-unit]');
    var fallback = widget.querySelector('[data-ad-fallback]');
    var observer = null;
    var timeoutId = null;
    var intervalId = null;
    var settled = false;

    if (!unit) {
      if (onSettled) onSettled();
      return;
    }

    function stopMonitoring() {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
      if (observer) observer.disconnect();
    }

    function finishLoaded() {
      if (settled) return;
      settled = true;
      stopMonitoring();
      markLoaded(widget, unit, fallback);
      if (onSettled) onSettled();
    }

    function finishFailed() {
      if (settled) return;
      if (hasRenderedCreative(unit)) {
        finishLoaded();
        return;
      }
      settled = true;
      stopMonitoring();
      failWidget(widget, unit, fallback);
      if (onSettled) onSettled();
    }

    function inspectUnit() {
      if (hasRenderedCreative(unit)) finishLoaded();
    }

    if (hasRenderedCreative(unit)) {
      finishLoaded();
      return;
    }

    ensureNetworkScript(unit, function (networkScript) {
      if (settled) return;

      if ('MutationObserver' in window) {
        observer = new MutationObserver(inspectUnit);
        observer.observe(unit, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['style', 'class', 'src', 'hidden']
        });
      }

      intervalId = window.setInterval(inspectUnit, INSPECT_INTERVAL);

      if (networkScript) {
        networkScript.addEventListener('error', finishFailed, { once: true });
        networkScript.addEventListener('load', function () {
          /* Script loaded ≠ creative ready; keep inspecting until timeout. */
          inspectUnit();
        }, { once: true });
      }

      timeoutId = window.setTimeout(finishFailed, AD_LOAD_TIMEOUT);
      inspectUnit();
    });
  }

  function enqueueWidget(widget) {
    loadQueue.push(widget);
    pumpQueue();
  }

  function pumpQueue() {
    if (queueRunning) return;
    var next = loadQueue.shift();
    if (!next) return;
    queueRunning = true;

    /* Stagger atOptions-based units so global config is not overwritten mid-load. */
    monitorWidget(next, function () {
      queueRunning = false;
      window.setTimeout(pumpQueue, 120);
    });
  }

  function initAdFallbacks() {
    var widgets = document.querySelectorAll('[data-ad-widget]');
    for (var i = 0; i < widgets.length; i++) {
      enqueueWidget(widgets[i]);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAdFallbacks, { once: true });
  } else {
    initAdFallbacks();
  }
})();
