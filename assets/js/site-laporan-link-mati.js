(function () {
  'use strict';

  /* ==========================================================
     LAPORKAN LINK MATI
     Form laporan link download rusak yang dikirim ke Formspree.

     Pengiriman memakai fetch (AJAX) sesuai panduan resmi Formspree
     "Submit forms with JavaScript (AJAX)":
       1. POST FormData ke endpoint form
       2. Header Accept: application/json
       3. Response JSON saat gagal berisi larik errors
          dengan bentuk { field, message }
     Library @formspree/ajax sengaja tidak dipakai supaya halaman
     tetap ringan, tanpa dependensi luar, dan tetap jalan di PWA
     offline shell.

     Alur submit:
       listener validasi kolom (dipasang lebih dulu)
         -> penjaga email window.SiteEmailGuard (email opsional)
           -> submitReport() kirim fetch ke Formspree
     ========================================================== */

  var FORM_SELECTOR = '[data-laporkan-form]';
  var MIN_KETERANGAN = 10;
  var MAX_KETERANGAN = 1000;
  var MIN_TEKS_PENDEK = 3;
  var COOLDOWN_MS = 30000;
  var TIMEOUT_MS = 20000;
  var STORAGE_KEY = 'donghuabatch:laporan-link-mati:terakhir';
  var STATUS_FALLBACK_CLASS = 'laporkan-status';

  var FIELD_RULES = {
    judul_donghua: { label: 'Judul Donghua' },
    url_halaman: { label: 'URL Halaman' },
    bagian_link: { label: 'Bagian atau Link yang Rusak' },
    jenis_masalah: { label: 'Jenis Masalah' },
    keterangan: { label: 'Keterangan Tambahan' }
  };

  var MESSAGES = {
    judul: 'Tulis judul donghua minimal ' + MIN_TEKS_PENDEK + ' karakter.',
    url: 'Tautan halaman belum benar. Contoh: https://donghuabatch.com/nama-donghua/',
    bagian: 'Sebutkan bagian atau link yang rusak minimal ' + MIN_TEKS_PENDEK + ' karakter.',
    jenis: 'Pilih salah satu jenis masalah.',
    keteranganKosong: 'Keterangan tambahan wajib diisi.',
    keteranganSingkat: 'Keterangan minimal ' + MIN_KETERANGAN + ' karakter supaya laporan bisa ditindaklanjuti.',
    keteranganPanjang: 'Keterangan maksimal ' + MAX_KETERANGAN + ' karakter.',
    emailFormat: 'Format email belum benar. Contoh: nama@gmail.com.',
    ringkas: 'Lengkapi kolom yang ditandai merah, lalu kirim lagi.'
  };

  var isSending = false;

  /* ---------- Utilitas umum ---------- */

  function trimText(value) {
    return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  }

  function limitText(value, max) {
    var text = trimText(value);
    return text.length > max ? text.slice(0, max) : text;
  }

  function getParam(name) {
    try {
      var params = new URLSearchParams(window.location.search);
      return params.get(name) || '';
    } catch (error) {
      return '';
    }
  }

  /* Terima URL lengkap maupun path situs. Nilai balikan selalu
     absolut agar tercatat rapi di inbox Formspree. */
  function normalizeUrl(raw) {
    var value = limitText(raw, 300);
    if (!value) return { ok: false, value: '' };

    var candidate = value;
    if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(candidate)) {
      candidate = candidate.charAt(0) === '/'
        ? window.location.origin + candidate
        : 'https://' + candidate;
    }

    try {
      var url = new URL(candidate);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return { ok: false, value: '' };
      if (!url.hostname) return { ok: false, value: '' };
      if (!/^[a-z0-9.-]+$/i.test(url.hostname)) return { ok: false, value: '' };
      return { ok: true, value: url.href };
    } catch (error) {
      return { ok: false, value: '' };
    }
  }

  function prefersReducedMotion() {
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (error) {
      return false;
    }
  }

  /* Sidik jari ringan dari isi laporan. Dipakai supaya kirim ulang
     laporan yang persis sama (klik dobel atau refresh berulang)
     bisa ditahan sementara, tanpa menghalangi laporan berbeda
     dari halaman donghua yang sama. */
  function sidikLaporan(form) {
    var teks = Object.keys(FIELD_RULES).map(function (name) {
      var field = form.elements[name];
      return field ? trimText(field.value) : '';
    }).join('\u0001');

    var hash = 0;
    for (var i = 0; i < teks.length; i += 1) {
      hash = (hash * 31 + teks.charCodeAt(i)) | 0;
    }
    return String(hash);
  }

  function simpanSidikLaporan(form) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
        t: Date.now(),
        s: sidikLaporan(form)
      }));
    } catch (error) {
      /* Mode privat atau storage penuh: abaikan. */
    }
  }

  /* Sisa waktu tahan (detik) untuk laporan dengan isi yang sama. */
  function sisaTahan(form) {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return 0;

      var data = JSON.parse(raw);
      if (!data || typeof data.t !== 'number') return 0;
      if (data.s !== sidikLaporan(form)) return 0;

      var sisa = COOLDOWN_MS - (Date.now() - data.t);
      return sisa > 0 ? Math.ceil(sisa / 1000) : 0;
    } catch (error) {
      return 0;
    }
  }

  /* ---------- Elemen status dan error per kolom ---------- */

  function getStatusBox(form) {
    var box = form.querySelector('#laporanStatus') || document.getElementById('laporanStatus');
    if (!box) {
      box = document.createElement('div');
      box.id = 'laporanStatus';
      box.className = STATUS_FALLBACK_CLASS;
      box.setAttribute('role', 'status');
      box.setAttribute('aria-live', 'polite');
      box.tabIndex = -1;
      box.hidden = true;
      form.insertBefore(box, form.firstChild);
    }
    return box;
  }

  function showStatus(form, type, title, lines) {
    var box = getStatusBox(form);
    box.className = STATUS_FALLBACK_CLASS + (type ? ' ' + STATUS_FALLBACK_CLASS + '--' + type : '');
    box.textContent = '';

    if (!type) {
      box.hidden = true;
      return;
    }

    box.hidden = false;

    var icon = document.createElement('i');
    icon.setAttribute('aria-hidden', 'true');
    icon.className = type === 'success'
      ? 'fa-solid fa-circle-check'
      : type === 'warning'
        ? 'fa-solid fa-circle-info'
        : 'fa-solid fa-triangle-exclamation';
    box.appendChild(icon);

    var body = document.createElement('div');
    body.className = 'laporkan-status-body';

    if (title) {
      var strong = document.createElement('strong');
      strong.textContent = title;
      body.appendChild(strong);
    }

    (lines || []).forEach(function (line) {
      var p = document.createElement('p');
      p.textContent = line;
      body.appendChild(p);
    });

    box.appendChild(body);

    if (typeof box.scrollIntoView === 'function') {
      try {
        box.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' });
      } catch (error) {
        try {
          box.scrollIntoView();
        } catch (error2) {
          /* Peramban lama tanpa scrollIntoView: abaikan. */
        }
      }
    }
  }

  function setFieldError(form, name, message) {
    var field = form.elements[name];
    if (field) {
      field.classList.add('is-invalid');
      field.setAttribute('aria-invalid', 'true');
    }
    var box = form.querySelector('[data-laporkan-error="' + name + '"]');
    if (box) {
      box.textContent = message;
      box.hidden = false;
    }
  }

  function clearFieldError(form, name) {
    var field = form.elements[name];
    if (field) {
      field.classList.remove('is-invalid');
      field.removeAttribute('aria-invalid');
    }
    var box = form.querySelector('[data-laporkan-error="' + name + '"]');
    if (box) {
      box.hidden = true;
      box.textContent = '';
    }
  }

  function clearAllFieldErrors(form) {
    Object.keys(FIELD_RULES).forEach(function (name) {
      clearFieldError(form, name);
    });
  }

  function fokuskanKolomSalah(form) {
    var invalid = form.querySelector('.is-invalid');
    if (invalid && typeof invalid.focus === 'function') {
      invalid.focus({ preventScroll: true });
    }
  }

  /* ---------- Validasi kolom wajib ---------- */

  function checkField(form, name) {
    var field = form.elements[name];
    if (!field) return '';
    var value = trimText(field.value);

    if (name === 'url_halaman') {
      if (!value) return MESSAGES.url;
      return normalizeUrl(value).ok ? '' : MESSAGES.url;
    }
    if (name === 'jenis_masalah') {
      return value ? '' : MESSAGES.jenis;
    }
    if (name === 'keterangan') {
      if (!value) return MESSAGES.keteranganKosong;
      if (value.length < MIN_KETERANGAN) return MESSAGES.keteranganSingkat;
      if (value.length > MAX_KETERANGAN) return MESSAGES.keteranganPanjang;
      return '';
    }
    if (name === 'judul_donghua') {
      return value.length >= MIN_TEKS_PENDEK ? '' : MESSAGES.judul;
    }
    if (name === 'bagian_link') {
      return value.length >= MIN_TEKS_PENDEK ? '' : MESSAGES.bagian;
    }
    return '';
  }

  /* Mengembalikan true bila semua kolom wajib sudah benar. */
  function validateFields(form) {
    var invalidNames = [];

    Object.keys(FIELD_RULES).forEach(function (name) {
      var message = checkField(form, name);
      if (message) {
        setFieldError(form, name, message);
        invalidNames.push(name);
      } else {
        clearFieldError(form, name);
      }
    });

    if (invalidNames.length) {
      var labels = invalidNames.map(function (name) {
        return FIELD_RULES[name].label;
      });
      showStatus(form, 'error', 'Ada kolom yang belum lengkap.', [
        'Periksa: ' + labels.join(', ') + '.',
        MESSAGES.ringkas
      ]);
      return false;
    }

    showStatus(form, null);
    return true;
  }

  /* ---------- Prefill dari tombol di halaman donghua ---------- */

  /* Kolom yang terisi otomatis dari tombol halaman donghua dikunci.
     Memakai readonly, bukan disabled, karena kolom disabled tidak ikut
     terkirim ke Formspree. Jadi nilainya tetap terkirim utuh, tetapi
     tidak bisa diketik ulang oleh pengunjung. Petunjuk kolom sengaja
     tidak diubah supaya tidak ada teks tambahan di bawah kolom. */
  function kunciKolom(input, pesanAlat) {
    input.readOnly = true;
    input.setAttribute('readonly', 'readonly');
    input.setAttribute('aria-readonly', 'true');
    input.classList.add('is-readonly');
    input.title = pesanAlat;
  }

  function kunciKolomJudul(input) {
    kunciKolom(input, 'Terisi otomatis dan dikunci agar tetap sesuai halaman donghua yang kamu buka.');
  }

  function kunciKolomUrl(input) {
    kunciKolom(input, 'Terisi otomatis dan dikunci agar tetap menunjuk halaman yang benar.');
  }

  /* Sorot singkat kolom yang baru terisi supaya pengunjung sadar
     datanya sudah ada dan tinggal diperiksa. */
  function tandaiTerisi(input) {
    input.classList.add('is-prefilled');
    setTimeout(function () {
      input.classList.remove('is-prefilled');
    }, 2200);
  }

  /* Catatan peringatan saat sebagian data dari tombol donghua tidak
     terbaca. Kasus normal tidak memakai catatan apa pun. */
  function showPrefillWarning(form, message) {
    var note = form.querySelector('#laporanPrefillNote');
    if (!note) return;

    note.className = 'laporkan-prefill-note laporkan-prefill-note--warning';
    note.innerHTML = '';

    var icon = document.createElement('i');
    icon.className = 'fa-solid fa-triangle-exclamation';
    icon.setAttribute('aria-hidden', 'true');
    note.appendChild(icon);

    var text = document.createElement('span');
    text.textContent = message;
    note.appendChild(text);
    note.hidden = false;
  }

  function applyPrefill(form) {
    var judulInput = form.elements.judul_donghua;
    var urlInput = form.elements.url_halaman;

    var judulParam = getParam('judul');
    var urlParam = getParam('url');

    var judul = limitText(judulParam, 120);
    var tautan = normalizeUrl(urlParam);

    /* Judul dan URL yang terisi otomatis dikunci dengan perilaku sama:
       terkunci saat terisi otomatis, tetap bisa diisi manual bila
       parameter tidak ada atau rusak. */
    if (judulInput && judul && !judulInput.value) {
      judulInput.value = judul;
      tandaiTerisi(judulInput);
      kunciKolomJudul(judulInput);
    }
    if (urlInput && tautan.ok && !urlInput.value) {
      urlInput.value = tautan.value;
      tandaiTerisi(urlInput);
      kunciKolomUrl(urlInput);
    }

    /* Catatan hanya muncul untuk kasus data rusak. Saat semua kolom
       terisi otomatis, kolom yang terkunci sudah cukup jelas sendiri
       sehingga tidak perlu teks tambahan di bawahnya. */
    var adaYangTidakTerbaca = (!!urlParam && !tautan.ok) || (!!judulParam && !judul);

    if (adaYangTidakTerbaca) {
      showPrefillWarning(form,
        'Sebagian data dari halaman donghua tidak bisa dibaca. Isi kolom yang masih kosong secara manual.');
    }
  }

  /* ---------- Interaksi kolom ---------- */

  function bindCounter(form) {
    var textarea = form.elements.keterangan;
    var counter = form.querySelector('[data-laporkan-counter]');
    if (!textarea || !counter) return;

    var update = function () {
      counter.textContent = String(textarea.value.length);
    };
    textarea.addEventListener('input', update);
    update();
  }

  function bindFieldBehaviour(form) {
    form.addEventListener('input', function (event) {
      var field = event.target;
      if (!field || !field.name || !field.classList || !field.classList.contains('is-invalid')) return;
      /* Saat pengguna memperbaiki isian, tanda merah dilepas dulu.
         Validasi ulang terjadi saat blur atau submit. */
      clearFieldError(form, field.name);
    });

    form.addEventListener('change', function (event) {
      var field = event.target;
      if (!field || !field.name || !FIELD_RULES[field.name]) return;
      var message = checkField(form, field.name);
      if (message) {
        setFieldError(form, field.name, message);
      } else {
        clearFieldError(form, field.name);
      }
    });

    form.addEventListener('blur', function (event) {
      var field = event.target;
      if (!field || !field.name || !FIELD_RULES[field.name]) return;
      if (field.name === 'email') return; /* ditangani penjaga email */
      if (!trimText(field.value)) return;  /* kolom kosong dicek saat submit */
      var message = checkField(form, field.name);
      if (message) {
        setFieldError(form, field.name, message);
      } else {
        clearFieldError(form, field.name);
      }
    }, true);
  }

  function setBusy(form, busy) {
    var button = form.querySelector('[data-laporkan-submit]') || form.querySelector('button[type="submit"]');
    var label = form.querySelector('[data-laporkan-submit-label]');
    if (button) {
      button.disabled = busy;
      button.setAttribute('aria-busy', busy ? 'true' : 'false');
    }
    if (label) {
      label.textContent = busy ? 'Mengirim laporan...' : 'Kirim Laporan';
    }
  }

  /* ---------- Kirim ke Formspree ---------- */

  function normalizeValues(form) {
    var judul = form.elements.judul_donghua;
    var bagian = form.elements.bagian_link;
    var keterangan = form.elements.keterangan;
    var url = form.elements.url_halaman;

    if (judul) judul.value = limitText(judul.value, 120);
    if (bagian) bagian.value = limitText(bagian.value, 160);
    if (keterangan) keterangan.value = String(keterangan.value || '').trim().slice(0, MAX_KETERANGAN);
    if (url) url.value = normalizeUrl(url.value).value;
  }

  function handleSuccess(form) {
    var judul = form.elements.judul_donghua ? form.elements.judul_donghua.value : '';
    var url = form.elements.url_halaman ? form.elements.url_halaman.value : '';

    simpanSidikLaporan(form);

    /* Form dibersihkan, tetapi judul dan tautan donghua dibiarkan
       supaya laporan lain di halaman yang sama cepat dikirim. */
    form.reset();
    clearAllFieldErrors(form);

    if (form.elements.judul_donghua && judul) form.elements.judul_donghua.value = judul;
    if (form.elements.url_halaman && url) form.elements.url_halaman.value = url;

    var counter = form.querySelector('[data-laporkan-counter]');
    if (counter) counter.textContent = '0';
    if (form.__emailGuard && typeof form.__emailGuard.clear === 'function') {
      form.__emailGuard.clear();
    }

    showStatus(form, 'success', 'Laporan terkirim. Terima kasih!', [
      'Link akan dicek dulu, lalu diganti kalau sumbernya masih tersedia.',
      'Kalau kolom email diisi, kabar perbaikan dikirim setelah link baru dipasang.'
    ]);
  }

  function handleFailure(form, payload, httpStatus) {
    var errors = payload && Array.isArray(payload.errors) ? payload.errors : [];
    var lines = [];
    var adaErrorKolom = false;

    errors.forEach(function (item) {
      var field = item && item.field ? String(item.field) : '';
      var message = item && item.message ? String(item.message) : '';
      if (!message) return;

      var target = field && form.elements[field] ? form.elements[field] : null;
      if (target && Object.prototype.hasOwnProperty.call(FIELD_RULES, field)) {
        setFieldError(form, field, message);
        adaErrorKolom = true;
        if (typeof target.focus === 'function') target.focus({ preventScroll: true });
      } else {
        lines.push(field ? field + ': ' + message : message);
      }
    });

    if (adaErrorKolom) lines.push(MESSAGES.ringkas);

    if (!lines.length) {
      lines.push(httpStatus === 429
        ? 'Terlalu banyak laporan dalam waktu singkat. Coba lagi beberapa menit lagi.'
        : 'Server menolak laporan ini. Coba lagi sebentar lagi atau kirim lewat halaman Kontak.');
    }

    showStatus(form, 'error', 'Laporan gagal dikirim.', lines);
  }

  function submitReport(form) {
    if (isSending) return;

    if (!validateFields(form)) {
      fokuskanKolomSalah(form);
      return;
    }

    var sisa = sisaTahan(form);
    if (sisa > 0) {
      showStatus(form, 'warning', 'Laporan ini baru saja dikirim.', [
        'Isi laporan masih sama dengan kiriman sebelumnya. Ubah sedikit isinya atau coba lagi dalam ' + sisa + ' detik.'
      ]);
      return;
    }

    normalizeValues(form);
    isSending = true;
    setBusy(form, true);

    var controller = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = window.setTimeout(function () {
      if (controller) controller.abort();
    }, TIMEOUT_MS);

    var options = {
      method: 'POST',
      body: new FormData(form),
      headers: { Accept: 'application/json' }
    };
    if (controller) options.signal = controller.signal;

    fetch(form.action, options)
      .then(function (response) {
        return response.json()
          .catch(function () { return null; })
          .then(function (payload) {
            return { ok: response.ok, status: response.status, payload: payload };
          });
      })
      .then(function (result) {
        if (result.ok) {
          handleSuccess(form);
        } else {
          handleFailure(form, result.payload, result.status);
        }
      })
      .catch(function (error) {
        var aborted = error && error.name === 'AbortError';
        showStatus(form, 'error', aborted ? 'Pengiriman terlalu lama.' : 'Laporan gagal dikirim.', [
          aborted
            ? 'Jaringan terputus saat mengirim. Coba lagi ya.'
            : 'Periksa koneksi internet, lalu kirim ulang laporannya.'
        ]);
      })
      .finally(function () {
        window.clearTimeout(timer);
        isSending = false;
        setBusy(form, false);
      });
  }

  /* Pemeriksaan email cadangan saat modul penjaga email tidak termuat. */
  function fallbackEmailCheck(form) {
    var email = form.elements.email;
    if (!email) return true;

    var value = trimText(email.value);
    if (!value) return true; /* email opsional */

    var guard = window.SiteEmailGuard;
    var valid = guard && typeof guard.isStrictEmail === 'function'
      ? guard.isStrictEmail(value)
      : /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(value);

    var feedback = form.querySelector('[data-email-feedback]');
    if (!valid) {
      email.classList.add('is-invalid');
      email.setAttribute('aria-invalid', 'true');
      if (feedback) {
        feedback.hidden = false;
        feedback.className = 'form-email-feedback form-email-feedback--error';
        feedback.innerHTML = '';
        var icon = document.createElement('i');
        icon.className = 'fa-solid fa-triangle-exclamation';
        icon.setAttribute('aria-hidden', 'true');
        var text = document.createElement('span');
        text.textContent = MESSAGES.emailFormat;
        feedback.appendChild(icon);
        feedback.appendChild(text);
      }
      email.focus();
      return false;
    }

    email.classList.remove('is-invalid');
    email.removeAttribute('aria-invalid');
    if (feedback) {
      feedback.hidden = true;
      feedback.className = 'form-email-feedback';
      feedback.textContent = '';
    }
    return true;
  }

  function init() {
    var form = document.querySelector(FORM_SELECTOR);
    if (!form || form.__laporkanForm) return;
    form.__laporkanForm = true;

    form.setAttribute('novalidate', '');

    applyPrefill(form);
    bindCounter(form);
    bindFieldBehaviour(form);

    /* Listener validasi kolom wajib dipasang sebelum penjaga email
       supaya bisa menghentikan proses lebih awal saat kolom kosong. */
    form.addEventListener('submit', function (event) {
      if (validateFields(form)) return;
      event.preventDefault();
      if (typeof event.stopImmediatePropagation === 'function') {
        event.stopImmediatePropagation();
      } else {
        event.stopPropagation();
      }
      fokuskanKolomSalah(form);
    }, false);

    var guard = window.SiteEmailGuard;
    if (guard && typeof guard.attach === 'function') {
      guard.attach(form, {
        emailOptional: true,
        submitHandler: function () {
          submitReport(form);
        }
      });
    } else {
      form.addEventListener('submit', function (event) {
        event.preventDefault();
        if (!fallbackEmailCheck(form)) return;
        submitReport(form);
      }, false);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
