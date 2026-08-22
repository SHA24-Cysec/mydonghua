import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Script } from 'node:vm';

const errors = [];
const root = process.cwd();

function read(path) {
  const absolutePath = resolve(root, path);
  if (!existsSync(absolutePath)) {
    errors.push(`File wajib tidak ditemukan: ${path}`);
    return '';
  }
  return readFileSync(absolutePath, 'utf8');
}

function checkPng(path, expectedWidth, expectedHeight) {
  const absolutePath = resolve(root, path);
  if (!existsSync(absolutePath)) {
    errors.push(`Ikon PWA tidak ditemukan: ${path}`);
    return;
  }

  const data = readFileSync(absolutePath);
  const signature = data.subarray(0, 8).toString('hex');
  if (signature !== '89504e470d0a1a0a') {
    errors.push(`${path}: format bukan PNG yang valid.`);
    return;
  }

  const width = data.readUInt32BE(16);
  const height = data.readUInt32BE(20);
  if (width !== expectedWidth || height !== expectedHeight) {
    errors.push(`${path}: ukuran ${width}x${height}, seharusnya ${expectedWidth}x${expectedHeight}.`);
  }
}

function webpDimensions(data) {
  if (data.subarray(0, 4).toString('ascii') !== 'RIFF' || data.subarray(8, 12).toString('ascii') !== 'WEBP') {
    throw new Error('header RIFF/WEBP tidak valid');
  }

  let offset = 12;
  while (offset + 8 <= data.length) {
    const chunkType = data.subarray(offset, offset + 4).toString('ascii');
    const chunkSize = data.readUInt32LE(offset + 4);
    const payload = offset + 8;

    if (chunkType === 'VP8X' && chunkSize >= 10) {
      return {
        width: 1 + data.readUIntLE(payload + 4, 3),
        height: 1 + data.readUIntLE(payload + 7, 3)
      };
    }

    if (chunkType === 'VP8 ' && chunkSize >= 10) {
      return {
        width: data.readUInt16LE(payload + 6) & 0x3fff,
        height: data.readUInt16LE(payload + 8) & 0x3fff
      };
    }

    if (chunkType === 'VP8L' && chunkSize >= 5 && data[payload] === 0x2f) {
      const b1 = data[payload + 1];
      const b2 = data[payload + 2];
      const b3 = data[payload + 3];
      const b4 = data[payload + 4];
      return {
        width: 1 + b1 + ((b2 & 0x3f) << 8),
        height: 1 + ((b2 & 0xc0) >> 6) + (b3 << 2) + ((b4 & 0x0f) << 10)
      };
    }

    offset = payload + chunkSize + (chunkSize % 2);
  }

  throw new Error('chunk dimensi WebP tidak ditemukan');
}

function checkWebp(path, expectedWidth, expectedHeight) {
  const absolutePath = resolve(root, path);
  if (!existsSync(absolutePath)) {
    errors.push(`Ikon PWA tidak ditemukan: ${path}`);
    return;
  }

  try {
    const { width, height } = webpDimensions(readFileSync(absolutePath));
    if (width !== expectedWidth || height !== expectedHeight) {
      errors.push(`${path}: ukuran ${width}x${height}, seharusnya ${expectedWidth}x${expectedHeight}.`);
    }
  } catch (error) {
    errors.push(`${path}: format WebP tidak valid: ${error.message}.`);
  }
}

let manifest = null;
try {
  manifest = JSON.parse(read('static/manifest.webmanifest'));
} catch (error) {
  errors.push(`Manifest tidak valid: ${error.message}`);
}

if (manifest) {
  const requiredValues = {
    name: 'DonghuaBatch',
    short_name: 'DonghuaBatch',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    theme_color: '#060816',
    background_color: '#060816'
  };

  for (const [key, expected] of Object.entries(requiredValues)) {
    if (manifest[key] !== expected) errors.push(`Manifest ${key} harus bernilai ${expected}.`);
  }

  const icons = Array.isArray(manifest.icons) ? manifest.icons : [];
  for (const requiredIcon of ['/icons/icon-192.webp', '/icons/icon-512.webp']) {
    const icon = icons.find((item) => item.src === requiredIcon);
    if (!icon) {
      errors.push(`Manifest belum memuat ikon ${requiredIcon}.`);
    } else if (icon.type !== 'image/webp') {
      errors.push(`Manifest ${requiredIcon} harus memakai type image/webp.`);
    }
  }

  if (icons.some((icon) => String(icon.src).endsWith('.png'))) {
    errors.push('Ikon manifest masih memuat format PNG.');
  }
}

checkWebp('static/icons/icon-192.webp', 192, 192);
checkWebp('static/icons/icon-512.webp', 512, 512);
checkPng('static/icons/apple-touch-icon.png', 180, 180);

const serviceWorker = read('static/sw.js');
const clientScript = read('assets/js/site-pwa.js');
const linkPartial = read('layouts/partials/link.html');
const globalScripts = read('layouts/partials/global-scripts.html');
const navbar = read('layouts/partials/navbar.html');

for (const [label, source] of [['service worker', serviceWorker], ['client PWA', clientScript]]) {
  try {
    new Script(source, { filename: label });
  } catch (error) {
    errors.push(`${label}: sintaks JavaScript tidak valid: ${error.message}`);
  }
}

for (const path of ['/index.json', '/offline/', '/manifest.webmanifest', '/icons/icon-192.webp']) {
  if (!serviceWorker.includes(`'${path}'`)) errors.push(`Service worker belum menyimpan ${path}.`);
}

if (!clientScript.includes("navigator.serviceWorker.register('/sw.js'")) {
  errors.push('Client PWA belum mendaftarkan /sw.js.');
}
if (!linkPartial.includes('manifest.webmanifest')) errors.push('Tag manifest tidak ditemukan di partial link.');
if (!linkPartial.includes('apple-touch-icon.png')) errors.push('Apple touch icon tidak ditemukan di partial link.');
if (!globalScripts.includes('js/site-pwa.js')) errors.push('Script PWA belum dimuat oleh global-scripts.');
if (!navbar.includes('data-pwa-install')) errors.push('Tombol pemasangan PWA tidak ditemukan di navbar.');

const builtHome = resolve(root, 'public/index.html');
if (existsSync(builtHome)) {
  const home = readFileSync(builtHome, 'utf8');
  for (const marker of ['manifest.webmanifest', 'apple-touch-icon.png', 'site-pwa.min.']) {
    if (!home.includes(marker)) errors.push(`Output beranda belum memuat ${marker}.`);
  }
  for (const path of ['public/sw.js', 'public/manifest.webmanifest', 'public/offline/index.html', 'public/icons/icon-192.webp', 'public/icons/icon-512.webp']) {
    if (!existsSync(resolve(root, path))) errors.push(`Output build tidak ditemukan: ${path}`);
  }
}

if (errors.length) {
  console.error(`Audit PWA gagal (${errors.length} masalah):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('Audit PWA lulus: manifest, ikon WebP, service worker, tombol instalasi, dan output build tervalidasi.');
