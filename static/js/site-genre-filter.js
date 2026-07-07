const genreForm = document.getElementById("genre-filter-form");

if (genreForm) {
  genreForm.addEventListener("submit", e => {
    e.preventDefault();

    const genres = [...document.querySelectorAll('input[name="genre"]:checked')]
      .map(i => i.value);

    if (!genres.length) return;

    window.location.href = "/filter-genre/#" + genres.join(",");
  });
}

function getGenresFromHash() {
  return location.hash
    .replace("#", "")
    .split(",")
    .map(g => g.trim().toLowerCase())
    .filter(Boolean);
}

const resultsContainer = document.getElementById("genre-results");


let genrePage = 1;
const genrePerPage = 12;
let genreResults = [];


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

  const totalPages = Math.ceil(genreResults.length / genrePerPage);
  const start = (genrePage - 1) * genrePerPage;
  const end = start + genrePerPage;

  genreResults.slice(start, end).forEach(item => {
    
    const li = document.createElement("li");
    li.className = "donghua-card-item";
    li.innerHTML = donghuaCardTemplate(item, item.title, "");

    resultsContainer.appendChild(li);
  });

  // Pagination UI
  pagination.classList.toggle("hidden", totalPages <= 1);
  document.getElementById("genre-page-info").textContent =
    `Page ${genrePage} of ${totalPages}`;

  document.getElementById("genre-prev").disabled = genrePage === 1;
  document.getElementById("genre-next").disabled = genrePage === totalPages;
}


const genrePrevBtn = document.getElementById("genre-prev");
const genreNextBtn = document.getElementById("genre-next");

if (genrePrevBtn && genreNextBtn) {
  genrePrevBtn.addEventListener("click", () => {
    if (genrePage > 1) {
      genrePage--;
      renderGenreResults();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  });

  genreNextBtn.addEventListener("click", () => {
    const totalPages = Math.ceil(genreResults.length / genrePerPage);
    if (genrePage < totalPages) {
      genrePage++;
      renderGenreResults();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  });
}

window.addEventListener("DOMContentLoaded", () => {
  
  if (!resultsContainer) return;

  const selectedGenres = getGenresFromHash();
  if (!selectedGenres.length) return;

  const sourcePromise = (window.DonghuaBatchData && window.DonghuaBatchData.getIndexData) ? window.DonghuaBatchData.getIndexData() : fetch('/index.json').then(res => res.json());

  sourcePromise.then(data => {
    genreResults = filterByGenres(data, selectedGenres);
    genrePage = 1;
    
    renderGenreResults();
  }).catch(err => {
    console.error("[Genre Filter] index.json gagal dimuat", err);
  });
});

function normalizeGenres(input) {
  if (!input) return [];

  
  return input
    .toLowerCase()
    .split(/[,|]+/)
    .map(g => g.trim().replace(/\s+/g, "-"))
    .filter(Boolean);
}

function filterByGenres(data, selectedGenres) {
  const selected = selectedGenres.map(g => g.toLowerCase());

  return data.filter(item => {
    if (!item.genre) return false;

    const itemGenres = normalizeGenres(item.genre);

    // AND logic → semua genre harus ada
    return selected.every(g => itemGenres.includes(g));
  });
}
