(function () {
  'use strict';

  const favoriteCore = window.DonghuaFav;
  if (!favoriteCore) {
    console.error('[Fav] Core module tidak tersedia.');
    return;
  }

  const WATCH_STATUS = {
    belum: { label: 'Belum Ditonton', shortLabel: 'Belum', icon: 'fa-clock', className: 'is-belum' },
    sedang: { label: 'Sedang Ditonton', shortLabel: 'Sedang', icon: 'fa-play', className: 'is-sedang' },
    selesai: { label: 'Selesai Ditonton', shortLabel: 'Selesai', icon: 'fa-check', className: 'is-selesai' }
  };

  let indexPromise = null;
  let lastConfirmTrigger = null;
  let activeWatchFilter = 'all';
  let favoriteItems = [];

  function getIndexData() {
    if (indexPromise) return indexPromise;
    if (window.DonghuaBatchData && typeof window.DonghuaBatchData.getIndexData === 'function') {
      indexPromise = window.DonghuaBatchData.getIndexData();
    } else {
      indexPromise = fetch('/index.json').then(function (response) {
        if (!response.ok) throw new Error('Gagal memuat index.json');
        return response.json();
      });
    }
    return indexPromise;
  }

  function toText(value) {
    return value == null ? '' : String(value);
  }

  function escapeHTML(value) {
    return toText(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function itemId(item) {
    return item.id || item.permalink || item.objectID || '';
  }

  function orderItemsByIds(data, ids) {
    if (!Array.isArray(data)) return [];
    const byId = {};
    data.forEach(function (item) { byId[itemId(item)] = item; });
    return ids.map(function (id) { return byId[id]; }).filter(Boolean);
  }

  function getWatchStatus(id) {
    const status = favoriteCore.getWatchStatus ? favoriteCore.getWatchStatus(id) : 'belum';
    return WATCH_STATUS[status] ? status : 'belum';
  }

  function isFocusableVisible(element) {
    return !!(element && typeof element.focus === 'function' && !element.disabled && (element.offsetParent !== null || element === document.activeElement));
  }

  function focusFirst(container, preferredSelector) {
    if (!container) return false;
    const target = preferredSelector ? container.querySelector(preferredSelector) : null;
    if (isFocusableVisible(target)) {
      target.focus();
      return true;
    }

    const focusable = container.querySelectorAll('a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])');
    for (let i = 0; i < focusable.length; i += 1) {
      if (isFocusableVisible(focusable[i])) {
        focusable[i].focus();
        return true;
      }
    }

    if (isFocusableVisible(container)) {
      container.focus();
      return true;
    }
    return false;
  }

  function restoreFocus(target, fallbackSelector) {
    if (isFocusableVisible(target)) {
      target.focus();
      return;
    }
    const fallback = fallbackSelector ? document.querySelector(fallbackSelector) : null;
    if (isFocusableVisible(fallback)) fallback.focus();
  }

  function statusControlHTML(id, status) {
    const safeId = escapeHTML(id);
    const activeMeta = WATCH_STATUS[status];
    const buttons = Object.keys(WATCH_STATUS).map(function (key) {
      const meta = WATCH_STATUS[key];
      const active = key === status;
      return '<button class="fav-card-watch-option' + (active ? ' is-active' : '') + '" type="button" data-fav-watch-status="' + key + '" data-fav-watch-id="' + safeId + '" aria-pressed="' + (active ? 'true' : 'false') + '" aria-label="Tandai ' + meta.label + '"><i class="fa-solid ' + meta.icon + '" aria-hidden="true"></i><span>' + meta.shortLabel + '</span></button>';
    }).join('');

    return '<div class="fav-card-watch-control ' + activeMeta.className + '" role="group" aria-label="Status tontonan">' + buttons + '</div>';
  }

  function renderFavoriteCard(item) {
    const type = escapeHTML(item.type || 'Donghua');
    const episode = escapeHTML(item.episode || '-');
    const status = escapeHTML(item.status || '-');
    const rating = escapeHTML(item.rating || '-');
    const permalink = escapeHTML(item.permalink || '#');
    const thumbnail = escapeHTML(item.thumbnail || '');
    const title = escapeHTML(item.title || 'Donghua');
    const rawId = itemId(item);
    const id = escapeHTML(rawId);
    const watchStatus = getWatchStatus(rawId);
    const ratingHTML = rating && rating !== '-'
      ? '<span class="donghua-card-rating"><i class="fa-solid fa-star" aria-hidden="true"></i> ' + rating + '/10</span>'
      : '<span class="donghua-card-rating"><i class="fa-solid fa-star" aria-hidden="true"></i> Donghua</span>';
    const metaChips = [episode, status]
      .filter(function (value) { return value && value !== '-'; })
      .map(function (value) { return '<span class="donghua-card-chip">' + value + '</span>'; })
      .join('');
    const saved = favoriteCore.isSaved(rawId);
    const iconPath = saved
      ? '<path d="M5 3h14a1 1 0 0 1 1 1v17l-8-4-8 4V4a1 1 0 0 1 1-1z" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>'
      : '<path d="M5 3h14a1 1 0 0 1 1 1v17l-8-4-8 4V4a1 1 0 0 1 1-1z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>';
    const thumbnailHTML = thumbnail
      ? '<img loading="lazy" decoding="async" src="' + thumbnail + '" alt="' + title + '" width="240" height="320">'
      : '<div class="w-full h-full flex items-center justify-center bg-cyber-dark/80 text-cyan-400/40" aria-hidden="true"><i class="fa-solid fa-film text-6xl"></i></div>';

    return '<li class="donghua-card-item">' +
      '<article class="donghua-card fav-watch-card">' +
        '<button class="donghua-card-bookmark' + (saved ? ' is-saved' : '') + '" data-fav-id="' + id + '" type="button" aria-pressed="' + (saved ? 'true' : 'false') + '" aria-label="' + (saved ? 'Hapus dari daftar favorit' : 'Tambah ke daftar favorit') + '" title="' + (saved ? 'Hapus dari favorit' : 'Simpan ke favorit') + '">' +
          '<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true">' + iconPath + '</svg>' +
        '</button>' +
        '<a class="donghua-card-link" title="' + title + '" href="' + permalink + '">' +
          '<div class="donghua-card-poster">' + thumbnailHTML + '</div>' +
          '<div class="donghua-card-frame" aria-hidden="true"></div>' +
          '<div class="donghua-card-badges"><span class="donghua-card-badge">' + type + '</span></div>' +
          '<div class="donghua-card-body">' +
            '<h3 class="donghua-card-title">' + title + '</h3>' +
            '<div class="donghua-card-meta">' + metaChips + '</div>' +
            '<div class="donghua-card-footer">' + ratingHTML + '<span class="donghua-card-cta">Detail</span></div>' +
          '</div>' +
        '</a>' +
        statusControlHTML(rawId, watchStatus) +
      '</article>' +
    '</li>';
  }

  function showElement(element, displayValue) {
    if (!element) return;
    element.classList.remove('hidden');
    element.hidden = false;
    element.style.display = displayValue || '';
  }

  function hideElement(element) {
    if (!element) return;
    element.classList.add('hidden');
    element.hidden = true;
    element.style.display = 'none';
  }

  function syncClearButton(visible) {
    const clearButton = document.getElementById('fav-clear-all');
    if (!clearButton) return;
    const shouldShow = visible || favoriteCore.loadFavorites().length > 0;
    clearButton.classList.toggle('hidden', !shouldShow);
    clearButton.disabled = !shouldShow;
  }

  function watchCounts(items) {
    const counts = { all: items.length, belum: 0, sedang: 0, selesai: 0 };
    items.forEach(function (item) {
      const status = getWatchStatus(itemId(item));
      counts[status] += 1;
    });
    return counts;
  }

  function renderWatchToolbar(items) {
    const toolbar = document.getElementById('fav-watch-toolbar');
    const total = document.getElementById('fav-watch-total');
    if (!toolbar) return;

    if (!items.length) {
      hideElement(toolbar);
      return;
    }

    const counts = watchCounts(items);
    showElement(toolbar);
    if (total) total.textContent = counts.all + ' favorit';

    document.querySelectorAll('[data-fav-watch-count]').forEach(function (element) {
      const key = element.getAttribute('data-fav-watch-count');
      element.textContent = String(counts[key] || 0);
    });
    document.querySelectorAll('[data-fav-watch-filter]').forEach(function (button) {
      const isActive = button.getAttribute('data-fav-watch-filter') === activeWatchFilter;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  }

  function renderFavoriteList() {
    const grid = document.getElementById('fav-grid');
    const emptyElement = document.getElementById('fav-empty');
    const filterEmpty = document.getElementById('fav-watch-empty');
    if (!grid) return;

    renderWatchToolbar(favoriteItems);
    const items = activeWatchFilter === 'all'
      ? favoriteItems
      : favoriteItems.filter(function (item) { return getWatchStatus(itemId(item)) === activeWatchFilter; });

    if (!items.length) {
      hideElement(grid);
      if (favoriteItems.length) {
        showElement(filterEmpty);
        hideElement(emptyElement);
      } else {
        hideElement(filterEmpty);
        showElement(emptyElement);
      }
      return;
    }

    grid.innerHTML = items.map(renderFavoriteCard).join('');
    showElement(grid, 'grid');
    hideElement(filterEmpty);
    hideElement(emptyElement);
    favoriteCore.syncAllButtons();
  }

  function renderFavoritesPage() {
    const grid = document.getElementById('fav-grid');
    if (!grid) return;

    const statusElement = document.getElementById('fav-status');
    const emptyElement = document.getElementById('fav-empty');
    const filterEmpty = document.getElementById('fav-watch-empty');
    const ids = favoriteCore.loadFavorites();
    favoriteCore.syncAllButtons();

    if (!ids.length) {
      favoriteItems = [];
      activeWatchFilter = 'all';
      syncClearButton(false);
      hideElement(statusElement);
      hideElement(grid);
      hideElement(filterEmpty);
      renderWatchToolbar([]);
      showElement(emptyElement);
      return;
    }

    getIndexData()
      .then(function (data) {
        favoriteItems = orderItemsByIds(data, ids);
        hideElement(statusElement);

        if (!favoriteItems.length) {
          syncClearButton(false);
          hideElement(grid);
          hideElement(filterEmpty);
          renderWatchToolbar([]);
          showElement(emptyElement);
          return;
        }

        syncClearButton(true);
        renderFavoriteList();
        window.setTimeout(function () {
          syncClearButton(favoriteCore.loadFavorites().length > 0 && favoriteItems.length > 0);
        }, 0);
      })
      .catch(function (error) {
        syncClearButton(false);
        console.error('[Fav] Error loading index.json', error);
        if (statusElement) {
          statusElement.innerHTML = '<div class="text-4xl mb-3 opacity-40"></div><div class="text-red-400 font-semibold">Gagal memuat data favorit</div>';
          showElement(statusElement);
        }
      });
  }

  function openConfirm(trigger) {
    const dialog = document.getElementById('fav-confirm');
    if (!dialog) return;
    lastConfirmTrigger = trigger || document.activeElement;
    dialog.classList.add('is-open');
    dialog.setAttribute('aria-hidden', 'false');
    window.setTimeout(function () { focusFirst(dialog, '#fav-cancel-btn'); }, 0);
  }

  function closeConfirm() {
    const dialog = document.getElementById('fav-confirm');
    if (!dialog) return;
    dialog.classList.remove('is-open');
    dialog.setAttribute('aria-hidden', 'true');
    restoreFocus(lastConfirmTrigger, '#fav-clear-all, .fav-empty-cta');
    lastConfirmTrigger = null;
  }

  function clearAllFavorites() {
    favoriteCore.clearAll();
    favoriteCore.syncAllButtons();
    renderFavoritesPage();
    closeConfirm();
  }

  favoriteCore.renderFavorites = renderFavoritesPage;
  window.renderFavorites = renderFavoritesPage;

  document.addEventListener('donghua:favorites-changed', renderFavoritesPage);
  document.addEventListener('donghua:watch-status-changed', renderFavoriteList);

  document.addEventListener('click', function (event) {
    const watchButton = event.target.closest('[data-fav-watch-status]');
    if (watchButton) {
      event.preventDefault();
      event.stopPropagation();
      const id = watchButton.getAttribute('data-fav-watch-id');
      const status = watchButton.getAttribute('data-fav-watch-status');
      favoriteCore.setWatchStatus(id, status);
      return;
    }

    const filterButton = event.target.closest('[data-fav-watch-filter]');
    if (filterButton) {
      activeWatchFilter = filterButton.getAttribute('data-fav-watch-filter') || 'all';
      renderFavoriteList();
      return;
    }

    const clearButton = event.target.closest('#fav-clear-all');
    if (clearButton) {
      event.preventDefault();
      openConfirm(clearButton);
      return;
    }

    const dialog = document.getElementById('fav-confirm');
    if (dialog && event.target === dialog) {
      closeConfirm();
      return;
    }

    if (event.target.closest('#fav-cancel-btn')) {
      closeConfirm();
      return;
    }

    if (event.target.closest('#fav-confirm-yes-btn')) {
      event.preventDefault();
      clearAllFavorites();
    }
  });

  document.addEventListener('keydown', function (event) {
    const dialog = document.getElementById('fav-confirm');
    if (event.key === 'Escape' && dialog && dialog.classList.contains('is-open')) closeConfirm();
  });

  document.addEventListener('DOMContentLoaded', renderFavoritesPage);
})();
