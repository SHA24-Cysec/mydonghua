import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const konten = resolve('content/post');
const publik = resolve('public');
const zona = 'Asia/Jakarta';
const selisihWib = 7 * 60 * 60 * 1000;

const galat = [];
const peringatan = [];

function frontMatter(source) {
  const cocok = source.match(/^---\s*\n([\s\S]*?)\n---(?:\s*\n|$)/);
  return cocok ? cocok[1] : '';
}

function skalar(front, field) {
  const cocok = front.match(new RegExp(`^${field}\\s*:\\s*(.*)$`, 'im'));
  if (!cocok) return '';
  return cocok[1].trim().replace(/^['"]|['"]$/g, '').trim();
}

function meta(html, properti) {
  const pola = new RegExp(`property=["']?${properti}["']? content=["']?([^"' >]+)`);
  const cocok = html.match(pola);
  return cocok ? new Date(cocok[1]) : null;
}

function hariWib(tanggal) {
  const geser = new Date(tanggal.getTime() + selisihWib);
  return geser.toISOString().slice(0, 10);
}

function tanggalIndo(tanggal) {
  const geser = new Date(tanggal.getTime() + selisihWib);
  const bulan = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  return `${geser.getUTCDate()} ${bulan[geser.getUTCMonth()]} ${geser.getUTCFullYear()}`;
}

function gitCommit(berkas) {
  try {
    const keluaran = execFileSync('git', ['log', '-1', '--format=%cI', '--', berkas], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
    return keluaran ? new Date(keluaran) : null;
  } catch {
    return null;
  }
}

const berkasKonten = readdirSync(konten)
  .filter((nama) => nama.endsWith('.md') && !nama.startsWith('_'))
  .sort();

const halaman = [];

for (const nama of berkasKonten) {
  const front = frontMatter(readFileSync(join(konten, nama), 'utf8'));
  const url = skalar(front, 'url') || nama.replace(/\.md$/, '');
  const html = join(publik, url, 'index.html');

  if (!existsSync(html)) {
    galat.push(`${nama}: public/${url}/index.html tidak ditemukan.`);
    continue;
  }

  const isi = readFileSync(html, 'utf8');
  const terbit = meta(isi, 'article:published_time');
  const update = meta(isi, 'article:modified_time');

  if (!terbit || !update) {
    galat.push(`${nama}: meta article:published_time atau article:modified_time tidak lengkap.`);
    continue;
  }

  halaman.push({ nama, url, isi, terbit, update });
}

for (const h of halaman) {
  const perluBadge = hariWib(h.update) > hariWib(h.terbit);
  const teks = tanggalIndo(h.update);
  const badge = h.isi.includes(`Diperbarui <strong class=text-amber-300>${teks}</strong>`);

  if (perluBadge && !badge) {
    galat.push(`${h.nama}: tanggal update ${hariWib(h.update)} lebih baru dari terbit, badge "${teks}" tidak ada.`);
  }
  if (!perluBadge && badge) {
    galat.push(`${h.nama}: badge "${teks}" tampil padahal tidak ada pembaruan setelah tanggal terbit.`);
  }
}

const urutan = [];
const beranda = [join(publik, 'index.html')];
for (let i = 2; i <= 30; i += 1) {
  const berkas = join(publik, 'page', String(i), 'index.html');
  if (!existsSync(berkas)) break;
  beranda.push(berkas);
}

const perUrl = new Map(halaman.map((h) => [`/${h.url}/`, h]));

for (const berkas of beranda) {
  const isi = readFileSync(berkas, 'utf8');
  for (const cocok of isi.matchAll(/class="?donghua-card-link"?[^>]*href="?([^" >]+)/g)) {
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

const sitemapPath = join(publik, 'sitemap.xml');
if (existsSync(sitemapPath)) {
  const isi = readFileSync(sitemapPath, 'utf8');
  for (const h of halaman.slice(0, 40)) {
    const pola = new RegExp(`<loc>https://donghuabatch.com/${h.url}/</loc>\\s*<lastmod>([^<]+)</lastmod>`);
    const cocok = isi.match(pola);
    if (!cocok) {
      galat.push(`Sitemap: entri ${h.url} tanpa lastmod.`);
      continue;
    }
    if (Math.floor(new Date(cocok[1]).getTime() / 1000) !== Math.floor(h.update.getTime() / 1000)) {
      galat.push(`Sitemap: lastmod ${h.url} = ${cocok[1]}, beda dengan halaman ${h.update.toISOString()}.`);
    }
  }
} else {
  galat.push('public/sitemap.xml tidak ditemukan.');
}

const contohGit = halaman.slice(0, 25).filter((h) => gitCommit(join(konten, h.nama)));
const cocokGit = contohGit.filter((h) => {
  const commit = gitCommit(join(konten, h.nama));
  return hariWib(commit) === hariWib(h.update);
});

if (contohGit.length && cocokGit.length === 0) {
  peringatan.push('Tidak ada lastmod yang cocok dengan tanggal commit git. Pastikan build menyertakan riwayat git (enableGitInfo butuh folder .git).');
}

const seragam = new Map();
for (const h of halaman) {
  const kunci = h.update.getTime();
  seragam.set(kunci, (seragam.get(kunci) ?? 0) + 1);
}
const terbanyak = Math.max(...seragam.values());
if (halaman.length > 20 && terbanyak / halaman.length > 0.9) {
  peringatan.push(`${terbanyak} dari ${halaman.length} postingan punya lastmod identik. Riwayat git kemungkinan hasil clone dangkal (shallow), tanggal update jadi seragam.`);
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
console.log(
  `Audit tanggal update lulus: ${halaman.length} postingan, ${jumlahUpdate} punya tanggal update, ${contohGit.length ? `${cocokGit.length}/${contohGit.length} sampel cocok dengan commit git` : 'tanpa data git'}, urutan beranda dan sitemap sinkron.`
);
