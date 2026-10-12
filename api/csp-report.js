// Penerima laporan pelanggaran CSP untuk donghuabatch.com (Vercel Function, CommonJS).
// Dua format yang ditangani:
//   - application/csp-report   : dari direktif report-uri
//   - application/reports+json : dari direktif report-to
// Ringkasan ditulis ke log runtime Vercel, tidak disimpan ke basis data.
'use strict';

var BATAS_BADAN = 20000;
var BATAS_TUNGGU = 2000;

function potong(nilai, batas) {
  var s = nilai === undefined || nilai === null ? '' : String(nilai);
  return s.length > batas ? s.slice(0, batas) + '...' : s;
}

function bacaBadan(req) {
  return new Promise(function (selesai) {
    if (req.body && typeof req.body === 'object') return selesai(req.body);
    if (typeof req.body === 'string' && req.body.length) return selesai(req.body);

    var kumpul = '';
    var selesaiSekali = false;
    function tutup(nilai) {
      if (selesaiSekali) return;
      selesaiSekali = true;
      selesai(nilai);
    }

    // Vercel bisa sudah menghabiskan stream dan mengisi req.body.
    // Tanpa penjaga ini, handler menggantung sampai batas waktu fungsi.
    if (req.readableEnded) return tutup('');
    var jam = setTimeout(function () { tutup(kumpul); }, BATAS_TUNGGU);

    req.on('data', function (potongan) {
      if (kumpul.length < BATAS_BADAN) kumpul += potongan;
    });
    req.on('end', function () { clearTimeout(jam); tutup(kumpul); });
    req.on('error', function () { clearTimeout(jam); tutup(kumpul); });
    req.on('close', function () { clearTimeout(jam); tutup(kumpul); });
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ pesan: 'Hanya menerima POST' });
    return;
  }

  var mentah = await bacaBadan(req);
  var jumlah = 0;

  try {
    var data = typeof mentah === 'string' ? JSON.parse(mentah) : mentah;
    var daftar = Array.isArray(data) ? data : [data];

    for (var i = 0; i < daftar.length && i < 20; i++) {
      var item = daftar[i] || {};
      var lapor = item['csp-report'] || item.body || item;
      console.log('CSP-LAPOR ' + JSON.stringify({
        dokumen: potong(lapor['document-uri'] || lapor.documentURL, 200),
        direktif: potong(lapor['violated-directive'] || lapor.effectiveDirective, 120),
        diblokir: potong(lapor['blocked-uri'] || lapor.blockedURL, 200),
        sumber: potong(lapor['source-file'] || lapor.sourceFile, 200),
        baris: lapor['line-number'] || lapor.lineNumber || null
      }));
      jumlah++;
    }
  } catch (e) {
    console.log('CSP-LAPOR tidak terbaca: ' + potong(e && e.message, 200));
  }

  if (jumlah === 0) console.log('CSP-LAPOR diterima tanpa entri terbaca');
  res.status(204).end();
};
