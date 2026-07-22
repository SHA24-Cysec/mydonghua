import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';

const publicDirectory = resolve('public');
const errors = [];

function walk(directory) {
  const output = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) output.push(...walk(path));
    else output.push(path);
  }
  return output;
}

if (!existsSync(publicDirectory)) {
  console.error('Folder public tidak ditemukan. Jalankan npm run build terlebih dahulu.');
  process.exit(1);
}

for (const removedPath of ['post/index.html', 'halaman/index.html']) {
  if (existsSync(resolve(publicDirectory, removedPath))) {
    errors.push(`Output mubazir masih ada: public/${removedPath}`);
  }
}

const files = walk(publicDirectory);
const htmlFiles = files.filter((file) => file.endsWith('.html'));
const xmlFiles = files
  .filter((file) => file.endsWith('.xml'))
  .map((file) => relative(publicDirectory, file).split(sep).join('/'))
  .sort();
const allowedXml = new Set(['index.xml', 'sitemap.xml']);

for (const xml of xmlFiles) {
  if (!allowedXml.has(xml)) errors.push(`RSS/XML yang tidak diharapkan: public/${xml}`);
}
for (const expected of allowedXml) {
  if (!xmlFiles.includes(expected)) errors.push(`Output XML wajib tidak ditemukan: public/${expected}`);
}

for (const file of htmlFiles) {
  const source = readFileSync(file, 'utf8');
  const relativePath = relative(publicDirectory, file).split(sep).join('/');
  const mainCount = (source.match(/<main\b/gi) ?? []).length;
  if (mainCount !== 1) errors.push(`${relativePath}: jumlah <main> ${mainCount}, seharusnya 1.`);
  if (!/<meta[^>]+name=(?:"description"|'description'|description)[^>]+content=/i.test(source)) {
    errors.push(`${relativePath}: meta description tidak ditemukan.`);
  }

  const pageMatch = relativePath.match(/(?:^|\/)page\/(\d+)\/index\.html$/);
  if (pageMatch && Number(pageMatch[1]) > 1) {
    if (!/<meta[^>]+name=(?:"robots"|'robots'|robots)[^>]+content=(?:"noindex, follow"|'noindex, follow')/i.test(source)) {
      errors.push(`${relativePath}: page 2+ harus noindex, follow.`);
    }

    const canonicalTag = source.match(/<link[^>]+rel=(?:"canonical"|'canonical'|canonical)[^>]*>/i)?.[0] ?? '';
    const canonicalValue = canonicalTag.match(/href=(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i);
    const canonical = canonicalValue?.[1] ?? canonicalValue?.[2] ?? canonicalValue?.[3] ?? '';
    const expectedPath = `/${relativePath.replace(/index\.html$/, '')}`;
    let canonicalPath = '';
    try {
      canonicalPath = new URL(canonical).pathname;
    } catch {
      errors.push(`${relativePath}: canonical tidak valid: ${canonical}`);
    }
    if (canonicalPath && canonicalPath !== expectedPath) {
      errors.push(`${relativePath}: canonical ${canonicalPath}, seharusnya ${expectedPath}.`);
    }
  }
}

if (errors.length) {
  console.error(`Audit output gagal (${errors.length} masalah):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

const totalBytes = files.reduce((sum, file) => sum + statSync(file).size, 0);
console.log(`Build audit lulus: ${htmlFiles.length} HTML, ${xmlFiles.length} XML, ${files.length} file, ${totalBytes} byte.`);
