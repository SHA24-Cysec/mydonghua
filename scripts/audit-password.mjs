import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const temporary = mkdtempSync(join(tmpdir(), 'mydonghua-password-'));
const content = join(temporary, 'content');
const output = join(temporary, 'public');
const payload = `p'\"><svg onload=alert(1)>&\"`;
const yamlText = (value) => `'${value.replaceAll("'", "''")}'`;

function post(url, extra, groups) {
  return `---
date: '2025-01-01T00:00:00+07:00'
draft: false
title: 'Audit password arsip'
layout: postingan-donghua
url: '${url}'
alt: 'Audit password arsip'
studio: ['LAN Studio']
season: '2025'
genre: ['Fantasy']
type: 'Donghua'
status: 'Completed'
sub: 'Anichin'
durasi: '20 Menit'
episode: '1 Episode'
release: '2025'
rating: 7
thumbnail: '/img/post/link-click-season-2.webp'
image: '/img/post/link-click-season-2.webp'
sinopsis: 'Data uji.'
deskripsi: 'Data uji.'
keywords: 'Data uji.'
${extra}
downloadGroups:
  - title: 'Batch uji'
    downloads:
${groups}
---
`;
}

function decodeEntities(value) {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
  return value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (match, entity) => {
    if (entity[0] !== '#') return named[entity.toLowerCase()] ?? match;
    const hex = entity[1].toLowerCase() === 'x';
    return String.fromCodePoint(Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10));
  });
}

function downloadSection(html) {
  const section = html.match(/<section class=db-shell\b[\s\S]*?<\/section>/);
  assert.ok(section, 'Bagian unduhan tidak ditemukan.');
  return section[0];
}

function resolutionCards(section) {
  const cards = new Map();
  for (const match of section.matchAll(/<article class=(?:"db-res-card[^"]*"|db-res-card)[\s\S]*?<\/article>/g)) {
    const quality = match[0].match(/<span class=db-quality>([^<]+)<\/span>/)?.[1];
    assert.ok(quality, 'Kualitas pada kartu tidak ditemukan.');
    assert.ok(!cards.has(quality), `Kualitas ${quality} muncul dua kali.`);
    cards.set(quality, match[0]);
  }
  return cards;
}

function dataPassword(card) {
  const match = card.match(/\bdata-pass-text=(?:"([^"]*)"|'([^']*)'|([^\s>]+))/);
  assert.ok(match, 'Tombol salin atau nilai password tidak ditemukan.');
  return decodeEntities(match[1] ?? match[2] ?? match[3]);
}

try {
  mkdirSync(join(content, 'post'), { recursive: true });
  const downloads = `      - quality: '360p'
        link: 'https://example.org/360'
        button: 'Download'
        size: '1 MB'
        password: ${yamlText(payload)}
      - quality: '480p'
        link: '   '
        button: 'Download'
        size: ''
        password: 'jangan tampil'
      - quality: '720p'
        link: 'https://example.org/720'
        button: 'Download'
        size: '1 MB'
        password: '   '
      - quality: '1080p'
        link: 'https://example.org/1080'
        button: 'Belum Tersedia'
        size: '1 MB'
        password: 'jangan tampil'
      - quality: '4K'
        link: 'https://example.org/4k'
        button: 'Download'
        size: '1 MB'
        password: 'uji-resolusi-4k'`;
  const globalDownloads = `      - quality: '720p'
        link: 'https://example.org/global'
        button: 'Download'
        size: '1 MB'`;
  writeFileSync(join(content, 'post', 'per-resolusi.md'), post('uji-password-resolusi', '', downloads));
  writeFileSync(join(content, 'post', 'global.md'), post('uji-password-global', "password: 'kf'", globalDownloads));

  const build = spawnSync('hugo', ['--contentDir', content, '--destination', output, '--minify', '--quiet'], {
    cwd: resolve('.'), encoding: 'utf8'
  });
  if (build.status !== 0) throw new Error(`Hugo gagal membangun fixture: ${build.stderr || build.stdout || build.error?.message || build.status}`);

  const section = downloadSection(readFileSync(join(output, 'uji-password-resolusi', 'index.html'), 'utf8'));
  const cards = resolutionCards(section);
  assert.equal(cards.size, 5, 'Jumlah kartu resolusi tidak sesuai.');
  for (const quality of ['360p', '480p', '720p', '1080p', '4K']) {
    assert.ok(cards.has(quality), `Kartu ${quality} tidak ditemukan.`);
  }
  assert.ok(!section.includes('<div class=db-pass>'), 'Panel global muncul tanpa field global.');
  for (const quality of ['480p', '720p', '1080p']) {
    assert.ok(!cards.get(quality).includes('db-res-password'), `Password tidak boleh muncul pada ${quality}.`);
  }
  assert.equal(dataPassword(cards.get('360p')), payload, 'Password harus tersalin persis, termasuk karakter khusus.');
  assert.equal(dataPassword(cards.get('4K')), 'uji-resolusi-4k');
  const escapedValue = cards.get('360p').match(/<code class=db-pass-value>([\s\S]*?)<\/code>/)?.[1];
  assert.ok(escapedValue && !escapedValue.includes('<svg') && decodeEntities(escapedValue) === payload, 'Nilai password harus di-escape dengan aman.');

  const globalSection = downloadSection(readFileSync(join(output, 'uji-password-global', 'index.html'), 'utf8'));
  assert.ok(globalSection.includes('<div class=db-pass>'), 'Password global tidak ter-render.');
  assert.ok(!globalSection.includes('db-res-password'), 'Password global tidak boleh menjadi password per resolusi.');
  assert.equal(dataPassword(globalSection), 'kf');
  console.log('Audit password lulus: kompatibilitas global, per resolusi, input khusus, dan tautan belum tersedia.');
} catch (error) {
  console.error(`Audit password gagal: ${error.message}`);
  process.exitCode = 1;
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
