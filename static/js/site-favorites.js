(function () {
  'use strict';

  var STORAGE_KEY = 'donghuabatch_favorites';
  var bookmarkSelector = '.donghua-card-bookmark, .post-bookmark-btn';

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

  function updateBadge() {
    var count = loadFavIds().length;
    var badge = document.getElementById('nav-fav-badge');
    if (!badge) return;
    badge.textContent = count;
    badge.classList.toggle('is-hidden', count === 0);
  }

  function setBookmarkIcon(button, saved) {
    var svg = button.querySelector('svg');
    if (svg) {
      svg.innerHTML = saved
        ? '<path d="M5 3h14a1 1 0 0 1 1 1v17l-8-4-8 4V4a1 1 0 0 1 1-1z" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>'
        : '<path d="M5 3h14a1 1 0 0 1 1 1v17l-8-4-8 4V4a1 1 0 0 1 1-1z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>';
      return;
    }

    var icon = button.querySelector('.post-bookmark-icon');
    if (icon) {
      icon.classList.toggle('fa-solid', saved);
      icon.classList.toggle('fa-regular', !saved);
    }
  }

  function syncButton(button) {
    var id = button.getAttribute('data-fav-id');
    if (!id) return;
    var saved = isSaved(id);
    button.classList.toggle('is-saved', saved);
    setBookmarkIcon(button, saved);

    var label = button.querySelector('.fav-label');
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
    syncAllButtons: syncAllButtons,
    STORAGE_KEY: STORAGE_KEY
  };

  document.addEventListener('click', function (event) {
    var bookmarkButton = event.target.closest(bookmarkSelector);
    if (!bookmarkButton) return;

    event.preventDefault();
    event.stopPropagation();

    var id = bookmarkButton.getAttribute('data-fav-id');
    if (!id) return;

    toggleSave(id);
    syncAllButtons();
    pulsePostButton(bookmarkButton);
    notifyChanged();
  });

  document.addEventListener('DOMContentLoaded', syncAllButtons);
})();
