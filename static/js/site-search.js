const searchInput = document.getElementById("search-input");
    const resultsList = document.getElementById("search-results");
    const emptyState = document.getElementById("search-empty-state");
    const searchSummary = document.getElementById("search-summary");
    const resultsContainerAwal = document.getElementById("genre-results");

    let searchIndexData = [];
    let searchIndexPromise = null;

    
    if (searchInput || resultsContainerAwal) {
      searchIndexPromise = fetch('/index.json')
        .then(res => {
          if (!res.ok) {
            throw new Error(`Gagal memuat index.json (${res.status})`);
          }
          return res.json();
        })
        .then(data => {
          searchIndexData = Array.isArray(data) ? data : [];
          return searchIndexData;
        })
        .catch(err => {
          console.error("[Search] index.json gagal dimuat", err);
          searchIndexData = [];
          return searchIndexData;
        });
    }

    let currentPage = 1;
    let currentResults = [];

    function getSearchPerPage() {
      if (window.matchMedia('(min-width: 1024px)').matches) return 15;
      if (window.matchMedia('(min-width: 700px)').matches) return 12;
      if (window.matchMedia('(min-width: 640px)').matches) return 12;
      return 10;
    }

    function toText(value) {
      if (Array.isArray(value)) {
        return value.filter(Boolean).join(", ");
      }
      return value == null ? "" : String(value);
    }

    function normalizeForSearch(value) {
      return toText(value)
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
    }

    function mergeRanges(ranges) {
      if (!ranges.length) return [];
      const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
      const merged = [sorted[0]];

      for (let i = 1; i < sorted.length; i++) {
        const [start, end] = sorted[i];
        const last = merged[merged.length - 1];

        if (start <= last[1] + 1) {
          last[1] = Math.max(last[1], end);
        } else {
          merged.push([start, end]);
        }
      }

      return merged;
    }

    function escapeRegExp(value) {
      return toText(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    function getTitleSearchSource(text) {
      const source = toText(text);
      let start = 0;
      let end = source.length;

      const prefixMatch = source.match(/^download\s+batch\s+/i);
      if (prefixMatch) {
        start = prefixMatch[0].length;
      }

      const suffixPatterns = [
        /\s+subtitle\s+indonesia\s*$/i,
        /\s+sub\s+indo(?:nesia)?\s*$/i
      ];

      let sliced = source.slice(start, end);
      for (const pattern of suffixPatterns) {
        const match = sliced.match(pattern);
        if (match) {
          end = start + sliced.length - match[0].length;
          sliced = source.slice(start, end);
          break;
        }
      }

      const trimmed = sliced.trim();
      const offset = trimmed ? sliced.indexOf(trimmed) : 0;

      return {
        source,
        core: trimmed || sliced || source,
        start: start + Math.max(offset, 0)
      };
    }

    // PREFIX / WORD-START matching: keyword harus ada di AWAL kata atau
    // sama dengan kata utuh (case-insensitive). 'batt' -> "Battle",
    // 'per' -> "Perfect"/"Person" TAPI TIDAK "Supernatural"/"Temple".
    // Lebih longgar dari whole-word, tapi tetap bebas noise substring
    // di tengah kata.
    function findPrefixRanges(source, keyword, offset = 0) {
      const hay = toText(source).toLowerCase();
      const needle = keyword.toLowerCase();
      const ranges = [];
      if (!hay || !needle) return ranges;

      const wordRegex = /[a-z0-9]+/g;
      let match;
      while ((match = wordRegex.exec(hay)) !== null) {
        if (match[0].startsWith(needle)) {
          const idx = match.index;
          ranges.push([offset + idx, offset + idx + needle.length - 1]);
        }
      }
      return ranges;
    }

    function findTitleKeywordRanges(text, keyword) {
      const { core, start } = getTitleSearchSource(text);
      return findPrefixRanges(core, keyword, start);
    }

    function findKeywordRanges(text, keyword) {
      return findPrefixRanges(text, keyword, 0);
    }

    function highlightText(text, matches, key) {
      const source = toText(text);
      if (!matches || !source) return source;

      const relevantMatches = matches.filter(match => match.key === key && Array.isArray(match.indices));
      if (!relevantMatches.length) return source;

      const indices = relevantMatches
        .flatMap(match => match.indices)
        .sort((a, b) => a[0] - b[0]);

      let highlighted = "";
      let lastIndex = 0;

      indices.forEach(([start, end]) => {
        if (start < lastIndex) return;
        highlighted += source.slice(lastIndex, start);
        highlighted += `<mark>${source.slice(start, end + 1)}</mark>`;
        lastIndex = end + 1;
      });

      highlighted += source.slice(lastIndex);
      return highlighted;
    }

    function getSearchableFields(item) {
      return {
        title: getTitleSearchSource(item.title).core,
        studio: toText(item.studio),
        season: toText(item.season),
        genre: toText(item.genre)
      };
    }

    function buildMatches(fieldRanges) {
      return Object.entries(fieldRanges)
        .filter(([, ranges]) => ranges.length)
        .map(([key, ranges]) => ({
          key,
          indices: mergeRanges(ranges)
        }));
    }

    function scoreExactFieldMatch(fieldKey, fieldText, keyword) {
      const normalizedText = normalizeForSearch(fieldText);
      const startsWithKeyword = normalizedText.startsWith(keyword);

      if (fieldKey === "title") {
        return startsWithKeyword ? 145 : 120;
      }
      if (fieldKey === "studio") return startsWithKeyword ? 72 : 58;
      if (fieldKey === "genre") return startsWithKeyword ? 66 : 52;
      if (fieldKey === "season") return startsWithKeyword ? 48 : 40;
      return 0;
    }

    function searchItems(query) {
      const keywords = parseKeywords(query);
      if (!keywords.length) return [];

      const results = [];

      searchIndexData.forEach(item => {
        const fields = getSearchableFields(item);
        const fieldRanges = {
          title: [],
          studio: [],
          season: [],
          genre: []
        };
        let score = 0;

        // STRICT MODE (prefix / word-start): keyword harus ada di AWAL
        // kata atau = kata utuh (case-insensitive). Tidak ada fuzzy /
        // typo-tolerance, dan tidak ada substring di tengah kata.
        // Semua bidang (title, studio, season, genre) diuji dengan aturan
        // yang sama. Multi-kata = AND.
        const matchesAllKeywords = keywords.every(keyword => {
          let keywordMatched = false;
          let bestKeywordScore = 0;

          Object.entries(fields).forEach(([fieldKey, fieldText]) => {
            if (!fieldText) return;

            const ranges = fieldKey === "title"
              ? findTitleKeywordRanges(item.title, keyword)
              : findKeywordRanges(fieldText, keyword);

            if (ranges.length) {
              keywordMatched = true;
              fieldRanges[fieldKey].push(...ranges);
              bestKeywordScore = Math.max(bestKeywordScore, scoreExactFieldMatch(fieldKey, fieldText, keyword));
            }
          });

          if (keywordMatched) {
            score += bestKeywordScore;
          }

          return keywordMatched;
        });

        if (matchesAllKeywords) {
          results.push({
            item,
            matches: buildMatches(fieldRanges),
            score
          });
        }
      });

      return results.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return toText(a.item.title).localeCompare(toText(b.item.title));
      });
    }

    function donghuaCardTemplate(item, titleHTML, extraMetaHTML) {
      const type = toText(item.type) || "Donghua";
      const episode = toText(item.episode);
      const status = toText(item.status);
      const rating = toText(item.rating);
      const permalink = toText(item.permalink);
      const title = toText(item.title);

      // Thumbnail – srcset/WebP – sama seperti donghua-card.html / site-favorites.js
      const thumbFallback = toText(item.thumbnail || "");
      const thumbSmall = toText(item.thumbnail_small || thumbFallback);
      const thumbMedium = toText(item.thumbnail_medium || "");
      let thumbSrcset = toText(item.thumbnail_srcset || "");
      if (!thumbSrcset && thumbSmall && thumbMedium) {
        thumbSrcset = thumbSmall + " 240w, " + thumbMedium + " 400w";
      }
      const thumbSrc = thumbSmall || thumbFallback;

      const metaChips = [episode, status]
        .filter(value => value && value !== "-")
        .map(value => `<span class="donghua-card-chip">${value}</span>`)
        .join("");

      const ratingHTML = rating && rating !== "-"
        ? `<span class="donghua-card-rating"><i class="fa-solid fa-star" aria-hidden="true"></i> ${rating}/10</span>`
        : `<span class="donghua-card-rating"><i class="fa-solid fa-star" aria-hidden="true"></i> Donghua</span>`;

      const extraMeta = extraMetaHTML ? `<div class="donghua-card-search-meta">${extraMetaHTML}</div>` : "";

      // Bookmark – cek status favorit via DonghuaFav (kalau sudah load)
      const favId = permalink;
      let saved = false;
      try {
        if (window.DonghuaFav && window.DonghuaFav.isSaved) {
          saved = window.DonghuaFav.isSaved(favId);
        } else {
          const raw = localStorage.getItem('donghuabatch_favorites');
          if (raw) {
            const ids = JSON.parse(raw);
            saved = Array.isArray(ids) && ids.indexOf(favId) !== -1;
          }
        }
      } catch(e) {}
      const bookmarkClass = saved ? "donghua-card-bookmark is-saved" : "donghua-card-bookmark";
      const bookmarkLabel = saved ? "Hapus dari favorit" : "Simpan ke favorit";
      const bookmarkIcon = saved
        ? '<path d="M5 3h14a1 1 0 0 1 1 1v17l-8-4-8 4V4a1 1 0 0 1 1-1z" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>'
        : '<path d="M5 3h14a1 1 0 0 1 1 1v17l-8-4-8 4V4a1 1 0 0 1 1-1z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>';

      let imgTag = "";
      if (thumbSrc) {
        imgTag = `<img loading="lazy" decoding="async" src="${thumbSrc}" alt="${title.replace(/"/g, '&quot;')}"`;
        if (thumbSrcset) {
          imgTag += ` srcset="${thumbSrcset}" sizes="(max-width:340px) 90vw, (max-width:640px) 45vw, (max-width:1024px) 22vw, 280px"`;
        }
        imgTag += ` width="240" height="320">`;
      }

      return `
        <article class="donghua-card">
          <button class="${bookmarkClass}" data-fav-id="${permalink}" type="button" aria-label="${bookmarkLabel}" title="${saved ? "Hapus" : "Simpan"}">
            <svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true">${bookmarkIcon}</svg>
          </button>
          <a class="donghua-card-link" title="${title}" href="${permalink}">
            <div class="donghua-card-poster">
              ${imgTag}
            </div>
            <div class="donghua-card-frame" aria-hidden="true"></div>
            <div class="donghua-card-badges">
              <span class="donghua-card-badge">${type}</span>
              <span class="donghua-card-badge sub">Sub</span>
            </div>
            <div class="donghua-card-body">
              <h3 class="donghua-card-title">${titleHTML || title}</h3>
              ${extraMeta}
              <div class="donghua-card-meta">${metaChips}</div>
              <div class="donghua-card-footer">
                ${ratingHTML}
                <span class="donghua-card-cta">Detail</span>
              </div>
            </div>
          </a>
        </article>
      `;
    }

    function updateSearchSummary(query) {
      if (!searchSummary) return;

      const trimmedQuery = toText(query).trim();
      if (!trimmedQuery) {
        searchSummary.hidden = true;
        searchSummary.innerHTML = "";
        return;
      }

      const total = currentResults.length;
      const safeQuery = trimmedQuery
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");

      searchSummary.hidden = false;
      searchSummary.innerHTML = `<strong>${total}</strong> donghua ditemukan untuk kata kunci <strong>“${safeQuery}”</strong>.`;
    }

    function clearSearchResults() {
      if (resultsList) resultsList.innerHTML = "";
      if (emptyState) emptyState.hidden = true;
      if (searchSummary) {
        searchSummary.hidden = true;
        searchSummary.innerHTML = "";
      }
      currentResults = [];

      const pagination = document.getElementById("search-pagination");
      if (pagination) pagination.style.display = "none";
    }

    // Tampilkan pesan petunjuk (mis. query terlalu pendek) lewat panel
    // #search-summary yang sudah ada, agar konsisten dengan tema.
    function showSearchHint(message) {
      if (!searchSummary) return;
      searchSummary.hidden = false;
      searchSummary.innerHTML = message;
    }

    function renderResults() {
      if (!resultsList) return;
      resultsList.innerHTML = "";
      updateSearchSummary(searchInput ? searchInput.value : "");

      if (!currentResults.length) {
        if (emptyState) emptyState.hidden = false;
        updatePagination();
        return;
      }

      if (emptyState) emptyState.hidden = true;

      const perPage = getSearchPerPage();
      const start = (currentPage - 1) * perPage;
      const end = start + perPage;
      const pageItems = currentResults.slice(start, end);

      pageItems.forEach(({ item, matches }) => {
        const li = document.createElement("li");

        const rawStudio = toText(item.studio);
        const rawSeason = toText(item.season);
        const rawGenre = toText(item.genre);

        const title = highlightText(item.title, matches, "title");
        const studio = rawStudio && rawStudio !== "-" ? highlightText(rawStudio, matches, "studio") : "";
        const season = rawSeason && rawSeason !== "-" ? highlightText(rawSeason, matches, "season") : "";
        const genre = rawGenre && rawGenre !== "-" ? highlightText(rawGenre, matches, "genre") : "";
        const metaStr = [studio, season, genre].filter(Boolean).join(" • ");

        li.className = "donghua-card-item";
        li.innerHTML = donghuaCardTemplate(item, title, metaStr);
        resultsList.appendChild(li);
      });

      updatePagination();
      // Sync bookmark buttons – sama seperti di halaman Favorit
      try {
        if (window.DonghuaFav && window.DonghuaFav.syncAllButtons) {
          window.DonghuaFav.syncAllButtons();
        }
      } catch(e) {}
    }

    function updatePagination() {
      const pagination = document.getElementById("search-pagination");
      const pageInfo = document.getElementById("page-info");
      const prevButton = document.getElementById("prev-page");
      const nextButton = document.getElementById("next-page");
      const perPage = getSearchPerPage();
      const totalPages = Math.ceil(currentResults.length / perPage);

      if (!pagination || !pageInfo || !prevButton || !nextButton) return;

      if (!currentResults.length || totalPages <= 1) {
        pagination.style.display = "none";
        return;
      }

      pagination.style.display = "flex";
      pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
      const prevDisabled = currentPage <= 1;
      const nextDisabled = currentPage >= totalPages;
      prevButton.disabled = prevDisabled;
      nextButton.disabled = nextDisabled;
      prevButton.setAttribute("aria-disabled", prevDisabled ? "true" : "false");
      nextButton.setAttribute("aria-disabled", nextDisabled ? "true" : "false");
    }

    function parseGenres(input) {
      return input
        .toLowerCase()
        .split(/[, ]+/)
        .map(g => g.trim())
        .filter(Boolean);
    }

    function parseKeywords(input) {
      return input
        .toLowerCase()
        .split(/[, ]+/)
        .map(k => k.trim())
        .filter(Boolean);
    }

    function getQueryFromURL() {
      const params = new URLSearchParams(window.location.search);
      return {
        q: params.get("q") || "",
        page: parseInt(params.get("page"), 10) || 1
      };
    }

    function updateURL(query, page = 1) {
      const params = new URLSearchParams(window.location.search);

      if (query) {
        params.set("q", query);
        params.set("page", page);
      } else {
        params.delete("q");
        params.delete("page");
      }

      const newUrl =
        window.location.pathname +
        (params.toString() ? `?${params.toString()}` : "");

      window.history.replaceState({}, "", newUrl);
    }

    function ensureSearchIndexReady() {
      return searchIndexPromise || Promise.resolve(searchIndexData);
    }

    function triggerSearchFromURL(query, page) {
      const keywords = parseKeywords(query);
      if (!keywords.length) {
        clearSearchResults();
        return;
      }

      // Sama seperti handler input: query < 3 huruf diblokir supaya
      // tidak muncul noise saat dibuka lewat URL (?q=...).
      if (query.trim().length < 3) {
        clearSearchResults();
        showSearchHint("Ketik minimal <strong>3 huruf</strong> untuk memulai pencarian.");
        return;
      }

      currentResults = searchItems(query);

      const perPage = getSearchPerPage();
      const totalPages = Math.max(1, Math.ceil(currentResults.length / perPage));
      currentPage = Math.min(Math.max(page, 1), totalPages);
      renderResults();
    }

    if (searchInput && resultsList) {
      searchInput.addEventListener("input", async () => {
        const query = searchInput.value.trim();

        clearSearchResults();

        if (!query) {
          updateURL("");
          return;
        }

        // Mode Strict: query terlalu pendek (< 3 huruf) tidak dicari,
        // supaya tidak memunculkan noise substring (mis. "pe" cocok di
        // tengah kata seperti "Temple"/"Apex").
        if (query.length < 3) {
          showSearchHint("Ketik minimal <strong>3 huruf</strong> untuk memulai pencarian.");
          updateURL("");
          return;
        }

        await ensureSearchIndexReady();
        currentResults = searchItems(query);
        currentPage = 1;
        updateURL(query, currentPage);
        renderResults();
      });

      document.getElementById("prev-page").addEventListener("click", () => {
        if (currentPage > 1) {
          currentPage--;
          updateURL(searchInput.value.trim(), currentPage);
          renderResults();
        }
      });

      document.getElementById("next-page").addEventListener("click", () => {
        const perPage = getSearchPerPage();
        const totalPages = Math.ceil(currentResults.length / perPage);
        if (currentPage < totalPages) {
          currentPage++;
          updateURL(searchInput.value.trim(), currentPage);
          renderResults();
        }
      });

      window.addEventListener("DOMContentLoaded", async () => {
        const { q, page } = getQueryFromURL();
        if (!q) return;

        searchInput.value = q;
        await ensureSearchIndexReady();
        triggerSearchFromURL(q, page);
      });

      let resizeTimer;
      window.addEventListener("resize", () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          if (!searchInput || !searchInput.value.trim() || !currentResults.length) return;
          const perPage = getSearchPerPage();
          const totalPages = Math.max(1, Math.ceil(currentResults.length / perPage));
          currentPage = Math.min(currentPage, totalPages);
          updateURL(searchInput.value.trim(), currentPage);
          renderResults();
        }, 120);
      });
    }


window.DonghuaBatchData = window.DonghuaBatchData || {};
window.DonghuaBatchData.getIndexData = function () {
  return searchIndexPromise || fetch('/index.json').then(function (res) { return res.json(); });
};
window.DonghuaBatchCards = window.DonghuaBatchCards || {};
window.DonghuaBatchCards.donghuaCardTemplate = donghuaCardTemplate;

// Diekspos supaya halaman filter genre memakai jumlah item per halaman
// yang sama persis (adaptif sesuai lebar layar) dengan halaman pencarian.
window.DonghuaSearch = window.DonghuaSearch || {};
window.DonghuaSearch.getPerPage = getSearchPerPage;
