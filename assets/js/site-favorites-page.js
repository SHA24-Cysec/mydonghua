(function () {
  'use strict';

  const favoriteCore = window.DonghuaFav;
  if (!favoriteCore) {
    console.error('[Fav] Core module tidak tersedia.');
    return;
  }

  let indexPromise = null;
  let lastConfirmTrigger = null;

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

  function renderFavoriteCard(item) {
    const type = escapeHTML(item.type || 'Donghua');
    const episode = escapeHTML(item.episode || '-');
    const status = escapeHTML(item.status || '-');
    const rating = escapeHTML(item.rating || '-');
    const permalink = escapeHTML(item.permalink || '#');
    const thumbnail = escapeHTML(item.thumbnail_small || item.thumbnail || '');
    let thumbnailSrcset = '';

    if (item.thumbnail_srcset) {
      thumbnailSrcset = escapeHTML(item.thumbnail_srcset);
    } else if (item.thumbnail_small && item.thumbnail_medium) {
      thumbnailSrcset = escapeHTML(item.thumbnail_small) + ' 240w, ' + escapeHTML(item.thumbnail_medium) + ' 400w';
    }

    const title = escapeHTML(item.title || 'Donghua');
    const id = escapeHTML(itemId(item));
    const ratingHTML = rating && rating !== '-'
      ? '<span class="donghua-card-rating"><i class="fa-solid fa-star" aria-hidden="true"></i> ' + rating + '/10</span>'
      : '<span class="donghua-card-rating"><i class="fa-solid fa-star" aria-hidden="true"></i> Donghua</span>';
    const metaChips = [episode, status]
      .filter(function (value) { return value && value !== '-'; })
      .map(function (value) { return '<span class="donghua-card-chip">' + value + '</span>'; })
      .join('');
    const saved = favoriteCore.isSaved(itemId(item));
    const iconPath = saved
      ? '<path d="M5 3h14a1 1 0 0 1 1 1v17l-8-4-8 4V4a1 1 0 0 1 1-1z" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>'
      : '<path d="M5 3h14a1 1 0 0 1 1 1v17l-8-4-8 4V4a1 1 0 0 1 1-1z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>';
    let thumbnailHTML = '';

    if (thumbnail) {
      thumbnailHTML = '<img loading="lazy" decoding="async" src="' + thumbnail + '" alt="' + title + '"';
      if (thumbnailSrcset) {
        thumbnailHTML += ' srcset="' + thumbnailSrcset + '" sizes="(max-width:340px) 90vw, (max-width:640px) 45vw, (max-width:1024px) 22vw, 280px"';
      }
      thumbnailHTML += ' width="240" height="320">';
    }

    return '<li class="donghua-card-item">' +
      '<article class="donghua-card">' +
        '<button class="donghua-card-bookmark' + (saved ? ' is-saved' : '') + '" data-fav-id="' + id + '" type="button" aria-pressed="' + (saved ? 'true' : 'false') + '" aria-label="' + (saved ? 'Hapus dari daftar favorit' : 'Tambah ke daftar favorit') + '" title="' + (saved ? 'Hapus dari favorit' : 'Simpan ke favorit') + '">' +
          '<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true">' + iconPath + '</svg>' +
        '</button>' +
        '<a class="donghua-card-link" title="' + title + '" href="' + permalink + '">' +
          '<div class="donghua-card-poster">' + thumbnailHTML + '</div>' +
          '<div class="donghua-card-frame" aria-hidden="true"></div>' +
          '<div class="donghua-card-badges"><span class="donghua-card-badge">' + type + '</span><span class="donghua-card-badge sub">Sub</span></div>' +
          '<div class="donghua-card-body">' +
            '<h3 class="donghua-card-title">' + title + '</h3>' +
            '<div class="donghua-card-meta">' + metaChips + '</div>' +
            '<div class="donghua-card-footer">' + ratingHTML + '<span class="donghua-card-cta">Detail</span></div>' +
          '</div>' +
        '</a>' +
      '</article>' +
    '</li>';
  }

  function showElement(element, displayValue) {
    if (!element) return;
    element.classList.remove('hidden');
    element.style.display = displayValue || '';
  }

  function hideElement(element) {
    if (!element) return;
    element.classList.add('hidden');
    element.style.display = 'none';
  }

  function syncClearButton(visible) {
    const clearButton = document.getElementById('fav-clear-all');
    if (!clearButton) return;
    const shouldShow = visible || favoriteCore.loadFavorites().length > 0;
    clearButton.classList.toggle('hidden', !shouldShow);
    clearButton.disabled = !shouldShow;
  }

  function renderFavoritesPage() {
    const grid = document.getElementById('fav-grid');
    if (!grid) return;

    const statusElement = document.getElementById('fav-status');
    const emptyElement = document.getElementById('fav-empty');
    const ids = favoriteCore.loadFavorites();
    favoriteCore.syncAllButtons();

    if (!ids.length) {
      syncClearButton(false);
      hideElement(statusElement);
      hideElement(grid);
      showElement(emptyElement);
      return;
    }

    getIndexData()
      .then(function (data) {
        const items = orderItemsByIds(data, ids);
        hideElement(statusElement);

        if (!items.length) {
          syncClearButton(false);
          hideElement(grid);
          showElement(emptyElement);
          return;
        }

        syncClearButton(true);
        grid.innerHTML = items.map(renderFavoriteCard).join('');
        showElement(grid, 'grid');
        hideElement(emptyElement);
        favoriteCore.syncAllButtons();
        window.setTimeout(function () {
          syncClearButton(favoriteCore.loadFavorites().length > 0 && grid.querySelectorAll('li').length > 0);
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

  document.addEventListener('click', function (event) {
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
