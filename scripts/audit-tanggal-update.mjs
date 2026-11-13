import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  bangunPetaTanggalUpdate,
  frontMatter,
  parseTanggalValid,
  skalarFrontMatter
} from './sinkron-tanggal-update.mjs';

const konten = resolve('content/post');
const publik = resolve('public');
const berkasData = resolve('assets/data/tanggal-update.json');
const selisihWib = 7 * 60 * 60 * 1000;
const bulanIndoSingkat = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const bulanInggrisTerlarang = /\b(?:January|February|March|May|June|July|August|October|December)\b/;

const galat = [];
const peringatan = [];

function metaAtribut(html, atribut, nama) {
  const pola = new RegExp(`<meta[^>]+${atribut}=["']?${nama}["']?[^>]+content=["']?([^"' >]+)`, 'i');
  const cocok = html.match(pola);
  return cocok ? parseTanggalValid(cocok[1]) : null;
}

function jsonLdData(html) {
  for (const cocok of html.matchAll(/<script[^>]+type=["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const objek = JSON.parse(cocok[1]);
      if (objek && (objek.datePublished || objek.dateModified)) {
        return {
          terbit: parseTanggalValid(objek.datePublished),
          update: parseTanggalValid(objek.dateModified)
        };
      }
    } catch {
      return { rusak: true, terbit: null, update: null };
    }
  }
  return { rusak: false, terbit: null, update: null };
}

function samaDetik(a, b) {
  return Boolean(a && b) && Math.floor(a.getTime() / 1000) === Math.floor(b.getTime() / 1000);
}

function hariWib(tanggal) {
  const geser = new Date(tanggal.getTime() + selisihWib);
  return geser.toISOString().slice(0, 10);
}

function tanggalIndo(tanggal) {
  const geser = new Date(tanggal.getTime() + selisihWib);
  return `${geser.getUTCDate()} ${bulanIndoSingkat[geser.getUTCMonth()]} ${geser.getUTCFullYear()}`;
}

let hasilSinkron = null;
try {
  hasilSinkron = bangunPetaTanggalUpdate(process.cwd());
  if (hasilSinkron.riwayat.shallow) {
    galat.push('Repository git berstatus shallow clone (--depth=1). Jalankan git fetch --unshallow sebelum build agar lastmod tidak seragam.');
  }
  if (hasilSinkron.riwayat.jumlahCommit >= 50) {
    for (const sha of hasilSinkron.konfigurasi.daftarSha) {
      try {
        const tipe = execFileSync('git', ['cat-file', '-t', sha], {
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'ignore']
        }).trim();
        if (tipe !== 'commit') {
          galat.push(`abaikan-commit.json: objek ${sha} bertipe "${tipe}", bukan commit.`);
        }
      } catch {
        galat.push(`abaikan-commit.json: SHA commit ${sha} tidak ditemukan di riwayat git.`);
      }
    }
  }
} catch (error) {
  galat.push(`Gagal memvalidasi riwayat git dan abaikan-commit.json: ${error.message}`);
}

if (!existsSync(berkasData)) {
  galat.push('assets/data/tanggal-update.json belum dibuat. Jalankan npm run sync:tanggal sebelum build Hugo.');
} else if (hasilSinkron) {
  try {
    const tersimpan = JSON.parse(readFileSync(berkasData, 'utf8'));
    const kunciTersimpan = Object.keys(tersimpan).sort();
    const kunciSegar = Object.keys(hasilSinkron.peta).sort();
    if (kunciTersimpan.join('\n') !== kunciSegar.join('\n')) {
      galat.push('assets/data/tanggal-update.json tidak sinkron dengan daftar berkas konten terbaru.');
    } else {
      for (const kunci of kunciSegar) {
        const t1 = parseTanggalValid(tersimpan[kunci]);
        const t2 = parseTanggalValid(hasilSinkron.peta[kunci]);
        if (!samaDetik(t1, t2)) {
          galat.push(`assets/data/tanggal-update.json tidak sinkron untuk ${kunci}: ${tersimpan[kunci]} vs ${hasilSinkron.peta[kunci]}.`);
          break;
        }
      }
    }
  } catch (error) {
    galat.push(`assets/data/tanggal-update.json rusak: ${error.message}`);
  }
}

const berkasKonten = readdirSync(konten)
  .filter((nama) => nama.endsWith('.md') && !nama.startsWith('_'))
  .sort();

const halaman = [];

for (const nama of berkasKonten) {
  const front = frontMatter(readFileSync(join(konten, nama), 'utf8'));
  const url = skalarFrontMatter(front, 'url') || nama.replace(/\.md$/, '');
  const manualOverride = Boolean(skalarFrontMatter(front, 'updated') || skalarFrontMatter(front, 'lastmod'));
  const html = join(publik, url, 'index.html');

  if (!existsSync(html)) {
    galat.push(`${nama}: public/${url}/index.html tidak ditemukan.`);
    continue;
  }

  const isi = readFileSync(html, 'utf8');
  const terbit = metaAtribut(isi, 'property', 'article:published_time');
  const update = metaAtribut(isi, 'property', 'article:modified_time');
  const schemaTerbit = metaAtribut(isi, 'itemprop', 'datePublished');
  const schemaUpdate = metaAtribut(isi, 'itemprop', 'dateModified');
  const ld = jsonLdData(isi);

  if (!terbit || !update) {
    galat.push(`${nama}: meta article:published_time atau article:modified_time tidak lengkap.`);
    continue;
  }
  if (Math.floor(update.getTime() / 1000) < Math.floor(terbit.getTime() / 1000)) {
    galat.push(`${nama}: waktu update (${update.toISOString()}) lebih tua daripada waktu terbit (${terbit.toISOString()}).`);
  }
  if (!samaDetik(terbit, schemaTerbit) || !samaDetik(update, schemaUpdate)) {
    galat.push(`${nama}: meta itemprop datePublished/dateModified tidak sinkron dengan OpenGraph.`);
  }
  if (ld.rusak || !samaDetik(terbit, ld.terbit) || !samaDetik(update, ld.update)) {
    galat.push(`${nama}: JSON-LD datePublished/dateModified tidak valid atau tidak sinkron dengan OpenGraph.`);
  }

  halaman.push({ nama, url, isi, terbit, update, manualOverride });
}

for (const h of halaman) {
  const perluBadge = hariWib(h.update) > hariWib(h.terbit);
  const teks = tanggalIndo(h.update);
  const cocokBadge = h.isi.match(/Diperbarui\s*<strong class=["']?text-amber-300["']?>([^<]+)<\/strong>/);
  const cocokTooltip = h.isi.match(/title=(?:"(Terakhir diperbarui [^"]+)"|'(Terakhir diperbarui [^']+)')/);

  if (perluBadge && (!cocokBadge || cocokBadge[1] !== teks)) {
    galat.push(`${h.nama}: tanggal update ${hariWib(h.update)} lebih baru dari terbit, badge "${teks}" tidak ditemukan.`);
  }
  if (!perluBadge && cocokBadge) {
    galat.push(`${h.nama}: badge "${cocokBadge[1]}" tampil padahal tidak ada pembaruan konten setelah tanggal terbit.`);
  }
  if (cocokTooltip) {
    const teksTooltip = cocokTooltip[1] || cocokTooltip[2] || '';
    if (bulanInggrisTerlarang.test(teksTooltip)) {
      galat.push(`${h.nama}: tooltip tanggal update masih memuat nama bulan bahasa Inggris (${teksTooltip}).`);
    }
  }
}

const urutan = [];
const beranda = [join(publik, 'index.html')];
for (let i = 2; ; i += 1) {
  const berkas = join(publik, 'page', String(i), 'index.html');
  if (!existsSync(berkas)) break;
  beranda.push(berkas);
}

const perUrl = new Map(halaman.map((h) => [`/${h.url}/`, h]));

for (const berkas of beranda) {
  if (!existsSync(berkas)) {
    galat.push(`${berkas} tidak ditemukan.`);
    continue;
  }
  const isi = readFileSync(berkas, 'utf8');
  for (const cocok of isi.matchAll(/class=["']?donghua-card-link["']?[^>]*href=["']?([^"' >]+)/g)) {
    const jalur = new URL(cocok[1], 'https://donghuabatch.com/').pathname;
    const h = perUrl.get(jalur);
    if (h) urutan.push(h);
  }
}

if (urutan.length !== halaman.length) {
  galat.push(`Beranda menampilkan ${urutan.length} kartu, seharusnya ${halaman.length}.`);
}

for (let i = 1; i < urutan.length; i += 1) {
  const sebelum = urutan[i - 1];
  const sekarang = urutan[i];
  const urutanBenar = sebelum.update.getTime() > sekarang.update.getTime()
    || (sebelum.update.getTime() === sekarang.update.getTime() && sebelum.terbit.getTime() >= sekarang.terbit.getTime());
  if (!urutanBenar) {
    galat.push(
      `Urutan beranda salah di posisi ${i + 1}: "${sebelum.url}" (update ${hariWib(sebelum.update)}) tampil sebelum "${sekarang.url}" (update ${hariWib(sekarang.update)}).`
    );
    break;
  }
}

if (urutan.length >= 8) {
  const sampelPost = urutan[0].isi;
  const blokTerbaru = sampelPost.match(/donghua-card-grid-latest[\s\S]*?<\/div>\s*<\/section>/)?.[0]
    || sampelPost.slice(sampelPost.indexOf('donghua-card-grid-latest'));
  const kartuTerbaru = [];
  for (const cocok of blokTerbaru.matchAll(/class=["']?donghua-card-link["']?[^>]*href=["']?([^"' >]+)/g)) {
    const jalur = new URL(cocok[1], 'https://donghuabatch.com/').pathname;
    const h = perUrl.get(jalur);
    if (h) kartuTerbaru.push(h.url);
    if (kartuTerbaru.length === 8) break;
  }
  const targetTerbaru = urutan.slice(0, 8).map((h) => h.url);
  if (kartuTerbaru.join(',') !== targetTerbaru.join(',')) {
    galat.push('Widget Donghua Terbaru tidak sinkron dengan 8 urutan teratas Beranda.');
  }
}

const indexJsonPath = join(publik, 'index.json');
if (existsSync(indexJsonPath)) {
  try {
    const dataIndex = JSON.parse(readFileSync(indexJsonPath, 'utf8'));
    if (!Array.isArray(dataIndex) || dataIndex.length !== urutan.length) {
      galat.push(`public/index.json memuat ${Array.isArray(dataIndex) ? dataIndex.length : 0} entri, seharusnya ${urutan.length}.`);
    } else {
      for (let i = 0; i < dataIndex.length; i += 1) {
        const entri = dataIndex[i];
        const target = urutan[i];
        const jalur = new URL(entri.permalink, 'https://donghuabatch.com/').pathname;
        if (jalur !== `/${target.url}/`) {
          galat.push(`Urutan public/index.json di posisi ${i + 1} (${jalur}) tidak sinkron dengan Beranda (/${target.url}/).`);
          break;
        }
        const jsonTerbit = parseTanggalValid(entri.date);
        const jsonUpdate = parseTanggalValid(entri.lastmod);
        if (!samaDetik(jsonTerbit, target.terbit) || !samaDetik(jsonUpdate, target.update)) {
          galat.push(`public/index.json: date/lastmod untuk ${target.url} tidak sinkron dengan halaman.`);
          break;
        }
      }
    }
  } catch (error) {
    galat.push(`public/index.json tidak valid: ${error.message}`);
  }
} else {
  galat.push('public/index.json tidak ditemukan.');
}

function lolosRegex(teks) {
  return String(teks).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const sitemapPath = join(publik, 'sitemap.xml');
if (existsSync(sitemapPath)) {
  const isi = readFileSync(sitemapPath, 'utf8');
  if (urutan.length > 0) {
    const cocokBeranda = isi.match(/<loc>https:\/\/donghuabatch\.com\/<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/);
    if (!cocokBeranda || !samaDetik(parseTanggalValid(cocokBeranda[1]), urutan[0].update)) {
      galat.push('Sitemap: lastmod beranda utama tidak sinkron dengan postingan teratas.');
    }
  }
  for (const h of halaman) {
    const pola = new RegExp(`<loc>https://donghuabatch\\.com/${lolosRegex(h.url)}/</loc>\\s*<lastmod>([^<]+)</lastmod>`);
    const cocok = isi.match(pola);
    if (!cocok) {
      galat.push(`Sitemap: entri ${h.url} tanpa lastmod.`);
      continue;
    }
    const waktuSitemap = parseTanggalValid(cocok[1]);
    if (!samaDetik(waktuSitemap, h.update)) {
      galat.push(`Sitemap: lastmod ${h.url} = ${cocok[1]}, beda dengan halaman ${h.update.toISOString()}.`);
    }
  }
} else {
  galat.push('public/sitemap.xml tidak ditemukan.');
}

let kandidatPeta = 0;
let cocokPeta = 0;
if (hasilSinkron) {
  for (const h of halaman) {
    const targetIso = hasilSinkron.peta[`post/${h.nama}`];
    const targetWaktu = parseTanggalValid(targetIso);
    if (!targetWaktu) continue;
    kandidatPeta += 1;
    if (samaDetik(targetWaktu, h.update)) {
      cocokPeta += 1;
    } else {
      galat.push(`${h.nama}: lastmod halaman (${h.update.toISOString()}) tidak cocok dengan hasil filter commit (${targetWaktu.toISOString()}).`);
    }
  }
}

const seragam = new Map();
for (const h of halaman) {
  const kunci = h.update.getTime();
  seragam.set(kunci, (seragam.get(kunci) ?? 0) + 1);
}
const terbanyak = halaman.length ? Math.max(...seragam.values()) : 0;
if (halaman.length > 20 && terbanyak / halaman.length > 0.9) {
  galat.push(`${terbanyak} dari ${halaman.length} postingan punya lastmod identik. Riwayat git kemungkinan hasil clone dangkal (shallow), tanggal update jadi seragam.`);
}

if (peringatan.length) {
  for (const pesan of peringatan) console.warn(`Peringatan: ${pesan}`);
}

if (galat.length) {
  console.error(`Audit tanggal update gagal (${galat.length} masalah):`);
  for (const pesan of galat.slice(0, 20)) console.error(`- ${pesan}`);
  process.exit(1);
}

const jumlahUpdate = halaman.filter((h) => hariWib(h.update) > hariWib(h.terbit)).length;
const jumlahAbaikan = hasilSinkron ? hasilSinkron.riwayat.jumlahCommitDiabaikan : 0;
console.log(
  `Audit tanggal update lulus: ${halaman.length} postingan (${jumlahUpdate} diperbarui, ${halaman.length - jumlahUpdate} terbit murni, ${jumlahAbaikan} commit perapian massal diabaikan), ${cocokPeta}/${kandidatPeta} cocok persis, Beranda, Donghua Terbaru, index.json, JSON-LD, OpenGraph, Schema, dan sitemap sinkron.`
);
