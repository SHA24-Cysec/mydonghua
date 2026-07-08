(function () {
  'use strict';

  var STORAGE_KEY = 'donghuabatch_favorites';
  var bookmarkSelector = '.donghua-card-bookmark, .post-bookmark-btn';
  var indexPromise = null;

  function loadFavIds() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      var parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  function saveFavIds(ids) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    } catch (error) {
      console.warn('[Fav] localStorage error', error);
    }
  }

  function isSaved(id) {
    return loadFavIds().indexOf(id) !== -1;
  }

  function toggleSave(id) {
    var ids = loadFavIds();
    var idx = ids.indexOf(id);
    var saved;

    if (idx !== -1) {
      ids.splice(idx, 1);
      saved = false;
    } else {
      ids.push(id);
      saved = true;
    }

    saveFavIds(ids);
    return saved;
  }

  function clearAll() {
    saveFavIds([]);
  }

  function updateBadges() {
    var count = loadFavIds().length;
    var badge = document.getElementById('nav-fav-badge');
    var badgeMobile = document.getElementById('nav-fav-badge-mobile');
    var countEl = document.getElementById('fav-count');

    if (badge) {
      badge.textContent = count;
      badge.classList.toggle('is-hidden', count === 0);
    }
    if (badgeMobile) {
      badgeMobile.textContent = count;
      badgeMobile.classList.toggle('is-hidden', count === 0);
    }
    if (countEl) {
      countEl.textContent = count;
    }
  }

  function setBookmarkIcon(btn, saved) {
    var svg = btn.querySelector('svg');
    if (svg) {
      svg.innerHTML = saved
        ? '<path d="M5 3h14a1 1 0 0 1 1 1v17l-8-4-8 4V4a1 1 0 0 1 1-1z" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>'
        : '<path d="M5 3h14a1 1 0 0 1 1 1v17l-8-4-8 4V4a1 1 0 0 1 1-1z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>';
      return;
    }

    var faIcon = btn.querySelector('.post-bookmark-icon');
    if (faIcon) {
      faIcon.classList.toggle('fa-solid', saved);
      faIcon.classList.toggle('fa-regular', !saved);
    }
  }

  function syncButton(btn) {
    var id = btn.getAttribute('data-fav-id');
    if (!id) return;

    var saved = isSaved(id);
    btn.classList.toggle('is-saved', saved);
    setBookmarkIcon(btn, saved);

    var label = btn.querySelector('.fav-label');
    if (label) {
      label.textContent = saved ? 'Hapus dari Favorit' : 'Tambah ke Favorit';
    }

    btn.setAttribute('aria-pressed', saved ? 'true' : 'false');
    btn.setAttribute('aria-label', saved ? 'Hapus dari daftar favorit' : 'Tambah ke daftar favorit');
  }

  function pulsePostButton(btn) {
    if (!btn.classList.contains('post-bookmark-btn')) return;
    btn.classList.remove('is-pulsing');
    void btn.offsetWidth;
    btn.classList.add('is-pulsing');
    setTimeout(function () {
      btn.classList.remove('is-pulsing');
    }, 700);
  }

  function syncAllButtons() {
    document.querySelectorAll(bookmarkSelector).forEach(syncButton);
    updateBadges();
  }

  function getIndexData() {
    if (indexPromise) return indexPromise;
    if (window.DonghuaBatchData && typeof window.DonghuaBatchData.getIndexData === 'function') {
      indexPromise = window.DonghuaBatchData.getIndexData();
    } else {
      indexPromise = fetch('/index.json').then(function (res) {
        if (!res.ok) throw new Error('Gagal memuat index.json');
        return res.json();
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

  function renderFavoriteCard(item) {
    var type = escapeHTML(item.type || 'Donghua');
    var episode = escapeHTML(item.episode || '-');
    var status = escapeHTML(item.status || '-');
    var rating = escapeHTML(item.rating || '-');
    var permalink = escapeHTML(item.permalink || '#');
    var thumbnail = escapeHTML(item.thumbnail || '');
    var title = escapeHTML(item.title || 'Donghua');
    var id = escapeHTML(itemId(item));

    var ratingHTML = rating && rating !== '-'
      ? '<span class="donghua-card-rating"><i class="fa-solid fa-star" aria-hidden="true"></i> ' + rating + '/10</span>'
      : '<span class="donghua-card-rating"><i class="fa-solid fa-star" aria-hidden="true"></i> Donghua</span>';

    var metaChips = [episode, status]
      .filter(function (value) { return value && value !== '-'; })
      .map(function (value) { return '<span class="donghua-card-chip">' + value + '</span>'; })
      .join('');

    var saved = isSaved(itemId(item));
    var iconPath = saved
      ? '<path d="M5 3h14a1 1 0 0 1 1 1v17l-8-4-8 4V4a1 1 0 0 1 1-1z" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>'
      : '<path d="M5 3h14a1 1 0 0 1 1 1v17l-8-4-8 4V4a1 1 0 0 1 1-1z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>';

    return '<li class="donghua-card-item">' +
      '<article class="donghua-card">' +
        '<a class="donghua-card-link" title="' + title + '" href="' + permalink + '">' +
          '<div class="donghua-card-poster">' +
            (thumbnail ? '<img loading="lazy" decoding="async" width="200" height="300" src="' + thumbnail + '" alt="' + title + '">' : '') +
          '</div>' +
          '<div class="donghua-card-frame" aria-hidden="true"></div>' +
          '<button class="donghua-card-bookmark' + (saved ? ' is-saved' : '') + '" data-fav-id="' + id + '" type="button" aria-label="Hapus dari favorit" title="Hapus">' +
            '<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true">' + iconPath + '</svg>' +
          '</button>' +
          '<div class="donghua-card-badges">' +
            '<span class="donghua-card-badge">' + type + '</span>' +
            '<span class="donghua-card-badge sub">Sub</span>' +
          '</div>' +
          '<div class="donghua-card-body">' +
            '<h3 class="donghua-card-title">' + title + '</h3>' +
            '<div class="donghua-card-meta">' + metaChips + '</div>' +
            '<div class="donghua-card-footer">' + ratingHTML + '<span class="donghua-card-cta">Detail</span></div>' +
          '</div>' +
        '</a>' +
      '</article>' +
    '</li>';
  }

  function showElement(el, displayValue) {
    if (!el) return;
    el.classList.remove('hidden');
    el.style.display = displayValue || '';
  }

  function hideElement(el) {
    if (!el) return;
    el.classList.add('hidden');
    el.style.display = 'none';
  }

  function syncClearButton(visible) {
    var clearBtn = document.getElementById('fav-clear-all');
    if (!clearBtn) return;
    var shouldShow = visible || loadFavIds().length > 0;
    if (shouldShow) {
      clearBtn.classList.remove('hidden');
      clearBtn.disabled = false;
    } else {
      clearBtn.classList.add('hidden');
      clearBtn.disabled = true;
    }
  }

  function renderFavoritesPage() {
    var grid = document.getElementById('fav-grid');
    if (!grid) return;

    var statusEl = document.getElementById('fav-status');
    var emptyEl = document.getElementById('fav-empty');
    var ids = loadFavIds();
    updateBadges();

    if (!ids.length) {
      syncClearButton(false);
      hideElement(statusEl);
      hideElement(grid);
      showElement(emptyEl);
      return;
    }

    getIndexData()
      .then(function (data) {
        var items = Array.isArray(data)
          ? data.filter(function (item) { return ids.indexOf(itemId(item)) !== -1; })
          : [];

        hideElement(statusEl);

        if (!items.length) {
          syncClearButton(false);
          hideElement(grid);
          showElement(emptyEl);
          return;
        }

        syncClearButton(true);
        grid.innerHTML = items.map(renderFavoriteCard).join('');
        showElement(grid, 'grid');
        hideElement(emptyEl);
        syncAllButtons();
        window.setTimeout(function () {
          syncClearButton(loadFavIds().length > 0 && grid.querySelectorAll('li').length > 0);
        }, 0);
      })
      .catch(function (error) {
        syncClearButton(false);
        console.error('[Fav] Error loading index.json', error);
        if (statusEl) {
          statusEl.innerHTML = '<div class="text-4xl mb-3 opacity-40"></div><div class="text-red-400 font-semibold">Gagal memuat data favorit</div>';
          showElement(statusEl);
        }
      });
  }

  function renderSheetList() {
    var listContainer = document.getElementById('fav-list-container');
    if (!listContainer) return;

    var ids = loadFavIds();
    updateBadges();

    if (!ids.length) {
      listContainer.innerHTML = '<div class="fav-empty"><div class="fav-empty-icon"><i class="fa-regular fa-bookmark"></i></div><div class="fav-empty-text">Belum ada favorit</div><div class="fav-empty-sub">Tap icon bookmark di card donghua untuk menyimpan</div></div>';
      return;
    }

    getIndexData()
      .then(function (data) {
        var items = Array.isArray(data)
          ? data.filter(function (item) { return ids.indexOf(itemId(item)) !== -1; })
          : [];

        if (!items.length) {
          listContainer.innerHTML = '<div class="fav-empty"><div class="fav-empty-icon"><i class="fa-regular fa-bookmark"></i></div><div class="fav-empty-text">Data favorit tidak ditemukan</div></div>';
          return;
        }

        var html = '<ul class="fav-list">';
        items.forEach(function (item) {
          var title = escapeHTML(item.title || 'Donghua');
          var href = escapeHTML(item.permalink || '#');
          var img = escapeHTML(item.thumbnail || '');
          var meta = [item.episode, item.status].filter(Boolean).map(escapeHTML).join(' • ');
          html += '<li class="fav-item">' +
            '<a class="fav-item-thumb" href="' + href + '" aria-label="' + title + '">' +
              (img ? '<img src="' + img + '" alt="" loading="lazy" decoding="async" width="48" height="72">' : '') +
            '</a>' +
            '<div class="fav-item-info">' +
              '<a class="fav-item-title" href="' + href + '">' + title + '</a>' +
              (meta ? '<div class="fav-item-meta">' + meta + '</div>' : '') +
            '</div>' +
            '<button class="fav-item-remove" data-remove-id="' + escapeHTML(itemId(item)) + '" type="button" aria-label="Hapus ' + title + '" title="Hapus">' +
              '<i class="fa-solid fa-xmark" aria-hidden="true"></i>' +
            '</button>' +
          '</li>';
        });
        html += '</ul>';
        listContainer.innerHTML = html;
      })
      .catch(function () {
        listContainer.innerHTML = '<div class="fav-empty"><div class="fav-empty-icon"><i class="fa-regular fa-bookmark"></i></div><div class="fav-empty-text">Data favorit tidak ditemukan</div></div>';
      });
  }

  function openSheet() {
    var overlay = document.getElementById('fav-overlay');
    if (!overlay) return;
    overlay.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    renderSheetList();
  }

  function closeSheet() {
    var overlay = document.getElementById('fav-overlay');
    if (!overlay) return;
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  function openConfirm(selector) {
    var dlg = document.querySelector(selector || '#fav-confirm');
    if (!dlg) return;
    dlg.classList.add('is-open');
    dlg.setAttribute('aria-hidden', 'false');
  }

  function closeConfirm(selector) {
    var dlg = document.querySelector(selector || '#fav-confirm');
    if (!dlg) return;
    dlg.classList.remove('is-open');
    dlg.setAttribute('aria-hidden', 'true');
  }

  function removeOne(id) {
    saveFavIds(loadFavIds().filter(function (item) { return item !== id; }));
    syncAllButtons();
    renderSheetList();
    renderFavoritesPage();
    updateBadges();
  }

  function clearAllFavorites() {
    clearAll();
    syncAllButtons();
    renderSheetList();
    renderFavoritesPage();
    updateBadges();
    closeConfirm('#fav-confirm');
  }

  window.DonghuaFav = {
    isSaved: isSaved,
    toggleSave: toggleSave,
    clearAll: clearAll,
    loadFavorites: loadFavIds,
    syncAllButtons: syncAllButtons,
    renderFavorites: renderFavoritesPage,
    STORAGE_KEY: STORAGE_KEY
  };
  window.renderFavorites = renderFavoritesPage;

  document.addEventListener('click', function (event) {
    var bookmarkBtn = event.target.closest(bookmarkSelector);
    if (bookmarkBtn) {
      event.preventDefault();
      event.stopPropagation();

      var favId = bookmarkBtn.getAttribute('data-fav-id');
      if (!favId) return;

      toggleSave(favId);
      syncAllButtons();
      pulsePostButton(bookmarkBtn);
      renderFavoritesPage();
      if (document.getElementById('fav-overlay') && document.getElementById('fav-overlay').classList.contains('is-open')) {
        renderSheetList();
      }
      return;
    }

    var sheetTrigger = event.target.closest('[data-fav-open], #nav-fav-btn, #nav-fav-btn-mobile');
    if (sheetTrigger) {
      event.preventDefault();
      openSheet();
      return;
    }

    var overlay = document.getElementById('fav-overlay');
    if (event.target.closest('#fav-close-btn') || (overlay && event.target === overlay && !event.target.closest('.fav-sheet'))) {
      closeSheet();
      return;
    }

    var removeBtn = event.target.closest('.fav-item-remove');
    if (removeBtn) {
      event.preventDefault();
      event.stopPropagation();
      var removeId = removeBtn.getAttribute('data-remove-id');
      if (removeId) removeOne(removeId);
      return;
    }

    if (event.target.closest('#fav-clear-btn, #fav-clear-all')) {
      event.preventDefault();
      openConfirm('#fav-confirm');
      return;
    }

    if (event.target.closest('#fav-cancel-btn')) {
      closeConfirm('#fav-confirm');
      return;
    }

    if (event.target.closest('#fav-confirm-yes-btn')) {
      event.preventDefault();
      clearAllFavorites();
    }
  });

  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape') return;

    var confirmDlg = document.getElementById('fav-confirm');
    var overlay = document.getElementById('fav-overlay');

    if (confirmDlg && confirmDlg.classList.contains('is-open')) {
      closeConfirm('#fav-confirm');
    } else if (overlay && overlay.classList.contains('is-open')) {
      closeSheet();
    }
  });

  document.addEventListener('DOMContentLoaded', function () {
    syncAllButtons();
    renderFavoritesPage();
  });
})();
