(function () {
  'use strict';

  var FORM_SELECTOR = '[data-request-form]';
  var TIPE_DONATUR = 'donatur';
  var MIN_JUDUL = 2;
  var MAX_CATATAN = 800;
  var COOLDOWN_MS = 30000;
  var TIMEOUT_MS = 30000;
  var STORAGE_PREFIX = 'donghuabatch:request-donghua:terakhir:';

  var MESSAGES = {
    judulKosong: 'Judul donghua wajib diisi supaya requestnya bisa ditindaklanjuti.',
    judulPendek: 'Judul donghua minimal 2 karakter.',
    catatanPanjang: 'Catatan maksimal ' + MAX_CATATAN + ' karakter.',
    emailKosong: 'Email wajib diisi supaya request kami bisa dibalas.',
    emailFormat: 'Format email belum benar. Contoh: nama@gmail.com.',
    ringkas: 'Lengkapi kolom yang ditandai merah, lalu kirim lagi.'
  };

  var isSending = false;

  function trimText(value) {
    return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  }

  function getValue(form, name) {
    var field = form.elements[name];
    if (!field) return '';
    return String(field.value == null ? '' : field.value);
  }

  function getType(form) {
    return form.getAttribute('data-request-type') === TIPE_DONATUR ? TIPE_DONATUR : 'umum';
  }

  function getParam(name) {
    try {
      var params = new URLSearchParams(window.location.search);
      return params.get(name) || '';
    } catch (error) {
      return '';
    }
  }

  function prefersReducedMotion() {
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (error) {
      return false;
    }
  }

  function getStatusBox(form) {
    var box = form.querySelector('[data-request-status]');
    if (!box) {
      box = document.createElement('div');
      box.className = 'request-status';
      box.setAttribute('role', 'status');
      box.setAttribute('aria-live', 'polite');
      box.tabIndex = -1;
      box.hidden = true;
      form.appendChild(box);
    }
    return box;
  }

  function showStatus(form, type, title, lines) {
    var box = getStatusBox(form);
    box.className = 'request-status';
    box.textContent = '';

    if (!type) {
      box.hidden = true;
      return;
    }

    box.hidden = false;
    box.className = 'request-status request-status--' + type;

    var icon = document.createElement('i');
    icon.setAttribute('aria-hidden', 'true');
    icon.className = type === 'success'
      ? 'fa-solid fa-circle-check'
      : type === 'warning'
        ? 'fa-solid fa-circle-info'
        : 'fa-solid fa-triangle-exclamation';
    box.appendChild(icon);

    var body = document.createElement('div');
    body.className = 'request-status-body';

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
        } catch (error2) {}
      }
    }
  }

  function setFieldError(form, name, message) {
    var field = form.elements[name];
    if (field) {
      field.classList.add('is-invalid');
      field.setAttribute('aria-invalid', 'true');
    }
    var box = form.querySelector('[data-request-error="' + name + '"]');
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
    var box = form.querySelector('[data-request-error="' + name + '"]');
    if (box) {
      box.hidden = true;
      box.textContent = '';
    }
  }

  function fokuskanKolomSalah(form) {
    var invalid = form.querySelector('.is-invalid');
    if (invalid && typeof invalid.focus === 'function') {
      invalid.focus({ preventScroll: true });
    }
  }

  function tandaiTerisi(input) {
    input.classList.add('is-prefilled');
    window.setTimeout(function () {
      input.classList.remove('is-prefilled');
    }, 2200);
  }

  function applyPrefill(form) {
    var judul = trimText(getParam('judul')).slice(0, 160);
    var judulInput = form.elements.judul_donghua;

    if (judulInput && judul && !judulInput.value) {
      judulInput.value = judul;
      tandaiTerisi(judulInput);
    }
  }

  function bindCounter(form) {
    var textarea = form.elements.catatan;
    var counter = form.querySelector('[data-request-counter]');
    if (!textarea || !counter) return;

    var update = function () {
      counter.textContent = String(String(textarea.value || '').length);
    };
    textarea.addEventListener('input', update);
    update();
  }

  function bindFieldBehaviour(form) {
    form.addEventListener('input', function (event) {
      var field = event.target;
      if (!field || !field.name) return;
      if (field.name === 'email') return;
      if (!field.classList || !field.classList.contains('is-invalid')) return;
      clearFieldError(form, field.name);
    });

    form.addEventListener('change', function (event) {
      var field = event.target;
      if (!field || !field.name || field.name === 'email') return;
      clearFieldError(form, field.name);
    });
  }

  function validateForm(form) {
    var type = getType(form);
    var invalidLabels = [];

    if (type === TIPE_DONATUR) {
      clearFieldError(form, 'judul_donghua');
    } else {
      var judul = trimText(getValue(form, 'judul_donghua'));
      if (!judul) {
        setFieldError(form, 'judul_donghua', MESSAGES.judulKosong);
        invalidLabels.push('Judul Donghua');
      } else if (judul.length < MIN_JUDUL) {
        setFieldError(form, 'judul_donghua', MESSAGES.judulPendek);
        invalidLabels.push('Judul Donghua');
      } else {
        clearFieldError(form, 'judul_donghua');
      }
    }

    var catatan = String(getValue(form, 'catatan') || '');
    if (catatan.length > MAX_CATATAN) {
      setFieldError(form, 'catatan', MESSAGES.catatanPanjang);
      invalidLabels.push('Catatan Tambahan');
    } else {
      clearFieldError(form, 'catatan');
    }

    if (invalidLabels.length) {
      showStatus(form, 'error', 'Ada kolom yang belum lengkap.', [
        'Periksa: ' + invalidLabels.join(', ') + '.',
        MESSAGES.ringkas
      ]);
      return false;
    }

    showStatus(form, null);
    return true;
  }

  function sidikRequest(form) {
    var teks = [
      getType(form),
      trimText(getValue(form, 'judul_donghua')),
      trimText(getValue(form, 'email')).toLowerCase(),
      trimText(getValue(form, 'resolusi')),
      trimText(getValue(form, 'catatan'))
    ].join('\u0001');

    var hash = 0;
    for (var i = 0; i < teks.length; i += 1) {
      hash = (hash * 31 + teks.charCodeAt(i)) | 0;
    }
    return String(hash);
  }

  function storageKey(form) {
    return STORAGE_PREFIX + getType(form);
  }

  function simpanSidik(form) {
    try {
      window.localStorage.setItem(storageKey(form), JSON.stringify({
        t: Date.now(),
        s: sidikRequest(form)
      }));
    } catch (error) {}
  }

  function sisaTahan(form) {
    try {
      var raw = window.localStorage.getItem(storageKey(form));
      if (!raw) return 0;

      var data = JSON.parse(raw);
      if (!data || typeof data.t !== 'number') return 0;
      if (data.s !== sidikRequest(form)) return 0;

      var sisa = COOLDOWN_MS - (Date.now() - data.t);
      return sisa > 0 ? Math.ceil(sisa / 1000) : 0;
    } catch (error) {
      return 0;
    }
  }

  function setBusy(form, busy) {
    var button = form.querySelector('[data-request-submit]') || form.querySelector('button[type="submit"]');
    var label = form.querySelector('[data-request-submit-label]');
    if (button) {
      button.disabled = busy;
      button.setAttribute('aria-busy', busy ? 'true' : 'false');
    }
    if (label) {
      label.textContent = busy ? 'Mengirim request...' : 'Kirim Request';
    }
  }

  function normalizeValues(form) {
    var judul = form.elements.judul_donghua;
    var nama = form.elements.nama;
    var season = form.elements.season_episode;
    var catatan = form.elements.catatan;

    if (judul) judul.value = trimText(judul.value).slice(0, 160);
    if (nama) nama.value = trimText(nama.value).slice(0, 80);
    if (season) season.value = trimText(season.value).slice(0, 120);
    if (catatan) catatan.value = String(catatan.value || '').trim().slice(0, MAX_CATATAN);
  }

  function handleSuccess(form) {
    var type = getType(form);
    var judul = trimText(getValue(form, 'judul_donghua'));

    simpanSidik(form);
    form.reset();
    clearFieldError(form, 'judul_donghua');
    var counter = form.querySelector('[data-request-counter]');
    if (counter) counter.textContent = '0';

    if (form.__emailGuard && typeof form.__emailGuard.clear === 'function') {
      form.__emailGuard.clear();
    }

    showStatus(form, 'success', 'Request terkirim. Terima kasih!', [
      type === TIPE_DONATUR
        ? 'Terima kasih sudah berdonasi. Requestmu kami dahulukan di antrean.'
        : 'Requestmu sudah masuk antrean dan akan kami baca bergantian.',
      judul ? 'Admin akan menindaklanjuti request "' + judul + '".' : 'Admin akan menindaklanjuti request kamu.',
      'Mohon bersabar, admin kami hanya satu orang.'
    ]);
  }

  function handleFailure(form, payload, httpStatus) {
    var errors = payload && Array.isArray(payload.errors) ? payload.errors : [];
    var lines = [];
    var adaErrorKolom = false;

    errors.forEach(function (item) {
      var field = item && item.field ? String(item.field) : '';
      var message = item && item.message ? String(item.message) : '';

      if (field) {
        lines.push(field + ': ' + message);
        return;
      }

      if (message) lines.push(message);
    });

    if (!lines.length) {
      lines.push(httpStatus === 429
        ? 'Terlalu banyak request dalam waktu singkat. Coba lagi beberapa menit lagi.'
        : 'Server menolak request ini. Coba lagi sebentar lagi atau kirim lewat halaman Kontak.');
    }

    showStatus(form, 'error', 'Request gagal dikirim.', lines);
    if (adaErrorKolom) fokuskanKolomSalah(form);
  }

  function submitRequest(form) {
    if (isSending) return;

    if (!validateForm(form)) {
      fokuskanKolomSalah(form);
      return;
    }

    var sisa = sisaTahan(form);
    if (sisa > 0) {
      showStatus(form, 'warning', 'Request ini baru saja dikirim.', [
        'Isi request masih sama dengan kiriman sebelumnya. Ubah sedikit isinya atau coba lagi dalam ' + sisa + ' detik.'
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
        showStatus(form, 'error', aborted ? 'Pengiriman terlalu lama.' : 'Request gagal dikirim.', [
          aborted
            ? 'Jaringan terputus saat mengirim. Coba lagi ya.'
            : 'Periksa koneksi internet, lalu kirim ulang requestnya.'
        ]);
      })
      .finally(function () {
        window.clearTimeout(timer);
        isSending = false;
        setBusy(form, false);
      });
  }

  function setEmailFeedback(form, message) {
    var feedback = form.querySelector('[data-email-feedback]');
    if (!feedback) return;

    if (!message) {
      feedback.hidden = true;
      feedback.className = 'form-email-feedback';
      feedback.textContent = '';
      return;
    }

    feedback.hidden = false;
    feedback.className = 'form-email-feedback form-email-feedback--error';
    feedback.textContent = '';

    var icon = document.createElement('i');
    icon.className = 'fa-solid fa-triangle-exclamation';
    icon.setAttribute('aria-hidden', 'true');
    feedback.appendChild(icon);

    var text = document.createElement('span');
    text.textContent = message;
    feedback.appendChild(text);
  }

  function fallbackEmailCheck(form, emailOptional) {
    var email = form.elements.email;
    if (!email) return true;

    var value = trimText(email.value);

    if (!value) {
      if (emailOptional) {
        email.classList.remove('is-invalid');
        email.removeAttribute('aria-invalid');
        setEmailFeedback(form, '');
        return true;
      }
      email.classList.add('is-invalid');
      email.setAttribute('aria-invalid', 'true');
      setEmailFeedback(form, MESSAGES.emailKosong);
      email.focus();
      return false;
    }

    var guard = window.SiteEmailGuard;
    var valid = guard && typeof guard.isStrictEmail === 'function'
      ? guard.isStrictEmail(value)
      : /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(value);

    if (!valid) {
      email.classList.add('is-invalid');
      email.setAttribute('aria-invalid', 'true');
      setEmailFeedback(form, MESSAGES.emailFormat);
      email.focus();
      return false;
    }

    email.classList.remove('is-invalid');
    email.removeAttribute('aria-invalid');
    setEmailFeedback(form, '');
    return true;
  }

  function initForm(form) {
    if (!form || form.__requestForm) return;
    form.__requestForm = true;

    var type = getType(form);
    var emailOptional = type !== TIPE_DONATUR;

    form.setAttribute('novalidate', '');

    applyPrefill(form);
    bindCounter(form);
    bindFieldBehaviour(form);

    form.addEventListener('submit', function (event) {
      if (validateForm(form)) return;
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
        emailOptional: emailOptional,
        submitHandler: function () {
          submitRequest(form);
        }
      });
    } else {
      form.addEventListener('submit', function (event) {
        event.preventDefault();
        if (!fallbackEmailCheck(form, emailOptional)) return;
        submitRequest(form);
      }, false);
    }
  }

  function init() {
    var forms = document.querySelectorAll(FORM_SELECTOR);
    Array.prototype.forEach.call(forms, function (form) {
      initForm(form);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
