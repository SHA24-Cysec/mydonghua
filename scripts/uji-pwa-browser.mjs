#!/usr/bin/env node
'use strict';

// Uji PWA dengan peramban sungguhan untuk CI.
//
// Cara pakai:
//   npm run build          (wajib, harness memakai isi public/)
//   node scripts/uji-pwa-browser.mjs
//   node scripts/uji-pwa-browser.mjs --pilih=T4,T7      (jalankan sebagian uji)
//
// Peramban dicari lewat urutan: env CHROME_PATH, lalu lokasi lazim, lalu
// `google-chrome` dan `chromium` di PATH. Di runner GitHub ubuntu-latest
// Google Chrome sudah terpasang, jadi tidak perlu diunduh.
//
// Tanpa dependensi npm. Protokol DevTools diakses lewat WebSocket global
// (tersedia di Node 22 ke atas). Di Node yang lebih lama, paket `ws`
// dipakai bila ada di jalur resolusi modul, dan bila tidak ada harness
// berhenti dengan pesan jelas. Nyatakan `UJI_PWA_SOKET=1` untuk memaksa
// pemakaian paket `ws`.

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { get as httpGet } from 'node:http';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const AKAR_REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const AKAR_PUBLIK = process.env.UJI_PWA_PUBLIK
  ? resolve(process.env.UJI_PWA_PUBLIK)
  : join(AKAR_REPO, 'public');
const DIR_KELUARAN = process.env.UJI_PWA_KELUARAN || join(tmpdir(), 'uji-pwa');
const BATAS_AKHIR = 300000;
const mulai = Date.now();

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.map': 'application/json; charset=utf-8'
};

function catat(pesan) {
  process.stdout.write(`${pesan}\n`);
}

function galat(pesan) {
  process.stderr.write(`${pesan}\n`);
}

function jeda(milidetik) {
  return new Promise((selesai) => setTimeout(selesai, milidetik));
}

function baca(relatif) {
  return readFileSync(join(AKAR_PUBLIK, relatif), 'utf8');
}

function judulHalaman(relatif) {
  const cocok = baca(relatif).match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return cocok ? cocok[1].trim() : '';
}

// Sama seperti cara scripts/audit-pwa.mjs membaca daftar di service worker.
function daftarArray(sumber, nama) {
  const cocok = sumber.match(new RegExp(`${nama}\\s*=\\s*\\[([\\s\\S]*?)\\]`));
  if (!cocok) return [];
  return [...cocok[1].matchAll(/'([^']+)'/g)].map((hasil) => hasil[1]);
}

function versiCachePublik() {
  const sumber = baca('sw.js');
  const cocok = sumber.match(/CACHE_VERSION\s*=\s*'([^']+)'/);
  if (!cocok) throw new Error('CACHE_VERSION tidak ditemukan di public/sw.js');
  const daftar = [...new Set([...daftarArray(sumber, 'CATALOG_DOCUMENTS'), ...daftarArray(sumber, 'APP_SHELL')])];
  return { versi: cocok[1], jalur: daftar };
}

// Peladen statis kecil untuk public/. Sengaja sederhana: tanpa header Vary,
// supaya pencocokan cache service worker tidak bergantung pada header.
function buatPeladen(pengganti = new Map()) {
  const soket = new Set();
  const peladen = createServer((permintaan, tanggapan) => {
    let jalur;
    try {
      jalur = decodeURIComponent(new URL(permintaan.url, 'http://127.0.0.1').pathname);
    } catch {
      tanggapan.writeHead(400).end('Alamat tidak valid');
      return;
    }
    if (jalur.endsWith('/')) jalur += 'index.html';
    const berkas = resolve(AKAR_PUBLIK, `.${jalur}`);
    if (!berkas.startsWith(AKAR_PUBLIK + sep) && berkas !== AKAR_PUBLIK) {
      tanggapan.writeHead(403).end('Di luar direktori publik');
      return;
    }
    if (pengganti.has(jalur)) {
      const isi = Buffer.from(pengganti.get(jalur), 'utf8');
      tanggapan.writeHead(200, {
        'Content-Type': MIME[extname(jalur).toLowerCase()] || 'application/octet-stream',
        'Content-Length': isi.length,
        'Cache-Control': 'no-cache'
      });
      tanggapan.end(isi);
      return;
    }
    if (!existsSync(berkas) || !statSync(berkas).isFile()) {
      tanggapan.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Tidak ada');
      return;
    }
    const isi = readFileSync(berkas);
    tanggapan.writeHead(200, {
      'Content-Type': MIME[extname(berkas).toLowerCase()] || 'application/octet-stream',
      'Content-Length': isi.length,
      'Cache-Control': 'no-cache'
    });
    tanggapan.end(isi);
  });
  peladen.on('connection', (s) => {
    soket.add(s);
    s.on('close', () => soket.delete(s));
  });
  return { peladen, soket };
}

function cariChrome() {
  const calon = [
    process.env.CHROME_PATH,
    process.env.CHROME_BIN,
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/opt/google/chrome/chrome',
    '/snap/bin/chromium',
    join(process.env.HOME || '/root', '.cache/puppeteer/chrome/chrome-linux64/chrome')
  ].filter(Boolean);
  for (const jalur of calon) {
    if (existsSync(jalur)) return jalur;
  }
  const mana = ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'chrome']
    .map((nama) => process.env.PATH.split(':').map((bagian) => join(bagian, nama)).find((jalur) => existsSync(jalur)))
    .find(Boolean);
  if (mana) return mana;
  throw new Error(
    'Chrome tidak ditemukan. Pasang Chrome atau arahkan env CHROME_PATH ke binernya.'
  );
}

function kelasSoket() {
  if (typeof globalThis.WebSocket === 'function' && process.env.UJI_PWA_SOKET !== '1') {
    return globalThis.WebSocket;
  }
  const butuh = createRequire(import.meta.url);
  try {
    return butuh('ws');
  } catch {
    throw new Error(
      'WebSocket tidak tersedia: pakai Node 22 ke atas, atau pasang paket ws di jalur resolusi modul.'
    );
  }
}

function bukaSoket(alamat, KelasSoket) {
  return new Promise((selesai, tolak) => {
    const soket = new KelasSoket(alamat);
    const batas = setTimeout(() => tolak(new Error('Waktu habis membuka soket CDP')), 15000);
    soket.addEventListener('error', () => {
      clearTimeout(batas);
      tolak(new Error('Gagal membuka soket CDP'));
    });
    soket.addEventListener('open', () => {
      clearTimeout(batas);
      selesai(soket);
    });
  });
}

class CDP {
  constructor(soket) {
    this.soket = soket;
    this.urut = 0;
    this.tunggu = new Map();
    this.pendengar = [];
    soket.addEventListener('message', (peristiwa) => this.terima(peristiwa.data));
    soket.addEventListener('close', () => {
      for (const { tolak } of this.tunggu.values()) tolak(new Error('Soket CDP tertutup'));
      this.tunggu.clear();
    });
  }

  terima(data) {
    let pesan;
    try {
      pesan = JSON.parse(typeof data === 'string' ? data : data.toString());
    } catch {
      return;
    }
    if (pesan.id && this.tunggu.has(pesan.id)) {
      const { selesai, tolak } = this.tunggu.get(pesan.id);
      this.tunggu.delete(pesan.id);
      if (pesan.error) tolak(new Error(`CDP ${pesan.error.message}`));
      else selesai(pesan.result);
      return;
    }
    for (const pendengar of [...this.pendengar]) {
      if (pendengar.metode !== pesan.method) continue;
      if (pendengar.sesi && pendengar.sesi !== pesan.sessionId) continue;
      pendengar.fn(pesan.params);
    }
  }

  kirim(metode, params = {}, sesi) {
    const id = ++this.urut;
    const muatan = { id, method: metode, params };
    if (sesi) muatan.sessionId = sesi;
    return new Promise((selesai, tolak) => {
      this.tunggu.set(id, { selesai, tolak });
      this.soket.send(JSON.stringify(muatan));
      setTimeout(() => {
        if (this.tunggu.has(id)) {
          this.tunggu.delete(id);
          tolak(new Error(`Waktu habis 30 detik untuk ${metode}`));
        }
      }, 30000);
    });
  }

  pada(metode, fn, sesi) {
    const pendengar = { metode, fn, sesi };
    this.pendengar.push(pendengar);
    return () => {
      this.pendengar = this.pendengar.filter((item) => item !== pendengar);
    };
  }
}

function ambilJsonHttp(alamat, batasMs = 10000) {
  return new Promise((selesai, tolak) => {
    const permintaan = httpGet(alamat, (tanggapan) => {
      let isi = '';
      tanggapan.setEncoding('utf8');
      tanggapan.on('data', (potongan) => {
        isi += potongan;
      });
      tanggapan.on('end', () => {
        try {
          selesai(JSON.parse(isi));
        } catch {
          tolak(new Error(`Balasan bukan JSON dari ${alamat}`));
        }
      });
    });
    permintaan.setTimeout(batasMs, () => permintaan.destroy(new Error(`Waktu habis ${alamat}`)));
    permintaan.on('error', tolak);
  });
}

async function jalankanChrome() {
  const biner = cariChrome();
  const profil = mkdtempSync(join(tmpdir(), 'uji-pwa-chrome-'));
  const bendera = [
    '--headless',
    '--remote-debugging-port=0',
    `--user-data-dir=${profil}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--disable-extensions',
    '--disable-background-networking',
    '--window-size=412,823'
  ];
  if (process.env.UJI_PWA_SANDBOX !== '1') bendera.push('--no-sandbox', '--disable-setuid-sandbox');
  const proses = spawn(biner, bendera, { stdio: ['ignore', 'pipe', 'pipe'] });
  const log = [];
  const simpan = (potongan) => {
    log.push(potongan.toString());
    if (log.length > 60) log.shift();
  };
  proses.stdout.on('data', simpan);
  proses.stderr.on('data', simpan);

  const berkasPort = join(profil, 'DevToolsActivePort');
  const batas = Date.now() + 30000;
  while (!existsSync(berkasPort)) {
    if (proses.exitCode !== null) {
      throw new Error(`Chrome berhenti (kode ${proses.exitCode}). Log terakhir:\n${log.join('')}`);
    }
    if (Date.now() > batas) {
      throw new Error(`DevToolsActivePort tidak muncul. Log terakhir:\n${log.join('')}`);
    }
    await jeda(200);
  }
  const port = Number.parseInt(readFileSync(berkasPort, 'utf8').split('\n')[0], 10);
  if (!Number.isInteger(port) || port <= 0) throw new Error(`Port DevTools tidak masuk akal: ${port}`);
  const versi = await ambilJsonHttp(`http://127.0.0.1:${port}/json/version`);
  return {
    proses,
    profil,
    port,
    versi: versi.Browser || 'tidak diketahui',
    alamat: versi.webSocketDebuggerUrl,
    tutup: async () => {
      try {
        proses.kill('SIGTERM');
      } catch {
        /* diabaikan */
      }
      await jeda(300);
      if (proses.exitCode === null) proses.kill('SIGKILL');
      try {
        rmSync(profil, { recursive: true, force: true });
      } catch {
        /* diabaikan */
      }
    },
    log: () => log.join('')
  };
}

async function utama() {
  const pilihan = (process.argv.find((arg) => arg.startsWith('--pilih=')) || '')
    .replace('--pilih=', '')
    .split(',')
    .map((bagian) => bagian.trim().toUpperCase())
    .filter(Boolean);

  if (!existsSync(join(AKAR_PUBLIK, 'index.html'))) {
    galat('public/index.html tidak ada. Jalankan npm run build lebih dulu.');
    process.exit(1);
  }

  const { versi, jalur: jalurPrecache } = versiCachePublik();
  const judulKatalog = judulHalaman('page/2/index.html');
  const judulOffline = judulHalaman('offline/index.html');
  mkdirSync(DIR_KELUARAN, { recursive: true });

  const chrome = await jalankanChrome();
  catat(`Peramban     : ${chrome.versi}`);
  catat(`Versi cache  : ${versi} (daftar precache ${jalurPrecache.length} jalur)`);
  catat(`Keluaran     : ${DIR_KELUARAN}`);

  const soket = await bukaSoket(chrome.alamat, kelasSoket());
  const cdp = new CDP(soket);
  const { targetId } = await cdp.kirim('Target.createTarget', { url: 'about:blank' });
  const { sessionId: sesi } = await cdp.kirim('Target.attachToTarget', { targetId, flatten: true });
  await cdp.kirim('Page.enable', {}, sesi);
  await cdp.kirim('Runtime.enable', {}, sesi);

  const pengganti = new Map();
  const { peladen, soket: soketPeladen } = buatPeladen(pengganti);
  let port = 0;
  let akar = '';
  let hidup = false;

  async function nyalakan() {
    if (hidup) return;
    await new Promise((selesai, tolak) => {
      peladen.once('error', tolak);
      peladen.listen(port || 0, '127.0.0.1', () => {
        peladen.removeListener('error', tolak);
        port = peladen.address().port;
        selesai();
      });
    });
    akar = `http://127.0.0.1:${port}`;
    hidup = true;
  }

  async function matikan() {
    if (!hidup) return;
    await new Promise((selesai) => peladen.close(() => selesai()));
    for (const s of soketPeladen) s.destroy();
    soketPeladen.clear();
    hidup = false;
  }

  async function nilai(ekspresi) {
    const hasil = await cdp.kirim(
      'Runtime.evaluate',
      { expression: ekspresi, awaitPromise: true, returnByValue: true },
      sesi
    );
    if (hasil.exceptionDetails) {
      const rinci = hasil.exceptionDetails.exception;
      throw new Error(`Skrip di halaman gagal: ${(rinci && rinci.description) || hasil.exceptionDetails.text}`);
    }
    return hasil.result ? hasil.result.value : undefined;
  }

  async function navigasi(url, batasMs = 20000) {
    let lepas = () => {};
    const muat = new Promise((selesai) => {
      lepas = cdp.pada('Page.loadEventFired', () => selesai(), sesi);
      setTimeout(() => selesai(), batasMs);
    });
    const hasil = await cdp.kirim('Page.navigate', { url }, sesi);
    await muat;
    lepas();
    await jeda(250);
    return hasil || {};
  }

  async function tangkapan(namaUji) {
    try {
      const hasil = await cdp.kirim('Page.captureScreenshot', { format: 'png' }, sesi);
      const berkas = join(DIR_KELUARAN, `gagal-${namaUji}.png`);
      writeFileSync(berkas, Buffer.from(hasil.data, 'base64'));
      return berkas;
    } catch {
      return null;
    }
  }

  async function isiCache() {
    return nilai(
      `(async () => {
        const nama = await caches.keys();
        const isi = {};
        for (const satu of nama) isi[satu] = (await (await caches.open(satu)).keys()).map((k) => k.url);
        return isi;
      })()`
    );
  }

  const daftar = [
    {
      nama: 'T1',
      judul: 'Peladen statis dan berkas wajib',
      fn: async () => {
        await nyalakan();
        const dasar = await fetch(`${akar}/`);
        if (dasar.status !== 200) throw new Error(`GET / menjawab ${dasar.status}`);
        const manifest = await fetch(`${akar}/manifest.webmanifest`);
        if (manifest.status !== 200) throw new Error(`GET /manifest.webmanifest menjawab ${manifest.status}`);
        const tipe = manifest.headers.get('content-type') || '';
        if (!tipe.includes('manifest+json')) throw new Error(`Tipe manifest salah: ${tipe}`);
        return `peladen di port ${port}, manifest ${tipe}`;
      }
    },
    {
      nama: 'T2',
      judul: 'Service worker terdaftar dan aktif',
      fn: async () => {
        const hasil = await navigasi(`${akar}/`);
        if (hasil.errorText) throw new Error(`Navigasi gagal: ${hasil.errorText}`);
        const info = await nilai(
          `(async () => {
            const batas = new Promise((_, tolak) => setTimeout(
              () => tolak(new Error('tidak ada service worker aktif dalam 20 detik, kemungkinan pendaftaran gagal')),
              20000
            ));
            const reg = await Promise.race([navigator.serviceWorker.ready, batas]);
            return {
              scope: reg.scope,
              state: reg.active ? reg.active.state : null,
              jalur: reg.active ? new URL(reg.active.scriptURL).pathname : null
            };
          })()`
        );
        if (info.jalur !== '/sw.js') throw new Error(`Service worker tidak aktif di /sw.js: ${JSON.stringify(info)}`);
        if (info.scope !== `${akar}/`) throw new Error(`Scope tidak sama dengan akar uji: ${info.scope}`);
        if (info.state !== 'activated') throw new Error(`Keadaan service worker ${info.state}`);
        return `aktif, scope ${info.scope}`;
      }
    },
    {
      nama: 'T3',
      judul: 'Halaman dikendalikan setelah muat ulang',
      fn: async () => {
        let lepas = () => {};
        const muat = new Promise((selesai) => {
          lepas = cdp.pada('Page.loadEventFired', () => selesai(), sesi);
          setTimeout(() => selesai(), 20000);
        });
        await cdp.kirim('Page.reload', {}, sesi);
        await muat;
        lepas();
        await jeda(400);
        const jalur = await nilai(
          `navigator.serviceWorker.controller ? new URL(navigator.serviceWorker.controller.scriptURL).pathname : null`
        );
        if (jalur !== '/sw.js') throw new Error(`Halaman belum dikendalikan /sw.js: ${jalur}`);
        return 'controller = /sw.js';
      }
    },
    {
      nama: 'T4',
      judul: 'Cache terisi sesuai daftar precache',
      fn: async () => {
        const isi = await isiCache();
        const nama = Object.keys(isi);
        const shell = nama.filter((satu) => satu.includes('-shell-'));
        if (!shell.length) throw new Error(`Tidak ada cache shell. Cache yang ada: ${nama.join(', ')}`);
        if (!shell.some((satu) => satu.includes(versi))) {
          throw new Error(`Nama cache shell ${shell.join(', ')} tidak memuat versi ${versi}`);
        }
        const kunci = new Set(isi[shell[0]]);
        const kurang = jalurPrecache.filter((jalur) => !kunci.has(`${akar}${jalur}`));
        if (kurang.length) {
          throw new Error(`Cache shell kurang ${kurang.length} jalur dari daftar precache: ${kurang.join(', ')}`);
        }
        return `${shell[0]} memuat ${kunci.size} entri, semua ${jalurPrecache.length} jalur precache ada`;
      }
    },
    {
      nama: 'T5',
      judul: 'Navigasi luring dilayani cache',
      fn: async () => {
        await matikan();
        const hasil = await navigasi(`${akar}/page/2/`);
        if (hasil.errorText) throw new Error(`Navigasi luring gagal: ${hasil.errorText}`);
        const halaman = await nilai(`({ judul: document.title, alamat: location.pathname })`);
        if (halaman.alamat !== '/page/2/') throw new Error(`Alamat tersaji ${halaman.alamat}`);
        if (halaman.judul !== judulKatalog) {
          throw new Error(`Judul ${JSON.stringify(halaman.judul)} bukan judul katalog ${JSON.stringify(judulKatalog)}`);
        }
        return 'halaman katalog halaman 2 tersaji dari cache';
      }
    },
    {
      nama: 'T6',
      judul: 'Halaman tak tercache jatuh ke /offline/',
      fn: async () => {
        await matikan();
        const hasil = await navigasi(`${akar}/halaman-tidak-ada-uji-2026/`);
        const halaman = await nilai(`({ judul: document.title, teks: document.body.innerText.length })`);
        if (halaman.judul !== judulOffline) {
          throw new Error(`Judul ${JSON.stringify(halaman.judul)} bukan halaman luring ${JSON.stringify(judulOffline)}`);
        }
        if (halaman.teks < 20) throw new Error('Halaman luring tampak kosong');
        if (hasil.errorText) throw new Error(`Navigasi gagal: ${hasil.errorText}`);
        return 'halaman luring tersaji untuk alamat yang tidak ada';
      }
    },
    {
      nama: 'T7',
      judul: 'Chrome menerima manifest dan menganggap aplikasi dapat dipasang',
      fn: async () => {
        await nyalakan();
        const hasil = await navigasi(`${akar}/`);
        if (hasil.errorText) throw new Error(`Navigasi gagal: ${hasil.errorText}`);
        const manifest = await cdp.kirim('Page.getAppManifest', {}, sesi);
        if (manifest.errors && manifest.errors.length) {
          const rinci = manifest.errors.map((item) => `${item.critical ? 'kritis' : 'peringatan'} ${item.message}`).join('; ');
          throw new Error(`Manifest ditolak Chrome: ${rinci}`);
        }
        if (!manifest.url) throw new Error('Chrome tidak menemukan tag manifest di halaman');
        const pasang = await cdp.kirim('Page.getInstallabilityErrors', {}, sesi);
        const daftarGalat = pasang.installabilityErrors || [];
        if (daftarGalat.length) {
          const rinci = daftarGalat
            .map((item) => {
              const argumen = (item.errorArguments || []).map((a) => `${a.name}=${a.value}`).join(',');
              return `${item.errorId}${argumen ? ` (${argumen})` : ''}`;
            })
            .join('; ');
          throw new Error(`Chrome melaporkan galat pemasangan: ${rinci}`);
        }
        return `manifest ${manifest.url} tanpa galat, nol galat pemasangan`;
      }
    },
    {
      nama: 'T8',
      judul: '/index.json disimpan saat diminta, tidak saat pemasangan',
      fn: async () => {
        await nyalakan();
        const sebelum = await isiCache();
        const sudahAda = Object.values(sebelum).some((daftar) => daftar.some((url) => url.endsWith('/index.json')));
        if (sudahAda) throw new Error('/index.json sudah ikut terpasang saat instalasi, padahal seharusnya tidak');
        const status = await nilai(`fetch('/index.json').then((r) => r.status)`);
        if (status !== 200) throw new Error(`Pengambilan /index.json menjawab ${status}`);
        let ada = false;
        for (let putaran = 0; putaran < 12 && !ada; putaran += 1) {
          await jeda(250);
          const isi = await isiCache();
          ada = Object.values(isi).some((daftar) => daftar.some((url) => url.endsWith('/index.json')));
        }
        if (!ada) throw new Error('/index.json tidak masuk cache setelah diminta');
        return 'disimpan setelah diminta, seperti yang dirancang PERF-08';
      }
    },
    {
      nama: 'T9',
      judul: 'Cache versi lama dibuang saat service worker aktif kembali',
      fn: async () => {
        await nyalakan();
        const namaLama = 'donghuabatch-pwa-shell-1999-01-01-0';
        await nilai(
          `(async () => {
            const cache = await caches.open('${namaLama}');
            await cache.put(new Request('/uji-cache-lama/'), new Response('lama', { headers: { 'Content-Type': 'text/plain' } }));
            return true;
          })()`
        );
        const daftarSebelum = await nilai(`caches.keys()`);
        if (!daftarSebelum.includes(namaLama)) throw new Error('Cache lama gagal disuntikkan');
        // Service worker hanya dipasang ulang bila isi skripnya berubah, jadi
        // peladen uji menyajikan /sw.js dengan satu baris komentar tambahan.
        pengganti.set('/sw.js', `${readFileSync(join(AKAR_PUBLIK, 'sw.js'), 'utf8')}\n// penanda uji T9\n`);
        try {
          await nilai(
            `navigator.serviceWorker.getRegistration('/')
               .then((reg) => reg ? reg.update() : navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }))
               .then(() => true)`
          );
          let daftarSesudah = daftarSebelum;
          for (let putaran = 0; putaran < 32; putaran += 1) {
            await jeda(250);
            daftarSesudah = await nilai(`caches.keys()`);
            if (!daftarSesudah.includes(namaLama)) break;
          }
          if (daftarSesudah.includes(namaLama)) {
            throw new Error(`Cache ${namaLama} masih ada setelah aktivasi: ${daftarSesudah.join(', ')}`);
          }
          if (!daftarSesudah.some((satu) => satu.includes('-shell-') && satu.includes(versi))) {
            throw new Error(`Cache shell versi ${versi} tidak ada setelah aktivasi: ${daftarSesudah.join(', ')}`);
          }
          return `cache lama dibuang, cache shell ${versi} ada`;
        } finally {
          pengganti.delete('/sw.js');
        }
      }
    }
  ];

  const dipilih = pilihan.length ? daftar.filter((butir) => pilihan.includes(butir.nama)) : daftar;
  if (!dipilih.length) {
    galat(`Tidak ada uji yang cocok dengan --pilih=${pilihan.join(',')}. Pilihan: ${daftar.map((b) => b.nama).join(',')}`);
    process.exit(1);
  }

  const gagal = [];
  for (const butir of dipilih) {
    const waktu = Date.now();
    try {
      const rincian = await butir.fn();
      catat(`  ${butir.nama} LULUS  ${butir.judul}${rincian ? ` (${rincian})` : ''} [${Date.now() - waktu} ms]`);
    } catch (kesalahan) {
      const gambar = await tangkapan(butir.nama);
      gagal.push(`${butir.nama} ${butir.judul}: ${kesalahan.message}`);
      catat(`  ${butir.nama} GAGAL  ${butir.judul} [${Date.now() - waktu} ms]`);
      catat(`         ${kesalahan.message}`);
      if (gambar) catat(`         tangkapan layar: ${gambar}`);
    }
    if (Date.now() - mulai > BATAS_AKHIR) {
      gagal.push('Uji dihentikan karena melewati batas waktu 300 detik');
      catat('  Batas waktu 300 detik tercapai, sisa uji tidak dijalankan.');
      break;
    }
  }

  await matikan();
  await chrome.tutup();

  catat('');
  if (gagal.length) {
    catat(`Uji PWA peramban GAGAL (${gagal.length} dari ${dipilih.length} uji):`);
    for (const baris of gagal) catat(`- ${baris}`);
    process.exit(1);
  }
  catat(`Uji PWA peramban LULUS: ${dipilih.length} uji, ${((Date.now() - mulai) / 1000).toFixed(1)} detik.`);
  process.exit(0);
}

utama().catch((kesalahan) => {
  galat(`Uji PWA peramban berhenti karena masalah alat: ${kesalahan.message}`);
  process.exit(2);
});
