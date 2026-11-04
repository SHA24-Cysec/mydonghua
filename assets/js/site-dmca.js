(function () {
  'use strict';

  var TIMEOUT_MS = 20000;
  var MAX_URL_HALAMAN = 20;
  var MAX_URL_REFERENSI = 10;
  var isSending = false;

  var FIELD_RULES = {
    nama_lengkap: { required: true, max: 120, label: 'Nama lengkap' },
    email: { required: true, max: 254, label: 'Email' },
    kapasitas: { required: true, max: 40, label: 'Kapasitas pelapor' },
    kontak_tambahan: { required: false, max: 300, label: 'Kontak tambahan' },
    karya_dilindungi: { required: true, max: 1000, label: 'Karya yang diduga dilanggar' },
    url_halaman: { required: true, max: 3000, label: 'URL halaman DonghuaBatch' },
    materi_dilaporkan: { required: true, max: 1500, label: 'Bagian materi yang dilaporkan' },
    url_referensi: { required: false, max: 2000, label: 'Tautan referensi' },
    tanda_tangan: { required: true, max: 120, label: 'Tanda tangan elektronik' },
    pernyataan_itik_baik: { required: true, checkbox: true, label: 'Pernyataan itikad baik' },
    pernyataan_akurasi: { required: true, checkbox: true, label: 'Pernyataan akurasi' }
  };

  function getField(form, name) {
    return form.elements[name] || null;
  }

  function getErrorNode(form, name) {
    return form.querySelector('[data-dmca-error="' + name + '"]');
  }

  function setFieldError(form, name, message) {
    var field = getField(form, name);
    var node = getErrorNode(form, name);
    if (field) {
      field.classList.add('is-invalid');
      field.setAttribute('aria-invalid', 'true');
    }
    if (node) {
      node.textContent = message;
      node.hidden = false;
    }
  }

  function clearFieldError(form, name) {
    var field = getField(form, name);
    var node = getErrorNode(form, name);
    if (field) {
      field.classList.remove('is-invalid');
      field.removeAttribute('aria-invalid');
    }
    if (node) {
      node.textContent = '';
      node.hidden = true;
    }
  }

  function clearAllErrors(form) {
    Object.keys(FIELD_RULES).forEach(function (name) {
      clearFieldError(form, name);
    });
  }

  function parseUrlList(value, max, siteOnly) {
    var lines = String(value || '').split(/\r?\n/).map(function (line) { return line.trim(); }).filter(Boolean);
    if (!lines.length) return { ok: false, message: 'Isi minimal satu URL.' };
    if (lines.length > max) return { ok: false, message: 'Maksimal ' + max + ' URL untuk kolom ini.' };

    for (var i = 0; i < lines.length; i += 1) {
      var url;
      try {
        url = new URL(lines[i]);
      } catch (error) {
        return { ok: false, message: 'URL tidak valid: ' + lines[i] };
      }
      if (url.protocol !== 'https:' && url.protocol !== 'http:') {
        return { ok: false, message: 'URL harus memakai http atau https.' };
      }
      if (url.username || url.password) {
        return { ok: false, message: 'URL tidak boleh memuat username atau password.' };
      }
      if (siteOnly && url.hostname !== 'donghuabatch.com' && url.hostname !== 'www.donghuabatch.com') {
        return { ok: false, message: 'Gunakan URL halaman di donghuabatch.com.' };
      }
    }
    return { ok: true, lines: lines };
  }

  function validateFields(form) {
    clearAllErrors(form);
    var valid = true;

    Object.keys(FIELD_RULES).forEach(function (name) {
      var rule = FIELD_RULES[name];
      var field = getField(form, name);
      if (!field) return;

      if (rule.checkbox) {
        if (rule.required && !field.checked) {
          setFieldError(form, name, rule.label + ' wajib disetujui.');
          valid = false;
        }
        return;
      }

      var value = String(field.value || '').trim();
      if (rule.required && !value) {
        setFieldError(form, name, rule.label + ' wajib diisi.');
        valid = false;
        return;
      }
      if (value.length > rule.max) {
        setFieldError(form, name, rule.label + ' maksimal ' + rule.max + ' karakter.');
        valid = false;
        return;
      }
      if (name === 'kapasitas' && value && value !== 'pemegang_hak' && value !== 'perwakilan_berwenang') {
        setFieldError(form, name, 'Pilih kapasitas pelapor yang tersedia.');
        valid = false;
        return;
      }
      if (name === 'url_halaman' && value) {
        var siteUrls = parseUrlList(value, MAX_URL_HALAMAN, true);
        if (!siteUrls.ok) {
          setFieldError(form, name, siteUrls.message);
          valid = false;
        }
        return;
      }
      if (name === 'url_referensi' && value) {
        var refUrls = parseUrlList(value, MAX_URL_REFERENSI, false);
        if (!refUrls.ok) {
          setFieldError(form, name, refUrls.message);
          valid = false;
        }
      }
    });

    return valid;
  }

  function focusFirstInvalid(form) {
    var names = Object.keys(FIELD_RULES);
    for (var i = 0; i < names.length; i += 1) {
      var field = getField(form, names[i]);
      if (field && field.classList.contains('is-invalid')) {
        field.focus();
        return;
      }
    }
  }

  function showStatus(form, type, title, lines) {
    var status = form.querySelector('#dmcaStatus');
    if (!status) return;
    status.className = 'dmca-status dmca-status--' + type;
    status.textContent = '';

    var heading = document.createElement('strong');
    heading.textContent = title;
    status.appendChild(heading);

    (lines || []).forEach(function (line) {
      var paragraph = document.createElement('p');
      paragraph.textContent = line;
      status.appendChild(paragraph);
    });

    status.hidden = false;
    status.focus();
  }

  function setBusy(form, busy) {
    var button = form.querySelector('[data-dmca-submit]');
    var label = form.querySelector('[data-dmca-submit-label]');
    if (button) {
      button.disabled = busy;
      button.setAttribute('aria-busy', busy ? 'true' : 'false');
    }
    if (label) label.textContent = busy ? 'Mengirim laporan...' : 'Kirim Laporan DMCA';
  }

  function handleSuccess(form) {
    form.reset();
    clearAllErrors(form);
    if (form.__emailGuard && typeof form.__emailGuard.clear === 'function') {
      form.__emailGuard.clear();
    }
    showStatus(form, 'success', 'Laporan terkirim.', [
      'Kami akan meninjau laporan berdasarkan data yang kamu kirim.',
      'Jika diperlukan, klarifikasi atau hasil peninjauan dapat dikirim ke email yang kamu cantumkan.'
    ]);
  }

  function handleFailure(form, payload, httpStatus) {
    var errors = payload && Array.isArray(payload.errors) ? payload.errors : [];
    var lines = [];
    var hasFieldError = false;

    errors.forEach(function (item) {
      var field = item && item.field ? String(item.field) : '';
      var message = item && item.message ? String(item.message) : '';
      if (!message) return;
      if (field && Object.prototype.hasOwnProperty.call(FIELD_RULES, field)) {
        setFieldError(form, field, message);
        hasFieldError = true;
      } else {
        lines.push(message);
      }
    });

    if (httpStatus === 429) {
      lines.unshift('Terlalu banyak kiriman dalam waktu singkat. Tunggu beberapa menit, lalu coba lagi.');
    } else if (!lines.length && !hasFieldError) {
      lines.push('Server menolak laporan ini. Coba lagi sebentar lagi atau kirim melalui halaman Kontak.');
    } else if (hasFieldError && !lines.length) {
      lines.push('Periksa kolom yang ditandai, lalu kirim ulang.');
    }

    showStatus(form, 'error', 'Laporan gagal dikirim.', lines);
    if (hasFieldError) focusFirstInvalid(form);
  }

  function submitReport(form) {
    if (isSending) return;
    if (!validateFields(form)) {
      focusFirstInvalid(form);
      return;
    }

    var honeypot = getField(form, '_gotcha');
    if (honeypot && String(honeypot.value || '').trim()) {
      showStatus(form, 'error', 'Laporan tidak dapat dikirim.', ['Kosongkan kolom tambahan dan coba lagi.']);
      return;
    }

    isSending = true;
    setBusy(form, true);

    var controller = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = window.setTimeout(function () {
      if (controller) controller.abort();
    }, TIMEOUT_MS);

    var options = {
      method: 'POST',
      body: new FormData(form),
      headers: { Accept: 'application/json' },
      mode: 'cors',
      credentials: 'omit',
      referrerPolicy: 'no-referrer'
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
      .catch(function () {
        showStatus(form, 'error', 'Laporan gagal dikirim.', [
          'Koneksi terganggu atau server tidak merespons. Periksa jaringan, lalu coba lagi.',
          'Jika masih gagal, kirim laporan melalui halaman Kontak.'
        ]);
      })
      .finally(function () {
        window.clearTimeout(timer);
        isSending = false;
        setBusy(form, false);
      });
  }

  function fallbackEmailCheck(form) {
    var email = getField(form, 'email');
    if (!email) return true;
    var value = String(email.value || '').trim();
    if (!value || !email.checkValidity()) {
      setFieldError(form, 'email', 'Isi alamat email yang valid.');
      email.focus();
      return false;
    }
    return true;
  }

  function initForm(form) {
    if (!form || form.__dmcaForm) return;
    form.__dmcaForm = true;
    form.setAttribute('novalidate', '');

    form.addEventListener('submit', function (event) {
      if (validateFields(form)) return;
      event.preventDefault();
      if (typeof event.stopImmediatePropagation === 'function') {
        event.stopImmediatePropagation();
      } else {
        event.stopPropagation();
      }
      focusFirstInvalid(form);
    }, false);

    var guard = window.SiteEmailGuard;
    if (guard && typeof guard.attach === 'function') {
      guard.attach(form, {
        emailOptional: false,
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

  function init() {
    var form = document.querySelector('[data-dmca-form]');
    if (form) initForm(form);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
