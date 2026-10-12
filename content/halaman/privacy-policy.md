---
date : '2026-07-23T10:45:00+07:00'
draft : false
title : 'Kebijakan Privasi'
deskripsi : 'Kebijakan privasi DonghuaBatch mengenai data, cookie, dan hak pengguna.'
layout : halaman
url : privacy-policy
---

Berlaku sejak 23 Juli 2026. Terakhir diperbarui 12 Oktober 2026.

Halaman ini menjelaskan data apa yang kami kumpulkan, siapa yang menerimanya, dan hak apa yang kamu punya. Kami berusaha menuliskannya secara konkret: setiap penyedia pihak ketiga disebut namanya, bukan disamarkan sebagai "pihak ketiga".

## 1. Ringkasan singkat

- Kami tidak menjual data pribadimu.
- Formulir di situs ini dikirim lewat Formspree.
- Statistik kunjungan memakai Google Analytics 4. Tag itu baru memuat cookie setelah kamu menyetujui lewat panel "Pengaturan Cookie" di footer.
- Kolom email di formulir memicu pemeriksaan domain ke penyedia DNS publik. Yang dikirim hanya bagian domainnya, bukan alamat lengkapmu.
- Situs ini tidak memasang cookie sendiri. Preferensi seperti favorit dan riwayat tontonan disimpan di penyimpanan lokal perambanmu.
- Skrip iklan Adsterra dan skrip penulisan tautan Safelinku dimuat oleh layanan pihak ketiga dan tidak menunggu pilihan di panel cookie. Kami menyebutkannya supaya halaman ini jujur soal apa yang benar-benar terjadi.

## 2. Siapa pengendali data

Pengendali data untuk situs ini adalah pengelola DonghuaBatch. Saluran resmi untuk pertanyaan, permintaan, atau keluhan soal data pribadi adalah halaman [Kontak](/kontak/).

## 3. Data yang kami kumpulkan

| Jenis data | Dari mana | Untuk apa |
|---|---|---|
| Alamat email dan isi pesan | Kamu, lewat formulir di halaman Kontak | Menjawab pesanmu |
| Judul donghua, alamat halaman, bagian tautan, jenis masalah, keterangan, dan email (opsional) | Kamu, lewat formulir di halaman Laporkan Link Mati | Memperbaiki tautan unduhan yang rusak |
| Nama domain email saja | Pemeriksaan otomatis saat kolom email kehilangan fokus | Memastikan domain email aktif dan menyarankan koreksi salah tulis |
| Halaman yang dibuka, jenis peramban dan perangkat, perkiraan lokasi, waktu akses | Google Analytics 4, setelah kamu menyetujui | Statistik kunjungan dan perbaikan situs |
| Pengenal perangkat dan interaksi dengan iklan | Jaringan iklan Adsterra | Menampilkan dan mengukur iklan |
| Nama, isi komentar, dan waktu kirim | Disqus, hanya kalau kamu menekan tombol untuk membuka kolom komentar | Menampilkan diskusi di halaman donghua |

## 4. Pemeriksaan domain email

Ini bagian yang paling jarang dijelaskan situs lain, jadi kami jelaskan rinci.

- Yang dikirim hanya **domain**, bukan alamat lengkap. Untuk `budi@gmail.com`, yang terkirim adalah `gmail.com`. Bagian sebelum tanda at tidak pernah keluar dari perambanmu.
- Penerimanya dua penyedia DNS publik: Cloudflare (`cloudflare-dns.com`) dan Google Public DNS (`dns.google`).
- Pemeriksaan berjalan saat kolom email kehilangan fokus, jadi bisa terjadi walau kamu akhirnya tidak menekan tombol kirim.
- Kalau kedua penyedia tidak terjangkau, pemeriksaan dilewati dan formulir tetap bisa dikirim.
- Hasil pemeriksaan tidak kami simpan di server. Situs ini tidak punya server sendiri untuk itu.

Kami memakai pemeriksaan ini untuk mencegah salah tulis domain dan email sekali-pakai pada formulir. Kalau kamu tidak ingin domainmu diperiksa, jangan isi kolom email, atau gunakan pengaturan peramban yang memblokir permintaan ke kedua domain itu.

## 5. Pihak ketiga yang menerima data

| Penyedia | Peran | Data yang diterima |
|---|---|---|
| Formspree (`formspree.io`) | Mengantar kiriman formulir Kontak dan Laporkan Link Mati ke kotak masuk kami | Seluruh isi formulir, ditambah alamat IP dan identitas peramban dari permintaan pengiriman |
| Google Analytics 4 (`G-7B40JB824Z`) | Statistik kunjungan | Data kunjungan dan pengenal cookie, hanya setelah kamu menyetujui. Tanpa persetujuan, tag mengirim ping tanpa cookie |
| Cloudflare (`cloudflare-dns.com`) | Pemeriksaan keberadaan domain email | Hanya domain email |
| Google Public DNS (`dns.google`) | Cadangan pemeriksaan yang sama | Hanya domain email |
| Adsterra | Jaringan iklan | Data perangkat dan pengenal yang dipasang jaringan itu sendiri. Kami tidak mengatur isi penyimpanannya, dan domain penyaji skripnya bisa berubah |
| Disqus (`mydonghua.disqus.com`) | Kolom komentar | Data akun dan kunjungan, dipasang hanya setelah kamu menekan tombol buka komentar |
| Safelinku (`sfl.gl`) | Menulis ulang tautan unduhan keluar | Informasi klik pada tautan yang diproses |
| Vercel | Penyedia hosting | Log permintaan seperti alamat IP, identitas peramban, dan waktu akses untuk penyajian dan keamanan situs |

Beberapa tautan keluar mengarah ke layanan lain, misalnya Saweria untuk dukungan, Terabox dan Google Drive untuk berkas unduhan, serta Instagram. Layanan itu baru menerima datamu kalau kamu menekan tautannya. Kami tidak menanamkan skrip mereka di situs ini.

## 6. Cookie dan penyimpanan di perangkatmu

**Cookie milik situs ini: tidak ada.** Kami tidak memasang cookie sendiri.

Preferensi dan riwayat disimpan di penyimpanan lokal peramban (`localStorage` dan `sessionStorage`), yang isinya tidak dikirim ke server kami:

| Kunci | Isinya | Kegunaan |
|---|---|---|
| `donghuabatch_consent` | Pilihan persetujuanmu | Mengingat apakah tag Google boleh menyala |
| `donghuabatch_favorites` | Daftar id donghua | Daftar favoritmu |
| `donghuabatch_watch_statuses` | Status tontonan per donghua | Menandai yang sedang atau sudah ditonton |
| `donghuabatch_recently_viewed` | Daftar donghua terakhir dibuka | Rel "terakhir dibuka" di beranda |
| `donghuabatch_search_history` | Riwayat kata kunci | Saran pencarian berikutnya |
| `donghuabatch:laporan-link-mati:terakhir` | Waktu kirim laporan terakhir | Membatasi kiriman laporan berulang |
| `site_floating_ad_closed` | Penanda sesi | Menghindari menampilkan kembali iklan mengambang yang sudah kamu tutup |

Semua itu bisa kamu hapus kapan saja lewat pengaturan situs di peramban (biasanya "Hapus data situs" atau "Cookie dan data situs"). Menghapusnya tidak menghilangkan isi laporan yang sudah kamu kirim.

Cookie pihak ketiga berasal dari layanan di bagian 5: Google Analytics setelah kamu menyetujui, Disqus setelah kamu membuka kolom komentar, dan Adsterra saat iklan ditampilkan. Panel "Pengaturan Cookie" di footer hanya mengatur tag Google; pilihan itu tidak mematikan skrip iklan Adsterra maupun skrip Safelinku.

## 7. Dasar hukum pemrosesan

Kami memproses data dengan dasar berikut, mengacu pada Undang-Undang Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi:

- **Persetujuanmu** untuk statistik kunjungan, iklan, dan komentar. Persetujuan ini bisa kamu tarik kapan saja lewat panel Pengaturan Cookie atau dengan menghapus data situs.
- **Pelaksanaan permintaanmu** untuk data yang kamu kirim lewat formulir, karena kami memerlukannya untuk menjawab pesan atau memperbaiki tautan.
- **Kepentingan yang sah** untuk keamanan situs, pencegahan spam, dan pemeliharaan tautan unduhan, misalnya memeriksa domain email sekali-pakai.

## 8. Masa simpan

- Kiriman formulir disimpan sampai pesan atau laporan selesai ditindaklanjuti, lalu dihapus berkala.
- Data analitik mengikuti pengaturan retensi properti Google Analytics kami. Google menyediakan pilihan 2 bulan atau 14 bulan untuk data tingkat pengguna pada properti standar.
- Hasil pemeriksaan domain email tidak disimpan di server kami, hanya dipakai saat itu juga.
- Log permintaan di hosting disimpan sesuai kebijakan penyedia hosting.
- Penyimpanan lokal di perangkatmu bertahan sampai kamu menghapusnya sendiri.

## 9. Hakmu

Sebagai subjek data, kamu berhak:

- Meminta informasi tentang data yang kami proses dan salinannya.
- Meminta koreksi data yang tidak akurat.
- Meminta penghapusan data.
- Menarik persetujuan yang pernah kamu berikan.
- Mengajukan keberatan atau meminta pembatasan pemrosesan.
- Mengajukan keluhan kepada lembaga pengawas pelindungan data pribadi.

Untuk memakai hak itu, hubungi kami lewat halaman [Kontak](/kontak/) dan sebutkan permintaanmu dengan jelas. Kami akan menindaklanjuti dan memberi tahu hasilnya.

## 10. Anak-anak

Situs ini tidak ditujukan untuk anak-anak. Kami tidak dengan sengaja mengumpulkan data anak. Kalau kamu orang tua atau wali dan mengetahui anakmu mengirim data lewat formulir, hubungi kami dan kami akan menghapusnya.

## 11. Perubahan kebijakan

Kalau ada perubahan penting, kami perbarui halaman ini dan mencantumkan tanggal berlaku serta tanggal pembaruan terakhir di bagian atas. Kami tidak mencantumkan bunyi "dengan mengakses situs ini kamu menyetujui kebijakan ini", karena persetujuan untuk statistik, iklan, dan komentar kami minta secara tegas lewat panel Pengaturan Cookie.
