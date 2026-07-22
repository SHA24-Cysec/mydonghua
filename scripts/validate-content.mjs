import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

const contentDirectory = resolve('content/post');
const invalidTaxonomyValues = new Set(['-', 'n/a', 'none', 'null']);
const canonicalValues = new Map([
  ['Sci-fi', 'Sci-Fi'],
  ['B.Cmay Pictures', 'B.CMAY Pictures'],
  ['B.cmay Pictures', 'B.CMAY Pictures'],
  ['B.CMAY PICTURES', 'B.CMAY Pictures'],
  ['Byment', 'BYMENT'],
  ['BUILD DREAM', 'Build Dream'],
  ['Lx Animation Studio', 'LX Animation Studio']
]);

function cleanValue(value) {
  const trimmed = String(value ?? '').trim();
  if (
    (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function frontMatter(source, file) {
  const match = source.match(/^---\s*\n([\s\S]*?)\n---(?:\s*\n|\s*$)/);
  if (!match) throw new Error(`${file}: front matter tidak ditemukan.`);
  return match[1];
}

function fieldInfo(frontMatterText, field) {
  const lines = frontMatterText.split(/\r?\n/);
  const pattern = new RegExp(`^${field}\\s*:\\s*(.*)$`, 'i');
  const index = lines.findIndex((line) => pattern.test(line));
  if (index === -1) return { present: false, values: [], bare: false };

  const inline = lines[index].match(pattern)[1].trim();
  if (inline) {
    if (inline === '[]') return { present: true, values: [], bare: false };
    return { present: true, values: [cleanValue(inline)], bare: false };
  }

  const values = [];
  for (let i = index + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.trim()) continue;
    if (!/^\s+/.test(line)) break;
    const item = line.match(/^\s*-\s*(.*)$/);
    if (item) values.push(cleanValue(item[1]));
  }

  return { present: true, values, bare: values.length === 0 };
}

function scalarRaw(frontMatterText, field) {
  const match = frontMatterText.match(new RegExp(`^${field}\\s*:\\s*(.*)$`, 'im'));
  return match ? match[1].trim() : '';
}

function scalar(frontMatterText, field) {
  return cleanValue(scalarRaw(frontMatterText, field));
}

const files = readdirSync(contentDirectory)
  .filter((name) => name.endsWith('.md') && !name.startsWith('_'))
  .sort();
const errors = [];
const urls = new Map();

for (const name of files) {
  const file = join(contentDirectory, name);
  const source = readFileSync(file, 'utf8');
  let front;
  try {
    front = frontMatter(source, file);
  } catch (error) {
    errors.push(error.message);
    continue;
  }

  const studio = fieldInfo(front, 'studio');
  const season = fieldInfo(front, 'season');
  const genre = fieldInfo(front, 'genre');

  if (!studio.present) errors.push(`${file}: field studio tidak ditemukan.`);
  if (studio.bare) errors.push(`${file}: studio kosong harus ditulis sebagai studio : [].`);

  for (const [field, values] of [['studio', studio.values], ['season', season.values], ['genre', genre.values]]) {
    for (const value of values) {
      if (!value) continue;
      if (invalidTaxonomyValues.has(value.toLowerCase())) {
        errors.push(`${file}: ${field} tidak boleh memakai nilai "${value}". Gunakan nilai kosong.`);
      }
      if (canonicalValues.has(value)) {
        errors.push(`${file}: gunakan "${canonicalValues.get(value)}", bukan "${value}".`);
      }
    }
  }

  const episode = scalar(front, 'episode');
  const episodeCountSource = scalarRaw(front, 'episodeCount');
  const episodeCountRaw = cleanValue(episodeCountSource);
  const episodeNumbers = episode.match(/\d+/g) ?? [];

  if (episodeCountSource && (/^['"]/.test(episodeCountSource) || !/^[1-9]\d*$/.test(episodeCountRaw))) {
    errors.push(`${file}: episodeCount harus berupa bilangan bulat positif tanpa tanda kutip.`);
  }
  if (episodeNumbers.length > 1 && !episodeCountRaw) {
    errors.push(`${file}: episode memiliki beberapa angka; tambahkan episodeCount dengan jumlah total.`);
  }

  for (const field of ['thumbnail', 'image']) {
    const value = scalar(front, field);
    if (!value) {
      errors.push(`${file}: ${field} kosong.`);
      continue;
    }
    const localPath = resolve('static', value.replace(/^\//, '').split('?', 1)[0]);
    if (!existsSync(localPath)) errors.push(`${file}: ${field} tidak ditemukan: ${value}`);
  }

  const url = scalar(front, 'url');
  if (!url) {
    errors.push(`${file}: url kosong.`);
  } else if (urls.has(url)) {
    errors.push(`${file}: url "${url}" juga dipakai oleh ${urls.get(url)}.`);
  } else {
    urls.set(url, file);
  }
}

if (errors.length) {
  console.error(`Validasi content gagal (${errors.length} masalah):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Content check lulus: ${files.length} post tervalidasi.`);
