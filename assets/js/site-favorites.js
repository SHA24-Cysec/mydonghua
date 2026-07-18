(function () {
  'use strict';

  const STORAGE_KEY = 'donghuabatch_favorites';
  const WATCH_STATUS_KEY = 'donghuabatch_watch_statuses';
  const DEFAULT_WATCH_STATUS = 'belum';
  const WATCH_STATUSES = ['belum', 'sedang', 'selesai'];
  const bookmarkSelector = '.donghua-card-bookmark, .post-bookmark-btn';

  function loadFavIds() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
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

  function loadWatchStatuses() {
    try {
      const raw = localStorage.getItem(WATCH_STATUS_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') return {};
      const clean = {};
      Object.keys(parsed).forEach(function (id) {
        if (WATCH_STATUSES.indexOf(parsed[id]) !== -1) clean[id] = parsed[id];
      });
      return clean;
    } catch (error) {
      return {};
    }
  }

  function saveWatchStatuses(statuses) {
    try {
      localStorage.setItem(WATCH_STATUS_KEY, JSON.stringify(statuses));
    } catch (error) {
      console.warn('[Fav] watch status storage error', error);
    }
  }

  function getWatchStatus(id) {
    if (!id) return DEFAULT_WATCH_STATUS;
    const statuses = loadWatchStatuses();
    return WATCH_STATUSES.indexOf(statuses[id]) !== -1 ? statuses[id] : DEFAULT_WATCH_STATUS;
  }

  function setWatchStatus(id, status) {
    if (!id || WATCH_STATUSES.indexOf(status) === -1) return DEFAULT_WATCH_STATUS;
    const statuses = loadWatchStatuses();
    if (status === DEFAULT_WATCH_STATUS) {
      delete statuses[id];
    } else {
      statuses[id] = status;
    }
    saveWatchStatuses(statuses);
    document.dispatchEvent(new CustomEvent('donghua:watch-status-changed', {
      detail: { id: id, status: status }
    }));
    return status;
  }

  function removeWatchStatus(id) {
    if (!id) return;
    const statuses = loadWatchStatuses();
    if (!Object.prototype.hasOwnProperty.call(statuses, id)) return;
    delete statuses[id];
    saveWatchStatuses(statuses);
  }

  function isSaved(id) {
    return loadFavIds().indexOf(id) !== -1;
  }

  function toggleSave(id) {
    const ids = loadFavIds();
    const idx = ids.indexOf(id);
    let saved;

    if (idx !== -1) {
      ids.splice(idx, 1);
      removeWatchStatus(id);
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
    saveWatchStatuses({});
  }

  function updateBadge() {
    const count = loadFavIds().length;
    const badge = document.getElementById('nav-fav-badge');
    if (!badge) return;
    badge.textContent = count;
    badge.classList.toggle('is-hidden', count === 0);
  }

  function setBookmarkIcon(button, saved) {
    const svg = button.querySelector('svg');
    if (svg) {
      svg.innerHTML = saved
        ? '<path d="M5 3h14a1 1 0 0 1 1 1v17l-8-4-8 4V4a1 1 0 0 1 1-1z" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>'
        : '<path d="M5 3h14a1 1 0 0 1 1 1v17l-8-4-8 4V4a1 1 0 0 1 1-1z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>';
      return;
    }

    const icon = button.querySelector('.post-bookmark-icon');
    if (icon) {
      icon.classList.toggle('fa-solid', saved);
      icon.classList.toggle('fa-regular', !saved);
    }
  }

  function syncButton(button) {
    const id = button.getAttribute('data-fav-id');
    if (!id) return;
    const saved = isSaved(id);
    button.classList.toggle('is-saved', saved);
    setBookmarkIcon(button, saved);

    const label = button.querySelector('.fav-label');
    if (label) label.textContent = saved ? 'Hapus dari Favorit' : 'Tambah ke Favorit';

    button.setAttribute('aria-pressed', saved ? 'true' : 'false');
    button.setAttribute('aria-label', saved ? 'Hapus dari daftar favorit' : 'Tambah ke daftar favorit');
  }

  function pulsePostButton(button) {
    if (!button.classList.contains('post-bookmark-btn')) return;
    button.classList.remove('is-pulsing');
    void button.offsetWidth;
    button.classList.add('is-pulsing');
    window.setTimeout(function () { button.classList.remove('is-pulsing'); }, 700);
  }

  function syncAllButtons() {
    document.querySelectorAll(bookmarkSelector).forEach(syncButton);
    updateBadge();
  }

  function notifyChanged() {
    document.dispatchEvent(new CustomEvent('donghua:favorites-changed', {
      detail: { ids: loadFavIds() }
    }));
  }

  window.DonghuaFav = {
    isSaved: isSaved,
    toggleSave: toggleSave,
    clearAll: clearAll,
    loadFavorites: loadFavIds,
    getWatchStatus: getWatchStatus,
    setWatchStatus: setWatchStatus,
    loadWatchStatuses: loadWatchStatuses,
    WATCH_STATUS_KEY: WATCH_STATUS_KEY,
    WATCH_STATUSES: WATCH_STATUSES.slice(),
    syncAllButtons: syncAllButtons,
    STORAGE_KEY: STORAGE_KEY
  };

  // Escape key untuk tutup dialog konfirmasi hapus favorit
  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape') return;
    var confirm = document.getElementById('fav-confirm');
    if (confirm && confirm.classList.contains('is-open')) {
      document.getElementById('fav-cancel-btn').click();
    }
  });

  document.addEventListener('click', function (event) {
    const bookmarkButton = event.target.closest(bookmarkSelector);
    if (!bookmarkButton) return;

    event.preventDefault();
    event.stopPropagation();

    const id = bookmarkButton.getAttribute('data-fav-id');
    if (!id) return;

    toggleSave(id);
    syncAllButtons();
    pulsePostButton(bookmarkButton);
    notifyChanged();
  });

  document.addEventListener('DOMContentLoaded', syncAllButtons);
})();
