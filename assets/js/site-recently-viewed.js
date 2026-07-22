(function () {
  'use strict';

  var STORAGE_KEY = 'donghuabatch_recently_viewed';
  var MAX_ITEMS = 8;

  function asText(value) {
    return value == null ? '' : String(value).trim();
  }

  function cardTypeLabel(value) {
    var label = asText(value);
    return label.toLowerCase() === 'donghua movie' ? 'Movie' : label;
  }

  function escapeHTML(value) {
    return asText(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function loadItems() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      var parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return [];

      return parsed
        .filter(function (item) {
          return item && asText(item.id) && asText(item.title) && asText(item.url);
        })
        .slice(0, MAX_ITEMS);
    } catch (error) {
      return [];
    }
  }

  function saveItems(items) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
    } catch (error) {
      /* Storage can be blocked; the page must remain fully usable. */
    }
  }

  function saveCurrentDonghua() {
    var current = document.getElementById('recently-viewed-current');
    if (!current) return;

    var item = {
      id: asText(current.getAttribute('data-id')),
      title: asText(current.getAttribute('data-title')),
      url: asText(current.getAttribute('data-url')),
      thumbnail: asText(current.getAttribute('data-thumbnail')),
      type: asText(current.getAttribute('data-type')) || 'Donghua',
      episode: asText(current.getAttribute('data-episode')),
      status: asText(current.getAttribute('data-status')),
      rating: asText(current.getAttribute('data-rating')),
      viewedAt: Date.now()
    };

    if (!item.id || !item.title || !item.url) return;

    var items = loadItems().filter(function (saved) {
      return saved.id !== item.id;
    });
    items.unshift(item);
    saveItems(items);
  }

  function favoriteButton(item) {
    var saved = false;
    try {
      saved = Boolean(window.DonghuaFav && window.DonghuaFav.isSaved && window.DonghuaFav.isSaved(item.id));
    } catch (error) {
      saved = false;
    }

    var icon = saved
      ? '<path d="M5 3h14a1 1 0 0 1 1 1v17l-8-4-8 4V4a1 1 0 0 1 1-1z" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>'
      : '<path d="M5 3h14a1 1 0 0 1 1 1v17l-8-4-8 4V4a1 1 0 0 1 1-1z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>';

    return '<button class="donghua-card-bookmark' + (saved ? ' is-saved' : '') + '" data-fav-id="' + escapeHTML(item.id) + '" type="button" aria-pressed="' + (saved ? 'true' : 'false') + '" aria-label="' + (saved ? 'Hapus dari daftar favorit' : 'Tambah ke daftar favorit') + '" title="' + (saved ? 'Hapus dari favorit' : 'Simpan ke favorit') + '"><svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true">' + icon + '</svg></button>';
  }

  function cardTemplate(item) {
    var title = escapeHTML(item.title);
    var type = escapeHTML(cardTypeLabel(item.type || 'Donghua'));
    var episode = escapeHTML(item.episode);
    var status = escapeHTML(item.status);
    var rating = escapeHTML(item.rating);
    var thumbnail = escapeHTML(item.thumbnail);
    var meta = [episode, status]
      .filter(function (value) { return value && value !== '-'; })
      .map(function (value) { return '<span class="donghua-card-chip">' + value + '</span>'; })
      .join('');
    var ratingHTML = rating && rating !== '-'
      ? '<span class="donghua-card-rating"><i class="fa-solid fa-star" aria-hidden="true"></i> ' + rating + '/10</span>'
      : '<span class="donghua-card-rating"><i class="fa-solid fa-star" aria-hidden="true"></i> Donghua</span>';
    var poster = thumbnail
      ? '<img loading="lazy" decoding="async" src="' + thumbnail + '" alt="' + title + '" width="200" height="300">'
      : '<div class="w-full h-full flex items-center justify-center bg-cyber-dark/80 text-cyan-400/40" aria-hidden="true"><i class="fa-solid fa-film text-6xl"></i></div>';

    return '<article class="donghua-card">' +
      favoriteButton(item) +
      '<a class="donghua-card-link" title="' + title + '" href="' + escapeHTML(item.url) + '">' +
        '<div class="donghua-card-poster">' + poster + '</div>' +
        '<div class="donghua-card-frame" aria-hidden="true"></div>' +
        '<div class="donghua-card-badges"><span class="donghua-card-badge">' + type + '</span></div>' +
        '<div class="donghua-card-body"><h3 class="donghua-card-title">' + title + '</h3>' +
          '<div class="donghua-card-meta">' + meta + '</div>' +
          '<div class="donghua-card-footer">' + ratingHTML + '<span class="donghua-card-cta">Detail</span></div>' +
        '</div>' +
      '</a>' +
    '</article>';
  }

  function renderHomeHistory() {
    var section = document.getElementById('recently-viewed-section');
    var grid = document.getElementById('recently-viewed-grid');
    var count = document.getElementById('recently-viewed-count');
    if (!section || !grid) return;

    var items = loadItems();
    if (!items.length) return;

    var fragment = document.createDocumentFragment();
    items.forEach(function (item) {
      var listItem = document.createElement('li');
      listItem.className = 'donghua-card-item';
      listItem.innerHTML = cardTemplate(item);
      fragment.appendChild(listItem);
    });

    grid.replaceChildren(fragment);
    grid.style.setProperty('--recent-grid-columns', String(Math.min(items.length, 4)));
    grid.setAttribute('data-recent-count', String(items.length));
    if (count) count.textContent = items.length + ' terakhir dibuka';
    section.hidden = false;

    try {
      if (window.DonghuaFav && window.DonghuaFav.syncAllButtons) {
        window.DonghuaFav.syncAllButtons();
      }
    } catch (error) {
      /* Favorite controls are optional for this feature. */
    }
  }

  function initRecentlyViewed() {
    saveCurrentDonghua();
    renderHomeHistory();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initRecentlyViewed, { once: true });
  } else {
    initRecentlyViewed();
  }
})();
