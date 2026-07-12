(function () {
  'use strict';

document.addEventListener('DOMContentLoaded', function () {
    const openButtons = Array.from(document.querySelectorAll('[data-random-open]'));
    const modal = document.querySelector('[data-random-modal]');
    if (!openButtons.length || !modal) return;

    const dialog = modal.querySelector('[data-random-dialog]');
    const closeButtons = Array.from(modal.querySelectorAll('[data-random-close]'));
    const loadingNode = modal.querySelector('[data-random-loading]');
    const errorNode = modal.querySelector('[data-random-error]');
    const resultNode = modal.querySelector('[data-random-result]');
    const imageNode = modal.querySelector('[data-random-image]');
    const typeNode = modal.querySelector('[data-random-type]');
    const titleNode = modal.querySelector('[data-random-title]');
    const metaNode = modal.querySelector('[data-random-meta]');
    const genresNode = modal.querySelector('[data-random-genres]');
    const linkNode = modal.querySelector('[data-random-link]');
    const rerollButton = modal.querySelector('[data-random-reroll]');
    let randomIndexPromise = null;
    let randomItems = [];
    let lastPermalink = '';
    let previouslyFocused = null;

    function toText(value) {
      if (Array.isArray(value)) return value.filter(Boolean).join(', ');
      return value == null ? '' : String(value);
    }

    function cleanTitle(value) {
      return toText(value)
        .replace(/^download\s+batch\s+/i, '')
        .replace(/\s+subtitle\s+indonesia\s*$/i, '')
        .replace(/\s+sub\s+indo(?:nesia)?\s*$/i, '')
        .trim() || toText(value) || 'Donghua Acak';
    }

    function clearNode(node) {
      if (node) node.textContent = '';
    }

    function makeChip(text, extraClass) {
      const chip = document.createElement('span');
      chip.className = 'site-random-chip' + (extraClass ? ' ' + extraClass : '');
      chip.textContent = text;
      return chip;
    }

    function getRandomNumber(max) {
      if (max <= 0) return 0;
      if (window.crypto && window.crypto.getRandomValues) {
        const values = new Uint32Array(1);
        window.crypto.getRandomValues(values);
        return values[0] % max;
      }
      return Math.floor(Math.random() * max);
    }

    function setState(state) {
      if (loadingNode) loadingNode.hidden = state !== 'loading';
      if (errorNode) errorNode.hidden = state !== 'error';
      if (resultNode) resultNode.hidden = state !== 'result';
      if (rerollButton) rerollButton.disabled = state === 'loading';
    }

    function closeMobileNavIfOpen() {
      const container = document.querySelector('[data-site-nav-container]');
      const toggleButton = container ? container.querySelector('[data-nav-open]') : null;
      const toggleIcon = toggleButton ? toggleButton.querySelector('i') : null;

      if (container) container.classList.remove('is-open');
      document.body.classList.remove('site-nav-lock');

      if (toggleButton) {
        toggleButton.setAttribute('aria-expanded', 'false');
        toggleButton.setAttribute('aria-label', 'Buka menu navigasi');
      }
      if (toggleIcon) toggleIcon.className = 'fa-solid fa-bars';
    }

    function openModal() {
      previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      closeMobileNavIfOpen();
      modal.classList.add('is-open');
      modal.setAttribute('aria-hidden', 'false');
      document.body.classList.add('site-random-lock');
      window.setTimeout(function () {
        if (dialog) dialog.focus({ preventScroll: true });
      }, 40);
    }

    function closeModal() {
      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('site-random-lock');
      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus({ preventScroll: true });
      }
    }

    function loadRandomIndex() {
      if (randomIndexPromise) return randomIndexPromise;
      randomIndexPromise = fetch('/index.json')
        .then(function (response) {
          if (!response.ok) throw new Error('Gagal memuat index.json (' + response.status + ')');
          return response.json();
        })
        .then(function (data) {
          randomItems = Array.isArray(data)
            ? data.filter(function (item) { return item && item.title && item.permalink; })
            : [];
          if (!randomItems.length) throw new Error('Data donghua acak kosong');
          return randomItems;
        });
      return randomIndexPromise;
    }

    function pickItem(items) {
      if (!items.length) return null;
      if (items.length === 1) return items[0];

      let item = null;
      for (let tries = 0; tries < 8; tries++) {
        item = items[getRandomNumber(items.length)];
        if (item && item.permalink !== lastPermalink) break;
      }
      return item || items[0];
    }

    function renderItem(item) {
      lastPermalink = item.permalink || '';

      if (imageNode) {
        const randomSrc = toText(item.thumbnail) || '/img/DonghuaBatch.webp';
        imageNode.removeAttribute('srcset');
        imageNode.removeAttribute('sizes');
        imageNode.src = randomSrc;
        imageNode.alt = cleanTitle(item.title);
      }
      if (typeNode) typeNode.textContent = toText(item.type) || 'Donghua';
      if (titleNode) titleNode.textContent = cleanTitle(item.title);
      if (linkNode) linkNode.href = toText(item.permalink) || '#';

      if (metaNode) {
        metaNode.innerHTML = '';
        const meta = [
          item.episode ? 'Episode: ' + toText(item.episode) : '',
          item.status ? 'Status: ' + toText(item.status) : '',
          item.rating ? 'Rating: ' + toText(item.rating) + '/10' : ''
        ].filter(Boolean);
        meta.forEach(function (value) { metaNode.appendChild(makeChip(value)); });
      }

      if (genresNode) {
        genresNode.innerHTML = '';
        toText(item.genre)
          .split(',')
          .map(function (genre) { return genre.trim(); })
          .filter(Boolean)
          .slice(0, 4)
          .forEach(function (genre) { genresNode.appendChild(makeChip(genre, 'genre')); });
      }

      setState('result');
    }

    function showRandomItem() {
      setState('loading');
      loadRandomIndex()
        .then(function (items) {
          const item = pickItem(items);
          if (!item) throw new Error('Tidak ada item acak');
          renderItem(item);
        })
        .catch(function (error) {
          console.error('[Random Donghua]', error);
          clearNode(titleNode);
          setState('error');
        });
    }

    openButtons.forEach(function (button) {
      button.addEventListener('click', function (event) {
        event.preventDefault();
        openModal();
        showRandomItem();
      });
    });

    if (rerollButton) {
      rerollButton.addEventListener('click', function () {
        if (randomItems.length) {
          renderItem(pickItem(randomItems));
        } else {
          showRandomItem();
        }
      });
    }

    closeButtons.forEach(function (button) {
      button.addEventListener('click', closeModal);
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && modal.classList.contains('is-open')) {
        closeModal();
      }
    });
  });
})();
