(function () {
  'use strict';

  function showToast(message, type) {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.style.cssText =
      'position:fixed;bottom:1.5rem;left:50%;transform:translateX(-50%) translateY(12px);' +
      'z-index:9999;max-width:90vw;padding:0.7rem 1.2rem;border-radius:0.8rem;' +
      'font:inherit;font-size:0.85rem;font-weight:700;color:#fff;' +
      'opacity:0;transition:opacity .25s ease,transform .25s ease;pointer-events:none;' +
      'border:1px solid ' + (type === 'success' ? 'rgba(34,211,238,0.35)' : 'rgba(244,63,94,0.35)') + ';' +
      'background:' + (type === 'success' ? 'rgba(6,18,23,0.92)' : 'rgba(30,8,12,0.92)') + ';' +
      'box-shadow:0 0 18px ' + (type === 'success' ? 'rgba(34,211,238,0.18)' : 'rgba(244,63,94,0.18)') + ';';
    document.body.appendChild(toast);
    requestAnimationFrame(function () {
      toast.style.opacity = '1';
      toast.style.transform = 'translateX(-50%) translateY(0)';
    });
    setTimeout(function () {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(-50%) translateY(12px)';
      setTimeout(function () { toast.remove(); }, 300);
    }, 3000);
  }

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
        showToast('Laporan link berhasil dikirim.', 'success');
      }).catch(function (error) {
        showToast('Gagal mengirim laporan.', 'error');
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
