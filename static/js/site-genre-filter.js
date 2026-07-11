// Fungsi Toast Notification untuk alert genre
function showGenreToast(message, type = 'warning') {
  // Hapus toast yang sudah ada
  var existingToast = document.querySelector('.genre-toast-notification');
  if (existingToast) existingToast.remove();

  var toast = document.createElement('div');
  toast.className = 'genre-toast-notification genre-toast-' + type;
  toast.setAttribute('role', 'alert');
  toast.innerHTML = 
    '<div class="genre-toast-content">' +
      '<i class="fa-solid fa-circle-exclamation genre-toast-icon"></i>' +
      '<span class="genre-toast-message">' + message + '</span>' +
      '<button class="genre-toast-close" aria-label="Tutup">' +
        '<i class="fa-solid fa-xmark"></i>' +
      '</button>' +
    '</div>';

  // Styling toast inline
  toast.style.cssText = 
    'position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:9999;' +
    'background:linear-gradient(135deg,#dc2626 0%,#991b1b 100%);' +
    'color:white;padding:14px 20px;border-radius:12px;' +
    'box-shadow:0 8px 32px rgba(220,38,38,0.4),0 0 0 1px rgba(255,255,255,0.1);' +
    'font-family:system-ui,-apple-system,sans-serif;font-size:14px;font-weight:500;' +
    'max-width:90vw;animation:genreToastSlideIn 0.3s ease-out;';

  var content = toast.querySelector('.genre-toast-content');
  content.style.cssText = 'display:flex;align-items:center;gap:10px;';

  var icon = toast.querySelector('.genre-toast-icon');
  icon.style.cssText = 'font-size:18px;flex-shrink:0;';

  var msg = toast.querySelector('.genre-toast-message');
  msg.style.cssText = 'flex:1;';

  var closeBtn = toast.querySelector('.genre-toast-close');
  closeBtn.style.cssText = 
    'background:rgba(255,255,255,0.2);border:none;color:white;' +
    'width:24px;height:24px;border-radius:50%;cursor:pointer;' +
    'display:flex;align-items:center;justify-content:center;font-size:12px;' +
    'flex-shrink:0;transition:background 0.2s;';
  closeBtn.onmouseover = function() { closeBtn.style.background = 'rgba(255,255,255,0.3)'; };
  closeBtn.onmouseout = function() { closeBtn.style.background = 'rgba(255,255,255,0.2)'; };
  closeBtn.onclick = function() { toast.remove(); };

  // Tambah animasi CSS
  if (!document.getElementById('genre-toast-styles')) {
    var style = document.createElement('style');
    style.id = 'genre-toast-styles';
    style.textContent = 
      '@keyframes genreToastSlideIn{' +
        'from{opacity:0;transform:translateX(-50%) translateY(-20px);}' +
        'to{opacity:1;transform:translateX(-50%) translateY(0);}' +
      '}' +
      '@keyframes genreToastSlideOut{' +
        'from{opacity:1;transform:translateX(-50%) translateY(0);}' +
        'to{opacity:0;transform:translateX(-50%) translateY(-20px);}' +
      '}';
    document.head.appendChild(style);
  }

  document.body.appendChild(toast);

  // Auto remove setelah 4 detik
  setTimeout(function() {
    if (toast.parentElement) {
      toast.style.animation = 'genreToastSlideOut 0.3s ease-out forwards';
      setTimeout(function() { toast.remove(); }, 300);
    }
  }, 4000);
}

// Terapkan pilihan genre saat form sidebar dikirim.
function applyGenreFilter() {
  var genres = [];
  var checkboxes = document.querySelectorAll('input[name="genre"]:checked');
  checkboxes.forEach(function(cb) {
    genres.push(cb.value);
  });

  if (!genres.length) {
    showGenreToast('Silakan pilih minimal satu genre terlebih dahulu!');
    return;
  }

  window.location.href = "/filter-genre/#" + genres.join(",");
}

// Handle form submit sebagai backup
document.addEventListener('DOMContentLoaded', function() {
  var genreForm = document.getElementById("genre-filter-form");
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

var resultsContainer = document.getElementById("genre-results");
var genrePage = 1;
var genreResults = [];
var genreResizeTimer = null;

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
  var alertBox = document.getElementById("genre-alert");
  var pagination = document.getElementById("genre-pagination");

  resultsContainer.innerHTML = "";

  if (!genreResults.length) {
    alertBox.classList.remove("hidden");
    pagination.classList.add("hidden");
    return;
  }

  alertBox.classList.add("hidden");

  var genrePerPage = getGenrePerPage();
  var totalPages = Math.ceil(genreResults.length / genrePerPage);
  var start = (genrePage - 1) * genrePerPage;
  var end = start + genrePerPage;

  genreResults.slice(start, end).forEach(function(item) {
    var li = document.createElement("li");
    li.className = "donghua-card-item";
    
    if (window.DonghuaBatchCards && typeof window.DonghuaBatchCards.donghuaCardTemplate === "function") {
      li.innerHTML = window.DonghuaBatchCards.donghuaCardTemplate(item, item.title, "");
    } else if (typeof donghuaCardTemplate === "function") {
      li.innerHTML = donghuaCardTemplate(item, item.title, "");
    } else {
      var type = item.type || "Donghua";
      var ratingHTML = item.rating && item.rating !== "-"
        ? '<span class="donghua-card-rating"><i class="fa-solid fa-star" aria-hidden="true"></i> ' + item.rating + '/10</span>'
        : '<span class="donghua-card-rating"><i class="fa-solid fa-star" aria-hidden="true"></i> Donghua</span>';
      var metaChips = [item.episode, item.status]
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
              '<span class="donghua-card-badge sub">Sub</span>' +
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
  document.getElementById("genre-prev").disabled = genrePage === 1;
  document.getElementById("genre-next").disabled = genrePage === totalPages;
}

var genrePrevBtn = document.getElementById("genre-prev");
var genreNextBtn = document.getElementById("genre-next");

if (genrePrevBtn && genreNextBtn) {
  genrePrevBtn.addEventListener("click", function() {
    if (genrePage > 1) {
      genrePage--;
      renderGenreResults();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  });

  genreNextBtn.addEventListener("click", function() {
    var totalPages = Math.ceil(genreResults.length / getGenrePerPage());
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
    var totalPages = Math.max(1, Math.ceil(genreResults.length / getGenrePerPage()));
    genrePage = Math.min(genrePage, totalPages);
    renderGenreResults();
  }, 120);
});

window.addEventListener("DOMContentLoaded", function() {
  if (!resultsContainer) return;

  var selectedGenres = getGenresFromHash();
  if (!selectedGenres.length) return;

  var sourcePromise = (window.DonghuaBatchData && window.DonghuaBatchData.getIndexData) 
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
  var selected = selectedGenres.map(function(g) { return g.toLowerCase(); });

  return data.filter(function(item) {
    if (!item.genre) return false;
    var itemGenres = normalizeGenres(item.genre);
    return selected.every(function(g) { return itemGenres.includes(g); });
  });
}
