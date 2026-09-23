(function () {
  'use strict';

  /* ==========================================================
     KONTAK — Validasi email terdaftar/aktif (tanpa API key)
     Lapisan cek:
     1. Format ketat (RFC-lite, lebih ketat dari type="email")
     2. Blokir domain email sekali-pakai (disposable)
     3. Saran koreksi typo domain populer (gmial.com -> gmail.com)
     4. Cek domain aktif via DNS-over-HTTPS (MX, fallback A/AAAA)
        Provider: Cloudflare, fallback Google. Gagal jaringan = lolos
        (fail-open) supaya form tetap bisa dipakai.
     Timing: blur + jeda ketik (debounce) + dicek ulang saat submit.
     ========================================================== */

  var STRICT_EMAIL_RE = /^[A-Za-z0-9](?:[A-Za-z0-9._%+-]{0,62}[A-Za-z0-9])?@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*\.[A-Za-z]{2,}$/;

  var DISPOSABLE_DOMAINS = [
    '10minutemail.com', '10minutemail.net', '20minutemail.com', '33mail.com',
    'anonbox.net', 'burnermail.io', 'byom.de', 'dispostable.com',
    'dropmail.me', 'emailondeck.com', 'fakeinbox.com', 'fakemail.net',
    'getairmail.com', 'getnada.com', 'guerrillamail.com', 'guerrillamail.net',
    'guerrillamail.org', 'guerrillamailblock.com', 'harakirimail.com',
    'inboxkitten.com', 'incognitomail.com', 'jetable.org', 'linshiyouxiang.net',
    'mail-temp.com', 'mail.tm', 'mailcatch.com', 'maildrop.cc',
    'mailexpire.com', 'mailinator.com', 'mailinator.net', 'mailnesia.com',
    'mailpoof.com', 'mailsac.com', 'mintemail.com', 'mohmal.com',
    'moakt.com', 'mytemp.email', 'nada.email', 'owlymail.com',
    'sharklasers.com', 'spam4.me', 'spamgourmet.com', 'tempail.com',
    'temp-mail.io', 'temp-mail.org', 'tempinbox.com', 'tempmail.dev',
    'tempmail.plus', 'tempmailo.com', 'tempr.email', 'throwawaymail.com',
    'tmail.io', 'tmailor.com', 'trash-mail.com', 'trashmail.com',
    'trashmail.de', 'yopmail.com', 'yopmail.fr', 'yopmail.net'
  ];

  var POPULAR_DOMAINS = [
    'gmail.com', 'yahoo.com', 'yahoo.co.id', 'hotmail.com', 'outlook.com',
    'outlook.co.id', 'live.com', 'icloud.com', 'proton.me', 'protonmail.com',
    'aol.com', 'mail.com', 'gmx.com', 'zoho.com', 'ymail.com', 'msn.com'
  ];

  var DOH_PROVIDERS = [
    'https://cloudflare-dns.com/dns-query',
    'https://dns.google/resolve'
  ];

  var MESSAGES = {
    format: 'Format email tidak valid. Periksa lagi penulisannya, contoh: nama@gmail.com.',
    disposable: 'Email sekali-pakai (temp mail) tidak diterima. Gunakan email aktif milikmu.',
    domainDead: 'Domain email ini tidak terdaftar atau tidak bisa menerima email. Gunakan email yang aktif.',
    checking: 'Memeriksa email...',
    valid: 'Email valid dan domain aktif.'
  };

  /* Cache hasil cek domain agar tidak query DoH berulang. */
  var domainCache = Object.create(null);

  function getDomain(email) {
    var at = email.lastIndexOf('@');
    return at === -1 ? '' : email.slice(at + 1).toLowerCase();
  }

  /* Jarak Levenshtein sederhana untuk deteksi typo domain. */
  function editDistance(a, b) {
    if (a === b) return 0;
    var prev = [];
    var i, j;
    for (j = 0; j <= b.length; j++) prev[j] = j;
    for (i = 1; i <= a.length; i++) {
      var cur = [i];
      for (j = 1; j <= b.length; j++) {
        cur[j] = Math.min(
          prev[j] + 1,
          cur[j - 1] + 1,
          prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
        );
      }
      prev = cur;
    }
    return prev[b.length];
  }

  function suggestDomain(domain) {
    if (POPULAR_DOMAINS.indexOf(domain) !== -1) return null;
    var best = null;
    var bestDist = 3; /* toleransi maks 2 karakter beda */
    for (var i = 0; i < POPULAR_DOMAINS.length; i++) {
      var d = editDistance(domain, POPULAR_DOMAINS[i]);
      if (d < bestDist) {
        bestDist = d;
        best = POPULAR_DOMAINS[i];
      }
    }
    return best;
  }

  /* Query DoH: benar jika domain punya MX, atau minimal A/AAAA. */
  function queryDns(provider, domain, type) {
    var url = provider + '?name=' + encodeURIComponent(domain) + '&type=' + type;
    return fetch(url, {
      headers: { accept: 'application/dns-json' },
      mode: 'cors'
    }).then(function (res) {
      if (!res.ok) throw new Error('doh-http-' + res.status);
      return res.json();
    });
  }

  function hasRecords(data) {
    return data && data.Status === 0 && Array.isArray(data.Answer) && data.Answer.length > 0;
  }

  function isNxDomain(data) {
    return data && data.Status === 3;
  }

  /* Hasil: 'active' | 'dead' | 'unknown' (unknown = fail-open). */
  function checkDomainActive(domain) {
    if (domainCache[domain]) return domainCache[domain];

    var attempt = function (idx) {
      if (idx >= DOH_PROVIDERS.length) return Promise.resolve('unknown');
      var provider = DOH_PROVIDERS[idx];

      return queryDns(provider, domain, 'MX').then(function (mx) {
        if (hasRecords(mx)) return 'active';
        if (isNxDomain(mx)) return 'dead';
        /* Domain ada tapi tanpa MX: fallback RFC 5321 ke A/AAAA. */
        return queryDns(provider, domain, 'A').then(function (a) {
          if (hasRecords(a)) return 'active';
          return queryDns(provider, domain, 'AAAA').then(function (aaaa) {
            return hasRecords(aaaa) ? 'active' : 'dead';
          });
        });
      }).catch(function () {
        return attempt(idx + 1);
      });
    };

    var promise = attempt(0).then(function (result) {
      if (result === 'unknown') delete domainCache[domain];
      return result;
    }).catch(function () {
      delete domainCache[domain];
      return 'unknown';
    });

    domainCache[domain] = promise;
    return promise;
  }

  document.addEventListener('DOMContentLoaded', function () {
    var form = document.querySelector('.kontak-form');
    if (!form) return;

    var emailInput = form.querySelector('input[name="email"]');
    var feedback = document.getElementById('kontakEmailFeedback');
    var submitButton = form.querySelector('button[type="submit"]');
    if (!emailInput || !feedback || !submitButton) return;

    /* Validasi custom mengambil alih dari validasi bawaan browser. */
    form.setAttribute('novalidate', '');

    var debounceTimer = null;
    var checkSeq = 0; /* pembatal hasil async yang basi */

    function setState(state, message, suggestion) {
      emailInput.classList.remove('is-invalid', 'is-checking', 'is-valid');
      feedback.className = 'kontak-email-feedback';
      feedback.innerHTML = '';

      if (!state) {
        feedback.hidden = true;
        emailInput.removeAttribute('aria-invalid');
        return;
      }

      feedback.hidden = false;
      feedback.classList.add('kontak-email-feedback--' + state);
      emailInput.classList.add(
        state === 'error' ? 'is-invalid' : state === 'checking' ? 'is-checking' : 'is-valid'
      );
      emailInput.setAttribute('aria-invalid', state === 'error' ? 'true' : 'false');

      if (state === 'checking') {
        /* Spinner CSS murni: fa-circle-notch tidak ada di subset ikon situs. */
        var spinner = document.createElement('span');
        spinner.className = 'kontak-email-spinner';
        spinner.setAttribute('aria-hidden', 'true');
        feedback.appendChild(spinner);
      } else {
        var icon = document.createElement('i');
        icon.className = state === 'error'
          ? 'fa-solid fa-triangle-exclamation'
          : 'fa-solid fa-circle-check';
        icon.setAttribute('aria-hidden', 'true');
        feedback.appendChild(icon);
      }

      var text = document.createElement('span');
      text.textContent = message;
      feedback.appendChild(text);

      if (suggestion) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'kontak-email-suggest';
        btn.textContent = 'Maksudnya @' + suggestion + '?';
        btn.addEventListener('click', function () {
          var local = emailInput.value.split('@')[0];
          emailInput.value = local + '@' + suggestion;
          emailInput.focus();
          validate(false);
        });
        feedback.appendChild(btn);
      }
    }

    /* Mengembalikan Promise<boolean>: email boleh dikirim atau tidak. */
    function validate(fromSubmit) {
      var seq = ++checkSeq;
      var email = emailInput.value.trim();

      if (!email) {
        if (fromSubmit) {
          setState('error', 'Alamat email wajib diisi.');
        } else {
          setState(null);
        }
        return Promise.resolve(false);
      }

      if (!STRICT_EMAIL_RE.test(email)) {
        setState('error', MESSAGES.format);
        return Promise.resolve(false);
      }

      var domain = getDomain(email);

      if (DISPOSABLE_DOMAINS.indexOf(domain) !== -1) {
        setState('error', MESSAGES.disposable);
        return Promise.resolve(false);
      }

      var suggestion = suggestDomain(domain);

      setState('checking', MESSAGES.checking);

      return checkDomainActive(domain).then(function (result) {
        if (seq !== checkSeq) return false; /* input sudah berubah */

        if (result === 'dead') {
          setState('error', MESSAGES.domainDead, suggestion);
          return false;
        }

        /* 'active' atau 'unknown' (DoH tak terjangkau -> jangan blokir). */
        if (suggestion) {
          setState('valid', MESSAGES.valid, suggestion);
        } else {
          setState('valid', MESSAGES.valid);
        }
        return true;
      });
    }

    emailInput.addEventListener('blur', function () {
      clearTimeout(debounceTimer);
      if (emailInput.value.trim()) validate(false);
    });

    emailInput.addEventListener('input', function () {
      clearTimeout(debounceTimer);
      if (emailInput.classList.contains('is-invalid')) setState(null);
      debounceTimer = setTimeout(function () {
        if (emailInput.value.trim()) validate(false);
      }, 700);
    });

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      clearTimeout(debounceTimer);

      var message = form.querySelector('textarea[name="message"]');
      if (message && !message.value.trim()) {
        message.focus();
        message.reportValidity ? message.reportValidity() : null;
        return;
      }

      submitButton.disabled = true;
      submitButton.setAttribute('aria-busy', 'true');

      validate(true).then(function (ok) {
        submitButton.disabled = false;
        submitButton.removeAttribute('aria-busy');
        if (ok) {
          form.submit();
        } else {
          emailInput.focus();
        }
      });
    });
  });
})();
