(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    const reportButton = document.getElementById('reportButton');
    const reportJumpLinks = Array.from(document.querySelectorAll('[data-report-jump]'));
    if (!reportButton) return;

    let isSendingReport = false;
    const fallbackEndpoint = 'https://script.google.com/macros/s/AKfycbzUgz8gd9WRDuGmuPPs5WBHIgZ0L3T1tJLwdtL_RLQW7Rb5e7wu6mJZa9cP3w1mEKnbxw/exec';
    const scriptUrl = reportButton.getAttribute('data-report-endpoint') || fallbackEndpoint;

    function setSendingState(sending) {
      reportButton.disabled = sending;
      reportButton.setAttribute('aria-busy', sending ? 'true' : 'false');
    }

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

      const topOffset = 110;
      const rect = reportButton.getBoundingClientRect();
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const targetTop = rect.top + scrollTop - topOffset;

      window.scrollTo({
        top: Math.max(targetTop, 0),
        behavior: 'smooth'
      });

      highlightReportButton();
      setTimeout(function () {
        reportButton.focus({ preventScroll: true });
      }, 450);
    }

    function sendReport(event) {
      if (event) event.preventDefault();
      if (isSendingReport) return;

      isSendingReport = true;
      setSendingState(true);

      const currentUrl = window.location.href;

      fetch(scriptUrl + '?url=' + encodeURIComponent(currentUrl), {
        method: 'GET',
        mode: 'no-cors'
      }).then(function () {
        alert('✅ Laporan link berhasil dikirim untuk halaman ini.');
      }).catch(function (error) {
        alert('❌ Terjadi kesalahan saat mengirim laporan: ' + error);
      }).finally(function () {
        isSendingReport = false;
        setSendingState(false);
      });
    }

    reportButton.addEventListener('click', sendReport);
    reportJumpLinks.forEach(function (link) {
      link.addEventListener('click', jumpToReportButton);
    });
  });
})();
