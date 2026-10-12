import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const temporaryDirectory = mkdtempSync(join(tmpdir(), 'mydonghua-css-'));
const temporaryOutput = join(temporaryDirectory, 'main.css');
// Tailwind v4 memindahkan CLI ke paket @tailwindcss/cli. Path lama
// (tailwindcss/lib/cli.js) hanya berlaku untuk v3, jadi keduanya dicek
// supaya skrip ini tidak lagi gagal MODULE_NOT_FOUND di instalasi v4.
const cliV4 = resolve('node_modules/@tailwindcss/cli/dist/index.mjs');
const cliV3 = resolve('node_modules/tailwindcss/lib/cli.js');
const tailwindCli = existsSync(cliV4) ? cliV4 : cliV3;

try {
  const result = spawnSync(
    process.execPath,
    [tailwindCli, '-i', './assets/input.css', '-o', temporaryOutput],
    { cwd: process.cwd(), stdio: 'inherit' }
  );

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  const committed = readFileSync(resolve('assets/main.css'));
  const generated = readFileSync(temporaryOutput);

  if (!committed.equals(generated)) {
    console.error('assets/main.css tidak sinkron dengan assets/input.css.');
    console.error('Jalankan: npm run build:css');
    process.exit(1);
  }

  console.log('CSS check lulus: assets/main.css sinkron.');
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
