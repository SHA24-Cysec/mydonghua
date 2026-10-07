(function () {
  'use strict';

  /* ==========================================================
     TOMBOL LAPORKAN LINK MATI (halaman donghua)
     Sejak revisi laporan link, tombol "Laporkan Link Mati" di
     bawah daftar download adalah tautan biasa menuju halaman
     /laporkan-link-mati/ dengan kolom judul dan URL halaman
     yang sudah terisi otomatis. Pengiriman laporan ditangani
     halaman tujuan lewat Formspree.

     Skrip ini hanya menambah satu sentuhan: tautan pintas
     "laporkan link" pada baris informasi di bagian atas halaman
     akan menggulir ke tombol dan menyorotnya supaya pengunjung
     tahu bagian mana yang harus diklik.
     ========================================================== */

  document.addEventListener('DOMContentLoaded', function () {
    var reportButton = document.getElementById('reportButton');
    var reportJumpLinks = Array.from(document.querySelectorAll('[data-report-jump]'));
    if (!reportButton) return;

    function highlightReportButton() {
      reportButton.classList.remove('is-highlighted');
      requestAnimationFrame(function () {
        reportButton.classList.add('is-highlighted');
        setTimeout(function () {
          reportButton.classList.remove('is-highlighted');
        }, 1800);
      });
    }

    function jumpToReportButton(event) {
      if (event) event.preventDefault();

      var topOffset = 110;
      var rect = reportButton.getBoundingClientRect();
      var scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      var targetTop = rect.top + scrollTop - topOffset;

      window.scrollTo({
        top: Math.max(targetTop, 0),
        behavior: 'smooth'
      });

      highlightReportButton();
      setTimeout(function () {
        reportButton.focus({ preventScroll: true });
      }, 450);
    }

    reportJumpLinks.forEach(function (link) {
      link.addEventListener('click', jumpToReportButton);
    });
  });
})();
