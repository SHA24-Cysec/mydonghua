(function () {
  'use strict';

  function toText(value) {
    if (Array.isArray(value)) {
      return value.filter(Boolean).join(", ");
    }
    return value == null ? "" : String(value);
  }

  function escapeHTML(value) {
    return toText(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function cardTypeLabel(value) {
    const label = toText(value).trim();
    return label.toLowerCase() === "donghua movie" ? "Movie" : label;
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

  function cardTitleLabel(value) {
    const source = toText(value);
    if (!source) return "";
    return getTitleSearchSource(source).core || source;
  }

  function donghuaCardTemplate(item, titleHTML, extraMetaHTML, headingLevel) {
    // Semua nilai berikut disisipkan via innerHTML, jadi di-escape untuk cegah XSS.
    // Catatan: titleHTML & extraMetaHTML sudah berupa HTML aman dari highlightText().
    const type = escapeHTML(cardTypeLabel(item.type)) || "Donghua";
    const headingTag = headingLevel === 2 ? "h2" : "h3";
    const episode = escapeHTML(item.episode);
    const status = escapeHTML(item.status);
    const rating = escapeHTML(item.rating);
    const permalink = escapeHTML(item.permalink);
    // title  = judul penuh, dipakai untuk tooltip/alt supaya konteks utuh.
    // titleShort = judul inti tanpa boilerplate, dipakai sebagai teks card.
    const title = escapeHTML(item.title);
    const titleShort = escapeHTML(cardTitleLabel(item.title)) || title;

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
    // Label disamakan dengan syncButton() di site-favorites.js supaya teks
    // tidak berubah sendiri setelah script favorit selesai sinkronisasi.
    const bookmarkLabel = saved ? "Hapus dari daftar favorit" : "Tambah ke daftar favorit";
    const bookmarkIcon = saved
      ? '<path d="M5 3h14a1 1 0 0 1 1 1v17l-8-4-8 4V4a1 1 0 0 1 1-1z" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>'
      : '<path d="M5 3h14a1 1 0 0 1 1 1v17l-8-4-8 4V4a1 1 0 0 1 1-1z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>';

    let imgTag = "";
    if (thumbSrc) {
      /* Hasil pencarian sering berubah; hindari skeleton wrapper yang membuat
         poster fade-in lagi pada setiap query. */
      /* 400x600 = rasio 2:3, sama dengan kotak yang dikunci .donghua-card-link
         dan dengan hasil .Fill di partial Hugo. */
      imgTag = `<img class="donghua-card-img" loading="lazy" decoding="async" src="${thumbSrc}" alt="${title}"`;
      imgTag += ` width="400" height="600">`;
    }

    return `
        <article class="donghua-card">
          <button class="${bookmarkClass}" data-fav-id="${permalink}" type="button" aria-pressed="${saved ? "true" : "false"}" aria-label="${bookmarkLabel}" title="${saved ? "Hapus dari favorit" : "Simpan ke favorit"}">
            <svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true">${bookmarkIcon}</svg>
          </button>
          <a class="donghua-card-link" title="${title}" href="${permalink}">
            <div class="donghua-card-poster">
              ${imgTag}
            </div>
            <div class="donghua-card-badges">
              <span class="donghua-card-badge">${type}</span>
            </div>
            <div class="donghua-card-body">
              <${headingTag} class="donghua-card-title" title="${title}">${titleHTML || titleShort}</${headingTag}>
              ${extraMeta}
              <div class="donghua-card-meta">${metaChips}</div>
              <div class="donghua-card-footer">
                ${ratingHTML}
              </div>
            </div>
          </a>
        </article>
      `;
  }

  window.DonghuaBatchCards = window.DonghuaBatchCards || {};
  window.DonghuaBatchCards.donghuaCardTemplate = donghuaCardTemplate;
})();
