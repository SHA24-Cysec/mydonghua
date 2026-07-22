(function () {
  'use strict';

// Terapkan pilihan genre saat form sidebar dikirim.
function applyGenreFilter() {
  const genres = [];
  const checkboxes = document.querySelectorAll('input[name="genre"]:checked');
  checkboxes.forEach(function(cb) {
    genres.push(cb.value);
  });

  if (!genres.length) return;

  window.location.href = "/filter-genre/#" + genres.join(",");
}

// Handle form submit sebagai backup
document.addEventListener('DOMContentLoaded', function() {
  const genreForm = document.getElementById("genre-filter-form");
  if (genreForm) {
    genreForm.addEventListener("submit", function(e) {
      e.preventDefault();
      applyGenreFilter();
    });
  }
});

function getGenresFromHash() {
  return location.hash
    .replace("#", "")
    .split(",")
    .map(function(g) { return g.trim().toLowerCase(); })
    .filter(Boolean);
}

const resultsContainer = document.getElementById("genre-results");
let genrePage = 1;
let genreResults = [];
let genreResizeTimer = null;

// Jumlah item per halaman adaptif
function getGenrePerPage() {
  if (window.DonghuaSearch && typeof window.DonghuaSearch.getPerPage === "function") {
    return window.DonghuaSearch.getPerPage();
  }
  if (window.matchMedia('(min-width: 1024px)').matches) return 15;
  if (window.matchMedia('(min-width: 700px)').matches) return 12;
  if (window.matchMedia('(min-width: 640px)').matches) return 12;
  return 10;
}

function renderGenreResults() {
  const alertBox = document.getElementById("genre-alert");
  const pagination = document.getElementById("genre-pagination");

  resultsContainer.innerHTML = "";

  if (!genreResults.length) {
    alertBox.classList.remove("hidden");
    pagination.classList.add("hidden");
    return;
  }

  alertBox.classList.add("hidden");

  const genrePerPage = getGenrePerPage();
  const totalPages = Math.ceil(genreResults.length / genrePerPage);
  const start = (genrePage - 1) * genrePerPage;
  const end = start + genrePerPage;

  genreResults.slice(start, end).forEach(function(item) {
    const li = document.createElement("li");
    li.className = "donghua-card-item";
    
    if (window.DonghuaBatchCards && typeof window.DonghuaBatchCards.donghuaCardTemplate === "function") {
      li.innerHTML = window.DonghuaBatchCards.donghuaCardTemplate(item, item.title, "");
    } else if (typeof donghuaCardTemplate === "function") {
      li.innerHTML = donghuaCardTemplate(item, item.title, "");
    } else {
      const type = item.type || "Donghua";
      const ratingHTML = item.rating && item.rating !== "-"
        ? '<span class="donghua-card-rating"><i class="fa-solid fa-star" aria-hidden="true"></i> ' + item.rating + '/10</span>'
        : '<span class="donghua-card-rating"><i class="fa-solid fa-star" aria-hidden="true"></i> Donghua</span>';
      const metaChips = [item.episode, item.status]
        .filter(function(v) { return v && v !== "-"; })
        .map(function(v) { return '<span class="donghua-card-chip">' + v + '</span>'; })
        .join("");

      li.innerHTML = 
        '<article class="donghua-card">' +
          '<a class="donghua-card-link" title="' + item.title + '" href="' + item.permalink + '">' +
            '<div class="donghua-card-poster">' +
              '<img loading="lazy" decoding="async" width="200" height="300" src="' + item.thumbnail + '" alt="' + item.title + '">' +
            '</div>' +
            '<div class="donghua-card-frame" aria-hidden="true"></div>' +
            '<div class="donghua-card-badges">' +
              '<span class="donghua-card-badge">' + type + '</span>' +
            '</div>' +
            '<div class="donghua-card-body">' +
              '<h3 class="donghua-card-title">' + item.title + '</h3>' +
              '<div class="donghua-card-meta">' + metaChips + '</div>' +
              '<div class="donghua-card-footer">' +
                ratingHTML +
                '<span class="donghua-card-cta">Detail</span>' +
              '</div>' +
            '</div>' +
          '</a>' +
        '</article>';
    }

    resultsContainer.appendChild(li);
  });

  pagination.classList.toggle("hidden", totalPages <= 1);
  document.getElementById("genre-page-info").textContent = "Page " + genrePage + " of " + totalPages;

  const prevButton = document.getElementById("genre-prev");
  const nextButton = document.getElementById("genre-next");
  const prevDisabled = genrePage <= 1;
  const nextDisabled = genrePage >= totalPages;

  prevButton.disabled = prevDisabled;
  nextButton.disabled = nextDisabled;
  prevButton.setAttribute("aria-disabled", prevDisabled ? "true" : "false");
  nextButton.setAttribute("aria-disabled", nextDisabled ? "true" : "false");
}

const genrePrevBtn = document.getElementById("genre-prev");
const genreNextBtn = document.getElementById("genre-next");

if (genrePrevBtn && genreNextBtn) {
  genrePrevBtn.addEventListener("click", function() {
    if (genrePage > 1) {
      genrePage--;
      renderGenreResults();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  });

  genreNextBtn.addEventListener("click", function() {
    const totalPages = Math.ceil(genreResults.length / getGenrePerPage());
    if (genrePage < totalPages) {
      genrePage++;
      renderGenreResults();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  });
}

window.addEventListener("resize", function() {
  clearTimeout(genreResizeTimer);
  genreResizeTimer = setTimeout(function() {
    if (!genreResults.length) return;
    const totalPages = Math.max(1, Math.ceil(genreResults.length / getGenrePerPage()));
    genrePage = Math.min(genrePage, totalPages);
    renderGenreResults();
  }, 120);
});

window.addEventListener("DOMContentLoaded", function() {
  if (!resultsContainer) return;

  const selectedGenres = getGenresFromHash();
  if (!selectedGenres.length) return;

  const sourcePromise = (window.DonghuaBatchData && window.DonghuaBatchData.getIndexData) 
    ? window.DonghuaBatchData.getIndexData() 
    : fetch('/index.json').then(function(res) { return res.json(); });

  sourcePromise.then(function(data) {
    genreResults = filterByGenres(data, selectedGenres);
    genrePage = 1;
    renderGenreResults();
  }).catch(function(err) {
    console.error("[Genre Filter] index.json gagal dimuat", err);
  });
});

function normalizeGenres(input) {
  if (!input) return [];
  return input
    .toLowerCase()
    .split(/[,|]+/)
    .map(function(g) { return g.trim().replace(/\s+/g, "-"); })
    .filter(Boolean);
}

function filterByGenres(data, selectedGenres) {
  const selected = selectedGenres.map(function(g) { return g.toLowerCase(); });

  return data.filter(function(item) {
    if (!item.genre) return false;
    const itemGenres = normalizeGenres(item.genre);
    return selected.every(function(g) { return itemGenres.includes(g); });
  });
}
})();
