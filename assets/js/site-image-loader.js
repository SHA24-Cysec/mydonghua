(function () {
  'use strict';

  const processedImages = new WeakSet();
  const minVisualSize = 80;
  const dynamicImageRootSelector = '#search-results, #genre-results, #fav-grid';

  function getVisualSize(img) {
    const rect = img.getBoundingClientRect();
    const widthAttr = parseInt(img.getAttribute('width') || '0', 10);
    const heightAttr = parseInt(img.getAttribute('height') || '0', 10);
    return {
      width: rect.width || widthAttr || 0,
      height: rect.height || heightAttr || 0,
    };
  }

  function shouldSkipImage(img) {
    if (!img || processedImages.has(img)) return true;
    if (img.closest('.site-image-loading')) return true;
    if (img.dataset.noLoader === 'true') return true;

    const { width, height } = getVisualSize(img);
    return width < minVisualSize && height < minVisualSize;
  }

  function applyLoader(img) {
    if (shouldSkipImage(img)) return;

    const parent = img.parentNode;
    if (!parent) return;

    const computed = window.getComputedStyle(img);
    const rect = img.getBoundingClientRect();
    const parentRect = parent.getBoundingClientRect();
    const wrapper = document.createElement('span');

    wrapper.className = 'site-image-loading';
    wrapper.style.display = computed.display === 'block' ? 'block' : 'inline-block';
    wrapper.style.borderRadius = computed.borderRadius;
    wrapper.style.maxWidth = computed.maxWidth !== 'none' ? computed.maxWidth : '100%';

    const sameWidthAsParent = parentRect.width > 0 && Math.abs(parentRect.width - rect.width) < 1.5;
    const sameHeightAsParent = parentRect.height > 0 && Math.abs(parentRect.height - rect.height) < 1.5;

    if (sameWidthAsParent) {
      wrapper.style.width = '100%';
    } else if (rect.width > 0) {
      wrapper.style.width = rect.width + 'px';
    }

    if (sameHeightAsParent) {
      wrapper.style.height = '100%';
    } else if (rect.height > 0) {
      wrapper.style.height = rect.height + 'px';
    }

    if (computed.flex && computed.flex !== '0 1 auto') {
      wrapper.style.flex = computed.flex;
    }

    if (computed.alignSelf && computed.alignSelf !== 'auto') {
      wrapper.style.alignSelf = computed.alignSelf;
    }

    parent.insertBefore(wrapper, img);
    wrapper.appendChild(img);

    img.style.display = 'block';
    img.style.margin = '0';
    img.style.borderRadius = computed.borderRadius;

    const markLoaded = function () {
      wrapper.classList.add('is-loaded');
    };

    const markError = function () {
      wrapper.classList.add('is-error');
    };

    if (img.complete && img.naturalWidth > 0) {
      requestAnimationFrame(markLoaded);
    } else {
      img.addEventListener('load', markLoaded, { once: true });
      img.addEventListener('error', markError, { once: true });
    }

    processedImages.add(img);
  }

  function processImages(root) {
    const scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll('img').forEach(applyLoader);
  }

  document.addEventListener('DOMContentLoaded', function () {
    processImages(document);

    const dynamicRoots = document.querySelectorAll(dynamicImageRootSelector);
    if (!dynamicRoots.length || !('MutationObserver' in window)) return;

    const observer = new window.MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        mutation.addedNodes.forEach(function (node) {
          if (!(node instanceof HTMLElement)) return;

          if (node.tagName === 'IMG') {
            applyLoader(node);
          } else {
            processImages(node);
          }
        });
      });
    });

    dynamicRoots.forEach(function (root) {
      observer.observe(root, { childList: true, subtree: true });
    });
  });
})();
