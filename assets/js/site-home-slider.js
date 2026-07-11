(function () {
  'use strict';

document.addEventListener('DOMContentLoaded', function () {
    const slider = document.querySelector('[data-home-random-slider]');
    if (!slider) return;

    const sourceItems = Array.from(slider.querySelectorAll('.home-rec-slider-source-item'));
    if (!sourceItems.length) return;

    const autoplayMs = parseInt(slider.getAttribute('data-autoplay-ms') || '5000', 10);
    const itemCount = parseInt(slider.getAttribute('data-item-count') || '3', 10);
    const titleNode = slider.querySelector('[data-slider-title]');
    const descNode = slider.querySelector('[data-slider-description]');
    const typeNode = slider.querySelector('[data-slider-type]');
    const chipsNode = slider.querySelector('[data-slider-chips]');
    const episodeNode = slider.querySelector('[data-slider-episode]');
    const statusNode = slider.querySelector('[data-slider-status]');
    const ratingNode = slider.querySelector('[data-slider-rating]');
    const linkNode = slider.querySelector('[data-slider-link]');
    const imageNode = slider.querySelector('.home-rec-slider-image');
    const heroNode = slider.querySelector('.home-rec-slider-hero');
    const progressNode = slider.querySelector('[data-slider-progress]');
    const dotsNode = slider.querySelector('[data-slider-dots]');
    const railNode = slider.querySelector('[data-slider-rail]');
    const prevButton = slider.querySelector('[data-slider-prev]');
    const nextButton = slider.querySelector('[data-slider-next]');

    function toItem(node) {
      return {
        title: node.dataset.title || '',
        permalink: node.dataset.url || '#',
        thumbnail: node.dataset.thumbnail || '',
        thumbnail240: node.dataset.thumbnail240 || '',
        thumbnail400: node.dataset.thumbnail400 || '',
        thumbnail600: node.dataset.thumbnail600 || '',
        type: node.dataset.type || 'Donghua',
        episode: node.dataset.episode || '',
        status: node.dataset.status || '',
        rating: node.dataset.rating || '',
        description: node.dataset.description || '',
        genres: (node.dataset.genres || '').split('||').filter(Boolean)
      };
    }

    /**
     * Pick the best thumbnail variant for a given display width + DPR.
     * Falls back to item.thumbnail if no multi-res data is available.
     */
    function pickBestSrc(item, displayWidth) {
      const dpr = window.devicePixelRatio || 1;
      const needed = Math.ceil(displayWidth * dpr);
      const candidates = [
        { w: 240, src: item.thumbnail240 },
        { w: 400, src: item.thumbnail400 },
        { w: 600, src: item.thumbnail600 }
      ].filter(function (c) { return c.src; });

      if (!candidates.length) return item.thumbnail;

      const match = candidates
        .filter(function (c) { return c.w >= needed; })
        .sort(function (a, b) { return a.w - b.w; })[0];

      return match ? match.src : candidates[candidates.length - 1].src;
    }

    /**
     * Build a srcset string from available multi-res data.
     */
    function buildSrcset(item) {
      const entries = [
        { w: '240w', src: item.thumbnail240 },
        { w: '400w', src: item.thumbnail400 },
        { w: '600w', src: item.thumbnail600 }
      ].filter(function (e) { return e.src; });

      if (entries.length < 2) return '';
      return entries.map(function (e) { return e.src + ' ' + e.w; }).join(', ');
    }

    function escapeHTML(value) {
      return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function getDailySeed() {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    }

    function hashString(value) {
      let hash = 2166136261;
      for (let index = 0; index < value.length; index++) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
      }
      return hash >>> 0;
    }

    function mulberry32(seed) {
      return function () {
        let t = seed += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
      };
    }

    function dailyShuffle(items) {
      const array = items.slice();
      const random = mulberry32(hashString(getDailySeed()));
      for (let index = array.length - 1; index > 0; index--) {
        const swapIndex = Math.floor(random() * (index + 1));
        [array[index], array[swapIndex]] = [array[swapIndex], array[index]];
      }
      return array;
    }

    const source = sourceItems.map(toItem);
    const slides = dailyShuffle(source).slice(0, Math.min(itemCount, source.length));
    if (slides.length <= 1) return;

    let currentIndex = 0;
    let autoplayTimer = null;
    let autoplayStartedAt = 0;
    let remainingMs = autoplayMs;
    let isPaused = false;
    let railCards = [];

    function setProgressDuration(duration) {
      if (!progressNode) return;
      progressNode.style.animation = 'none';
      progressNode.style.transform = 'scaleX(0)';
      progressNode.offsetWidth;
      progressNode.style.animation = `homeRandomSliderProgress ${duration}ms linear forwards`;
      progressNode.style.animationPlayState = 'running';
    }

    function pauseProgress() {
      if (!progressNode) return;
      progressNode.style.animationPlayState = 'paused';
    }

    function resumeProgress() {
      if (!progressNode) return;
      progressNode.style.animationPlayState = 'running';
    }

    let dotButtons = [];

    function renderDots() {
      dotsNode.innerHTML = '';
      dotButtons = slides.map(function (_, index) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'home-rec-slider-dot' + (index === currentIndex ? ' is-active' : '');
        button.setAttribute('aria-label', 'Tampilkan slide ' + (index + 1) + ' dari ' + slides.length);
        button.setAttribute('aria-current', index === currentIndex ? 'true' : 'false');
        button.setAttribute('tabindex', index === currentIndex ? '0' : '-1');
        button.addEventListener('click', function () {
          goToSlide(index, true);
          button.focus();
        });
        dotsNode.appendChild(button);
        return button;
      });
      bindDotsKeyboard();
    }

    function bindDotsKeyboard() {
      if (!dotsNode) return;
      dotsNode.addEventListener('keydown', function (e) {
        const key = e.key;
        let newIndex = currentIndex;
        if (key === 'ArrowRight' || key === 'ArrowDown') {
          newIndex = (currentIndex + 1) % slides.length;
          e.preventDefault();
        } else if (key === 'ArrowLeft' || key === 'ArrowUp') {
          newIndex = (currentIndex - 1 + slides.length) % slides.length;
          e.preventDefault();
        } else if (key === 'Home') {
          newIndex = 0;
          e.preventDefault();
        } else if (key === 'End') {
          newIndex = slides.length - 1;
          e.preventDefault();
        } else {
          return;
        }
        goToSlide(newIndex, true);
        if (dotButtons[newIndex]) dotButtons[newIndex].focus();
      });
    }

    function renderRail() {
      railNode.innerHTML = '';
      railCards = slides.map(function (item, index) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'home-rec-slider-card' + (index === currentIndex ? ' is-active' : '');
        button.setAttribute('aria-label', 'Tampilkan rekomendasi: ' + (item.title || ('Slide ' + (index + 1))));
        button.setAttribute('aria-current', index === currentIndex ? 'true' : 'false');
        button.dataset.slideIndex = String(index);
        const railImgSrcset = buildSrcset(item);
        const railImgHtml = railImgSrcset
          ? `<img data-no-loader="true" src="${escapeHTML(pickBestSrc(item, 120))}" srcset="${escapeHTML(railImgSrcset)}" sizes="120px" alt="${escapeHTML(item.title)}" loading="lazy" decoding="async" width="120" height="160">`
          : `<img data-no-loader="true" src="${escapeHTML(item.thumbnail)}" alt="${escapeHTML(item.title)}" loading="lazy" decoding="async" width="120" height="160">`;
        button.innerHTML = `
          <span class="home-rec-slider-card-thumb">
            ${railImgHtml}
          </span>
          <span class="home-rec-slider-card-body">
            <strong>${escapeHTML(item.title)}</strong>
            <small>${escapeHTML(item.description || 'Pilihan donghua untuk hari ini.')}</small>
          </span>
        `;
        button.addEventListener('click', function () {
          goToSlide(index, true);
        });
        railNode.appendChild(button);
        return button;
      });
    }

    function updateActiveRail() {
      railCards.forEach(function (card, index) {
        const isActive = index === currentIndex;
        card.classList.toggle('is-active', isActive);
        card.setAttribute('aria-current', isActive ? 'true' : 'false');
      });
    }

    function updateHeroImageFocus() {
      if (!imageNode) return;
      imageNode.classList.remove('is-landscape');
      if (imageNode.naturalWidth > imageNode.naturalHeight * 1.12) {
        imageNode.classList.add('is-landscape');
      }
    }

    if (imageNode) {
      imageNode.addEventListener('load', updateHeroImageFocus);
    }

    function applyHeroImage(item) {
      if (!imageNode || !item) return;

      const heroDisplayW = imageNode.getBoundingClientRect().width || 400;
      const nextSrc = pickBestSrc(item, heroDisplayW) || item.thumbnail || '';
      const nextSrcset = buildSrcset(item);
      const nextAlt = item.title || 'Rekomendasi Donghua';
      const prevKey = imageNode.getAttribute('data-slider-image-key') || '';
      const nextKey = [nextSrc, nextSrcset, nextAlt].join('|');

      imageNode.loading = 'eager';
      imageNode.decoding = 'async';
      try { imageNode.fetchPriority = 'high'; } catch (e) {}
      imageNode.setAttribute('fetchpriority', 'high');
      imageNode.alt = nextAlt;

      /* Selalu sinkronkan srcset: jika slide baru tidak punya multi-res,
         atribut lama harus dihapus agar browser tidak tetap pakai srcset slide sebelumnya. */
      if (nextSrcset) {
        imageNode.setAttribute('srcset', nextSrcset);
        imageNode.setAttribute('sizes', '(max-width:640px) 90vw, (max-width:1024px) 45vw, 400px');
      } else {
        imageNode.removeAttribute('srcset');
        imageNode.removeAttribute('sizes');
      }

      if (!nextSrc) {
        imageNode.removeAttribute('src');
        imageNode.removeAttribute('data-slider-image-key');
        updateHeroImageFocus();
        return;
      }

      /* Paksa reload jika key sama (edge cache) atau beda slide. */
      if (prevKey === nextKey && imageNode.getAttribute('src') === nextSrc) {
        updateHeroImageFocus();
        return;
      }

      /* Clear dulu supaya browser tidak menahan currentSrc dari srcset lama. */
      imageNode.removeAttribute('src');
      if (nextSrcset) {
        imageNode.setAttribute('srcset', nextSrcset);
      }
      imageNode.src = nextSrc;
      imageNode.setAttribute('data-slider-image-key', nextKey);

      if (typeof imageNode.decode === 'function') {
        imageNode.decode().then(updateHeroImageFocus).catch(updateHeroImageFocus);
      } else {
        updateHeroImageFocus();
      }
    }

    function applySlide(item) {
      typeNode.textContent = item.type || 'Donghua';
      titleNode.textContent = item.title || 'Rekomendasi Donghua';
      descNode.textContent = item.description || 'Pilihan donghua untuk hari ini.';
      episodeNode.textContent = item.episode ? `Episode: ${item.episode}` : 'Episode: —';
      statusNode.textContent = item.status ? `Status: ${item.status}` : 'Status: —';
      ratingNode.textContent = item.rating ? `Rating: ${item.rating}/10` : 'Rating: —';
      linkNode.href = item.permalink || '#';

      applyHeroImage(item);

      chipsNode.innerHTML = '';
      const genres = Array.isArray(item.genres) ? item.genres.slice(0, 3) : [];
      genres.forEach(function (genre) {
        const chip = document.createElement('span');
        chip.className = 'home-rec-slider-chip';
        chip.textContent = genre;
        chipsNode.appendChild(chip);
      });
    }

    function renderSlide(animate) {
      const item = slides[currentIndex];
      if (!item) return;

      if (animate && heroNode) {
        heroNode.classList.add('is-switching');
        window.setTimeout(function () {
          applySlide(item);
          renderDots();
          updateActiveRail();
          heroNode.classList.remove('is-switching');
        }, 140);
      } else {
        applySlide(item);
        renderDots();
        updateActiveRail();
      }
    }

    function clearAutoplay() {
      if (autoplayTimer) {
        clearTimeout(autoplayTimer);
        autoplayTimer = null;
      }
    }

    function scheduleAutoplay(duration) {
      clearAutoplay();
      autoplayStartedAt = Date.now();
      setProgressDuration(duration);
      autoplayTimer = window.setTimeout(function () {
        nextSlide(true);
      }, duration);
    }

    function restartAutoplay(resetDuration) {
      remainingMs = resetDuration ? autoplayMs : Math.max(remainingMs, 1200);
      isPaused = false;
      scheduleAutoplay(remainingMs);
    }

    function goToSlide(index, restart) {
      currentIndex = (index + slides.length) % slides.length;
      renderSlide(true);
      if (restart !== false) {
        restartAutoplay(true);
      }
    }

    function nextSlide(restart) {
      goToSlide(currentIndex + 1, restart);
    }

    function prevSlide(restart) {
      goToSlide(currentIndex - 1, restart);
    }

    function pauseAutoplay() {
      if (isPaused) return;
      isPaused = true;
      const elapsed = Date.now() - autoplayStartedAt;
      remainingMs = Math.max(autoplayMs - elapsed, 400);
      clearAutoplay();
      pauseProgress();
    }

    function resumeAutoplay() {
      if (!isPaused) return;
      isPaused = false;
      autoplayStartedAt = Date.now();
      autoplayTimer = window.setTimeout(function () {
        nextSlide(true);
      }, remainingMs);
      resumeProgress();
    }

    if (prevButton) {
      prevButton.addEventListener('click', function () {
        prevSlide(true);
      });
    }

    if (nextButton) {
      nextButton.addEventListener('click', function () {
        nextSlide(true);
      });
    }

    if (window.matchMedia('(hover: hover)').matches) {
      slider.addEventListener('mouseenter', pauseAutoplay);
      slider.addEventListener('mouseleave', resumeAutoplay);
    }

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        pauseAutoplay();
      } else {
        resumeAutoplay();
      }
    });

    renderRail();
    renderSlide(false);
    restartAutoplay(true);
  });
})();
