(function () {
  'use strict';

  /* Timeout long enough for slow ad networks; progressive inspect avoids false fail. */
  var AD_LOAD_TIMEOUT = 12000;
  /* MutationObserver detects normal injections. This is only a low-frequency safety check. */
  var INSPECT_INTERVAL = 1200;
  var MIN_CREATIVE_AREA = 80;
  var MOBILE_MAX = 767;

  var loadQueue = [];
  var queueRunning = false;

  function isMobileViewport() {
    return window.matchMedia('(max-width: ' + MOBILE_MAX + 'px)').matches;
  }

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
    applyBannerBodySize(widget, unit);
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

  function applyBannerBodySize(widget, unit) {
    if (!widget || !unit) return;
    var body = widget.querySelector('[data-ad-banner-body]');
    if (!body) return;

    var width = parseInt(unit.getAttribute('data-ad-width') || '0', 10) || 320;
    var height = parseInt(unit.getAttribute('data-ad-height') || '0', 10) || 50;
    var variant = unit.getAttribute('data-ad-variant') || '';

    body.style.setProperty('--ad-creative-width', width + 'px');
    body.style.setProperty('--ad-creative-height', height + 'px');
    body.classList.toggle('is-mobile-banner', variant === 'mobile' || width <= 320);
    body.classList.toggle('is-desktop-banner', variant === 'desktop' || width >= 728);
    widget.setAttribute('data-ad-active-size', width + 'x' + height);
  }

  /**
   * Responsive banner: keep only one unit (mobile 320x50 or desktop 728x90).
   * Other variants are removed so they never load / race atOptions.
   */
  function pickResponsiveUnit(widget) {
    var units = widget.querySelectorAll('[data-ad-unit]');
    if (!units.length) return null;
    if (units.length === 1) {
      units[0].hidden = false;
      return units[0];
    }

    var want = isMobileViewport() ? 'mobile' : 'desktop';
    var chosen = null;

    for (var i = 0; i < units.length; i++) {
      var variant = units[i].getAttribute('data-ad-variant') || '';
      if (variant === want) {
        chosen = units[i];
        break;
      }
    }

    if (!chosen) {
      chosen = units[0];
    }

    for (var j = 0; j < units.length; j++) {
      if (units[j] === chosen) {
        units[j].hidden = false;
      } else {
        /* Remove inactive variant completely — never inject its script. */
        if (units[j].parentNode) units[j].parentNode.removeChild(units[j]);
      }
    }

    widget.setAttribute('data-ad-viewport', want);
    applyBannerBodySize(widget, chosen);
    return chosen;
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
    var unit = pickResponsiveUnit(widget);
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
      scheduleFitAdScaleHosts();
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

  function readCssNumber(el, prop, fallback) {
    var raw = window.getComputedStyle(el).getPropertyValue(prop);
    var num = parseFloat(raw);
    return isFinite(num) && num > 0 ? num : fallback;
  }

  function fitAdScaleHosts(root) {
    var scope = root && root.querySelectorAll ? root : document;
    var hosts = scope.querySelectorAll(
      '.ad-neon-scale-host, .ad-neon-body.ad-size-300 .ad-neon-scroll, .ad-neon-body.ad-size-banner .ad-neon-scroll:not([hidden]), .site-floating-ad__unit:not([hidden])'
    );

    for (var i = 0; i < hosts.length; i++) {
      var host = hosts[i];
      if (!host || host.hidden) continue;

      var cw = readCssNumber(host, '--ad-creative-width', 0);
      if (!cw) {
        cw = parseInt(host.getAttribute('data-ad-width') || '0', 10) || 320;
      }
      var ch = readCssNumber(host, '--ad-creative-height', 0);
      if (!ch) {
        ch = parseInt(host.getAttribute('data-ad-height') || '0', 10) || 50;
      }

      host.style.setProperty('--ad-creative-width', cw + 'px');
      host.style.setProperty('--ad-creative-height', ch + 'px');

      var parent = host.parentElement;
      var available = host.clientWidth || (parent && parent.clientWidth) || 0;

      if (available <= 0) {
        available = Math.min(window.innerWidth || cw, cw);
      }

      var scale = Math.min(1, available / cw);
      if (!isFinite(scale) || scale <= 0) scale = 1;

      host.style.setProperty('--ad-scale', String(scale));
      host.style.height = (ch * scale) + 'px';
    }
  }

  var fitRaf = 0;
  function scheduleFitAdScaleHosts() {
    if (fitRaf) return;
    fitRaf = window.requestAnimationFrame(function () {
      fitRaf = 0;
      fitAdScaleHosts(document);
    });
  }

  function initAdFallbacks() {
    var widgets = document.querySelectorAll('[data-ad-widget]');
    for (var i = 0; i < widgets.length; i++) {
      enqueueWidget(widgets[i]);
    }

    fitAdScaleHosts(document);
    window.addEventListener('resize', scheduleFitAdScaleHosts, { passive: true });
    window.addEventListener('orientationchange', scheduleFitAdScaleHosts, { passive: true });

    /*
     * Widget-local observers in monitorWidget already catch ad mutations and
     * call scheduleFitAdScaleHosts after a creative is ready. Observing the
     * entire document here made every unrelated DOM mutation (image states,
     * sliders, third-party markup) schedule a layout pass.
     */
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAdFallbacks, { once: true });
  } else {
    initAdFallbacks();
  }
})();
