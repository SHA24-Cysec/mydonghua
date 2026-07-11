(function () {
  'use strict';

document.addEventListener('DOMContentLoaded', function () {
                const shell = document.querySelector('[data-genre-filter]');
                if (!shell) return;

                const trigger = shell.querySelector('.genre-sheet-trigger');
                const closeButtons = shell.querySelectorAll('[data-genre-close]');
                const clearButton = shell.querySelector('[data-genre-clear]');
                const tray = shell.querySelector('[data-genre-tray]');
                const triggerCount = shell.querySelector('[data-genre-trigger-count]');
                const applyButton = shell.querySelector('.genre-apply-button');
                const inputs = Array.from(shell.querySelectorAll('input[name="genre"]'));

                function selectedInputs() {
                    return inputs.filter(function (input) { return input.checked; });
                }

                function updateSelectedUI() {
                    const selected = selectedInputs();
                    if (triggerCount) {
                        triggerCount.textContent = selected.length + ' dipilih';
                    }
                    if (applyButton) {
                        applyButton.disabled = selected.length === 0;
                    }
                    if (!tray) return;

                    if (!selected.length) {
                        tray.innerHTML = '<span class="genre-selected-empty">Belum ada genre dipilih</span>';
                        return;
                    }

                    tray.innerHTML = selected.map(function (input) {
                        const label = input.getAttribute('data-genre-label') || input.value;
                        return '<span class="genre-selected-pill">' + label + ' <i class="fa-solid fa-check" aria-hidden="true"></i></span>';
                    }).join('');
                }

                function openSheet() {
                    shell.classList.add('is-open');
                    document.body.classList.add('genre-sheet-lock');
                    if (trigger) trigger.setAttribute('aria-expanded', 'true');
                }

                function closeSheet() {
                    shell.classList.remove('is-open');
                    document.body.classList.remove('genre-sheet-lock');
                    if (trigger) trigger.setAttribute('aria-expanded', 'false');
                }

                if (trigger) {
                    trigger.addEventListener('click', openSheet);
                }

                closeButtons.forEach(function (button) {
                    button.addEventListener('click', closeSheet);
                });

                if (clearButton) {
                    clearButton.addEventListener('click', function () {
                        inputs.forEach(function (input) { input.checked = false; });
                        updateSelectedUI();
                    });
                }

                inputs.forEach(function (input) {
                    input.addEventListener('change', updateSelectedUI);
                });

                document.addEventListener('keydown', function (event) {
                    if (event.key === 'Escape') closeSheet();
                });

                updateSelectedUI();
            });

document.addEventListener('DOMContentLoaded', function () {
                document.querySelectorAll('[data-taxonomy-tabs]').forEach(function (widget) {
                    const buttons = Array.from(widget.querySelectorAll('[data-taxonomy-tab]'));
                    const panels = Array.from(widget.querySelectorAll('[data-taxonomy-panel]'));
                    const search = widget.querySelector('[data-taxonomy-search]');
                    const clear = widget.querySelector('[data-taxonomy-clear]');
                    const counter = widget.querySelector('[data-taxonomy-count]');
                    let active = 'studio';

                    function activePanel() {
                        return widget.querySelector('[data-taxonomy-panel="' + active + '"]');
                    }

                    function updateCounter(visibleCount) {
                        if (!counter) return;
                        const label = active === 'studio' ? 'Studio' : 'Season';
                        counter.textContent = typeof visibleCount === 'number' ? label + ' • ' + visibleCount : label;
                    }

                    function filterItems() {
                        const panel = activePanel();
                        if (!panel) return;

                        const query = search ? search.value.trim().toLowerCase() : '';
                        const items = Array.from(panel.querySelectorAll('[data-taxonomy-item]'));
                        const empty = panel.querySelector('[data-taxonomy-empty]');
                        let visible = 0;

                        items.forEach(function (item) {
                            const name = (item.getAttribute('data-taxonomy-name') || item.textContent || '').toLowerCase();
                            const match = !query || name.includes(query);
                            item.classList.toggle('is-hidden', !match);
                            if (match) visible++;
                        });

                        if (empty) empty.hidden = visible !== 0;
                        updateCounter(visible);
                    }

                    function setActive(next) {
                        active = next;
                        buttons.forEach(function (button) {
                            const isActive = button.getAttribute('data-taxonomy-tab') === active;
                            button.classList.toggle('is-active', isActive);
                            button.setAttribute('aria-selected', isActive ? 'true' : 'false');
                        });

                        panels.forEach(function (panel) {
                            const isActive = panel.getAttribute('data-taxonomy-panel') === active;
                            panel.classList.toggle('is-active', isActive);
                            panel.hidden = !isActive;
                        });

                        if (search) {
                            search.placeholder = active === 'studio' ? 'Cari studio...' : 'Cari season...';
                            search.value = '';
                        }
                        filterItems();
                    }

                    buttons.forEach(function (button) {
                        button.addEventListener('click', function () {
                            setActive(button.getAttribute('data-taxonomy-tab'));
                        });
                    });

                    if (search) {
                        search.addEventListener('input', filterItems);
                    }

                    if (clear) {
                        clear.addEventListener('click', function () {
                            if (search) search.value = '';
                            filterItems();
                            if (search) search.focus();
                        });
                    }

                    setActive(active);
                });
            });
})();
