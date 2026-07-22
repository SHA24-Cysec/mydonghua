(function () {
  'use strict';

const searchInput = document.getElementById("search-input");
    const resultsList = document.getElementById("search-results");
    const emptyState = document.getElementById("search-empty-state");
    const searchSummary = document.getElementById("search-summary");
    const resultsContainerAwal = document.getElementById("genre-results");
    const searchTools = document.getElementById("search-tools");
    const sortSelect = document.getElementById("search-sort");
    const filterOpenButton = document.getElementById("search-filter-open");
    const filterDialog = document.getElementById("search-filter-dialog");
    const filterForm = document.getElementById("search-filter-form");
    const filterResetButton = document.getElementById("search-filter-reset");
    const filterCount = document.getElementById("search-filter-active-count");
    const searchDiscovery = document.getElementById("search-discovery");
    const historyBlock = document.getElementById("search-history-block");
    const historyList = document.getElementById("search-history-list");
    const popularList = document.getElementById("popular-search-list");
    const filterKeys = ["status", "type", "genre", "studio", "season"];
    const filterLabels = {
      status: "status",
      type: "tipe",
      genre: "genre",
      studio: "studio",
      season: "season"
    };

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

      if (searchInput) {
        searchIndexPromise.then(function () {
          populateFilterOptions();
          syncFilterControls();
        });
      }
    }

    let currentPage = 1;
    let currentResults = [];
    let activeSort = "relevance";
    let activeFilters = { status: "", type: "", genre: "", studio: "", season: "" };
    const SEARCH_DEBOUNCE_MS = 180;
    const SEARCH_HISTORY_KEY = "donghuabatch_search_history";
    const SEARCH_HISTORY_LIMIT = 8;
    const SEARCH_HISTORY_COMMIT_DELAY = 700;
    const POPULAR_SEARCHES = [
      "Battle Through the Heavens",
      "Soul Land",
      "Perfect World",
      "Swallowed Star",
      "Throne of Seal",
      "Renegade Immortal",
      "Shrouding the Heavens",
      "Martial Master"
    ];
    let searchInputTimer = null;
    let searchHistoryTimer = null;
    let searchRequestId = 0;

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

    // Escape HTML supaya nilai teks aman saat di-inject via innerHTML.
    // Pola sama dengan escapeHTML() di site-favorites.js agar konsisten.
    function escapeHTML(value) {
      return toText(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
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
      // Selalu kembalikan HTML yang sudah di-escape. Segmen teks di-escape
      // sebelum disisipkan, sedangkan tag <mark> tetap HTML asli (untuk highlight).
      if (!matches || !source) return escapeHTML(source);

      const relevantMatches = matches.filter(match => match.key === key && Array.isArray(match.indices));
      if (!relevantMatches.length) return escapeHTML(source);

      const indices = relevantMatches
        .flatMap(match => match.indices)
        .sort((a, b) => a[0] - b[0]);

      let highlighted = "";
      let lastIndex = 0;

      indices.forEach(([start, end]) => {
        if (start < lastIndex) return;
        highlighted += escapeHTML(source.slice(lastIndex, start));
        highlighted += `<mark>${escapeHTML(source.slice(start, end + 1))}</mark>`;
        lastIndex = end + 1;
      });

      highlighted += escapeHTML(source.slice(lastIndex));
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
      // Semua nilai berikut disisipkan via innerHTML, jadi di-escape untuk cegah XSS.
      // Catatan: titleHTML & extraMetaHTML sudah berupa HTML aman dari highlightText().
      const type = escapeHTML(item.type) || "Donghua";
      const episode = escapeHTML(item.episode);
      const status = escapeHTML(item.status);
      const rating = escapeHTML(item.rating);
      const permalink = escapeHTML(item.permalink);
      const title = escapeHTML(item.title);

      // Thumbnail asli tunggal — tanpa srcset atau varian hasil resize.
      const thumbSrc = escapeHTML(item.thumbnail || "");

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
        /* Hasil pencarian sering berubah; hindari skeleton wrapper yang membuat
           poster fade-in lagi pada setiap query. */
        imgTag = `<img data-no-loader="true" loading="lazy" decoding="async" src="${thumbSrc}" alt="${title}"`;
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

    function loadSearchHistory() {
      try {
        const raw = window.localStorage.getItem(SEARCH_HISTORY_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(parsed)) return [];
        return parsed
          .map(function (value) { return toText(value).trim(); })
          .filter(function (value) { return value.length >= 3; })
          .slice(0, SEARCH_HISTORY_LIMIT);
      } catch (error) {
        return [];
      }
    }

    function saveSearchHistory(items) {
      try {
        window.localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(items.slice(0, SEARCH_HISTORY_LIMIT)));
      } catch (error) {
        /* History is optional when storage is unavailable. */
      }
    }

    function suggestionChip(query, kind) {
      const safeQuery = escapeHTML(query);
      const icon = kind === "history" ? "fa-clock-rotate-left" : "fa-fire";
      return '<button class="search-discovery-chip ' + (kind === "history" ? "is-history" : "is-popular") + '" type="button" data-search-suggestion="' + safeQuery + '" title="Cari ' + safeQuery + '"><i class="fa-solid ' + icon + '" aria-hidden="true"></i><span>' + safeQuery + '</span></button>';
    }

    function renderSearchDiscovery() {
      if (!searchDiscovery || !popularList) return;

      const history = loadSearchHistory();
      popularList.innerHTML = POPULAR_SEARCHES.map(function (query) {
        return suggestionChip(query, "popular");
      }).join("");

      if (historyBlock && historyList) {
        historyBlock.hidden = history.length === 0;
        historyList.innerHTML = history.map(function (query) {
          return suggestionChip(query, "history");
        }).join("");
        searchDiscovery.classList.toggle("has-history", history.length > 0);
      }
    }

    function updateSearchDiscovery(query) {
      if (!searchDiscovery) return;
      const shouldShow = !toText(query).trim();
      if (!shouldShow) {
        searchDiscovery.hidden = true;
        return;
      }

      renderSearchDiscovery();
      searchDiscovery.hidden = false;
    }

    function recordSearchHistory(query) {
      const value = toText(query).trim().replace(/\s+/g, " ");
      if (value.length < 3) return;

      const normalized = normalizeForSearch(value);
      const history = loadSearchHistory().filter(function (saved) {
        return normalizeForSearch(saved) !== normalized;
      });
      history.unshift(value);
      saveSearchHistory(history);
    }

    function scheduleSearchHistory(query) {
      window.clearTimeout(searchHistoryTimer);
      if (toText(query).trim().length < 3) return;
      searchHistoryTimer = window.setTimeout(function () {
        const latestQuery = searchInput ? searchInput.value.trim() : query;
        if (latestQuery.length >= 3) recordSearchHistory(latestQuery);
      }, SEARCH_HISTORY_COMMIT_DELAY);
    }

    function getFilterValues(item, key) {
      let raw = "";
      if (key === "genre") raw = item.genre;
      else if (key === "studio") raw = item.studio;
      else raw = item[key];

      return toText(raw)
        .split(",")
        .map(function (value) { return value.trim(); })
        .filter(function (value) { return value && value !== "-"; });
    }

    function normalizeFilterValue(value) {
      return normalizeForSearch(value).trim();
    }

    function getActiveFilterCount() {
      return filterKeys.filter(function (key) { return Boolean(activeFilters[key]); }).length;
    }

    function populateFilterOptions() {
      if (!filterForm || !searchIndexData.length) return;

      filterKeys.forEach(function (key) {
        const select = filterForm.querySelector('[data-search-filter="' + key + '"]');
        if (!select) return;

        const unique = new Map();
        searchIndexData.forEach(function (item) {
          getFilterValues(item, key).forEach(function (value) {
            const normalized = normalizeFilterValue(value);
            if (normalized && !unique.has(normalized)) unique.set(normalized, value);
          });
        });

        const values = Array.from(unique.values()).sort(function (a, b) {
          return a.localeCompare(b, "id", { sensitivity: "base" });
        });
        const defaultLabel = "Semua " + filterLabels[key];
        select.innerHTML = '<option value="">' + escapeHTML(defaultLabel) + '</option>' + values.map(function (value) {
          const safe = escapeHTML(value);
          return '<option value="' + safe + '">' + safe + '</option>';
        }).join("");
      });
    }

    function syncFilterControls() {
      if (sortSelect) sortSelect.value = activeSort;
      if (filterForm) {
        filterKeys.forEach(function (key) {
          const select = filterForm.querySelector('[data-search-filter="' + key + '"]');
          if (select) select.value = activeFilters[key] || "";
        });
      }
      updateFilterCountUI();
    }

    function updateFilterCountUI() {
      const total = getActiveFilterCount();
      if (filterCount) {
        filterCount.textContent = String(total);
        filterCount.hidden = total === 0;
      }
    }

    function updateSearchTools(query) {
      if (!searchTools) return;
      const isUsableQuery = toText(query).trim().length >= 3;
      searchTools.hidden = !isUsableQuery;
      if (isUsableQuery) syncFilterControls();
    }

    function itemMatchesFilters(item) {
      return filterKeys.every(function (key) {
        const selected = activeFilters[key];
        if (!selected) return true;
        const wanted = normalizeFilterValue(selected);
        return getFilterValues(item, key).some(function (value) {
          return normalizeFilterValue(value) === wanted;
        });
      });
    }

    function sortSearchResults(results) {
      if (activeSort === "relevance") return results;

      return results.slice().sort(function (a, b) {
        if (activeSort === "newest") {
          const aDate = Date.parse(a.item.date || "") || 0;
          const bDate = Date.parse(b.item.date || "") || 0;
          if (bDate !== aDate) return bDate - aDate;
        } else if (activeSort === "rating") {
          const aRating = parseFloat(a.item.rating) || 0;
          const bRating = parseFloat(b.item.rating) || 0;
          if (bRating !== aRating) return bRating - aRating;
        }

        return toText(a.item.title).localeCompare(toText(b.item.title), "id", { sensitivity: "base" });
      });
    }

    function buildSearchResults(query) {
      return sortSearchResults(searchItems(query).filter(function (entry) {
        return itemMatchesFilters(entry.item);
      }));
    }

    function openFilterDialog() {
      if (!filterDialog) return;
      ensureSearchIndexReady().then(function () {
        populateFilterOptions();
        syncFilterControls();
        filterDialog.hidden = false;
        filterDialog.setAttribute("aria-hidden", "false");
        document.body.classList.add("search-filter-lock");
        if (filterOpenButton) filterOpenButton.setAttribute("aria-expanded", "true");
        const firstControl = filterForm && filterForm.querySelector("select");
        if (firstControl) firstControl.focus();
      });
    }

    function closeFilterDialog() {
      if (!filterDialog) return;
      filterDialog.hidden = true;
      filterDialog.setAttribute("aria-hidden", "true");
      document.body.classList.remove("search-filter-lock");
      if (filterOpenButton) {
        filterOpenButton.setAttribute("aria-expanded", "false");
        filterOpenButton.focus();
      }
    }

    function readFiltersFromControls() {
      if (!filterForm) return;
      filterKeys.forEach(function (key) {
        const select = filterForm.querySelector('[data-search-filter="' + key + '"]');
        activeFilters[key] = select ? toText(select.value).trim() : "";
      });
    }

    function rerunCurrentSearch(resetPage) {
      const query = searchInput ? searchInput.value.trim() : "";
      if (query.length < 3) {
        updateSearchTools(query);
        return;
      }

      currentResults = buildSearchResults(query);
      if (resetPage) currentPage = 1;
      const perPage = getSearchPerPage();
      const totalPages = Math.max(1, Math.ceil(currentResults.length / perPage));
      currentPage = Math.min(currentPage, totalPages);
      updateURL(query, currentPage);
      renderResults();
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
      const safeQuery = escapeHTML(trimmedQuery);

      const activeFilterTotal = getActiveFilterCount();
      const filterNote = activeFilterTotal ? ' <span class="search-summary-filter"><i class="fa-solid fa-filter" aria-hidden="true"></i> ' + activeFilterTotal + ' filter aktif</span>' : "";
      searchSummary.hidden = false;
      searchSummary.innerHTML = `<strong>${total}</strong> donghua ditemukan untuk kata kunci <strong>“${safeQuery}”</strong>.${filterNote}`;
    }

    function clearSearchResults() {
      if (resultsList) {
        resultsList.replaceChildren();
        resultsList.setAttribute("aria-busy", "false");
      }
      if (emptyState) emptyState.hidden = true;
      if (searchSummary) {
        searchSummary.hidden = true;
        searchSummary.innerHTML = "";
      }
      currentResults = [];
      updateSearchTools("");
      updateSearchDiscovery("");

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
      const activeQuery = searchInput ? searchInput.value : "";
      updateSearchSummary(activeQuery);
      updateSearchTools(activeQuery);
      updateSearchDiscovery(activeQuery);

      if (!currentResults.length) {
        resultsList.replaceChildren();
        resultsList.setAttribute("aria-busy", "false");
        if (emptyState) emptyState.hidden = false;
        updatePagination();
        return;
      }

      if (emptyState) emptyState.hidden = true;

      const perPage = getSearchPerPage();
      const start = (currentPage - 1) * perPage;
      const end = start + perPage;
      const pageItems = currentResults.slice(start, end);
      const fragment = document.createDocumentFragment();

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
        fragment.appendChild(li);
      });

      /* Ganti seluruh daftar dalam satu operasi DOM agar browser tidak
         sempat melukis kondisi kosong di antara hasil lama dan baru. */
      resultsList.replaceChildren(fragment);
      resultsList.setAttribute("aria-busy", "false");

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

      recordSearchHistory(query);
      currentResults = buildSearchResults(query);

      const perPage = getSearchPerPage();
      const totalPages = Math.max(1, Math.ceil(currentResults.length / perPage));
      currentPage = Math.min(Math.max(page, 1), totalPages);
      renderResults();
    }

    function runInputSearch(query, requestId) {
      if (!query) {
        clearSearchResults();
        updateURL("");
        return;
      }

      // Mode Strict: query terlalu pendek (< 3 huruf) tidak dicari.
      if (query.length < 3) {
        clearSearchResults();
        showSearchHint("Ketik minimal <strong>3 huruf</strong> untuk memulai pencarian.");
        updateURL("");
        return;
      }

      /* Jangan kosongkan daftar saat pengguna masih mengetik. Hasil lama
         tetap stabil sampai index siap dan hasil baru bisa diganti atomik. */
      if (resultsList) resultsList.setAttribute("aria-busy", "true");

      ensureSearchIndexReady().then(function () {
        const currentQuery = searchInput ? searchInput.value.trim() : "";
        if (requestId !== searchRequestId || currentQuery !== query) return;

        currentResults = buildSearchResults(query);
        currentPage = 1;
        updateURL(query, currentPage);
        renderResults();
      });
    }

    if (searchInput && resultsList) {
      searchInput.addEventListener("input", () => {
        const query = searchInput.value.trim();
        const requestId = ++searchRequestId;

        updateSearchDiscovery(query);
        scheduleSearchHistory(query);
        window.clearTimeout(searchInputTimer);
        searchInputTimer = window.setTimeout(function () {
          runInputSearch(query, requestId);
        }, SEARCH_DEBOUNCE_MS);
      });

      if (searchDiscovery) {
        searchDiscovery.addEventListener("click", function (event) {
          const suggestion = event.target.closest("[data-search-suggestion]");
          if (!suggestion || !searchInput) return;
          const query = toText(suggestion.getAttribute("data-search-suggestion")).trim();
          if (!query) return;
          searchInput.value = query;
          searchInput.focus();
          searchInput.dispatchEvent(new Event("input", { bubbles: true }));
        });
      }

      if (sortSelect) {
        sortSelect.addEventListener("change", function () {
          activeSort = sortSelect.value || "relevance";
          rerunCurrentSearch(true);
        });
      }

      if (filterOpenButton) {
        filterOpenButton.addEventListener("click", openFilterDialog);
      }

      document.querySelectorAll("[data-search-filter-close]").forEach(function (button) {
        button.addEventListener("click", closeFilterDialog);
      });

      if (filterResetButton) {
        filterResetButton.addEventListener("click", function () {
          activeFilters = { status: "", type: "", genre: "", studio: "", season: "" };
          syncFilterControls();
        });
      }

      if (filterForm) {
        filterForm.addEventListener("submit", function (event) {
          event.preventDefault();
          readFiltersFromControls();
          closeFilterDialog();
          rerunCurrentSearch(true);
        });
      }

      document.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && filterDialog && !filterDialog.hidden) {
          closeFilterDialog();
        }
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
        if (!q) {
          updateSearchDiscovery("");
          return;
        }

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
})();
