/* SEC-06: Panel Pengaturan Cookie.
   Menyimpan pilihan pengunjung, mengirim gtag('consent','update'), dan
   mengelola fokus panel mengikuti pola dialog lain di situs ini. */
(function () {
  'use strict';

  const KUNCI = 'donghuabatch_consent';
  const panel = document.getElementById('consent-panel');
  if (!panel) return;

  const pemicu = document.getElementById('consent-buka');
  const tombolSetuju = document.getElementById('consent-setuju');
  const tombolTolak = document.getElementById('consent-tolak');
  const tombolTutup = document.getElementById('consent-tutup');
  const status = document.getElementById('consent-panel-status');
  const focusManager = window.DonghuaFocusManager;

  const LABEL = {
    belum: 'Status: belum dipilih.',
    diterima: 'Status: diterima. Penyimpanan analytics dan iklan Google aktif.',
    ditolak: 'Status: ditolak. Penyimpanan analytics dan iklan Google dimatikan.'
  };

  let fokusTerakhir = null;
  let terbuka = false;

  function baca() {
    try {
      const nilai = localStorage.getItem(KUNCI);
      return nilai === 'diterima' || nilai === 'ditolak' ? nilai : 'belum';
    } catch (error) {
      return 'belum';
    }
  }

  function simpan(nilai) {
    try {
      localStorage.setItem(KUNCI, nilai);
    } catch (error) {
      console.warn('[Consent] localStorage error', error);
    }
  }

  function kirimConsent(nilai) {
    if (typeof window.gtag !== 'function') return;
    const izin = nilai === 'diterima' ? 'granted' : 'denied';
    window.gtag('consent', 'update', {
      ad_storage: izin,
      ad_user_data: izin,
      ad_personalization: izin,
      analytics_storage: izin
    });
  }

  function perbaruiStatus() {
    if (status) status.textContent = LABEL[baca()] || LABEL.belum;
  }

  function fokusKePanel() {
    if (focusManager) {
      focusManager.scheduleFocus(panel, '#consent-setuju');
    } else if (tombolSetuju) {
      tombolSetuju.focus();
    }
    // Jaring pengaman: bila fokus belum masuk panel (mis. elemen belum
    // dianggap terlihat saat percobaan pertama), coba sekali lagi.
    window.setTimeout(function () {
      if (!terbuka || panel.contains(document.activeElement)) return;
      if (focusManager) {
        focusManager.focusFirst(panel, '#consent-setuju');
      } else if (tombolSetuju) {
        tombolSetuju.focus();
      }
    }, 260);
  }

  function bukaPanel() {
    if (terbuka) return;
    fokusTerakhir = document.activeElement;
    terbuka = true;
    if (focusManager) {
      focusManager.setInteractive(panel, true);
    } else {
      panel.inert = false;
      panel.setAttribute('aria-hidden', 'false');
    }
    panel.classList.add('is-open');
    perbaruiStatus();
    fokusKePanel();
  }

  function tutupPanel() {
    if (!terbuka) return;
    terbuka = false;
    panel.classList.remove('is-open');
    if (focusManager) {
      focusManager.setInteractive(panel, false);
      focusManager.restoreFocus(fokusTerakhir, '#consent-buka');
    } else {
      panel.inert = true;
      panel.setAttribute('aria-hidden', 'true');
      if (fokusTerakhir && typeof fokusTerakhir.focus === 'function') fokusTerakhir.focus();
    }
  }

  function pilih(nilai) {
    simpan(nilai);
    kirimConsent(nilai);
    perbaruiStatus();
    tutupPanel();
  }

  if (pemicu) pemicu.addEventListener('click', bukaPanel);
  if (tombolSetuju) tombolSetuju.addEventListener('click', function () { pilih('diterima'); });
  if (tombolTolak) tombolTolak.addEventListener('click', function () { pilih('ditolak'); });
  if (tombolTutup) tombolTutup.addEventListener('click', tutupPanel);

  panel.addEventListener('click', function (event) {
    if (event.target === panel) tutupPanel();
  });

  document.addEventListener('keydown', function (event) {
    if (!terbuka) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      tutupPanel();
      return;
    }
    if (focusManager) focusManager.trapFocus(event, panel);
  });
})();
