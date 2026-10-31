(function () {
  'use strict';

  var root = document.querySelector('[data-gdrive-converter]');
  if (!root) return;

  var form = root.querySelector('[data-gdrive-form]');
  var input = root.querySelector('[data-gdrive-input]');
  var clearBtn = root.querySelector('[data-gdrive-clear]');
  var statusBox = root.querySelector('[data-gdrive-status]');
  var resultBox = root.querySelector('[data-gdrive-result]');
  var outputInput = root.querySelector('[data-gdrive-output]');
  var openBtn = root.querySelector('[data-gdrive-open]');
  var copyBtn = root.querySelector('[data-gdrive-copy]');
  var copyLabel = root.querySelector('[data-gdrive-copy-label]');

  if (!form || !input || !statusBox || !resultBox || !outputInput || !openBtn || !copyBtn) {
    return;
  }

  var MAX_INPUT_LENGTH = 2048;
  var ALLOWED_HOSTS = {
    'drive.usercontent.google.com': true,
    'drive.google.com': true,
    'docs.google.com': true
  };
  var SHORTLINK_HOSTS = {
    'sfl.gl': true,
    'safelinku.com': true,
    'www.safelinku.com': true,
    'bit.ly': true,
    'tinyurl.com': true,
    'ouo.io': true,
    'shrinkme.io': true
  };
  var FILE_ID_REGEX = /^[A-Za-z0-9_-]{10,120}$/;
  var PATH_ID_REGEX = /\/file\/d\/([A-Za-z0-9_-]{10,120})(?:\/|$)/;
  var FOLDER_PATH_REGEX = /\/drive\/(?:u\/\d+\/)?folders\/([A-Za-z0-9_-]{10,120})/;

  var currentPreviewUrl = '';
  var copyTimer = null;

  function setStatus(type, message) {
    if (!message) {
      statusBox.hidden = true;
      statusBox.textContent = '';
      statusBox.className = 'gdrive-tool-status';
      return;
    }
    statusBox.className = 'gdrive-tool-status is-' + type;
    statusBox.textContent = message;
    statusBox.hidden = false;
  }

  function hideResult() {
    currentPreviewUrl = '';
    outputInput.value = '';
    resultBox.hidden = true;
  }

  function normalizeCandidate(raw) {
    var trimmed = String(raw || '').trim();
    if (!trimmed) return '';
    if (/^(?:drive\.usercontent\.google\.com|drive\.google\.com|docs\.google\.com)\//i.test(trimmed)) {
      return 'https://' + trimmed;
    }
    return trimmed;
  }

  function parseGoogleDriveLink(raw) {
    if (!raw) {
      return { ok: false, empty: true };
    }
    if (String(raw).length > MAX_INPUT_LENGTH) {
      return {
        ok: false,
        error: 'Tautan terlalu panjang. Pastikan hanya menempel satu URL Google Drive.'
      };
    }

    var candidate = normalizeCandidate(raw);
    var parsed;
    try {
      parsed = new URL(candidate);
    } catch (e) {
      return {
        ok: false,
        error: 'Format URL tidak dikenali. Tempel alamat lengkap dari kolom browser halaman Google Drive.'
      };
    }

    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return {
        ok: false,
        error: 'Hanya tautan HTTPS resmi Google Drive yang didukung.'
      };
    }

    var host = parsed.hostname.toLowerCase();
    if (SHORTLINK_HOSTS[host]) {
      return {
        ok: false,
        error: 'Tautan ini masih berupa shortlink. Selesaikan halaman shortlink sampai masuk ke halaman Google Drive, lalu tempel alamat Google Drive di sini.'
      };
    }

    if (!ALLOWED_HOSTS[host]) {
      return {
        ok: false,
        error: 'Domain bukan milik Google Drive. Gunakan tautan dari drive.usercontent.google.com atau drive.google.com.'
      };
    }

    if (FOLDER_PATH_REGEX.test(parsed.pathname)) {
      return {
        ok: false,
        error: 'Tautan tersebut sudah berupa folder Google Drive, bukan file tunggal yang terkena limit.'
      };
    }

    var fileId = '';
    var pathMatch = parsed.pathname.match(PATH_ID_REGEX);
    if (pathMatch && pathMatch[1]) {
      fileId = pathMatch[1];
    } else {
      var paramId = parsed.searchParams.get('id');
      if (paramId) {
        fileId = paramId.trim();
      }
    }

    if (!fileId || !FILE_ID_REGEX.test(fileId)) {
      return {
        ok: false,
        error: 'Kode ID file Google Drive tidak ditemukan pada tautan tersebut. Pastikan menyalin alamat URL secara utuh.'
      };
    }

    return {
      ok: true,
      fileId: fileId,
      previewUrl: 'https://drive.google.com/file/d/' + encodeURIComponent(fileId) + '/view'
    };
  }

  function handleConvert(showEmptyWarning) {
    var raw = input.value;
    var res = parseGoogleDriveLink(raw);

    if (res.empty) {
      hideResult();
      if (showEmptyWarning) {
        setStatus('error', 'Tempel dulu alamat URL Google Drive yang terkena limit pada kolom di atas.');
        input.focus();
      } else {
        setStatus('', '');
      }
      return;
    }

    if (!res.ok) {
      hideResult();
      setStatus('error', res.error);
      return;
    }

    currentPreviewUrl = res.previewUrl;
    outputInput.value = res.previewUrl;
    resultBox.hidden = false;
    setStatus('success', 'Link berhasil diubah ke mode preview. Klik tombol Buka Halaman Preview, lalu lanjut ke Langkah 3 di bawah.');
  }

  function fallbackCopy(text) {
    var temp = document.createElement('textarea');
    temp.value = text;
    temp.setAttribute('readonly', '');
    temp.style.position = 'fixed';
    temp.style.opacity = '0';
    temp.style.pointerEvents = 'none';
    document.body.appendChild(temp);
    temp.select();
    var copied = false;
    try {
      copied = document.execCommand('copy');
    } catch (e) {
      copied = false;
    }
    document.body.removeChild(temp);
    return copied;
  }

  function showCopiedFeedback() {
    if (!copyLabel) return;
    copyLabel.textContent = 'Tersalin';
    if (copyTimer) clearTimeout(copyTimer);
    copyTimer = setTimeout(function () {
      copyLabel.textContent = 'Salin Link';
    }, 2000);
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    handleConvert(true);
  });

  input.addEventListener('input', function () {
    if (!input.value.trim()) {
      hideResult();
      setStatus('', '');
      return;
    }
    handleConvert(false);
  });

  if (clearBtn) {
    clearBtn.addEventListener('click', function () {
      input.value = '';
      hideResult();
      setStatus('', '');
      input.focus();
    });
  }

  openBtn.addEventListener('click', function () {
    if (!currentPreviewUrl || currentPreviewUrl.indexOf('https://drive.google.com/file/d/') !== 0) {
      return;
    }
    var win = window.open(currentPreviewUrl, '_blank', 'noopener,noreferrer');
    if (win) {
      win.opener = null;
    }
  });

  copyBtn.addEventListener('click', function () {
    if (!currentPreviewUrl) return;
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard.writeText(currentPreviewUrl).then(showCopiedFeedback, function () {
        if (fallbackCopy(currentPreviewUrl)) showCopiedFeedback();
      });
    } else if (fallbackCopy(currentPreviewUrl)) {
      showCopiedFeedback();
    }
  });
})();
